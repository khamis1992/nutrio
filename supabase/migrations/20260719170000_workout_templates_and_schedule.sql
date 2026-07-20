-- Reusable workout templates plus explicit workout/rest/recovery days and phases.

ALTER TABLE public.coach_programs
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS days_per_week smallint NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS phase_count smallint NOT NULL DEFAULT 1;

ALTER TABLE public.coach_programs
  DROP CONSTRAINT IF EXISTS coach_programs_schedule_mode_check,
  ADD CONSTRAINT coach_programs_schedule_mode_check CHECK (schedule_mode IN ('fixed', 'flexible')),
  DROP CONSTRAINT IF EXISTS coach_programs_days_per_week_check,
  ADD CONSTRAINT coach_programs_days_per_week_check CHECK (days_per_week BETWEEN 1 AND 7),
  DROP CONSTRAINT IF EXISTS coach_programs_phase_count_check,
  ADD CONSTRAINT coach_programs_phase_count_check CHECK (phase_count BETWEEN 1 AND 12);

CREATE TABLE IF NOT EXISTS public.program_workout_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.coach_programs(id) ON DELETE CASCADE,
  day_number integer NOT NULL CHECK (day_number > 0),
  title text NOT NULL DEFAULT 'Training day',
  day_type text NOT NULL DEFAULT 'workout' CHECK (day_type IN ('workout', 'rest', 'recovery')),
  phase_number smallint NOT NULL DEFAULT 1 CHECK (phase_number BETWEEN 1 AND 12),
  preferred_weekday smallint CHECK (preferred_weekday IS NULL OR preferred_weekday BETWEEN 0 AND 6),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_program_workout_days_program
  ON public.program_workout_days(program_id, day_number);

ALTER TABLE public.program_workout_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_participants_view_workout_days" ON public.program_workout_days;
CREATE POLICY "program_participants_view_workout_days" ON public.program_workout_days
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.coach_programs programs
    WHERE programs.id = program_workout_days.program_id
      AND (programs.coach_id = auth.uid() OR programs.client_id = auth.uid())
  ));
DROP POLICY IF EXISTS "coaches_manage_workout_days" ON public.program_workout_days;
CREATE POLICY "coaches_manage_workout_days" ON public.program_workout_days
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.coach_programs programs WHERE programs.id = program_workout_days.program_id AND programs.coach_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.coach_programs programs WHERE programs.id = program_workout_days.program_id AND programs.coach_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.workout_program_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  duration_weeks smallint NOT NULL DEFAULT 4 CHECK (duration_weeks BETWEEN 1 AND 52),
  days_per_week smallint NOT NULL DEFAULT 3 CHECK (days_per_week BETWEEN 1 AND 7),
  schedule_mode text NOT NULL DEFAULT 'flexible' CHECK (schedule_mode IN ('fixed', 'flexible')),
  phase_count smallint NOT NULL DEFAULT 1 CHECK (phase_count BETWEEN 1 AND 12),
  structure jsonb NOT NULL DEFAULT '{"days":[],"exercises":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_program_templates_coach
  ON public.workout_program_templates(coach_id, updated_at DESC);
ALTER TABLE public.workout_program_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coaches_manage_own_workout_templates" ON public.workout_program_templates;
CREATE POLICY "coaches_manage_own_workout_templates" ON public.workout_program_templates
  FOR ALL TO authenticated USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

COMMENT ON COLUMN public.workout_program_templates.structure IS
  'Versioned snapshot of workout days and exercise prescriptions used to instantiate a client program.';
