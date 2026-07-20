BEGIN;

-- N-of-1 experiments are an opt-in wellness feature. Authenticated clients can
-- mutate experiments only through the SECURITY DEFINER functions below.
ALTER TABLE public.meal_response_experiments
  DROP CONSTRAINT IF EXISTS meal_response_experiments_arms_check,
  DROP CONSTRAINT IF EXISTS meal_response_experiments_minimum_repeats_per_arm_check,
  DROP CONSTRAINT IF EXISTS meal_response_experiments_randomization_method_check;

ALTER TABLE public.meal_response_experiments
  ADD CONSTRAINT meal_response_experiments_arms_check CHECK (
    jsonb_typeof(arms) = 'array' AND jsonb_array_length(arms) = 2
  ),
  ADD CONSTRAINT meal_response_experiments_minimum_repeats_per_arm_check CHECK (
    minimum_repeats_per_arm BETWEEN 3 AND 20
  ),
  ADD CONSTRAINT meal_response_experiments_randomization_method_check CHECK (
    randomization_method IN ('alternating', 'abba', 'baab')
  );

CREATE TABLE public.meal_response_experiment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'start', 'pause', 'cancel', 'link_consumption')),
  experiment_id UUID REFERENCES public.meal_response_experiments(id) ON DELETE CASCADE,
  result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT meal_response_experiment_requests_unique UNIQUE (user_id, request_id)
);

CREATE INDEX idx_meal_response_experiment_requests_experiment
  ON public.meal_response_experiment_requests (experiment_id, created_at DESC)
  WHERE experiment_id IS NOT NULL;

ALTER TABLE public.meal_response_experiment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_response_experiment_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.meal_response_experiment_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.meal_response_experiment_requests TO authenticated;
GRANT ALL ON TABLE public.meal_response_experiment_requests TO service_role;

CREATE POLICY meal_response_experiment_requests_owner_read
  ON public.meal_response_experiment_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.meal_response_experiments_are_available(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.health_context_preferences preferences
    WHERE preferences.user_id = p_user_id
      AND preferences.meal_response_enabled
  ) AND COALESCE((
    SELECT (settings.value ->> 'experiments_enabled')::BOOLEAN
    FROM public.platform_settings settings
    WHERE settings.key = 'meal-response-engine'
  ), FALSE);
$function$;

CREATE OR REPLACE FUNCTION public.assert_meal_response_experiment_arms(p_arms JSONB)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  v_arm JSONB;
  v_keys TEXT[] := '{}'::TEXT[];
  v_key TEXT;
BEGIN
  IF jsonb_typeof(p_arms) <> 'array' OR jsonb_array_length(p_arms) <> 2 THEN
    RAISE EXCEPTION 'EXACTLY_TWO_ARMS_REQUIRED';
  END IF;

  FOR v_arm IN SELECT value FROM jsonb_array_elements(p_arms)
  LOOP
    IF jsonb_typeof(v_arm) <> 'object' THEN RAISE EXCEPTION 'INVALID_EXPERIMENT_ARM'; END IF;
    v_key := btrim(COALESCE(v_arm ->> 'key', ''));
    IF char_length(v_key) NOT BETWEEN 1 AND 40
       OR char_length(btrim(COALESCE(v_arm ->> 'label', ''))) NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'INVALID_EXPERIMENT_ARM';
    END IF;
    IF v_key = ANY(v_keys) THEN RAISE EXCEPTION 'EXPERIMENT_ARM_KEYS_MUST_BE_UNIQUE'; END IF;
    v_keys := array_append(v_keys, v_key);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_meal_response_assignment_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_status TEXT;
BEGIN
  SELECT experiments.status INTO v_status
  FROM public.meal_response_experiments experiments
  WHERE experiments.id = CASE WHEN TG_OP = 'INSERT' THEN NEW.experiment_id ELSE OLD.experiment_id END;

  IF TG_OP = 'INSERT' AND v_status IN ('active', 'paused', 'completed') THEN
    RAISE EXCEPTION 'ACTIVE_EXPERIMENT_ASSIGNMENTS_ARE_IMMUTABLE';
  END IF;
  IF TG_OP = 'DELETE' AND v_status IN ('active', 'paused', 'completed') THEN
    RAISE EXCEPTION 'ACTIVE_EXPERIMENT_ASSIGNMENTS_ARE_IMMUTABLE';
  END IF;
  IF TG_OP = 'UPDATE' AND v_status IN ('active', 'paused', 'completed')
     AND (NEW.experiment_id, NEW.sequence_number, NEW.arm_key, NEW.user_id)
         IS DISTINCT FROM (OLD.experiment_id, OLD.sequence_number, OLD.arm_key, OLD.user_id) THEN
    RAISE EXCEPTION 'ACTIVE_EXPERIMENT_SEQUENCE_IS_IMMUTABLE';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS protect_meal_response_assignment_sequence
  ON public.meal_response_experiment_assignments;
CREATE TRIGGER protect_meal_response_assignment_sequence
  BEFORE INSERT OR UPDATE OR DELETE ON public.meal_response_experiment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.protect_meal_response_assignment_sequence();

CREATE OR REPLACE FUNCTION public.create_meal_response_experiment(
  p_request_id UUID,
  p_hypothesis TEXT,
  p_outcome_type TEXT,
  p_arms JSONB,
  p_minimum_repeats_per_arm SMALLINT DEFAULT 3,
  p_protocol_version TEXT DEFAULT 'n-of-1-v1'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_existing public.meal_response_experiment_requests%ROWTYPE;
  v_experiment public.meal_response_experiments%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0));

  SELECT requests.* INTO v_existing
  FROM public.meal_response_experiment_requests requests
  WHERE requests.user_id = v_actor AND requests.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action <> 'create' THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
    RETURN v_existing.result || jsonb_build_object('already_processed', TRUE);
  END IF;

  IF NOT public.meal_response_experiments_are_available(v_actor) THEN
    RAISE EXCEPTION 'MEAL_RESPONSE_EXPERIMENTS_NOT_AVAILABLE' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_meal_response_experiment_arms(p_arms);
  IF char_length(btrim(COALESCE(p_hypothesis, ''))) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'INVALID_HYPOTHESIS';
  END IF;
  IF p_outcome_type NOT IN ('glucose_peak_delta', 'glucose_positive_iauc', 'glucose_recovery_time') THEN
    RAISE EXCEPTION 'INVALID_EXPERIMENT_OUTCOME';
  END IF;
  IF p_minimum_repeats_per_arm NOT BETWEEN 3 AND 20 THEN RAISE EXCEPTION 'INVALID_REPEAT_COUNT'; END IF;
  IF char_length(btrim(COALESCE(p_protocol_version, ''))) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'INVALID_PROTOCOL_VERSION';
  END IF;

  INSERT INTO public.meal_response_experiments (
    user_id, hypothesis, outcome_type, arms, randomization_method,
    minimum_repeats_per_arm, protocol_version, status
  ) VALUES (
    v_actor, btrim(p_hypothesis), p_outcome_type, p_arms, 'alternating',
    p_minimum_repeats_per_arm, btrim(p_protocol_version), 'draft'
  ) RETURNING * INTO v_experiment;

  v_result := jsonb_build_object('experiment', to_jsonb(v_experiment), 'already_processed', FALSE);
  INSERT INTO public.meal_response_experiment_requests
    (user_id, request_id, action, experiment_id, result)
  VALUES (v_actor, p_request_id, 'create', v_experiment.id, v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_meal_response_experiment(
  p_experiment_id UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_existing public.meal_response_experiment_requests%ROWTYPE;
  v_experiment public.meal_response_experiments%ROWTYPE;
  v_first_key TEXT;
  v_second_key TEXT;
  v_result JSONB;
  v_index INTEGER;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0));

  SELECT requests.* INTO v_existing FROM public.meal_response_experiment_requests requests
  WHERE requests.user_id = v_actor AND requests.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action <> 'start' OR v_existing.experiment_id <> p_experiment_id THEN
      RAISE EXCEPTION 'REQUEST_ID_REUSED';
    END IF;
    RETURN v_existing.result || jsonb_build_object('already_processed', TRUE);
  END IF;
  IF NOT public.meal_response_experiments_are_available(v_actor) THEN
    RAISE EXCEPTION 'MEAL_RESPONSE_EXPERIMENTS_NOT_AVAILABLE' USING ERRCODE = '42501';
  END IF;

  SELECT experiments.* INTO v_experiment
  FROM public.meal_response_experiments experiments
  WHERE experiments.id = p_experiment_id AND experiments.user_id = v_actor
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_experiment.status NOT IN ('draft', 'paused', 'active') THEN RAISE EXCEPTION 'EXPERIMENT_CANNOT_START'; END IF;

  IF v_experiment.status = 'draft' THEN
    IF EXISTS (SELECT 1 FROM public.meal_response_experiment_assignments a WHERE a.experiment_id = v_experiment.id) THEN
      RAISE EXCEPTION 'DRAFT_ASSIGNMENTS_ALREADY_EXIST';
    END IF;
    -- gen_random_uuid is backed by PostgreSQL's cryptographic random source.
    IF get_byte(uuid_send(gen_random_uuid()), 0) % 2 = 0 THEN
      v_first_key := v_experiment.arms -> 0 ->> 'key';
      v_second_key := v_experiment.arms -> 1 ->> 'key';
    ELSE
      v_first_key := v_experiment.arms -> 1 ->> 'key';
      v_second_key := v_experiment.arms -> 0 ->> 'key';
    END IF;
    FOR v_index IN 1..(v_experiment.minimum_repeats_per_arm * 2)
    LOOP
      INSERT INTO public.meal_response_experiment_assignments (
        user_id, experiment_id, sequence_number, arm_key
      ) VALUES (
        v_actor, v_experiment.id, v_index,
        CASE WHEN v_index % 2 = 1 THEN v_first_key ELSE v_second_key END
      );
    END LOOP;
  END IF;

  UPDATE public.meal_response_experiments
  SET status = 'active', started_at = COALESCE(started_at, clock_timestamp()), updated_at = clock_timestamp()
  WHERE id = v_experiment.id RETURNING * INTO v_experiment;
  v_result := jsonb_build_object('experiment', to_jsonb(v_experiment), 'already_processed', FALSE);
  INSERT INTO public.meal_response_experiment_requests
    (user_id, request_id, action, experiment_id, result)
  VALUES (v_actor, p_request_id, 'start', v_experiment.id, v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pause_meal_response_experiment(p_experiment_id UUID, p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_existing public.meal_response_experiment_requests%ROWTYPE;
  v_experiment public.meal_response_experiments%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0));
  SELECT * INTO v_existing FROM public.meal_response_experiment_requests r
    WHERE r.user_id = v_actor AND r.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action <> 'pause' OR v_existing.experiment_id <> p_experiment_id THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
    RETURN v_existing.result || jsonb_build_object('already_processed', TRUE);
  END IF;
  SELECT * INTO v_experiment FROM public.meal_response_experiments e
    WHERE e.id = p_experiment_id AND e.user_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_experiment.status NOT IN ('active', 'paused') THEN RAISE EXCEPTION 'EXPERIMENT_CANNOT_PAUSE'; END IF;
  UPDATE public.meal_response_experiments SET status = 'paused', updated_at = clock_timestamp()
    WHERE id = v_experiment.id RETURNING * INTO v_experiment;
  v_result := jsonb_build_object('experiment', to_jsonb(v_experiment), 'already_processed', FALSE);
  INSERT INTO public.meal_response_experiment_requests (user_id, request_id, action, experiment_id, result)
    VALUES (v_actor, p_request_id, 'pause', v_experiment.id, v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_meal_response_experiment(p_experiment_id UUID, p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_existing public.meal_response_experiment_requests%ROWTYPE;
  v_experiment public.meal_response_experiments%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0));
  SELECT * INTO v_existing FROM public.meal_response_experiment_requests r
    WHERE r.user_id = v_actor AND r.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action <> 'cancel' OR v_existing.experiment_id <> p_experiment_id THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
    RETURN v_existing.result || jsonb_build_object('already_processed', TRUE);
  END IF;
  SELECT * INTO v_experiment FROM public.meal_response_experiments e
    WHERE e.id = p_experiment_id AND e.user_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_experiment.status = 'completed' THEN RAISE EXCEPTION 'COMPLETED_EXPERIMENT_CANNOT_BE_CANCELLED'; END IF;
  UPDATE public.meal_response_experiments SET status = 'cancelled', completed_at = clock_timestamp(), updated_at = clock_timestamp()
    WHERE id = v_experiment.id RETURNING * INTO v_experiment;
  v_result := jsonb_build_object('experiment', to_jsonb(v_experiment), 'already_processed', FALSE);
  INSERT INTO public.meal_response_experiment_requests (user_id, request_id, action, experiment_id, result)
    VALUES (v_actor, p_request_id, 'cancel', v_experiment.id, v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_meal_response_experiment_consumption(
  p_experiment_id UUID, p_assignment_id UUID, p_consumption_id UUID, p_request_id UUID
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_existing public.meal_response_experiment_requests%ROWTYPE;
  v_experiment public.meal_response_experiments%ROWTYPE;
  v_assignment public.meal_response_experiment_assignments%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'REQUEST_ID_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::TEXT || ':' || p_request_id::TEXT, 0));
  SELECT * INTO v_existing FROM public.meal_response_experiment_requests r
    WHERE r.user_id = v_actor AND r.request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.action <> 'link_consumption' OR v_existing.experiment_id <> p_experiment_id THEN RAISE EXCEPTION 'REQUEST_ID_REUSED'; END IF;
    RETURN v_existing.result || jsonb_build_object('already_processed', TRUE);
  END IF;
  IF NOT public.meal_response_experiments_are_available(v_actor) THEN
    RAISE EXCEPTION 'MEAL_RESPONSE_EXPERIMENTS_NOT_AVAILABLE' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_experiment FROM public.meal_response_experiments e
    WHERE e.id = p_experiment_id AND e.user_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_experiment.status <> 'active' THEN RAISE EXCEPTION 'EXPERIMENT_NOT_ACTIVE'; END IF;
  SELECT * INTO v_assignment FROM public.meal_response_experiment_assignments a
    WHERE a.id = p_assignment_id AND a.experiment_id = p_experiment_id AND a.user_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_assignment.consumed_consumption_id IS NOT NULL THEN RAISE EXCEPTION 'ASSIGNMENT_ALREADY_COMPLETED'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.meal_response_experiment_assignments previous
    WHERE previous.experiment_id = p_experiment_id
      AND previous.sequence_number < v_assignment.sequence_number
      AND previous.consumed_consumption_id IS NULL
  ) THEN RAISE EXCEPTION 'ASSIGNMENTS_MUST_BE_COMPLETED_IN_SEQUENCE'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.meal_consumptions consumptions
    WHERE consumptions.id = p_consumption_id AND consumptions.user_id = v_actor
      AND consumptions.status IN ('full', 'partial', 'substituted')
      AND consumptions.started_consuming_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'COMPLETED_CANONICAL_CONSUMPTION_REQUIRED'; END IF;

  UPDATE public.meal_response_experiment_assignments
  SET consumed_consumption_id = p_consumption_id, completed_at = clock_timestamp()
  WHERE id = v_assignment.id RETURNING * INTO v_assignment;

  IF NOT EXISTS (
    SELECT 1 FROM public.meal_response_experiment_assignments remaining
    WHERE remaining.experiment_id = p_experiment_id AND remaining.completed_at IS NULL
  ) THEN
    UPDATE public.meal_response_experiments
    SET status = 'completed', completed_at = clock_timestamp(), updated_at = clock_timestamp()
    WHERE id = p_experiment_id RETURNING * INTO v_experiment;
  END IF;
  v_result := jsonb_build_object(
    'assignment', to_jsonb(v_assignment), 'experiment', to_jsonb(v_experiment), 'already_processed', FALSE
  );
  INSERT INTO public.meal_response_experiment_requests (user_id, request_id, action, experiment_id, result)
    VALUES (v_actor, p_request_id, 'link_consumption', p_experiment_id, v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_meal_response_experiment(p_experiment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_experiment public.meal_response_experiments%ROWTYPE;
  v_summary JSONB;
  v_arm_zero_repeats INTEGER := 0;
  v_arm_one_repeats INTEGER := 0;
  v_arm_zero_days INTEGER := 0;
  v_arm_one_days INTEGER := 0;
  v_causal_allowed BOOLEAN := FALSE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_experiment FROM public.meal_response_experiments e
    WHERE e.id = p_experiment_id AND e.user_id = v_actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'EXPERIMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  WITH eligible AS (
    SELECT assignments.arm_key, assignments.sequence_number, assignments.completed_at,
      episodes.id AS episode_id, episodes.response_start_at,
      CASE v_experiment.outcome_type
        WHEN 'glucose_peak_delta' THEN (episodes.outcomes ->> 'peak_delta_mg_dl')::NUMERIC
        WHEN 'glucose_positive_iauc' THEN (episodes.outcomes ->> 'positive_iauc_mg_dl_min')::NUMERIC
        WHEN 'glucose_recovery_time' THEN (episodes.outcomes ->> 'recovery_minutes')::NUMERIC
      END AS outcome_value
    FROM public.meal_response_experiment_assignments assignments
    JOIN LATERAL (
      SELECT candidate.*
      FROM public.meal_response_episodes candidate
      WHERE candidate.consumption_id = assignments.consumed_consumption_id
        AND candidate.user_id = v_actor
        AND candidate.eligibility = 'eligible'
        AND candidate.superseded_at IS NULL
      ORDER BY candidate.built_at DESC
      LIMIT 1
    ) episodes ON TRUE
    WHERE assignments.experiment_id = v_experiment.id
  ), arm_stats AS (
    SELECT arm.value ->> 'key' AS arm_key, arm.value ->> 'label' AS label,
      count(eligible.episode_id) FILTER (WHERE eligible.outcome_value IS NOT NULL)::INTEGER AS eligible_repeats,
      count(DISTINCT eligible.response_start_at::DATE) FILTER (WHERE eligible.outcome_value IS NOT NULL)::INTEGER AS distinct_days,
      avg(eligible.outcome_value) AS mean,
      min(eligible.outcome_value) AS minimum,
      max(eligible.outcome_value) AS maximum
    FROM jsonb_array_elements(v_experiment.arms) WITH ORDINALITY arm(value, ordinal)
    LEFT JOIN eligible ON eligible.arm_key = arm.value ->> 'key'
    GROUP BY arm.ordinal, arm.value
    ORDER BY arm.ordinal
  )
  SELECT jsonb_agg(to_jsonb(arm_stats)),
    COALESCE(max(eligible_repeats) FILTER (WHERE arm_key = v_experiment.arms -> 0 ->> 'key'), 0),
    COALESCE(max(eligible_repeats) FILTER (WHERE arm_key = v_experiment.arms -> 1 ->> 'key'), 0),
    COALESCE(max(distinct_days) FILTER (WHERE arm_key = v_experiment.arms -> 0 ->> 'key'), 0),
    COALESCE(max(distinct_days) FILTER (WHERE arm_key = v_experiment.arms -> 1 ->> 'key'), 0)
  INTO v_summary, v_arm_zero_repeats, v_arm_one_repeats, v_arm_zero_days, v_arm_one_days
  FROM arm_stats;

  v_causal_allowed := v_arm_zero_repeats >= GREATEST(3, v_experiment.minimum_repeats_per_arm)
    AND v_arm_one_repeats >= GREATEST(3, v_experiment.minimum_repeats_per_arm)
    AND v_arm_zero_days >= GREATEST(3, v_experiment.minimum_repeats_per_arm)
    AND v_arm_one_days >= GREATEST(3, v_experiment.minimum_repeats_per_arm)
    AND abs(v_arm_zero_repeats - v_arm_one_repeats) <= 1
    AND abs(v_arm_zero_days - v_arm_one_days) <= 1;

  RETURN jsonb_build_object(
    'experiment', to_jsonb(v_experiment),
    'assignments', COALESCE((
      SELECT jsonb_agg(to_jsonb(a) ORDER BY a.sequence_number)
      FROM public.meal_response_experiment_assignments a WHERE a.experiment_id = v_experiment.id
    ), '[]'::JSONB),
    'arm_summaries', COALESCE(v_summary, '[]'::JSONB),
    'causal_language_allowed', v_causal_allowed,
    'causal_abstention_reason', CASE
      WHEN v_causal_allowed THEN NULL
      WHEN LEAST(v_arm_zero_days, v_arm_one_days) < GREATEST(3, v_experiment.minimum_repeats_per_arm)
        THEN 'INSUFFICIENT_ELIGIBLE_DISTINCT_DAY_REPEATS'
      ELSE 'SEVERE_ARM_IMBALANCE'
    END,
    'claim_scope', CASE WHEN v_causal_allowed THEN 'personal_n_of_1_association' ELSE 'descriptive_only' END
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.meal_response_experiments_are_available(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_meal_response_experiment_arms(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_meal_response_assignment_sequence() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_meal_response_experiment(UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_meal_response_experiment(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pause_meal_response_experiment(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_meal_response_experiment(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_meal_response_experiment_consumption(UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_meal_response_experiment(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_meal_response_experiment(UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_meal_response_experiment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_meal_response_experiment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_meal_response_experiment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_meal_response_experiment_consumption(UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_meal_response_experiment(UUID) TO authenticated;

COMMIT;
