-- Migration: Fix cancel_meal_schedule - add delivery job check, addon refund, customer notification, and delivery queue cleanup
-- Date: 2026-04-13
-- Description: Comprehensive fix for reverse flow cancellation

-- Drop and recreate the cancel_meal_schedule function with full reverse-flow handling
CREATE OR REPLACE FUNCTION public.cancel_meal_schedule(p_schedule_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_restaurant RECORD;
  v_active_job_count INTEGER;
  v_wallet_id UUID;
  v_wallet_balance NUMERIC;
BEGIN
  -- Fetch the schedule and verify it belongs to the calling user
  SELECT
    ms.id,
    ms.user_id,
    ms.order_status,
    ms.meal_id,
    ms.addons_total,
    m.name  AS meal_name,
    m.restaurant_id
  INTO v_schedule
  FROM public.meal_schedules ms
  JOIN public.meals m ON m.id = ms.meal_id
  WHERE ms.id = p_schedule_id
    AND ms.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or you do not have permission to cancel it.';
  END IF;

  -- Guard: only pending / confirmed may be cancelled by the customer
  IF v_schedule.order_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Orders in "%" status cannot be cancelled.', v_schedule.order_status;
  END IF;

  -- Check for active delivery jobs that would be orphaned
  SELECT COUNT(*) INTO v_active_job_count
  FROM public.delivery_jobs
  WHERE schedule_id = p_schedule_id
    AND status IN ('preparing', 'ready', 'out_for_delivery', 'picked_up');

  IF v_active_job_count > 0 THEN
    RAISE EXCEPTION 'Cannot cancel: a driver is already preparing or delivering this order. Please contact support.';
  END IF;

  -- Clean up any delivery_queue entries for this schedule
  DELETE FROM public.delivery_queue
  WHERE metadata->>'schedule_id' = p_schedule_id::TEXT
    AND status IN ('queued', 'assigned', 'accepted');

  -- Cancel the schedule
  UPDATE public.meal_schedules
  SET order_status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_schedule_id;

  -- Refund the meal credit back to the subscription quota
  UPDATE public.subscriptions
  SET meals_used_this_month = GREATEST(0, meals_used_this_month - 1)
  WHERE user_id = v_schedule.user_id
    AND status = 'active'
    AND id = (
      SELECT id FROM public.subscriptions
      WHERE user_id = v_schedule.user_id
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    );

  -- Refund addons to wallet if any were paid
  IF v_schedule.addons_total IS NOT NULL AND v_schedule.addons_total > 0 THEN
    -- Get wallet id and current balance
    SELECT id, COALESCE(balance, 0) INTO v_wallet_id, v_wallet_balance
    FROM public.customer_wallets
    WHERE user_id = v_schedule.user_id;

    -- Credit the wallet
    UPDATE public.customer_wallets
    SET balance = COALESCE(balance, 0) + v_schedule.addons_total,
        total_credits = COALESCE(total_credits, 0) + v_schedule.addons_total,
        updated_at = NOW()
    WHERE user_id = v_schedule.user_id;

    -- Log the credit transaction
    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, amount, transaction_type, reference_type, reference_id, description, balance_after, created_at
    ) VALUES (
      v_wallet_id,
      v_schedule.user_id,
      v_schedule.addons_total,
      'refund',
      'order',
      p_schedule_id,
      'Meal cancellation refund - addons for ' || v_schedule.meal_name,
      COALESCE(v_wallet_balance, 0) + v_schedule.addons_total,
      NOW()
    );
  END IF;

  -- Notify the restaurant partner (best-effort; never block the cancel)
  BEGIN
    IF v_schedule.restaurant_id IS NOT NULL THEN
      SELECT id, name, owner_id
      INTO v_restaurant
      FROM public.restaurants
      WHERE id = v_schedule.restaurant_id;

      IF v_restaurant.owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id,
          type,
          title,
          message,
          status,
          data
        ) VALUES (
          v_restaurant.owner_id,
          'order_update',
          'Order Cancelled by Customer',
          'A customer has cancelled their order for ' || v_schedule.meal_name || '.',
          'unread',
          jsonb_build_object(
            'schedule_id', p_schedule_id,
            'meal_name',   v_schedule.meal_name,
            'cancelled_by', 'customer'
          )
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to notify partner for schedule %: %', p_schedule_id, SQLERRM;
  END;

  -- Send notification to the customer (best-effort)
  BEGIN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      status,
      data
    ) VALUES (
      v_schedule.user_id,
      'order_update',
      'Meal Cancelled',
      'Your scheduled meal for ' || v_schedule.meal_name || ' has been cancelled. Your meal credit has been refunded.',
      'unread',
      jsonb_build_object(
        'schedule_id', p_schedule_id,
        'meal_name', v_schedule.meal_name,
        'action', 'cancelled',
        'credit_refunded', true
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to notify customer for schedule %: %', p_schedule_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',     true,
    'schedule_id', p_schedule_id,
    'refunded_addons', COALESCE(v_schedule.addons_total, 0)
  );
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.cancel_meal_schedule(UUID) TO authenticated;
