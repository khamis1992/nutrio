-- Session feedback and auditable exercise changes made during guided workouts.

ALTER TABLE public.coach_workout_sessions
  ADD COLUMN IF NOT EXISTS rating smallint,
  ADD COLUMN IF NOT EXISTS perceived_effort smallint,
  ADD COLUMN IF NOT EXISTS feedback text;

ALTER TABLE public.coach_workout_sessions
  DROP CONSTRAINT IF EXISTS coach_workout_sessions_rating_check,
  ADD CONSTRAINT coach_workout_sessions_rating_check CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  DROP CONSTRAINT IF EXISTS coach_workout_sessions_perceived_effort_check,
  ADD CONSTRAINT coach_workout_sessions_perceived_effort_check CHECK (perceived_effort IS NULL OR perceived_effort BETWEEN 1 AND 10);

CREATE TABLE IF NOT EXISTS public.coach_workout_exercise_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.coach_workout_sessions(id) ON DELETE CASCADE,
  program_exercise_id uuid REFERENCES public.program_exercises(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  original_exercise_name text NOT NULL,
  replacement_exercise_catalog_id text,
  replacement_exercise_name text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coach_workout_exercise_events_type_check CHECK (event_type IN ('skipped', 'replaced', 'note')),
  CONSTRAINT coach_workout_exercise_events_replacement_check CHECK (
    event_type <> 'replaced' OR replacement_exercise_name IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_events_session
  ON public.coach_workout_exercise_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_workout_exercise_events_program_exercise
  ON public.coach_workout_exercise_events(program_exercise_id, created_at DESC);

ALTER TABLE public.coach_workout_exercise_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_manage_own_workout_exercise_events" ON public.coach_workout_exercise_events;
CREATE POLICY "clients_manage_own_workout_exercise_events"
  ON public.coach_workout_exercise_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_workout_sessions sessions
    WHERE sessions.id = coach_workout_exercise_events.session_id
      AND sessions.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.coach_workout_sessions sessions
    WHERE sessions.id = coach_workout_exercise_events.session_id
      AND sessions.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "coaches_view_client_workout_exercise_events" ON public.coach_workout_exercise_events;
CREATE POLICY "coaches_view_client_workout_exercise_events"
  ON public.coach_workout_exercise_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.coach_workout_sessions sessions
    JOIN public.coach_programs programs ON programs.id = sessions.program_id
    WHERE sessions.id = coach_workout_exercise_events.session_id
      AND programs.coach_id = auth.uid()
  ));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_workout_exercise_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.coach_workout_exercise_events IS
  'Audit trail for skipped, replaced, and annotated exercises in guided workout sessions.';
