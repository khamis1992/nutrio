CREATE OR REPLACE FUNCTION uncomplete_meal_atomic(
    p_schedule_id UUID,
    p_user_id UUID,
    p_log_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule_record RECORD;
    v_existing_progress RECORD;
    v_logged_nutrition RECORD;
    v_result JSONB;
BEGIN
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

    IF NOT v_schedule_record.is_completed THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Meal was not completed',
            'nothing_to_undo', true
        );
    END IF;

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

    IF v_logged_nutrition IS NULL THEN
        v_logged_nutrition.calories := COALESCE(v_schedule_record.calories, 0);
        v_logged_nutrition.protein_g := COALESCE(v_schedule_record.protein_g, 0);
        v_logged_nutrition.carbs_g := COALESCE(v_schedule_record.carbs_g, 0);
        v_logged_nutrition.fat_g := COALESCE(v_schedule_record.fat_g, 0);
        RAISE WARNING 'No meal_history entry found for schedule %, falling back to base meal values', p_schedule_id;
    END IF;

    SELECT * INTO v_existing_progress
    FROM progress_logs
    WHERE user_id = p_user_id
    AND log_date = p_log_date
    FOR UPDATE;

    BEGIN
        UPDATE meal_schedules
        SET is_completed = false,
            completed_at = NULL,
            updated_at = NOW()
        WHERE id = p_schedule_id;

        IF v_existing_progress IS NOT NULL THEN
            UPDATE progress_logs
            SET calories_consumed = GREATEST(0, calories_consumed - COALESCE(v_logged_nutrition.calories, 0)),
                protein_consumed_g = GREATEST(0, protein_consumed_g - COALESCE(v_logged_nutrition.protein_g, 0)),
                carbs_consumed_g = GREATEST(0, carbs_consumed_g - COALESCE(v_logged_nutrition.carbs_g, 0)),
                fat_consumed_g = GREATEST(0, fat_consumed_g - COALESCE(v_logged_nutrition.fat_g, 0)),
                updated_at = NOW()
            WHERE id = v_existing_progress.id;
        END IF;

        WITH deleted_history AS (
            DELETE FROM meal_history
            WHERE ctid IN (
                SELECT ctid FROM meal_history
                WHERE user_id = p_user_id
                  AND logged_at::date = p_log_date
                  AND name = (
                      SELECT name FROM meals WHERE id = v_schedule_record.meal_id
                  )
                ORDER BY logged_at DESC
                LIMIT 1
            )
            RETURNING id
        )

        UPDATE profiles
        SET xp = GREATEST(0, COALESCE(xp, 0) - 10),
            updated_at = NOW()
        WHERE user_id = p_user_id;

        UPDATE profiles
        SET total_meals_logged = GREATEST(0, COALESCE(total_meals_logged, 0) - 1),
            updated_at = NOW()
        WHERE user_id = p_user_id;

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
$$;

GRANT EXECUTE ON FUNCTION uncomplete_meal_atomic(UUID, UUID, DATE) TO authenticated;