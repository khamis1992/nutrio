BEGIN;

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'phase1-health-context',
  '{"enabled": false, "rollout_percent": 0}'::JSONB,
  'Optional private health journal and manually logged cycle context'
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.health_context_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  cycle_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  recommendation_context_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mood_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  stress_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  appetite_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  energy_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  digestive_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  note_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT health_context_cycle_requires_journal
    CHECK (NOT cycle_tracking_enabled OR journal_enabled),
  CONSTRAINT health_context_recommendations_require_journal
    CHECK (NOT recommendation_context_enabled OR journal_enabled)
);

CREATE TABLE IF NOT EXISTS public.health_context_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  mood SMALLINT CHECK (mood BETWEEN 1 AND 5),
  stress SMALLINT CHECK (stress BETWEEN 1 AND 5),
  appetite SMALLINT CHECK (appetite BETWEEN 1 AND 5),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
  digestive_symptoms TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  symptom_severity SMALLINT CHECK (symptom_severity BETWEEN 0 AND 4),
  cycle_phase TEXT CHECK (
    cycle_phase IS NULL OR cycle_phase IN ('menstrual', 'follicular', 'ovulatory', 'luteal')
  ),
  bleeding_flow TEXT CHECK (
    bleeding_flow IS NULL OR bleeding_flow IN ('none', 'spotting', 'light', 'medium', 'heavy')
  ),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 800),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT health_context_entry_user_date_unique UNIQUE (user_id, entry_date),
  CONSTRAINT health_context_digestive_symptoms_allowed CHECK (
    cardinality(digestive_symptoms) <= 6
    AND digestive_symptoms <@ ARRAY[
      'bloating', 'reflux', 'constipation', 'diarrhea', 'nausea', 'discomfort'
    ]::TEXT[]
  ),
  CONSTRAINT health_context_entry_has_value CHECK (
    mood IS NOT NULL OR stress IS NOT NULL OR appetite IS NOT NULL OR energy IS NOT NULL
    OR cardinality(digestive_symptoms) > 0 OR symptom_severity IS NOT NULL
    OR cycle_phase IS NOT NULL OR bleeding_flow IS NOT NULL OR NULLIF(trim(note), '') IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS health_context_entries_user_date_idx
  ON public.health_context_entries (user_id, entry_date DESC);

CREATE TABLE IF NOT EXISTS public.health_context_consent_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('granted', 'revoked', 'dataset_deleted')),
  policy_version TEXT NOT NULL CHECK (char_length(policy_version) BETWEEN 3 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.health_context_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_context_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.health_context_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_context_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.health_context_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_context_consent_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.health_context_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.health_context_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.health_context_consent_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.health_context_preferences TO authenticated;
GRANT SELECT ON TABLE public.health_context_entries TO authenticated;
GRANT ALL ON TABLE public.health_context_preferences TO service_role;
GRANT ALL ON TABLE public.health_context_entries TO service_role;
GRANT ALL ON TABLE public.health_context_consent_events TO service_role;

DROP POLICY IF EXISTS health_context_preferences_owner_read ON public.health_context_preferences;
CREATE POLICY health_context_preferences_owner_read
  ON public.health_context_preferences FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS health_context_entries_owner_read ON public.health_context_entries;
CREATE POLICY health_context_entries_owner_read
  ON public.health_context_entries FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.ai_data_consents
  DROP CONSTRAINT IF EXISTS ai_data_consent_purpose_allowed;
ALTER TABLE public.ai_data_consents
  ADD CONSTRAINT ai_data_consent_purpose_allowed CHECK (
    purpose IN ('blood_work_analysis', 'nutrition_coaching', 'health_context_summary')
  );

CREATE OR REPLACE FUNCTION public.health_context_feature_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE((
    SELECT settings.value ->> 'enabled' = 'true'
    FROM public.platform_settings settings
    WHERE settings.key = 'phase1-health-context'
  ), FALSE);
$function$;

CREATE OR REPLACE FUNCTION public.set_health_context_preferences(
  p_journal_enabled BOOLEAN,
  p_cycle_tracking_enabled BOOLEAN DEFAULT FALSE,
  p_recommendation_context_enabled BOOLEAN DEFAULT FALSE,
  p_mood_enabled BOOLEAN DEFAULT TRUE,
  p_stress_enabled BOOLEAN DEFAULT TRUE,
  p_appetite_enabled BOOLEAN DEFAULT TRUE,
  p_energy_enabled BOOLEAN DEFAULT TRUE,
  p_digestive_enabled BOOLEAN DEFAULT TRUE,
  p_note_enabled BOOLEAN DEFAULT TRUE
)
RETURNS public.health_context_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_preferences public.health_context_preferences%ROWTYPE;
  v_consent_revoked BOOLEAN := FALSE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.health_context_feature_enabled() THEN RAISE EXCEPTION 'HEALTH_CONTEXT_DISABLED'; END IF;

  INSERT INTO public.health_context_preferences (
    user_id, journal_enabled, cycle_tracking_enabled, recommendation_context_enabled,
    mood_enabled, stress_enabled, appetite_enabled, energy_enabled, digestive_enabled,
    note_enabled, updated_at
  ) VALUES (
    v_actor,
    p_journal_enabled,
    p_journal_enabled AND p_cycle_tracking_enabled,
    p_journal_enabled AND p_recommendation_context_enabled,
    p_mood_enabled, p_stress_enabled, p_appetite_enabled, p_energy_enabled,
    p_digestive_enabled, p_note_enabled, clock_timestamp()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    journal_enabled = EXCLUDED.journal_enabled,
    cycle_tracking_enabled = EXCLUDED.cycle_tracking_enabled,
    recommendation_context_enabled = EXCLUDED.recommendation_context_enabled,
    mood_enabled = EXCLUDED.mood_enabled,
    stress_enabled = EXCLUDED.stress_enabled,
    appetite_enabled = EXCLUDED.appetite_enabled,
    energy_enabled = EXCLUDED.energy_enabled,
    digestive_enabled = EXCLUDED.digestive_enabled,
    note_enabled = EXCLUDED.note_enabled,
    updated_at = clock_timestamp()
  RETURNING * INTO v_preferences;

  IF NOT p_journal_enabled THEN
    UPDATE public.ai_data_consents
    SET status = 'revoked', revoked_at = clock_timestamp(), updated_at = clock_timestamp()
    WHERE user_id = v_actor AND purpose = 'health_context_summary' AND status = 'granted';
    v_consent_revoked := FOUND;
    IF v_consent_revoked THEN
      INSERT INTO public.health_context_consent_events (user_id, event_type, policy_version)
      VALUES (v_actor, 'revoked', '2026-07-health-context-ai-v1');
    END IF;
  END IF;

  RETURN v_preferences;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_health_context_entry(
  p_entry_date DATE,
  p_mood SMALLINT DEFAULT NULL,
  p_stress SMALLINT DEFAULT NULL,
  p_appetite SMALLINT DEFAULT NULL,
  p_energy SMALLINT DEFAULT NULL,
  p_digestive_symptoms TEXT[] DEFAULT '{}'::TEXT[],
  p_symptom_severity SMALLINT DEFAULT NULL,
  p_cycle_phase TEXT DEFAULT NULL,
  p_bleeding_flow TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS public.health_context_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_preferences public.health_context_preferences%ROWTYPE;
  v_entry public.health_context_entries%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.health_context_feature_enabled() THEN RAISE EXCEPTION 'HEALTH_CONTEXT_DISABLED'; END IF;
  IF p_entry_date IS NULL OR p_entry_date > CURRENT_DATE + 1 OR p_entry_date < CURRENT_DATE - 730 THEN
    RAISE EXCEPTION 'INVALID_HEALTH_CONTEXT_DATE';
  END IF;

  SELECT * INTO v_preferences
  FROM public.health_context_preferences
  WHERE user_id = v_actor;
  IF NOT FOUND OR NOT v_preferences.journal_enabled THEN
    RAISE EXCEPTION 'HEALTH_CONTEXT_OPT_IN_REQUIRED';
  END IF;
  IF (p_cycle_phase IS NOT NULL OR p_bleeding_flow IS NOT NULL)
     AND NOT v_preferences.cycle_tracking_enabled THEN
    RAISE EXCEPTION 'CYCLE_CONTEXT_OPT_IN_REQUIRED';
  END IF;

  INSERT INTO public.health_context_entries (
    user_id, entry_date, mood, stress, appetite, energy, digestive_symptoms,
    symptom_severity, cycle_phase, bleeding_flow, note, updated_at
  ) VALUES (
    v_actor,
    p_entry_date,
    CASE WHEN v_preferences.mood_enabled THEN p_mood ELSE NULL END,
    CASE WHEN v_preferences.stress_enabled THEN p_stress ELSE NULL END,
    CASE WHEN v_preferences.appetite_enabled THEN p_appetite ELSE NULL END,
    CASE WHEN v_preferences.energy_enabled THEN p_energy ELSE NULL END,
    CASE WHEN v_preferences.digestive_enabled THEN COALESCE(p_digestive_symptoms, '{}'::TEXT[]) ELSE '{}'::TEXT[] END,
    CASE WHEN v_preferences.digestive_enabled THEN p_symptom_severity ELSE NULL END,
    CASE WHEN v_preferences.cycle_tracking_enabled THEN p_cycle_phase ELSE NULL END,
    CASE WHEN v_preferences.cycle_tracking_enabled THEN p_bleeding_flow ELSE NULL END,
    CASE WHEN v_preferences.note_enabled THEN NULLIF(trim(p_note), '') ELSE NULL END,
    clock_timestamp()
  )
  ON CONFLICT (user_id, entry_date) DO UPDATE SET
    mood = EXCLUDED.mood,
    stress = EXCLUDED.stress,
    appetite = EXCLUDED.appetite,
    energy = EXCLUDED.energy,
    digestive_symptoms = EXCLUDED.digestive_symptoms,
    symptom_severity = EXCLUDED.symptom_severity,
    cycle_phase = EXCLUDED.cycle_phase,
    bleeding_flow = EXCLUDED.bleeding_flow,
    note = EXCLUDED.note,
    updated_at = clock_timestamp()
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_health_context_entry(p_entry_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  DELETE FROM public.health_context_entries
  WHERE id = p_entry_id AND user_id = v_actor;
  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_health_context_ai_consent(
  p_granted BOOLEAN,
  p_policy_version TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_journal_enabled BOOLEAN := FALSE;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.health_context_feature_enabled() THEN RAISE EXCEPTION 'HEALTH_CONTEXT_DISABLED'; END IF;
  IF p_policy_version <> '2026-07-health-context-ai-v1' THEN
    RAISE EXCEPTION 'INVALID_HEALTH_CONTEXT_CONSENT_VERSION';
  END IF;

  SELECT preferences.journal_enabled INTO v_journal_enabled
  FROM public.health_context_preferences preferences
  WHERE preferences.user_id = v_actor;
  IF p_granted AND NOT COALESCE(v_journal_enabled, FALSE) THEN
    RAISE EXCEPTION 'HEALTH_CONTEXT_OPT_IN_REQUIRED';
  END IF;

  INSERT INTO public.ai_data_consents (
    user_id, purpose, status, policy_version, granted_at, revoked_at, updated_at
  ) VALUES (
    v_actor, 'health_context_summary',
    CASE WHEN p_granted THEN 'granted' ELSE 'revoked' END,
    p_policy_version,
    CASE WHEN p_granted THEN clock_timestamp() ELSE NULL END,
    CASE WHEN p_granted THEN NULL ELSE clock_timestamp() END,
    clock_timestamp()
  )
  ON CONFLICT (user_id, purpose) DO UPDATE SET
    status = EXCLUDED.status,
    policy_version = EXCLUDED.policy_version,
    granted_at = CASE WHEN EXCLUDED.status = 'granted' THEN clock_timestamp() ELSE public.ai_data_consents.granted_at END,
    revoked_at = CASE WHEN EXCLUDED.status = 'revoked' THEN clock_timestamp() ELSE NULL END,
    updated_at = clock_timestamp();

  INSERT INTO public.health_context_consent_events (user_id, event_type, policy_version)
  VALUES (v_actor, CASE WHEN p_granted THEN 'granted' ELSE 'revoked' END, p_policy_version);
  RETURN p_granted;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_health_context_trends(p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.health_context_feature_enabled() THEN RAISE EXCEPTION 'HEALTH_CONTEXT_DISABLED'; END IF;
  IF p_days NOT BETWEEN 7 AND 180 THEN RAISE EXCEPTION 'INVALID_HEALTH_CONTEXT_WINDOW'; END IF;

  WITH entries AS (
    SELECT entry.*
    FROM public.health_context_entries entry
    WHERE entry.user_id = v_actor
      AND entry.entry_date >= CURRENT_DATE - (p_days - 1)
  ), joined AS (
    SELECT entry.*, snapshot.readiness_score, snapshot.nutrition_score
    FROM entries entry
    LEFT JOIN public.daily_performance_snapshots snapshot
      ON snapshot.user_id = entry.user_id AND snapshot.snapshot_date = entry.entry_date
  ), phase_groups AS (
    SELECT
      cycle_phase,
      count(*)::INTEGER AS entry_count,
      round(avg(mood)::NUMERIC, 1) AS average_mood,
      round(avg(stress)::NUMERIC, 1) AS average_stress,
      round(avg(appetite)::NUMERIC, 1) AS average_appetite,
      round(avg(energy)::NUMERIC, 1) AS average_energy,
      round(avg(readiness_score)::NUMERIC, 1) AS average_readiness,
      round(avg(nutrition_score)::NUMERIC, 1) AS average_nutrition_score
    FROM joined
    WHERE cycle_phase IS NOT NULL
    GROUP BY cycle_phase
    HAVING count(*) >= 3
  )
  SELECT jsonb_build_object(
    'window_days', p_days,
    'entry_count', (SELECT count(*) FROM entries),
    'average_mood', (SELECT round(avg(mood)::NUMERIC, 1) FROM entries),
    'average_stress', (SELECT round(avg(stress)::NUMERIC, 1) FROM entries),
    'average_appetite', (SELECT round(avg(appetite)::NUMERIC, 1) FROM entries),
    'average_energy', (SELECT round(avg(energy)::NUMERIC, 1) FROM entries),
    'stress_readiness_correlation', (
      SELECT CASE WHEN count(*) FILTER (WHERE stress IS NOT NULL AND readiness_score IS NOT NULL) >= 5
        THEN round(corr(stress::DOUBLE PRECISION, readiness_score::DOUBLE PRECISION)::NUMERIC, 2)
        ELSE NULL END
      FROM joined
    ),
    'phase_observations', COALESCE((SELECT jsonb_agg(to_jsonb(phase_groups) ORDER BY cycle_phase) FROM phase_groups), '[]'::JSONB)
  ) INTO v_result;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_health_context_recommendation_input(p_on_date DATE DEFAULT CURRENT_DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_preferences public.health_context_preferences%ROWTYPE;
  v_entry public.health_context_entries%ROWTYPE;
  v_codes TEXT[] := '{}'::TEXT[];
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF NOT public.health_context_feature_enabled() THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'feature_disabled');
  END IF;
  SELECT * INTO v_preferences FROM public.health_context_preferences WHERE user_id = v_actor;
  IF NOT FOUND OR NOT v_preferences.journal_enabled OR NOT v_preferences.recommendation_context_enabled THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'not_enabled');
  END IF;
  SELECT * INTO v_entry
  FROM public.health_context_entries
  WHERE user_id = v_actor AND entry_date <= p_on_date
  ORDER BY entry_date DESC LIMIT 1;
  IF NOT FOUND OR p_on_date - v_entry.entry_date > 3 THEN
    RETURN jsonb_build_object('available', FALSE, 'reason', 'missing_or_stale');
  END IF;

  IF v_entry.stress >= 4 THEN v_codes := array_append(v_codes, 'context.high_stress'); END IF;
  IF v_entry.appetite <= 2 THEN v_codes := array_append(v_codes, 'context.low_appetite'); END IF;
  IF v_entry.appetite >= 4 THEN v_codes := array_append(v_codes, 'context.high_appetite'); END IF;
  IF v_entry.energy <= 2 THEN v_codes := array_append(v_codes, 'context.low_energy'); END IF;
  IF v_entry.symptom_severity >= 2 THEN v_codes := array_append(v_codes, 'context.digestive_discomfort'); END IF;
  IF v_preferences.cycle_tracking_enabled AND v_entry.cycle_phase IS NOT NULL THEN
    v_codes := array_append(v_codes, 'context.user_logged_cycle_phase');
  END IF;

  RETURN jsonb_build_object(
    'available', TRUE,
    'source_date', v_entry.entry_date,
    'freshness_days', p_on_date - v_entry.entry_date,
    'mood', v_entry.mood,
    'stress', v_entry.stress,
    'appetite', v_entry.appetite,
    'energy', v_entry.energy,
    'digestive_symptoms', v_entry.digestive_symptoms,
    'symptom_severity', v_entry.symptom_severity,
    'cycle_phase', CASE WHEN v_preferences.cycle_tracking_enabled THEN v_entry.cycle_phase ELSE NULL END,
    'explanation_codes', to_jsonb(v_codes)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.health_context_ai_summary_internal(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_result JSONB;
BEGIN
  IF p_user_id IS NULL OR p_days NOT BETWEEN 7 AND 90 THEN RETURN NULL; END IF;
  IF NOT public.health_context_feature_enabled() THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.health_context_preferences preferences
    WHERE preferences.user_id = p_user_id AND preferences.journal_enabled
  ) THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_data_consents consent
    WHERE consent.user_id = p_user_id
      AND consent.purpose = 'health_context_summary'
      AND consent.status = 'granted'
      AND consent.policy_version = '2026-07-health-context-ai-v1'
  ) THEN RETURN NULL; END IF;

  WITH entries AS (
    SELECT entry.*
    FROM public.health_context_entries entry
    WHERE entry.user_id = p_user_id
      AND entry.entry_date >= CURRENT_DATE - (p_days - 1)
  ), phase_groups AS (
    SELECT cycle_phase, count(*)::INTEGER AS entry_count,
      round(avg(appetite)::NUMERIC, 1) AS average_appetite,
      round(avg(energy)::NUMERIC, 1) AS average_energy
    FROM entries
    WHERE cycle_phase IS NOT NULL
    GROUP BY cycle_phase
    HAVING count(*) >= 3
  )
  SELECT CASE WHEN count(*) < 3 THEN NULL ELSE jsonb_build_object(
    'window_days', p_days,
    'days_logged', count(*),
    'average_mood', round(avg(mood)::NUMERIC, 1),
    'average_stress', round(avg(stress)::NUMERIC, 1),
    'average_appetite', round(avg(appetite)::NUMERIC, 1),
    'average_energy', round(avg(energy)::NUMERIC, 1),
    'digestive_discomfort_days', count(*) FILTER (WHERE symptom_severity >= 2),
    'cycle_phase_observations', COALESCE((SELECT jsonb_agg(to_jsonb(phase_groups) ORDER BY cycle_phase) FROM phase_groups), '[]'::JSONB)
  ) END INTO v_result
  FROM entries;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_health_context_ai_summary(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  RETURN public.health_context_ai_summary_internal(v_actor, p_days);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_health_context_ai_summary_for_user(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED'; END IF;
  RETURN public.health_context_ai_summary_internal(p_user_id, p_days);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_health_context_state(p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_preferences JSONB;
  v_entries JSONB;
  v_ai_consent BOOLEAN;
  v_has_existing_data BOOLEAN;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_days NOT BETWEEN 7 AND 180 THEN RAISE EXCEPTION 'INVALID_HEALTH_CONTEXT_WINDOW'; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.health_context_preferences preferences WHERE preferences.user_id = v_actor
    UNION ALL
    SELECT 1 FROM public.health_context_entries entry WHERE entry.user_id = v_actor
  ) INTO v_has_existing_data;
  IF NOT public.health_context_feature_enabled() THEN
    RETURN jsonb_build_object(
      'feature_enabled', FALSE,
      'has_existing_data', v_has_existing_data
    );
  END IF;

  SELECT to_jsonb(preferences) - 'user_id' INTO v_preferences
  FROM public.health_context_preferences preferences WHERE preferences.user_id = v_actor;
  SELECT COALESCE(jsonb_agg(to_jsonb(entry) - 'user_id' ORDER BY entry.entry_date DESC), '[]'::JSONB)
  INTO v_entries
  FROM public.health_context_entries entry
  WHERE entry.user_id = v_actor AND entry.entry_date >= CURRENT_DATE - (p_days - 1);
  SELECT EXISTS (
    SELECT 1 FROM public.ai_data_consents consent
    WHERE consent.user_id = v_actor AND consent.purpose = 'health_context_summary'
      AND consent.status = 'granted' AND consent.policy_version = '2026-07-health-context-ai-v1'
  ) INTO v_ai_consent;

  RETURN jsonb_build_object(
    'feature_enabled', TRUE,
    'has_existing_data', v_has_existing_data,
    'preferences', COALESCE(v_preferences, jsonb_build_object(
      'journal_enabled', FALSE, 'cycle_tracking_enabled', FALSE,
      'recommendation_context_enabled', FALSE, 'mood_enabled', TRUE,
      'stress_enabled', TRUE, 'appetite_enabled', TRUE, 'energy_enabled', TRUE,
      'digestive_enabled', TRUE, 'note_enabled', TRUE
    )),
    'entries', v_entries,
    'trends', public.get_health_context_trends(p_days),
    'ai_consent', v_ai_consent
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_health_context_dataset()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_deleted INTEGER := 0;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  DELETE FROM public.health_context_entries WHERE user_id = v_actor;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  DELETE FROM public.health_context_preferences WHERE user_id = v_actor;
  INSERT INTO public.ai_data_consents (
    user_id, purpose, status, policy_version, revoked_at, updated_at
  ) VALUES (
    v_actor, 'health_context_summary', 'revoked', '2026-07-health-context-ai-v1',
    clock_timestamp(), clock_timestamp()
  ) ON CONFLICT (user_id, purpose) DO UPDATE SET
    status = 'revoked', policy_version = EXCLUDED.policy_version,
    revoked_at = clock_timestamp(), updated_at = clock_timestamp();
  INSERT INTO public.health_context_consent_events (user_id, event_type, policy_version)
  VALUES (v_actor, 'dataset_deleted', '2026-07-health-context-ai-v1');
  RETURN jsonb_build_object('deleted_entries', v_deleted, 'consent_revoked', TRUE);
END;
$function$;

REVOKE ALL ON FUNCTION public.health_context_feature_enabled() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_health_context_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.upsert_health_context_entry(DATE, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT[], SMALLINT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_health_context_entry(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_health_context_ai_consent(BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_health_context_trends(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_health_context_recommendation_input(DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.health_context_ai_summary_internal(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_health_context_ai_summary(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_health_context_ai_summary_for_user(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_health_context_state(INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_health_context_dataset() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.health_context_feature_enabled() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_health_context_preferences(BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_health_context_entry(DATE, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT[], SMALLINT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_health_context_entry(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_health_context_ai_consent(BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_health_context_trends(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_health_context_recommendation_input(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.health_context_ai_summary_internal(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_health_context_ai_summary(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_health_context_ai_summary_for_user(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_health_context_state(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_health_context_dataset() TO authenticated;

COMMENT ON TABLE public.health_context_entries IS
  'Private user-entered health context. It is never a diagnosis, fertility prediction, or social dataset.';
COMMENT ON FUNCTION public.get_health_context_ai_summary_for_user(UUID, INTEGER) IS
  'Service-only consent gate returning aggregate health context without notes, dates, or bleeding detail.';

COMMIT;
