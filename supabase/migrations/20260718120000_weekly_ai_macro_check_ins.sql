BEGIN;

CREATE TABLE IF NOT EXISTS public.weekly_ai_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  energy_rating SMALLINT NOT NULL CHECK (energy_rating BETWEEN 1 AND 5),
  hunger_rating SMALLINT NOT NULL CHECK (hunger_rating BETWEEN 1 AND 5),
  recovery_rating SMALLINT NOT NULL CHECK (recovery_rating BETWEEN 1 AND 5),
  plan_adherence_rating SMALLINT NOT NULL CHECK (plan_adherence_rating BETWEEN 1 AND 5),
  weight_kg NUMERIC(5,2) CHECK (weight_kg IS NULL OR weight_kg BETWEEN 25 AND 350),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  status TEXT NOT NULL DEFAULT 'reviewed'
    CHECK (status IN ('reviewed', 'applied', 'dismissed')),
  adjustment_id UUID REFERENCES public.goal_adjustment_history(id) ON DELETE SET NULL,
  current_targets JSONB NOT NULL CHECK (jsonb_typeof(current_targets) = 'object'),
  proposed_targets JSONB NOT NULL CHECK (jsonb_typeof(proposed_targets) = 'object'),
  review_summary TEXT NOT NULL CHECK (char_length(review_summary) BETWEEN 1 AND 2000),
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  days_logged SMALLINT NOT NULL DEFAULT 0 CHECK (days_logged BETWEEN 0 AND 7),
  adherence_rate NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (adherence_rate BETWEEN 0 AND 1),
  weight_change_kg NUMERIC(5,2) CHECK (weight_change_kg IS NULL OR weight_change_kg BETWEEN -100 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_ai_check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own weekly AI check-ins" ON public.weekly_ai_check_ins;
CREATE POLICY "Users can view own weekly AI check-ins"
  ON public.weekly_ai_check_ins
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS weekly_ai_check_ins_user_week_idx
  ON public.weekly_ai_check_ins (user_id, week_start DESC);

CREATE OR REPLACE FUNCTION public.get_current_weekly_ai_check_in()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT to_jsonb(check_in)
  FROM public.weekly_ai_check_ins AS check_in
  WHERE check_in.user_id = (SELECT auth.uid())
    AND check_in.week_start = (
      CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER
    )
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_weekly_ai_check_in(
  p_check_in_id UUID,
  p_decision TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_check_in public.weekly_ai_check_ins%ROWTYPE;
  v_adjustment public.goal_adjustment_history%ROWTYPE;
  v_goal public.nutrition_goals%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_decision NOT IN ('apply', 'dismiss') THEN
    RAISE EXCEPTION 'INVALID_WEEKLY_CHECK_IN_DECISION';
  END IF;

  SELECT * INTO v_check_in
  FROM public.weekly_ai_check_ins
  WHERE id = p_check_in_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WEEKLY_CHECK_IN_NOT_FOUND';
  END IF;
  IF v_check_in.status <> 'reviewed' THEN
    RETURN jsonb_build_object('status', v_check_in.status, 'already_resolved', true);
  END IF;

  IF p_decision = 'dismiss' THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'dismissed', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;

    UPDATE public.profiles
    SET has_unviewed_adjustment = false
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object('status', 'dismissed', 'already_resolved', false);
  END IF;

  IF v_check_in.adjustment_id IS NULL THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'applied', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;
    RETURN jsonb_build_object('status', 'applied', 'changed', false);
  END IF;

  SELECT * INTO v_adjustment
  FROM public.goal_adjustment_history
  WHERE id = v_check_in.adjustment_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ADJUSTMENT_NOT_FOUND';
  END IF;

  SELECT * INTO v_goal
  FROM public.nutrition_goals
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_NUTRITION_GOAL_NOT_FOUND';
  END IF;

  UPDATE public.nutrition_goals
  SET daily_calorie_target = v_adjustment.new_calories,
      protein_target_g = COALESCE((v_adjustment.new_macros ->> 'protein')::INTEGER, protein_target_g),
      carbs_target_g = COALESCE((v_adjustment.new_macros ->> 'carbs')::INTEGER, carbs_target_g),
      fat_target_g = COALESCE((v_adjustment.new_macros ->> 'fat')::INTEGER, fat_target_g),
      calculation_source = 'weekly_ai_check_in',
      reason = v_adjustment.reason,
      version = COALESCE(version, 1) + 1,
      updated_at = v_now
  WHERE id = v_goal.id;

  UPDATE public.profiles
  SET daily_calorie_target = v_adjustment.new_calories,
      protein_target_g = COALESCE((v_adjustment.new_macros ->> 'protein')::INTEGER, protein_target_g),
      carbs_target_g = COALESCE((v_adjustment.new_macros ->> 'carbs')::INTEGER, carbs_target_g),
      fat_target_g = COALESCE((v_adjustment.new_macros ->> 'fat')::INTEGER, fat_target_g),
      last_goal_adjustment_date = CURRENT_DATE,
      has_unviewed_adjustment = false
  WHERE user_id = v_user_id;

  UPDATE public.goal_adjustment_history
  SET applied = true
  WHERE id = v_adjustment.id;

  INSERT INTO public.nutrition_goal_events (
    user_id, goal_id, event_type, previous_values, new_values, reason
  ) VALUES (
    v_user_id,
    v_goal.id,
    'smart_adjusted',
    jsonb_build_object(
      'daily_calorie_target', v_goal.daily_calorie_target,
      'protein_target_g', v_goal.protein_target_g,
      'carbs_target_g', v_goal.carbs_target_g,
      'fat_target_g', v_goal.fat_target_g
    ),
    v_check_in.proposed_targets,
    v_adjustment.reason
  );

  UPDATE public.weekly_ai_check_ins
  SET status = 'applied', resolved_at = v_now, updated_at = v_now
  WHERE id = v_check_in.id;

  RETURN jsonb_build_object('status', 'applied', 'changed', true);
END;
$function$;

REVOKE ALL ON TABLE public.weekly_ai_check_ins FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.weekly_ai_check_ins TO authenticated;
GRANT ALL ON TABLE public.weekly_ai_check_ins TO service_role;

REVOKE ALL ON FUNCTION public.get_current_weekly_ai_check_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_weekly_ai_check_in() TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_weekly_ai_check_in(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_weekly_ai_check_in(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.weekly_ai_check_ins IS
  'One user-reviewed adaptive macro check-in per week. Proposed targets require explicit resolution.';
COMMENT ON FUNCTION public.resolve_weekly_ai_check_in(UUID, TEXT) IS
  'Atomically applies or dismisses a weekly macro recommendation for the authenticated user.';

COMMIT;
