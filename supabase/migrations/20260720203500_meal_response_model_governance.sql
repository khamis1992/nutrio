-- Meal-response pilot model governance and privacy-preserving operations metrics.

CREATE TABLE IF NOT EXISTS public.meal_response_model_governance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('register', 'promote', 'retire', 'rollback')),
  model_id UUID NOT NULL REFERENCES public.meal_response_model_registry(id) ON DELETE RESTRICT,
  previous_model_id UUID REFERENCES public.meal_response_model_registry(id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_meal_response_model_governance_audit_model_time
  ON public.meal_response_model_governance_audit (model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_model_governance_audit_actor_time
  ON public.meal_response_model_governance_audit (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_response_model_governance_audit_previous_model
  ON public.meal_response_model_governance_audit (previous_model_id)
  WHERE previous_model_id IS NOT NULL;

-- Prevent ambiguous serving configuration while still allowing independent outcomes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_response_model_champion
  ON public.meal_response_model_registry (model_name, outcome_type)
  WHERE status = 'champion';
CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_response_model_challenger
  ON public.meal_response_model_registry (model_name, outcome_type)
  WHERE status = 'challenger';

ALTER TABLE public.meal_response_model_governance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_response_model_governance_audit FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.meal_response_model_governance_audit FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meal_response_model_governance_audit TO service_role;

-- The registry remains inaccessible to end users. The backend service may operate it directly.
REVOKE ALL ON public.meal_response_model_registry FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meal_response_model_registry TO service_role;

CREATE OR REPLACE FUNCTION public.require_meal_response_model_admin_aal2()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_aal TEXT := COALESCE(auth.jwt() ->> 'aal', '');
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  IF v_aal <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 authentication required' USING ERRCODE = '42501';
  END IF;

  RETURN v_actor;
END;
$function$;

REVOKE ALL ON FUNCTION public.require_meal_response_model_admin_aal2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.require_meal_response_model_admin_aal2() TO service_role;

CREATE OR REPLACE FUNCTION public.admin_register_meal_response_model_candidate(
  p_model_name TEXT,
  p_model_version TEXT,
  p_outcome_type TEXT,
  p_artifact_uri TEXT,
  p_artifact_sha256 TEXT,
  p_feature_schema_version TEXT,
  p_training_cutoff_at TIMESTAMPTZ,
  p_aggregate_metrics JSONB,
  p_subgroup_metrics JSONB DEFAULT '{}'::JSONB,
  p_reason TEXT DEFAULT 'Register validated pilot candidate'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID;
  v_model_id UUID;
BEGIN
  v_actor := public.require_meal_response_model_admin_aal2();

  IF char_length(btrim(COALESCE(p_model_name, ''))) NOT BETWEEN 1 AND 120
     OR char_length(btrim(COALESCE(p_model_version, ''))) NOT BETWEEN 1 AND 120
     OR char_length(btrim(COALESCE(p_outcome_type, ''))) NOT BETWEEN 1 AND 120
     OR char_length(btrim(COALESCE(p_feature_schema_version, ''))) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Model identity and feature schema are required';
  END IF;
  IF p_training_cutoff_at IS NULL OR p_training_cutoff_at > clock_timestamp() THEN
    RAISE EXCEPTION 'Training cutoff must be present and not in the future';
  END IF;
  IF p_artifact_uri !~ '^(https://|s3://|gs://|azure://)[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Artifact URI must use an approved immutable store URI';
  END IF;
  IF lower(COALESCE(p_artifact_sha256, '')) !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Artifact checksum must be a SHA-256 hex digest';
  END IF;
  IF jsonb_typeof(p_aggregate_metrics) <> 'object' OR p_aggregate_metrics = '{}'::JSONB
     OR jsonb_typeof(COALESCE(p_subgroup_metrics, '{}'::JSONB)) <> 'object' THEN
    RAISE EXCEPTION 'Aggregate metrics must be a non-empty object and subgroup metrics an object';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'A governance reason between 3 and 500 characters is required';
  END IF;

  INSERT INTO public.meal_response_model_registry (
    model_name, model_version, outcome_type, feature_schema_version,
    training_cutoff_at, metrics, subgroup_metrics, artifact_path,
    artifact_checksum, status
  ) VALUES (
    btrim(p_model_name), btrim(p_model_version), btrim(p_outcome_type),
    btrim(p_feature_schema_version), p_training_cutoff_at, p_aggregate_metrics,
    COALESCE(p_subgroup_metrics, '{}'::JSONB), p_artifact_uri,
    lower(p_artifact_sha256), 'validated'
  )
  RETURNING id INTO v_model_id;

  INSERT INTO public.meal_response_model_governance_audit (
    actor_id, action, model_id, from_status, to_status, reason,
    metadata
  ) VALUES (
    v_actor, 'register', v_model_id, NULL, 'validated', btrim(p_reason),
    jsonb_build_object(
      'feature_schema_version', p_feature_schema_version,
      'training_cutoff_at', p_training_cutoff_at,
      'artifact_sha256', lower(p_artifact_sha256)
    )
  );

  RETURN v_model_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_promote_meal_response_model(
  p_model_id UUID,
  p_target_status TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID;
  v_target public.meal_response_model_registry%ROWTYPE;
  v_previous public.meal_response_model_registry%ROWTYPE;
BEGIN
  v_actor := public.require_meal_response_model_admin_aal2();
  IF p_target_status NOT IN ('challenger', 'champion') THEN
    RAISE EXCEPTION 'Target status must be challenger or champion';
  END IF;
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'A governance reason between 3 and 500 characters is required';
  END IF;

  SELECT * INTO v_target
  FROM public.meal_response_model_registry
  WHERE id = p_model_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Model not found'; END IF;
  IF v_target.status NOT IN ('validated', 'challenger') THEN
    RAISE EXCEPTION 'Only validated or challenger models can be promoted';
  END IF;

  SELECT * INTO v_previous
  FROM public.meal_response_model_registry
  WHERE model_name = v_target.model_name
    AND outcome_type = v_target.outcome_type
    AND status = p_target_status
    AND id <> v_target.id
  FOR UPDATE;

  IF p_target_status = 'challenger' THEN
    IF v_previous.id IS NOT NULL THEN
      UPDATE public.meal_response_model_registry SET status = 'validated'
      WHERE id = v_previous.id;
    END IF;
    UPDATE public.meal_response_model_registry
    SET status = 'challenger', activated_at = NULL, retired_at = NULL
    WHERE id = v_target.id;
  ELSE
    IF v_previous.id IS NOT NULL THEN
      UPDATE public.meal_response_model_registry
      SET status = 'retired', retired_at = clock_timestamp()
      WHERE id = v_previous.id;
    END IF;
    UPDATE public.meal_response_model_registry
    SET status = 'champion', activated_at = clock_timestamp(), retired_at = NULL,
        rollback_model_id = v_previous.id
    WHERE id = v_target.id;
  END IF;

  INSERT INTO public.meal_response_model_governance_audit (
    actor_id, action, model_id, previous_model_id, from_status, to_status, reason
  ) VALUES (
    v_actor, 'promote', v_target.id, v_previous.id, v_target.status,
    p_target_status, btrim(p_reason)
  );

  RETURN jsonb_build_object(
    'model_id', v_target.id,
    'status', p_target_status,
    'previous_model_id', v_previous.id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_retire_meal_response_model(
  p_model_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID;
  v_target public.meal_response_model_registry%ROWTYPE;
BEGIN
  v_actor := public.require_meal_response_model_admin_aal2();
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'A governance reason between 3 and 500 characters is required';
  END IF;
  SELECT * INTO v_target FROM public.meal_response_model_registry
  WHERE id = p_model_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Model not found'; END IF;
  IF v_target.status = 'champion' THEN
    RAISE EXCEPTION 'Promote a replacement or use rollback before retiring a champion';
  END IF;
  IF v_target.status IN ('retired', 'rolled_back') THEN
    RAISE EXCEPTION 'Model is already inactive';
  END IF;

  UPDATE public.meal_response_model_registry
  SET status = 'retired', retired_at = clock_timestamp()
  WHERE id = v_target.id;
  INSERT INTO public.meal_response_model_governance_audit (
    actor_id, action, model_id, from_status, to_status, reason
  ) VALUES (v_actor, 'retire', v_target.id, v_target.status, 'retired', btrim(p_reason));
  RETURN jsonb_build_object('model_id', v_target.id, 'status', 'retired');
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_rollback_meal_response_model(
  p_champion_model_id UUID,
  p_rollback_model_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Rollback after pilot monitoring review'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID;
  v_current public.meal_response_model_registry%ROWTYPE;
  v_restore public.meal_response_model_registry%ROWTYPE;
  v_restore_id UUID;
BEGIN
  v_actor := public.require_meal_response_model_admin_aal2();
  IF char_length(btrim(COALESCE(p_reason, ''))) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'A governance reason between 3 and 500 characters is required';
  END IF;

  SELECT * INTO v_current FROM public.meal_response_model_registry
  WHERE id = p_champion_model_id FOR UPDATE;
  IF NOT FOUND OR v_current.status <> 'champion' THEN
    RAISE EXCEPTION 'Current champion model not found';
  END IF;
  v_restore_id := COALESCE(p_rollback_model_id, v_current.rollback_model_id);
  IF v_restore_id IS NULL OR v_restore_id = v_current.id THEN
    RAISE EXCEPTION 'A distinct rollback target is required';
  END IF;
  SELECT * INTO v_restore FROM public.meal_response_model_registry
  WHERE id = v_restore_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rollback target not found'; END IF;
  IF v_restore.model_name <> v_current.model_name
     OR v_restore.outcome_type <> v_current.outcome_type
     OR v_restore.status NOT IN ('retired', 'rolled_back', 'validated') THEN
    RAISE EXCEPTION 'Rollback target is incompatible or not eligible';
  END IF;

  UPDATE public.meal_response_model_registry
  SET status = 'rolled_back', retired_at = clock_timestamp()
  WHERE id = v_current.id;
  UPDATE public.meal_response_model_registry
  SET status = 'champion', activated_at = clock_timestamp(), retired_at = NULL,
      rollback_model_id = v_current.id
  WHERE id = v_restore.id;

  INSERT INTO public.meal_response_model_governance_audit (
    actor_id, action, model_id, previous_model_id, from_status, to_status, reason,
    metadata
  ) VALUES (
    v_actor, 'rollback', v_restore.id, v_current.id, v_restore.status, 'champion',
    btrim(p_reason), jsonb_build_object('rolled_back_model_id', v_current.id)
  );
  RETURN jsonb_build_object(
    'champion_model_id', v_restore.id,
    'rolled_back_model_id', v_current.id,
    'status', 'champion'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_get_meal_response_operations(
  p_window_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID;
  v_since TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  v_actor := public.require_meal_response_model_admin_aal2();
  IF p_window_days NOT BETWEEN 1 AND 365 THEN
    RAISE EXCEPTION 'Window must be between 1 and 365 days';
  END IF;
  v_since := clock_timestamp() - make_interval(days => p_window_days);

  SELECT jsonb_build_object(
    'window_days', p_window_days,
    'generated_at', clock_timestamp(),
    'sync', jsonb_build_object(
      'source_count', COUNT(*) FILTER (WHERE s.status <> 'revoked'),
      'lag_seconds_avg', ROUND(AVG(COALESCE(
        s.observed_sync_lag_seconds,
        EXTRACT(EPOCH FROM (clock_timestamp() - s.last_success_at))::INTEGER
      ))) FILTER (WHERE s.status <> 'revoked' AND s.last_success_at IS NOT NULL),
      'lag_seconds_p95', percentile_disc(0.95) WITHIN GROUP (
        ORDER BY COALESCE(s.observed_sync_lag_seconds,
          EXTRACT(EPOCH FROM (clock_timestamp() - s.last_success_at))::INTEGER)
      ) FILTER (WHERE s.status <> 'revoked' AND s.last_success_at IS NOT NULL)
    )
  ) INTO v_result
  FROM public.wearable_sync_sources s;

  v_result := v_result || jsonb_build_object(
    'episodes', COALESCE((
      SELECT jsonb_build_object(
        'total', COALESCE(SUM(x.count), 0),
        'eligibility', COALESCE(jsonb_object_agg(x.eligibility, x.count), '{}'::JSONB),
        'exclusion_rate', COALESCE(ROUND(
          COALESCE(SUM(x.count) FILTER (WHERE x.eligibility = 'excluded'), 0)::NUMERIC
          / NULLIF(SUM(x.count), 0), 4
        ), 0)
      )
      FROM (
        SELECT eligibility, COUNT(*)::INTEGER AS count
        FROM public.meal_response_episodes
        WHERE built_at >= v_since
        GROUP BY eligibility
      ) x
    ), jsonb_build_object('total', 0, 'eligibility', '{}'::JSONB, 'exclusion_rate', 0)),
    'evidence', COALESCE((
      SELECT jsonb_build_object(
        'total', SUM(x.count),
        'distribution', jsonb_object_agg(x.evidence_tier, x.count),
        'abstention_rate', COALESCE(ROUND(
          SUM(x.abstention_count)::NUMERIC
          / NULLIF(SUM(x.count), 0), 4
        ), 0),
        'abstention_count', SUM(x.abstention_count)
      )
      FROM (
        SELECT evidence_tier, COUNT(*)::INTEGER AS count,
          COUNT(*) FILTER (WHERE abstention_reason IS NOT NULL)::INTEGER AS abstention_count
        FROM public.meal_response_estimates
        WHERE published_at >= v_since
        GROUP BY evidence_tier
      ) x
    ), jsonb_build_object('total', 0, 'distribution', '{}'::JSONB,
      'abstention_rate', 0, 'abstention_count', 0)),
    'feedback', COALESCE((
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'useful', jsonb_build_object(
          'yes', COUNT(*) FILTER (WHERE useful IS TRUE),
          'no', COUNT(*) FILTER (WHERE useful IS FALSE)
        ),
        'accuracy', jsonb_build_object(
          'accurate', COUNT(*) FILTER (WHERE accuracy_feedback = 'accurate'),
          'not_accurate', COUNT(*) FILTER (WHERE accuracy_feedback = 'not_accurate'),
          'unsure', COUNT(*) FILTER (WHERE accuracy_feedback = 'unsure')
        )
      )
      FROM public.meal_response_insight_feedback
      WHERE created_at >= v_since
    ), jsonb_build_object('total', 0))
  );

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_register_meal_response_model_candidate(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, JSONB, TEXT
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_promote_meal_response_model(UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_retire_meal_response_model(UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_rollback_meal_response_model(UUID, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_meal_response_operations(INTEGER)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_register_meal_response_model_candidate(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB, JSONB, TEXT
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_promote_meal_response_model(UUID, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_retire_meal_response_model(UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_rollback_meal_response_model(UUID, UUID, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_meal_response_operations(INTEGER)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.admin_get_meal_response_operations(INTEGER) IS
  'AAL2 admin-only aggregate pilot monitoring. Returns no user identifiers or raw health samples.';
