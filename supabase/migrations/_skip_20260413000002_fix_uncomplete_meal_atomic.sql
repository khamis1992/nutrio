-- Migration: Fix uncomplete_meal_atomic to use logged nutrition values from meal_history
-- Date: 2026-04-13
-- Description: When uncompleting a meal, look up the actual logged nutrition from meal_history
--              instead of using the base meal values, which could differ if user logged custom quantities

-- Drop and recreate uncomplete_meal_atomic with proper nutrition lookup
CREATE OR REPLACE FUNCTION uncomplete_meal_atomic(
    p_schedule_id UUID,
    p_user_id UUID,
    p_log_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
    v_schedule_record RECORD;
    v_existing_progress RECORD;
    v_logged_nutrition RECORD;
    v_result JSONB;
BEGIN
    -- Validate the schedule exists and belongs to the user
    SELECT ms.*, m.calories, m.protein_g, m.carbs_g, m.fat_g, m.fiber_g
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

    -- If not completed, nothing to undo
    IF NOT v_schedule_record.is_completed THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Meal was not completed',
            'nothing_to_undo', true
        );
    END IF;

    -- Look up the most recent meal_history entry for this schedule to get actual logged values
    -- This handles cases where user logged a custom quantity (e.g., 2x portion)
    SELECT calories, protein_g, carbs_g, fat_g
    INTO v_logged_nutrition
    FROM meal_history
    WHERE user_id = p_user_id
      AND logged_at::date = p_log_date
      AND name = (
          SELECT name FROM meals WHERE id = v_schedule_record.meal_id
      )
    ORDER BY logged_at DESC
    LIMIT 1;

    -- If no meal_history entry found, fall back to meal base values (with warning)
    IF v_logged_nutrition IS NULL THEN
        v_logged_nutrition.calories := COALESCE(v_schedule_record.calories, 0);
        v_logged_nutrition.protein_g := COALESCE(v_schedule_record.protein_g, 0);
        v_logged_nutrition.carbs_g := COALESCE(v_schedule_record.carbs_g, 0);
        v_logged_nutrition.fat_g := COALESCE(v_schedule_record.fat_g, 0);
        RAISE WARNING 'No meal_history entry found for schedule %, falling back to base meal values', p_schedule_id;
    END IF;

    -- Check for existing progress log
    SELECT * INTO v_existing_progress
    FROM progress_logs
    WHERE user_id = p_user_id
    AND log_date = p_log_date
    FOR UPDATE;

    -- Perform atomic updates within transaction
    BEGIN
        -- Update meal schedule
        UPDATE meal_schedules
        SET is_completed = false,
            completed_at = NULL,
            updated_at = NOW()
        WHERE id = p_schedule_id;

        -- Subtract from progress log using LOGGED values (not base meal values)
        IF v_existing_progress IS NOT NULL THEN
            UPDATE progress_logs
            SET calories_consumed = GREATEST(0, calories_consumed - COALESCE(v_logged_nutrition.calories, 0)),
                protein_consumed_g = GREATEST(0, protein_consumed_g - COALESCE(v_logged_nutrition.protein_g, 0)),
                carbs_consumed_g = GREATEST(0, carbs_consumed_g - COALESCE(v_logged_nutrition.carbs_g, 0)),
                fat_consumed_g = GREATEST(0, fat_consumed_g - COALESCE(v_logged_nutrition.fat_g, 0)),
                updated_at = NOW()
            WHERE id = v_existing_progress.id;
        END IF;

        -- Delete from meal_history (reverse the insert that happened during completion)
        DELETE FROM meal_history
        WHERE user_id = p_user_id
          AND logged_at::date = p_log_date
          AND name = (
              SELECT name FROM meals WHERE id = v_schedule_record.meal_id
          )
        ORDER BY logged_at DESC
        LIMIT 1;

        -- Deduct XP (reverse the award that happened during completion)
        UPDATE profiles
        SET xp = GREATEST(0, COALESCE(xp, 0) - 10),
            updated_at = NOW()
        WHERE user_id = p_user_id;

        -- Decrement meals logged counter
        UPDATE profiles
        SET total_meals_logged = GREATEST(0, COALESCE(total_meals_logged, 0) - 1),
            updated_at = NOW()
        WHERE user_id = p_user_id;

        -- Return success
        SELECT jsonb_build_object(
            'success', true,
            'schedule_id', p_schedule_id,
            'is_completed', false,
            'nutrition_removed', jsonb_build_object(
                'calories', COALESCE(v_logged_nutrition.calories, 0),
                'protein_g', COALESCE(v_logged_nutrition.protein_g, 0),
                'carbs_g', COALESCE(v_logged_nutrition.carbs_g, 0),
                'fat_g', COALESCE(v_logged_nutrition.fat_g, 0)
            )
        ) INTO v_result;

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'code', SQLSTATE
        );
    END;
END;
$body$;

GRANT EXECUTE ON FUNCTION uncomplete_meal_atomic TO authenticated;
