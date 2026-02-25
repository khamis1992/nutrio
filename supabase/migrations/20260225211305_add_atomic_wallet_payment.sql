-- Migration: Atomic Wallet Payment Processing
-- Date: 2025-02-25
-- Description: Creates RPC function to atomically process payment and credit wallet
-- Addresses: SYS-002 (Non-atomic wallet credit)

-- First, add status tracking for payment processing
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wallet_credited BOOLEAN DEFAULT false;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wallet_credit_error TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Create index for querying unprocessed payments
CREATE INDEX IF NOT EXISTS idx_payments_wallet_credited 
ON payments(wallet_credited) 
WHERE wallet_credited = false;

-- Create the atomic payment processing function
CREATE OR REPLACE FUNCTION process_payment_atomic(
    p_payment_id UUID,
    p_user_id UUID,
    p_amount DECIMAL(10,2),
    p_payment_method VARCHAR(50),
    p_gateway_reference VARCHAR(255),
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment_record RECORD;
    v_wallet_record RECORD;
    v_new_balance DECIMAL(10,2);
    v_result JSONB;
    v_transaction_id UUID;
BEGIN
    -- Validate the payment doesn't already exist or is being processed
    SELECT * INTO v_payment_record
    FROM payments
    WHERE id = p_payment_id
    FOR UPDATE SKIP LOCKED; -- Skip if already locked by another process

    IF FOUND THEN
        -- Payment already exists
        IF v_payment_record.status = 'completed' AND v_payment_record.wallet_credited THEN
            RETURN jsonb_build_object(
                'success', true,
                'message', 'Payment already processed',
                'already_processed', true,
                'payment_id', p_payment_id
            );
        ELSIF v_payment_record.status = 'processing' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Payment is already being processed',
                'code', 'ALREADY_PROCESSING',
                'payment_id', p_payment_id
            );
        END IF;
    END IF;

    -- Get wallet record with lock
    SELECT * INTO v_wallet_record
    FROM customer_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create wallet if doesn't exist
        INSERT INTO customer_wallets (user_id, balance, total_credits, total_debits, is_active)
        VALUES (p_user_id, 0, 0, 0, true)
        RETURNING * INTO v_wallet_record;
    END IF;

    -- Calculate new balance
    v_new_balance := COALESCE(v_wallet_record.balance, 0) + p_amount;

    -- Perform atomic operations within transaction
    BEGIN
        -- Insert or update payment record
        IF v_payment_record IS NULL THEN
            INSERT INTO payments (
                id,
                user_id,
                amount,
                status,
                gateway,
                gateway_reference,
                description,
                wallet_credited,
                processed_at,
                created_at
            ) VALUES (
                p_payment_id,
                p_user_id,
                p_amount,
                'completed',
                p_payment_method,
                p_gateway_reference,
                p_description,
                true,
                NOW(),
                NOW()
            );
        ELSE
            UPDATE payments
            SET status = 'completed',
                wallet_credited = true,
                processed_at = NOW(),
                updated_at = NOW()
            WHERE id = p_payment_id;
        END IF;

        -- Create wallet transaction record
        INSERT INTO wallet_transactions (
            wallet_id,
            user_id,
            type,
            amount,
            balance_after,
            description,
            reference_id,
            reference_type,
            created_at
        ) VALUES (
            v_wallet_record.id,
            p_user_id,
            'credit',
            p_amount,
            v_new_balance,
            COALESCE(p_description, 'Wallet top-up'),
            p_payment_id,
            'payment',
            NOW()
        )
        RETURNING id INTO v_transaction_id;

        -- Update wallet balance
        UPDATE customer_wallets
        SET balance = v_new_balance,
            total_credits = COALESCE(total_credits, 0) + p_amount,
            updated_at = NOW()
        WHERE id = v_wallet_record.id;

        -- Return success
        SELECT jsonb_build_object(
            'success', true,
            'payment_id', p_payment_id,
            'transaction_id', v_transaction_id,
            'amount', p_amount,
            'new_balance', v_new_balance,
            'wallet_id', v_wallet_record.id
        ) INTO v_result;

        RETURN v_result;

    EXCEPTION WHEN OTHERS THEN
        -- Log the error
        INSERT INTO payment_processing_errors (
            payment_id,
            user_id,
            error_message,
            error_code,
            attempted_at
        ) VALUES (
            p_payment_id,
            p_user_id,
            SQLERRM,
            SQLSTATE,
            NOW()
        );

        -- Update payment record with error if it exists
        IF v_payment_record IS NOT NULL THEN
            UPDATE payments
            SET wallet_credit_error = SQLERRM,
                status = 'failed',
                updated_at = NOW()
            WHERE id = p_payment_id;
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'code', SQLSTATE,
            'payment_id', p_payment_id
        );
    END;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION process_payment_atomic IS 
'Atomically processes a payment and credits the user wallet.
Uses row-level locking to prevent double-spending and race conditions.
Idempotent: Returns success if payment already processed.
Returns JSON with success status, transaction details, and new balance.';

GRANT EXECUTE ON FUNCTION process_payment_atomic TO authenticated;

-- Create error logging table
CREATE TABLE IF NOT EXISTS payment_processing_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    error_code VARCHAR(10),
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

CREATE INDEX idx_payment_errors_unresolved 
ON payment_processing_errors(attempted_at) 
WHERE resolved_at IS NULL;

CREATE INDEX idx_payment_errors_user 
ON payment_processing_errors(user_id);

-- Enable RLS
ALTER TABLE payment_processing_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment errors"
ON payment_processing_errors
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

COMMENT ON TABLE payment_processing_errors IS 
'Log of payment processing failures for debugging and reconciliation.';

-- Create retry function for failed payments
CREATE OR REPLACE FUNCTION retry_failed_payment(
    p_payment_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment RECORD;
    v_result JSONB;
BEGIN
    -- Get the failed payment
    SELECT * INTO v_payment
    FROM payments
    WHERE id = p_payment_id
    AND user_id = p_user_id
    AND status = 'failed'
    AND wallet_credited = false;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Payment not found or not in failed state',
            'code', 'NOT_FOUND'
        );
    END IF;

    -- Retry the payment processing
    SELECT process_payment_atomic(
        p_payment_id,
        p_user_id,
        v_payment.amount,
        v_payment.gateway,
        v_payment.gateway_reference,
        COALESCE(v_payment.description, 'Retry of failed payment')
    ) INTO v_result;

    -- If successful, mark error as resolved
    IF (v_result->>'success')::BOOLEAN THEN
        UPDATE payment_processing_errors
        SET resolved_at = NOW(),
            resolution_notes = 'Automatically resolved via retry'
        WHERE payment_id = p_payment_id
        AND resolved_at IS NULL;
    END IF;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION retry_failed_payment TO authenticated;

-- Create function to reconcile orphaned payments (admin only)
CREATE OR REPLACE FUNCTION reconcile_wallet_credits()
RETURNS TABLE (
    payment_id UUID,
    user_id UUID,
    amount DECIMAL(10,2),
    status VARCHAR(50),
    wallet_credited BOOLEAN,
    action_taken VARCHAR(100)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payment RECORD;
    v_result JSONB;
BEGIN
    -- Only allow admin users
    IF NOT (SELECT is_admin FROM user_roles WHERE user_id = auth.uid() LIMIT 1) THEN
        RAISE EXCEPTION 'Admin access required';
    END IF;

    -- Find payments that completed but wallet wasn't credited
    FOR v_payment IN 
        SELECT p.*
        FROM payments p
        WHERE p.status = 'completed'
        AND (p.wallet_credited = false OR p.wallet_credited IS NULL)
        AND p.created_at > NOW() - INTERVAL '7 days' -- Only recent payments
        ORDER BY p.created_at DESC
    LOOP
        payment_id := v_payment.id;
        user_id := v_payment.user_id;
        amount := v_payment.amount;
        status := v_payment.status;
        wallet_credited := v_payment.wallet_credited;
        
        BEGIN
            -- Attempt to credit wallet
            SELECT process_payment_atomic(
                v_payment.id,
                v_payment.user_id,
                v_payment.amount,
                v_payment.gateway,
                v_payment.gateway_reference,
                'Reconciliation credit'
            ) INTO v_result;

            IF (v_result->>'success')::BOOLEAN THEN
                action_taken := 'Wallet credited successfully';
            ELSE
                action_taken := 'Failed: ' || (v_result->>'error');
            END IF;
        EXCEPTION WHEN OTHERS THEN
            action_taken := 'Error: ' || SQLERRM;
        END;

        RETURN NEXT;
    END LOOP;

    RETURN;
END;
$$;

COMMENT ON FUNCTION reconcile_wallet_credits IS 
'Admin function to find and fix payments that completed but wallet was not credited.
Returns list of payments and actions taken.';

-- Add trigger to auto-retry failed payments
CREATE OR REPLACE FUNCTION auto_retry_failed_payments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment RECORD;
    v_count INT := 0;
BEGIN
    -- Find recent failed payments (last 24 hours) that haven't been retried too many times
    FOR v_payment IN 
        SELECT p.*
        FROM payments p
        LEFT JOIN payment_processing_errors pee ON p.id = pee.payment_id
        WHERE p.status = 'failed'
        AND p.wallet_credited = false
        AND p.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY p.id
        HAVING COUNT(pee.id) < 3 -- Max 3 retry attempts
        ORDER BY p.created_at DESC
        LIMIT 10 -- Process in batches
    LOOP
        PERFORM retry_failed_payment(v_payment.id, v_payment.user_id);
        v_count := v_count + 1;
    END LOOP;

    -- Log the auto-retry run
    INSERT INTO auto_retry_logs (payments_processed, processed_at)
    VALUES (v_count, NOW());
END;
$$;

-- Create log table for auto-retry
CREATE TABLE IF NOT EXISTS auto_retry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payments_processed INTEGER NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON FUNCTION auto_retry_failed_payments IS 
'Background job function to automatically retry recent failed payments.
Called by cron job every 5 minutes.';
