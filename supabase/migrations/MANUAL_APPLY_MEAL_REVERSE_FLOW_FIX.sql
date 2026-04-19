-- ============================================================
-- MANUAL MIGRATION: Apply Meal Reverse Flow Fixes
-- ============================================================
-- Run this SQL in your Supabase Dashboard SQL Editor
-- (Settings > Database > SQL Editor)
-- ============================================================

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
    v_log_date := DATE(p_logged_at);

    SELECT * INTO v_existing_progress
    FROM progress_logs
    WHERE user_id = p_user_id AND log_date = v_log_date
    FOR UPDATE;

    IF v_existing_progress IS NOT NULL THEN
        UPDATE progress_logs
        SET calories_consumed = GREATEST(0, COALESCE(calories_consumed, 0) - p_calories),
            protein_consumed_g = GREATEST(0, COALESCE(protein_consumed_g, 0) - p_protein_g),
            carbs_consumed_g = GREATEST(0, COALESCE(carbs_consumed_g, 0) - p_carbs_g),
            fat_consumed_g = GREATEST(0, COALESCE(fat_consumed_g, 0) - p_fat_g),
            updated_at = NOW()
        WHERE id = v_existing_progress.id;
    END IF;

    IF p_schedule_id IS NOT NULL THEN
        v_scheduled_date := COALESCE(p_scheduled_date, v_log_date);

        IF EXISTS (SELECT 1 FROM meal_schedules WHERE id = p_schedule_id AND user_id = p_user_id AND is_completed = true) THEN
            UPDATE meal_schedules
            SET is_completed = false, completed_at = NULL, updated_at = NOW()
            WHERE id = p_schedule_id;
        END IF;
    END IF;

    UPDATE profiles
    SET xp = GREATEST(0, COALESCE(xp, 0) - p_xp_amount),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    UPDATE profiles
    SET total_meals_logged = GREATEST(0, COALESCE(total_meals_logged, 0) - 1),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO meal_history_audit (
        user_id, meal_history_id, meal_name, calories, protein_g, carbs_g, fat_g, logged_at, action
    ) VALUES (
        p_user_id, p_meal_history_id, p_meal_name, p_calories, p_protein_g, p_carbs_g, p_fat_g, p_logged_at, 'delete'
    ) RETURNING id INTO v_audit_id;

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

-- Verify the functions were created
SELECT 
    routine_name,
    'Function created successfully' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('deduct_xp_for_meal_deletion', 'delete_meal_entry_atomic');
