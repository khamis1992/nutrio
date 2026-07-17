BEGIN;

CREATE OR REPLACE FUNCTION public.create_weekly_ai_check_in(
  p_energy_rating SMALLINT,
  p_hunger_rating SMALLINT,
  p_recovery_rating SMALLINT,
  p_plan_adherence_rating SMALLINT,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_week_start DATE := CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INTEGER;
  v_current_calories INTEGER;
  v_current_protein INTEGER;
  v_current_carbs INTEGER;
  v_current_fat INTEGER;
  v_new_calories INTEGER;
  v_new_protein INTEGER;
  v_new_carbs INTEGER;
  v_new_fat INTEGER;
  v_goal_type TEXT;
  v_days_logged INTEGER := 0;
  v_days_on_target INTEGER := 0;
  v_adherence NUMERIC := 0;
  v_first_weight NUMERIC;
  v_last_weight NUMERIC;
  v_weight_count INTEGER := 0;
  v_weight_change NUMERIC;
  v_confidence NUMERIC := 0.62;
  v_summary TEXT;
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_energy_rating NOT BETWEEN 1 AND 5
     OR p_hunger_rating NOT BETWEEN 1 AND 5
     OR p_recovery_rating NOT BETWEEN 1 AND 5
     OR p_plan_adherence_rating NOT BETWEEN 1 AND 5
     OR (p_weight_kg IS NOT NULL AND p_weight_kg NOT BETWEEN 25 AND 350)
     OR char_length(COALESCE(p_notes, '')) > 500
  THEN
    RAISE EXCEPTION 'INVALID_WEEKLY_CHECK_IN';
  END IF;

  SELECT
    COALESCE(goal.daily_calorie_target, profile.daily_calorie_target, 2000),
    COALESCE(goal.protein_target_g, profile.protein_target_g, 120),
    COALESCE(goal.carbs_target_g, profile.carbs_target_g, 250),
    COALESCE(goal.fat_target_g, profile.fat_target_g, 65),
    lower(CASE
      WHEN goal.goal_type IS NOT NULL THEN goal.goal_type::TEXT
      WHEN profile.health_goal IS NOT NULL THEN profile.health_goal::TEXT
      ELSE 'maintenance'
    END)
  INTO v_current_calories, v_current_protein, v_current_carbs, v_current_fat, v_goal_type
  FROM public.profiles AS profile
  LEFT JOIN LATERAL (
    SELECT nutrition_goal.*
    FROM public.nutrition_goals AS nutrition_goal
    WHERE nutrition_goal.user_id = profile.user_id
      AND nutrition_goal.is_active = true
    ORDER BY nutrition_goal.created_at DESC
    LIMIT 1
  ) AS goal ON true
  WHERE profile.user_id = v_user_id;

  IF v_current_calories IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  SELECT
    COUNT(DISTINCT log_date)::INTEGER,
    COUNT(DISTINCT log_date) FILTER (
      WHERE ABS(calories_consumed - v_current_calories) <= v_current_calories * 0.10
    )::INTEGER
  INTO v_days_logged, v_days_on_target
  FROM public.progress_logs
  WHERE user_id = v_user_id
    AND log_date BETWEEN v_week_start AND v_week_start + 6
    AND calories_consumed IS NOT NULL;

  v_adherence := CASE
    WHEN v_days_logged = 0 THEN 0
    ELSE LEAST(1, v_days_on_target::NUMERIC / v_days_logged)
  END;

  SELECT
    (ARRAY_AGG(weight_kg ORDER BY log_date ASC))[1],
    (ARRAY_AGG(weight_kg ORDER BY log_date DESC))[1],
    COUNT(*)::INTEGER
  INTO v_first_weight, v_last_weight, v_weight_count
  FROM public.body_measurements
  WHERE user_id = v_user_id
    AND weight_kg IS NOT NULL
    AND log_date >= CURRENT_DATE - 28;

  v_weight_change := CASE WHEN v_weight_count >= 2 THEN ROUND(v_last_weight - v_first_weight, 2) ELSE NULL END;
  v_new_calories := v_current_calories;
  v_new_protein := v_current_protein;
  v_new_carbs := v_current_carbs;
  v_new_fat := v_current_fat;

  IF v_days_logged < 3 OR p_plan_adherence_rating <= 2 THEN
    v_summary := 'There is not enough consistent data to change your targets safely. Keep the current plan and log at least three days before the next review.';
    v_confidence := 0.60;
  ELSIF p_energy_rating <= 2 OR p_recovery_rating <= 2 OR p_hunger_rating >= 4 THEN
    v_summary := 'Your energy, recovery, or hunger feedback suggests holding the current targets for another week instead of reducing intake.';
    v_confidence := 0.72;
  ELSIF v_weight_count < 2 THEN
    v_summary := 'Your meal data is useful, but a second weight check-in will make target changes more reliable. Keep the current targets this week.';
    v_confidence := 0.68;
  ELSIF v_goal_type IN ('weight_loss', 'lose', 'lose_weight') AND ABS(v_weight_change) < 0.20 AND v_adherence >= 0.50 THEN
    v_new_calories := GREATEST(1200, v_current_calories - 100);
    v_new_protein := ROUND((v_new_calories * 0.35) / 4.0);
    v_new_carbs := ROUND((v_new_calories * 0.35) / 4.0);
    v_new_fat := ROUND((v_new_calories * 0.30) / 9.0);
    v_summary := 'Your logged intake was reasonably consistent while weight stayed stable. A small 100 kcal adjustment is suggested for the next week.';
    v_confidence := 0.82;
  ELSIF v_goal_type IN ('muscle_gain', 'gain', 'gain_weight') AND ABS(v_weight_change) < 0.20 AND v_adherence >= 0.50 THEN
    v_new_calories := LEAST(4000, v_current_calories + 150);
    v_new_protein := ROUND((v_new_calories * 0.30) / 4.0);
    v_new_carbs := ROUND((v_new_calories * 0.45) / 4.0);
    v_new_fat := ROUND((v_new_calories * 0.25) / 9.0);
    v_summary := 'Your logged intake was consistent while weight stayed stable. A modest calorie increase is suggested to support your goal.';
    v_confidence := 0.82;
  ELSE
    v_summary := 'Your current targets remain aligned with the available progress data and your weekly feedback. No macro change is recommended.';
    v_confidence := 0.86;
  END IF;

  INSERT INTO public.weekly_ai_check_ins (
    user_id, week_start, energy_rating, hunger_rating, recovery_rating,
    plan_adherence_rating, weight_kg, notes, status, adjustment_id,
    current_targets, proposed_targets, review_summary, confidence,
    days_logged, adherence_rate, weight_change_kg, updated_at, resolved_at
  ) VALUES (
    v_user_id, v_week_start, p_energy_rating, p_hunger_rating, p_recovery_rating,
    p_plan_adherence_rating, p_weight_kg, NULLIF(trim(p_notes), ''), 'reviewed', NULL,
    jsonb_build_object('calories', v_current_calories, 'protein', v_current_protein, 'carbs', v_current_carbs, 'fat', v_current_fat),
    jsonb_build_object('calories', v_new_calories, 'protein', v_new_protein, 'carbs', v_new_carbs, 'fat', v_new_fat),
    v_summary, v_confidence, LEAST(v_days_logged, 7), v_adherence, v_weight_change, now(), NULL
  )
  ON CONFLICT (user_id, week_start) DO UPDATE
  SET energy_rating = EXCLUDED.energy_rating, hunger_rating = EXCLUDED.hunger_rating,
      recovery_rating = EXCLUDED.recovery_rating, plan_adherence_rating = EXCLUDED.plan_adherence_rating,
      weight_kg = EXCLUDED.weight_kg, notes = EXCLUDED.notes, status = 'reviewed', adjustment_id = NULL,
      current_targets = EXCLUDED.current_targets, proposed_targets = EXCLUDED.proposed_targets,
      review_summary = EXCLUDED.review_summary, confidence = EXCLUDED.confidence,
      days_logged = EXCLUDED.days_logged, adherence_rate = EXCLUDED.adherence_rate,
      weight_change_kg = EXCLUDED.weight_change_kg, updated_at = now(), resolved_at = NULL
  RETURNING to_jsonb(weekly_ai_check_ins) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_weekly_ai_check_in(SMALLINT, SMALLINT, SMALLINT, SMALLINT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_weekly_ai_check_in(SMALLINT, SMALLINT, SMALLINT, SMALLINT, NUMERIC, TEXT) TO authenticated;

COMMIT;
