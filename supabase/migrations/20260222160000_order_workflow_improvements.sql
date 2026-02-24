-- Order Workflow Improvements
-- Adds proper status validation and audit logging

-- ============================================
-- STEP 1: Update status constraint to include all statuses
-- ============================================

-- First, check current constraint and update if needed
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE public.meal_schedules
    DROP CONSTRAINT IF EXISTS valid_order_status;
    
    -- Add comprehensive status constraint
    ALTER TABLE public.meal_schedules
    ADD CONSTRAINT valid_order_status 
    CHECK (order_status IN (
        'pending',      -- Order placed, waiting for partner
        'confirmed',    -- Partner accepted order
        'preparing',    -- Partner is cooking
        'ready',        -- Meal ready for pickup/delivery
        'out_for_delivery', -- Driver has it
        'delivered',    -- Driver delivered it
        'completed',    -- Customer confirmed receipt
        'cancelled'     -- Order cancelled
    ));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Error updating constraint: %', SQLERRM;
END $$;

-- ============================================
-- STEP 2: Create order status history table for audit
-- ============================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.meal_schedules(id) ON DELETE CASCADE,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    changed_by_role VARCHAR(20) CHECK (changed_by_role IN ('customer', 'partner', 'driver', 'admin', 'system')),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    ip_address INET
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
    ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at 
    ON public.order_status_history(changed_at);

-- Enable RLS
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own order history"
    ON public.order_status_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.meal_schedules ms
            WHERE ms.id = order_status_history.order_id
            AND ms.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'admin'
        )
    );

-- ============================================
-- STEP 3: Create validation function for status transitions
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role VARCHAR(20);
BEGIN
    -- Skip if status hasn't changed
    IF OLD.order_status = NEW.order_status THEN
        RETURN NEW;
    END IF;
    
    -- Determine user role (this would need to be passed from application)
    -- For now, we'll use a simple validation based on transition validity
    
    -- Define valid transitions
    CASE OLD.order_status
        WHEN 'pending' THEN
            IF NEW.order_status NOT IN ('confirmed', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid transition: Cannot go from pending to %', NEW.order_status;
            END IF;
            
        WHEN 'confirmed' THEN
            IF NEW.order_status NOT IN ('preparing', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid transition: Cannot go from confirmed to %', NEW.order_status;
            END IF;
            
        WHEN 'preparing' THEN
            IF NEW.order_status NOT IN ('ready', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid transition: Cannot go from preparing to %', NEW.order_status;
            END IF;
            
        WHEN 'ready' THEN
            IF NEW.order_status NOT IN ('out_for_delivery', 'cancelled') THEN
                RAISE EXCEPTION 'Invalid transition: Cannot go from ready to %', NEW.order_status;
            END IF;
            
        WHEN 'out_for_delivery' THEN
            IF NEW.order_status NOT IN ('delivered') THEN
                RAISE EXCEPTION 'Invalid transition: Cannot go from out_for_delivery to %', NEW.order_status;
            END IF;
            
        WHEN 'delivered' THEN
            IF NEW.order_status NOT IN ('completed') THEN
                RAISE EXCEPTION 'Invalid transition: Cannot go from delivered to %', NEW.order_status;
            END IF;
            
        WHEN 'completed' THEN
            RAISE EXCEPTION 'Invalid transition: Completed orders cannot change status';
            
        WHEN 'cancelled' THEN
            RAISE EXCEPTION 'Invalid transition: Cancelled orders cannot change status';
            
        ELSE
            RAISE EXCEPTION 'Unknown current status: %', OLD.order_status;
    END CASE;
    
    -- Log the status change
    INSERT INTO public.order_status_history (
        order_id,
        previous_status,
        new_status,
        changed_by,
        changed_by_role,
        changed_at
    ) VALUES (
        NEW.id,
        OLD.order_status,
        NEW.order_status,
        auth.uid(),
        COALESCE(current_setting('app.current_user_role', true), 'system'),
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: Create or replace the validation trigger
-- ============================================

DROP TRIGGER IF EXISTS trigger_validate_status_transition ON public.meal_schedules;
CREATE TRIGGER trigger_validate_status_transition
    BEFORE UPDATE OF order_status ON public.meal_schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_order_status_transition();

-- ============================================
-- STEP 5: Create helper function to get valid next statuses
-- ============================================

CREATE OR REPLACE FUNCTION public.get_valid_next_statuses(current_status VARCHAR)
RETURNS TEXT[] AS $$
BEGIN
    CASE current_status
        WHEN 'pending' THEN
            RETURN ARRAY['confirmed', 'cancelled'];
        WHEN 'confirmed' THEN
            RETURN ARRAY['preparing', 'cancelled'];
        WHEN 'preparing' THEN
            RETURN ARRAY['ready', 'cancelled'];
        WHEN 'ready' THEN
            RETURN ARRAY['out_for_delivery', 'cancelled'];
        WHEN 'out_for_delivery' THEN
            RETURN ARRAY['delivered'];
        WHEN 'delivered' THEN
            RETURN ARRAY['completed'];
        WHEN 'completed' THEN
            RETURN ARRAY[]::TEXT[];
        WHEN 'cancelled' THEN
            RETURN ARRAY[]::TEXT[];
        ELSE
            RETURN ARRAY[]::TEXT[];
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- STEP 6: Create function for role-based status updates
-- ============================================

CREATE OR REPLACE FUNCTION public.update_order_status(
    p_order_id UUID,
    p_new_status VARCHAR,
    p_user_role VARCHAR DEFAULT 'system'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_status VARCHAR;
    v_valid_statuses TEXT[];
    v_order_user_id UUID;
BEGIN
    -- Get current status
    SELECT order_status, user_id 
    INTO v_current_status, v_order_user_id
    FROM public.meal_schedules 
    WHERE id = p_order_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;
    
    -- Get valid next statuses
    v_valid_statuses := public.get_valid_next_statuses(v_current_status);
    
    -- Check if new status is valid
    IF NOT p_new_status = ANY(v_valid_statuses) THEN
        RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
    END IF;
    
    -- Validate role permissions
    CASE p_user_role
        WHEN 'customer' THEN
            -- Customers can only cancel (pending) or confirm delivery (out_for_delivery)
            IF NOT (
                (v_current_status = 'pending' AND p_new_status = 'cancelled') OR
                (v_current_status = 'out_for_delivery' AND p_new_status = 'delivered')
            ) THEN
                RAISE EXCEPTION 'Customers cannot perform this status change';
            END IF;
            
        WHEN 'partner' THEN
            -- Partners can: accept, prepare, ready, cancel (before ready)
            IF NOT (
                (v_current_status = 'pending' AND p_new_status = 'confirmed') OR
                (v_current_status = 'confirmed' AND p_new_status = 'preparing') OR
                (v_current_status = 'preparing' AND p_new_status = 'ready') OR
                (v_current_status IN ('pending', 'confirmed', 'preparing') AND p_new_status = 'cancelled')
            ) THEN
                RAISE EXCEPTION 'Partners cannot perform this status change';
            END IF;
            
        WHEN 'driver' THEN
            -- Drivers can: out_for_delivery, delivered
            IF NOT (
                (v_current_status = 'ready' AND p_new_status = 'out_for_delivery') OR
                (v_current_status = 'out_for_delivery' AND p_new_status = 'delivered')
            ) THEN
                RAISE EXCEPTION 'Drivers cannot perform this status change';
            END IF;
            
        WHEN 'admin' THEN
            -- Admins can cancel any order
            IF p_new_status != 'cancelled' THEN
                RAISE EXCEPTION 'Admins can only cancel orders';
            END IF;
            
        ELSE
            RAISE EXCEPTION 'Invalid user role: %', p_user_role;
    END CASE;
    
    -- Set the user role for the trigger
    PERFORM set_config('app.current_user_role', p_user_role, true);
    
    -- Update the order
    UPDATE public.meal_schedules
    SET order_status = p_new_status,
        updated_at = NOW()
    WHERE id = p_order_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 7: Add comments for documentation
-- ============================================

COMMENT ON TABLE public.order_status_history IS 'Audit log of all order status changes';
COMMENT ON FUNCTION public.validate_order_status_transition() IS 'Validates order status transitions and logs changes';
COMMENT ON FUNCTION public.get_valid_next_statuses(VARCHAR) IS 'Returns array of valid next statuses for a given current status';
COMMENT ON FUNCTION public.update_order_status(UUID, VARCHAR, VARCHAR) IS 'Updates order status with role-based validation';

-- ============================================
-- STEP 8: Update existing orders if needed
-- ============================================

-- Ensure all existing orders have valid statuses
UPDATE public.meal_schedules 
SET order_status = 'pending'
WHERE order_status IS NULL OR order_status = '';
