-- SECURITY DEFINER function for customer-initiated meal schedule cancellation.
-- Bypasses RLS so the update always reaches the DB, validates ownership
-- server-side, and atomically notifies the restaurant partner.
CREATE OR REPLACE FUNCTION public.cancel_meal_schedule(p_schedule_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule RECORD;
  v_restaurant RECORD;
BEGIN
  -- Fetch the schedule and verify it belongs to the calling user
  SELECT
    ms.id,
    ms.user_id,
    ms.order_status,
    ms.meal_id,
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

  -- Cancel the schedule
  UPDATE public.meal_schedules
  SET order_status = 'cancelled'
  WHERE id = p_schedule_id;

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
    -- Log but do not fail the cancel if notification insert fails
    RAISE WARNING 'Failed to notify partner for schedule %: %', p_schedule_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',     true,
    'schedule_id', p_schedule_id
  );
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.cancel_meal_schedule(UUID) TO authenticated;
