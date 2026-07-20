BEGIN;

-- Coach meal checkoffs are a projection of the canonical consumption ledger.
-- Clients may read the projection, but only this RPC may mutate it.
REVOKE INSERT, UPDATE, DELETE ON public.program_meal_completions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.program_meal_completions TO authenticated;
GRANT ALL ON public.program_meal_completions TO service_role;

CREATE OR REPLACE FUNCTION public.record_coach_program_meal_consumption(
  p_program_meal_id UUID,
  p_status TEXT,
  p_request_id UUID DEFAULT gen_random_uuid(),
  p_started_consuming_at TIMESTAMPTZ DEFAULT clock_timestamp(),
  p_time_precision TEXT DEFAULT 'exact',
  p_timezone_name TEXT DEFAULT 'Asia/Qatar',
  p_utc_offset_minutes SMALLINT DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_status TEXT := lower(COALESCE(p_status, ''));
  v_program_id UUID;
  v_meal_id UUID;
  v_assigned_date DATE;
  v_meal_type TEXT;
  v_snapshot JSONB;
  v_consumption public.meal_consumptions%ROWTYPE;
  v_existing_result JSONB;
  v_previous_state JSONB;
  v_current_state JSONB;
  v_result JSONB;
  v_event_version INTEGER;
  v_log_date DATE;
  v_old_log_date DATE;
  v_old_calories INTEGER := 0;
  v_old_protein INTEGER := 0;
  v_old_carbs INTEGER := 0;
  v_old_fat INTEGER := 0;
  v_old_fiber INTEGER := 0;
  v_new_calories INTEGER := 0;
  v_new_protein INTEGER := 0;
  v_new_carbs INTEGER := 0;
  v_new_fat INTEGER := 0;
  v_new_fiber INTEGER := 0;
  v_history_id UUID;
  v_completion_id UUID;
  v_semantic_key TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_program_meal_id IS NULL THEN
    RAISE EXCEPTION 'PROGRAM_MEAL_REQUIRED';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED';
  END IF;
  IF v_status NOT IN ('full', 'reversed') THEN
    RAISE EXCEPTION 'INVALID_CONSUMPTION_STATUS';
  END IF;

  PERFORM 1
  FROM public.profiles p
  WHERE p.user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  SELECT pm.program_id, pm.meal_id, pm.assigned_date, pm.meal_type
  INTO v_program_id, v_meal_id, v_assigned_date, v_meal_type
  FROM public.program_meals pm
  JOIN public.coach_programs cp ON cp.id = pm.program_id
  WHERE pm.id = p_program_meal_id
    AND cp.client_id = v_actor
  FOR UPDATE OF pm;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROGRAM_MEAL_NOT_FOUND' USING ERRCODE = '42501';
  END IF;
  IF v_meal_id IS NULL THEN
    RAISE EXCEPTION 'PROGRAM_MEAL_HAS_NO_MEAL';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::TEXT || ':coach_program:' || p_program_meal_id::TEXT, 0)
  );

  SELECT mce.result_snapshot
  INTO v_existing_result
  FROM public.meal_consumption_events mce
  WHERE mce.user_id = v_actor
    AND mce.request_id = p_request_id;

  IF FOUND THEN
    RETURN v_existing_result || pg_catalog.jsonb_build_object('already_processed', TRUE);
  END IF;

  SELECT *
  INTO v_consumption
  FROM public.meal_consumptions mc
  WHERE mc.user_id = v_actor
    AND mc.source_type = 'coach_program'
    AND mc.source_id = p_program_meal_id
  FOR UPDATE;

  IF v_status = 'full' THEN
    IF p_time_precision NOT IN ('exact', 'estimated_15m', 'estimated_30m', 'date_only') THEN
      RAISE EXCEPTION 'INVALID_TIME_PRECISION';
    END IF;
    IF p_time_precision <> 'date_only' AND p_started_consuming_at IS NULL THEN
      RAISE EXCEPTION 'CONSUMPTION_START_REQUIRED';
    END IF;
    IF p_started_consuming_at > pg_catalog.clock_timestamp() + INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'CONSUMPTION_TIME_IN_FUTURE';
    END IF;
    IF p_timezone_name IS NULL
      OR char_length(p_timezone_name) NOT BETWEEN 1 AND 80
      OR p_utc_offset_minutes NOT BETWEEN -840 AND 840
      OR NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_timezone_names tz WHERE tz.name = p_timezone_name
      ) THEN
      RAISE EXCEPTION 'VALID_TIMEZONE_REQUIRED';
    END IF;

    v_log_date := CASE
      WHEN p_time_precision = 'date_only' THEN v_assigned_date
      ELSE (p_started_consuming_at AT TIME ZONE p_timezone_name)::DATE
    END;
  ELSE
    v_log_date := COALESCE(v_consumption.log_date, v_assigned_date);
  END IF;

  -- Same-state calls are idempotent and also repair a missing legacy projection.
  IF v_consumption.id IS NOT NULL AND v_consumption.status = v_status THEN
    IF v_status = 'full' THEN
      INSERT INTO public.program_meal_completions (
        program_meal_id, client_id, completed_at
      ) VALUES (
        p_program_meal_id, v_actor, v_consumption.log_date
      )
      ON CONFLICT (program_meal_id, client_id, completed_at) DO UPDATE
      SET completed_at = EXCLUDED.completed_at
      RETURNING id INTO v_completion_id;
    ELSE
      DELETE FROM public.program_meal_completions
      WHERE program_meal_id = p_program_meal_id
        AND client_id = v_actor;
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'success', TRUE,
      'already_processed', TRUE,
      'consumption_id', v_consumption.id,
      'completion_id', v_completion_id,
      'event_version', v_consumption.event_version,
      'status', v_consumption.status,
      'time_precision', v_consumption.time_precision,
      'started_consuming_at', v_consumption.started_consuming_at,
      'nutrition', pg_catalog.jsonb_build_object(
        'calories', v_consumption.applied_calories,
        'protein_g', v_consumption.applied_protein_g,
        'carbs_g', v_consumption.applied_carbs_g,
        'fat_g', v_consumption.applied_fat_g,
        'fiber_g', v_consumption.applied_fiber_g
      )
    );
  END IF;

  IF v_consumption.id IS NULL THEN
    v_snapshot := public.get_meal_nutrition_snapshot(v_meal_id);
    IF v_snapshot IS NULL THEN
      RAISE EXCEPTION 'PROGRAM_MEAL_NUTRITION_NOT_FOUND';
    END IF;

    v_snapshot := v_snapshot || pg_catalog.jsonb_build_object(
      'source_type', 'coach_program',
      'source_record_id', p_program_meal_id,
      'coach_program_id', v_program_id,
      'assigned_date', v_assigned_date,
      'meal_type', v_meal_type
    );
    v_event_version := 1;
    v_old_log_date := v_log_date;
    v_previous_state := NULL;
  ELSE
    -- The first captured nutrition is immutable across reversal and re-completion.
    v_snapshot := COALESCE(v_consumption.source_snapshot, v_consumption.nutrition_snapshot);
    v_event_version := v_consumption.event_version + 1;
    v_old_log_date := v_consumption.log_date;
    v_old_calories := v_consumption.applied_calories;
    v_old_protein := v_consumption.applied_protein_g;
    v_old_carbs := v_consumption.applied_carbs_g;
    v_old_fat := v_consumption.applied_fat_g;
    v_old_fiber := v_consumption.applied_fiber_g;
    v_history_id := v_consumption.meal_history_id;
    v_previous_state := pg_catalog.jsonb_build_object(
      'status', v_consumption.status,
      'log_date', v_consumption.log_date,
      'time_precision', v_consumption.time_precision,
      'started_consuming_at', v_consumption.started_consuming_at
    );
  END IF;

  IF v_status = 'full' THEN
    v_new_calories := round(COALESCE((v_snapshot ->> 'calories')::NUMERIC, 0))::INTEGER;
    v_new_protein := round(COALESCE((v_snapshot ->> 'protein_g')::NUMERIC, 0))::INTEGER;
    v_new_carbs := round(COALESCE((v_snapshot ->> 'carbs_g')::NUMERIC, 0))::INTEGER;
    v_new_fat := round(COALESCE((v_snapshot ->> 'fat_g')::NUMERIC, 0))::INTEGER;
    v_new_fiber := round(COALESCE((v_snapshot ->> 'fiber_g')::NUMERIC, 0))::INTEGER;
  END IF;

  IF v_old_calories + v_old_protein + v_old_carbs + v_old_fat + v_old_fiber > 0 THEN
    UPDATE public.progress_logs
    SET calories_consumed = GREATEST(0, COALESCE(calories_consumed, 0) - v_old_calories),
        protein_consumed_g = GREATEST(0, COALESCE(protein_consumed_g, 0) - v_old_protein),
        carbs_consumed_g = GREATEST(0, COALESCE(carbs_consumed_g, 0) - v_old_carbs),
        fat_consumed_g = GREATEST(0, COALESCE(fat_consumed_g, 0) - v_old_fat),
        fiber_consumed_g = GREATEST(0, COALESCE(fiber_consumed_g, 0) - v_old_fiber),
        updated_at = pg_catalog.clock_timestamp()
    WHERE user_id = v_actor
      AND log_date = v_old_log_date;
  END IF;

  IF v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 THEN
    INSERT INTO public.progress_logs (
      user_id, log_date, calories_consumed, protein_consumed_g,
      carbs_consumed_g, fat_consumed_g, fiber_consumed_g, created_at, updated_at
    ) VALUES (
      v_actor, v_log_date, v_new_calories, v_new_protein,
      v_new_carbs, v_new_fat, v_new_fiber,
      pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
    )
    ON CONFLICT (user_id, log_date) DO UPDATE
    SET calories_consumed = COALESCE(public.progress_logs.calories_consumed, 0) + EXCLUDED.calories_consumed,
        protein_consumed_g = COALESCE(public.progress_logs.protein_consumed_g, 0) + EXCLUDED.protein_consumed_g,
        carbs_consumed_g = COALESCE(public.progress_logs.carbs_consumed_g, 0) + EXCLUDED.carbs_consumed_g,
        fat_consumed_g = COALESCE(public.progress_logs.fat_consumed_g, 0) + EXCLUDED.fat_consumed_g,
        fiber_consumed_g = COALESCE(public.progress_logs.fiber_consumed_g, 0) + EXCLUDED.fiber_consumed_g,
        updated_at = pg_catalog.clock_timestamp();
  END IF;

  IF v_consumption.id IS NULL THEN
    v_consumption.id := gen_random_uuid();
    INSERT INTO public.meal_consumptions (
      id, user_id, source_type, source_id, source_meal_id, status,
      portion_percent, nutrition_snapshot, source_snapshot, consumed_item_snapshot,
      applied_calories, applied_protein_g, applied_carbs_g, applied_fat_g,
      applied_fiber_g, log_date, event_version, semantic_idempotency_key,
      started_consuming_at, time_precision, portion_confirmed_at,
      timezone_name, utc_offset_minutes
    ) VALUES (
      v_consumption.id, v_actor, 'coach_program', p_program_meal_id, v_meal_id, v_status,
      CASE WHEN v_status = 'full' THEN 100 ELSE 0 END,
      v_snapshot, v_snapshot, v_snapshot,
      v_new_calories, v_new_protein, v_new_carbs, v_new_fat,
      v_new_fiber, v_log_date, v_event_version,
      concat_ws(':', v_actor::TEXT, 'coach_program', p_program_meal_id::TEXT, v_meal_id::TEXT, v_status, v_event_version::TEXT),
      CASE WHEN v_status = 'full' AND p_time_precision <> 'date_only' THEN p_started_consuming_at END,
      CASE WHEN v_status = 'full' THEN p_time_precision ELSE 'date_only' END,
      CASE WHEN v_status = 'full' THEN pg_catalog.clock_timestamp() END,
      CASE WHEN v_status = 'full' THEN p_timezone_name END,
      CASE WHEN v_status = 'full' THEN p_utc_offset_minutes END
    );
  ELSE
    UPDATE public.meal_consumptions
    SET status = v_status,
        portion_percent = CASE WHEN v_status = 'full' THEN 100 ELSE 0 END,
        applied_calories = v_new_calories,
        applied_protein_g = v_new_protein,
        applied_carbs_g = v_new_carbs,
        applied_fat_g = v_new_fat,
        applied_fiber_g = v_new_fiber,
        log_date = v_log_date,
        event_version = v_event_version,
        semantic_idempotency_key = concat_ws(':', v_actor::TEXT, 'coach_program', p_program_meal_id::TEXT, v_consumption.source_meal_id::TEXT, v_status, v_event_version::TEXT),
        started_consuming_at = CASE
          WHEN v_status = 'full' AND p_time_precision <> 'date_only' THEN p_started_consuming_at
          WHEN v_status = 'full' THEN NULL
          ELSE started_consuming_at
        END,
        time_precision = CASE WHEN v_status = 'full' THEN p_time_precision ELSE time_precision END,
        portion_confirmed_at = CASE WHEN v_status = 'full' THEN pg_catalog.clock_timestamp() ELSE portion_confirmed_at END,
        timezone_name = CASE WHEN v_status = 'full' THEN p_timezone_name ELSE timezone_name END,
        utc_offset_minutes = CASE WHEN v_status = 'full' THEN p_utc_offset_minutes ELSE utc_offset_minutes END,
        updated_at = pg_catalog.clock_timestamp()
    WHERE id = v_consumption.id;
  END IF;

  IF v_status = 'full' AND v_new_calories + v_new_protein + v_new_carbs + v_new_fat + v_new_fiber > 0 THEN
    IF v_history_id IS NULL THEN
      INSERT INTO public.meal_history (
        user_id, name, calories, protein_g, carbs_g, fat_g, fiber_g,
        image_url, logged_at, source, source_meal_id, source_consumption_id
      ) VALUES (
        v_actor, COALESCE(v_snapshot ->> 'meal_name', 'Coach program meal'),
        v_new_calories, v_new_protein, v_new_carbs, v_new_fat, v_new_fiber,
        NULLIF(v_snapshot ->> 'image_url', ''), pg_catalog.clock_timestamp(),
        'coach_program_consumption', v_meal_id, v_consumption.id
      ) RETURNING id INTO v_history_id;
    END IF;
  ELSIF v_history_id IS NOT NULL THEN
    -- The legacy delete trigger only reverses fiber; this RPC already applied it.
    UPDATE public.meal_history SET fiber_g = 0 WHERE id = v_history_id;
    DELETE FROM public.meal_history WHERE id = v_history_id;
    v_history_id := NULL;
  END IF;

  UPDATE public.meal_consumptions
  SET meal_history_id = v_history_id
  WHERE id = v_consumption.id;

  IF v_status = 'full' THEN
    INSERT INTO public.program_meal_completions (
      program_meal_id, client_id, completed_at
    ) VALUES (
      p_program_meal_id, v_actor, v_log_date
    )
    ON CONFLICT (program_meal_id, client_id, completed_at) DO UPDATE
    SET completed_at = EXCLUDED.completed_at
    RETURNING id INTO v_completion_id;
  ELSE
    DELETE FROM public.program_meal_completions
    WHERE program_meal_id = p_program_meal_id
      AND client_id = v_actor;
  END IF;

  UPDATE public.profiles p
  SET total_meals_logged = counts.meal_count,
      updated_at = pg_catalog.clock_timestamp()
  FROM (
    SELECT count(*)::INTEGER AS meal_count
    FROM public.meal_history mh
    WHERE mh.user_id = v_actor
  ) counts
  WHERE p.user_id = v_actor;

  v_semantic_key := concat_ws(
    ':', v_actor::TEXT, 'coach_program', p_program_meal_id::TEXT,
    COALESCE(v_consumption.source_meal_id, v_meal_id)::TEXT, v_status, v_event_version::TEXT
  );
  v_current_state := pg_catalog.jsonb_build_object(
    'status', v_status,
    'log_date', v_log_date,
    'time_precision', CASE WHEN v_status = 'full' THEN p_time_precision ELSE v_consumption.time_precision END,
    'started_consuming_at', CASE WHEN v_status = 'full' THEN p_started_consuming_at ELSE v_consumption.started_consuming_at END
  );
  v_result := pg_catalog.jsonb_build_object(
    'success', TRUE,
    'already_processed', FALSE,
    'consumption_id', v_consumption.id,
    'completion_id', v_completion_id,
    'meal_history_id', v_history_id,
    'event_version', v_event_version,
    'status', v_status,
    'time_precision', v_current_state ->> 'time_precision',
    'started_consuming_at', v_current_state ->> 'started_consuming_at',
    'nutrition', pg_catalog.jsonb_build_object(
      'calories', v_new_calories,
      'protein_g', v_new_protein,
      'carbs_g', v_new_carbs,
      'fat_g', v_new_fat,
      'fiber_g', v_new_fiber
    )
  );

  INSERT INTO public.meal_consumption_events (
    consumption_id, user_id, request_id, event_version, previous_state,
    current_state, nutrition_delta, result_snapshot, source_type,
    source_id, source_meal_id, event_type, semantic_idempotency_key
  ) VALUES (
    v_consumption.id, v_actor, p_request_id, v_event_version, v_previous_state,
    v_current_state,
    pg_catalog.jsonb_build_object(
      'calories', v_new_calories - v_old_calories,
      'protein_g', v_new_protein - v_old_protein,
      'carbs_g', v_new_carbs - v_old_carbs,
      'fat_g', v_new_fat - v_old_fat,
      'fiber_g', v_new_fiber - v_old_fiber
    ),
    v_result, 'coach_program', p_program_meal_id,
    COALESCE(v_consumption.source_meal_id, v_meal_id),
    CASE WHEN v_status = 'full' THEN 'consumed' ELSE 'reversed' END,
    v_semantic_key
  );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_coach_program_meal_consumption(
  UUID, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, SMALLINT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_coach_program_meal_consumption(
  UUID, TEXT, UUID, TIMESTAMPTZ, TEXT, TEXT, SMALLINT
) TO authenticated;

COMMIT;
