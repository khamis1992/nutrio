-- Use canonical body_measurements for health compliance scoring.

CREATE OR REPLACE FUNCTION calculate_health_compliance_score(
  p_user_id uuid,
  p_week_start date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_macro_adherence decimal(5,2);
  v_meal_consistency decimal(5,2);
  v_weight_logging decimal(5,2);
  v_protein_accuracy decimal(5,2);
  v_overall_score decimal(5,2);
  v_body_measurements_count integer;
  v_target_meals integer;
  v_actual_meals integer;
  v_target_protein integer;
  v_actual_protein decimal(10,2);
BEGIN
  SELECT target_protein INTO v_target_protein
  FROM profiles
  WHERE id = p_user_id;

  SELECT COALESCE(AVG(
    CASE
      WHEN total_calories > 0 THEN
        100 - LEAST(ABS(total_calories - (SELECT target_calories FROM profiles WHERE id = p_user_id))::decimal /
          NULLIF((SELECT target_calories FROM profiles WHERE id = p_user_id), 0) * 100, 100)
      ELSE 0
    END
  ), 0) INTO v_macro_adherence
  FROM weekly_meal_plans
  WHERE user_id = p_user_id
    AND week_start_date >= p_week_start
    AND week_start_date < p_week_start + INTERVAL '7 days'
    AND user_accepted = true;

  SELECT
    COUNT(*) FILTER (WHERE wmpi.order_id IS NOT NULL),
    COUNT(*)
  INTO v_actual_meals, v_target_meals
  FROM weekly_meal_plan_items wmpi
  JOIN weekly_meal_plans wmp ON wmp.id = wmpi.plan_id
  WHERE wmp.user_id = p_user_id
    AND wmp.week_start_date >= p_week_start
    AND wmp.week_start_date < p_week_start + INTERVAL '7 days';

  v_meal_consistency := CASE
    WHEN v_target_meals > 0 THEN (v_actual_meals::decimal / v_target_meals) * 100
    ELSE 0
  END;

  SELECT COUNT(*) INTO v_body_measurements_count
  FROM body_measurements
  WHERE user_id = p_user_id
    AND log_date >= p_week_start
    AND log_date < p_week_start + INTERVAL '7 days'
    AND weight_kg IS NOT NULL;

  v_weight_logging := LEAST(v_body_measurements_count::decimal / 1 * 100, 100);

  SELECT COALESCE(AVG(wmpi.protein), 0) INTO v_actual_protein
  FROM weekly_meal_plan_items wmpi
  JOIN weekly_meal_plans wmp ON wmp.id = wmpi.plan_id
  WHERE wmp.user_id = p_user_id
    AND wmp.week_start_date >= p_week_start
    AND wmp.week_start_date < p_week_start + INTERVAL '7 days'
    AND wmpi.order_id IS NOT NULL;

  v_protein_accuracy := CASE
    WHEN v_target_protein > 0 AND v_actual_protein > 0 THEN
      100 - LEAST(ABS(v_actual_protein - v_target_protein)::decimal / v_target_protein * 100, 100)
    ELSE 50
  END;

  v_overall_score :=
    (v_macro_adherence * 0.40) +
    (v_meal_consistency * 0.30) +
    (v_weight_logging * 0.20) +
    (v_protein_accuracy * 0.10);

  v_overall_score := GREATEST(0, LEAST(100, v_overall_score));
  v_overall_score := ROUND(v_overall_score, 2);
  v_macro_adherence := ROUND(v_macro_adherence, 2);
  v_meal_consistency := ROUND(v_meal_consistency, 2);
  v_weight_logging := ROUND(v_weight_logging, 2);
  v_protein_accuracy := ROUND(v_protein_accuracy, 2);

  INSERT INTO user_health_scores (
    user_id, score_week_start, macro_adherence_score,
    meal_consistency_score, weight_logging_score, protein_accuracy_score,
    overall_score, metrics_used
  ) VALUES (
    p_user_id, p_week_start, v_macro_adherence,
    v_meal_consistency, v_weight_logging, v_protein_accuracy,
    v_overall_score,
    jsonb_build_object(
      'body_measurements_count', v_body_measurements_count,
      'weight_logs_count', v_body_measurements_count,
      'target_meals', v_target_meals,
      'actual_meals', v_actual_meals,
      'target_protein', v_target_protein,
      'actual_protein_avg', v_actual_protein
    )
  )
  ON CONFLICT (user_id, score_week_start)
  DO UPDATE SET
    macro_adherence_score = EXCLUDED.macro_adherence_score,
    meal_consistency_score = EXCLUDED.meal_consistency_score,
    weight_logging_score = EXCLUDED.weight_logging_score,
    protein_accuracy_score = EXCLUDED.protein_accuracy_score,
    overall_score = EXCLUDED.overall_score,
    metrics_used = EXCLUDED.metrics_used,
    calculated_at = now();

  UPDATE subscriptions
  SET last_health_score = v_overall_score,
      last_health_score_at = now()
  WHERE user_id = p_user_id
    AND status = 'active';

  INSERT INTO retention_audit_logs (
    user_id, action_type, action_details, triggered_by
  ) VALUES (
    p_user_id, 'health_score_calculated',
    jsonb_build_object(
      'week_start', p_week_start,
      'macro_adherence', v_macro_adherence,
      'meal_consistency', v_meal_consistency,
      'weight_logging', v_weight_logging,
      'protein_accuracy', v_protein_accuracy,
      'overall_score', v_overall_score
    ),
    'system'
  );

  RETURN jsonb_build_object(
    'success', true,
    'overall_score', v_overall_score,
    'category', CASE
      WHEN v_overall_score >= 80 THEN 'green'
      WHEN v_overall_score >= 60 THEN 'orange'
      ELSE 'red'
    END,
    'breakdown', jsonb_build_object(
      'macro_adherence', v_macro_adherence,
      'meal_consistency', v_meal_consistency,
      'weight_logging', v_weight_logging,
      'protein_accuracy', v_protein_accuracy
    )
  );
END;
$$;
