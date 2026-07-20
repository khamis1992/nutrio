-- Extend progression from load/reps to sets, RIR and recovery density.

ALTER TABLE public.program_exercises
  DROP CONSTRAINT IF EXISTS program_exercises_progression_rule_check;

ALTER TABLE public.program_exercises
  ADD CONSTRAINT program_exercises_progression_rule_check CHECK (
    jsonb_typeof(progression_rule) = 'object'
    AND COALESCE(progression_rule->>'strategy', 'double_progression') IN (
      'double_progression', 'linear_load', 'reps_only', 'sets_only', 'rir_based', 'density'
    )
    AND COALESCE((progression_rule->>'rep_min')::int, 1) > 0
    AND COALESCE((progression_rule->>'rep_max')::int, 1) >= COALESCE((progression_rule->>'rep_min')::int, 1)
    AND COALESCE((progression_rule->>'load_increment_kg')::numeric, 0) >= 0
    AND COALESCE((progression_rule->>'rep_increment')::int, 1) > 0
    AND COALESCE((progression_rule->>'set_increment')::int, 1) BETWEEN 1 AND 3
    AND COALESCE((progression_rule->>'max_sets')::int, 6) BETWEEN 1 AND 12
    AND COALESCE((progression_rule->>'target_rir')::numeric, 2) BETWEEN 0 AND 5
    AND COALESCE((progression_rule->>'rest_decrement_seconds')::int, 15) BETWEEN 5 AND 60
    AND COALESCE((progression_rule->>'min_rest_seconds')::int, 30) BETWEEN 0 AND 600
    AND COALESCE((progression_rule->>'rpe_ceiling')::numeric, 8.5) BETWEEN 6 AND 10
    AND COALESCE((progression_rule->>'failure_sessions_before_deload')::int, 2) BETWEEN 1 AND 6
    AND COALESCE((progression_rule->>'deload_percent')::numeric, 10) BETWEEN 5 AND 30
  );

ALTER TABLE public.workout_progression_recommendations
  ADD COLUMN IF NOT EXISTS recommended_sets integer,
  ADD COLUMN IF NOT EXISTS recommended_rir numeric,
  ADD COLUMN IF NOT EXISTS recommended_rest_seconds integer;

ALTER TABLE public.workout_progression_recommendations
  DROP CONSTRAINT IF EXISTS workout_progression_recommendations_outcome_check,
  ADD CONSTRAINT workout_progression_recommendations_outcome_check CHECK (
    outcome IN ('increase_load', 'increase_reps', 'increase_sets', 'adjust_rest', 'repeat', 'deload')
  ),
  DROP CONSTRAINT IF EXISTS workout_progression_recommendations_sets_check,
  ADD CONSTRAINT workout_progression_recommendations_sets_check CHECK (recommended_sets IS NULL OR recommended_sets BETWEEN 1 AND 12),
  DROP CONSTRAINT IF EXISTS workout_progression_recommendations_rir_check,
  ADD CONSTRAINT workout_progression_recommendations_rir_check CHECK (recommended_rir IS NULL OR recommended_rir BETWEEN 0 AND 10),
  DROP CONSTRAINT IF EXISTS workout_progression_recommendations_rest_check,
  ADD CONSTRAINT workout_progression_recommendations_rest_check CHECK (recommended_rest_seconds IS NULL OR recommended_rest_seconds BETWEEN 0 AND 7200);

CREATE OR REPLACE FUNCTION public.evaluate_coach_workout_progression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exercise record;
  v_completed_sets int;
  v_min_reps int;
  v_max_reps int;
  v_current_weight numeric;
  v_avg_rpe numeric;
  v_avg_rir numeric;
  v_avg_rest numeric;
  v_previous_failures int;
  v_outcome text;
  v_recommended_weight numeric;
  v_recommended_reps int;
  v_recommended_sets int;
  v_recommended_rir numeric;
  v_recommended_rest int;
  v_reason text;
  v_strategy text;
  v_rep_min int;
  v_rep_max int;
  v_load_increment numeric;
  v_rep_increment int;
  v_set_increment int;
  v_max_sets int;
  v_target_rir numeric;
  v_rest_decrement int;
  v_min_rest int;
  v_rpe_ceiling numeric;
  v_failure_limit int;
  v_deload_percent numeric;
  v_success boolean;
  v_failure boolean;
BEGIN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN RETURN NEW; END IF;

  FOR v_exercise IN
    SELECT pe.* FROM public.program_exercises pe
    WHERE pe.program_id = NEW.program_id AND pe.day_number = NEW.day_number
      AND COALESCE((pe.progression_rule->>'enabled')::boolean, false)
  LOOP
    SELECT count(*) FILTER (WHERE completed), min(reps) FILTER (WHERE completed),
      max(reps) FILTER (WHERE completed), max(weight_kg) FILTER (WHERE completed),
      avg(rpe) FILTER (WHERE completed AND rpe IS NOT NULL),
      avg(rir) FILTER (WHERE completed AND rir IS NOT NULL),
      avg(actual_rest_seconds) FILTER (WHERE completed AND actual_rest_seconds IS NOT NULL)
    INTO v_completed_sets, v_min_reps, v_max_reps, v_current_weight, v_avg_rpe, v_avg_rir, v_avg_rest
    FROM public.coach_workout_set_logs
    WHERE session_id = NEW.id AND program_exercise_id = v_exercise.id;

    IF COALESCE(v_completed_sets, 0) = 0 THEN CONTINUE; END IF;

    v_strategy := COALESCE(v_exercise.progression_rule->>'strategy', 'double_progression');
    v_rep_min := COALESCE((v_exercise.progression_rule->>'rep_min')::int, 8);
    v_rep_max := COALESCE((v_exercise.progression_rule->>'rep_max')::int, 12);
    v_load_increment := COALESCE((v_exercise.progression_rule->>'load_increment_kg')::numeric, 2.5);
    v_rep_increment := COALESCE((v_exercise.progression_rule->>'rep_increment')::int, 1);
    v_set_increment := COALESCE((v_exercise.progression_rule->>'set_increment')::int, 1);
    v_max_sets := COALESCE((v_exercise.progression_rule->>'max_sets')::int, 6);
    v_target_rir := COALESCE((v_exercise.progression_rule->>'target_rir')::numeric, 2);
    v_rest_decrement := COALESCE((v_exercise.progression_rule->>'rest_decrement_seconds')::int, 15);
    v_min_rest := COALESCE((v_exercise.progression_rule->>'min_rest_seconds')::int, 30);
    v_rpe_ceiling := COALESCE((v_exercise.progression_rule->>'rpe_ceiling')::numeric, 8.5);
    v_failure_limit := COALESCE((v_exercise.progression_rule->>'failure_sessions_before_deload')::int, 2);
    v_deload_percent := COALESCE((v_exercise.progression_rule->>'deload_percent')::numeric, 10);

    v_success := v_completed_sets >= v_exercise.sets
      AND COALESCE(v_min_reps, v_rep_min) >= v_rep_min
      AND COALESCE(v_avg_rpe, v_rpe_ceiling) <= v_rpe_ceiling
      AND (v_strategy <> 'rir_based' OR COALESCE(v_avg_rir, v_target_rir) >= v_target_rir);
    v_failure := v_completed_sets < v_exercise.sets
      OR COALESCE(v_min_reps, v_rep_min) < v_rep_min
      OR COALESCE(v_avg_rpe, v_rpe_ceiling) > v_rpe_ceiling;

    SELECT count(*) INTO v_previous_failures FROM (
      SELECT outcome FROM public.workout_progression_recommendations
      WHERE user_id = NEW.user_id AND program_exercise_id = v_exercise.id
      ORDER BY created_at DESC LIMIT GREATEST(v_failure_limit - 1, 0)
    ) recent WHERE outcome IN ('repeat', 'deload');

    v_recommended_weight := v_current_weight;
    v_recommended_reps := LEAST(v_rep_max, GREATEST(v_rep_min, COALESCE(v_max_reps, v_rep_min)));
    v_recommended_sets := v_exercise.sets;
    v_recommended_rir := v_target_rir;
    v_recommended_rest := v_exercise.rest_seconds;

    IF v_failure AND v_previous_failures >= v_failure_limit - 1 THEN
      v_outcome := 'deload';
      v_recommended_weight := CASE WHEN v_current_weight IS NULL THEN NULL ELSE round((v_current_weight * (1 - v_deload_percent / 100.0)) * 2) / 2 END;
      v_recommended_reps := v_rep_min;
      v_reason := format('Reduce load by %s%% after %s sessions below target.', v_deload_percent, v_failure_limit);
    ELSIF v_success AND v_strategy = 'sets_only' AND v_exercise.sets < v_max_sets THEN
      v_outcome := 'increase_sets';
      v_recommended_sets := LEAST(v_max_sets, v_exercise.sets + v_set_increment);
      v_reason := format('Add %s set after completing all prescribed work within the effort limit.', v_set_increment);
    ELSIF v_success AND v_strategy = 'density' THEN
      v_outcome := 'adjust_rest';
      v_recommended_rest := GREATEST(v_min_rest, COALESCE(v_exercise.rest_seconds, round(v_avg_rest)::int) - v_rest_decrement);
      v_reason := format('Reduce rest by %s seconds while preserving completed volume.', v_rest_decrement);
    ELSIF v_success AND v_strategy = 'reps_only' THEN
      v_outcome := 'increase_reps'; v_recommended_reps := v_rep_max + v_rep_increment;
      v_reason := format('All sets reached %s reps within the effort limit.', v_rep_max);
    ELSIF v_success THEN
      v_outcome := 'increase_load'; v_recommended_weight := COALESCE(v_current_weight, 0) + v_load_increment; v_recommended_reps := v_rep_min;
      v_reason := CASE WHEN v_strategy = 'rir_based' THEN format('Average RIR met the %s RIR target.', v_target_rir) ELSE 'All prescribed work met the progression rule.' END;
    ELSE
      v_outcome := 'repeat'; v_reason := 'Repeat the current target until every set meets the progression rule.';
    END IF;

    INSERT INTO public.workout_progression_recommendations (
      session_id, program_exercise_id, user_id, outcome, previous_weight_kg,
      recommended_weight_kg, recommended_reps, recommended_sets, recommended_rir,
      recommended_rest_seconds, reason, evidence
    ) VALUES (
      NEW.id, v_exercise.id, NEW.user_id, v_outcome, v_current_weight,
      v_recommended_weight, v_recommended_reps, v_recommended_sets, v_recommended_rir,
      v_recommended_rest, v_reason,
      jsonb_build_object('strategy', v_strategy, 'completed_sets', v_completed_sets,
        'prescribed_sets', v_exercise.sets, 'min_reps', v_min_reps, 'max_reps', v_max_reps,
        'average_rpe', v_avg_rpe, 'average_rir', v_avg_rir, 'average_rest_seconds', v_avg_rest)
    )
    ON CONFLICT (session_id, program_exercise_id) DO UPDATE SET
      outcome = EXCLUDED.outcome, previous_weight_kg = EXCLUDED.previous_weight_kg,
      recommended_weight_kg = EXCLUDED.recommended_weight_kg, recommended_reps = EXCLUDED.recommended_reps,
      recommended_sets = EXCLUDED.recommended_sets, recommended_rir = EXCLUDED.recommended_rir,
      recommended_rest_seconds = EXCLUDED.recommended_rest_seconds,
      reason = EXCLUDED.reason, evidence = EXCLUDED.evidence;
  END LOOP;
  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.workout_progression_recommendations.recommended_sets IS 'Recommended set count for the next iteration.';
COMMENT ON COLUMN public.workout_progression_recommendations.recommended_rir IS 'Recommended reps in reserve target for the next iteration.';
COMMENT ON COLUMN public.workout_progression_recommendations.recommended_rest_seconds IS 'Recommended rest duration for the next iteration.';
