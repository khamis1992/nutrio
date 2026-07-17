-- Reconciled with the applied remote migration version; executable SQL is unchanged.
-- Preserve the upstream exercise identity while keeping legacy/custom names valid.
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS exercise_catalog_id text;

CREATE INDEX IF NOT EXISTS idx_program_exercises_catalog_id
  ON public.program_exercises(exercise_catalog_id)
  WHERE exercise_catalog_id IS NOT NULL;

COMMENT ON COLUMN public.program_exercises.exercise_catalog_id IS
  'Optional ID from hasaneyldrm/exercises-dataset. Null means a custom or legacy exercise.';
