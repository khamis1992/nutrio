-- Migration: Tag coach message notifications properly and group into conversation cards
-- 
-- Problem 1: notify_coach_message() used type='general', making coach messages
-- indistinguishable from other notifications.
-- Problem 2: Every message created a new notification card, flooding the page.
-- 
-- Fix: Tag as 'coach_message', and upsert into a single conversation card per coach-client pair.

-- 1. Add coach_message to the notification_type enum
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coach_message';

-- 2. Rewrite trigger to upsert: update existing unread card, insert only if no unread card exists
CREATE OR REPLACE FUNCTION notify_coach_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_id uuid;
  v_recipient_id uuid;
BEGIN
  v_recipient_id := CASE WHEN NEW.sender_role = 'coach' THEN NEW.client_id ELSE NEW.coach_id END;

  -- Check if there's already an unread coach_message notification for this coach-client pair
  SELECT id INTO v_existing_id
  FROM notifications
  WHERE user_id = v_recipient_id
    AND type = 'coach_message'
    AND status = 'unread'
    AND data->>'coach_id' = NEW.coach_id::text
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    -- Update existing notification card with latest message
    UPDATE notifications
    SET message = substring(NEW.message, 1, 100),
        created_at = now(),
        status = 'unread',
        read_at = NULL,
        data = jsonb_build_object('coach_id', NEW.coach_id, 'client_id', NEW.client_id, 'sender_role', NEW.sender_role)
    WHERE id = v_existing_id;
  ELSE
    -- Insert a new conversation card
    INSERT INTO notifications (user_id, type, title, message, data, status)
    VALUES (
      v_recipient_id,
      'coach_message',
      CASE WHEN NEW.sender_role = 'coach' 
        THEN 'New message from your coach' 
        ELSE 'New message from your client' 
      END,
      substring(NEW.message, 1, 100),
      jsonb_build_object('coach_id', NEW.coach_id, 'client_id', NEW.client_id, 'sender_role', NEW.sender_role),
      'unread'
    );
  END IF;

  RETURN NEW;
END;
$$;
