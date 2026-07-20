BEGIN;

-- Meal response is an opt-in wellness feature. Analytical writes stay behind
-- SECURITY DEFINER RPCs or the service role so provenance cannot be forged.
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'meal-response-engine',
  '{"collection_enabled": false, "episode_building_enabled": false, "insight_display_enabled": false, "ranking_use_enabled": false, "experiments_enabled": false}'::JSONB,
  'Independent rollout controls for the meal-response wellness engine'
)
ON CONFLICT (key) DO NOTHING;

-- Precise, user-confirmed timing is additive to the existing order/schedule
-- lifecycle. Existing records remain date-only and therefore analytically
-- ineligible until the user confirms a time.
ALTER TABLE public.meal_consumptions
  ADD COLUMN IF NOT EXISTS started_consuming_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_consuming_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS time_precision TEXT NOT NULL DEFAULT 'date_only',
  ADD COLUMN IF NOT EXISTS portion_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone_name TEXT,
  ADD COLUMN IF NOT EXISTS utc_offset_minutes SMALLINT,
  ADD COLUMN IF NOT EXISTS consumed_item_snapshot JSONB;

UPDATE public.meal_consumptions
SET consumed_item_snapshot = nutrition_snapshot
WHERE consumed_item_snapshot IS NULL;

ALTER TABLE public.meal_consumptions
  DROP CONSTRAINT IF EXISTS meal_consumptions_source_type_check,
  DROP CONSTRAINT IF EXISTS meal_consumptions_time_precision_check,
  DROP CONSTRAINT IF EXISTS meal_consumptions_consumption_time_order_check,
  DROP CONSTRAINT IF EXISTS meal_consumptions_timezone_complete_check,
  DROP CONSTRAINT IF EXISTS meal_consumptions_consumed_item_snapshot_check;

ALTER TABLE public.meal_consumptions
  ADD CONSTRAINT meal_consumptions_source_type_check CHECK (source_type IN (
    'order', 'meal_schedule', 'manual_log', 'barcode_product', 'custom_food', 'coach_program'
  )),
  ADD CONSTRAINT meal_consumptions_time_precision_check CHECK (time_precision IN (
    'exact', 'estimated_15m', 'estimated_30m', 'date_only'
  )),
  ADD CONSTRAINT meal_consumptions_consumption_time_order_check CHECK (
    finished_consuming_at IS NULL OR
    (started_consuming_at IS NOT NULL AND finished_consuming_at >= started_consuming_at)
  ),
  ADD CONSTRAINT meal_consumptions_timezone_complete_check CHECK (
    (timezone_name IS NULL AND utc_offset_minutes IS NULL) OR
    (timezone_name IS NOT NULL AND char_length(timezone_name) BETWEEN 1 AND 80
      AND utc_offset_minutes BETWEEN -840 AND 840)
  ),
  ADD CONSTRAINT meal_consumptions_consumed_item_snapshot_check CHECK (
    consumed_item_snapshot IS NULL OR jsonb_typeof(consumed_item_snapshot) = 'object'
  );

CREATE INDEX IF NOT EXISTS idx_meal_consumptions_user_started
  ON public.meal_consumptions (user_id, started_consuming_at DESC)
  WHERE started_consuming_at IS NOT NULL;

-- Extend the existing private preference and append-only consent ledger.
ALTER TABLE public.health_context_preferences
  ADD COLUMN IF NOT EXISTS meal_response_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS glucose_analysis_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS post_meal_prompts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recommendation_use_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS coach_sharing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS research_use_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.health_context_preferences
  DROP CONSTRAINT IF EXISTS health_context_glucose_requires_meal_response,
  DROP CONSTRAINT IF EXISTS health_context_prompts_require_meal_response,
  DROP CONSTRAINT IF EXISTS health_context_response_recommendations_require_opt_in,
  DROP CONSTRAINT IF EXISTS health_context_response_sharing_requires_opt_in,
  DROP CONSTRAINT IF EXISTS health_context_response_research_requires_opt_in;

ALTER TABLE public.health_context_preferences
  ADD CONSTRAINT health_context_glucose_requires_meal_response
    CHECK (NOT glucose_analysis_enabled OR meal_response_enabled),
  ADD CONSTRAINT health_context_prompts_require_meal_response
    CHECK (NOT post_meal_prompts_enabled OR meal_response_enabled),
  ADD CONSTRAINT health_context_response_recommendations_require_opt_in
    CHECK (NOT recommendation_use_enabled OR meal_response_enabled),
  ADD CONSTRAINT health_context_response_sharing_requires_opt_in
    CHECK (NOT coach_sharing_enabled OR meal_response_enabled),
  ADD CONSTRAINT health_context_response_research_requires_opt_in
    CHECK (NOT research_use_enabled OR meal_response_enabled);

ALTER TABLE public.health_context_consent_events
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'health_context',
  ADD COLUMN IF NOT EXISTS request_id UUID;

ALTER TABLE public.health_context_consent_events
  DROP CONSTRAINT IF EXISTS health_context_consent_scopes_check,
  DROP CONSTRAINT IF EXISTS health_context_consent_purpose_check;

ALTER TABLE public.health_context_consent_events
  ADD CONSTRAINT health_context_consent_scopes_check CHECK (
    cardinality(scopes) <= 8 AND scopes <@ ARRAY[
      'meal_response', 'glucose_analysis', 'post_meal_prompts',
      'recommendation_use', 'coach_sharing', 'research_use', 'health_context', 'cycle_context'
    ]::TEXT[]
  ),
  ADD CONSTRAINT health_context_consent_purpose_check CHECK (
    char_length(purpose) BETWEEN 3 AND 80
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_health_context_consent_request
  ON public.health_context_consent_events (user_id, request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_context_consent_user_created
  ON public.health_context_consent_events (user_id, created_at DESC);

GRANT SELECT ON public.health_context_consent_events TO authenticated;
DROP POLICY IF EXISTS health_context_consent_events_owner_read ON public.health_context_consent_events;
CREATE POLICY health_context_consent_events_owner_read
  ON public.health_context_consent_events FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- High-frequency samples share the established wearable store, preserving its
-- daily aggregate consumers while adding sample-level provenance.
ALTER TABLE public.wearable_sync_sources
  DROP CONSTRAINT IF EXISTS wearable_sync_sources_provider_check;
ALTER TABLE public.wearable_sync_sources
  ADD CONSTRAINT wearable_sync_sources_provider_check CHECK (provider IN (
    'apple_health', 'google_fit', 'health_connect', 'dexcom', 'sporthub',
    'file_import', 'body_scale', 'nutrio_activity', 'manual'
  ));

ALTER TABLE public.wearable_sync_sources
  ADD COLUMN IF NOT EXISTS cursor_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error_class TEXT,
  ADD COLUMN IF NOT EXISTS observed_sync_lag_seconds INTEGER;

ALTER TABLE public.wearable_sync_sources
  DROP CONSTRAINT IF EXISTS wearable_sync_sources_cursor_version_check,
  DROP CONSTRAINT IF EXISTS wearable_sync_sources_lag_check;
ALTER TABLE public.wearable_sync_sources
  ADD CONSTRAINT wearable_sync_sources_cursor_version_check CHECK (cursor_version > 0),
  ADD CONSTRAINT wearable_sync_sources_lag_check CHECK (
    observed_sync_lag_seconds IS NULL OR observed_sync_lag_seconds >= 0
  );

CREATE OR REPLACE FUNCTION public.wearable_provider_precedence(p_provider TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE p_provider
    WHEN 'dexcom' THEN 100
    WHEN 'body_scale' THEN 100
    WHEN 'apple_health' THEN 90
    WHEN 'health_connect' THEN 85
    WHEN 'google_fit' THEN 80
    WHEN 'sporthub' THEN 70
    WHEN 'file_import' THEN 50
    WHEN 'nutrio_activity' THEN 30
    WHEN 'manual' THEN 20
    ELSE 0
  END;
$function$;

ALTER TABLE public.wearable_metric_samples
  DROP CONSTRAINT IF EXISTS wearable_metric_samples_provider_check,
  DROP CONSTRAINT IF EXISTS wearable_metric_samples_metric_type_check;
ALTER TABLE public.wearable_metric_samples
  ADD CONSTRAINT wearable_metric_samples_provider_check CHECK (provider IN (
    'apple_health', 'google_fit', 'health_connect', 'dexcom', 'sporthub',
    'file_import', 'body_scale', 'nutrio_activity', 'manual'
  )),
  ADD CONSTRAINT wearable_metric_samples_metric_type_check CHECK (metric_type IN (
    'steps', 'workouts_count', 'active_calories', 'average_heart_rate',
    'heart_rate_sample', 'resting_heart_rate', 'hrv', 'sleep_minutes',
    'deep_sleep_minutes', 'rem_sleep_minutes', 'respiratory_rate', 'spo2',
    'skin_temperature', 'body_weight_kg', 'body_fat_percent', 'blood_glucose'
  ));

ALTER TABLE public.wearable_metric_samples
  ADD COLUMN IF NOT EXISTS sample_kind TEXT NOT NULL DEFAULT 'aggregate',
  ADD COLUMN IF NOT EXISTS original_value NUMERIC,
  ADD COLUMN IF NOT EXISTS original_unit TEXT,
  ADD COLUMN IF NOT EXISTS quality_flags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS normalizer_version TEXT NOT NULL DEFAULT 'legacy-v1',
  ADD COLUMN IF NOT EXISTS source_record_version TEXT;

ALTER TABLE public.wearable_metric_samples
  DROP CONSTRAINT IF EXISTS wearable_metric_samples_sample_kind_check,
  DROP CONSTRAINT IF EXISTS wearable_metric_samples_original_value_check,
  DROP CONSTRAINT IF EXISTS wearable_metric_samples_quality_flags_check,
  DROP CONSTRAINT IF EXISTS wearable_metric_samples_glucose_contract_check;
ALTER TABLE public.wearable_metric_samples
  ADD CONSTRAINT wearable_metric_samples_sample_kind_check
    CHECK (sample_kind IN ('instant', 'interval', 'aggregate')),
  ADD CONSTRAINT wearable_metric_samples_original_value_check
    CHECK (original_value IS NULL OR original_value >= 0),
  ADD CONSTRAINT wearable_metric_samples_quality_flags_check
    CHECK (cardinality(quality_flags) <= 16),
  ADD CONSTRAINT wearable_metric_samples_glucose_contract_check CHECK (
    metric_type <> 'blood_glucose' OR (
      sample_kind = 'instant' AND unit = 'mg/dL' AND value BETWEEN 20 AND 600
      AND original_value IS NOT NULL AND original_unit IN ('mg/dL', 'mmol/L')
      AND char_length(normalizer_version) BETWEEN 1 AND 80
    )
  );

CREATE INDEX IF NOT EXISTS idx_wearable_metric_samples_active_time
  ON public.wearable_metric_samples (user_id, metric_type, start_at DESC)
  WHERE deleted_at IS NULL AND sync_status = 'synced';
CREATE INDEX IF NOT EXISTS idx_wearable_metric_samples_source_external
  ON public.wearable_metric_samples (user_id, provider, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.wearable_sync_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_sync_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_metric_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wearable_metric_samples FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own wearable sync sources" ON public.wearable_sync_sources;
DROP POLICY IF EXISTS "Users can manage own wearable samples" ON public.wearable_metric_samples;
DROP POLICY IF EXISTS "Users can view own wearable sync sources" ON public.wearable_sync_sources;
CREATE POLICY "Users can view own wearable sync sources"
  ON public.wearable_sync_sources FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view own wearable samples" ON public.wearable_metric_samples;
CREATE POLICY "Users can view own wearable samples"
  ON public.wearable_metric_samples FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
REVOKE ALL ON public.wearable_sync_sources, public.wearable_metric_samples
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.wearable_sync_sources, public.wearable_metric_samples TO authenticated;
GRANT ALL ON public.wearable_sync_sources, public.wearable_metric_samples TO service_role;

CREATE TABLE IF NOT EXISTS public.meal_response_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumption_id UUID NOT NULL REFERENCES public.meal_consumptions(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  prompt_offset_minutes SMALLINT NOT NULL CHECK (prompt_offset_minutes BETWEEN -60 AND 1440),
  satiety SMALLINT CHECK (satiety BETWEEN 1 AND 10),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 10),
  digestive_symptoms TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  symptom_severity SMALLINT CHECK (symptom_severity BETWEEN 0 AND 4),
  confounders TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meal_response_check_ins_request_unique UNIQUE (user_id, request_id),
  CONSTRAINT meal_response_check_ins_payload_check CHECK (
    satiety IS NOT NULL OR energy IS NOT NULL OR cardinality(digestive_symptoms) > 0
  ),
  CONSTRAINT meal_response_check_ins_symptoms_check CHECK (
    cardinality(digestive_symptoms) <= 8 AND digestive_symptoms <@ ARRAY[
      'bloating', 'reflux', 'constipation', 'diarrhea', 'nausea', 'discomfort', 'cramping', 'other'
    ]::TEXT[]
  ),
  CONSTRAINT meal_response_check_ins_confounders_check CHECK (
    cardinality(confounders) <= 12 AND confounders <@ ARRAY[
      'exercise', 'caffeine', 'alcohol', 'illness', 'poor_sleep', 'travel',
      'fasting', 'medication_change', 'cycle_context', 'overlapping_meal',
      'sensor_warmup', 'other'
    ]::TEXT[]
  )
);

CREATE TABLE IF NOT EXISTS public.meal_response_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumption_id UUID NOT NULL REFERENCES public.meal_consumptions(id) ON DELETE CASCADE,
  consumption_version INTEGER NOT NULL CHECK (consumption_version > 0),
  protocol_version TEXT NOT NULL CHECK (char_length(protocol_version) BETWEEN 1 AND 80),
  baseline_start_at TIMESTAMPTZ NOT NULL,
  baseline_end_at TIMESTAMPTZ NOT NULL,
  response_start_at TIMESTAMPTZ NOT NULL,
  response_end_at TIMESTAMPTZ NOT NULL,
  eligibility TEXT NOT NULL CHECK (eligibility IN ('eligible', 'descriptive_only', 'excluded')),
  sample_coverage NUMERIC(5, 4) CHECK (sample_coverage BETWEEN 0 AND 1),
  baseline_sample_count INTEGER NOT NULL DEFAULT 0 CHECK (baseline_sample_count >= 0),
  response_sample_count INTEGER NOT NULL DEFAULT 0 CHECK (response_sample_count >= 0),
  exclusion_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  quality_flags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  outcomes JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(outcomes) = 'object'),
  built_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  superseded_at TIMESTAMPTZ,
  CONSTRAINT meal_response_episode_window_order CHECK (
    baseline_start_at < baseline_end_at AND baseline_end_at <= response_start_at
    AND response_start_at < response_end_at
  ),
  CONSTRAINT meal_response_episode_version_unique
    UNIQUE (consumption_id, consumption_version, protocol_version)
);

CREATE TABLE IF NOT EXISTS public.meal_response_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  outcome_type TEXT NOT NULL,
  feature_schema_version TEXT NOT NULL,
  training_cutoff_at TIMESTAMPTZ,
  metrics JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metrics) = 'object'),
  subgroup_metrics JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(subgroup_metrics) = 'object'),
  artifact_path TEXT,
  artifact_checksum TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'validated', 'challenger', 'champion', 'retired', 'rolled_back'
  )),
  rollback_model_id UUID REFERENCES public.meal_response_model_registry(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  CONSTRAINT meal_response_model_version_unique UNIQUE (model_name, model_version)
);

CREATE TABLE IF NOT EXISTS public.meal_response_feature_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id UUID NOT NULL REFERENCES public.meal_response_episodes(id) ON DELETE CASCADE,
  schema_version TEXT NOT NULL,
  feature_json JSONB NOT NULL CHECK (jsonb_typeof(feature_json) = 'object'),
  checksum TEXT NOT NULL CHECK (char_length(checksum) BETWEEN 16 AND 256),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meal_response_feature_snapshot_unique UNIQUE (episode_id, schema_version, checksum)
);

CREATE TABLE IF NOT EXISTS public.meal_response_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id UUID REFERENCES public.meal_response_episodes(id) ON DELETE SET NULL,
  feature_snapshot_id UUID NOT NULL REFERENCES public.meal_response_feature_snapshots(id) ON DELETE RESTRICT,
  model_id UUID REFERENCES public.meal_response_model_registry(id) ON DELETE RESTRICT,
  outcome_type TEXT NOT NULL,
  estimate_value NUMERIC,
  estimate_unit TEXT,
  interval_80_lower NUMERIC,
  interval_80_upper NUMERIC,
  interval_90_lower NUMERIC,
  interval_90_upper NUMERIC,
  meaningful_difference_probability NUMERIC(6, 5) CHECK (
    meaningful_difference_probability IS NULL OR meaningful_difference_probability BETWEEN 0 AND 1
  ),
  evidence_tier TEXT NOT NULL CHECK (evidence_tier IN (
    'insufficient_evidence', 'descriptive', 'early_signal', 'moderate', 'strong'
  )),
  source_kind TEXT NOT NULL CHECK (source_kind IN (
    'measured', 'self_reported', 'predicted', 'experiment_backed'
  )),
  eligible_episode_count INTEGER NOT NULL DEFAULT 0 CHECK (eligible_episode_count >= 0),
  limitations TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  abstention_reason TEXT,
  data_cutoff_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  CONSTRAINT meal_response_estimate_80_interval CHECK (
    interval_80_lower IS NULL OR interval_80_upper IS NULL OR interval_80_lower <= interval_80_upper
  ),
  CONSTRAINT meal_response_estimate_90_interval CHECK (
    interval_90_lower IS NULL OR interval_90_upper IS NULL OR interval_90_lower <= interval_90_upper
  ),
  CONSTRAINT meal_response_estimate_abstention_check CHECK (
    evidence_tier <> 'insufficient_evidence' OR abstention_reason IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.meal_response_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hypothesis TEXT NOT NULL CHECK (char_length(hypothesis) BETWEEN 1 AND 500),
  outcome_type TEXT NOT NULL,
  arms JSONB NOT NULL CHECK (jsonb_typeof(arms) = 'array' AND jsonb_array_length(arms) BETWEEN 2 AND 4),
  randomization_method TEXT NOT NULL CHECK (randomization_method IN ('randomized', 'abba', 'baab')),
  minimum_repeats_per_arm SMALLINT NOT NULL DEFAULT 4 CHECK (minimum_repeats_per_arm BETWEEN 2 AND 20),
  protocol_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.meal_response_experiment_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES public.meal_response_experiments(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  arm_key TEXT NOT NULL,
  scheduled_consumption_id UUID REFERENCES public.meal_consumptions(id) ON DELETE SET NULL,
  consumed_consumption_id UUID REFERENCES public.meal_consumptions(id) ON DELETE SET NULL,
  protocol_deviations TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT meal_response_assignment_sequence_unique UNIQUE (experiment_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS public.meal_response_insight_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES public.meal_response_estimates(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  useful BOOLEAN,
  accuracy_feedback TEXT CHECK (accuracy_feedback IN ('accurate', 'not_accurate', 'unsure')),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meal_response_feedback_request_unique UNIQUE (user_id, request_id),
  CONSTRAINT meal_response_feedback_has_value CHECK (useful IS NOT NULL OR accuracy_feedback IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.meal_response_glucose_ingest_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  provider TEXT NOT NULL,
  sample_count INTEGER NOT NULL CHECK (sample_count BETWEEN 1 AND 1000),
  result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meal_response_glucose_batch_request_unique UNIQUE (user_id, request_id)
);

INSERT INTO public.meal_response_model_registry (
  model_name, model_version, outcome_type, feature_schema_version,
  metrics, subgroup_metrics, status, activated_at
) VALUES (
  'deterministic-meal-response', 'rules-v1', 'multi_outcome', 'meal-response-features-v1',
  '{"kind":"deterministic","requires_calibration":false,"claim_scope":"wellness"}'::JSONB,
  '{}'::JSONB, 'champion', clock_timestamp()
)
ON CONFLICT (model_name, model_version) DO NOTHING;

-- Every foreign key and common owner/time access path is indexed explicitly.
CREATE INDEX IF NOT EXISTS idx_meal_response_checkins_consumption
  ON public.meal_response_check_ins (consumption_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_checkins_user_time
  ON public.meal_response_check_ins (user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_episodes_consumption
  ON public.meal_response_episodes (consumption_id, built_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_episodes_user_time
  ON public.meal_response_episodes (user_id, response_start_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_features_user_time
  ON public.meal_response_feature_snapshots (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_features_episode
  ON public.meal_response_feature_snapshots (episode_id);
CREATE INDEX IF NOT EXISTS idx_meal_response_estimates_user_time
  ON public.meal_response_estimates (user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_estimates_episode
  ON public.meal_response_estimates (episode_id) WHERE episode_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_response_estimates_feature
  ON public.meal_response_estimates (feature_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_meal_response_estimates_model
  ON public.meal_response_estimates (model_id) WHERE model_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_response_model_rollback
  ON public.meal_response_model_registry (rollback_model_id) WHERE rollback_model_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_response_experiments_user_time
  ON public.meal_response_experiments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_assignments_user_time
  ON public.meal_response_experiment_assignments (user_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_assignments_experiment
  ON public.meal_response_experiment_assignments (experiment_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_meal_response_assignments_scheduled
  ON public.meal_response_experiment_assignments (scheduled_consumption_id)
  WHERE scheduled_consumption_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_response_assignments_consumed
  ON public.meal_response_experiment_assignments (consumed_consumption_id)
  WHERE consumed_consumption_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_meal_response_feedback_estimate
  ON public.meal_response_insight_feedback (estimate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_feedback_user_time
  ON public.meal_response_insight_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_glucose_batches_user_time
  ON public.meal_response_glucose_ingest_batches (user_id, created_at DESC);

-- Immutable analytical tables expose owner SELECT only. The model registry has
-- no authenticated policy because it is operational metadata, not user data.
DO $block$
DECLARE
  v_table REGCLASS;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'public.meal_response_check_ins'::REGCLASS,
    'public.meal_response_episodes'::REGCLASS,
    'public.meal_response_feature_snapshots'::REGCLASS,
    'public.meal_response_estimates'::REGCLASS,
    'public.meal_response_model_registry'::REGCLASS,
    'public.meal_response_experiments'::REGCLASS,
    'public.meal_response_experiment_assignments'::REGCLASS,
    'public.meal_response_insight_feedback'::REGCLASS,
    'public.meal_response_glucose_ingest_batches'::REGCLASS
  ] LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE %s TO service_role', v_table);
  END LOOP;
END;
$block$;

DO $block$
DECLARE
  v_name TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'meal_response_check_ins', 'meal_response_episodes',
    'meal_response_feature_snapshots', 'meal_response_estimates',
    'meal_response_experiments', 'meal_response_experiment_assignments',
    'meal_response_insight_feedback', 'meal_response_glucose_ingest_batches'
  ] LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_name || '_owner_read', v_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))',
      v_name || '_owner_read', v_name
    );
  END LOOP;
END;
$block$;

CREATE OR REPLACE FUNCTION public.set_meal_response_preferences(
  p_meal_response_enabled BOOLEAN,
  p_glucose_analysis_enabled BOOLEAN DEFAULT FALSE,
  p_post_meal_prompts_enabled BOOLEAN DEFAULT FALSE,
  p_recommendation_use_enabled BOOLEAN DEFAULT FALSE,
  p_coach_sharing_enabled BOOLEAN DEFAULT FALSE,
  p_research_use_enabled BOOLEAN DEFAULT FALSE,
  p_policy_version TEXT DEFAULT '2026-07-meal-response-v1',
  p_request_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_preferences public.health_context_preferences%ROWTYPE;
  v_scopes TEXT[] := '{}'::TEXT[];
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  IF char_length(COALESCE(p_policy_version, '')) NOT BETWEEN 3 AND 80 THEN
    RAISE EXCEPTION 'INVALID_POLICY_VERSION';
  END IF;

  SELECT preferences.* INTO v_preferences
  FROM public.health_context_preferences preferences
  WHERE preferences.user_id = v_actor;

  IF EXISTS (
    SELECT 1 FROM public.health_context_consent_events events
    WHERE events.user_id = v_actor AND events.request_id = p_request_id
  ) THEN
    RETURN jsonb_build_object('preferences', to_jsonb(v_preferences), 'already_processed', TRUE);
  END IF;

  INSERT INTO public.health_context_preferences (
    user_id, meal_response_enabled, glucose_analysis_enabled,
    post_meal_prompts_enabled, recommendation_use_enabled,
    coach_sharing_enabled, research_use_enabled, updated_at
  ) VALUES (
    v_actor, p_meal_response_enabled,
    p_meal_response_enabled AND p_glucose_analysis_enabled,
    p_meal_response_enabled AND p_post_meal_prompts_enabled,
    p_meal_response_enabled AND p_recommendation_use_enabled,
    p_meal_response_enabled AND p_coach_sharing_enabled,
    p_meal_response_enabled AND p_research_use_enabled,
    clock_timestamp()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    meal_response_enabled = EXCLUDED.meal_response_enabled,
    glucose_analysis_enabled = EXCLUDED.glucose_analysis_enabled,
    post_meal_prompts_enabled = EXCLUDED.post_meal_prompts_enabled,
    recommendation_use_enabled = EXCLUDED.recommendation_use_enabled,
    coach_sharing_enabled = EXCLUDED.coach_sharing_enabled,
    research_use_enabled = EXCLUDED.research_use_enabled,
    updated_at = clock_timestamp()
  RETURNING * INTO v_preferences;

  IF v_preferences.meal_response_enabled THEN v_scopes := array_append(v_scopes, 'meal_response'); END IF;
  IF v_preferences.glucose_analysis_enabled THEN v_scopes := array_append(v_scopes, 'glucose_analysis'); END IF;
  IF v_preferences.post_meal_prompts_enabled THEN v_scopes := array_append(v_scopes, 'post_meal_prompts'); END IF;
  IF v_preferences.recommendation_use_enabled THEN v_scopes := array_append(v_scopes, 'recommendation_use'); END IF;
  IF v_preferences.coach_sharing_enabled THEN v_scopes := array_append(v_scopes, 'coach_sharing'); END IF;
  IF v_preferences.research_use_enabled THEN v_scopes := array_append(v_scopes, 'research_use'); END IF;

  INSERT INTO public.health_context_consent_events (
    user_id, event_type, policy_version, scopes, purpose, request_id
  ) VALUES (
    v_actor,
    CASE WHEN v_preferences.meal_response_enabled THEN 'granted' ELSE 'revoked' END,
    p_policy_version, v_scopes, 'meal_response_personalization', p_request_id
  );

  RETURN jsonb_build_object('preferences', to_jsonb(v_preferences), 'already_processed', FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_meal_consumption_timing(
  p_consumption_id UUID,
  p_started_consuming_at TIMESTAMPTZ,
  p_finished_consuming_at TIMESTAMPTZ,
  p_time_precision TEXT,
  p_timezone_name TEXT,
  p_utc_offset_minutes SMALLINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_consumption public.meal_consumptions%ROWTYPE;
  v_version INTEGER;
  v_previous JSONB;
  v_request_id UUID := gen_random_uuid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_time_precision NOT IN ('exact', 'estimated_15m', 'estimated_30m', 'date_only') THEN
    RAISE EXCEPTION 'INVALID_TIME_PRECISION';
  END IF;
  IF p_time_precision <> 'date_only' AND p_started_consuming_at IS NULL THEN
    RAISE EXCEPTION 'CONSUMPTION_START_REQUIRED';
  END IF;
  IF p_finished_consuming_at IS NOT NULL AND p_finished_consuming_at < p_started_consuming_at THEN
    RAISE EXCEPTION 'INVALID_CONSUMPTION_TIME_RANGE';
  END IF;
  IF p_timezone_name IS NULL OR p_utc_offset_minutes IS NULL
     OR p_utc_offset_minutes NOT BETWEEN -840 AND 840 THEN
    RAISE EXCEPTION 'VALID_TIMEZONE_REQUIRED';
  END IF;

  SELECT * INTO v_consumption
  FROM public.meal_consumptions
  WHERE id = p_consumption_id AND user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONSUMPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_previous := to_jsonb(v_consumption);
  v_version := v_consumption.event_version + 1;
  UPDATE public.meal_consumptions
  SET started_consuming_at = CASE WHEN p_time_precision = 'date_only' THEN NULL ELSE p_started_consuming_at END,
      finished_consuming_at = CASE WHEN p_time_precision = 'date_only' THEN NULL ELSE p_finished_consuming_at END,
      time_precision = p_time_precision,
      portion_confirmed_at = clock_timestamp(),
      timezone_name = p_timezone_name,
      utc_offset_minutes = p_utc_offset_minutes,
      event_version = v_version,
      updated_at = clock_timestamp()
  WHERE id = p_consumption_id
  RETURNING * INTO v_consumption;

  INSERT INTO public.meal_consumption_events (
    consumption_id, user_id, request_id, event_version, previous_state,
    current_state, nutrition_delta, result_snapshot, event_type, source_type,
    source_id, source_meal_id, semantic_idempotency_key
  ) VALUES (
    v_consumption.id, v_actor, v_request_id, v_version, v_previous,
    to_jsonb(v_consumption), '{}'::JSONB, to_jsonb(v_consumption), 'timing_confirmed',
    v_consumption.source_type, v_consumption.source_id, v_consumption.source_meal_id,
    concat_ws(':', v_actor::TEXT, v_consumption.id::TEXT, 'timing_confirmed', v_version::TEXT)
  );

  RETURN jsonb_build_object('consumption', to_jsonb(v_consumption));
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_meal_response_check_in(
  p_consumption_id UUID,
  p_request_id UUID,
  p_prompt_offset_minutes SMALLINT,
  p_satiety SMALLINT DEFAULT NULL,
  p_energy SMALLINT DEFAULT NULL,
  p_digestive_symptoms TEXT[] DEFAULT '{}'::TEXT[],
  p_symptom_severity SMALLINT DEFAULT NULL,
  p_confounders TEXT[] DEFAULT '{}'::TEXT[],
  p_submitted_at TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_check_in public.meal_response_check_ins%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.health_context_preferences preferences
    WHERE preferences.user_id = v_actor AND preferences.meal_response_enabled
  ) THEN RAISE EXCEPTION 'MEAL_RESPONSE_OPT_IN_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meal_consumptions consumptions
    WHERE consumptions.id = p_consumption_id AND consumptions.user_id = v_actor
  ) THEN RAISE EXCEPTION 'CONSUMPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_check_in FROM public.meal_response_check_ins
  WHERE user_id = v_actor AND request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('check_in', to_jsonb(v_check_in), 'already_processed', TRUE);
  END IF;

  INSERT INTO public.meal_response_check_ins (
    user_id, consumption_id, request_id, prompt_offset_minutes, satiety,
    energy, digestive_symptoms, symptom_severity, confounders, submitted_at
  ) VALUES (
    v_actor, p_consumption_id, p_request_id, p_prompt_offset_minutes, p_satiety,
    p_energy, COALESCE(p_digestive_symptoms, '{}'::TEXT[]), p_symptom_severity,
    COALESCE(p_confounders, '{}'::TEXT[]), p_submitted_at
  ) RETURNING * INTO v_check_in;

  RETURN jsonb_build_object('check_in', to_jsonb(v_check_in), 'already_processed', FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_meal_response_insight_feedback(
  p_estimate_id UUID,
  p_request_id UUID,
  p_useful BOOLEAN DEFAULT NULL,
  p_accuracy_feedback TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_feedback public.meal_response_insight_feedback%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meal_response_estimates estimates
    WHERE estimates.id = p_estimate_id AND estimates.user_id = v_actor
  ) THEN RAISE EXCEPTION 'ESTIMATE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_feedback
  FROM public.meal_response_insight_feedback feedback
  WHERE feedback.user_id = v_actor AND feedback.request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('feedback', to_jsonb(v_feedback), 'already_processed', TRUE);
  END IF;

  INSERT INTO public.meal_response_insight_feedback (
    user_id, estimate_id, request_id, useful, accuracy_feedback, reason
  ) VALUES (
    v_actor, p_estimate_id, p_request_id, p_useful, p_accuracy_feedback,
    NULLIF(trim(p_reason), '')
  ) RETURNING * INTO v_feedback;

  RETURN jsonb_build_object('feedback', to_jsonb(v_feedback), 'already_processed', FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_meal_response_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;

  RETURN jsonb_build_object(
    'preferences', COALESCE((
      SELECT to_jsonb(preferences) - 'user_id'
      FROM public.health_context_preferences preferences
      WHERE preferences.user_id = v_actor
    ), '{}'::JSONB),
    'glucose_connected', EXISTS (
      SELECT 1 FROM public.wearable_sync_sources sources
      WHERE sources.user_id = v_actor
        AND sources.provider IN ('apple_health', 'health_connect', 'dexcom')
        AND sources.status IN ('connected', 'syncing', 'synced', 'stale')
        AND sources.revoked_at IS NULL
    ),
    'eligible_episode_count', (
      SELECT count(*) FROM public.meal_response_episodes episodes
      WHERE episodes.user_id = v_actor AND episodes.eligibility = 'eligible'
        AND episodes.superseded_at IS NULL
    ),
    'descriptive_episode_count', (
      SELECT count(*) FROM public.meal_response_episodes episodes
      WHERE episodes.user_id = v_actor AND episodes.eligibility = 'descriptive_only'
        AND episodes.superseded_at IS NULL
    ),
    'pending_check_ins', COALESCE((
      SELECT jsonb_agg(to_jsonb(pending) ORDER BY pending.consumed_at DESC)
      FROM (
        SELECT consumptions.id AS consumption_id,
          COALESCE(consumptions.consumed_item_snapshot ->> 'meal_name', 'Meal') AS meal_name,
          consumptions.consumed_item_snapshot ->> 'image_url' AS image_url,
          consumptions.started_consuming_at AS consumed_at,
          120::INTEGER AS prompt_offset_minutes
        FROM public.meal_consumptions consumptions
        WHERE consumptions.user_id = v_actor
          AND consumptions.status IN ('full', 'partial', 'substituted')
          AND consumptions.started_consuming_at BETWEEN clock_timestamp() - INTERVAL '24 hours'
            AND clock_timestamp() - INTERVAL '60 minutes'
          AND consumptions.time_precision <> 'date_only'
          AND NOT EXISTS (
            SELECT 1 FROM public.meal_response_check_ins check_ins
            WHERE check_ins.user_id = v_actor
              AND check_ins.consumption_id = consumptions.id
              AND check_ins.prompt_offset_minutes BETWEEN 90 AND 180
          )
        ORDER BY consumptions.started_consuming_at DESC
        LIMIT 5
      ) pending
    ), '[]'::JSONB),
    'estimates', COALESCE((
      SELECT jsonb_agg(to_jsonb(recent) ORDER BY recent.published_at DESC)
      FROM (
        SELECT estimates.id, episodes.consumption_id,
          NULLIF(consumptions.consumed_item_snapshot ->> 'meal_id', '') AS meal_id,
          COALESCE(consumptions.consumed_item_snapshot ->> 'meal_name', 'Meal') AS meal_name,
          consumptions.consumed_item_snapshot ->> 'image_url' AS image_url,
          estimates.outcome_type AS outcome,
          estimates.estimate_value AS estimate,
          estimates.interval_80_lower AS lower_bound,
          estimates.interval_80_upper AS upper_bound,
          estimates.estimate_unit AS unit,
          CASE estimates.evidence_tier
            WHEN 'early_signal' THEN 'early'
            WHEN 'moderate' THEN 'medium'
            WHEN 'strong' THEN 'strong'
            ELSE 'descriptive'
          END AS evidence_tier,
          CASE estimates.source_kind
            WHEN 'measured' THEN 'measured'
            WHEN 'predicted' THEN 'predicted'
            WHEN 'experiment_backed' THEN 'experiment'
            ELSE 'observed'
          END AS source_kind,
          CASE estimates.evidence_tier
            WHEN 'strong' THEN 88
            WHEN 'moderate' THEN 70
            WHEN 'early_signal' THEN 45
            ELSE 25
          END AS confidence_score,
          estimates.eligible_episode_count,
          estimates.limitations AS explanation_codes,
          estimates.published_at
        FROM public.meal_response_estimates estimates
        LEFT JOIN public.meal_response_episodes episodes ON episodes.id = estimates.episode_id
        LEFT JOIN public.meal_consumptions consumptions ON consumptions.id = episodes.consumption_id
        WHERE estimates.user_id = v_actor AND estimates.superseded_at IS NULL
          AND estimates.evidence_tier <> 'insufficient_evidence'
          AND (estimates.expires_at IS NULL OR estimates.expires_at > clock_timestamp())
        ORDER BY estimates.published_at DESC
        LIMIT 20
      ) recent
    ), '[]'::JSONB),
    'experiments', COALESCE((
      SELECT jsonb_agg(to_jsonb(summary) ORDER BY summary.created_at DESC)
      FROM (
        SELECT experiments.id, experiments.hypothesis AS title, experiments.status,
          experiments.minimum_repeats_per_arm * jsonb_array_length(experiments.arms) AS minimum_repeats,
          (SELECT count(*) FROM public.meal_response_experiment_assignments assignments
            WHERE assignments.experiment_id = experiments.id AND assignments.completed_at IS NOT NULL) AS completed_repeats,
          (SELECT assignments.arm_key FROM public.meal_response_experiment_assignments assignments
            WHERE assignments.experiment_id = experiments.id AND assignments.completed_at IS NULL
            ORDER BY assignments.sequence_number LIMIT 1) AS next_assignment_label,
          experiments.created_at
        FROM public.meal_response_experiments experiments
        WHERE experiments.user_id = v_actor AND experiments.status IN ('draft', 'active', 'paused')
      ) summary
    ), '[]'::JSONB)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_meal_response_ranking_input()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_enabled BOOLEAN := FALSE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT preferences.meal_response_enabled AND preferences.recommendation_use_enabled
    INTO v_enabled
  FROM public.health_context_preferences preferences
  WHERE preferences.user_id = v_actor;

  IF NOT COALESCE(v_enabled, FALSE) THEN
    RETURN jsonb_build_object('enabled', FALSE, 'meals', '[]'::JSONB);
  END IF;

  RETURN jsonb_build_object(
    'enabled', TRUE,
    'generated_at', clock_timestamp(),
    'meals', COALESCE((
      SELECT jsonb_agg(to_jsonb(ranking_row) ORDER BY ranking_row.evidence_weight DESC)
      FROM (
        SELECT DISTINCT ON (consumptions.consumed_item_snapshot ->> 'meal_id')
          consumptions.consumed_item_snapshot ->> 'meal_id' AS meal_id,
          estimates.outcome_type,
          estimates.estimate_value,
          estimates.estimate_unit,
          estimates.interval_80_lower,
          estimates.interval_80_upper,
          estimates.evidence_tier,
          estimates.source_kind,
          estimates.eligible_episode_count,
          CASE estimates.evidence_tier WHEN 'strong' THEN 1.0 ELSE 0.65 END AS evidence_weight,
          estimates.published_at,
          estimates.expires_at
        FROM public.meal_response_estimates estimates
        JOIN public.meal_response_episodes episodes ON episodes.id = estimates.episode_id
        JOIN public.meal_consumptions consumptions ON consumptions.id = episodes.consumption_id
        WHERE estimates.user_id = v_actor
          AND estimates.superseded_at IS NULL
          AND estimates.evidence_tier IN ('moderate', 'strong')
          AND estimates.source_kind IN ('measured', 'self_reported', 'experiment_backed')
          AND (estimates.expires_at IS NULL OR estimates.expires_at > clock_timestamp())
          AND NULLIF(consumptions.consumed_item_snapshot ->> 'meal_id', '') IS NOT NULL
        ORDER BY consumptions.consumed_item_snapshot ->> 'meal_id',
          CASE estimates.evidence_tier WHEN 'strong' THEN 2 ELSE 1 END DESC,
          estimates.published_at DESC
      ) ranking_row
    ), '[]'::JSONB)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ingest_meal_response_glucose_samples(
  p_request_id UUID,
  p_provider TEXT,
  p_samples JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_sample JSONB;
  v_count INTEGER;
  v_changed INTEGER := 0;
  v_unchanged INTEGER := 0;
  v_row_count INTEGER;
  v_original_value NUMERIC;
  v_original_unit TEXT;
  v_value_mg_dl NUMERIC;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  IF p_provider NOT IN ('apple_health', 'health_connect', 'dexcom') THEN
    RAISE EXCEPTION 'UNSUPPORTED_GLUCOSE_PROVIDER';
  END IF;
  IF jsonb_typeof(p_samples) <> 'array' THEN RAISE EXCEPTION 'SAMPLES_MUST_BE_ARRAY'; END IF;
  v_count := jsonb_array_length(p_samples);
  IF v_count NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'INVALID_SAMPLE_BATCH_SIZE'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.health_context_preferences preferences
    WHERE preferences.user_id = v_actor
      AND preferences.meal_response_enabled AND preferences.glucose_analysis_enabled
  ) THEN RAISE EXCEPTION 'GLUCOSE_ANALYSIS_OPT_IN_REQUIRED' USING ERRCODE = '42501'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0));
  SELECT batches.result INTO v_result
  FROM public.meal_response_glucose_ingest_batches batches
  WHERE batches.user_id = v_actor AND batches.request_id = p_request_id;
  IF FOUND THEN RETURN v_result || jsonb_build_object('already_processed', TRUE); END IF;

  FOR v_sample IN SELECT value FROM jsonb_array_elements(p_samples) LOOP
    IF jsonb_typeof(v_sample) <> 'object' THEN RAISE EXCEPTION 'INVALID_SAMPLE_OBJECT'; END IF;
    v_original_unit := v_sample ->> 'unit';
    IF v_original_unit NOT IN ('mg/dL', 'mmol/L') THEN RAISE EXCEPTION 'INVALID_GLUCOSE_UNIT'; END IF;
    BEGIN
      v_original_value := (v_sample ->> 'value')::NUMERIC;
      v_start_at := (v_sample ->> 'start_at')::TIMESTAMPTZ;
      v_end_at := COALESCE(NULLIF(v_sample ->> 'end_at', '')::TIMESTAMPTZ, v_start_at);
    EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN
      RAISE EXCEPTION 'INVALID_GLUCOSE_SAMPLE_VALUE';
    END;
    IF v_original_value IS NULL OR v_start_at IS NULL THEN
      RAISE EXCEPTION 'INVALID_GLUCOSE_SAMPLE_VALUE';
    END IF;
    v_value_mg_dl := CASE WHEN v_original_unit = 'mmol/L'
      THEN round(v_original_value * 18.0182, 4) ELSE v_original_value END;
    IF v_value_mg_dl NOT BETWEEN 20 AND 600 THEN RAISE EXCEPTION 'GLUCOSE_VALUE_OUT_OF_RANGE'; END IF;
    IF v_end_at < v_start_at OR v_start_at > clock_timestamp() + INTERVAL '5 minutes'
       OR v_start_at < clock_timestamp() - INTERVAL '31 days' THEN
      RAISE EXCEPTION 'GLUCOSE_SAMPLE_TIME_OUT_OF_RANGE';
    END IF;
    IF char_length(COALESCE(v_sample ->> 'dedupe_key', '')) NOT BETWEEN 8 AND 256
       OR char_length(COALESCE(v_sample ->> 'checksum', '')) NOT BETWEEN 8 AND 256
       OR char_length(COALESCE(v_sample ->> 'normalizer_version', '')) NOT BETWEEN 1 AND 80 THEN
      RAISE EXCEPTION 'INVALID_GLUCOSE_SAMPLE_PROVENANCE';
    END IF;

    INSERT INTO public.wearable_metric_samples (
      user_id, provider, metric_type, metric_date, start_at, end_at, value, unit,
      external_id, dedupe_key, checksum, source_app, device_id, sync_status, raw,
      synced_at, deleted_at, updated_at, sample_kind, original_value, original_unit,
      quality_flags, normalizer_version, source_record_version
    ) VALUES (
      v_actor, p_provider, 'blood_glucose', (v_start_at AT TIME ZONE 'UTC')::DATE,
      v_start_at, v_end_at, v_value_mg_dl, 'mg/dL', NULLIF(v_sample ->> 'external_id', ''),
      v_sample ->> 'dedupe_key', v_sample ->> 'checksum', NULLIF(v_sample ->> 'source_app', ''),
      NULLIF(v_sample ->> 'device_id', ''), 'synced', COALESCE(v_sample -> 'raw', '{}'::JSONB),
      clock_timestamp(), NULL, clock_timestamp(), 'instant', v_original_value,
      v_original_unit, COALESCE(ARRAY(SELECT jsonb_array_elements_text(
        COALESCE(v_sample -> 'quality_flags', '[]'::JSONB)
      )), '{}'::TEXT[]), v_sample ->> 'normalizer_version',
      NULLIF(v_sample ->> 'source_record_version', '')
    )
    ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
      provider = EXCLUDED.provider,
      metric_type = EXCLUDED.metric_type,
      metric_date = EXCLUDED.metric_date,
      start_at = EXCLUDED.start_at,
      end_at = EXCLUDED.end_at,
      value = EXCLUDED.value,
      unit = EXCLUDED.unit,
      external_id = EXCLUDED.external_id,
      checksum = EXCLUDED.checksum,
      source_app = EXCLUDED.source_app,
      device_id = EXCLUDED.device_id,
      sync_status = 'synced',
      raw = EXCLUDED.raw,
      synced_at = clock_timestamp(),
      deleted_at = NULL,
      updated_at = clock_timestamp(),
      sample_kind = EXCLUDED.sample_kind,
      original_value = EXCLUDED.original_value,
      original_unit = EXCLUDED.original_unit,
      quality_flags = EXCLUDED.quality_flags,
      normalizer_version = EXCLUDED.normalizer_version,
      source_record_version = EXCLUDED.source_record_version
    WHERE public.wearable_metric_samples.checksum IS DISTINCT FROM EXCLUDED.checksum
       OR public.wearable_metric_samples.deleted_at IS NOT NULL;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN v_unchanged := v_unchanged + 1;
    ELSE v_changed := v_changed + 1; END IF;
  END LOOP;

  v_result := jsonb_build_object(
    'ok', TRUE, 'sample_count', v_count, 'inserted_or_updated', v_changed,
    'unchanged', v_unchanged, 'provider', p_provider
  );
  INSERT INTO public.meal_response_glucose_ingest_batches (
    user_id, request_id, provider, sample_count, result
  ) VALUES (v_actor, p_request_id, p_provider, v_count, v_result);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_meal_response_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_meal_consumption_timing(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, SMALLINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_meal_response_check_in(UUID, UUID, SMALLINT, SMALLINT, SMALLINT, TEXT[], SMALLINT, TEXT[], TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_meal_response_insight_feedback(UUID, UUID, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_meal_response_dashboard()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_meal_response_ranking_input()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ingest_meal_response_glucose_samples(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_meal_response_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_meal_consumption_timing(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, SMALLINT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_meal_response_check_in(UUID, UUID, SMALLINT, SMALLINT, SMALLINT, TEXT[], SMALLINT, TEXT[], TIMESTAMPTZ)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_meal_response_insight_feedback(UUID, UUID, BOOLEAN, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_meal_response_dashboard()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_meal_response_ranking_input()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_meal_response_glucose_samples(UUID, TEXT, JSONB)
  TO authenticated;

COMMIT;
