-- Migration: Driver Assignment Locking
-- Date: 2025-02-25
-- Description: Prevents race conditions in driver assignment using row-level locking
-- Addresses: SYS-003 (Driver assignment race condition)

-- Add status tracking for driver assignment
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS assignment_attempted_at TIMESTAMPTZ;
ALTER TABLE delivery_jobs ADD COLUMN IF NOT EXISTS assignment_locked_until TIMESTAMPTZ;

-- Add advisory lock support
-- PostgreSQL advisory locks use bigint, we'll use job_id converted to bigint

-- Create function to assign driver with proper locking
CREATE OR REPLACE FUNCTION assign_driver_with_lock(
    p_job_id UUID,
    p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_record RECORD;
    v_driver_record RECORD;
    v_result JSONB;
    v_lock_key BIGINT;
BEGIN
    -- Convert job_id to bigint for advisory lock (using first 8 bytes as integer)
    v_lock_key := ('x' || substr(p_job_id::text, 1, 16))::bit(64)::bigint;

    -- Try to acquire advisory lock (non-blocking)
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Job is currently being processed by another request',
            'code', 'LOCKED',
            'job_id', p_job_id
        );
    END IF;

    -- Get job with lock
    SELECT * INTO v_job_record
    FROM delivery_jobs
    WHERE id = p_job_id
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery job not found',
            'code', 'NOT_FOUND',
            'job_id', p_job_id
        );
    END IF;

    -- Check if already assigned
    IF v_job_record.driver_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Job already assigned to another driver',
            'code', 'ALREADY_ASSIGNED',
            'job_id', p_job_id,
            'assigned_driver_id', v_job_record.driver_id
        );
    END IF;

    -- Check if job is in assignable state
    IF v_job_record.status NOT IN ('pending', 'ready_for_pickup') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Job is not in assignable state: ' || v_job_record.status,
            'code', 'INVALID_STATE',
            'job_id', p_job_id,
            'current_status', v_job_record.status
        );
    END IF;

    -- Verify driver exists and is available
    SELECT * INTO v_driver_record
    FROM drivers
    WHERE id = p_driver_id
    AND is_online = true
    AND is_active = true
    FOR UPDATE SKIP LOCKED;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Driver not found or not available',
            'code', 'DRIVER_UNAVAILABLE',
            'job_id', p_job_id,
            'driver_id', p_driver_id
        );
    END IF;

    -- Check if driver is already assigned to another active job
    IF EXISTS (
        SELECT 1 FROM delivery_jobs 
        WHERE driver_id = p_driver_id 
        AND status IN ('assigned', 'picked_up', 'in_transit')
        AND id != p_job_id
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Driver is already assigned to another active job',
            'code', 'DRIVER_BUSY',
            'job_id', p_job_id,
            'driver_id', p_driver_id
        );
    END IF;

    -- Perform atomic assignment
    BEGIN
        -- Update delivery job
        UPDATE delivery_jobs
        SET driver_id = p_driver_id,
            status = 'assigned',
            assigned_at = NOW(),
            assignment_attempted_at = NOW(),
            updated_at = NOW()
        WHERE id = p_job_id;

        -- Update driver status
        UPDATE drivers
        SET current_job_id = p_job_id,
            updated_at = NOW()
        WHERE id = p_driver_id;

        -- Return success
        SELECT jsonb_build_object(
            'success', true,
            'job_id', p_job_id,
            'driver_id', p_driver_id,
            'status', 'assigned',
            'assigned_at', NOW()
        ) INTO v_result;

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'code', SQLSTATE,
            'job_id', p_job_id
        );
    END;
END;
$$;

GRANT EXECUTE ON FUNCTION assign_driver_with_lock TO authenticated;

COMMENT ON FUNCTION assign_driver_with_lock IS 
'Atomically assigns a driver to a delivery job using advisory locks and row-level locking.
Prevents race conditions when multiple drivers try to accept the same job.
Returns JSON with success status and assignment details.';

-- Create function to unassign driver (for cancellations or reassignments)
CREATE OR REPLACE FUNCTION unassign_driver(
    p_job_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_record RECORD;
    v_result JSONB;
    v_lock_key BIGINT;
BEGIN
    -- Convert job_id to bigint for advisory lock
    v_lock_key := ('x' || substr(p_job_id::text, 1, 16))::bit(64)::bigint;

    -- Acquire advisory lock
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Job is currently locked',
            'code', 'LOCKED'
        );
    END IF;

    -- Get job with lock
    SELECT * INTO v_job_record
    FROM delivery_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Job not found',
            'code', 'NOT_FOUND'
        );
    END IF;

    -- Check if assigned
    IF v_job_record.driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Job was not assigned',
            'nothing_to_unassign', true
        );
    END IF;

    -- Perform unassignment
    BEGIN
        -- Update driver status
        UPDATE drivers
        SET current_job_id = NULL,
            updated_at = NOW()
        WHERE id = v_job_record.driver_id;

        -- Update delivery job
        UPDATE delivery_jobs
        SET driver_id = NULL,
            status = 'pending',
            assigned_at = NULL,
            updated_at = NOW()
        WHERE id = p_job_id;

        -- Log the unassignment
        INSERT INTO driver_assignment_history (
            job_id,
            driver_id,
            action,
            reason,
            performed_at
        ) VALUES (
            p_job_id,
            v_job_record.driver_id,
            'unassigned',
            p_reason,
            NOW()
        );

        SELECT jsonb_build_object(
            'success', true,
            'job_id', p_job_id,
            'driver_id', v_job_record.driver_id,
            'previous_status', v_job_record.status,
            'new_status', 'pending'
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

GRANT EXECUTE ON FUNCTION unassign_driver TO authenticated;

-- Create assignment history table for auditing
CREATE TABLE IF NOT EXISTS driver_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES delivery_jobs(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('assigned', 'unassigned', 'reassigned')),
    reason TEXT,
    performed_by UUID REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_driver_assignment_history_job ON driver_assignment_history(job_id);
CREATE INDEX idx_driver_assignment_history_driver ON driver_assignment_history(driver_id);
CREATE INDEX idx_driver_assignment_history_performed ON driver_assignment_history(performed_at);

ALTER TABLE driver_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own assignment history"
ON driver_assignment_history
FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

CREATE POLICY "Admins can view all assignment history"
ON driver_assignment_history
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true));

-- Create function to find and assign best available driver (for admin/auto-assignment)
CREATE OR REPLACE FUNCTION auto_assign_driver(
    p_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_job_record RECORD;
    v_best_driver RECORD;
    v_result JSONB;
BEGIN
    -- Get job details
    SELECT * INTO v_job_record
    FROM delivery_jobs
    WHERE id = p_job_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Job not found',
            'code', 'NOT_FOUND'
        );
    END IF;

    -- Find best available driver
    SELECT d.*, 
           ST_Distance(
               ST_SetSRID(ST_MakePoint(d.current_lng, d.current_lat), 4326)::geography,
               ST_SetSRID(ST_MakePoint(v_job_record.pickup_lng, v_job_record.pickup_lat), 4326)::geography
           ) as distance_meters
    INTO v_best_driver
    FROM drivers d
    WHERE d.is_online = true
    AND d.is_active = true
    AND d.current_job_id IS NULL
    AND d.last_location_at > NOW() - INTERVAL '10 minutes'
    ORDER BY 
        -- Prioritize drivers closest to pickup
        ST_Distance(
            ST_SetSRID(ST_MakePoint(d.current_lng, d.current_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_job_record.pickup_lng, v_job_record.pickup_lat), 4326)::geography
        )
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No available drivers found',
            'code', 'NO_DRIVERS_AVAILABLE'
        );
    END IF;

    -- Use the locking assignment function
    SELECT assign_driver_with_lock(p_job_id, v_best_driver.id) INTO v_result;

    -- Add driver info to result
    IF (v_result->>'success')::BOOLEAN THEN
        v_result := v_result || jsonb_build_object(
            'driver_name', v_best_driver.full_name,
            'driver_distance_m', v_best_driver.distance_meters
        );
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION auto_assign_driver TO authenticated;

COMMENT ON FUNCTION auto_assign_driver IS 
'Automatically assigns the best available driver to a delivery job based on proximity.
Uses assign_driver_with_lock for thread-safe assignment.';

-- Add index for driver availability queries
CREATE INDEX IF NOT EXISTS idx_drivers_available 
ON drivers(is_online, is_active, current_job_id, last_location_at) 
WHERE is_online = true AND is_active = true AND current_job_id IS NULL;

-- Add index for job assignment queries
CREATE INDEX IF NOT EXISTS idx_delivery_jobs_assignable 
ON delivery_jobs(status, driver_id, created_at) 
WHERE status IN ('pending', 'ready_for_pickup') AND driver_id IS NULL;
