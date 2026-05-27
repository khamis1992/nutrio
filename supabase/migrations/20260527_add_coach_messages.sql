-- Migration: Coach-Client Messaging System
-- Enables real-time chat between coaches and their clients

CREATE TABLE IF NOT EXISTS coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('coach', 'client')),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fetching conversation between coach and client
CREATE INDEX IF NOT EXISTS idx_coach_messages_conversation ON coach_messages(coach_id, client_id, created_at DESC);

-- Index for unread count per user
CREATE INDEX IF NOT EXISTS idx_coach_messages_unread ON coach_messages(client_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_coach_messages_unread_coach ON coach_messages(coach_id, read) WHERE read = false;

-- Enable RLS
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

-- Coaches can read their own messages
CREATE POLICY "coaches_read_own_messages" ON coach_messages
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid() OR client_id = auth.uid());

-- Coaches can insert messages to their clients
CREATE POLICY "coaches_insert_messages" ON coach_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (sender_role = 'coach' AND coach_id = auth.uid()) OR
    (sender_role = 'client' AND client_id = auth.uid())
  );

-- Both can mark messages as read
CREATE POLICY "users_update_read_status" ON coach_messages
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid() OR coach_id = auth.uid())
  WITH CHECK (client_id = auth.uid() OR coach_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE coach_messages;

-- Function to notify on new message
CREATE OR REPLACE FUNCTION notify_coach_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    CASE WHEN NEW.sender_role = 'coach' THEN NEW.client_id ELSE NEW.coach_id END,
    CASE WHEN NEW.sender_role = 'coach' 
      THEN 'New message from your coach' 
      ELSE 'New message from your client' 
    END,
    substring(NEW.message, 1, 100),
    'general'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coach_message_notify ON coach_messages;
CREATE TRIGGER trigger_coach_message_notify
  AFTER INSERT ON coach_messages
  FOR EACH ROW EXECUTE FUNCTION notify_coach_message();
