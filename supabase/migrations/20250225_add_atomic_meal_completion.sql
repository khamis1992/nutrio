-- Migration: Atomic Meal Completion
-- Date: 2025-02-25
-- Description: Creates RPC function to atomically complete a meal and update progress logs
-- Addresses: SYS-001 (Race condition in meal completion)

-- First, ensure we have proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_schedules_user_date ON meal_schedules(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_date ON progress_logs(user_id, log_date);

-- Create the atomic completion function
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
BEGIN
    -- Validate the schedule exists and belongs to the user
    SELECT ms.*, m.calories, m.protein_g, m.carbs_g, m.fat_g, m.fiber_g
    INTO v_schedule_record
    FROM meal_schedules ms
    JOIN meals m ON ms.meal_id = m.id
    WHERE ms.id = p_schedule_id
    AND ms.user_id = p_user_id
    FOR UPDATE; -- Lock the row

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Schedule not found or unauthorized',
            'code', 'NOT_FOUND'
        );
    END IF;

    -- If already completed, return success (idempotent)
    IF v_schedule_record.is_completed THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Meal already completed',
            'was_already_completed', true
        );
    END IF;

    -- Use meal nutrition if not provided
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
        SET is_completed = true,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE id = p_schedule_id;

        -- Insert or update progress log
        IF v_existing_progress IS NULL THEN
            INSERT INTO progress_logs (
                user_id,
                log_date,
                calories_consumed,
                protein_consumed_g,
                carbs_consumed_g,
                fat_consumed_g,
                fiber_consumed_g,
                created_at,
                updated_at
            ) VALUES (
                p_user_id,
                p_log_date,
                p_calories,
                p_protein_g,
                p_carbs_g,
                p_fat_g,
                p_fiber_g,
                NOW(),
                NOW()
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

        -- Return success with updated totals
        SELECT jsonb_build_object(
            'success', true,
            'schedule_id', p_schedule_id,
            'is_completed', true,
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
        -- Return error details for debugging
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'code', SQLSTATE,
            'detail', 'Transaction failed and was rolled back'
        );
    END;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION complete_meal_atomic IS 
'Atomically completes a meal schedule and updates the corresponding progress log.
Uses row-level locking to prevent race conditions.
Returns JSON with success status and updated nutrition totals.
Idempotent: Calling twice on same schedule returns success without double-counting.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_meal_atomic TO authenticated;

-- Create rollback function (for undo feature)
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

        -- Subtract from progress log
        IF v_existing_progress IS NOT NULL THEN
            UPDATE progress_logs
            SET calories_consumed = GREATEST(0, calories_consumed - COALESCE(v_schedule_record.calories, 0)),
                protein_consumed_g = GREATEST(0, protein_consumed_g - COALESCE(v_schedule_record.protein_g, 0)),
                carbs_consumed_g = GREATEST(0, carbs_consumed_g - COALESCE(v_schedule_record.carbs_g, 0)),
                fat_consumed_g = GREATEST(0, fat_consumed_g - COALESCE(v_schedule_record.fat_g, 0)),
                fiber_consumed_g = GREATEST(0, COALESCE(fiber_consumed_g, 0) - COALESCE(v_schedule_record.fiber_g, 0)),
                updated_at = NOW()
            WHERE id = v_existing_progress.id;
        END IF;

        -- Return success
        SELECT jsonb_build_object(
            'success', true,
            'schedule_id', p_schedule_id,
            'is_completed', false,
            'nutrition_removed', jsonb_build_object(
                'calories', COALESCE(v_schedule_record.calories, 0),
                'protein_g', COALESCE(v_schedule_record.protein_g, 0),
                'carbs_g', COALESCE(v_schedule_record.carbs_g, 0),
                'fat_g', COALESCE(v_schedule_record.fat_g, 0),
                'fiber_g', COALESCE(v_schedule_record.fiber_g, 0)
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

GRANT EXECUTE ON FUNCTION uncomplete_meal_atomic TO authenticated;

-- Add RLS policy to ensure users can only complete their own meals
CREATE POLICY "Users can complete their own meals"
ON meal_schedules
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create index for completed_at if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_meal_schedules_completed_at 
ON meal_schedules(completed_at) 
WHERE is_completed = true;

-- Add audit logging table
CREATE TABLE IF NOT EXISTS meal_completion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES meal_schedules(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('complete', 'uncomplete')),
    nutrition_data JSONB,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    success BOOLEAN NOT NULL
);

CREATE INDEX idx_meal_completion_audit_user ON meal_completion_audit(user_id);
CREATE INDEX idx_meal_completion_audit_schedule ON meal_completion_audit(schedule_id);

-- Enable RLS on audit table
ALTER TABLE meal_completion_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
ON meal_completion_audit
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMENT ON TABLE meal_completion_audit IS 
'Audit trail for meal completion actions. Used for debugging race conditions and data inconsistencies.';
