CREATE OR REPLACE FUNCTION complete_meal_atomic(
    p_schedule_id UUID,
    p_user_id UUID,
    p_log_date DATE,
    p_calories INTEGER DEFAULT 0,
    p_protein_g INTEGER DEFAULT 0,
    p_carbs_g INTEGER DEFAULT 0,
    p_fat_g INTEGER DEFAULT 0,
    p_fiber_g INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule_record RECORD;
    v_existing_progress RECORD;
    v_result JSONB;
    v_meal_name TEXT;
    v_logged_at TIMESTAMPTZ;
BEGIN
    SELECT ms.*, m.calories, m.protein_g, m.carbs_g, m.fat_g, m.fiber_g, m.name
    INTO v_schedule_record
    FROM meal_schedules ms
    JOIN meals m ON ms.meal_id = m.id
    WHERE ms.id = p_schedule_id
    AND ms.user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Schedule not found or unauthorized',
            'code', 'NOT_FOUND'
        );
    END IF;

    IF v_schedule_record.is_completed THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Meal already completed',
            'was_already_completed', true
        );
    END IF;

    IF p_calories = 0 AND v_schedule_record.calories IS NOT NULL THEN
        p_calories := v_schedule_record.calories;
    END IF;
    IF p_protein_g = 0 AND v_schedule_record.protein_g IS NOT NULL THEN
        p_protein_g := v_schedule_record.protein_g;
    END IF;
    IF p_carbs_g = 0 AND v_schedule_record.carbs_g IS NOT NULL THEN
        p_carbs_g := v_schedule_record.carbs_g;
    END IF;
    IF p_fat_g = 0 AND v_schedule_record.fat_g IS NOT NULL THEN
        p_fat_g := v_schedule_record.fat_g;
    END IF;
    IF p_fiber_g = 0 AND v_schedule_record.fiber_g IS NOT NULL THEN
        p_fiber_g := v_schedule_record.fiber_g;
    END IF;

    v_meal_name := v_schedule_record.name;
    v_logged_at := NOW();

    SELECT * INTO v_existing_progress
    FROM progress_logs
    WHERE user_id = p_user_id
    AND log_date = p_log_date
    FOR UPDATE;

    BEGIN
        UPDATE meal_schedules
        SET is_completed = true,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_schedule_id;

        IF v_existing_progress IS NULL THEN
            INSERT INTO progress_logs (
                user_id, log_date, calories_consumed, protein_consumed_g,
                carbs_consumed_g, fat_consumed_g, fiber_consumed_g, created_at, updated_at
            ) VALUES (
                p_user_id, p_log_date, p_calories, p_protein_g,
                p_carbs_g, p_fat_g, p_fiber_g, NOW(), NOW()
            );
        ELSE
            UPDATE progress_logs
            SET calories_consumed = calories_consumed + p_calories,
                protein_consumed_g = protein_consumed_g + p_protein_g,
                carbs_consumed_g = carbs_consumed_g + p_carbs_g,
                fat_consumed_g = fat_consumed_g + p_fat_g,
                fiber_consumed_g = COALESCE(fiber_consumed_g, 0) + p_fiber_g,
                updated_at = NOW()
            WHERE id = v_existing_progress.id;
        END IF;

        INSERT INTO meal_history (
            user_id, name, calories, protein_g, carbs_g, fat_g, logged_at
        ) VALUES (
            p_user_id,
            COALESCE(v_meal_name, 'Meal'),
            p_calories, p_protein_g, p_carbs_g, p_fat_g, v_logged_at
        );

        UPDATE profiles
        SET xp = COALESCE(xp, 0) + 10,
            total_meals_logged = COALESCE(total_meals_logged, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id;

        SELECT jsonb_build_object(
            'success', true,
            'schedule_id', p_schedule_id,
            'is_completed', true,
            'was_already_completed', false,
            'nutrition_added', jsonb_build_object(
                'calories', p_calories,
                'protein_g', p_protein_g,
                'carbs_g', p_carbs_g,
                'fat_g', p_fat_g,
                'fiber_g', p_fiber_g
            )
        ) INTO v_result;

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'code', SQLSTATE,
            'detail', 'Transaction failed and was rolled back'
        );
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION complete_meal_atomic(UUID, UUID, DATE, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;