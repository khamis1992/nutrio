BEGIN;

CREATE OR REPLACE FUNCTION public.customer_confirm_order_received(
  p_source TEXT,
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_schedule public.meal_schedules%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_source = 'meal_schedule' THEN
    SELECT ms.*
      INTO v_schedule
    FROM public.meal_schedules ms
    WHERE ms.id = p_order_id
      AND ms.user_id = v_actor
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_ACCESS_DENIED';
    END IF;
    IF v_schedule.order_status <> 'delivered' THEN
      RAISE EXCEPTION 'ORDER_MUST_BE_DELIVERED_FIRST';
    END IF;

    PERFORM public.update_order_status(p_order_id, 'completed', 'customer');
    RETURN jsonb_build_object(
      'success', TRUE,
      'source', p_source,
      'order_id', p_order_id,
      'status', 'completed'
    );
  END IF;

  IF p_source <> 'order' THEN
    RAISE EXCEPTION 'INVALID_ORDER_SOURCE';
  END IF;

  SELECT o.*
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_ACCESS_DENIED';
  END IF;
  IF v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'ORDER_MUST_BE_DELIVERED_FIRST';
  END IF;

  -- The ownership and state checks above authorize this narrow transition.
  PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

  UPDATE public.delivery_jobs
  SET status = 'completed',
      updated_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'delivered';

  UPDATE public.orders
  SET status = 'completed',
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'source', p_source,
    'order_id', p_order_id,
    'status', 'completed'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.customer_confirm_order_received(TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_confirm_order_received(TEXT, UUID)
  TO authenticated, service_role;

COMMIT;
