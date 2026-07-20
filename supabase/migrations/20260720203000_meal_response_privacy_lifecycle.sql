-- Privacy lifecycle for opt-in meal-response health data.
-- Canonical nutrition logs are retained, while precise response timing and
-- health-derived artifacts can be revoked or deleted independently.

BEGIN;

CREATE TABLE IF NOT EXISTS public.meal_response_privacy_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('revoke_scopes', 'delete_dataset')),
  scopes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  result_summary JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(result_summary) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meal_response_privacy_action_request_unique UNIQUE (user_id, request_id)
);

CREATE INDEX IF NOT EXISTS idx_meal_response_privacy_actions_user_created
  ON public.meal_response_privacy_actions (user_id, created_at DESC);

ALTER TABLE public.meal_response_privacy_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_response_privacy_actions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meal_response_privacy_actions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.meal_response_privacy_actions TO service_role;

CREATE OR REPLACE FUNCTION security.cancel_meal_response_delivery_work(
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_outbox_count INTEGER := 0;
  v_delivery_count INTEGER := 0;
  v_notification_count INTEGER := 0;
BEGIN
  UPDATE security.domain_event_outbox outbox
  SET status = 'completed',
      payload = '{}'::JSONB,
      processed_at = clock_timestamp(),
      lease_token = NULL,
      lease_expires_at = NULL,
      last_error_code = left(p_reason, 120)
  WHERE outbox.audience_user_id = p_user_id
    AND outbox.event_type IN (
      'meal.response_checkin_due.v1',
      'meal.response_insight_ready.v1'
    )
    AND outbox.status IN ('pending', 'processing', 'failed', 'dead_letter');
  GET DIAGNOSTICS v_outbox_count = ROW_COUNT;

  UPDATE security.notification_event_deliveries deliveries
  SET status = 'suppressed',
      delivery_data = '{}'::JSONB,
      rendered_title = NULL,
      rendered_message = NULL,
      suppressed_at = clock_timestamp(),
      suppression_reason = left(p_reason, 160),
      lease_token = NULL,
      lease_expires_at = NULL,
      retryable = FALSE,
      updated_at = clock_timestamp()
  WHERE deliveries.user_id = p_user_id
    AND deliveries.event_type IN (
      'meal.response_checkin_due.v1',
      'meal.response_insight_ready.v1'
    )
    AND deliveries.status IN ('pending', 'deferred', 'processing', 'failed', 'dead_letter');
  GET DIAGNOSTICS v_delivery_count = ROW_COUNT;

  UPDATE public.notifications notifications
  SET data = '{}'::JSONB,
      suppressed_at = clock_timestamp(),
      suppression_reason = left(p_reason, 160),
      deferred_until = NULL
  WHERE notifications.user_id = p_user_id
    AND notifications.event_type IN (
      'meal.response_checkin_due.v1',
      'meal.response_insight_ready.v1'
    )
    AND notifications.suppressed_at IS NULL
    AND notifications.read_at IS NULL;
  GET DIAGNOSTICS v_notification_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'outbox_cancelled', v_outbox_count,
    'deliveries_suppressed', v_delivery_count,
    'notifications_suppressed', v_notification_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.export_my_meal_response_data(
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'schema_version', 'meal-response-export-v1',
    'request_id', p_request_id,
    'preferences', COALESCE((
      SELECT jsonb_build_object(
        'meal_response_enabled', preferences.meal_response_enabled,
        'glucose_analysis_enabled', preferences.glucose_analysis_enabled,
        'post_meal_prompts_enabled', preferences.post_meal_prompts_enabled,
        'recommendation_use_enabled', preferences.recommendation_use_enabled,
        'coach_sharing_enabled', preferences.coach_sharing_enabled,
        'research_use_enabled', preferences.research_use_enabled,
        'updated_at', preferences.updated_at
      )
      FROM public.health_context_preferences preferences
      WHERE preferences.user_id = v_actor
    ), '{}'::JSONB),
    'consumptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', consumptions.id,
        'source_type', consumptions.source_type,
        'status', consumptions.status,
        'portion_percent', consumptions.portion_percent,
        'log_date', consumptions.log_date,
        'started_consuming_at', consumptions.started_consuming_at,
        'finished_consuming_at', consumptions.finished_consuming_at,
        'time_precision', consumptions.time_precision,
        'timezone_name', consumptions.timezone_name,
        'utc_offset_minutes', consumptions.utc_offset_minutes,
        'nutrition', jsonb_build_object(
          'calories', consumptions.applied_calories,
          'protein_g', consumptions.applied_protein_g,
          'carbs_g', consumptions.applied_carbs_g,
          'fat_g', consumptions.applied_fat_g,
          'fiber_g', consumptions.applied_fiber_g
        )
      ) ORDER BY consumptions.log_date DESC, consumptions.created_at DESC)
      FROM public.meal_consumptions consumptions
      WHERE consumptions.user_id = v_actor
        AND (
          consumptions.started_consuming_at IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM public.meal_response_check_ins check_ins
            WHERE check_ins.consumption_id = consumptions.id
              AND check_ins.user_id = v_actor
          )
          OR EXISTS (
            SELECT 1 FROM public.meal_response_episodes episodes
            WHERE episodes.consumption_id = consumptions.id
              AND episodes.user_id = v_actor
          )
        )
    ), '[]'::JSONB),
    'check_ins', COALESCE((
      SELECT jsonb_agg(to_jsonb(check_ins) - 'user_id' - 'request_id' ORDER BY check_ins.submitted_at DESC)
      FROM public.meal_response_check_ins check_ins
      WHERE check_ins.user_id = v_actor
    ), '[]'::JSONB),
    'episodes', COALESCE((
      SELECT jsonb_agg(to_jsonb(episodes) - 'user_id' ORDER BY episodes.built_at DESC)
      FROM public.meal_response_episodes episodes
      WHERE episodes.user_id = v_actor
    ), '[]'::JSONB),
    'estimates', COALESCE((
      SELECT jsonb_agg(to_jsonb(estimates) - 'user_id' ORDER BY estimates.published_at DESC)
      FROM public.meal_response_estimates estimates
      WHERE estimates.user_id = v_actor
    ), '[]'::JSONB),
    'experiments', COALESCE((
      SELECT jsonb_agg(
        (to_jsonb(experiments) - 'user_id') || jsonb_build_object(
          'assignments', COALESCE((
            SELECT jsonb_agg(to_jsonb(assignments) - 'user_id' ORDER BY assignments.sequence_number)
            FROM public.meal_response_experiment_assignments assignments
            WHERE assignments.experiment_id = experiments.id
              AND assignments.user_id = v_actor
          ), '[]'::JSONB)
        ) ORDER BY experiments.created_at DESC
      )
      FROM public.meal_response_experiments experiments
      WHERE experiments.user_id = v_actor
    ), '[]'::JSONB),
    'source_metadata', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'provider', sources.provider,
        'status', sources.status,
        'capabilities', sources.capabilities,
        'connected_at', sources.connected_at,
        'last_success_at', sources.last_success_at,
        'revoked_at', sources.revoked_at
      ) ORDER BY sources.connected_at DESC)
      FROM public.wearable_sync_sources sources
      WHERE sources.user_id = v_actor
        AND (
          sources.provider = 'dexcom'
          OR sources.capabilities && ARRAY['blood_glucose_read', 'blood_glucose', 'glucose', 'cgm']::TEXT[]
          OR EXISTS (
            SELECT 1 FROM public.wearable_metric_samples samples
            WHERE samples.user_id = v_actor
              AND samples.provider = sources.provider
              AND samples.metric_type = 'blood_glucose'
          )
        )
    ), '[]'::JSONB),
    'glucose_sample_summary', COALESCE((
      SELECT jsonb_build_object(
        'sample_count', count(*),
        'first_sample_at', min(samples.start_at),
        'last_sample_at', max(samples.start_at),
        'providers', COALESCE(jsonb_agg(DISTINCT samples.provider), '[]'::JSONB)
      )
      FROM public.wearable_metric_samples samples
      WHERE samples.user_id = v_actor
        AND samples.metric_type = 'blood_glucose'
        AND samples.deleted_at IS NULL
    ), jsonb_build_object('sample_count', 0, 'providers', '[]'::JSONB)),
    'consent_history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'event_type', events.event_type,
        'policy_version', events.policy_version,
        'scopes', events.scopes,
        'purpose', events.purpose,
        'created_at', events.created_at
      ) ORDER BY events.created_at DESC)
      FROM public.health_context_consent_events events
      WHERE events.user_id = v_actor
        AND events.purpose IN ('meal_response_personalization', 'meal_response_privacy')
    ), '[]'::JSONB)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_my_meal_response_scopes(
  p_scopes TEXT[],
  p_request_id UUID,
  p_policy_version TEXT DEFAULT '2026-07-meal-response-v1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_scopes TEXT[];
  v_existing public.meal_response_privacy_actions%ROWTYPE;
  v_delivery_result JSONB := '{}'::JSONB;
  v_samples_revoked INTEGER := 0;
  v_sources_revoked INTEGER := 0;
  v_estimates_deleted INTEGER := 0;
  v_features_deleted INTEGER := 0;
  v_episodes_deleted INTEGER := 0;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(p_policy_version, '')) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'INVALID_POLICY_VERSION' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(array_agg(scope ORDER BY scope), '{}'::TEXT[])
  INTO v_scopes
  FROM (
    SELECT DISTINCT unnest(COALESCE(p_scopes, '{}'::TEXT[])) AS scope
  ) normalized
  WHERE scope = ANY (ARRAY[
    'meal_response', 'glucose_analysis', 'post_meal_prompts',
    'recommendation_use', 'coach_sharing', 'research_use'
  ]::TEXT[]);

  IF cardinality(v_scopes) = 0 OR cardinality(v_scopes) <> cardinality(COALESCE(p_scopes, '{}'::TEXT[])) THEN
    RAISE EXCEPTION 'INVALID_OR_DUPLICATE_SCOPES' USING ERRCODE = '22023';
  END IF;

  IF 'meal_response' = ANY (v_scopes) THEN
    v_scopes := ARRAY[
      'coach_sharing', 'glucose_analysis', 'meal_response',
      'post_meal_prompts', 'recommendation_use', 'research_use'
    ]::TEXT[];
  END IF;

  SELECT actions.* INTO v_existing
  FROM public.meal_response_privacy_actions actions
  WHERE actions.user_id = v_actor AND actions.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action_type <> 'revoke_scopes' OR v_existing.scopes <> v_scopes THEN
      RAISE EXCEPTION 'REQUEST_ID_REUSE_MISMATCH' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.result_summary || jsonb_build_object('already_processed', TRUE);
  END IF;

  INSERT INTO public.health_context_preferences (user_id)
  VALUES (v_actor)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.health_context_preferences preferences
  SET meal_response_enabled = CASE WHEN 'meal_response' = ANY (v_scopes) THEN FALSE ELSE preferences.meal_response_enabled END,
      glucose_analysis_enabled = CASE WHEN v_scopes && ARRAY['meal_response', 'glucose_analysis']::TEXT[] THEN FALSE ELSE preferences.glucose_analysis_enabled END,
      post_meal_prompts_enabled = CASE WHEN v_scopes && ARRAY['meal_response', 'post_meal_prompts']::TEXT[] THEN FALSE ELSE preferences.post_meal_prompts_enabled END,
      recommendation_use_enabled = CASE WHEN v_scopes && ARRAY['meal_response', 'recommendation_use']::TEXT[] THEN FALSE ELSE preferences.recommendation_use_enabled END,
      coach_sharing_enabled = CASE WHEN v_scopes && ARRAY['meal_response', 'coach_sharing']::TEXT[] THEN FALSE ELSE preferences.coach_sharing_enabled END,
      research_use_enabled = CASE WHEN v_scopes && ARRAY['meal_response', 'research_use']::TEXT[] THEN FALSE ELSE preferences.research_use_enabled END,
      updated_at = clock_timestamp()
  WHERE preferences.user_id = v_actor;

  IF v_scopes && ARRAY['meal_response', 'glucose_analysis', 'post_meal_prompts']::TEXT[] THEN
    v_delivery_result := security.cancel_meal_response_delivery_work(v_actor, 'meal_response_consent_revoked');
  END IF;

  IF v_scopes && ARRAY['meal_response', 'glucose_analysis']::TEXT[] THEN
    UPDATE public.wearable_metric_samples samples
    SET deleted_at = COALESCE(samples.deleted_at, clock_timestamp()),
        sync_status = 'revoked',
        raw = '{}'::JSONB,
        updated_at = clock_timestamp()
    WHERE samples.user_id = v_actor
      AND samples.metric_type = 'blood_glucose'
      AND (samples.deleted_at IS NULL OR samples.sync_status <> 'revoked' OR samples.raw <> '{}'::JSONB);
    GET DIAGNOSTICS v_samples_revoked = ROW_COUNT;

    UPDATE public.wearable_sync_sources sources
    SET capabilities = ARRAY(
          SELECT capability
          FROM unnest(sources.capabilities) AS capability
          WHERE capability <> ALL (ARRAY['blood_glucose_read', 'blood_glucose', 'glucose', 'cgm']::TEXT[])
        ),
        status = CASE
          WHEN sources.provider = 'dexcom'
            OR (cardinality(sources.capabilities) > 0 AND cardinality(ARRAY(
              SELECT capability
              FROM unnest(sources.capabilities) AS capability
              WHERE capability <> ALL (ARRAY['blood_glucose_read', 'blood_glucose', 'glucose', 'cgm']::TEXT[])
            )) = 0)
          THEN 'revoked'
          ELSE sources.status
        END,
        sync_cursor = '{}'::JSONB,
        revoked_at = CASE
          WHEN sources.provider = 'dexcom'
            OR (cardinality(sources.capabilities) > 0 AND cardinality(ARRAY(
              SELECT capability
              FROM unnest(sources.capabilities) AS capability
              WHERE capability <> ALL (ARRAY['blood_glucose_read', 'blood_glucose', 'glucose', 'cgm']::TEXT[])
            )) = 0)
          THEN COALESCE(sources.revoked_at, clock_timestamp())
          ELSE sources.revoked_at
        END,
        updated_at = clock_timestamp()
    WHERE sources.user_id = v_actor
      AND (
        sources.provider = 'dexcom'
        OR sources.capabilities && ARRAY['blood_glucose_read', 'blood_glucose', 'glucose', 'cgm']::TEXT[]
        OR EXISTS (
          SELECT 1 FROM public.wearable_metric_samples samples
          WHERE samples.user_id = v_actor
            AND samples.provider = sources.provider
            AND samples.metric_type = 'blood_glucose'
        )
      );
    GET DIAGNOSTICS v_sources_revoked = ROW_COUNT;

    DELETE FROM public.meal_response_estimates estimates WHERE estimates.user_id = v_actor;
    GET DIAGNOSTICS v_estimates_deleted = ROW_COUNT;
    DELETE FROM public.meal_response_feature_snapshots features WHERE features.user_id = v_actor;
    GET DIAGNOSTICS v_features_deleted = ROW_COUNT;
    DELETE FROM public.meal_response_episodes episodes WHERE episodes.user_id = v_actor;
    GET DIAGNOSTICS v_episodes_deleted = ROW_COUNT;
  END IF;

  IF 'meal_response' = ANY (v_scopes) THEN
    UPDATE public.meal_response_experiments experiments
    SET status = 'cancelled', updated_at = clock_timestamp()
    WHERE experiments.user_id = v_actor
      AND experiments.status IN ('draft', 'active', 'paused');
  END IF;

  INSERT INTO public.health_context_consent_events (
    user_id, event_type, policy_version, scopes, purpose, request_id
  ) VALUES (
    v_actor, 'revoked', p_policy_version, v_scopes, 'meal_response_privacy', p_request_id
  );

  v_result := jsonb_build_object(
    'action', 'revoke_scopes',
    'scopes', to_jsonb(v_scopes),
    'glucose_samples_soft_deleted', v_samples_revoked,
    'wearable_sources_updated', v_sources_revoked,
    'estimates_deleted', v_estimates_deleted,
    'features_deleted', v_features_deleted,
    'episodes_deleted', v_episodes_deleted,
    'delivery_work', v_delivery_result,
    'already_processed', FALSE
  );

  INSERT INTO public.meal_response_privacy_actions (
    user_id, request_id, action_type, scopes, result_summary
  ) VALUES (
    v_actor, p_request_id, 'revoke_scopes', v_scopes, v_result - 'already_processed'
  );

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_meal_response_data(
  p_request_id UUID,
  p_policy_version TEXT DEFAULT '2026-07-meal-response-v1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_existing public.meal_response_privacy_actions%ROWTYPE;
  v_delivery_result JSONB;
  v_samples_revoked INTEGER := 0;
  v_sources_revoked INTEGER := 0;
  v_check_ins_deleted INTEGER := 0;
  v_feedback_deleted INTEGER := 0;
  v_estimates_deleted INTEGER := 0;
  v_features_deleted INTEGER := 0;
  v_episodes_deleted INTEGER := 0;
  v_assignments_deleted INTEGER := 0;
  v_experiments_deleted INTEGER := 0;
  v_batches_deleted INTEGER := 0;
  v_timings_cleared INTEGER := 0;
  v_result JSONB;
  v_all_scopes CONSTANT TEXT[] := ARRAY[
    'meal_response', 'glucose_analysis', 'post_meal_prompts',
    'recommendation_use', 'coach_sharing', 'research_use'
  ]::TEXT[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF char_length(COALESCE(p_policy_version, '')) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'INVALID_POLICY_VERSION' USING ERRCODE = '22023';
  END IF;

  SELECT actions.* INTO v_existing
  FROM public.meal_response_privacy_actions actions
  WHERE actions.user_id = v_actor AND actions.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action_type <> 'delete_dataset' THEN
      RAISE EXCEPTION 'REQUEST_ID_REUSE_MISMATCH' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.result_summary || jsonb_build_object('already_processed', TRUE);
  END IF;

  INSERT INTO public.health_context_preferences (user_id)
  VALUES (v_actor)
  ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.health_context_preferences
  SET meal_response_enabled = FALSE,
      glucose_analysis_enabled = FALSE,
      post_meal_prompts_enabled = FALSE,
      recommendation_use_enabled = FALSE,
      coach_sharing_enabled = FALSE,
      research_use_enabled = FALSE,
      updated_at = clock_timestamp()
  WHERE user_id = v_actor;

  v_delivery_result := security.cancel_meal_response_delivery_work(v_actor, 'meal_response_dataset_deleted');

  UPDATE public.wearable_metric_samples samples
  SET deleted_at = COALESCE(samples.deleted_at, clock_timestamp()),
      sync_status = 'revoked', raw = '{}'::JSONB, updated_at = clock_timestamp()
  WHERE samples.user_id = v_actor
    AND samples.metric_type = 'blood_glucose'
    AND (samples.deleted_at IS NULL OR samples.sync_status <> 'revoked' OR samples.raw <> '{}'::JSONB);
  GET DIAGNOSTICS v_samples_revoked = ROW_COUNT;

  UPDATE public.wearable_sync_sources sources
  SET capabilities = ARRAY(
        SELECT capability FROM unnest(sources.capabilities) AS capability
        WHERE capability <> ALL (ARRAY['blood_glucose_read', 'blood_glucose', 'glucose', 'cgm']::TEXT[])
      ),
      status = CASE WHEN sources.provider = 'dexcom' THEN 'revoked' ELSE sources.status END,
      sync_cursor = '{}'::JSONB,
      revoked_at = CASE WHEN sources.provider = 'dexcom'
        THEN COALESCE(sources.revoked_at, clock_timestamp()) ELSE sources.revoked_at END,
      updated_at = clock_timestamp()
  WHERE sources.user_id = v_actor
    AND (
      sources.provider = 'dexcom'
      OR sources.capabilities && ARRAY['blood_glucose_read', 'blood_glucose', 'glucose', 'cgm']::TEXT[]
      OR EXISTS (
        SELECT 1 FROM public.wearable_metric_samples samples
        WHERE samples.user_id = v_actor
          AND samples.provider = sources.provider
          AND samples.metric_type = 'blood_glucose'
      )
    );
  GET DIAGNOSTICS v_sources_revoked = ROW_COUNT;

  DELETE FROM public.meal_response_insight_feedback feedback WHERE feedback.user_id = v_actor;
  GET DIAGNOSTICS v_feedback_deleted = ROW_COUNT;
  DELETE FROM public.meal_response_estimates estimates WHERE estimates.user_id = v_actor;
  GET DIAGNOSTICS v_estimates_deleted = ROW_COUNT;
  DELETE FROM public.meal_response_feature_snapshots features WHERE features.user_id = v_actor;
  GET DIAGNOSTICS v_features_deleted = ROW_COUNT;
  DELETE FROM public.meal_response_episodes episodes WHERE episodes.user_id = v_actor;
  GET DIAGNOSTICS v_episodes_deleted = ROW_COUNT;
  -- Assignment rows are immutable while an experiment is active, paused, or
  -- completed. Cancel every retained state first so a privacy deletion can
  -- remove the derived experiment dataset without weakening that protection.
  UPDATE public.meal_response_experiments experiments
  SET status = 'cancelled',
      completed_at = COALESCE(experiments.completed_at, clock_timestamp()),
      updated_at = clock_timestamp()
  WHERE experiments.user_id = v_actor
    AND experiments.status <> 'cancelled';

  DELETE FROM public.meal_response_experiment_assignments assignments WHERE assignments.user_id = v_actor;
  GET DIAGNOSTICS v_assignments_deleted = ROW_COUNT;
  DELETE FROM public.meal_response_experiments experiments WHERE experiments.user_id = v_actor;
  GET DIAGNOSTICS v_experiments_deleted = ROW_COUNT;
  DELETE FROM public.meal_response_check_ins check_ins WHERE check_ins.user_id = v_actor;
  GET DIAGNOSTICS v_check_ins_deleted = ROW_COUNT;
  DELETE FROM public.meal_response_glucose_ingest_batches batches WHERE batches.user_id = v_actor;
  GET DIAGNOSTICS v_batches_deleted = ROW_COUNT;

  UPDATE public.meal_consumptions consumptions
  SET started_consuming_at = NULL,
      finished_consuming_at = NULL,
      time_precision = 'date_only',
      timezone_name = NULL,
      utc_offset_minutes = NULL,
      updated_at = clock_timestamp()
  WHERE consumptions.user_id = v_actor
    AND (
      consumptions.started_consuming_at IS NOT NULL
      OR consumptions.finished_consuming_at IS NOT NULL
      OR consumptions.time_precision <> 'date_only'
      OR consumptions.timezone_name IS NOT NULL
      OR consumptions.utc_offset_minutes IS NOT NULL
    );
  GET DIAGNOSTICS v_timings_cleared = ROW_COUNT;

  INSERT INTO public.health_context_consent_events (
    user_id, event_type, policy_version, scopes, purpose, request_id
  ) VALUES (
    v_actor, 'dataset_deleted', p_policy_version, v_all_scopes,
    'meal_response_privacy', p_request_id
  );

  v_result := jsonb_build_object(
    'action', 'delete_dataset',
    'glucose_samples_soft_deleted', v_samples_revoked,
    'wearable_sources_updated', v_sources_revoked,
    'check_ins_deleted', v_check_ins_deleted,
    'feedback_deleted', v_feedback_deleted,
    'estimates_deleted', v_estimates_deleted,
    'features_deleted', v_features_deleted,
    'episodes_deleted', v_episodes_deleted,
    'assignments_deleted', v_assignments_deleted,
    'experiments_deleted', v_experiments_deleted,
    'ingest_batches_deleted', v_batches_deleted,
    'consumption_timings_cleared', v_timings_cleared,
    'canonical_nutrition_logs_retained', TRUE,
    'delivery_work', v_delivery_result,
    'already_processed', FALSE
  );

  INSERT INTO public.meal_response_privacy_actions (
    user_id, request_id, action_type, scopes, result_summary
  ) VALUES (
    v_actor, p_request_id, 'delete_dataset', v_all_scopes, v_result - 'already_processed'
  );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION security.cancel_meal_response_delivery_work(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION security.cancel_meal_response_delivery_work(UUID, TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION public.export_my_meal_response_data(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_my_meal_response_scopes(TEXT[], UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_my_meal_response_data(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_my_meal_response_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_meal_response_scopes(TEXT[], UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_meal_response_data(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.export_my_meal_response_data(UUID) IS
  'Exports the authenticated user meal-response package without source cursors, raw samples, device IDs, or credentials.';
COMMENT ON FUNCTION public.revoke_my_meal_response_scopes(TEXT[], UUID, TEXT) IS
  'Idempotently revokes granular meal-response scopes and removes dependent processing or derived data.';
COMMENT ON FUNCTION public.delete_my_meal_response_data(UUID, TEXT) IS
  'Idempotently deletes meal-response health data while retaining canonical nutrition history.';

COMMIT;
