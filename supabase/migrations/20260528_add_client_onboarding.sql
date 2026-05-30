-- Migration: Client Onboarding Responses
-- Stores onboarding questionnaire responses when a client connects with a coach

CREATE TABLE IF NOT EXISTS client_onboarding_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  health_goal text NOT NULL CHECK (health_goal IN ('weight_loss', 'muscle_gain', 'maintenance', 'general_health')),
  current_weight_kg decimal(5,2),
  target_weight_kg decimal(5,2),
  activity_level text CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  dietary_preferences text CHECK (dietary_preferences IN ('omnivore', 'vegetarian', 'vegan', 'keto', 'paleo', 'mediterranean')),
  allergies_or_restrictions text,
  medical_conditions text,
  coaching_expectations text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, coach_id)
);

-- Enable RLS
ALTER TABLE client_onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Clients can view their own onboarding responses
CREATE POLICY "clients_view_own_onboarding" ON client_onboarding_responses
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- Clients can insert their own onboarding responses
CREATE POLICY "clients_insert_onboarding" ON client_onboarding_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Clients can update their own onboarding responses (upsert via application logic)
CREATE POLICY "clients_update_own_onboarding" ON client_onboarding_responses
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Coaches can view onboarding responses of their clients
CREATE POLICY "coaches_view_client_onboarding" ON client_onboarding_responses
  FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

-- Add coach_onboarding notification type if it doesn't exist
DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coach_onboarding';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: notify coach when client submits onboarding
CREATE OR REPLACE FUNCTION notify_coach_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    NEW.coach_id,
    'coach_onboarding',
    'Client completed onboarding',
    'A new client has shared their health information with you.',
    jsonb_build_object('client_id', NEW.client_id, 'coach_id', NEW.coach_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coach_onboarding ON client_onboarding_responses;
CREATE TRIGGER trigger_coach_onboarding
  AFTER INSERT ON client_onboarding_responses
  FOR EACH ROW EXECUTE FUNCTION notify_coach_onboarding();
