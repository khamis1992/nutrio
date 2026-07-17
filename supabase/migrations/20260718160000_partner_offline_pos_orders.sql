-- Partner offline-first POS order creation.
-- The browser can queue tickets offline, then sync them through this reviewed
-- RPC. The client request id is used as the order id to make retries safe.

BEGIN;

CREATE OR REPLACE FUNCTION public.partner_create_pos_order(
  p_client_request_id UUID,
  p_restaurant_id UUID,
  p_items JSONB,
  p_customer_name TEXT DEFAULT NULL,
  p_phone_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_existing public.orders%ROWTYPE;
  v_item JSONB;
  v_meal public.meals%ROWTYPE;
  v_primary_meal_id UUID;
  v_total NUMERIC := 0;
  v_quantity INTEGER;
  v_item_index INTEGER := 0;
  v_notes TEXT;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_client_request_id IS NULL OR p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_POS_REQUEST';
  END IF;

  IF NOT public.is_restaurant_operator(p_restaurant_id, v_actor) THEN
    RAISE EXCEPTION 'RESTAURANT_ACCESS_DENIED';
  END IF;

  SELECT *
    INTO v_existing
  FROM public.orders
  WHERE id = p_client_request_id;

  IF FOUND THEN
    IF v_existing.restaurant_id IS DISTINCT FROM p_restaurant_id THEN
      RAISE EXCEPTION 'POS_REQUEST_ID_CONFLICT';
    END IF;

    RETURN jsonb_build_object(
      'success', TRUE,
      'already_synced', TRUE,
      'order_id', v_existing.id
    );
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 40 THEN
    RAISE EXCEPTION 'INVALID_POS_ITEMS';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_index := v_item_index + 1;
    v_quantity := GREATEST(1, LEAST(99, COALESCE((v_item ->> 'quantity')::INTEGER, 1)));

    SELECT *
      INTO v_meal
    FROM public.meals
    WHERE id = (v_item ->> 'mealId')::UUID
      AND restaurant_id = p_restaurant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'POS_MEAL_NOT_FOUND_OR_ACCESS_DENIED';
    END IF;

    IF v_primary_meal_id IS NULL THEN
      v_primary_meal_id := v_meal.id;
    END IF;

    v_total := v_total + (COALESCE(v_meal.price, 0) * v_quantity);
  END LOOP;

  v_notes := concat_ws(
    E'\n',
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    CASE
      WHEN NULLIF(TRIM(COALESCE(p_customer_name, '')), '') IS NOT NULL
      THEN 'POS customer: ' || LEFT(TRIM(p_customer_name), 120)
    END,
    'POS offline ticket: ' || p_client_request_id::TEXT
  );

  INSERT INTO public.orders (
    id,
    restaurant_id,
    meal_id,
    order_type,
    status,
    total_amount,
    restaurant_payout,
    delivery_fee,
    phone_number,
    notes,
    special_instructions,
    created_at,
    updated_at
  )
  VALUES (
    p_client_request_id,
    p_restaurant_id,
    v_primary_meal_id,
    'pos',
    'confirmed',
    v_total,
    v_total,
    0,
    NULLIF(LEFT(TRIM(COALESCE(p_phone_number, '')), 32), ''),
    v_notes,
    'POS walk-in / counter order',
    now(),
    now()
  );

  v_item_index := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_index := v_item_index + 1;
    v_quantity := GREATEST(1, LEAST(99, COALESCE((v_item ->> 'quantity')::INTEGER, 1)));

    SELECT *
      INTO v_meal
    FROM public.meals
    WHERE id = (v_item ->> 'mealId')::UUID
      AND restaurant_id = p_restaurant_id;

    INSERT INTO public.kitchen_queue_items (
      order_source,
      order_id,
      item_key,
      item_name,
      quantity,
      status,
      updated_by
    )
    VALUES (
      'order',
      p_client_request_id,
      'pos:' || v_meal.id::TEXT || ':' || v_item_index::TEXT,
      v_meal.name,
      v_quantity,
      'queued',
      v_actor
    )
    ON CONFLICT (order_source, order_id, item_key) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_synced', FALSE,
    'order_id', p_client_request_id,
    'total_amount', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_create_pos_order(UUID, UUID, JSONB, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_create_pos_order(UUID, UUID, JSONB, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

COMMIT;
