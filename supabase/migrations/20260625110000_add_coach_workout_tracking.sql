-- Migration: Coach Workout Tracking Tables
-- Enables workout session tracking and set-level logging for guided workouts

-- 1. Workout Sessions — tracks each workout session a client starts
CREATE TABLE IF NOT EXISTS coach_workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid REFERENCES coach_programs(id) ON DELETE SET NULL,
  day_number int NOT NULL CHECK (day_number > 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_seconds int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching a client's sessions ordered by recency
CREATE INDEX IF NOT EXISTS idx_coach_workout_sessions_user
  ON coach_workout_sessions(user_id, started_at DESC);

-- Index for coach-side adherence queries within a date range
CREATE INDEX IF NOT EXISTS idx_coach_workout_sessions_user_date
  ON coach_workout_sessions(user_id, started_at);

-- Index for program-specific queries
CREATE INDEX IF NOT EXISTS idx_coach_workout_sessions_program
  ON coach_workout_sessions(program_id, day_number);

ALTER TABLE coach_workout_sessions ENABLE ROW LEVEL SECURITY;

-- Clients can manage their own workout sessions (start, complete)
DO $$ BEGIN
CREATE POLICY "clients_manage_own_workout_sessions" ON coach_workout_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

-- Coaches can view their clients' workout sessions for adherence tracking
DO $$ BEGIN
CREATE POLICY "coaches_view_client_workout_sessions" ON coach_workout_sessions
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_programs
    WHERE coach_programs.coach_id = auth.uid()
      AND coach_programs.client_id = coach_workout_sessions.user_id
  ));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- 2. Workout Set Logs — individual set-level logging within a session
CREATE TABLE IF NOT EXISTS coach_workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES coach_workout_sessions(id) ON DELETE CASCADE,
  program_exercise_id uuid REFERENCES program_exercises(id) ON DELETE SET NULL,
  exercise_name text NOT NULL,
  set_number int NOT NULL CHECK (set_number > 0),
  reps int CHECK (reps >= 0),
  weight_kg numeric CHECK (weight_kg >= 0),
  completed boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching all logs within a session
CREATE INDEX IF NOT EXISTS idx_coach_workout_set_logs_session
  ON coach_workout_set_logs(session_id, set_number);

ALTER TABLE coach_workout_set_logs ENABLE ROW LEVEL SECURITY;

-- Clients can manage their own set logs
DO $$ BEGIN
CREATE POLICY "clients_manage_own_set_logs" ON coach_workout_set_logs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_workout_sessions
    WHERE coach_workout_sessions.id = coach_workout_set_logs.session_id
      AND coach_workout_sessions.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM coach_workout_sessions
    WHERE coach_workout_sessions.id = coach_workout_set_logs.session_id
      AND coach_workout_sessions.user_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

-- Coaches can view set logs for adherence analysis
DO $$ BEGIN
CREATE POLICY "coaches_view_client_set_logs" ON coach_workout_set_logs
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_workout_sessions
    JOIN coach_programs ON coach_programs.id = coach_workout_sessions.program_id
    WHERE coach_workout_sessions.id = coach_workout_set_logs.session_id
      AND coach_programs.coach_id = auth.uid()
  ));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- 3. Enable realtime for live workout tracking
DO $$ BEGIN
ALTER PUBLICATION supabase_realtime ADD TABLE coach_workout_sessions;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
ALTER PUBLICATION supabase_realtime ADD TABLE coach_workout_set_logs;
EXCEPTION WHEN duplicate_object THEN null;
END $$;


-- 4. Trigger: auto-update updated_at on session update
CREATE OR REPLACE FUNCTION update_coach_workout_session_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coach_workout_session_updated ON coach_workout_sessions;
DO $$ BEGIN
CREATE TRIGGER trigger_coach_workout_session_updated
  BEFORE UPDATE ON coach_workout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_coach_workout_session_timestamp();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;
