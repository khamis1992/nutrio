-- Migration: Auto-update goal_proposals.current_value from tracked data
-- When body_measurements, progress_logs, user_streaks, or meal_schedules change,
-- any active goal_proposals for that client get their current_value updated.

CREATE OR REPLACE FUNCTION update_goal_current_value()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_goal RECORD;
  v_current TEXT;
  v_target_val NUMERIC;
BEGIN
  FOR v_goal IN
    SELECT id, goal_type, target_value, client_id
    FROM goal_proposals
    WHERE status = 'accepted'
  LOOP
    v_target_val := NULLIF(v_goal.target_value, '')::numeric;
    v_current := NULL;

    CASE v_goal.goal_type
      WHEN 'weight_target' THEN
        IF TG_TABLE_NAME = 'body_measurements' AND NEW.user_id = v_goal.client_id THEN
          SELECT weight_kg::text INTO v_current
          FROM body_measurements
          WHERE user_id = v_goal.client_id
          ORDER BY log_date DESC
          LIMIT 1;
        END IF;

      WHEN 'calorie_target' THEN
        IF TG_TABLE_NAME = 'progress_logs' AND NEW.user_id = v_goal.client_id THEN
          SELECT ROUND(AVG(calories_consumed))::text INTO v_current
          FROM progress_logs
          WHERE user_id = v_goal.client_id
            AND log_date >= CURRENT_DATE - INTERVAL '7 days';
        END IF;

      WHEN 'streak_target' THEN
        IF TG_TABLE_NAME = 'user_streaks' AND NEW.user_id = v_goal.client_id THEN
          SELECT current_streak::text INTO v_current
          FROM user_streaks
          WHERE user_id = v_goal.client_id AND streak_type = 'logging'
          LIMIT 1;
        END IF;

      WHEN 'workout_frequency' THEN
        IF TG_TABLE_NAME = 'workout_sessions' AND NEW.user_id = v_goal.client_id THEN
          SELECT COUNT(*)::text INTO v_current
          FROM workout_sessions
          WHERE user_id = v_goal.client_id
            AND created_at >= CURRENT_DATE - INTERVAL '7 days';
        END IF;

      WHEN 'meal_adherence' THEN
        IF TG_TABLE_NAME = 'meal_schedules' AND NEW.user_id = v_goal.client_id THEN
          SELECT ROUND(
            (COUNT(*) FILTER (WHERE order_status IN ('delivered', 'completed'))::numeric
             / NULLIF(COUNT(*), 0)) * 100
          )::text INTO v_current
          FROM meal_schedules
          WHERE user_id = v_goal.client_id
            AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days';
        END IF;

      WHEN 'macro_target' THEN
        IF TG_TABLE_NAME = 'progress_logs' AND NEW.user_id = v_goal.client_id THEN
          WITH today_macros AS (
            SELECT
              LEAST(100, (protein_consumed_g / NULLIF(150, 0)) * 100) AS protein_pct,
              LEAST(100, (carbs_consumed_g / NULLIF(250, 0)) * 100) AS carbs_pct,
              LEAST(100, (fat_consumed_g / NULLIF(65, 0)) * 100) AS fat_pct
            FROM progress_logs
            WHERE user_id = v_goal.client_id
              AND log_date = CURRENT_DATE
            LIMIT 1
          )
          SELECT ROUND((protein_pct + carbs_pct + fat_pct) / 3)::text INTO v_current
          FROM today_macros;
        END IF;
    END CASE;

    IF v_current IS NOT NULL THEN
      UPDATE goal_proposals
      SET current_value = v_current,
          updated_at = now()
      WHERE id = v_goal.id
        AND (current_value IS NULL OR current_value != v_current);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_goal_update_on_weight ON body_measurements;
DO $$ BEGIN
CREATE TRIGGER trigger_goal_update_on_weight
  AFTER INSERT OR UPDATE ON body_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_current_value();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


DROP TRIGGER IF EXISTS trigger_goal_update_on_progress ON progress_logs;
DO $$ BEGIN
CREATE TRIGGER trigger_goal_update_on_progress
  AFTER INSERT OR UPDATE ON progress_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_current_value();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


DROP TRIGGER IF EXISTS trigger_goal_update_on_streak ON user_streaks;
DO $$ BEGIN
CREATE TRIGGER trigger_goal_update_on_streak
  AFTER INSERT OR UPDATE ON user_streaks
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_current_value();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;


DROP TRIGGER IF EXISTS trigger_goal_update_on_meals ON meal_schedules;
DO $$ BEGIN
CREATE TRIGGER trigger_goal_update_on_meals
  AFTER INSERT OR UPDATE ON meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_current_value();
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;

