-- Migration: Delivery Queue System
-- Date: 2024-01-01
-- Description: Creates delivery_queue table for orders awaiting driver assignment

-- ========================================
-- STEP 1: Create delivery_queue table
-- ========================================

CREATE TABLE IF NOT EXISTS public.delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE SET NULL,
  
  -- Queue status
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
    'waiting',           -- Waiting for driver
    'assigned',          -- Driver assigned, not yet accepted
    'accepted',          -- Driver accepted
    'declined',          -- Driver declined
    'expired',           -- Assignment expired
    'manual_escalation', -- Escalated for manual assignment
    'completed',         -- Successfully assigned
    'cancelled'          -- Order cancelled
  )),
  
  -- Assignment tracking
  assigned_driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  previous_driver_ids UUID[] DEFAULT '{}'::UUID[],
  assignment_attempts INTEGER DEFAULT 0,
  
  -- Priority scoring
  priority_score INTEGER DEFAULT 50 CHECK (priority_score >= 0 AND priority_score <= 100),
  priority_reason TEXT,
  
  -- Timing
  queued_at TIMESTAMPTZ DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Delivery details (copied from order for quick access)
  delivery_address TEXT,
  delivery_lat NUMERIC(10, 7),
  delivery_lng NUMERIC(10, 7),
  estimated_delivery_time TIMESTAMPTZ,
  delivery_fee NUMERIC(10, 2) DEFAULT 3.00,
  tip_amount NUMERIC(10, 2) DEFAULT 0,
  
  -- Escalation fields
  escalation_reason TEXT,
  escalated_at TIMESTAMPTZ,
  escalated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  manual_assignment_notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- STEP 2: Create indexes for performance
-- ========================================

-- Primary lookup indexes
CREATE INDEX IF NOT EXISTS idx_delivery_queue_order_id ON public.delivery_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_restaurant_id ON public.delivery_queue(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_driver_id ON public.delivery_queue(assigned_driver_id);

-- Status-based indexes (most common queries)
CREATE INDEX IF NOT EXISTS idx_delivery_queue_status ON public.delivery_queue(status);
CREATE INDEX IF NOT EXISTS idx_delivery_queue_status_queued ON public.delivery_queue(status, queued_at) 
  WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS idx_delivery_queue_status_assigned ON public.delivery_queue(status, assigned_at) 
  WHERE status = 'assigned';

-- Priority-based index for driver matching
CREATE INDEX IF NOT EXISTS idx_delivery_queue_priority ON public.delivery_queue(priority_score DESC, queued_at) 
  WHERE status = 'waiting';

-- Geographic index for nearby driver matching
CREATE INDEX IF NOT EXISTS idx_delivery_queue_location ON public.delivery_queue USING GIST (
  point(delivery_lng, delivery_lat)
) WHERE delivery_lat IS NOT NULL AND delivery_lng IS NOT NULL;

-- Expiration tracking
CREATE INDEX IF NOT EXISTS idx_delivery_queue_expires_at ON public.delivery_queue(expires_at) 
  WHERE status = 'assigned' AND expires_at IS NOT NULL;

-- Escalation tracking
CREATE INDEX IF NOT EXISTS idx_delivery_queue_escalated ON public.delivery_queue(escalated_at) 
  WHERE status = 'manual_escalation';

-- ========================================
-- STEP 3: Enable RLS
-- ========================================

ALTER TABLE public.delivery_queue ENABLE ROW LEVEL SECURITY;

-- Drivers can view available deliveries in queue
DROP POLICY IF EXISTS "Drivers can view available deliveries" ON public.delivery_queue;
CREATE POLICY "Drivers can view available deliveries"
  ON public.delivery_queue FOR SELECT
  USING (
    status = 'waiting'
    OR (
      assigned_driver_id IS NOT NULL
      AND auth.uid() = (SELECT user_id FROM public.drivers WHERE id = assigned_driver_id)
    )
  );

-- Drivers can update their assigned deliveries
DROP POLICY IF EXISTS "Drivers can update their assigned deliveries" ON public.delivery_queue;
CREATE POLICY "Drivers can update their assigned deliveries"
  ON public.delivery_queue FOR UPDATE
  USING (
    assigned_driver_id IS NOT NULL
    AND auth.uid() = (SELECT user_id FROM public.drivers WHERE id = assigned_driver_id)
  );

-- Partners can view deliveries for their restaurants
DROP POLICY IF EXISTS "Partners can view their restaurant deliveries" ON public.delivery_queue;
CREATE POLICY "Partners can view their restaurant deliveries"
  ON public.delivery_queue FOR SELECT
  USING (
    auth.uid() = (SELECT owner_id FROM public.restaurants WHERE id = restaurant_id)
  );

-- Admins can manage all queue items
DROP POLICY IF EXISTS "Admins can manage delivery queue" ON public.delivery_queue;
CREATE POLICY "Admins can manage delivery queue"
  ON public.delivery_queue FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can manage queue (for automated assignment)
DROP POLICY IF EXISTS "Service role can manage queue" ON public.delivery_queue;
CREATE POLICY "Service role can manage queue"
  ON public.delivery_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- STEP 4: Create helper functions
-- ========================================

-- Function to add order to delivery queue
CREATE OR REPLACE FUNCTION public.add_to_delivery_queue(
  p_order_id UUID,
  p_priority_score INTEGER DEFAULT 50,
  p_priority_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
  v_order_record RECORD;
BEGIN
  -- Get order details
  SELECT 
    o.id,
    o.restaurant_id,
    o.delivery_address,
    o.delivery_lat,
    o.delivery_lng,
    o.estimated_delivery_time,
    o.delivery_fee,
    o.tip_amount
  INTO v_order_record
  FROM public.orders o
  WHERE o.id = p_order_id;
  
  IF v_order_record IS NULL THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- Insert into queue
  INSERT INTO public.delivery_queue (
    order_id,
    restaurant_id,
    status,
    priority_score,
    priority_reason,
    delivery_address,
    delivery_lat,
    delivery_lng,
    estimated_delivery_time,
    delivery_fee,
    tip_amount,
    expires_at
  ) VALUES (
    p_order_id,
    v_order_record.restaurant_id,
    'waiting',
    p_priority_score,
    p_priority_reason,
    v_order_record.delivery_address,
    v_order_record.delivery_lat,
    v_order_record.delivery_lng,
    v_order_record.estimated_delivery_time,
    COALESCE(v_order_record.delivery_fee, 3.00),
    COALESCE(v_order_record.tip_amount, 0),
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign driver to queue item
CREATE OR REPLACE FUNCTION public.assign_driver_to_queue(
  p_queue_id UUID,
  p_driver_id UUID,
  p_expiry_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue_record RECORD;
BEGIN
  -- Get queue item
  SELECT * INTO v_queue_record
  FROM public.delivery_queue
  WHERE id = p_queue_id
  FOR UPDATE;
  
  IF v_queue_record IS NULL THEN
    RAISE EXCEPTION 'Queue item not found: %', p_queue_id;
  END IF;
  
  IF v_queue_record.status != 'waiting' THEN
    RAISE EXCEPTION 'Queue item is not waiting: %', v_queue_record.status;
  END IF;
  
  -- Update queue item
  UPDATE public.delivery_queue
  SET 
    status = 'assigned',
    assigned_driver_id = p_driver_id,
    previous_driver_ids = array_append(previous_driver_ids, p_driver_id),
    assignment_attempts = assignment_attempts + 1,
    assigned_at = now(),
    expires_at = now() + (p_expiry_minutes || ' minutes')::interval,
    updated_at = now()
  WHERE id = p_queue_id;
  
  -- Also update the order
  UPDATE public.orders
  SET 
    driver_id = p_driver_id,
    status = 'driver_assigned',
    updated_at = now()
  WHERE id = v_queue_record.order_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for driver to accept delivery
CREATE OR REPLACE FUNCTION public.accept_delivery_assignment(
  p_queue_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue_record RECORD;
  v_driver_id UUID;
BEGIN
  -- Get driver ID from auth
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE user_id = auth.uid();
  
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'User is not a registered driver';
  END IF;
  
  -- Get queue item
  SELECT * INTO v_queue_record
  FROM public.delivery_queue
  WHERE id = p_queue_id
    AND assigned_driver_id = v_driver_id
    AND status = 'assigned'
  FOR UPDATE;
  
  IF v_queue_record IS NULL THEN
    RAISE EXCEPTION 'Delivery assignment not found or not assigned to you';
  END IF;
  
  -- Check if expired
  IF v_queue_record.expires_at < now() THEN
    -- Mark as expired and release
    UPDATE public.delivery_queue
    SET 
      status = 'expired',
      assigned_driver_id = NULL,
      updated_at = now()
    WHERE id = p_queue_id;
    
    RAISE EXCEPTION 'Delivery assignment has expired';
  END IF;
  
  -- Accept assignment
  UPDATE public.delivery_queue
  SET 
    status = 'accepted',
    accepted_at = now(),
    completed_at = now(),
    updated_at = now()
  WHERE id = p_queue_id;
  
  -- Update order status
  UPDATE public.orders
  SET 
    status = 'accepted_by_driver',
    updated_at = now()
  WHERE id = v_queue_record.order_id;
  
  -- Update deliveries table
  UPDATE public.deliveries
  SET 
    driver_id = v_driver_id,
    status = 'claimed',
    updated_at = now()
  WHERE order_id = v_queue_record.order_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for driver to decline delivery
CREATE OR REPLACE FUNCTION public.decline_delivery_assignment(
  p_queue_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue_record RECORD;
  v_driver_id UUID;
BEGIN
  -- Get driver ID from auth
  SELECT id INTO v_driver_id
  FROM public.drivers
  WHERE user_id = auth.uid();
  
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'User is not a registered driver';
  END IF;
  
  -- Get queue item
  SELECT * INTO v_queue_record
  FROM public.delivery_queue
  WHERE id = p_queue_id
    AND assigned_driver_id = v_driver_id
    AND status = 'assigned'
  FOR UPDATE;
  
  IF v_queue_record IS NULL THEN
    RAISE EXCEPTION 'Delivery assignment not found or not assigned to you';
  END IF;
  
  -- Decline assignment - return to waiting queue
  UPDATE public.delivery_queue
  SET 
    status = 'waiting',
    assigned_driver_id = NULL,
    assigned_at = NULL,
    expires_at = now() + interval '30 minutes',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{decline_reasons}',
      COALESCE(metadata->'decline_reasons', '[]'::jsonb) || jsonb_build_array(p_reason)
    ),
    updated_at = now()
  WHERE id = p_queue_id;
  
  -- Clear driver from order
  UPDATE public.orders
  SET 
    driver_id = NULL,
    status = 'preparing',
    updated_at = now()
  WHERE id = v_queue_record.order_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to escalate to manual assignment
CREATE OR REPLACE FUNCTION public.escalate_to_manual_assignment(
  p_queue_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.delivery_queue
  SET 
    status = 'manual_escalation',
    escalation_reason = p_reason,
    escalated_at = now(),
    escalated_by = auth.uid(),
    updated_at = now()
  WHERE id = p_queue_id
    AND status IN ('waiting', 'assigned', 'expired');
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue item not found or cannot be escalated';
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to manually assign driver (admin only)
CREATE OR REPLACE FUNCTION public.manual_assign_driver(
  p_queue_id UUID,
  p_driver_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_queue_record RECORD;
BEGIN
  -- Verify admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can manually assign drivers';
  END IF;
  
  -- Get queue item
  SELECT * INTO v_queue_record
  FROM public.delivery_queue
  WHERE id = p_queue_id
  FOR UPDATE;
  
  IF v_queue_record IS NULL THEN
    RAISE EXCEPTION 'Queue item not found';
  END IF;
  
  -- Update queue
  UPDATE public.delivery_queue
  SET 
    status = 'accepted',
    assigned_driver_id = p_driver_id,
    previous_driver_ids = array_append(previous_driver_ids, p_driver_id),
    assignment_attempts = assignment_attempts + 1,
    assigned_at = now(),
    accepted_at = now(),
    completed_at = now(),
    manual_assignment_notes = p_notes,
    updated_at = now()
  WHERE id = p_queue_id;
  
  -- Update order
  UPDATE public.orders
  SET 
    driver_id = p_driver_id,
    status = 'accepted_by_driver',
    updated_at = now()
  WHERE id = v_queue_record.order_id;
  
  -- Update deliveries
  UPDATE public.deliveries
  SET 
    driver_id = p_driver_id,
    status = 'claimed',
    updated_at = now()
  WHERE order_id = v_queue_record.order_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available deliveries for a driver
CREATE OR REPLACE FUNCTION public.get_available_deliveries(
  p_driver_lat NUMERIC DEFAULT NULL,
  p_driver_lng NUMERIC DEFAULT NULL,
  p_max_distance_km NUMERIC DEFAULT 10
)
RETURNS TABLE (
  queue_id UUID,
  order_id UUID,
  restaurant_id UUID,
  restaurant_name TEXT,
  delivery_address TEXT,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  priority_score INTEGER,
  queued_at TIMESTAMPTZ,
  delivery_fee NUMERIC,
  tip_amount NUMERIC,
  distance_km NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dq.id as queue_id,
    dq.order_id,
    dq.restaurant_id,
    r.name as restaurant_name,
    dq.delivery_address,
    dq.delivery_lat,
    dq.delivery_lng,
    dq.priority_score,
    dq.queued_at,
    dq.delivery_fee,
    dq.tip_amount,
    CASE 
      WHEN p_driver_lat IS NOT NULL AND p_driver_lng IS NOT NULL 
           AND dq.delivery_lat IS NOT NULL AND dq.delivery_lng IS NOT NULL
      THEN (
        6371 * acos(
          cos(radians(p_driver_lat)) * cos(radians(dq.delivery_lat)) *
          cos(radians(dq.delivery_lng) - radians(p_driver_lng)) +
          sin(radians(p_driver_lat)) * sin(radians(dq.delivery_lat))
        )
      )
      ELSE NULL
    END as distance_km
  FROM public.delivery_queue dq
  LEFT JOIN public.restaurants r ON r.id = dq.restaurant_id
  WHERE dq.status = 'waiting'
    AND (dq.previous_driver_ids IS NULL OR NOT array_position(dq.previous_driver_ids, auth.uid()) > 0)
  ORDER BY dq.priority_score DESC, dq.queued_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to calculate priority score based on order factors
CREATE OR REPLACE FUNCTION public.calculate_delivery_priority(
  p_order_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_base_score INTEGER := 50;
  v_order RECORD;
BEGIN
  -- Get order details
  SELECT 
    o.id,
    o.tip_amount,
    o.created_at,
    o.estimated_delivery_time,
    s.tier as subscription_tier
  INTO v_order
  FROM public.orders o
  LEFT JOIN public.subscriptions s ON s.user_id = o.user_id AND s.status = 'active'
  WHERE o.id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN v_base_score;
  END IF;
  
  -- Tip bonus (up to +20 points)
  IF v_order.tip_amount > 0 THEN
    v_base_score := v_base_score + LEAST((v_order.tip_amount / 5)::INTEGER * 5, 20);
  END IF;
  
  -- VIP subscription bonus (+15 points)
  IF v_order.subscription_tier = 'vip' THEN
    v_base_score := v_base_score + 15;
  END IF;
  
  -- Waiting time bonus (+1 point per 5 minutes waiting, up to +15)
  v_base_score := v_base_score + LEAST(
    EXTRACT(EPOCH FROM (now() - v_order.created_at)) / 300,
    15
  )::INTEGER;
  
  -- Urgent delivery bonus (+10 points if within 30 minutes of estimated time)
  IF v_order.estimated_delivery_time IS NOT NULL 
     AND v_order.estimated_delivery_time - now() < interval '30 minutes' THEN
    v_base_score := v_base_score + 10;
  END IF;
  
  RETURN LEAST(v_base_score, 100);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ========================================
-- STEP 5: Create updated_at trigger
-- ========================================

DROP TRIGGER IF EXISTS update_delivery_queue_updated_at ON public.delivery_queue;
CREATE TRIGGER update_delivery_queue_updated_at
  BEFORE UPDATE ON public.delivery_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- STEP 6: Add comments
-- ========================================

COMMENT ON TABLE public.delivery_queue IS 'Queue for orders awaiting driver assignment with priority scoring';
COMMENT ON COLUMN public.delivery_queue.priority_score IS 'Priority score 0-100, higher = more urgent';
COMMENT ON COLUMN public.delivery_queue.previous_driver_ids IS 'Array of driver IDs who declined this delivery';
COMMENT ON COLUMN public.delivery_queue.status IS 'Current status in the assignment workflow';
