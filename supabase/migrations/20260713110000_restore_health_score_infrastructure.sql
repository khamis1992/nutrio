BEGIN;

CREATE TABLE IF NOT EXISTS public.user_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  score_week_start DATE NOT NULL,
  macro_adherence_score NUMERIC(5, 2) CHECK (macro_adherence_score BETWEEN 0 AND 100),
  meal_consistency_score NUMERIC(5, 2) CHECK (meal_consistency_score BETWEEN 0 AND 100),
  weight_logging_score NUMERIC(5, 2) CHECK (weight_logging_score BETWEEN 0 AND 100),
  protein_accuracy_score NUMERIC(5, 2) CHECK (protein_accuracy_score BETWEEN 0 AND 100),
  overall_score NUMERIC(5, 2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  category TEXT GENERATED ALWAYS AS (
    CASE
      WHEN overall_score >= 80 THEN 'green'
      WHEN overall_score >= 60 THEN 'orange'
      ELSE 'red'
    END
  ) STORED,
  metrics_used JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, score_week_start)
);

CREATE INDEX IF NOT EXISTS idx_health_scores_user
  ON public.user_health_scores(user_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_scores_week
  ON public.user_health_scores(score_week_start);

CREATE TABLE IF NOT EXISTS public.retention_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  action_details JSONB NOT NULL DEFAULT '{}'::JSONB,
  previous_state JSONB,
  new_state JSONB,
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('user', 'system', 'admin')),
  triggered_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.retention_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.retention_audit_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_subscription
  ON public.retention_audit_logs(subscription_id);

CREATE TABLE IF NOT EXISTS public.meal_history_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_history_id UUID NOT NULL,
  meal_name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  logged_at TIMESTAMPTZ,
  action VARCHAR(20) NOT NULL CHECK (action IN ('delete', 'undone')),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meal_history_audit_user
  ON public.meal_history_audit(user_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_history_audit_meal
  ON public.meal_history_audit(meal_history_id);

ALTER TABLE public.user_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_history_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS health_scores_user_own ON public.user_health_scores;
CREATE POLICY health_scores_user_own
  ON public.user_health_scores FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS health_scores_admin_all ON public.user_health_scores;
CREATE POLICY health_scores_admin_all
  ON public.user_health_scores FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS audit_logs_user_own ON public.retention_audit_logs;
CREATE POLICY audit_logs_user_own
  ON public.retention_audit_logs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS audit_logs_admin_all ON public.retention_audit_logs;
CREATE POLICY audit_logs_admin_all
  ON public.retention_audit_logs FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS meal_history_audit_owner_read ON public.meal_history_audit;
CREATE POLICY meal_history_audit_owner_read
  ON public.meal_history_audit FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.user_health_scores,
  public.retention_audit_logs, public.meal_history_audit FROM authenticated, anon;
GRANT SELECT ON public.user_health_scores,
  public.retention_audit_logs, public.meal_history_audit TO authenticated;
GRANT ALL ON public.user_health_scores,
  public.retention_audit_logs, public.meal_history_audit TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_health_compliance_score(
  p_user_id UUID,
  p_week_start DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_calorie_target INTEGER;
  v_protein_target INTEGER;
  v_target_meals INTEGER;
  v_actual_meals INTEGER;
  v_days_logged INTEGER;
  v_weight_logs INTEGER;
  v_avg_calories NUMERIC := 0;
  v_avg_protein NUMERIC := 0;
  v_macro_score NUMERIC := 0;
  v_meal_score NUMERIC := 0;
  v_weight_score NUMERIC := 0;
  v_protein_score NUMERIC := 0;
  v_overall NUMERIC := 0;
BEGIN
  IF p_user_id IS NULL OR p_week_start IS NULL THEN
    RAISE EXCEPTION 'user_id and week_start are required';
  END IF;

  IF v_actor IS NOT NULL
     AND v_actor <> p_user_id
     AND NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(daily_calorie_target, 2000), COALESCE(protein_target_g, 100)
  INTO v_calorie_target, v_protein_target
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  SELECT COALESCE(MAX(meals_per_week), 7)
  INTO v_target_meals
  FROM public.subscriptions
  WHERE user_id = p_user_id AND status = 'active';
  v_target_meals := GREATEST(COALESCE(v_target_meals, 7), 1);

  SELECT COUNT(*), COUNT(DISTINCT logged_at::DATE)
  INTO v_actual_meals, v_days_logged
  FROM public.meal_history
  WHERE user_id = p_user_id
    AND logged_at >= p_week_start
    AND logged_at < p_week_start + 7;

  SELECT COALESCE(AVG(day_calories), 0), COALESCE(AVG(day_protein), 0)
  INTO v_avg_calories, v_avg_protein
  FROM (
    SELECT logged_at::DATE,
      SUM(COALESCE(calories, 0)) AS day_calories,
      SUM(COALESCE(protein_g, 0)) AS day_protein
    FROM public.meal_history
    WHERE user_id = p_user_id
      AND logged_at >= p_week_start
      AND logged_at < p_week_start + 7
    GROUP BY logged_at::DATE
  ) daily;

  SELECT COUNT(*) INTO v_weight_logs
  FROM public.body_measurements
  WHERE user_id = p_user_id
    AND log_date >= p_week_start
    AND log_date < p_week_start + 7
    AND weight_kg IS NOT NULL;

  IF v_days_logged > 0 THEN
    v_macro_score := 100 - LEAST(
      ABS(v_avg_calories - v_calorie_target) / NULLIF(v_calorie_target, 0) * 100,
      100
    );
    v_protein_score := 100 - LEAST(
      ABS(v_avg_protein - v_protein_target) / NULLIF(v_protein_target, 0) * 100,
      100
    );
  END IF;

  v_meal_score := LEAST(v_actual_meals::NUMERIC / v_target_meals * 100, 100);
  v_weight_score := LEAST(v_weight_logs * 100, 100);
  v_overall := ROUND(GREATEST(0, LEAST(100,
    v_macro_score * 0.40
    + v_meal_score * 0.30
    + v_weight_score * 0.20
    + v_protein_score * 0.10
  )), 2);

  INSERT INTO public.user_health_scores (
    user_id, score_week_start, macro_adherence_score,
    meal_consistency_score, weight_logging_score,
    protein_accuracy_score, overall_score, metrics_used, calculated_at
  ) VALUES (
    p_user_id, p_week_start, ROUND(v_macro_score, 2),
    ROUND(v_meal_score, 2), ROUND(v_weight_score, 2),
    ROUND(v_protein_score, 2), v_overall,
    jsonb_build_object(
      'body_measurements_count', v_weight_logs,
      'weight_logs_count', v_weight_logs,
      'target_meals', v_target_meals,
      'actual_meals', v_actual_meals,
      'target_protein', v_protein_target,
      'actual_protein_avg', ROUND(v_avg_protein, 2),
      'days_logged', v_days_logged,
      'average_calories', ROUND(v_avg_calories, 2)
    ), now()
  )
  ON CONFLICT (user_id, score_week_start) DO UPDATE SET
    macro_adherence_score = EXCLUDED.macro_adherence_score,
    meal_consistency_score = EXCLUDED.meal_consistency_score,
    weight_logging_score = EXCLUDED.weight_logging_score,
    protein_accuracy_score = EXCLUDED.protein_accuracy_score,
    overall_score = EXCLUDED.overall_score,
    metrics_used = EXCLUDED.metrics_used,
    calculated_at = now();

  INSERT INTO public.retention_audit_logs (
    user_id, action_type, action_details, triggered_by, triggered_by_user_id
  ) VALUES (
    p_user_id, 'health_score_calculated',
    jsonb_build_object('week_start', p_week_start, 'overall_score', v_overall),
    CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END,
    v_actor
  );

  RETURN jsonb_build_object(
    'success', true,
    'overall_score', v_overall,
    'category', CASE WHEN v_overall >= 80 THEN 'green' WHEN v_overall >= 60 THEN 'orange' ELSE 'red' END,
    'breakdown', jsonb_build_object(
      'macro_adherence', ROUND(v_macro_score, 2),
      'meal_consistency', ROUND(v_meal_score, 2),
      'weight_logging', ROUND(v_weight_score, 2),
      'protein_accuracy', ROUND(v_protein_score, 2)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_health_compliance_score(UUID, DATE)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_health_compliance_score(UUID, DATE)
  TO authenticated, service_role;

COMMIT;
