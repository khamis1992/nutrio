-- Migration: Add delivery verification audit and security fixes
-- Date: 2026-04-12
-- Description: 
-- 1. Add order_status_history table for audit trail
-- 2. Add forward-only status transition trigger
-- 3. Add rate limiting for verification attempts
-- 4. Fix wallet debit on cancellation

-- ============================================================
-- 1. ORDER STATUS HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,  -- References meal_schedules or delivery_jobs
    order_type TEXT NOT NULL CHECK (order_type IN ('meal_schedule', 'delivery_job')),
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    changed_by_role TEXT CHECK (changed_by_role IN ('customer', 'partner', 'driver', 'admin', 'system')),
    change_method TEXT CHECK (change_method IN ('qr_scan', 'manual_code', 'api', 'ui_button', 'system', 'override')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.order_status_history IS 'Audit trail for all order status changes';
COMMENT ON COLUMN public.order_status_history.change_method IS 'How the status was changed: qr_scan, manual_code, api, ui_button, system, override';

-- Indexes for order_status_history
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON public.order_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_by ON public.order_status_history(changed_by);

-- RLS for order_status_history
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Everyone can read history (for transparency)
CREATE POLICY "Anyone can view order status history" ON public.order_status_history
    FOR SELECT USING (true);

-- Only system/admin can insert (applications should use functions)
CREATE POLICY "System can insert order status history" ON public.order_status_history
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
            EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
            OR changed_by_role = 'system'
        )
    );

-- ============================================================
-- 2. VERIFICATION ATTEMPTS RATE LIMITING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_job_id UUID NOT NULL REFERENCES delivery_jobs(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id),
    ip_address TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    is_locked BOOLEAN DEFAULT FALSE,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.verification_attempts IS 'Rate limiting for pickup verification attempts';

CREATE INDEX IF NOT EXISTS idx_verification_attempts_job ON public.verification_attempts(delivery_job_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_driver ON public.verification_attempts(driver_id);
CREATE INDEX IF NOT EXISTS idx_verification_attempts_locked ON public.verification_attempts(is_locked) WHERE is_locked = TRUE;

-- RLS
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.verification_attempts
    FOR ALL USING (auth.uid() IS NULL); -- Service key access

CREATE POLICY "Drivers can view own attempts" ON public.verification_attempts
    FOR SELECT USING (driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid()));

-- ============================================================
-- 3. ADD MISSING COLUMNS TO delivery_jobs
-- ============================================================
DO $$
BEGIN
    -- Add columns if they don't exist
    ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;
    ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS verification_attempts INTEGER DEFAULT 0;
    ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS last_verification_attempt_at TIMESTAMPTZ;
    ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS is_verification_locked BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS verification_locked_until TIMESTAMPTZ;
    ALTER TABLE public.delivery_jobs ADD COLUMN IF NOT EXISTS handover_method TEXT CHECK (handover_method IN ('qr', 'manual', 'partner_override'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Column may already exist: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.delivery_jobs.verification_code_hash IS 'SHA256 hash of the current verification code for secure comparison';
COMMENT ON COLUMN public.delivery_jobs.verification_attempts IS 'Number of failed verification attempts';
COMMENT ON COLUMN public.delivery_jobs.is_verification_locked IS 'Whether verification is temporarily locked due to too many failures';

-- ============================================================
-- 4. STATUS TRANSITION VALIDATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION validate_delivery_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    valid_transition BOOLEAN := FALSE;
BEGIN
    -- Only check if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Define valid forward transitions only
        CASE OLD.status
            WHEN 'pending' THEN
                valid_transition := NEW.status IN ('assigned', 'accepted', 'cancelled');
            WHEN 'assigned' THEN
                valid_transition := NEW.status IN ('accepted', 'picked_up', 'cancelled');
            WHEN 'accepted' THEN
                valid_transition := NEW.status IN ('picked_up', 'cancelled');
            WHEN 'picked_up' THEN
                valid_transition := NEW.status IN ('in_transit', 'delivered', 'cancelled');
            WHEN 'in_transit' THEN
                valid_transition := NEW.status IN ('delivered', 'cancelled');
            WHEN 'delivered' THEN
                valid_transition := NEW.status IN ('completed', 'cancelled');
            WHEN 'completed' THEN
                -- Cannot transition from completed
                valid_transition := FALSE;
            WHEN 'cancelled' THEN
                -- Cannot transition from cancelled
                valid_transition := FALSE;
            ELSE
                valid_transition := FALSE;
        END CASE;
        
        -- Allow admin override if explicitly set
        IF NEW.metadata ? 'admin_override' AND NEW.metadata->>'admin_override' = 'true' THEN
            valid_transition := TRUE;
        END IF;
        
        IF NOT valid_transition THEN
            RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
        END IF;
        
        -- Log the status change to history
        INSERT INTO public.order_status_history (
            order_id,
            order_type,
            previous_status,
            new_status,
            changed_by,
            changed_by_role,
            change_method,
            metadata
        ) VALUES (
            NEW.id,
            'delivery_job',
            OLD.status,
            NEW.status,
            COALESCE(NEW.updated_by, auth.uid()),
            COALESCE(NEW.updated_by_role, 'system'),
            COALESCE(NEW.handover_method, 'system'),
            COALESCE(NEW.metadata, '{}'::jsonb)
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS validate_delivery_status_transition ON public.delivery_jobs;

-- Create the trigger
CREATE TRIGGER validate_delivery_status_transition
    BEFORE UPDATE OF status ON public.delivery_jobs
    FOR EACH ROW
    EXECUTE FUNCTION validate_delivery_status_transition();

-- ============================================================
-- 5. WALLET DEBIT ON CANCELLATION
-- ============================================================
CREATE OR REPLACE FUNCTION debit_driver_wallet_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process when status changes TO 'cancelled' from a state where wallet was credited
    IF NEW.status = 'cancelled' AND OLD.status IN ('delivered', 'completed') THEN
        -- Debit driver wallet
        UPDATE public.drivers
        SET 
            wallet_balance = GREATEST(0, COALESCE(wallet_balance, 0) - COALESCE(OLD.driver_earnings, 0)),
            total_deliveries = GREATEST(0, COALESCE(total_deliveries, 0) - 1),
            updated_at = NOW()
        WHERE id = OLD.driver_id;
        
        -- Log this reversal
        INSERT INTO public.order_status_history (
            order_id,
            order_type,
            previous_status,
            new_status,
            changed_by_role,
            change_method,
            metadata
        ) VALUES (
            OLD.id,
            'delivery_job',
            OLD.status,
            'cancelled',
            'system',
            'system',
            jsonb_build_object(
                'reason', 'cancellation_reversal',
                'amount_debited', OLD.driver_earnings,
                'driver_id', OLD.driver_id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS debit_driver_wallet_on_cancellation ON public.delivery_jobs;

CREATE TRIGGER debit_driver_wallet_on_cancellation
    AFTER UPDATE OF status ON public.delivery_jobs
    FOR EACH ROW
    EXECUTE FUNCTION debit_driver_wallet_on_cancellation();

-- ============================================================
-- 6. HELPER FUNCTION TO LOG STATUS CHANGES
-- ============================================================
CREATE OR REPLACE FUNCTION log_order_status_change(
    p_order_id UUID,
    p_order_type TEXT,
    p_previous_status TEXT,
    p_new_status TEXT,
    p_changed_by UUID,
    p_changed_by_role TEXT,
    p_change_method TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_history_id UUID;
BEGIN
    INSERT INTO public.order_status_history (
        order_id,
        order_type,
        previous_status,
        new_status,
        changed_by,
        changed_by_role,
        change_method,
        metadata
    ) VALUES (
        p_order_id,
        p_order_type,
        p_previous_status,
        p_new_status,
        p_changed_by,
        p_changed_by_role,
        p_change_method,
        p_metadata
    )
    RETURNING id INTO v_history_id;
    
    RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION log_order_status_change TO authenticated;

SELECT 'Verification audit and security fixes applied successfully' as status;
