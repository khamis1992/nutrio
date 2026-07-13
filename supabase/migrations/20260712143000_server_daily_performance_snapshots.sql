-- Daily performance is derived from authoritative logs, never client scores.

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'health_tracking_goals',
  '{"water_goal_ml": 2500, "step_goal": 6000}'::JSONB,
  'Server defaults used when a customer has not configured tracking goals.'
)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_health_tracking_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  water_goal_ml INTEGER NOT NULL DEFAULT 2500
    CHECK (water_goal_ml BETWEEN 1000 AND 10000),
  step_goal INTEGER NOT NULL DEFAULT 6000
    CHECK (step_goal BETWEEN 1000 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_health_tracking_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_health_tracking_goals_owner_read
  ON public.user_health_tracking_goals;
CREATE POLICY user_health_tracking_goals_owner_read
  ON public.user_health_tracking_goals
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.user_health_tracking_goals FROM anon, authenticated;
GRANT SELECT ON public.user_health_tracking_goals TO authenticated;
GRANT ALL ON public.user_health_tracking_goals TO service_role;

CREATE OR REPLACE FUNCTION public.get_own_health_tracking_goals()
RETURNS TABLE (water_goal_ml INTEGER, step_goal INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(
      goals.water_goal_ml,
      (settings.value ->> 'water_goal_ml')::INTEGER,
      2500
    ),
    COALESCE(
      goals.step_goal,
      (settings.value ->> 'step_goal')::INTEGER,
      6000
    )
  FROM (SELECT 1) seed
  LEFT JOIN public.user_health_tracking_goals goals
    ON goals.user_id = v_actor
  LEFT JOIN public.platform_settings settings
    ON settings.key = 'health_tracking_goals';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_own_health_tracking_goals(
  p_water_goal_ml INTEGER DEFAULT NULL,
  p_step_goal INTEGER DEFAULT NULL
)
RETURNS TABLE (water_goal_ml INTEGER, step_goal INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_defaults RECORD;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT * INTO v_defaults FROM public.get_own_health_tracking_goals();

  IF p_water_goal_ml IS NOT NULL AND p_water_goal_ml NOT BETWEEN 1000 AND 10000 THEN
    RAISE EXCEPTION 'INVALID_WATER_GOAL';
  END IF;
  IF p_step_goal IS NOT NULL AND p_step_goal NOT BETWEEN 1000 AND 100000 THEN
    RAISE EXCEPTION 'INVALID_STEP_GOAL';
  END IF;

  INSERT INTO public.user_health_tracking_goals (
    user_id, water_goal_ml, step_goal, updated_at
  ) VALUES (
    v_actor,
    COALESCE(p_water_goal_ml, v_defaults.water_goal_ml),
    COALESCE(p_step_goal, v_defaults.step_goal),
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET water_goal_ml = COALESCE(p_water_goal_ml, public.user_health_tracking_goals.water_goal_ml),
      step_goal = COALESCE(p_step_goal, public.user_health_tracking_goals.step_goal),
      updated_at = NOW();

  RETURN QUERY
  SELECT goals.water_goal_ml, goals.step_goal
  FROM public.user_health_tracking_goals goals
  WHERE goals.user_id = v_actor;
END;
$$;

REVOKE ALL ON FUNCTION public.get_own_health_tracking_goals()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_own_health_tracking_goals(INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_health_tracking_goals(),
  public.set_own_health_tracking_goals(INTEGER, INTEGER)
  TO authenticated, service_role;

DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_performance_snapshots'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.daily_performance_snapshots',
      v_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY daily_performance_snapshot_owner_read
  ON public.daily_performance_snapshots
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY daily_performance_snapshot_admin_read
  ON public.daily_performance_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

REVOKE ALL ON public.daily_performance_snapshots FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.daily_performance_snapshots
  FROM authenticated;
GRANT SELECT ON public.daily_performance_snapshots TO authenticated;
GRANT ALL ON public.daily_performance_snapshots TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_daily_performance_snapshot(
  p_snapshot_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_date DATE := COALESCE(p_snapshot_date, (NOW() AT TIME ZONE 'Asia/Qatar')::DATE);
  v_calories INTEGER := 0;
  v_protein INTEGER := 0;
  v_meals INTEGER := 0;
  v_water_ml INTEGER := 0;
  v_water_goal INTEGER := 2500;
  v_water_percent INTEGER := 0;
  v_calorie_target INTEGER := 0;
  v_protein_target INTEGER := 0;
  v_body_load INTEGER := 0;
  v_calorie_score NUMERIC := 0;
  v_protein_score NUMERIC := 0;
  v_water_score NUMERIC := 0;
  v_meal_score NUMERIC := 0;
  v_score INTEGER := 0;
  v_weight NUMERIC := 0;
  v_weighted_score NUMERIC := 0;
  v_primary_reason TEXT;
  v_reasons JSONB := '[]'::JSONB;
  v_awards JSONB := '[]'::JSONB;
  v_award JSONB;
  v_snapshot public.daily_performance_snapshots%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF v_date > v_today OR v_date < v_today - 30 THEN
    RAISE EXCEPTION 'SNAPSHOT_DATE_OUT_OF_RANGE';
  END IF;

  SELECT
    COALESCE(ROUND(SUM(mh.calories)), 0)::INTEGER,
    COALESCE(ROUND(SUM(mh.protein_g)), 0)::INTEGER,
    COUNT(*)::INTEGER
    INTO v_calories, v_protein, v_meals
  FROM public.meal_history mh
  WHERE mh.user_id = v_actor
    AND (COALESCE(mh.logged_at, mh.created_at) AT TIME ZONE 'Asia/Qatar')::DATE = v_date;

  SELECT COALESCE(SUM(we.amount_ml), 0)::INTEGER
    INTO v_water_ml
  FROM public.water_entries we
  WHERE we.user_id = v_actor
    AND we.log_date = v_date;

  SELECT
    COALESCE(ng.daily_calorie_target, 0)::INTEGER,
    COALESCE(ng.protein_target_g, 0)::INTEGER
    INTO v_calorie_target, v_protein_target
  FROM public.nutrition_goals ng
  WHERE ng.user_id = v_actor
    AND COALESCE(ng.is_active, TRUE) = TRUE
  ORDER BY ng.updated_at DESC NULLS LAST, ng.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT GREATEST(1, goals.water_goal_ml)
    INTO v_water_goal
  FROM public.get_own_health_tracking_goals() goals;

  v_water_goal := COALESCE(v_water_goal, 2500);
  v_water_percent := LEAST(200, ROUND(v_water_ml::NUMERIC * 100 / v_water_goal)::INTEGER);

  SELECT COALESCE(
      ROUND(SUM(COALESCE(ws.duration_minutes, 0))),
      0
    )::INTEGER
    INTO v_body_load
  FROM public.workout_sessions ws
  WHERE ws.user_id = v_actor
    AND ws.session_date = v_date
    AND COALESCE(ws.confirmed, TRUE) = TRUE;

  IF v_calorie_target > 0 THEN
    v_calorie_score := GREATEST(
      0,
      100 - ABS(v_calories - v_calorie_target)::NUMERIC * 100 / v_calorie_target
    );
    v_weighted_score := v_weighted_score + v_calorie_score * 0.40;
    v_weight := v_weight + 0.40;
  END IF;

  IF v_protein_target > 0 THEN
    v_protein_score := LEAST(100, v_protein::NUMERIC * 100 / v_protein_target);
    v_weighted_score := v_weighted_score + v_protein_score * 0.30;
    v_weight := v_weight + 0.30;
  END IF;

  v_water_score := LEAST(100, v_water_percent);
  v_meal_score := LEAST(100, v_meals::NUMERIC * 100 / 3);
  v_weighted_score := v_weighted_score + v_water_score * 0.20 + v_meal_score * 0.10;
  v_weight := v_weight + 0.30;
  v_score := LEAST(100, GREATEST(0, ROUND(v_weighted_score / NULLIF(v_weight, 0))::INTEGER));

  IF v_meals = 0 THEN
    v_primary_reason := 'No consumed meals logged';
    v_reasons := v_reasons || jsonb_build_array('Log consumed meals to calculate nutrition performance.');
  ELSIF v_protein_target > 0 AND v_protein < v_protein_target THEN
    v_primary_reason := 'Protein target is still open';
    v_reasons := v_reasons || jsonb_build_array('Protein remains below the active nutrition goal.');
  ELSIF v_water_percent < 100 THEN
    v_primary_reason := 'Hydration target is still open';
    v_reasons := v_reasons || jsonb_build_array('Water remains below the configured daily goal.');
  ELSE
    v_primary_reason := 'Daily targets are on track';
    v_reasons := v_reasons || jsonb_build_array('Consumed meals and hydration are on track.');
  END IF;

  IF v_score >= 85 THEN
    v_awards := v_awards || jsonb_build_array(jsonb_build_object(
      'actionType', 'nutrition_fuel_score',
      'sourceId', 'fuel-score-' || v_date::TEXT,
      'xp', 25,
      'reason', 'Strong daily fuel score'
    ));
  END IF;
  IF v_protein_target > 0 AND v_protein >= v_protein_target THEN
    v_awards := v_awards || jsonb_build_array(jsonb_build_object(
      'actionType', 'protein_target_day',
      'sourceId', 'protein-target-' || v_date::TEXT,
      'xp', 20,
      'reason', 'Protein target reached'
    ));
  END IF;
  IF v_water_percent >= 100 THEN
    v_awards := v_awards || jsonb_build_array(jsonb_build_object(
      'actionType', 'hydration_target_day',
      'sourceId', 'hydration-target-' || v_date::TEXT,
      'xp', 15,
      'reason', 'Hydration target reached'
    ));
  END IF;

  FOR v_award IN
    SELECT value
    FROM jsonb_array_elements(v_awards)
  LOOP
    PERFORM public.award_xp(
      v_actor,
      (v_award ->> 'xp')::INTEGER,
      v_award ->> 'reason',
      v_award ->> 'actionType',
      v_award ->> 'sourceId',
      jsonb_build_object(
        'snapshot_date', v_date,
        'nutrition_score', v_score,
        'calories_consumed', v_calories,
        'protein_consumed_g', v_protein,
        'water_percent', v_water_percent
      )
    );
  END LOOP;

  INSERT INTO public.daily_performance_snapshots (
    user_id,
    snapshot_date,
    nutrition_score,
    readiness_score,
    body_load,
    calories_consumed,
    calorie_target,
    protein_consumed_g,
    protein_target_g,
    water_percent,
    meals_logged,
    recommended_meal_id,
    primary_reason,
    reasons,
    awards,
    updated_at
  ) VALUES (
    v_actor,
    v_date,
    v_score,
    NULL,
    v_body_load,
    v_calories,
    v_calorie_target,
    v_protein,
    v_protein_target,
    v_water_percent,
    v_meals,
    NULL,
    v_primary_reason,
    v_reasons,
    v_awards,
    NOW()
  )
  ON CONFLICT (user_id, snapshot_date)
  DO UPDATE SET
    nutrition_score = EXCLUDED.nutrition_score,
    readiness_score = EXCLUDED.readiness_score,
    body_load = EXCLUDED.body_load,
    calories_consumed = EXCLUDED.calories_consumed,
    calorie_target = EXCLUDED.calorie_target,
    protein_consumed_g = EXCLUDED.protein_consumed_g,
    protein_target_g = EXCLUDED.protein_target_g,
    water_percent = EXCLUDED.water_percent,
    meals_logged = EXCLUDED.meals_logged,
    recommended_meal_id = EXCLUDED.recommended_meal_id,
    primary_reason = EXCLUDED.primary_reason,
    reasons = EXCLUDED.reasons,
    awards = EXCLUDED.awards,
    updated_at = NOW()
  RETURNING * INTO v_snapshot;

  RETURN TO_JSONB(v_snapshot);
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_daily_performance_snapshot(DATE)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_daily_performance_snapshot(DATE)
  TO authenticated, service_role;
