-- Declarative workout progression rules and auditable recommendations.

ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS progression_rule jsonb NOT NULL DEFAULT '{
    "enabled": false,
    "strategy": "double_progression",
    "rep_min": 8,
    "rep_max": 12,
    "load_increment_kg": 2.5,
    "rep_increment": 1,
    "rpe_ceiling": 8.5,
    "failure_sessions_before_deload": 2,
    "deload_percent": 10
  }'::jsonb;

ALTER TABLE public.program_exercises
  DROP CONSTRAINT IF EXISTS program_exercises_progression_rule_check;

ALTER TABLE public.program_exercises
  ADD CONSTRAINT program_exercises_progression_rule_check CHECK (
    jsonb_typeof(progression_rule) = 'object'
    AND COALESCE((progression_rule->>'enabled')::boolean, false) IN (true, false)
    AND COALESCE(progression_rule->>'strategy', 'double_progression') IN ('double_progression', 'linear_load', 'reps_only')
    AND COALESCE((progression_rule->>'rep_min')::int, 1) > 0
    AND COALESCE((progression_rule->>'rep_max')::int, 1) >= COALESCE((progression_rule->>'rep_min')::int, 1)
    AND COALESCE((progression_rule->>'load_increment_kg')::numeric, 0) >= 0
    AND COALESCE((progression_rule->>'rep_increment')::int, 1) > 0
    AND COALESCE((progression_rule->>'rpe_ceiling')::numeric, 8.5) BETWEEN 6 AND 10
    AND COALESCE((progression_rule->>'failure_sessions_before_deload')::int, 2) BETWEEN 1 AND 6
    AND COALESCE((progression_rule->>'deload_percent')::numeric, 10) BETWEEN 5 AND 30
  );

ALTER TABLE public.coach_workout_set_logs
  ADD COLUMN IF NOT EXISTS rpe numeric CHECK (rpe BETWEEN 1 AND 10);

CREATE TABLE IF NOT EXISTS public.workout_progression_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.coach_workout_sessions(id) ON DELETE CASCADE,
  program_exercise_id uuid NOT NULL REFERENCES public.program_exercises(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('increase_load', 'increase_reps', 'repeat', 'deload')),
  previous_weight_kg numeric,
  recommended_weight_kg numeric,
  recommended_reps int,
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, program_exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_progression_user_exercise
  ON public.workout_progression_recommendations(user_id, program_exercise_id, created_at DESC);

ALTER TABLE public.workout_progression_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_view_own_progression" ON public.workout_progression_recommendations;
CREATE POLICY "clients_view_own_progression" ON public.workout_progression_recommendations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "coaches_view_client_progression" ON public.workout_progression_recommendations;
CREATE POLICY "coaches_view_client_progression" ON public.workout_progression_recommendations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.program_exercises pe
    JOIN public.coach_programs cp ON cp.id = pe.program_id
    WHERE pe.id = workout_progression_recommendations.program_exercise_id
      AND cp.coach_id = auth.uid()
  ));

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
  v_previous_failures int;
  v_outcome text;
  v_recommended_weight numeric;
  v_recommended_reps int;
  v_reason text;
  v_strategy text;
  v_rep_min int;
  v_rep_max int;
  v_load_increment numeric;
  v_rep_increment int;
  v_rpe_ceiling numeric;
  v_failure_limit int;
  v_deload_percent numeric;
  v_success boolean;
  v_failure boolean;
BEGIN
  IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  FOR v_exercise IN
    SELECT pe.*
    FROM public.program_exercises pe
    WHERE pe.program_id = NEW.program_id
      AND pe.day_number = NEW.day_number
      AND COALESCE((pe.progression_rule->>'enabled')::boolean, false)
  LOOP
    SELECT
      count(*) FILTER (WHERE completed),
      min(reps) FILTER (WHERE completed),
      max(reps) FILTER (WHERE completed),
      max(weight_kg) FILTER (WHERE completed),
      avg(rpe) FILTER (WHERE completed AND rpe IS NOT NULL)
    INTO v_completed_sets, v_min_reps, v_max_reps, v_current_weight, v_avg_rpe
    FROM public.coach_workout_set_logs
    WHERE session_id = NEW.id
      AND program_exercise_id = v_exercise.id;

    IF COALESCE(v_completed_sets, 0) = 0 THEN
      CONTINUE;
    END IF;

    v_strategy := COALESCE(v_exercise.progression_rule->>'strategy', 'double_progression');
    v_rep_min := COALESCE((v_exercise.progression_rule->>'rep_min')::int, 8);
    v_rep_max := COALESCE((v_exercise.progression_rule->>'rep_max')::int, 12);
    v_load_increment := COALESCE((v_exercise.progression_rule->>'load_increment_kg')::numeric, 2.5);
    v_rep_increment := COALESCE((v_exercise.progression_rule->>'rep_increment')::int, 1);
    v_rpe_ceiling := COALESCE((v_exercise.progression_rule->>'rpe_ceiling')::numeric, 8.5);
    v_failure_limit := COALESCE((v_exercise.progression_rule->>'failure_sessions_before_deload')::int, 2);
    v_deload_percent := COALESCE((v_exercise.progression_rule->>'deload_percent')::numeric, 10);

    v_success := v_completed_sets >= v_exercise.sets
      AND COALESCE(v_avg_rpe, v_rpe_ceiling) <= v_rpe_ceiling
      AND (v_strategy = 'linear_load' OR COALESCE(v_min_reps, 0) >= v_rep_max);
    v_failure := v_completed_sets < v_exercise.sets
      OR COALESCE(v_min_reps, 0) < v_rep_min
      OR COALESCE(v_avg_rpe, v_rpe_ceiling) > v_rpe_ceiling;

    SELECT count(*) INTO v_previous_failures
    FROM (
      SELECT outcome
      FROM public.workout_progression_recommendations
      WHERE user_id = NEW.user_id
        AND program_exercise_id = v_exercise.id
      ORDER BY created_at DESC
      LIMIT GREATEST(v_failure_limit - 1, 0)
    ) recent
    WHERE outcome IN ('repeat', 'deload');

    IF v_failure AND v_previous_failures >= v_failure_limit - 1 THEN
      v_outcome := 'deload';
      v_recommended_weight := CASE
        WHEN v_current_weight IS NULL THEN NULL
        ELSE round((v_current_weight * (1 - v_deload_percent / 100.0)) * 2) / 2
      END;
      v_recommended_reps := v_rep_min;
      v_reason := format('Reduce load by %s%% after %s sessions below the rule threshold.', v_deload_percent, v_failure_limit);
    ELSIF v_success AND v_strategy = 'reps_only' THEN
      v_outcome := 'increase_reps';
      v_recommended_weight := v_current_weight;
      v_recommended_reps := v_rep_max + v_rep_increment;
      v_reason := format('All prescribed sets reached %s reps within the RPE limit.', v_rep_max);
    ELSIF v_success THEN
      v_outcome := 'increase_load';
      v_recommended_weight := COALESCE(v_current_weight, 0) + v_load_increment;
      v_recommended_reps := v_rep_min;
      v_reason := CASE
        WHEN v_strategy = 'linear_load' THEN 'All prescribed sets were completed within the RPE limit.'
        ELSE format('All prescribed sets reached the top of the %s-%s rep range.', v_rep_min, v_rep_max)
      END;
    ELSE
      v_outcome := 'repeat';
      v_recommended_weight := v_current_weight;
      v_recommended_reps := LEAST(v_rep_max, GREATEST(v_rep_min, COALESCE(v_max_reps, v_rep_min)));
      v_reason := 'Repeat the current target until every set meets the progression rule.';
    END IF;

    INSERT INTO public.workout_progression_recommendations (
      session_id, program_exercise_id, user_id, outcome,
      previous_weight_kg, recommended_weight_kg, recommended_reps,
      reason, evidence
    ) VALUES (
      NEW.id, v_exercise.id, NEW.user_id, v_outcome,
      v_current_weight, v_recommended_weight, v_recommended_reps,
      v_reason,
      jsonb_build_object(
        'strategy', v_strategy,
        'completed_sets', v_completed_sets,
        'prescribed_sets', v_exercise.sets,
        'min_reps', v_min_reps,
        'max_reps', v_max_reps,
        'average_rpe', v_avg_rpe,
        'rpe_ceiling', v_rpe_ceiling
      )
    )
    ON CONFLICT (session_id, program_exercise_id) DO UPDATE SET
      outcome = EXCLUDED.outcome,
      previous_weight_kg = EXCLUDED.previous_weight_kg,
      recommended_weight_kg = EXCLUDED.recommended_weight_kg,
      recommended_reps = EXCLUDED.recommended_reps,
      reason = EXCLUDED.reason,
      evidence = EXCLUDED.evidence;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_evaluate_coach_workout_progression ON public.coach_workout_sessions;
CREATE TRIGGER trigger_evaluate_coach_workout_progression
  AFTER UPDATE OF completed_at ON public.coach_workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.evaluate_coach_workout_progression();

REVOKE ALL ON FUNCTION public.evaluate_coach_workout_progression() FROM PUBLIC;
