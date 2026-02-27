-- Migration: Order Cancellation RPC Function
-- Date: 2024-01-01
-- Description: Creates RPC function for order cancellation with refund and quota restoration

-- ========================================
-- STEP 1: Create order_cancellations table for audit log
-- ========================================

CREATE TABLE IF NOT EXISTS public.order_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_by_role TEXT CHECK (cancelled_by_role IN ('customer', 'partner', 'admin', 'system')),
  
  -- Cancellation details
  reason TEXT NOT NULL,
  reason_category TEXT CHECK (reason_category IN (
    'changed_mind', 'wrong_item', 'delivery_too_slow', 'restaurant_closed',
    'out_of_stock', 'payment_issue', 'duplicate_order', 'other'
  )),
  
  -- Refund details
  refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  refund_type TEXT CHECK (refund_type IN ('none', 'partial', 'full')),
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  
  -- Cancellation context
  order_status_at_cancel TEXT NOT NULL,
  cancellation_fee NUMERIC(10, 2) DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for order_cancellations
CREATE INDEX IF NOT EXISTS idx_order_cancellations_order_id ON public.order_cancellations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_user_id ON public.order_cancellations(user_id);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_cancelled_by ON public.order_cancellations(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_created_at ON public.order_cancellations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_cancellations_reason_category ON public.order_cancellations(reason_category);

-- Enable RLS
ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;

-- Users can view their own cancellations
DROP POLICY IF EXISTS "Users can view their own cancellations" ON public.order_cancellations;
CREATE POLICY "Users can view their own cancellations"
  ON public.order_cancellations FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all cancellations
DROP POLICY IF EXISTS "Admins can view all cancellations" ON public.order_cancellations;
CREATE POLICY "Admins can view all cancellations"
  ON public.order_cancellations FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ========================================
-- STEP 2: Create cancel_order() RPC function
-- ========================================

CREATE OR REPLACE FUNCTION public.cancel_order(
  p_order_id UUID,
  p_reason TEXT,
  p_reason_category TEXT DEFAULT 'other',
  p_cancelled_by_role TEXT DEFAULT 'customer'
)
RETURNS JSONB AS $$
DECLARE
  v_order_record RECORD;
  v_user_id UUID;
  v_subscription_id UUID;
  v_refund_amount NUMERIC(10, 2) := 0;
  v_cancellation_fee NUMERIC(10, 2) := 0;
  v_wallet_transaction_id UUID;
  v_cancellation_id UUID;
  v_result JSONB;
BEGIN
  -- Get order details with user info
  SELECT 
    o.id,
    o.user_id,
    o.status,
    o.total_amount,
    o.restaurant_id,
    s.id as subscription_id,
    s.meals_used_this_week,
    s.status as subscription_status
  INTO v_order_record
  FROM public.orders o
  LEFT JOIN public.subscriptions s ON s.user_id = o.user_id 
    AND s.status = 'active'
  WHERE o.id = p_order_id
  FOR UPDATE;
  
  -- Validate order exists
  IF v_order_record IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- Set user_id
  v_user_id := v_order_record.user_id;
  v_subscription_id := v_order_record.subscription_id;
  
  -- Check if already cancelled
  IF v_order_record.status = 'cancelled' THEN
    RAISE EXCEPTION 'Order is already cancelled';
  END IF;
  
  -- Check if order can be cancelled based on status and role
  CASE p_cancelled_by_role
    WHEN 'customer' THEN
      -- Customers can only cancel pending orders
      IF v_order_record.status NOT IN ('pending', 'confirmed') THEN
        RAISE EXCEPTION 'Orders in % status cannot be cancelled by customers', v_order_record.status;
      END IF;
      -- Apply cancellation fee for customer cancellations after confirmation
      IF v_order_record.status = 'confirmed' THEN
        v_cancellation_fee := 2.00; -- QAR 2 fee
      END IF;
      
    WHEN 'partner' THEN
      -- Partners can cancel pending, confirmed, or preparing orders
      IF v_order_record.status NOT IN ('pending', 'confirmed', 'preparing') THEN
        RAISE EXCEPTION 'Orders in % status cannot be cancelled by partners', v_order_record.status;
      END IF;
      -- No fee for partner cancellations (restaurant's fault)
      v_cancellation_fee := 0;
      
    WHEN 'admin' THEN
      -- Admins can cancel any order (except already delivered/completed)
      IF v_order_record.status IN ('delivered', 'completed') THEN
        RAISE EXCEPTION 'Delivered or completed orders cannot be cancelled';
      END IF;
      -- No fee for admin cancellations
      v_cancellation_fee := 0;
      
    ELSE
      RAISE EXCEPTION 'Invalid cancelled_by_role: %', p_cancelled_by_role;
  END CASE;
  
  -- Calculate refund amount
  v_refund_amount := GREATEST(v_order_record.total_amount - v_cancellation_fee, 0);
  
  -- Start transaction for atomic operations
  BEGIN
    -- 1. Update order status to cancelled
    UPDATE public.orders
    SET 
      status = 'cancelled',
      updated_at = now()
    WHERE id = p_order_id;
    
    -- 2. Update meal_schedule if exists
    UPDATE public.meal_schedules
    SET order_status = 'cancelled',
        updated_at = now()
    WHERE order_id = p_order_id;
    
    -- 3. Process refund to wallet if applicable
    IF v_refund_amount > 0 THEN
      v_wallet_transaction_id := public.credit_wallet(
        v_user_id,
        v_refund_amount,
        'refund',
        'order',
        p_order_id,
        format('Refund for cancelled order %s (Reason: %s)', p_order_id, p_reason),
        jsonb_build_object(
          'order_id', p_order_id,
          'cancellation_reason', p_reason,
          'cancellation_category', p_reason_category,
          'original_amount', v_order_record.total_amount,
          'cancellation_fee', v_cancellation_fee
        )
      );
    END IF;
    
    -- 4. Restore meal quota if subscription exists and order was using a meal credit
    IF v_subscription_id IS NOT NULL 
       AND v_order_record.subscription_status = 'active'
       AND v_order_record.meals_used_this_week > 0 THEN
      
      UPDATE public.subscriptions
      SET meals_used_this_week = GREATEST(meals_used_this_week - 1, 0),
          updated_at = now()
      WHERE id = v_subscription_id;
    END IF;
    
    -- 5. Log cancellation
    INSERT INTO public.order_cancellations (
      order_id,
      user_id,
      cancelled_by,
      cancelled_by_role,
      reason,
      reason_category,
      refund_amount,
      refund_type,
      wallet_transaction_id,
      order_status_at_cancel,
      cancellation_fee
    ) VALUES (
      p_order_id,
      v_user_id,
      auth.uid(),
      p_cancelled_by_role,
      p_reason,
      p_reason_category,
      v_refund_amount,
      CASE 
        WHEN v_refund_amount = 0 THEN 'none'
        WHEN v_refund_amount < v_order_record.total_amount THEN 'partial'
        ELSE 'full'
      END,
      v_wallet_transaction_id,
      v_order_record.status,
      v_cancellation_fee
    )
    RETURNING id INTO v_cancellation_id;
    
    -- 6. Log to order_status_history
    INSERT INTO public.order_status_history (
      order_id,
      previous_status,
      new_status,
      changed_by,
      changed_by_role,
      notes
    ) VALUES (
      p_order_id,
      v_order_record.status,
      'cancelled',
      auth.uid(),
      p_cancelled_by_role,
      format('Cancelled: %s', p_reason)
    );
    
    -- Build result
    v_result := jsonb_build_object(
      'success', true,
      'order_id', p_order_id,
      'cancellation_id', v_cancellation_id,
      'previous_status', v_order_record.status,
      'refund_amount', v_refund_amount,
      'refund_type', CASE 
        WHEN v_refund_amount = 0 THEN 'none'
        WHEN v_refund_amount < v_order_record.total_amount THEN 'partial'
        ELSE 'full'
      END,
      'wallet_transaction_id', v_wallet_transaction_id,
      'meal_quota_restored', v_subscription_id IS NOT NULL,
      'cancellation_fee', v_cancellation_fee,
      'message', format('Order cancelled successfully. Refund of QAR %s processed to wallet.', v_refund_amount)
    );
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RAISE EXCEPTION 'Failed to cancel order: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- STEP 3: Create helper functions
-- ========================================

-- Function to check if order can be cancelled
CREATE OR REPLACE FUNCTION public.can_cancel_order(
  p_order_id UUID,
  p_role TEXT DEFAULT 'customer'
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_can_cancel BOOLEAN;
  v_reason TEXT;
BEGIN
  SELECT id, status, user_id
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN jsonb_build_object(
      'can_cancel', false,
      'reason', 'Order not found'
    );
  END IF;
  
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'can_cancel', false,
      'reason', 'Order is already cancelled'
    );
  END IF;
  
  IF v_order.status IN ('delivered', 'completed') THEN
    RETURN jsonb_build_object(
      'can_cancel', false,
      'reason', 'Delivered or completed orders cannot be cancelled'
    );
  END IF;
  
  CASE p_role
    WHEN 'customer' THEN
      v_can_cancel := v_order.status IN ('pending', 'confirmed');
      v_reason := CASE 
        WHEN v_can_cancel THEN 'Can be cancelled'
        ELSE format('Orders in %s status cannot be cancelled by customers', v_order.status)
      END;
      
    WHEN 'partner' THEN
      v_can_cancel := v_order.status IN ('pending', 'confirmed', 'preparing');
      v_reason := CASE 
        WHEN v_can_cancel THEN 'Can be cancelled'
        ELSE format('Orders in %s status cannot be cancelled by partners', v_order.status)
      END;
      
    WHEN 'admin' THEN
      v_can_cancel := v_order.status NOT IN ('delivered', 'completed');
      v_reason := 'Admins can cancel orders in any status except delivered/completed';
      
    ELSE
      v_can_cancel := false;
      v_reason := 'Invalid role';
  END CASE;
  
  RETURN jsonb_build_object(
    'can_cancel', v_can_cancel,
    'reason', v_reason,
    'current_status', v_order.status,
    'role', p_role
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get cancellation statistics
CREATE OR REPLACE FUNCTION public.get_cancellation_stats(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_restaurant_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_cancellations', COUNT(*),
    'by_category', jsonb_object_agg(
      COALESCE(reason_category, 'unknown'), 
      cnt
    ),
    'by_role', jsonb_object_agg(
      COALESCE(cancelled_by_role, 'unknown'), 
      cnt
    ),
    'total_refunded', COALESCE(SUM(refund_amount), 0),
    'total_fees', COALESCE(SUM(cancellation_fee), 0)
  )
  INTO v_result
  FROM (
    SELECT 
      reason_category,
      cancelled_by_role,
      COUNT(*) as cnt,
      SUM(refund_amount) as refund_amount,
      SUM(cancellation_fee) as cancellation_fee
    FROM public.order_cancellations oc
    JOIN public.orders o ON o.id = oc.order_id
    WHERE (p_start_date IS NULL OR oc.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR oc.created_at::date <= p_end_date)
      AND (p_restaurant_id IS NULL OR o.restaurant_id = p_restaurant_id)
    GROUP BY reason_category, cancelled_by_role
  ) sub;
  
  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ========================================
-- STEP 4: Add comments
-- ========================================

COMMENT ON TABLE public.order_cancellations IS 'Audit log for all order cancellations with refund details';
COMMENT ON FUNCTION public.cancel_order IS 'Cancels an order, processes refund to wallet, restores meal quota, and logs cancellation';
COMMENT ON FUNCTION public.can_cancel_order IS 'Checks if an order can be cancelled by a given role';
