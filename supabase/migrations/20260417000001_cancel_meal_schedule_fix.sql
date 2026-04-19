CREATE OR REPLACE FUNCTION public.cancel_meal_schedule(
  p_schedule_id UUID,
  p_reason TEXT DEFAULT NULL
)
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
  v_cancelled_earnings_count INTEGER;
  v_cancelled_jobs_count INTEGER;
  v_updated_notifications_count INTEGER;
BEGIN
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
  LEFT JOIN public.meals m ON m.id = ms.meal_id
  WHERE ms.id = p_schedule_id
    AND ms.user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or you do not have permission to cancel it.';
  END IF;

  IF v_schedule.order_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Orders in "%" status cannot be cancelled.', v_schedule.order_status;
  END IF;

  SELECT COUNT(*) INTO v_active_job_count
  FROM public.delivery_jobs
  WHERE schedule_id = p_schedule_id
    AND status IN ('preparing', 'ready', 'out_for_delivery', 'picked_up');

  IF v_active_job_count > 0 THEN
    RAISE EXCEPTION 'Cannot cancel: a driver is already preparing or delivering this order. Please contact support.';
  END IF;

  UPDATE public.delivery_jobs
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE schedule_id = p_schedule_id
    AND status IN ('pending', 'scheduled', 'assigned');

  GET DIAGNOSTICS v_cancelled_jobs_count = ROW_COUNT;

  DELETE FROM public.delivery_queue
  WHERE metadata->>'schedule_id' = p_schedule_id::TEXT
    AND status IN ('queued', 'assigned', 'accepted');

  UPDATE public.meal_schedules
  SET order_status = 'cancelled',
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_schedule_id;

  UPDATE public.subscriptions
  SET meals_used_this_month = GREATEST(0, meals_used_this_month - 1),
      meals_used_this_week = GREATEST(0, meals_used_this_week - 1)
  WHERE user_id = v_schedule.user_id
    AND status = 'active'
    AND id = (
      SELECT id FROM public.subscriptions
      WHERE user_id = v_schedule.user_id
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    );

  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.user_id = v_schedule.user_id
      AND wt.transaction_type = 'debit'
      AND wt.description = 'Extra meal credit purchase'
      AND wt.created_at >= (
        SELECT created_at FROM public.meal_schedules WHERE id = p_schedule_id
      ) - INTERVAL '1 hour'
      AND wt.created_at <= (
        SELECT created_at FROM public.meal_schedules WHERE id = p_schedule_id
      ) + INTERVAL '1 hour'
  ) THEN
    UPDATE public.subscriptions
    SET meals_per_month = GREATEST(1, meals_per_month - 1)
    WHERE user_id = v_schedule.user_id
      AND status = 'active'
      AND id = (
        SELECT id FROM public.subscriptions
        WHERE user_id = v_schedule.user_id
          AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      );
  END IF;

  IF v_schedule.addons_total IS NOT NULL AND v_schedule.addons_total > 0 THEN
    SELECT id, COALESCE(balance, 0) INTO v_wallet_id, v_wallet_balance
    FROM public.customer_wallets
    WHERE user_id = v_schedule.user_id;

    UPDATE public.customer_wallets
    SET balance = COALESCE(balance, 0) + v_schedule.addons_total,
        total_credits = COALESCE(total_credits, 0) + v_schedule.addons_total,
        updated_at = NOW()
    WHERE user_id = v_schedule.user_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, amount, transaction_type, reference_type, reference_id, description, balance_after, created_at
    ) VALUES (
      v_wallet_id,
      v_schedule.user_id,
      v_schedule.addons_total,
      'refund',
      'order',
      p_schedule_id,
      'Meal cancellation refund - addons for ' || COALESCE(v_schedule.meal_name, 'meal'),
      COALESCE(v_wallet_balance, 0) + v_schedule.addons_total,
      NOW()
    );
  END IF;

  UPDATE public.partner_earnings
  SET status = 'cancelled'
  WHERE meal_schedule_id = p_schedule_id
    AND status IN ('pending', 'paid');

  GET DIAGNOSTICS v_cancelled_earnings_count = ROW_COUNT;

  UPDATE public.notifications
  SET status = 'read'
  WHERE user_id = v_schedule.user_id
    AND type = 'meal_scheduled'
    AND (data->>'schedule_id')::TEXT = p_schedule_id::TEXT
    AND status = 'unread';

  GET DIAGNOSTICS v_updated_notifications_count = ROW_COUNT;

  BEGIN
    IF v_schedule.restaurant_id IS NOT NULL THEN
      SELECT id, name, owner_id
      INTO v_restaurant
      FROM public.restaurants
      WHERE id = v_schedule.restaurant_id;

      IF v_restaurant.owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (
          user_id, type, title, message, status, data
        ) VALUES (
          v_restaurant.owner_id,
          'order_update',
          'Order Cancelled by Customer',
          'A customer has cancelled their order for ' || COALESCE(v_schedule.meal_name, 'a meal') || '.',
          'unread',
          jsonb_build_object(
            'schedule_id', p_schedule_id,
            'meal_name',   COALESCE(v_schedule.meal_name, ''),
            'cancelled_by', 'customer'
          )
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to notify partner for schedule %: %', p_schedule_id, SQLERRM;
  END;

  BEGIN
    INSERT INTO public.notifications (
      user_id, type, title, message, status, data
    ) VALUES (
      v_schedule.user_id,
      'order_update',
      'Meal Cancelled',
      'Your scheduled meal for ' || COALESCE(v_schedule.meal_name, 'a meal') || ' has been cancelled. Your meal credit has been refunded.',
      'unread',
      jsonb_build_object(
        'schedule_id', p_schedule_id,
        'meal_name', COALESCE(v_schedule.meal_name, ''),
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
    'refunded_addons', COALESCE(v_schedule.addons_total, 0),
    'cancelled_earnings', v_cancelled_earnings_count,
    'cancelled_jobs', v_cancelled_jobs_count,
    'marked_notifications_read', v_updated_notifications_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_meal_schedule(UUID, TEXT) TO authenticated;