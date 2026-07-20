BEGIN;

CREATE TABLE IF NOT EXISTS public.health_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 100),
  short_description TEXT NOT NULL CHECK (char_length(short_description) BETWEEN 10 AND 280),
  category TEXT NOT NULL CHECK (category IN ('nutrition', 'strength', 'weight_support', 'medication_support')),
  duration_weeks SMALLINT NOT NULL CHECK (duration_weeks BETWEEN 1 AND 52),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  service_scope TEXT NOT NULL,
  boundary_statement TEXT NOT NULL,
  outcomes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(outcomes) = 'array'),
  includes JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(includes) = 'array'),
  eligibility JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(eligibility) = 'object'),
  accent_color TEXT NOT NULL DEFAULT '#7C83F6' CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  icon_key TEXT NOT NULL DEFAULT 'heart-pulse',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_program_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.health_programs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  consent_version TEXT NOT NULL,
  protocol JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(protocol) = 'object'),
  nutrition_rules JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(nutrition_rules) = 'object'),
  activity_rules JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(activity_rules) = 'object'),
  symptom_rules JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(symptom_rules) = 'object'),
  red_flag_rules JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(red_flag_rules) = 'object'),
  allowed_claims JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(allowed_claims) = 'array'),
  prohibited_claims JSONB NOT NULL DEFAULT '[]'::JSONB CHECK (jsonb_typeof(prohibited_claims) = 'array'),
  effective_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note TEXT CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS health_program_versions_one_published_idx
  ON public.health_program_versions(program_id)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.health_program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.health_programs(id) ON DELETE RESTRICT,
  program_version_id UUID NOT NULL REFERENCES public.health_program_versions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'withdrawn')),
  start_date DATE NOT NULL DEFAULT current_date,
  target_end_date DATE NOT NULL,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  adult_attested_at TIMESTAMPTZ NOT NULL,
  clinician_prescription_attested_at TIMESTAMPTZ NOT NULL,
  service_boundary_accepted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (target_end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS health_program_enrollments_one_active_idx
  ON public.health_program_enrollments(user_id)
  WHERE status IN ('active', 'paused');
CREATE INDEX IF NOT EXISTS health_program_enrollments_program_status_idx
  ON public.health_program_enrollments(program_id, status);

CREATE TABLE IF NOT EXISTS public.health_program_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.health_program_enrollments(id) ON DELETE CASCADE,
  consent_version TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('granted', 'withdrawn')),
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notice_snapshot TEXT NOT NULL CHECK (char_length(notice_snapshot) BETWEEN 20 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_program_consent_user_created_idx
  ON public.health_program_consent_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.health_program_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL UNIQUE REFERENCES public.health_program_enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  eating_pattern JSONB NOT NULL DEFAULT '{}'::JSONB CHECK (jsonb_typeof(eating_pattern) = 'object'),
  appetite SMALLINT CHECK (appetite BETWEEN 1 AND 5),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
  hydration_confidence SMALLINT CHECK (hydration_confidence BETWEEN 1 AND 5),
  strength_experience TEXT CHECK (strength_experience IN ('none', 'beginner', 'regular')),
  goals TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_program_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.health_program_enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL DEFAULT current_date,
  appetite SMALLINT CHECK (appetite BETWEEN 1 AND 5),
  energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
  hydration_ability SMALLINT CHECK (hydration_ability BETWEEN 1 AND 5),
  nausea SMALLINT NOT NULL DEFAULT 0 CHECK (nausea BETWEEN 0 AND 4),
  vomiting SMALLINT NOT NULL DEFAULT 0 CHECK (vomiting BETWEEN 0 AND 4),
  constipation SMALLINT NOT NULL DEFAULT 0 CHECK (constipation BETWEEN 0 AND 4),
  diarrhea SMALLINT NOT NULL DEFAULT 0 CHECK (diarrhea BETWEEN 0 AND 4),
  reflux SMALLINT NOT NULL DEFAULT 0 CHECK (reflux BETWEEN 0 AND 4),
  symptoms_disrupt_food BOOLEAN NOT NULL DEFAULT FALSE,
  symptoms_persistent BOOLEAN NOT NULL DEFAULT FALSE,
  severe_persistent_abdominal_pain BOOLEAN NOT NULL DEFAULT FALSE,
  unable_to_keep_fluids BOOLEAN NOT NULL DEFAULT FALSE,
  breathing_or_swallowing_difficulty BOOLEAN NOT NULL DEFAULT FALSE,
  face_or_tongue_swelling BOOLEAN NOT NULL DEFAULT FALSE,
  fainting BOOLEAN NOT NULL DEFAULT FALSE,
  sudden_vision_change BOOLEAN NOT NULL DEFAULT FALSE,
  guidance_level TEXT NOT NULL CHECK (guidance_level IN ('routine', 'contact_clinician', 'urgent')),
  guidance_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS health_program_checkins_user_date_idx
  ON public.health_program_checkins(user_id, checkin_date DESC);

CREATE TABLE IF NOT EXISTS public.health_program_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.health_program_enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_date DATE NOT NULL DEFAULT current_date,
  task_code TEXT NOT NULL CHECK (task_code ~ '^[a-z0-9_]+$'),
  task_type TEXT NOT NULL CHECK (task_type IN ('meal', 'hydration', 'nutrition', 'strength', 'checkin', 'education')),
  completion_source TEXT NOT NULL DEFAULT 'manual' CHECK (completion_source IN ('manual', 'meal_log', 'water_log', 'workout_session', 'checkin')),
  evidence_id UUID,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, task_date, task_code)
);

CREATE INDEX IF NOT EXISTS health_program_tasks_user_date_idx
  ON public.health_program_task_completions(user_id, task_date DESC);

CREATE TABLE IF NOT EXISTS public.health_program_meal_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_version_id UUID NOT NULL REFERENCES public.health_program_versions(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'eligible', 'rejected', 'expired')),
  attributes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  rationale TEXT CHECK (rationale IS NULL OR char_length(rationale) <= 1000),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_version_id, meal_id),
  CHECK (attributes <@ ARRAY['small_portion','high_protein','fiber_source','gentle_choice','hydration_support','lower_fat_option']::TEXT[])
);

CREATE INDEX IF NOT EXISTS health_program_meal_qualification_lookup_idx
  ON public.health_program_meal_qualifications(program_version_id, status, meal_id);

CREATE TABLE IF NOT EXISTS public.health_program_safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.health_program_enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_id UUID REFERENCES public.health_program_checkins(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('contact_clinician', 'urgent')),
  rule_codes TEXT[] NOT NULL CHECK (cardinality(rule_codes) > 0),
  message_key TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_program_safety_created_idx
  ON public.health_program_safety_events(severity, created_at DESC);

CREATE OR REPLACE FUNCTION public.health_program_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'health_programs', 'health_program_versions', 'health_program_enrollments',
    'health_program_baselines', 'health_program_checkins',
    'health_program_meal_qualifications'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', table_name);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.health_program_set_updated_at()',
      table_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.health_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_meal_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_program_safety_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_programs_read_published_or_admin ON public.health_programs
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY health_programs_admin_write ON public.health_programs
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY health_program_versions_read_published_or_admin ON public.health_program_versions
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role((SELECT auth.uid()), 'admin'));
CREATE POLICY health_program_versions_admin_write ON public.health_program_versions
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY health_program_enrollments_owner_read ON public.health_program_enrollments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY health_program_enrollments_admin_read ON public.health_program_enrollments
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY health_program_consents_owner_read ON public.health_program_consent_events
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY health_program_baselines_owner_read ON public.health_program_baselines
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY health_program_baselines_owner_insert ON public.health_program_baselines
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT auth.uid()) = user_id AND EXISTS (
      SELECT 1 FROM public.health_program_enrollments hpe
      WHERE hpe.id = enrollment_id AND hpe.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY health_program_baselines_owner_update ON public.health_program_baselines
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id AND EXISTS (
      SELECT 1 FROM public.health_program_enrollments hpe
      WHERE hpe.id = enrollment_id AND hpe.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY health_program_checkins_owner_read ON public.health_program_checkins
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY health_program_tasks_owner_all ON public.health_program_task_completions
  FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id AND EXISTS (
      SELECT 1 FROM public.health_program_enrollments hpe
      WHERE hpe.id = enrollment_id AND hpe.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY health_program_meals_read_published_or_admin ON public.health_program_meal_qualifications
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin') OR EXISTS (
      SELECT 1 FROM public.health_program_versions hpv
      WHERE hpv.id = program_version_id AND hpv.status = 'published'
    )
  );
CREATE POLICY health_program_meals_admin_write ON public.health_program_meal_qualifications
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY health_program_safety_owner_read ON public.health_program_safety_events
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY health_program_safety_admin_read ON public.health_program_safety_events
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION public.enroll_in_health_program(
  p_program_slug TEXT,
  p_adult_attested BOOLEAN,
  p_clinician_prescription_attested BOOLEAN,
  p_service_boundary_accepted BOOLEAN,
  p_notice_snapshot TEXT
)
RETURNS public.health_program_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_program public.health_programs;
  v_version public.health_program_versions;
  v_enrollment public.health_program_enrollments;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT p_adult_attested OR NOT p_clinician_prescription_attested OR NOT p_service_boundary_accepted THEN
    RAISE EXCEPTION 'All eligibility and service-boundary attestations are required';
  END IF;
  IF char_length(coalesce(p_notice_snapshot, '')) < 20 THEN
    RAISE EXCEPTION 'Consent notice snapshot is required';
  END IF;

  SELECT * INTO v_program
  FROM public.health_programs
  WHERE slug = p_program_slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Program is not available for enrollment'; END IF;

  SELECT * INTO v_version
  FROM public.health_program_versions
  WHERE program_id = v_program.id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Program protocol is not published'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.health_program_enrollments
    WHERE user_id = v_user_id AND status IN ('active', 'paused')
  ) THEN
    RAISE EXCEPTION 'An active or paused health program already exists';
  END IF;

  INSERT INTO public.health_program_enrollments (
    user_id, program_id, program_version_id, target_end_date,
    adult_attested_at, clinician_prescription_attested_at, service_boundary_accepted_at
  ) VALUES (
    v_user_id, v_program.id, v_version.id,
    current_date + (v_program.duration_weeks * 7 - 1),
    now(), now(), now()
  ) RETURNING * INTO v_enrollment;

  INSERT INTO public.health_program_consent_events (
    user_id, enrollment_id, consent_version, event_type, scopes, notice_snapshot
  ) VALUES (
    v_user_id, v_enrollment.id, v_version.consent_version, 'granted',
    ARRAY['program_enrollment','nutrition_tracking','activity_tracking','symptom_checkins'],
    p_notice_snapshot
  );

  RETURN v_enrollment;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_health_program_status(
  p_enrollment_id UUID,
  p_status TEXT
)
RETURNS public.health_program_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current public.health_program_enrollments;
BEGIN
  IF p_status NOT IN ('active', 'paused', 'completed', 'withdrawn') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT * INTO v_current FROM public.health_program_enrollments
  WHERE id = p_enrollment_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  IF v_current.status IN ('completed', 'withdrawn') THEN
    RAISE EXCEPTION 'Closed enrollment cannot be changed';
  END IF;

  UPDATE public.health_program_enrollments SET
    status = p_status,
    paused_at = CASE WHEN p_status = 'paused' THEN now() ELSE paused_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
    withdrawn_at = CASE WHEN p_status = 'withdrawn' THEN now() ELSE withdrawn_at END
  WHERE id = p_enrollment_id
  RETURNING * INTO v_current;

  IF p_status = 'withdrawn' THEN
    INSERT INTO public.health_program_consent_events (
      user_id, enrollment_id, consent_version, event_type, scopes, notice_snapshot
    )
    SELECT v_user_id, v_current.id, hpv.consent_version, 'withdrawn', ARRAY[]::TEXT[],
      'The user withdrew from the health support program and withdrew future program processing consent.'
    FROM public.health_program_versions hpv WHERE hpv.id = v_current.program_version_id;
  END IF;

  RETURN v_current;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_health_program_checkin(
  p_enrollment_id UUID,
  p_appetite SMALLINT,
  p_energy SMALLINT,
  p_hydration_ability SMALLINT,
  p_nausea SMALLINT DEFAULT 0,
  p_vomiting SMALLINT DEFAULT 0,
  p_constipation SMALLINT DEFAULT 0,
  p_diarrhea SMALLINT DEFAULT 0,
  p_reflux SMALLINT DEFAULT 0,
  p_symptoms_disrupt_food BOOLEAN DEFAULT FALSE,
  p_symptoms_persistent BOOLEAN DEFAULT FALSE,
  p_severe_persistent_abdominal_pain BOOLEAN DEFAULT FALSE,
  p_unable_to_keep_fluids BOOLEAN DEFAULT FALSE,
  p_breathing_or_swallowing_difficulty BOOLEAN DEFAULT FALSE,
  p_face_or_tongue_swelling BOOLEAN DEFAULT FALSE,
  p_fainting BOOLEAN DEFAULT FALSE,
  p_sudden_vision_change BOOLEAN DEFAULT FALSE
)
RETURNS public.health_program_checkins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_level TEXT := 'routine';
  v_code TEXT := 'routine_support';
  v_rules TEXT[] := ARRAY[]::TEXT[];
  v_checkin public.health_program_checkins;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.health_program_enrollments
    WHERE id = p_enrollment_id AND user_id = v_user_id AND status = 'active'
  ) THEN RAISE EXCEPTION 'Active enrollment not found'; END IF;

  IF p_severe_persistent_abdominal_pain THEN v_rules := array_append(v_rules, 'severe_persistent_abdominal_pain'); END IF;
  IF p_unable_to_keep_fluids THEN v_rules := array_append(v_rules, 'unable_to_keep_fluids'); END IF;
  IF p_breathing_or_swallowing_difficulty THEN v_rules := array_append(v_rules, 'breathing_or_swallowing_difficulty'); END IF;
  IF p_face_or_tongue_swelling THEN v_rules := array_append(v_rules, 'face_or_tongue_swelling'); END IF;
  IF p_fainting THEN v_rules := array_append(v_rules, 'fainting'); END IF;
  IF p_sudden_vision_change THEN v_rules := array_append(v_rules, 'sudden_vision_change'); END IF;

  IF cardinality(v_rules) > 0 THEN
    v_level := 'urgent'; v_code := 'seek_urgent_medical_care';
  ELSIF p_symptoms_persistent OR p_symptoms_disrupt_food OR p_vomiting >= 3 OR p_diarrhea >= 3 OR p_nausea >= 3 THEN
    v_level := 'contact_clinician'; v_code := 'contact_prescribing_clinician';
    IF p_symptoms_persistent THEN v_rules := array_append(v_rules, 'persistent_symptoms'); END IF;
    IF p_symptoms_disrupt_food THEN v_rules := array_append(v_rules, 'symptoms_disrupt_food_or_fluids'); END IF;
    IF cardinality(v_rules) = 0 THEN v_rules := ARRAY['high_symptom_severity']; END IF;
  END IF;

  INSERT INTO public.health_program_checkins (
    enrollment_id, user_id, checkin_date, appetite, energy, hydration_ability,
    nausea, vomiting, constipation, diarrhea, reflux, symptoms_disrupt_food,
    symptoms_persistent, severe_persistent_abdominal_pain, unable_to_keep_fluids,
    breathing_or_swallowing_difficulty, face_or_tongue_swelling, fainting,
    sudden_vision_change, guidance_level, guidance_code
  ) VALUES (
    p_enrollment_id, v_user_id, current_date, p_appetite, p_energy, p_hydration_ability,
    p_nausea, p_vomiting, p_constipation, p_diarrhea, p_reflux, p_symptoms_disrupt_food,
    p_symptoms_persistent, p_severe_persistent_abdominal_pain, p_unable_to_keep_fluids,
    p_breathing_or_swallowing_difficulty, p_face_or_tongue_swelling, p_fainting,
    p_sudden_vision_change, v_level, v_code
  )
  ON CONFLICT (enrollment_id, checkin_date) DO UPDATE SET
    appetite = EXCLUDED.appetite, energy = EXCLUDED.energy,
    hydration_ability = EXCLUDED.hydration_ability, nausea = EXCLUDED.nausea,
    vomiting = EXCLUDED.vomiting, constipation = EXCLUDED.constipation,
    diarrhea = EXCLUDED.diarrhea, reflux = EXCLUDED.reflux,
    symptoms_disrupt_food = EXCLUDED.symptoms_disrupt_food,
    symptoms_persistent = EXCLUDED.symptoms_persistent,
    severe_persistent_abdominal_pain = EXCLUDED.severe_persistent_abdominal_pain,
    unable_to_keep_fluids = EXCLUDED.unable_to_keep_fluids,
    breathing_or_swallowing_difficulty = EXCLUDED.breathing_or_swallowing_difficulty,
    face_or_tongue_swelling = EXCLUDED.face_or_tongue_swelling,
    fainting = EXCLUDED.fainting, sudden_vision_change = EXCLUDED.sudden_vision_change,
    guidance_level = EXCLUDED.guidance_level, guidance_code = EXCLUDED.guidance_code,
    updated_at = now()
  RETURNING * INTO v_checkin;

  DELETE FROM public.health_program_safety_events WHERE checkin_id = v_checkin.id;
  IF v_level <> 'routine' THEN
    INSERT INTO public.health_program_safety_events (
      enrollment_id, user_id, checkin_id, severity, rule_codes, message_key
    ) VALUES (p_enrollment_id, v_user_id, v_checkin.id, v_level, v_rules, v_code);
  END IF;

  INSERT INTO public.health_program_task_completions (
    enrollment_id, user_id, task_date, task_code, task_type, completion_source, evidence_id
  ) VALUES (p_enrollment_id, v_user_id, current_date, 'daily_checkin', 'checkin', 'checkin', v_checkin.id)
  ON CONFLICT (enrollment_id, task_date, task_code) DO UPDATE SET
    completion_source = EXCLUDED.completion_source, evidence_id = EXCLUDED.evidence_id,
    completed_at = now();

  RETURN v_checkin;
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_health_program_safety_event(
  p_event_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_acknowledged_at TIMESTAMPTZ;
BEGIN
  UPDATE public.health_program_safety_events
  SET acknowledged_at = coalesce(acknowledged_at, now())
  WHERE id = p_event_id AND user_id = auth.uid()
  RETURNING acknowledged_at INTO v_acknowledged_at;

  IF v_acknowledged_at IS NULL THEN
    RAISE EXCEPTION 'Safety event not found';
  END IF;
  RETURN v_acknowledged_at;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_in_health_program(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_health_program_status(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_health_program_checkin(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acknowledge_health_program_safety_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_in_health_program(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_health_program_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_health_program_checkin(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_health_program_safety_event(UUID) TO authenticated;

INSERT INTO public.health_programs (
  slug, name, short_description, category, duration_weeks, status,
  service_scope, boundary_statement, outcomes, includes, eligibility,
  accent_color, icon_key
) VALUES (
  'glp1-nutrition-strength-support',
  'GLP-1 Nutrition & Strength Support',
  'An eight-week meal, hydration, strength, and self-tracking journey for adults already prescribed GLP-1 medicine by their clinician.',
  'medication_support', 8, 'draft',
  'General nutrition, meal planning, hydration, strength activity, education, and user-controlled self-tracking.',
  'Nutrio does not diagnose, prescribe, change medication doses, or replace your prescribing clinician.',
  '["Build a consistent nutrient-dense eating routine","Support protein and hydration habits","Maintain a practical strength routine","Create a clear report to share with your clinician"]'::JSONB,
  '["Curated meal attributes","Daily hydration and nutrition tasks","Two to three strength sessions each week","Private appetite, energy, and digestive check-ins","User-controlled progress report"]'::JSONB,
  '{"minimum_age":18,"requires_existing_clinician_prescription":true,"not_for_medication_selection":true}'::JSONB,
  '#7C83F6', 'shield-heart'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  service_scope = EXCLUDED.service_scope,
  boundary_statement = EXCLUDED.boundary_statement,
  outcomes = EXCLUDED.outcomes,
  includes = EXCLUDED.includes,
  eligibility = EXCLUDED.eligibility,
  updated_at = now();

INSERT INTO public.health_program_versions (
  program_id, version, status, consent_version, protocol, nutrition_rules,
  activity_rules, symptom_rules, red_flag_rules, allowed_claims,
  prohibited_claims, review_note
)
SELECT
  hp.id, 1, 'draft', 'glp1-support-v1',
  '{"weeks":8,"daily_tasks":["meal_plan","hydration","nutrition_focus","daily_checkin"],"weekly_tasks":["strength_a","strength_b","weekly_review"],"reporting":"user_controlled"}'::JSONB,
  '{"principles":["nutrient_dense","protein_visible","fiber_gradual","hydration_regular","portion_flexible"],"attributes":["small_portion","high_protein","fiber_source","gentle_choice","hydration_support","lower_fat_option"],"no_universal_targets":true}'::JSONB,
  '{"strength_sessions_per_week":{"min":2,"max":3},"conservative_progression":true,"symptom_pause_supported":true}'::JSONB,
  '{"tracked":["appetite","energy","hydration_ability","nausea","vomiting","constipation","diarrhea","reflux"],"diagnoses":false}'::JSONB,
  '{"urgent":["severe_persistent_abdominal_pain","unable_to_keep_fluids","breathing_or_swallowing_difficulty","face_or_tongue_swelling","fainting","sudden_vision_change"],"contact_clinician":["persistent_symptoms","symptoms_disrupt_food_or_fluids","high_symptom_severity"]}'::JSONB,
  '["supports nutrition routines","supports hydration habits","supports strength activity","helps organize self-tracked information"]'::JSONB,
  '["treats obesity","manages diabetes","prevents medication side effects","recommends medication or dose","replaces a clinician"]'::JSONB,
  'Draft protocol. Publication requires Qatar legal review, DHP-licensed dietitian review, medical safety wording review, and DPIA approval.'
FROM public.health_programs hp
WHERE hp.slug = 'glp1-nutrition-strength-support'
ON CONFLICT (program_id, version) DO NOTHING;

COMMIT;
