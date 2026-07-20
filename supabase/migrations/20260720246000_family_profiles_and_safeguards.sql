-- Independent household profiles with consent, minor safeguards, goals, allowance, and safe schedule assignment.

BEGIN;

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS relationship TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS calorie_target INTEGER,
  ADD COLUMN IF NOT EXISTS protein_target_g INTEGER,
  ADD COLUMN IF NOT EXISTS hydration_target_ml INTEGER,
  ADD COLUMN IF NOT EXISTS monthly_meal_allowance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS authorization_type TEXT,
  ADD COLUMN IF NOT EXISTS authorization_version TEXT,
  ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD CONSTRAINT family_members_relationship_check CHECK (relationship IN ('spouse', 'child', 'parent', 'sibling', 'other')),
  ADD CONSTRAINT family_members_status_check CHECK (status IN ('active', 'inactive')),
  ADD CONSTRAINT family_members_authorization_check CHECK (authorization_type IS NULL OR authorization_type IN ('adult_authorization', 'guardian_consent')),
  ADD CONSTRAINT family_members_calorie_check CHECK (calorie_target IS NULL OR calorie_target BETWEEN 800 AND 6000),
  ADD CONSTRAINT family_members_protein_check CHECK (protein_target_g IS NULL OR protein_target_g BETWEEN 0 AND 400),
  ADD CONSTRAINT family_members_hydration_check CHECK (hydration_target_ml IS NULL OR hydration_target_ml BETWEEN 500 AND 8000),
  ADD CONSTRAINT family_members_allowance_check CHECK (monthly_meal_allowance BETWEEN 0 AND 500);

UPDATE public.family_members
SET date_of_birth = make_date(birth_year, 1, 1)
WHERE date_of_birth IS NULL AND birth_year BETWEEN 1900 AND EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

CREATE TABLE IF NOT EXISTS public.family_member_consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  main_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('authorized', 'updated', 'withdrawn')),
  authorization_type TEXT NOT NULL CHECK (authorization_type IN ('adult_authorization', 'guardian_consent')),
  consent_version TEXT NOT NULL,
  data_scopes TEXT[] NOT NULL DEFAULT ARRAY['dietary_preferences', 'allergies', 'goals', 'meal_schedule']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (data_scopes <@ ARRAY['dietary_preferences', 'allergies', 'goals', 'meal_schedule', 'meal_history']::TEXT[])
);

ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES public.family_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS meal_schedules_family_member_date_idx
  ON public.meal_schedules (family_member_id, scheduled_date DESC)
  WHERE family_member_id IS NOT NULL;

ALTER TABLE public.family_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.family_member_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_member_consent_events FORCE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.family_members FROM authenticated;
REVOKE ALL ON public.family_member_consent_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.family_member_consent_events TO service_role;

DROP POLICY IF EXISTS "Users can insert their own family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can update their own family members" ON public.family_members;
DROP POLICY IF EXISTS "Users can delete their own family members" ON public.family_members;

CREATE POLICY family_consent_owner_read ON public.family_member_consent_events
  FOR SELECT TO authenticated
  USING (main_user_id = auth.uid());
GRANT SELECT ON public.family_member_consent_events TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_family_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid(); v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(member) ORDER BY member.created_at), '[]'::JSONB)
  INTO v_result
  FROM public.family_members member
  WHERE member.main_user_id = v_user_id AND member.status = 'active';
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_my_family_profile(
  p_name TEXT,
  p_relationship TEXT,
  p_date_of_birth DATE,
  p_gender TEXT DEFAULT NULL,
  p_dietary_preferences TEXT[] DEFAULT '{}'::TEXT[],
  p_allergies TEXT[] DEFAULT '{}'::TEXT[],
  p_calorie_target INTEGER DEFAULT NULL,
  p_protein_target_g INTEGER DEFAULT NULL,
  p_hydration_target_ml INTEGER DEFAULT NULL,
  p_monthly_meal_allowance INTEGER DEFAULT 0,
  p_authorization_confirmed BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid(); v_member_id UUID; v_max_members INTEGER;
  v_current_count INTEGER; v_is_minor BOOLEAN; v_authorization TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'INVALID_FAMILY_NAME'; END IF;
  IF p_relationship NOT IN ('spouse', 'child', 'parent', 'sibling', 'other') THEN RAISE EXCEPTION 'INVALID_RELATIONSHIP'; END IF;
  IF p_date_of_birth IS NULL OR p_date_of_birth > CURRENT_DATE OR p_date_of_birth < CURRENT_DATE - interval '120 years' THEN
    RAISE EXCEPTION 'VALID_DATE_OF_BIRTH_REQUIRED';
  END IF;
  IF NOT p_authorization_confirmed THEN RAISE EXCEPTION 'FAMILY_PROFILE_AUTHORIZATION_REQUIRED'; END IF;

  SELECT COALESCE(max_family_members, 0) INTO v_max_members
  FROM public.subscriptions
  WHERE user_id = v_user_id AND COALESCE(active, FALSE) = TRUE
    AND COALESCE(status::TEXT, '') = 'active'
  ORDER BY created_at DESC LIMIT 1;
  IF COALESCE(v_max_members, 0) <= 0 THEN RAISE EXCEPTION 'FAMILY_PLAN_REQUIRED'; END IF;
  SELECT count(*) INTO v_current_count FROM public.family_members WHERE main_user_id = v_user_id AND status = 'active';
  IF v_current_count >= v_max_members THEN RAISE EXCEPTION 'FAMILY_MEMBER_LIMIT_REACHED'; END IF;

  v_is_minor := p_date_of_birth > CURRENT_DATE - interval '18 years';
  v_authorization := CASE WHEN v_is_minor THEN 'guardian_consent' ELSE 'adult_authorization' END;
  IF v_is_minor AND p_relationship <> 'child' THEN RAISE EXCEPTION 'MINOR_GUARDIAN_RELATIONSHIP_REQUIRED'; END IF;

  INSERT INTO public.family_members (
    main_user_id, name, relationship, date_of_birth, birth_year, gender,
    dietary_preferences, allergies, calorie_target, protein_target_g,
    hydration_target_ml, monthly_meal_allowance, authorization_type,
    authorization_version, authorized_at
  ) VALUES (
    v_user_id, btrim(p_name), p_relationship, p_date_of_birth,
    EXTRACT(YEAR FROM p_date_of_birth)::INTEGER, NULLIF(p_gender, ''),
    COALESCE(p_dietary_preferences, '{}'::TEXT[]), COALESCE(p_allergies, '{}'::TEXT[]),
    p_calorie_target, p_protein_target_g, p_hydration_target_ml,
    p_monthly_meal_allowance, v_authorization, 'family-profile-v1', now()
  ) RETURNING id INTO v_member_id;

  INSERT INTO public.family_member_consent_events (
    family_member_id, main_user_id, event_type, authorization_type, consent_version
  ) VALUES (v_member_id, v_user_id, 'authorized', v_authorization, 'family-profile-v1');
  RETURN v_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_family_profile(
  p_family_member_id UUID,
  p_name TEXT,
  p_dietary_preferences TEXT[],
  p_allergies TEXT[],
  p_calorie_target INTEGER DEFAULT NULL,
  p_protein_target_g INTEGER DEFAULT NULL,
  p_hydration_target_ml INTEGER DEFAULT NULL,
  p_monthly_meal_allowance INTEGER DEFAULT 0
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'INVALID_FAMILY_NAME'; END IF;
  UPDATE public.family_members SET
    name = btrim(p_name), dietary_preferences = COALESCE(p_dietary_preferences, '{}'::TEXT[]),
    allergies = COALESCE(p_allergies, '{}'::TEXT[]), calorie_target = p_calorie_target,
    protein_target_g = p_protein_target_g, hydration_target_ml = p_hydration_target_ml,
    monthly_meal_allowance = p_monthly_meal_allowance, updated_at = now()
  WHERE id = p_family_member_id AND main_user_id = v_user_id AND status = 'active';
  IF FOUND THEN
    INSERT INTO public.family_member_consent_events (family_member_id, main_user_id, event_type, authorization_type, consent_version)
    SELECT id, main_user_id, 'updated', authorization_type, authorization_version
    FROM public.family_members WHERE id = p_family_member_id;
  END IF;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_my_family_profile(p_family_member_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  UPDATE public.family_members SET status = 'inactive', deactivated_at = now(), updated_at = now()
  WHERE id = p_family_member_id AND main_user_id = v_user_id AND status = 'active';
  IF FOUND THEN
    INSERT INTO public.family_member_consent_events (family_member_id, main_user_id, event_type, authorization_type, consent_version)
    SELECT id, main_user_id, 'withdrawn', authorization_type, authorization_version
    FROM public.family_members WHERE id = p_family_member_id;
  END IF;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_my_schedule_to_family_member(
  p_schedule_id UUID,
  p_family_member_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_user_id UUID := auth.uid(); v_meal_id UUID;
  v_member public.family_members%ROWTYPE;
  v_schedule public.meal_schedules%ROWTYPE;
  v_used_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT * INTO v_member
  FROM public.family_members
  WHERE id = p_family_member_id
    AND main_user_id = v_user_id
    AND status = 'active'
    AND authorized_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_schedule
  FROM public.meal_schedules
  WHERE id = p_schedule_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SCHEDULE_NOT_FOUND'; END IF;
  IF v_schedule.family_member_id = v_member.id THEN RETURN TRUE; END IF;
  IF COALESCE(v_schedule.order_status, 'pending') NOT IN ('pending', 'confirmed')
    OR v_schedule.scheduled_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'FAMILY_SCHEDULE_ASSIGNMENT_NOT_ALLOWED';
  END IF;
  v_meal_id := v_schedule.meal_id;

  IF v_member.monthly_meal_allowance > 0 THEN
    SELECT count(*) INTO v_used_count
    FROM public.meal_schedules schedule
    WHERE schedule.family_member_id = v_member.id
      AND schedule.scheduled_date >= date_trunc('month', CURRENT_DATE)::DATE
      AND schedule.scheduled_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::DATE
      AND COALESCE(schedule.order_status, 'pending') NOT IN ('cancelled', 'rejected');
    IF v_used_count >= v_member.monthly_meal_allowance THEN
      RAISE EXCEPTION 'FAMILY_ALLOWANCE_EXHAUSTED';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.family_members fm
    JOIN public.meal_allergens ma ON ma.meal_id = v_meal_id
    JOIN public.allergen_tags tag ON tag.id = ma.allergen_id
    WHERE fm.id = v_member.id
      AND lower(tag.name) = ANY(SELECT lower(value) FROM unnest(fm.allergies) value)
  ) THEN RAISE EXCEPTION 'FAMILY_MEMBER_ALLERGEN_CONFLICT'; END IF;
  UPDATE public.meal_schedules SET family_member_id = p_family_member_id, updated_at = now()
  WHERE id = p_schedule_id AND user_id = v_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_family_meals_atomic(
  p_subscription_id UUID,
  p_items JSONB,
  p_request_batch_id UUID,
  p_family_member_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_member public.family_members%ROWTYPE;
  v_result JSONB;
  v_schedule_id UUID;
  v_requested_count INTEGER;
  v_used_count INTEGER;
  v_existing_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;

  SELECT * INTO v_member
  FROM public.family_members
  WHERE id = p_family_member_id
    AND main_user_id = v_user_id
    AND status = 'active'
    AND authorized_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FAMILY_PROFILE_NOT_FOUND'; END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'SCHEDULE_ITEMS_INVALID'; END IF;
  v_requested_count := jsonb_array_length(p_items);
  IF v_requested_count < 1 OR v_requested_count > 14 THEN RAISE EXCEPTION 'SCHEDULE_ITEM_COUNT_INVALID'; END IF;

  SELECT count(*) INTO v_existing_count
  FROM public.meal_schedules schedule
  WHERE schedule.user_id = v_user_id
    AND schedule.request_batch_id = p_request_batch_id;
  IF v_existing_count > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.meal_schedules schedule
      WHERE schedule.user_id = v_user_id
        AND schedule.request_batch_id = p_request_batch_id
        AND schedule.family_member_id IS DISTINCT FROM v_member.id
    ) THEN RAISE EXCEPTION 'SCHEDULE_BENEFICIARY_MISMATCH'; END IF;
    RETURN public.schedule_meals_atomic(p_subscription_id, p_items, p_request_batch_id)
      || jsonb_build_object('family_member_id', v_member.id, 'beneficiary_name', v_member.name);
  END IF;

  IF v_member.monthly_meal_allowance > 0 THEN
    SELECT count(*) INTO v_used_count
    FROM public.meal_schedules schedule
    WHERE schedule.family_member_id = v_member.id
      AND schedule.scheduled_date >= date_trunc('month', CURRENT_DATE)::DATE
      AND schedule.scheduled_date < (date_trunc('month', CURRENT_DATE) + interval '1 month')::DATE
      AND COALESCE(schedule.order_status, 'pending') NOT IN ('cancelled', 'rejected');
    IF v_used_count + v_requested_count > v_member.monthly_meal_allowance THEN
      RAISE EXCEPTION 'FAMILY_ALLOWANCE_EXHAUSTED';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    JOIN public.meal_allergens ma ON ma.meal_id = (item ->> 'meal_id')::UUID
    JOIN public.allergen_tags tag ON tag.id = ma.allergen_id
    WHERE lower(tag.name) = ANY (
      SELECT lower(allergy) FROM unnest(COALESCE(v_member.allergies, '{}'::TEXT[])) allergy
    )
  ) THEN
    RAISE EXCEPTION 'FAMILY_MEMBER_ALLERGEN_CONFLICT';
  END IF;

  v_result := public.schedule_meals_atomic(p_subscription_id, p_items, p_request_batch_id);

  FOR v_schedule_id IN
    SELECT value::UUID FROM jsonb_array_elements_text(v_result -> 'schedule_ids') value
  LOOP
    UPDATE public.meal_schedules
    SET family_member_id = v_member.id, updated_at = now()
    WHERE id = v_schedule_id AND user_id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'SCHEDULE_NOT_FOUND'; END IF;
  END LOOP;

  RETURN v_result || jsonb_build_object(
    'family_member_id', v_member.id,
    'beneficiary_name', v_member.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_family_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_my_family_profile(TEXT, TEXT, DATE, TEXT, TEXT[], TEXT[], INTEGER, INTEGER, INTEGER, INTEGER, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_family_profile(UUID, TEXT, TEXT[], TEXT[], INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deactivate_my_family_profile(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_my_schedule_to_family_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_family_meals_atomic(UUID, JSONB, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_family_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_family_profile(TEXT, TEXT, DATE, TEXT, TEXT[], TEXT[], INTEGER, INTEGER, INTEGER, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_family_profile(UUID, TEXT, TEXT[], TEXT[], INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_my_family_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_my_schedule_to_family_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_family_meals_atomic(UUID, JSONB, UUID, UUID) TO authenticated;

COMMIT;
