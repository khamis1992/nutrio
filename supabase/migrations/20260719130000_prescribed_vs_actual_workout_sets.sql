-- Preserve the prescription shown to the client alongside each performed set.
-- This keeps workout history auditable when a coach edits the program later.

ALTER TABLE public.coach_workout_set_logs
  ADD COLUMN IF NOT EXISTS target_reps_min integer,
  ADD COLUMN IF NOT EXISTS target_reps_max integer,
  ADD COLUMN IF NOT EXISTS target_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS target_rpe numeric,
  ADD COLUMN IF NOT EXISTS target_rir numeric,
  ADD COLUMN IF NOT EXISTS target_rest_seconds integer,
  ADD COLUMN IF NOT EXISTS rir numeric,
  ADD COLUMN IF NOT EXISTS actual_rest_seconds integer;

ALTER TABLE public.coach_workout_set_logs
  DROP CONSTRAINT IF EXISTS coach_workout_set_logs_target_reps_range_check,
  DROP CONSTRAINT IF EXISTS coach_workout_set_logs_target_weight_check,
  DROP CONSTRAINT IF EXISTS coach_workout_set_logs_target_rpe_check,
  DROP CONSTRAINT IF EXISTS coach_workout_set_logs_target_rir_check,
  DROP CONSTRAINT IF EXISTS coach_workout_set_logs_target_rest_check,
  DROP CONSTRAINT IF EXISTS coach_workout_set_logs_rir_check,
  DROP CONSTRAINT IF EXISTS coach_workout_set_logs_actual_rest_check;

ALTER TABLE public.coach_workout_set_logs
  ADD CONSTRAINT coach_workout_set_logs_target_reps_range_check CHECK (
    (target_reps_min IS NULL AND target_reps_max IS NULL)
    OR (
      target_reps_min IS NOT NULL
      AND target_reps_max IS NOT NULL
      AND target_reps_min >= 0
      AND target_reps_max >= target_reps_min
    )
  ),
  ADD CONSTRAINT coach_workout_set_logs_target_weight_check
    CHECK (target_weight_kg IS NULL OR target_weight_kg >= 0),
  ADD CONSTRAINT coach_workout_set_logs_target_rpe_check
    CHECK (target_rpe IS NULL OR target_rpe BETWEEN 1 AND 10),
  ADD CONSTRAINT coach_workout_set_logs_target_rir_check
    CHECK (target_rir IS NULL OR target_rir BETWEEN 0 AND 10),
  ADD CONSTRAINT coach_workout_set_logs_target_rest_check
    CHECK (target_rest_seconds IS NULL OR target_rest_seconds BETWEEN 0 AND 7200),
  ADD CONSTRAINT coach_workout_set_logs_rir_check
    CHECK (rir IS NULL OR rir BETWEEN 0 AND 10),
  ADD CONSTRAINT coach_workout_set_logs_actual_rest_check
    CHECK (actual_rest_seconds IS NULL OR actual_rest_seconds BETWEEN 0 AND 7200);

CREATE INDEX IF NOT EXISTS idx_coach_workout_set_logs_exercise_created
  ON public.coach_workout_set_logs(program_exercise_id, created_at DESC)
  WHERE program_exercise_id IS NOT NULL;

COMMENT ON COLUMN public.coach_workout_set_logs.target_reps_min IS
  'Minimum prescribed repetitions shown when the set was logged.';
COMMENT ON COLUMN public.coach_workout_set_logs.target_reps_max IS
  'Maximum prescribed repetitions shown when the set was logged.';
COMMENT ON COLUMN public.coach_workout_set_logs.target_weight_kg IS
  'Prescribed load shown when the set was logged.';
COMMENT ON COLUMN public.coach_workout_set_logs.target_rpe IS
  'Maximum prescribed RPE shown when the set was logged.';
COMMENT ON COLUMN public.coach_workout_set_logs.target_rir IS
  'Prescribed reps in reserve derived from the target RPE.';
COMMENT ON COLUMN public.coach_workout_set_logs.actual_rest_seconds IS
  'Rest actually taken after the set, capped at two hours.';
