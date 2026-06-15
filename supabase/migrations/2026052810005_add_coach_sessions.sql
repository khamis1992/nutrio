-- Migration: Coach Sessions
-- Enables coaches to schedule sessions (video calls, check-ins, etc.) with clients

CREATE TABLE IF NOT EXISTS coach_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  session_type text NOT NULL DEFAULT 'video_call' CHECK (session_type IN ('video_call', 'in_person', 'phone_call', 'check_in')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  meeting_link text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for coach's upcoming sessions
CREATE INDEX IF NOT EXISTS idx_coach_sessions_coach_time
  ON coach_sessions(coach_id, scheduled_at);

-- Index for client's upcoming sessions
CREATE INDEX IF NOT EXISTS idx_coach_sessions_client_time
  ON coach_sessions(client_id, scheduled_at);

-- Enable RLS
ALTER TABLE coach_sessions ENABLE ROW LEVEL SECURITY;

-- Coaches can manage their own sessions
DO $$ BEGIN
CREATE POLICY "coaches_manage_own_sessions" ON coach_sessions
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Clients can view their own sessions
DO $$ BEGIN
CREATE POLICY "clients_view_own_sessions" ON coach_sessions
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Clients can update status of their own sessions (confirm/cancel)
DO $$ BEGIN
CREATE POLICY "clients_update_own_sessions" ON coach_sessions
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Add coach_session_scheduled notification type if it doesn't exist
DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coach_session_scheduled';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: notify client when coach creates a session
CREATE OR REPLACE FUNCTION notify_coach_session_scheduled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    NEW.client_id,
    'coach_session_scheduled',
    'New session scheduled',
    'Your coach scheduled a ' || NEW.session_type || ': ' || NEW.title || ' on ' || to_char(NEW.scheduled_at, 'Mon DD, YYYY at HH:MI AM'),
    jsonb_build_object('session_id', NEW.id, 'coach_id', NEW.coach_id, 'client_id', NEW.client_id, 'scheduled_at', NEW.scheduled_at, 'session_type', NEW.session_type)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coach_session_scheduled ON coach_sessions;
CREATE TRIGGER trigger_coach_session_scheduled
  AFTER INSERT ON coach_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_coach_session_scheduled();
