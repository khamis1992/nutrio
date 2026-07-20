-- Add structured prescriptions and grouping needed by gym-mode execution.

ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS set_type text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS superset_group text,
  ADD COLUMN IF NOT EXISTS prescription_unit text NOT NULL DEFAULT 'reps',
  ADD COLUMN IF NOT EXISTS target_min numeric,
  ADD COLUMN IF NOT EXISTS target_max numeric,
  ADD COLUMN IF NOT EXISTS weight_rounding_kg numeric NOT NULL DEFAULT 0.5;

ALTER TABLE public.program_exercises
  DROP CONSTRAINT IF EXISTS program_exercises_set_type_check,
  DROP CONSTRAINT IF EXISTS program_exercises_superset_group_check,
  DROP CONSTRAINT IF EXISTS program_exercises_prescription_unit_check,
  DROP CONSTRAINT IF EXISTS program_exercises_target_range_check,
  DROP CONSTRAINT IF EXISTS program_exercises_weight_rounding_check;

ALTER TABLE public.program_exercises
  ADD CONSTRAINT program_exercises_set_type_check CHECK (
    set_type IN ('normal', 'dropset', 'myo', 'partial', 'forced', 'tut', 'isometric', 'jump')
  ),
  ADD CONSTRAINT program_exercises_superset_group_check CHECK (
    superset_group IS NULL OR superset_group ~ '^[A-Z0-9]{1,4}$'
  ),
  ADD CONSTRAINT program_exercises_prescription_unit_check CHECK (
    prescription_unit IN ('reps', 'seconds', 'minutes', 'meters', 'kilometers')
  ),
  ADD CONSTRAINT program_exercises_target_range_check CHECK (
    (target_min IS NULL AND target_max IS NULL)
    OR (
      target_min IS NOT NULL
      AND target_max IS NOT NULL
      AND target_min >= 0
      AND target_max >= target_min
    )
  ),
  ADD CONSTRAINT program_exercises_weight_rounding_check CHECK (
    weight_rounding_kg IN (0.25, 0.5, 1, 1.25, 2, 2.5, 5)
  );

CREATE INDEX IF NOT EXISTS idx_program_exercises_superset
  ON public.program_exercises(program_id, day_number, superset_group, order_index)
  WHERE superset_group IS NOT NULL;

COMMENT ON COLUMN public.program_exercises.set_type IS
  'Execution style for the prescribed sets.';
COMMENT ON COLUMN public.program_exercises.superset_group IS
  'Exercises sharing a group are interleaved by set in guided workout mode.';
COMMENT ON COLUMN public.program_exercises.prescription_unit IS
  'Unit used by target_min and target_max.';
