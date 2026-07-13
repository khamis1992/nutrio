-- Make manual nutrition logging and reversal atomic, idempotent, and owned by
-- the authenticated customer. Caller-provided nutrition is accepted only as
-- user tracking data and can no longer mutate XP or profile counters directly.

ALTER TABLE public.meal_history
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.meal_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_request_id UUID,
  ADD COLUMN IF NOT EXISTS source_item_index INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_history_request_item
  ON public.meal_history (user_id, source_request_id, source_item_index)
  WHERE source_request_id IS NOT NULL;

-- The app expects one aggregate nutrition row per user and day. Merge any
-- legacy duplicates before enforcing that invariant.
WITH aggregates AS (
  SELECT
    user_id,
    log_date,
    (ARRAY_AGG(id ORDER BY created_at, id))[1] AS keep_id,
    SUM(COALESCE(calories_consumed, 0)) AS calories_consumed,
    SUM(COALESCE(protein_consumed_g, 0)) AS protein_consumed_g,
    SUM(COALESCE(carbs_consumed_g, 0)) AS carbs_consumed_g,
    SUM(COALESCE(fat_consumed_g, 0)) AS fat_consumed_g,
    SUM(COALESCE(fiber_consumed_g, 0)) AS fiber_consumed_g
  FROM public.progress_logs
  GROUP BY user_id, log_date
  HAVING COUNT(*) > 1
)
UPDATE public.progress_logs pl
SET calories_consumed = a.calories_consumed,
    protein_consumed_g = a.protein_consumed_g,
    carbs_consumed_g = a.carbs_consumed_g,
    fat_consumed_g = a.fat_consumed_g,
    fiber_consumed_g = a.fiber_consumed_g,
    updated_at = NOW()
FROM aggregates a
WHERE pl.id = a.keep_id;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, log_date ORDER BY created_at, id) AS row_number
  FROM public.progress_logs
)
DELETE FROM public.progress_logs pl
USING ranked r
WHERE pl.id = r.id
  AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_logs_unique_user_date
  ON public.progress_logs (user_id, log_date);

CREATE OR REPLACE FUNCTION public.log_manual_meal_items(
  p_items JSONB,
  p_log_date DATE DEFAULT NULL,
  p_request_id UUID DEFAULT gen_random_uuid(),
  p_source TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_source TEXT;
  v_item JSONB;
  v_item_index INTEGER;
  v_name TEXT;
  v_image_url TEXT;
  v_calories INTEGER;
  v_protein INTEGER;
  v_carbs INTEGER;
  v_fat INTEGER;
  v_total_calories INTEGER := 0;
  v_total_protein INTEGER := 0;
  v_total_carbs INTEGER := 0;
  v_total_fat INTEGER := 0;
  v_history_id UUID;
  v_history_ids UUID[] := ARRAY[]::UUID[];
  v_existing_ids UUID[];
  v_daily_award_count INTEGER := 0;
  v_remaining_awards INTEGER := 0;
  v_xp_awarded INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::TEXT, 0));

  SELECT ARRAY_AGG(mh.id ORDER BY mh.source_item_index)
  INTO v_existing_ids
  FROM public.meal_history mh
  WHERE mh.user_id = v_user_id
    AND mh.source_request_id = p_request_id;

  IF COALESCE(array_length(v_existing_ids, 1), 0) > 0 THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'duplicate', TRUE,
      'history_ids', to_jsonb(v_existing_ids),
      'xp_awarded', 0
    );
  END IF;

  p_log_date := COALESCE(p_log_date, v_today);
  IF p_log_date < v_today - 365 OR p_log_date > v_today THEN
    RAISE EXCEPTION 'INVALID_LOG_DATE';
  END IF;

  IF jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'INVALID_MEAL_ITEMS';
  END IF;

  v_source := LEFT(
    REGEXP_REPLACE(COALESCE(NULLIF(BTRIM(p_source), ''), 'manual'), '[^a-zA-Z0-9_-]', '', 'g'),
    40
  );
  IF v_source = '' THEN
    v_source := 'manual';
  END IF;

  FOR v_item, v_item_index IN
    SELECT value, ordinality::INTEGER
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_name := BTRIM(COALESCE(v_item ->> 'name', ''));
    v_image_url := NULLIF(BTRIM(v_item ->> 'image_url'), '');
    v_calories := ROUND(COALESCE((v_item ->> 'calories')::NUMERIC, 0));
    v_protein := ROUND(COALESCE((v_item ->> 'protein_g')::NUMERIC, 0));
    v_carbs := ROUND(COALESCE((v_item ->> 'carbs_g')::NUMERIC, 0));
    v_fat := ROUND(COALESCE((v_item ->> 'fat_g')::NUMERIC, 0));

    IF v_name = '' OR LENGTH(v_name) > 120
      OR v_calories < 0 OR v_calories > 5000
      OR v_protein < 0 OR v_protein > 1000
      OR v_carbs < 0 OR v_carbs > 1000
      OR v_fat < 0 OR v_fat > 1000
      OR COALESCE(LENGTH(v_image_url), 0) > 2048 THEN
      RAISE EXCEPTION 'INVALID_MEAL_ITEM_AT_INDEX_%', v_item_index;
    END IF;

    IF v_calories = 0 AND v_protein = 0 AND v_carbs = 0 AND v_fat = 0 THEN
      RAISE EXCEPTION 'EMPTY_NUTRITION_AT_INDEX_%', v_item_index;
    END IF;

    INSERT INTO public.meal_history (
      user_id,
      name,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      image_url,
      logged_at,
      source,
      source_request_id,
      source_item_index
    )
    VALUES (
      v_user_id,
      v_name,
      v_calories,
      v_protein,
      v_carbs,
      v_fat,
      v_image_url,
      (p_log_date::TIMESTAMP + LOCALTIME) AT TIME ZONE 'Asia/Qatar',
      v_source,
      p_request_id,
      v_item_index
    )
    RETURNING id INTO v_history_id;

    v_history_ids := array_append(v_history_ids, v_history_id);
    v_total_calories := v_total_calories + v_calories;
    v_total_protein := v_total_protein + v_protein;
    v_total_carbs := v_total_carbs + v_carbs;
    v_total_fat := v_total_fat + v_fat;
  END LOOP;

  INSERT INTO public.progress_logs (
    user_id,
    log_date,
    calories_consumed,
    protein_consumed_g,
    carbs_consumed_g,
    fat_consumed_g,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_log_date,
    v_total_calories,
    v_total_protein,
    v_total_carbs,
    v_total_fat,
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, log_date) DO UPDATE
  SET calories_consumed = COALESCE(public.progress_logs.calories_consumed, 0) + EXCLUDED.calories_consumed,
      protein_consumed_g = COALESCE(public.progress_logs.protein_consumed_g, 0) + EXCLUDED.protein_consumed_g,
      carbs_consumed_g = COALESCE(public.progress_logs.carbs_consumed_g, 0) + EXCLUDED.carbs_consumed_g,
      fat_consumed_g = COALESCE(public.progress_logs.fat_consumed_g, 0) + EXCLUDED.fat_consumed_g,
      updated_at = NOW();

  SELECT COUNT(*)::INTEGER
  INTO v_daily_award_count
  FROM public.xp_transactions xt
  WHERE xt.user_id = v_user_id
    AND xt.action_type = 'manual_meal_log'
    AND xt.xp_amount > 0
    AND (xt.created_at AT TIME ZONE 'Asia/Qatar')::DATE = v_today;

  IF p_log_date = v_today THEN
    v_remaining_awards := GREATEST(0, 3 - v_daily_award_count);
    FOREACH v_history_id IN ARRAY v_history_ids LOOP
      EXIT WHEN v_remaining_awards <= 0;
      PERFORM public.award_xp(
        v_user_id,
        10,
        'Meal logged',
        'manual_meal_log',
        v_history_id::TEXT,
        jsonb_build_object('meal_history_id', v_history_id, 'log_date', p_log_date, 'source', v_source)
      );
      v_remaining_awards := v_remaining_awards - 1;
      v_xp_awarded := v_xp_awarded + 10;
    END LOOP;
  END IF;

  UPDATE public.profiles p
  SET total_meals_logged = counts.meal_count,
      updated_at = NOW()
  FROM (
    SELECT COUNT(*)::INTEGER AS meal_count
    FROM public.meal_history mh
    WHERE mh.user_id = v_user_id
  ) counts
  WHERE p.user_id = v_user_id;

  PERFORM public.check_and_award_badges(v_user_id);

  RETURN jsonb_build_object(
    'success', TRUE,
    'duplicate', FALSE,
    'history_ids', to_jsonb(v_history_ids),
    'logged_count', array_length(v_history_ids, 1),
    'calories', v_total_calories,
    'protein', v_total_protein,
    'carbs', v_total_carbs,
    'fat', v_total_fat,
    'xp_awarded', v_xp_awarded
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_meal_entry_atomic(
  p_user_id UUID,
  p_meal_history_id UUID,
  p_meal_name TEXT,
  p_calories INTEGER DEFAULT 0,
  p_protein_g INTEGER DEFAULT 0,
  p_carbs_g INTEGER DEFAULT 0,
  p_fat_g INTEGER DEFAULT 0,
  p_logged_at TIMESTAMPTZ DEFAULT NOW(),
  p_schedule_id UUID DEFAULT NULL,
  p_scheduled_date DATE DEFAULT NULL,
  p_xp_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_history public.meal_history%ROWTYPE;
  v_log_date DATE;
  v_audit_id UUID;
  v_xp_deducted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL OR p_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT *
  INTO v_history
  FROM public.meal_history mh
  WHERE mh.id = p_meal_history_id
    AND mh.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEAL_HISTORY_NOT_FOUND';
  END IF;

  v_log_date := (COALESCE(v_history.logged_at, v_history.created_at, NOW()) AT TIME ZONE 'Asia/Qatar')::DATE;

  UPDATE public.progress_logs
  SET calories_consumed = GREATEST(0, COALESCE(calories_consumed, 0) - COALESCE(v_history.calories, 0)),
      protein_consumed_g = GREATEST(0, COALESCE(protein_consumed_g, 0) - COALESCE(v_history.protein_g, 0)),
      carbs_consumed_g = GREATEST(0, COALESCE(carbs_consumed_g, 0) - COALESCE(v_history.carbs_g, 0)),
      fat_consumed_g = GREATEST(0, COALESCE(fat_consumed_g, 0) - COALESCE(v_history.fat_g, 0)),
      updated_at = NOW()
  WHERE user_id = v_user_id
    AND log_date = v_log_date;

  IF v_history.schedule_id IS NOT NULL THEN
    UPDATE public.meal_schedules
    SET is_completed = FALSE,
        completed_at = NULL,
        updated_at = NOW()
    WHERE id = v_history.schedule_id
      AND user_id = v_user_id;
  END IF;

  INSERT INTO public.meal_history_audit (
    user_id,
    meal_history_id,
    meal_name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    logged_at,
    action
  )
  VALUES (
    v_user_id,
    v_history.id,
    v_history.name,
    v_history.calories,
    v_history.protein_g,
    v_history.carbs_g,
    v_history.fat_g,
    v_history.logged_at,
    'delete'
  )
  RETURNING id INTO v_audit_id;

  DELETE FROM public.meal_history
  WHERE id = v_history.id;

  IF EXISTS (
    SELECT 1
    FROM public.xp_transactions xt
    WHERE xt.user_id = v_user_id
      AND xt.action_type = 'manual_meal_log'
      AND xt.source_id = v_history.id::TEXT
      AND xt.xp_amount > 0
  ) THEN
    PERFORM public.award_xp(
      v_user_id,
      -10,
      'Meal log deleted',
      'manual_meal_deleted',
      v_history.id::TEXT,
      jsonb_build_object('meal_history_id', v_history.id)
    );
    v_xp_deducted := 10;
  ELSIF v_history.schedule_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.xp_transactions xt
    WHERE xt.user_id = v_user_id
      AND xt.action_type = 'meal_completed'
      AND xt.source_id = v_history.schedule_id::TEXT
      AND xt.xp_amount > 0
  ) THEN
    PERFORM public.award_xp(
      v_user_id,
      -10,
      'Scheduled meal log deleted',
      'meal_uncompleted',
      v_history.schedule_id::TEXT,
      jsonb_build_object('schedule_id', v_history.schedule_id)
    );
    v_xp_deducted := 10;
  END IF;

  UPDATE public.profiles p
  SET total_meals_logged = counts.meal_count,
      updated_at = NOW()
  FROM (
    SELECT COUNT(*)::INTEGER AS meal_count
    FROM public.meal_history mh
    WHERE mh.user_id = v_user_id
  ) counts
  WHERE p.user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'audit_id', v_audit_id,
    'xp_deducted', v_xp_deducted,
    'meal_deleted', v_history.name
  );
END;
$$;
