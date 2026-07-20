BEGIN;

ALTER TABLE public.weekly_ai_check_ins
  ADD COLUMN IF NOT EXISTS recommendation_state TEXT NOT NULL DEFAULT 'maintain',
  ADD COLUMN IF NOT EXISTS decision_code TEXT NOT NULL DEFAULT 'legacy_review',
  ADD COLUMN IF NOT EXISTS reason_codes TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS hold_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS data_quality JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS weight_trend JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS safety_context JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT NOT NULL DEFAULT 'adaptive-week-v2',
  ADD COLUMN IF NOT EXISTS goal_id_snapshot UUID REFERENCES public.nutrition_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS goal_version_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS proposal_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days');

ALTER TABLE public.weekly_ai_check_ins
  DROP CONSTRAINT IF EXISTS weekly_ai_check_ins_recommendation_state_check;
ALTER TABLE public.weekly_ai_check_ins
  ADD CONSTRAINT weekly_ai_check_ins_recommendation_state_check
  CHECK (recommendation_state IN ('change', 'maintain', 'hold'));

ALTER TABLE public.weekly_ai_check_ins
  DROP CONSTRAINT IF EXISTS weekly_ai_check_ins_status_check;
ALTER TABLE public.weekly_ai_check_ins
  ADD CONSTRAINT weekly_ai_check_ins_status_check
  CHECK (status IN ('reviewed', 'applied', 'dismissed', 'stale'));

ALTER TABLE public.weekly_ai_check_ins
  DROP CONSTRAINT IF EXISTS weekly_ai_check_ins_data_quality_object_check;
ALTER TABLE public.weekly_ai_check_ins
  ADD CONSTRAINT weekly_ai_check_ins_data_quality_object_check
  CHECK (jsonb_typeof(data_quality) = 'object');

ALTER TABLE public.weekly_ai_check_ins
  DROP CONSTRAINT IF EXISTS weekly_ai_check_ins_weight_trend_object_check;
ALTER TABLE public.weekly_ai_check_ins
  ADD CONSTRAINT weekly_ai_check_ins_weight_trend_object_check
  CHECK (jsonb_typeof(weight_trend) = 'object');

ALTER TABLE public.weekly_ai_check_ins
  DROP CONSTRAINT IF EXISTS weekly_ai_check_ins_safety_context_object_check;
ALTER TABLE public.weekly_ai_check_ins
  ADD CONSTRAINT weekly_ai_check_ins_safety_context_object_check
  CHECK (jsonb_typeof(safety_context) = 'object');

CREATE INDEX IF NOT EXISTS weekly_ai_check_ins_open_expiry_idx
  ON public.weekly_ai_check_ins (user_id, expires_at)
  WHERE status = 'reviewed';

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
  v_goal public.nutrition_goals%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_settings public.adaptive_goal_settings%ROWTYPE;
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
  v_weight_count INTEGER := 0;
  v_weight_outlier_count INTEGER := 0;
  v_weight_span_days INTEGER := 0;
  v_prior_weight_count INTEGER := 0;
  v_recent_weight_count INTEGER := 0;
  v_prior_weight_median NUMERIC;
  v_recent_weight_median NUMERIC;
  v_weight_change NUMERIC;
  v_weekly_weight_rate NUMERIC;
  v_data_quality_label TEXT := 'low';
  v_recommendation_state TEXT := 'maintain';
  v_decision_code TEXT := 'maintain_current_targets';
  v_reason_codes TEXT[] := '{}'::TEXT[];
  v_hold_reasons TEXT[] := '{}'::TEXT[];
  v_health_context_codes TEXT[] := '{}'::TEXT[];
  v_health_context_date DATE;
  v_active_health_program BOOLEAN := FALSE;
  v_unresolved_safety_event BOOLEAN := FALSE;
  v_confidence NUMERIC := 0.68;
  v_summary TEXT;
  v_delta INTEGER := 0;
  v_min_calories INTEGER;
  v_max_calories INTEGER;
  v_fingerprint TEXT;
  v_result JSONB;
  v_algorithm_version CONSTANT TEXT := 'adaptive-week-v2';
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

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;

  SELECT * INTO v_goal
  FROM public.nutrition_goals
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT * INTO v_settings
  FROM public.adaptive_goal_settings
  WHERE user_id = v_user_id;

  v_current_calories := COALESCE(v_goal.daily_calorie_target, v_profile.daily_calorie_target, 2000);
  v_current_protein := COALESCE(v_goal.protein_target_g, v_profile.protein_target_g, 120);
  v_current_carbs := COALESCE(v_goal.carbs_target_g, v_profile.carbs_target_g, 250);
  v_current_fat := COALESCE(v_goal.fat_target_g, v_profile.fat_target_g, 65);
  v_goal_type := lower(COALESCE(v_goal.goal_type::TEXT, v_profile.health_goal::TEXT, 'maintenance'));
  v_min_calories := GREATEST(1200, COALESCE(v_settings.min_calorie_floor, 1200));
  v_max_calories := LEAST(4000, GREATEST(v_min_calories, COALESCE(v_settings.max_calorie_ceiling, 4000)));

  SELECT
    COUNT(DISTINCT log_date)::INTEGER,
    COUNT(DISTINCT log_date) FILTER (
      WHERE ABS(calories_consumed - v_current_calories) <= v_current_calories * 0.10
    )::INTEGER
  INTO v_days_logged, v_days_on_target
  FROM public.progress_logs
  WHERE user_id = v_user_id
    AND log_date BETWEEN CURRENT_DATE - 6 AND CURRENT_DATE
    AND calories_consumed > 0;

  v_adherence := CASE
    WHEN v_days_logged = 0 THEN 0
    ELSE LEAST(1, v_days_on_target::NUMERIC / v_days_logged)
  END;

  WITH raw_weights AS (
    SELECT measurement.log_date, measurement.weight_kg::NUMERIC AS weight_kg
    FROM public.body_measurements measurement
    WHERE measurement.user_id = v_user_id
      AND measurement.weight_kg IS NOT NULL
      AND measurement.log_date BETWEEN CURRENT_DATE - 28 AND CURRENT_DATE
    UNION ALL
    SELECT CURRENT_DATE, p_weight_kg
    WHERE p_weight_kg IS NOT NULL
  ), daily_weights AS (
    SELECT log_date, round(avg(weight_kg), 2) AS weight_kg
    FROM raw_weights
    GROUP BY log_date
  ), center AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY weight_kg)::NUMERIC AS median_weight
    FROM daily_weights
  ), filtered AS (
    SELECT daily_weights.*
    FROM daily_weights
    CROSS JOIN center
    WHERE abs(daily_weights.weight_kg - center.median_weight)
      <= greatest(4::NUMERIC, center.median_weight * 0.08)
  )
  SELECT
    (SELECT count(*)::INTEGER FROM filtered),
    (SELECT count(*)::INTEGER FROM daily_weights) - (SELECT count(*)::INTEGER FROM filtered),
    COALESCE((SELECT max(log_date) - min(log_date) FROM filtered), 0),
    count(*) FILTER (WHERE log_date BETWEEN CURRENT_DATE - 28 AND CURRENT_DATE - 15)::INTEGER,
    count(*) FILTER (WHERE log_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE)::INTEGER,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY weight_kg)
      FILTER (WHERE log_date BETWEEN CURRENT_DATE - 28 AND CURRENT_DATE - 15)::NUMERIC,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY weight_kg)
      FILTER (WHERE log_date BETWEEN CURRENT_DATE - 13 AND CURRENT_DATE)::NUMERIC
  INTO
    v_weight_count, v_weight_outlier_count, v_weight_span_days,
    v_prior_weight_count, v_recent_weight_count,
    v_prior_weight_median, v_recent_weight_median
  FROM filtered;

  IF v_prior_weight_count >= 2 AND v_recent_weight_count >= 2 AND v_weight_span_days >= 14 THEN
    v_weight_change := round(v_recent_weight_median - v_prior_weight_median, 2);
    v_weekly_weight_rate := round(v_weight_change / 2.0, 2);
  ELSE
    v_weight_change := NULL;
    v_weekly_weight_rate := NULL;
  END IF;

  IF v_days_logged >= 5 AND v_weight_count >= 6
     AND v_prior_weight_count >= 3 AND v_recent_weight_count >= 3
     AND v_weight_span_days >= 18 AND p_plan_adherence_rating >= 3
  THEN
    v_data_quality_label := 'high';
  ELSIF v_days_logged >= 4 AND v_weight_count >= 4
        AND v_prior_weight_count >= 2 AND v_recent_weight_count >= 2
        AND v_weight_span_days >= 14 AND p_plan_adherence_rating >= 3
  THEN
    v_data_quality_label := 'medium';
  END IF;

  IF p_energy_rating <= 2 THEN
    v_hold_reasons := array_append(v_hold_reasons, 'feedback.low_energy');
  END IF;
  IF p_recovery_rating <= 2 THEN
    v_hold_reasons := array_append(v_hold_reasons, 'feedback.low_recovery');
  END IF;
  IF p_hunger_rating >= 4 THEN
    v_hold_reasons := array_append(v_hold_reasons, 'feedback.high_hunger');
  END IF;

  IF public.health_context_feature_enabled() THEN
    SELECT entry.entry_date,
      array_remove(ARRAY[
        CASE WHEN entry.stress >= 4 THEN 'context.high_stress' END,
        CASE WHEN entry.appetite <= 2 THEN 'context.low_appetite' END,
        CASE WHEN entry.energy <= 2 THEN 'context.low_energy' END,
        CASE WHEN entry.symptom_severity >= 2 THEN 'context.digestive_discomfort' END
      ]::TEXT[], NULL)
    INTO v_health_context_date, v_health_context_codes
    FROM public.health_context_entries entry
    JOIN public.health_context_preferences preferences ON preferences.user_id = entry.user_id
    WHERE entry.user_id = v_user_id
      AND preferences.journal_enabled
      AND preferences.recommendation_context_enabled
      AND entry.entry_date >= CURRENT_DATE - 3
    ORDER BY entry.entry_date DESC
    LIMIT 1;
  END IF;

  IF cardinality(v_health_context_codes) > 0 THEN
    v_hold_reasons := v_hold_reasons || v_health_context_codes;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.health_program_enrollments enrollment
    WHERE enrollment.user_id = v_user_id
      AND enrollment.status IN ('active', 'paused')
  ) INTO v_active_health_program;

  SELECT EXISTS (
    SELECT 1
    FROM public.health_program_safety_events safety_event
    WHERE safety_event.user_id = v_user_id
      AND safety_event.acknowledged_at IS NULL
  ) INTO v_unresolved_safety_event;

  IF v_active_health_program THEN
    v_hold_reasons := array_append(v_hold_reasons, 'program.active_health_protocol');
  END IF;
  IF v_unresolved_safety_event THEN
    v_hold_reasons := array_append(v_hold_reasons, 'program.unresolved_safety_event');
  END IF;
  IF v_goal.id IS NULL THEN
    v_hold_reasons := array_append(v_hold_reasons, 'goal.active_goal_required');
  END IF;
  IF NOT COALESCE(v_settings.auto_adjust_enabled, TRUE) THEN
    v_hold_reasons := array_append(v_hold_reasons, 'settings.adaptive_review_disabled');
  END IF;

  v_new_calories := v_current_calories;
  v_new_protein := v_current_protein;
  v_new_carbs := v_current_carbs;
  v_new_fat := v_current_fat;

  IF v_data_quality_label = 'low' THEN
    v_recommendation_state := 'hold';
    v_decision_code := 'insufficient_reliable_data';
    v_reason_codes := ARRAY['data.minimum_not_met'];
    v_summary := 'Keep the current targets this week. A safe adjustment needs at least four logged days and a smoothed weight trend across two separate periods.';
    v_confidence := 0.92;
  ELSIF cardinality(v_hold_reasons) > 0 THEN
    v_recommendation_state := 'hold';
    v_decision_code := 'safety_hold';
    v_reason_codes := ARRAY['safety.context_requires_hold'];
    v_summary := 'Keep the current targets. Your recent feedback or health context should be reviewed before changing calories or macros.';
    v_confidence := 0.94;
  ELSIF v_goal_type IN ('weight_loss', 'lose', 'lose_weight')
        AND abs(v_weekly_weight_rate) < 0.10
        AND v_adherence >= 0.60
        AND p_plan_adherence_rating >= 3
  THEN
    v_delta := LEAST(100, greatest(50, round(v_current_calories * 0.05)::INTEGER));
    v_new_calories := GREATEST(v_min_calories, v_current_calories - v_delta);
    v_delta := v_new_calories - v_current_calories;
    IF v_delta < 0 THEN
      v_new_carbs := GREATEST(0, v_current_carbs - round(abs(v_delta) * 0.70 / 4.0)::INTEGER);
      v_new_fat := GREATEST(0, v_current_fat - round(abs(v_delta) * 0.30 / 9.0)::INTEGER);
      v_recommendation_state := 'change';
      v_decision_code := 'weight_loss_plateau_small_decrease';
      v_reason_codes := ARRAY['trend.smoothed_plateau', 'adherence.sufficient', 'change.bounded'];
      v_summary := format('Your smoothed weight trend was stable with consistent logging. A bounded %s kcal decrease is suggested; protein stays unchanged.', abs(v_delta));
      v_confidence := CASE WHEN v_data_quality_label = 'high' THEN 0.86 ELSE 0.80 END;
    ELSE
      v_decision_code := 'calorie_floor_reached';
      v_reason_codes := ARRAY['safety.calorie_floor'];
      v_summary := 'Your current calorie target is already at the configured safety floor, so no reduction is suggested.';
      v_confidence := 0.95;
    END IF;
  ELSIF v_goal_type IN ('muscle_gain', 'gain', 'gain_weight')
        AND abs(v_weekly_weight_rate) < 0.10
        AND v_adherence >= 0.60
        AND p_plan_adherence_rating >= 3
  THEN
    v_delta := LEAST(150, greatest(50, round(v_current_calories * 0.05)::INTEGER));
    v_new_calories := LEAST(v_max_calories, v_current_calories + v_delta);
    v_delta := v_new_calories - v_current_calories;
    IF v_delta > 0 THEN
      v_new_carbs := v_current_carbs + round(v_delta * 0.70 / 4.0)::INTEGER;
      v_new_fat := v_current_fat + round(v_delta * 0.30 / 9.0)::INTEGER;
      v_recommendation_state := 'change';
      v_decision_code := 'muscle_gain_plateau_small_increase';
      v_reason_codes := ARRAY['trend.smoothed_plateau', 'adherence.sufficient', 'change.bounded'];
      v_summary := format('Your smoothed weight trend was stable with consistent logging. A bounded %s kcal increase is suggested; protein stays unchanged.', v_delta);
      v_confidence := CASE WHEN v_data_quality_label = 'high' THEN 0.86 ELSE 0.80 END;
    ELSE
      v_decision_code := 'calorie_ceiling_reached';
      v_reason_codes := ARRAY['safety.calorie_ceiling'];
      v_summary := 'Your current calorie target is already at the configured ceiling, so no increase is suggested.';
      v_confidence := 0.95;
    END IF;
  ELSE
    v_recommendation_state := 'maintain';
    v_decision_code := 'trend_aligned_with_goal';
    v_reason_codes := ARRAY['trend.no_bounded_change_needed'];
    v_summary := 'Your current targets remain aligned with the reliable progress trend and weekly feedback. No change is recommended.';
    v_confidence := CASE WHEN v_data_quality_label = 'high' THEN 0.88 ELSE 0.78 END;
  END IF;

  v_fingerprint := md5(concat_ws('|',
    COALESCE(v_goal.id::TEXT, ''), COALESCE(v_goal.version, 0)::TEXT,
    v_current_calories, v_current_protein, v_current_carbs, v_current_fat,
    v_new_calories, v_new_protein, v_new_carbs, v_new_fat,
    v_recommendation_state, v_algorithm_version
  ));

  INSERT INTO public.weekly_ai_check_ins (
    user_id, week_start, energy_rating, hunger_rating, recovery_rating,
    plan_adherence_rating, weight_kg, notes, status, adjustment_id,
    current_targets, proposed_targets, review_summary, confidence,
    days_logged, adherence_rate, weight_change_kg,
    recommendation_state, decision_code, reason_codes, hold_reasons,
    data_quality, weight_trend, safety_context, algorithm_version,
    goal_id_snapshot, goal_version_snapshot, proposal_fingerprint,
    expires_at, updated_at, resolved_at
  ) VALUES (
    v_user_id, v_week_start, p_energy_rating, p_hunger_rating, p_recovery_rating,
    p_plan_adherence_rating, p_weight_kg, NULLIF(trim(p_notes), ''), 'reviewed', NULL,
    jsonb_build_object('calories', v_current_calories, 'protein', v_current_protein, 'carbs', v_current_carbs, 'fat', v_current_fat),
    jsonb_build_object('calories', v_new_calories, 'protein', v_new_protein, 'carbs', v_new_carbs, 'fat', v_new_fat),
    v_summary, v_confidence, LEAST(v_days_logged, 7), v_adherence, v_weight_change,
    v_recommendation_state, v_decision_code, v_reason_codes, v_hold_reasons,
    jsonb_build_object(
      'label', v_data_quality_label, 'days_logged', v_days_logged,
      'weight_samples', v_weight_count, 'outliers_removed', v_weight_outlier_count,
      'span_days', v_weight_span_days, 'prior_window_samples', v_prior_weight_count,
      'recent_window_samples', v_recent_weight_count
    ),
    jsonb_build_object(
      'method', 'two_window_median', 'window_days', 28,
      'prior_median_kg', v_prior_weight_median, 'recent_median_kg', v_recent_weight_median,
      'change_kg', v_weight_change, 'weekly_rate_kg', v_weekly_weight_rate
    ),
    jsonb_build_object(
      'health_context_date', v_health_context_date,
      'health_context_codes', to_jsonb(v_health_context_codes),
      'active_health_program', v_active_health_program,
      'unresolved_safety_event', v_unresolved_safety_event
    ),
    v_algorithm_version, v_goal.id, v_goal.version, v_fingerprint,
    now() + INTERVAL '7 days', now(), NULL
  )
  ON CONFLICT (user_id, week_start) DO UPDATE
  SET energy_rating = EXCLUDED.energy_rating,
      hunger_rating = EXCLUDED.hunger_rating,
      recovery_rating = EXCLUDED.recovery_rating,
      plan_adherence_rating = EXCLUDED.plan_adherence_rating,
      weight_kg = EXCLUDED.weight_kg,
      notes = EXCLUDED.notes,
      status = 'reviewed',
      adjustment_id = NULL,
      current_targets = EXCLUDED.current_targets,
      proposed_targets = EXCLUDED.proposed_targets,
      review_summary = EXCLUDED.review_summary,
      confidence = EXCLUDED.confidence,
      days_logged = EXCLUDED.days_logged,
      adherence_rate = EXCLUDED.adherence_rate,
      weight_change_kg = EXCLUDED.weight_change_kg,
      recommendation_state = EXCLUDED.recommendation_state,
      decision_code = EXCLUDED.decision_code,
      reason_codes = EXCLUDED.reason_codes,
      hold_reasons = EXCLUDED.hold_reasons,
      data_quality = EXCLUDED.data_quality,
      weight_trend = EXCLUDED.weight_trend,
      safety_context = EXCLUDED.safety_context,
      algorithm_version = EXCLUDED.algorithm_version,
      goal_id_snapshot = EXCLUDED.goal_id_snapshot,
      goal_version_snapshot = EXCLUDED.goal_version_snapshot,
      proposal_fingerprint = EXCLUDED.proposal_fingerprint,
      expires_at = EXCLUDED.expires_at,
      updated_at = now(),
      resolved_at = NULL
  RETURNING to_jsonb(weekly_ai_check_ins) INTO v_result;

  RETURN v_result;
END;
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
  v_goal public.nutrition_goals%ROWTYPE;
  v_calories INTEGER;
  v_protein INTEGER;
  v_carbs INTEGER;
  v_fat INTEGER;
  v_current_calories INTEGER;
  v_current_protein INTEGER;
  v_current_carbs INTEGER;
  v_current_fat INTEGER;
  v_expected_fingerprint TEXT;
  v_new_safety_hold BOOLEAN := FALSE;
  v_changed BOOLEAN := FALSE;
  v_adjustment_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF p_decision NOT IN ('apply', 'dismiss') THEN RAISE EXCEPTION 'INVALID_WEEKLY_CHECK_IN_DECISION'; END IF;

  SELECT * INTO v_check_in
  FROM public.weekly_ai_check_ins
  WHERE id = p_check_in_id AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WEEKLY_CHECK_IN_NOT_FOUND'; END IF;
  IF v_check_in.status <> 'reviewed' THEN
    RETURN jsonb_build_object('status', v_check_in.status, 'already_resolved', true);
  END IF;

  IF p_decision = 'dismiss' THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'dismissed', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;
    UPDATE public.profiles SET has_unviewed_adjustment = false WHERE user_id = v_user_id;
    RETURN jsonb_build_object('status', 'dismissed', 'already_resolved', false);
  END IF;

  IF v_check_in.expires_at <= v_now THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'stale', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;
    RETURN jsonb_build_object('status', 'stale', 'code', 'WEEKLY_CHECK_IN_EXPIRED');
  END IF;

  SELECT * INTO v_goal
  FROM public.nutrition_goals
  WHERE user_id = v_user_id AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_check_in.recommendation_state = 'change' AND NOT FOUND THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'stale', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;
    RETURN jsonb_build_object('status', 'stale', 'code', 'ACTIVE_NUTRITION_GOAL_NOT_FOUND');
  END IF;

  v_current_calories := COALESCE(v_goal.daily_calorie_target, (v_check_in.current_targets ->> 'calories')::INTEGER);
  v_current_protein := COALESCE(v_goal.protein_target_g, (v_check_in.current_targets ->> 'protein')::INTEGER);
  v_current_carbs := COALESCE(v_goal.carbs_target_g, (v_check_in.current_targets ->> 'carbs')::INTEGER);
  v_current_fat := COALESCE(v_goal.fat_target_g, (v_check_in.current_targets ->> 'fat')::INTEGER);
  v_calories := (v_check_in.proposed_targets ->> 'calories')::INTEGER;
  v_protein := (v_check_in.proposed_targets ->> 'protein')::INTEGER;
  v_carbs := (v_check_in.proposed_targets ->> 'carbs')::INTEGER;
  v_fat := (v_check_in.proposed_targets ->> 'fat')::INTEGER;

  v_expected_fingerprint := md5(concat_ws('|',
    COALESCE(v_check_in.goal_id_snapshot::TEXT, ''), COALESCE(v_check_in.goal_version_snapshot, 0)::TEXT,
    (v_check_in.current_targets ->> 'calories'), (v_check_in.current_targets ->> 'protein'),
    (v_check_in.current_targets ->> 'carbs'), (v_check_in.current_targets ->> 'fat'),
    v_calories, v_protein, v_carbs, v_fat,
    v_check_in.recommendation_state, v_check_in.algorithm_version
  ));

  IF v_check_in.proposal_fingerprint IS DISTINCT FROM v_expected_fingerprint
     OR v_goal.id IS DISTINCT FROM v_check_in.goal_id_snapshot
     OR COALESCE(v_goal.version, 1) IS DISTINCT FROM COALESCE(v_check_in.goal_version_snapshot, 1)
     OR v_current_calories IS DISTINCT FROM (v_check_in.current_targets ->> 'calories')::INTEGER
     OR v_current_protein IS DISTINCT FROM (v_check_in.current_targets ->> 'protein')::INTEGER
     OR v_current_carbs IS DISTINCT FROM (v_check_in.current_targets ->> 'carbs')::INTEGER
     OR v_current_fat IS DISTINCT FROM (v_check_in.current_targets ->> 'fat')::INTEGER
  THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'stale', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;
    RETURN jsonb_build_object('status', 'stale', 'code', 'WEEKLY_CHECK_IN_STALE_REFRESH_REQUIRED');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.health_program_enrollments enrollment
    WHERE enrollment.user_id = v_user_id AND enrollment.status IN ('active', 'paused')
  ) OR EXISTS (
    SELECT 1 FROM public.health_program_safety_events safety_event
    WHERE safety_event.user_id = v_user_id AND safety_event.acknowledged_at IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.health_context_entries entry
    JOIN public.health_context_preferences preferences ON preferences.user_id = entry.user_id
    WHERE entry.user_id = v_user_id
      AND preferences.journal_enabled
      AND preferences.recommendation_context_enabled
      AND entry.entry_date >= CURRENT_DATE - 3
      AND (entry.stress >= 4 OR entry.appetite <= 2 OR entry.energy <= 2 OR entry.symptom_severity >= 2)
  ) INTO v_new_safety_hold;

  IF v_check_in.recommendation_state = 'change' AND v_new_safety_hold THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'stale', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;
    RETURN jsonb_build_object('status', 'stale', 'code', 'WEEKLY_CHECK_IN_SAFETY_CONTEXT_CHANGED');
  END IF;

  IF v_check_in.recommendation_state <> 'change' THEN
    UPDATE public.weekly_ai_check_ins
    SET status = 'applied', resolved_at = v_now, updated_at = v_now
    WHERE id = v_check_in.id;
    UPDATE public.profiles SET has_unviewed_adjustment = false WHERE user_id = v_user_id;
    RETURN jsonb_build_object('status', 'applied', 'changed', false);
  END IF;

  IF v_calories NOT BETWEEN 1200 AND 4000
     OR LEAST(v_protein, v_carbs, v_fat) < 0
     OR abs(v_calories - v_current_calories) > 150
     OR abs(v_calories - v_current_calories)::NUMERIC / greatest(v_current_calories, 1) > 0.05
     OR (v_calories < v_current_calories AND v_current_calories - v_calories > 100)
     OR v_protein < v_current_protein
  THEN
    RAISE EXCEPTION 'INVALID_OR_UNBOUNDED_PROPOSED_TARGETS';
  END IF;

  v_changed := v_current_calories IS DISTINCT FROM v_calories
    OR v_current_protein IS DISTINCT FROM v_protein
    OR v_current_carbs IS DISTINCT FROM v_carbs
    OR v_current_fat IS DISTINCT FROM v_fat;

  IF v_changed THEN
    UPDATE public.nutrition_goals
    SET daily_calorie_target = v_calories,
        protein_target_g = v_protein,
        carbs_target_g = v_carbs,
        fat_target_g = v_fat,
        calculation_source = 'weekly_ai_check_in',
        reason = v_check_in.review_summary,
        version = COALESCE(version, 1) + 1,
        updated_at = v_now
    WHERE id = v_goal.id;

    UPDATE public.profiles
    SET daily_calorie_target = v_calories,
        protein_target_g = v_protein,
        carbs_target_g = v_carbs,
        fat_target_g = v_fat,
        last_goal_adjustment_date = CURRENT_DATE,
        has_unviewed_adjustment = false
    WHERE user_id = v_user_id;

    INSERT INTO public.goal_adjustment_history (
      user_id, adjustment_date, previous_calories, new_calories,
      previous_macros, new_macros, reason, weight_change_kg,
      adherence_rate, plateau_detected, ai_confidence, applied
    ) VALUES (
      v_user_id, CURRENT_DATE, v_current_calories, v_calories,
      jsonb_build_object('protein', v_current_protein, 'carbs', v_current_carbs, 'fat', v_current_fat),
      jsonb_build_object('protein', v_protein, 'carbs', v_carbs, 'fat', v_fat),
      concat('[', v_check_in.algorithm_version, ':', v_check_in.decision_code, '] ', v_check_in.review_summary),
      v_check_in.weight_change_kg, v_check_in.adherence_rate, true,
      v_check_in.confidence, true
    )
    ON CONFLICT (user_id, adjustment_date) DO UPDATE
    SET previous_calories = EXCLUDED.previous_calories,
        new_calories = EXCLUDED.new_calories,
        previous_macros = EXCLUDED.previous_macros,
        new_macros = EXCLUDED.new_macros,
        reason = EXCLUDED.reason,
        weight_change_kg = EXCLUDED.weight_change_kg,
        adherence_rate = EXCLUDED.adherence_rate,
        plateau_detected = EXCLUDED.plateau_detected,
        ai_confidence = EXCLUDED.ai_confidence,
        applied = true
    RETURNING id INTO v_adjustment_id;

    INSERT INTO public.nutrition_goal_events (
      user_id, goal_id, event_type, previous_values, new_values, reason
    ) VALUES (
      v_user_id, v_goal.id, 'smart_adjusted', v_check_in.current_targets,
      v_check_in.proposed_targets,
      concat(v_check_in.decision_code, ': ', v_check_in.review_summary)
    );
  END IF;

  UPDATE public.weekly_ai_check_ins
  SET status = 'applied', adjustment_id = v_adjustment_id,
      resolved_at = v_now, updated_at = v_now
  WHERE id = v_check_in.id;

  RETURN jsonb_build_object('status', 'applied', 'changed', v_changed);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_weekly_ai_check_in(SMALLINT, SMALLINT, SMALLINT, SMALLINT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_weekly_ai_check_in(SMALLINT, SMALLINT, SMALLINT, SMALLINT, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.resolve_weekly_ai_check_in(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_weekly_ai_check_in(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.create_weekly_ai_check_in(SMALLINT, SMALLINT, SMALLINT, SMALLINT, NUMERIC, TEXT) IS
  'Builds a bounded, explainable weekly recommendation from smoothed weight trends, minimum data-quality gates, and health-context safety stops.';
COMMENT ON FUNCTION public.resolve_weekly_ai_check_in(UUID, TEXT) IS
  'Applies an unexpired weekly recommendation only when the active goal and safety context still match its server-owned snapshot.';

COMMIT;
