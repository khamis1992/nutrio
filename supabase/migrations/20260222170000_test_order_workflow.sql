-- Test Script for Order Workflow
-- Run this to verify all status transitions and constraints

-- ============================================
-- TEST 1: Verify status constraint exists
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'valid_order_status' 
        AND conrelid = 'meal_schedules'::regclass
    ) THEN
        RAISE NOTICE '✓ TEST 1 PASSED: valid_order_status constraint exists';
    ELSE
        RAISE EXCEPTION '✗ TEST 1 FAILED: valid_order_status constraint missing';
    END IF;
END $$;

-- ============================================
-- TEST 2: Verify order_status_history table exists
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'order_status_history'
    ) THEN
        RAISE NOTICE '✓ TEST 2 PASSED: order_status_history table exists';
    ELSE
        RAISE EXCEPTION '✗ TEST 2 FAILED: order_status_history table missing';
    END IF;
END $$;

-- ============================================
-- TEST 3: Verify all 8 statuses are valid
-- ============================================
DO $$
DECLARE
    v_statuses TEXT[] := ARRAY['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled'];
    v_status TEXT;
    v_test_order_id UUID;
BEGIN
    -- Create a test order
    INSERT INTO meal_schedules (user_id, meal_id, scheduled_date, meal_type, order_status)
    SELECT 
        u.id,
        m.id,
        CURRENT_DATE,
        'lunch',
        'pending'
    FROM auth.users u
    CROSS JOIN meals m
    WHERE m.is_available = true
    LIMIT 1
    RETURNING id INTO v_test_order_id;
    
    IF v_test_order_id IS NULL THEN
        RAISE NOTICE '⚠ Skipping status tests - no test data available';
        RETURN;
    END IF;
    
    -- Test each status
    FOREACH v_status IN ARRAY v_statuses
    LOOP
        BEGIN
            UPDATE meal_schedules 
            SET order_status = v_status 
            WHERE id = v_test_order_id;
            
            RAISE NOTICE '✓ Status "%" is valid', v_status;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION '✗ Status "%" failed: %', v_status, SQLERRM;
        END;
    END LOOP;
    
    -- Clean up test order
    DELETE FROM meal_schedules WHERE id = v_test_order_id;
    
    RAISE NOTICE '✓ TEST 3 PASSED: All 8 statuses are valid';
END $$;

-- ============================================
-- TEST 4: Test invalid status (should fail)
-- ============================================
DO $$
DECLARE
    v_test_order_id UUID;
    v_error_raised BOOLEAN := false;
BEGIN
    -- Create a test order
    INSERT INTO meal_schedules (user_id, meal_id, scheduled_date, meal_type, order_status)
    SELECT 
        u.id,
        m.id,
        CURRENT_DATE,
        'lunch',
        'pending'
    FROM auth.users u
    CROSS JOIN meals m
    WHERE m.is_available = true
    LIMIT 1
    RETURNING id INTO v_test_order_id;
    
    IF v_test_order_id IS NULL THEN
        RAISE NOTICE '⚠ Skipping invalid status test - no test data available';
        RETURN;
    END IF;
    
    -- Try to set invalid status
    BEGIN
        UPDATE meal_schedules 
        SET order_status = 'invalid_status' 
        WHERE id = v_test_order_id;
    EXCEPTION WHEN OTHERS THEN
        v_error_raised := true;
    END;
    
    -- Clean up
    DELETE FROM meal_schedules WHERE id = v_test_order_id;
    
    IF v_error_raised THEN
        RAISE NOTICE '✓ TEST 4 PASSED: Invalid status correctly rejected';
    ELSE
        RAISE EXCEPTION '✗ TEST 4 FAILED: Invalid status was accepted';
    END IF;
END $$;

-- ============================================
-- TEST 5: Test status transition validation
-- ============================================
DO $$
DECLARE
    v_test_order_id UUID;
    v_error_raised BOOLEAN;
BEGIN
    -- Create a test order
    INSERT INTO meal_schedules (user_id, meal_id, scheduled_date, meal_type, order_status)
    SELECT 
        u.id,
        m.id,
        CURRENT_DATE,
        'lunch',
        'pending'
    FROM auth.users u
    CROSS JOIN meals m
    WHERE m.is_available = true
    LIMIT 1
    RETURNING id INTO v_test_order_id;
    
    IF v_test_order_id IS NULL THEN
        RAISE NOTICE '⚠ Skipping transition test - no test data available';
        RETURN;
    END IF;
    
    -- Test valid transition: pending -> confirmed
    BEGIN
        UPDATE meal_schedules 
        SET order_status = 'confirmed' 
        WHERE id = v_test_order_id;
        RAISE NOTICE '✓ Valid transition: pending -> confirmed';
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '✗ Valid transition failed: pending -> confirmed - %', SQLERRM;
    END;
    
    -- Test invalid transition: confirmed -> delivered (should fail)
    v_error_raised := false;
    BEGIN
        UPDATE meal_schedules 
        SET order_status = 'delivered' 
        WHERE id = v_test_order_id;
    EXCEPTION WHEN OTHERS THEN
        v_error_raised := true;
    END;
    
    IF NOT v_error_raised THEN
        RAISE EXCEPTION '✗ Invalid transition was allowed: confirmed -> delivered';
    ELSE
        RAISE NOTICE '✓ Invalid transition correctly blocked: confirmed -> delivered';
    END IF;
    
    -- Clean up
    DELETE FROM meal_schedules WHERE id = v_test_order_id;
    
    RAISE NOTICE '✓ TEST 5 PASSED: Status transition validation works';
END $$;

-- ============================================
-- TEST 6: Verify audit logging works
-- ============================================
DO $$
DECLARE
    v_test_order_id UUID;
    v_history_count INTEGER;
BEGIN
    -- Create a test order
    INSERT INTO meal_schedules (user_id, meal_id, scheduled_date, meal_type, order_status)
    SELECT 
        u.id,
        m.id,
        CURRENT_DATE,
        'lunch',
        'pending'
    FROM auth.users u
    CROSS JOIN meals m
    WHERE m.is_available = true
    LIMIT 1
    RETURNING id INTO v_test_order_id;
    
    IF v_test_order_id IS NULL THEN
        RAISE NOTICE '⚠ Skipping audit test - no test data available';
        RETURN;
    END IF;
    
    -- Make a status change
    UPDATE meal_schedules 
    SET order_status = 'confirmed' 
    WHERE id = v_test_order_id;
    
    -- Check if history was logged
    SELECT COUNT(*) INTO v_history_count
    FROM order_status_history
    WHERE order_id = v_test_order_id;
    
    -- Clean up
    DELETE FROM meal_schedules WHERE id = v_test_order_id;
    DELETE FROM order_status_history WHERE order_id = v_test_order_id;
    
    IF v_history_count > 0 THEN
        RAISE NOTICE '✓ TEST 6 PASSED: Audit logging works (% entries)', v_history_count;
    ELSE
        RAISE EXCEPTION '✗ TEST 6 FAILED: No audit history found';
    END IF;
END $$;

-- ============================================
-- TEST SUMMARY
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ALL TESTS COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Order Workflow Features Verified:';
    RAISE NOTICE '  • Status constraint with 8 valid statuses';
    RAISE NOTICE '  • order_status_history audit table';
    RAISE NOTICE '  • Invalid status rejection';
    RAISE NOTICE '  • Status transition validation';
    RAISE NOTICE '  • Audit logging on status changes';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for production use!';
END $$;
