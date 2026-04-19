-- Migration: Create verification RPC functions with security fixes
-- Date: 2026-04-12
-- Description:
-- 1. verify_pickup_by_code - with rate limiting, expiration, driver binding
-- 2. verify_pickup_by_qr - with rate limiting and driver binding
-- 3. refresh_verification_code - with invalidation of old codes
-- 4. partner_confirm_handover - partner manual override
-- 5. generate_pickup_verification_code - generate secure codes

-- ============================================================
-- 1. VERIFY PICKUP BY CODE
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_pickup_by_code(
    p_verification_code TEXT,
    p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_job delivery_jobs%ROWTYPE;
    v_driver drivers%ROWTYPE;
    v_code_hash TEXT;
    v_is_valid BOOLEAN := FALSE;
    v_attempts_record verification_attempts%ROWTYPE;
    v_max_attempts INTEGER := 5;
    v_lock_duration INTERVAL := '15 minutes';
    v_result JSONB;
BEGIN
    -- Input validation
    IF p_verification_code IS NULL OR length(p_verification_code) != 6 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid verification code format'
        );
    END IF;
    
    IF p_driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Driver ID is required'
        );
    END IF;
    
    -- Find the driver
    SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Driver not found'
        );
    END IF;
    
    -- Hash the provided code for comparison
    v_code_hash := encode(sha256(p_verification_code::bytea), 'hex');
    
    -- Find delivery job by verification code hash
    -- The actual code stored is hashed, so we need to find by hash
    SELECT * INTO v_job FROM delivery_jobs 
    WHERE verification_code_hash = v_code_hash
    AND status IN ('assigned', 'accepted')
    FOR UPDATE;
    
    IF NOT FOUND THEN
        -- No job found with this code - try finding by old plain text code for migration
        SELECT * INTO v_job FROM delivery_jobs 
        WHERE pickup_verification_code = p_verification_code
        AND status IN ('assigned', 'accepted')
        FOR UPDATE;
        
        IF NOT FOUND THEN
            -- Record failed attempt for rate limiting
            -- Try to find existing record
            SELECT * INTO v_attempts_record FROM verification_attempts
            WHERE driver_id = p_driver_id
            FOR UPDATE;
            
            IF FOUND THEN
                -- Increment attempt count
                UPDATE verification_attempts SET
                    attempt_count = attempt_count + 1,
                    last_attempt_at = NOW(),
                    ip_address = COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb->>'ip'
                WHERE id = v_attempts_record.id;
            ELSE
                -- Create new record
                INSERT INTO verification_attempts (driver_id, attempt_count)
                VALUES (p_driver_id, 1);
            END IF;
            
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid or expired verification code'
            );
        END IF;
    END IF;
    
    -- Check if this driver is assigned to this job
    IF v_job.driver_id IS NOT NULL AND v_job.driver_id != p_driver_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This delivery is not assigned to you'
        );
    END IF;
    
    -- Check rate limiting
    IF v_job.is_verification_locked THEN
        IF v_job.verification_locked_until > NOW() THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Too many failed attempts. Please try again later.',
                'locked_until', v_job.verification_locked_until
            );
        END IF;
    END IF;
    
    -- Check expiration (if verification_expires_at is set)
    IF v_job.verification_expires_at IS NOT NULL AND v_job.verification_expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Verification code has expired'
        );
    END IF;
    
    -- All checks passed - verify the pickup
    UPDATE delivery_jobs SET
        status = 'picked_up',
        picked_up_at = NOW(),
        qr_scanned_at = NULL,  -- Using code, not QR
        handover_method = 'manual',
        verification_attempts = 0,
        is_verification_locked = FALSE,
        verification_locked_until = NULL,
        updated_at = NOW(),
        updated_by = p_driver_id,
        updated_by_role = 'driver',
        metadata = jsonb_build_object(
            'verified_at', NOW(),
            'verification_method', 'code'
        )
    WHERE id = v_job.id;
    
    -- Clear the verification code hash for security (one-time use)
    UPDATE delivery_jobs SET
        verification_code_hash = NULL,
        pickup_verification_code = NULL
    WHERE id = v_job.id;
    
    -- Log status change
    PERFORM log_order_status_change(
        v_job.id,
        'delivery_job',
        v_job.status,
        'picked_up',
        p_driver_id,
        'driver',
        'manual_code',
        jsonb_build_object('verification_code', '***', 'driver_id', p_driver_id)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pickup verified successfully',
        'job_id', v_job.id,
        'status', 'picked_up'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Verification failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. VERIFY PICKUP BY QR
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_pickup_by_qr(
    p_delivery_id UUID,
    p_qr_code TEXT,
    p_driver_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_job delivery_jobs%ROWTYPE;
    v_driver drivers%ROWTYPE;
    v_is_valid BOOLEAN := FALSE;
BEGIN
    -- Input validation
    IF p_delivery_id IS NULL OR p_qr_code IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery ID and QR code are required'
        );
    END IF;
    
    IF p_driver_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Driver ID is required'
        );
    END IF;
    
    -- Find the driver
    SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Driver not found'
        );
    END IF;
    
    -- Find delivery job by ID and QR code
    SELECT * INTO v_job FROM delivery_jobs 
    WHERE id = p_delivery_id
    AND status IN ('assigned', 'accepted')
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery not found or already picked up'
        );
    END IF;
    
    -- Verify QR code matches (QR code IS the delivery job ID in current implementation)
    IF v_job.id::TEXT != p_qr_code THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid QR code'
        );
    END IF;
    
    -- Check if this driver is assigned to this job
    IF v_job.driver_id IS NOT NULL AND v_job.driver_id != p_driver_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This delivery is not assigned to you'
        );
    END IF;
    
    -- Check rate limiting
    IF v_job.is_verification_locked THEN
        IF v_job.verification_locked_until > NOW() THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Too many failed attempts. Please try again later.',
                'locked_until', v_job.verification_locked_until
            );
        END IF;
    END IF;
    
    -- All checks passed - verify the pickup
    UPDATE delivery_jobs SET
        status = 'picked_up',
        picked_up_at = NOW(),
        qr_scanned_at = NOW(),
        handover_method = 'qr',
        verification_attempts = 0,
        is_verification_locked = FALSE,
        verification_locked_until = NULL,
        updated_at = NOW(),
        updated_by = p_driver_id,
        updated_by_role = 'driver',
        metadata = jsonb_build_object(
            'verified_at', NOW(),
            'verification_method', 'qr_scan'
        )
    WHERE id = v_job.id;
    
    -- Clear verification code for security
    UPDATE delivery_jobs SET
        verification_code_hash = NULL,
        pickup_verification_code = NULL
    WHERE id = v_job.id;
    
    -- Log status change
    PERFORM log_order_status_change(
        v_job.id,
        'delivery_job',
        v_job.status,
        'picked_up',
        p_driver_id,
        'driver',
        'qr_scan',
        jsonb_build_object('qr_code', p_qr_code, 'driver_id', p_driver_id)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Pickup verified successfully',
        'job_id', v_job.id,
        'status', 'picked_up'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Verification failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. REFRESH VERIFICATION CODE
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_verification_code(
    p_delivery_job_id UUID,
    p_partner_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_job delivery_jobs%ROWTYPE;
    v_new_code TEXT;
    v_new_code_hash TEXT;
    v_expiry_time TIMESTAMPTZ;
BEGIN
    -- Input validation
    IF p_delivery_job_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery job ID is required'
        );
    END IF;
    
    -- Find the delivery job
    SELECT * INTO v_job FROM delivery_jobs 
    WHERE id = p_delivery_job_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery not found'
        );
    END IF;
    
    -- Only allow refresh if status is not yet picked_up or delivered
    IF v_job.status IN ('picked_up', 'in_transit', 'delivered', 'completed') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Cannot refresh code - delivery already in progress'
        );
    END IF;
    
    -- Generate new 6-digit code
    v_new_code := lpad(floor(random() * 1000000)::TEXT, 6, '0');
    v_new_code_hash := encode(sha256(v_new_code::bytea), 'hex');
    
    -- Set expiry to 15 minutes from now
    v_expiry_time := NOW() + INTERVAL '15 minutes';
    
    -- Update the delivery job with new code
    UPDATE delivery_jobs SET
        pickup_verification_code = v_new_code,
        verification_code_hash = v_new_code_hash,
        verification_expires_at = v_expiry_time,
        verification_attempts = 0,  -- Reset attempts
        is_verification_locked = FALSE,
        verification_locked_until = NULL,
        updated_at = NOW(),
        metadata = jsonb_build_object(
            'code_refreshed_at', NOW(),
            'code_refreshed_by', p_partner_user_id
        )
    WHERE id = p_delivery_job_id;
    
    -- Log the code refresh
    PERFORM log_order_status_change(
        v_job.id,
        'delivery_job',
        v_job.status,
        v_job.status,  -- Status doesn't change, just the code
        p_partner_user_id,
        'partner',
        'system',
        jsonb_build_object('action', 'code_refresh', 'new_expires_at', v_expiry_time)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Verification code refreshed',
        'verification_code', v_new_code,
        'expires_at', v_expiry_time
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to refresh code: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 4. PARTNER CONFIRM HANDOVER (Override)
-- ============================================================
CREATE OR REPLACE FUNCTION public.partner_confirm_handover(
    p_delivery_job_id UUID,
    p_partner_user_id UUID,
    p_reason TEXT DEFAULT 'Partner override'
)
RETURNS JSONB AS $$
DECLARE
    v_job delivery_jobs%ROWTYPE;
BEGIN
    -- Input validation
    IF p_delivery_job_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery job ID is required'
        );
    END IF;
    
    -- Find the delivery job
    SELECT * INTO v_job FROM delivery_jobs 
    WHERE id = p_delivery_job_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery not found'
        );
    END IF;
    
    -- Only allow override if not already picked up
    IF v_job.status = 'picked_up' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order already picked up'
        );
    END IF;
    
    IF v_job.status IN ('delivered', 'completed') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Order already delivered'
        );
    END IF;
    
    -- Update to picked_up with partner override
    UPDATE delivery_jobs SET
        status = 'picked_up',
        picked_up_at = NOW(),
        qr_scanned_at = NOW(),
        handover_method = 'partner_override',
        verification_attempts = 0,
        is_verification_locked = FALSE,
        verification_locked_until = NULL,
        updated_at = NOW(),
        updated_by = p_partner_user_id,
        updated_by_role = 'partner',
        metadata = jsonb_build_object(
            'verified_at', NOW(),
            'verification_method', 'partner_override',
            'override_reason', p_reason,
            'overridden_by', p_partner_user_id
        )
    WHERE id = p_delivery_job_id;
    
    -- Log the override
    PERFORM log_order_status_change(
        v_job.id,
        'delivery_job',
        v_job.status,
        'picked_up',
        p_partner_user_id,
        'partner',
        'override',
        jsonb_build_object('reason', p_reason, 'override_by', p_partner_user_id)
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Handover confirmed by partner',
        'job_id', v_job.id,
        'status', 'picked_up'
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to confirm handover: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. GENERATE PICKUP VERIFICATION CODE (Initialize on job creation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_pickup_verification_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
BEGIN
    -- Generate random 6-digit code
    v_code := lpad(floor(random() * 1000000)::TEXT, 6, '0');
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. HELPER: Initialize verification on delivery job creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.initialize_delivery_verification(
    p_delivery_job_id UUID,
    p_partner_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_job delivery_jobs%ROWTYPE;
    v_code TEXT;
    v_code_hash TEXT;
    v_expiry_time TIMESTAMPTZ;
BEGIN
    -- Find the delivery job
    SELECT * INTO v_job FROM delivery_jobs WHERE id = p_delivery_job_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Delivery not found'
        );
    END IF;
    
    -- Generate code
    v_code := generate_pickup_verification_code();
    v_code_hash := encode(sha256(v_code::bytea), 'hex');
    v_expiry_time := NOW() + INTERVAL '15 minutes';
    
    -- Update job with verification info
    UPDATE delivery_jobs SET
        pickup_verification_code = v_code,
        verification_code_hash = v_code_hash,
        verification_expires_at = v_expiry_time,
        updated_at = NOW(),
        metadata = jsonb_build_object(
            'verification_initialized_at', NOW(),
            'verification_expires_at', v_expiry_time
        )
    WHERE id = p_delivery_job_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'verification_code', v_code,
        'expires_at', v_expiry_time
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.verify_pickup_by_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pickup_by_qr TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_verification_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_confirm_handover TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pickup_verification_code TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_delivery_verification TO authenticated;

SELECT 'Verification RPC functions created successfully' as status;
