-- Migration: Create streak calculation system
-- Created: 2026-02-23
-- Purpose: Automatically calculate and update user streak_days based on meal logging

-- Function to calculate current streak for a user
CREATE OR REPLACE FUNCTION public.calculate_user_streak(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    current_streak INTEGER := 0;
    last_log_date DATE;
    today DATE := CURRENT_DATE;
BEGIN
    -- Get the most recent log date
    SELECT MAX(log_date) INTO last_log_date
    FROM public.progress_logs
    WHERE user_id = user_uuid;
    
    -- If no logs, streak is 0
    IF last_log_date IS NULL THEN
        RETURN 0;
    END IF;
    
    -- If last log was not today or yesterday, streak is broken
    IF last_log_date < today - INTERVAL '1 day' THEN
        RETURN 0;
    END IF;
    
    -- Calculate streak by counting consecutive days backward from last log
    current_streak := 1;
    
    WHILE EXISTS (
        SELECT 1 FROM public.progress_logs
        WHERE user_id = user_uuid
        AND log_date = last_log_date - (current_streak || ' days')::INTERVAL
    ) LOOP
        current_streak := current_streak + 1;
    END LOOP;
    
    RETURN current_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update streak when progress_logs changes
CREATE OR REPLACE FUNCTION public.update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
    user_uuid UUID;
    new_streak INTEGER;
BEGIN
    -- Get the user_id from the progress_logs record
    IF TG_OP = 'DELETE' THEN
        user_uuid := OLD.user_id;
    ELSE
        user_uuid := NEW.user_id;
    END IF;
    
    -- Calculate the new streak
    new_streak := public.calculate_user_streak(user_uuid);
    
    -- Update the profiles table
    UPDATE public.profiles
    SET 
        streak_days = new_streak,
        updated_at = NOW()
    WHERE user_id = user_uuid;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_progress_log_changed ON public.progress_logs;

-- Create trigger to update streak on progress_logs changes
CREATE TRIGGER on_progress_log_changed
    AFTER INSERT OR UPDATE OR DELETE ON public.progress_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_streak();

-- Initialize streak_days for existing users
UPDATE public.profiles p
SET streak_days = COALESCE(
    (SELECT public.calculate_user_streak(p.user_id)),
    0
)
WHERE streak_days IS NULL OR streak_days = 0;

-- Add comment to document the function
COMMENT ON FUNCTION public.calculate_user_streak(UUID) IS 
    'Calculates the current consecutive day streak for a user based on progress_logs entries';

COMMENT ON FUNCTION public.update_user_streak() IS 
    'Trigger function to automatically update profiles.streak_days when progress_logs changes';
