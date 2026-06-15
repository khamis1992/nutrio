-- Migration: Goal Proposals + Milestone Notification Triggers
-- Enables collaborative goal-setting between coaches and clients,
-- and automatic milestone notifications for achievements

-- Goal proposals table
CREATE TABLE IF NOT EXISTS goal_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (goal_type IN ('weight_target', 'calorie_target', 'macro_target', 'meal_adherence', 'workout_frequency', 'streak_target')),
  target_value text NOT NULL,
  current_value text,
  deadline date,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'rejected', 'completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for coach's proposals
CREATE INDEX IF NOT EXISTS idx_goal_proposals_coach
  ON goal_proposals(coach_id, client_id, status);

-- Index for client's proposals
CREATE INDEX IF NOT EXISTS idx_goal_proposals_client
  ON goal_proposals(client_id, status);

-- Enable RLS
ALTER TABLE goal_proposals ENABLE ROW LEVEL SECURITY;

-- Coaches can manage proposals for their clients
DO $$ BEGIN
CREATE POLICY "coaches_manage_proposals" ON goal_proposals
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Clients can view their own proposals and update status (accept/reject)
DO $$ BEGIN
CREATE POLICY "clients_view_own_proposals" ON goal_proposals
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


DO $$ BEGIN
CREATE POLICY "clients_update_own_proposals" ON goal_proposals
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid() AND (status IN ('accepted', 'rejected')));
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


-- Add coach_milestone and coach_goal_accepted notification types
DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coach_milestone';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'coach_goal_accepted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: notify coach when client accepts a goal proposal
CREATE OR REPLACE FUNCTION notify_coach_goal_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status = 'proposed' AND NEW.status = 'accepted' THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.coach_id,
      'coach_goal_accepted',
      'Goal accepted',
      'Your client accepted the ' || NEW.goal_type || ' goal.',
      jsonb_build_object('proposal_id', NEW.id, 'client_id', NEW.client_id, 'goal_type', NEW.goal_type, 'target_value', NEW.target_value)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_coach_goal_accepted ON goal_proposals;
CREATE TRIGGER trigger_coach_goal_accepted
  AFTER UPDATE ON goal_proposals
  FOR EACH ROW EXECUTE FUNCTION notify_coach_goal_accepted();

-- Milestone detection function: evaluates client progress and notifies coach
CREATE OR REPLACE FUNCTION check_coach_milestones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  coach_record RECORD;
  v_streak_days int;
  v_first_weight decimal;
  v_latest_weight decimal;
  v_adherence_days int;
  v_missed_meal_days int;
  v_coach_id uuid;
BEGIN
  -- Determine the client_id and context based on the trigger source table
  -- TG_TABLE_NAME holds the name of the table that fired the trigger

  -- 1. Streak milestones (trigger on user_streaks)
  IF TG_TABLE_NAME = 'user_streaks' THEN
    SELECT current_streak INTO v_streak_days
    FROM user_streaks
    WHERE user_id = NEW.user_id AND streak_type = 'logging'
    ORDER BY updated_at DESC
    LIMIT 1;

    -- Find active coaches for this client
    FOR coach_record IN
      SELECT coach_id FROM coach_client_assignments
      WHERE client_id = NEW.user_id AND status = 'active'
    LOOP
      v_coach_id := coach_record.coach_id;

      -- Streak milestones: 7, 14, 30 days
      IF v_streak_days IN (7, 14, 30) THEN
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          v_coach_id,
          'coach_milestone',
          'Client streak milestone!',
          'Your client has reached a ' || v_streak_days || '-day logging streak!',
          jsonb_build_object(
            'client_id', NEW.user_id,
            'milestone_type', 'streak',
            'value', v_streak_days
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- 2. Weight milestones (trigger on body_measurements)
  IF TG_TABLE_NAME = 'body_measurements' THEN
    -- Find active coaches
    FOR coach_record IN
      SELECT coach_id FROM coach_client_assignments
      WHERE client_id = NEW.user_id AND status = 'active'
    LOOP
      v_coach_id := coach_record.coach_id;

      -- Get first weight entry in the last 30 days
      SELECT weight_kg INTO v_first_weight
      FROM body_measurements
      WHERE user_id = NEW.user_id
        AND log_date >= (CURRENT_DATE - INTERVAL '30 days')
      ORDER BY log_date ASC
      LIMIT 1;

      -- Get latest weight
      SELECT weight_kg INTO v_latest_weight
      FROM body_measurements
      WHERE user_id = NEW.user_id
      ORDER BY log_date DESC
      LIMIT 1;

      IF v_first_weight IS NOT NULL AND v_latest_weight IS NOT NULL THEN
        -- Check weight milestones: -2kg, -5kg, goal reached
        IF v_first_weight - v_latest_weight >= 5 THEN
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES (
            v_coach_id,
            'coach_milestone',
            'Client weight milestone!',
            'Your client has lost 5 kg!',
            jsonb_build_object(
              'client_id', NEW.user_id,
              'milestone_type', 'weight',
              'value', ROUND((v_first_weight - v_latest_weight)::numeric, 1)
            )
          );
        ELSIF v_first_weight - v_latest_weight >= 2 THEN
          -- Only fire once per milestone
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES (
            v_coach_id,
            'coach_milestone',
            'Client weight milestone!',
            'Your client has lost 2 kg!',
            jsonb_build_object(
              'client_id', NEW.user_id,
              'milestone_type', 'weight',
              'value', 2
            )
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 3. Adherence milestones (trigger on meal_schedules)
  IF TG_TABLE_NAME = 'meal_schedules' THEN
    FOR coach_record IN
      SELECT coach_id FROM coach_client_assignments
      WHERE client_id = NEW.user_id AND status = 'active'
    LOOP
      v_coach_id := coach_record.coach_id;

      -- Check last 3 days adherence
      WITH daily_adherence AS (
        SELECT
          scheduled_date::date AS day,
          COUNT(*) AS total_meals,
          COUNT(*) FILTER (WHERE order_status IN ('delivered', 'completed')) AS eaten_meals
        FROM meal_schedules
        WHERE user_id = NEW.user_id
          AND scheduled_date >= (CURRENT_DATE - INTERVAL '3 days')
        GROUP BY scheduled_date::date
      )
      SELECT COUNT(*) INTO v_adherence_days
      FROM daily_adherence
      WHERE total_meals > 0 AND (eaten_meals::float / total_meals::float) < 0.5;

      IF v_adherence_days >= 3 THEN
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          v_coach_id,
          'coach_milestone',
          'Client adherence alert',
          'Your client has been below 50% meal adherence for 3 consecutive days.',
          jsonb_build_object(
            'client_id', NEW.user_id,
            'milestone_type', 'adherence',
            'value', v_adherence_days
          )
        );
      END IF;

      -- Check consecutive missed meal days
      WITH daily_meals AS (
        SELECT
          scheduled_date::date AS day,
          COUNT(*) AS total_meals
        FROM meal_schedules
        WHERE user_id = NEW.user_id
          AND scheduled_date >= (CURRENT_DATE - INTERVAL '2 days')
        GROUP BY scheduled_date::date
      )
      SELECT COUNT(*) INTO v_missed_meal_days
      FROM daily_meals
      WHERE total_meals = 0;

      IF v_missed_meal_days >= 2 THEN
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          v_coach_id,
          'coach_milestone',
          'Client missed meals',
          'Your client has no scheduled meals for ' || v_missed_meal_days || ' consecutive days.',
          jsonb_build_object(
            'client_id', NEW.user_id,
            'milestone_type', 'missed_meals',
            'value', v_missed_meal_days
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers on source tables
-- Note: If triggers already exist from a previous migration, drop and recreate
DROP TRIGGER IF EXISTS trigger_milestone_streak ON user_streaks;
CREATE TRIGGER trigger_milestone_streak
  AFTER INSERT OR UPDATE ON user_streaks
  FOR EACH ROW
  WHEN (NEW.streak_type = 'logging')
  EXECUTE FUNCTION check_coach_milestones();

DROP TRIGGER IF EXISTS trigger_milestone_weight ON body_measurements;
CREATE TRIGGER trigger_milestone_weight
  AFTER INSERT ON body_measurements
  FOR EACH ROW
  EXECUTE FUNCTION check_coach_milestones();

DROP TRIGGER IF EXISTS trigger_milestone_adherence ON meal_schedules;
CREATE TRIGGER trigger_milestone_adherence
  AFTER INSERT OR UPDATE ON meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION check_coach_milestones();
