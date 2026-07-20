-- Require a private baseline before a health support enrollment becomes active.

DROP INDEX IF EXISTS public.health_program_enrollments_one_active_idx;

ALTER TABLE public.health_program_enrollments
  DROP CONSTRAINT IF EXISTS health_program_enrollments_status_check;

ALTER TABLE public.health_program_enrollments
  ADD CONSTRAINT health_program_enrollments_status_check
  CHECK (status IN ('onboarding', 'active', 'paused', 'completed', 'withdrawn'));

ALTER TABLE public.health_program_enrollments
  ALTER COLUMN status SET DEFAULT 'onboarding';

CREATE UNIQUE INDEX health_program_enrollments_one_active_idx
  ON public.health_program_enrollments(user_id)
  WHERE status IN ('onboarding', 'active', 'paused');

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
    WHERE user_id = v_user_id AND status IN ('onboarding', 'active', 'paused')
  ) THEN
    RAISE EXCEPTION 'An open health program already exists';
  END IF;

  INSERT INTO public.health_program_enrollments (
    user_id, program_id, program_version_id, status, target_end_date,
    adult_attested_at, clinician_prescription_attested_at, service_boundary_accepted_at
  ) VALUES (
    v_user_id, v_program.id, v_version.id, 'onboarding',
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

CREATE OR REPLACE FUNCTION public.complete_health_program_onboarding(
  p_enrollment_id UUID
)
RETURNS public.health_program_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_enrollment public.health_program_enrollments;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  SELECT * INTO v_enrollment
  FROM public.health_program_enrollments
  WHERE id = p_enrollment_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment not found'; END IF;
  IF v_enrollment.status <> 'onboarding' THEN
    RAISE EXCEPTION 'Enrollment is not in onboarding';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.health_program_baselines
    WHERE enrollment_id = p_enrollment_id AND user_id = v_user_id
      AND appetite IS NOT NULL AND energy IS NOT NULL
      AND hydration_confidence IS NOT NULL AND strength_experience IS NOT NULL
      AND cardinality(goals) > 0
  ) THEN
    RAISE EXCEPTION 'A complete private baseline is required';
  END IF;

  UPDATE public.health_program_enrollments
  SET status = 'active', start_date = current_date,
      target_end_date = current_date + (
        SELECT duration_weeks * 7 - 1
        FROM public.health_programs WHERE id = v_enrollment.program_id
      ), updated_at = now()
  WHERE id = p_enrollment_id
  RETURNING * INTO v_enrollment;

  RETURN v_enrollment;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_health_program_onboarding(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_health_program_onboarding(UUID) TO authenticated;
