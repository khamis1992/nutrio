-- Migration: Fix reverse flow for meal logging
-- Date: 2026-04-12
-- Description: Creates RPC function to atomically subtract meal from progress_logs and add audit logging

-- Create audit table for meal_history deletions
CREATE TABLE IF NOT EXISTS meal_history_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_history_id UUID NOT NULL,
    meal_name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein_g INTEGER NOT NULL,
    carbs_g INTEGER NOT NULL,
    fat_g INTEGER NOT NULL,
    logged_at TIMESTAMPTZ,
    action VARCHAR(20) NOT NULL CHECK (action IN ('delete', 'undone')),
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_history_audit_user ON meal_history_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_history_audit_meal ON meal_history_audit(meal_history_id);

ALTER TABLE meal_history_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own meal history audit"
ON meal_history_audit
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Function to atomically subtract meal nutrition from progress_logs
CREATE OR REPLACE FUNCTION subtract_meal_from_progress(
    p_user_id UUID,
    p_calories INTEGER DEFAULT 0,
    p_protein_g INTEGER DEFAULT 0,
    p_carbs_g INTEGER DEFAULT 0,
    p_fat_g INTEGER DEFAULT 0,
    p_log_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_progress RECORD;
    v_result JSONB;
BEGIN
    -- Check for existing progress log
    SELECT * INTO v_existing_progress
    FROM progress_logs
    WHERE user_id = p_user_id
    AND log_date = p_log_date
    FOR UPDATE;

    IF v_existing_progress IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'No progress log found for date',
            'nothing_to_undo', true
        );
    END IF;

    -- Perform atomic subtraction
    UPDATE progress_logs
    SET calories_consumed = GREATEST(0, COALESCE(calories_consumed, 0) - p_calories),
        protein_consumed_g = GREATEST(0, COALESCE(protein_consumed_g, 0) - p_protein_g),
        carbs_consumed_g = GREATEST(0, COALESCE(carbs_consumed_g, 0) - p_carbs_g),
        fat_consumed_g = GREATEST(0, COALESCE(fat_consumed_g, 0) - p_fat_g),
        updated_at = NOW()
    WHERE id = v_existing_progress.id;

    RETURN jsonb_build_object(
        'success', true,
        'nutrition_removed', jsonb_build_object(
            'calories', p_calories,
            'protein_g', p_protein_g,
            'carbs_g', p_carbs_g,
            'fat_g', p_fat_g
        ),
        'new_totals', jsonb_build_object(
            'calories', GREATEST(0, COALESCE(v_existing_progress.calories_consumed, 0) - p_calories),
            'protein_g', GREATEST(0, COALESCE(v_existing_progress.protein_consumed_g, 0) - p_protein_g),
            'carbs_g', GREATEST(0, COALESCE(v_existing_progress.carbs_consumed_g, 0) - p_carbs_g),
            'fat_g', GREATEST(0, COALESCE(v_existing_progress.fat_consumed_g, 0) - p_fat_g)
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION subtract_meal_from_progress TO authenticated;

-- Function to award XP for meal logging
CREATE OR REPLACE FUNCTION award_xp_for_meal_log(
    p_user_id UUID,
    p_xp_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_xp INTEGER;
BEGIN
    SELECT COALESCE(xp, 0) INTO v_current_xp FROM profiles WHERE user_id = p_user_id;

    UPDATE profiles
    SET xp = COALESCE(xp, 0) + p_xp_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'xp_awarded', p_xp_amount,
        'new_total', v_current_xp + p_xp_amount
    );
END;
$$;

GRANT EXECUTE ON FUNCTION award_xp_for_meal_log TO authenticated;

-- Function to increment total_meals_logged counter
CREATE OR REPLACE FUNCTION increment_meals_logged(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    SELECT COALESCE(total_meals_logged, 0) INTO v_current_count 
    FROM profiles 
    WHERE user_id = p_user_id;

    UPDATE profiles
    SET total_meals_logged = COALESCE(total_meals_logged, 0) + 1,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'meals_logged', v_current_count + 1
    );
END;
$$;

GRANT EXECUTE ON FUNCTION increment_meals_logged TO authenticated;

-- Function to decrement total_meals_logged counter (for undo/delete)
CREATE OR REPLACE FUNCTION decrement_meals_logged(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_count INTEGER;
BEGIN
    SELECT COALESCE(total_meals_logged, 0) INTO v_current_count 
    FROM profiles 
    WHERE user_id = p_user_id;

    UPDATE profiles
    SET total_meals_logged = GREATEST(0, COALESCE(total_meals_logged, 0) - 1),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'meals_logged', GREATEST(0, v_current_count - 1)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_meals_logged TO authenticated;

-- Function to log meal history deletion to audit table
CREATE OR REPLACE FUNCTION audit_meal_history_delete(
    p_user_id UUID,
    p_meal_history_id UUID,
    p_meal_name TEXT,
    p_calories INTEGER,
    p_protein_g INTEGER,
    p_carbs_g INTEGER,
    p_fat_g INTEGER,
    p_logged_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO meal_history_audit (
        user_id, meal_history_id, meal_name, calories, protein_g, carbs_g, fat_g, logged_at, action
    ) VALUES (
        p_user_id, p_meal_history_id, p_meal_name, p_calories, p_protein_g, p_carbs_g, p_fat_g, p_logged_at, 'delete'
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION audit_meal_history_delete TO authenticated;

-- Update the meal_completion_audit to include more context
ALTER TABLE meal_completion_audit ADD COLUMN IF NOT EXISTS nutrition_data JSONB;
ALTER TABLE meal_completion_audit ADD COLUMN IF NOT EXISTS meal_history_id UUID REFERENCES meal_history(id) ON DELETE SET NULL;

-- Function to deduct XP when meal is deleted (reverse of award_xp_for_meal_log)
CREATE OR REPLACE FUNCTION deduct_xp_for_meal_deletion(
    p_user_id UUID,
    p_xp_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_xp INTEGER;
BEGIN
    SELECT COALESCE(xp, 0) INTO v_current_xp FROM profiles WHERE user_id = p_user_id;

    UPDATE profiles
    SET xp = GREATEST(0, COALESCE(xp, 0) - p_xp_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'xp_deducted', p_xp_amount,
        'new_total', GREATEST(0, v_current_xp - p_xp_amount)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION deduct_xp_for_meal_deletion TO authenticated;

-- Fully atomic meal entry deletion function
-- Handles: progress subtraction, XP deduction, meal counter decrement, schedule uncomplete, audit, and meal_history delete
-- All in a single transaction to prevent partial failures
CREATE OR REPLACE FUNCTION delete_meal_entry_atomic(
    p_user_id UUID,
    p_meal_history_id UUID,
    p_meal_name TEXT,
    p_calories INTEGER DEFAULT 0,
    p_protein_g INTEGER DEFAULT 0,
    p_carbs_g INTEGER DEFAULT 0,
    p_fat_g INTEGER DEFAULT 0,
    p_logged_at TIMESTAMPTZ DEFAULT NOW(),
    p_schedule_id UUID DEFAULT NULL,
    p_scheduled_date DATE DEFAULT NULL,
    p_xp_amount INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_progress RECORD;
    v_audit_id UUID;
    v_scheduled_date DATE;
    v_log_date DATE;
BEGIN
    -- Convert logged_at to date for progress log update
    v_log_date := DATE(p_logged_at);

    -- 1. Lock progress row for update if it exists
    SELECT * INTO v_existing_progress
    FROM progress_logs
    WHERE user_id = p_user_id AND log_date = v_log_date
    FOR UPDATE;

    -- 2. Subtract nutrition from progress_logs
    IF v_existing_progress IS NOT NULL THEN
        UPDATE progress_logs
        SET calories_consumed = GREATEST(0, COALESCE(calories_consumed, 0) - p_calories),
            protein_consumed_g = GREATEST(0, COALESCE(protein_consumed_g, 0) - p_protein_g),
            carbs_consumed_g = GREATEST(0, COALESCE(carbs_consumed_g, 0) - p_carbs_g),
            fat_consumed_g = GREATEST(0, COALESCE(fat_consumed_g, 0) - p_fat_g),
            updated_at = NOW()
        WHERE id = v_existing_progress.id;
    END IF;

    -- 3. Uncomplete scheduled meal if schedule_id provided
    IF p_schedule_id IS NOT NULL THEN
        -- Use provided scheduled_date or fall back to logged_at date
        v_scheduled_date := COALESCE(p_scheduled_date, v_log_date);

        -- Only uncomplete if the schedule was actually completed
        IF EXISTS (SELECT 1 FROM meal_schedules WHERE id = p_schedule_id AND user_id = p_user_id AND is_completed = true) THEN
            UPDATE meal_schedules
            SET is_completed = false, completed_at = NULL, updated_at = NOW()
            WHERE id = p_schedule_id;
        END IF;
    END IF;

    -- 4. Deduct XP
    UPDATE profiles
    SET xp = GREATEST(0, COALESCE(xp, 0) - p_xp_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- 5. Decrement meals logged counter
    UPDATE profiles
    SET total_meals_logged = GREATEST(0, COALESCE(total_meals_logged, 0) - 1),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- 6. Audit log the deletion
    INSERT INTO meal_history_audit (
        user_id, meal_history_id, meal_name, calories, protein_g, carbs_g, fat_g, logged_at, action
    ) VALUES (
        p_user_id, p_meal_history_id, p_meal_name, p_calories, p_protein_g, p_carbs_g, p_fat_g, p_logged_at, 'delete'
    ) RETURNING id INTO v_audit_id;

    -- 7. Delete from meal_history
    DELETE FROM meal_history WHERE id = p_meal_history_id AND user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'audit_id', v_audit_id,
        'xp_deducted', p_xp_amount,
        'meal_deleted', p_meal_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION delete_meal_entry_atomic TO authenticated;
