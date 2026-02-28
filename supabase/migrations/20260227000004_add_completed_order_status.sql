-- Migration: Add 'completed' status to order_status enum
-- Created: 2026-02-27
-- Purpose: Add completed status to distinguish between delivered and truly completed orders

-- Add 'completed' to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';

-- Create a function to automatically transition orders from delivered to completed
-- after a certain period or when customer confirms
CREATE OR REPLACE FUNCTION auto_complete_delivered_orders()
RETURNS void AS $$
BEGIN
  -- Update orders that have been delivered for more than 24 hours to completed
  UPDATE public.orders
  SET order_status = 'completed',
      updated_at = NOW()
  WHERE order_status = 'delivered'
    AND updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Add comment explaining the status flow
COMMENT ON TYPE public.order_status IS 'Order status workflow: pending -> confirmed -> preparing -> ready_for_pickup -> picked_up -> out_for_delivery -> delivered -> completed';
