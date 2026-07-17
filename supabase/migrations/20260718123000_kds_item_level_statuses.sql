-- Item-level kitchen display system statuses for partner KDS.

CREATE TABLE IF NOT EXISTS public.kitchen_queue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_source TEXT NOT NULL CHECK (order_source IN ('order', 'meal_schedule')),
  order_id UUID NOT NULL,
  item_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preparing', 'ready')),
  station TEXT,
  started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_source, order_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_kitchen_queue_items_order
  ON public.kitchen_queue_items(order_source, order_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_queue_items_status
  ON public.kitchen_queue_items(status, updated_at DESC);

ALTER TABLE public.kitchen_queue_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their kitchen item statuses" ON public.kitchen_queue_items;
CREATE POLICY "Partners can view their kitchen item statuses"
  ON public.kitchen_queue_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      JOIN public.restaurants r ON r.id = ms.restaurant_id
      WHERE kitchen_queue_items.order_source = 'meal_schedule'
        AND ms.id = kitchen_queue_items.order_id
        AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE kitchen_queue_items.order_source = 'order'
        AND o.id = kitchen_queue_items.order_id
        AND r.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partners can manage their kitchen item statuses" ON public.kitchen_queue_items;
CREATE POLICY "Partners can manage their kitchen item statuses"
  ON public.kitchen_queue_items FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      JOIN public.restaurants r ON r.id = ms.restaurant_id
      WHERE kitchen_queue_items.order_source = 'meal_schedule'
        AND ms.id = kitchen_queue_items.order_id
        AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE kitchen_queue_items.order_source = 'order'
        AND o.id = kitchen_queue_items.order_id
        AND r.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      JOIN public.restaurants r ON r.id = ms.restaurant_id
      WHERE kitchen_queue_items.order_source = 'meal_schedule'
        AND ms.id = kitchen_queue_items.order_id
        AND r.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE kitchen_queue_items.order_source = 'order'
        AND o.id = kitchen_queue_items.order_id
        AND r.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.partner_update_kitchen_item_status(
  p_source TEXT,
  p_order_id UUID,
  p_item_key TEXT,
  p_status TEXT,
  p_item_name TEXT DEFAULT NULL,
  p_quantity INTEGER DEFAULT 1,
  p_all_item_keys TEXT[] DEFAULT NULL
)
RETURNS public.kitchen_queue_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.kitchen_queue_items;
  v_authorized BOOLEAN := FALSE;
  v_all_ready BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_source NOT IN ('order', 'meal_schedule') THEN
    RAISE EXCEPTION 'Unsupported order source: %', p_source;
  END IF;

  IF p_status NOT IN ('queued', 'preparing', 'ready') THEN
    RAISE EXCEPTION 'Unsupported kitchen item status: %', p_status;
  END IF;

  IF p_source = 'meal_schedule' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      JOIN public.restaurants r ON r.id = ms.restaurant_id
      WHERE ms.id = p_order_id
        AND r.owner_id = auth.uid()
    ) INTO v_authorized;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.restaurants r ON r.id = o.restaurant_id
      WHERE o.id = p_order_id
        AND r.owner_id = auth.uid()
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Not authorized to update this kitchen item';
  END IF;

  INSERT INTO public.kitchen_queue_items (
    order_source,
    order_id,
    item_key,
    item_name,
    quantity,
    status,
    started_at,
    ready_at,
    updated_by
  )
  VALUES (
    p_source,
    p_order_id,
    p_item_key,
    COALESCE(NULLIF(p_item_name, ''), p_item_key),
    GREATEST(COALESCE(p_quantity, 1), 1),
    p_status,
    CASE WHEN p_status IN ('preparing', 'ready') THEN now() ELSE NULL END,
    CASE WHEN p_status = 'ready' THEN now() ELSE NULL END,
    auth.uid()
  )
  ON CONFLICT (order_source, order_id, item_key)
  DO UPDATE SET
    item_name = COALESCE(NULLIF(EXCLUDED.item_name, ''), kitchen_queue_items.item_name),
    quantity = GREATEST(EXCLUDED.quantity, 1),
    status = EXCLUDED.status,
    started_at = CASE
      WHEN EXCLUDED.status IN ('preparing', 'ready') THEN COALESCE(kitchen_queue_items.started_at, now())
      ELSE kitchen_queue_items.started_at
    END,
    ready_at = CASE
      WHEN EXCLUDED.status = 'ready' THEN COALESCE(kitchen_queue_items.ready_at, now())
      ELSE NULL
    END,
    updated_by = auth.uid(),
    updated_at = now()
  RETURNING * INTO v_item;

  IF p_status = 'preparing' THEN
    IF p_source = 'meal_schedule' THEN
      UPDATE public.meal_schedules
      SET order_status = 'preparing', updated_at = now()
      WHERE id = p_order_id
        AND COALESCE(order_status, 'pending') IN ('pending', 'confirmed');
    ELSE
      UPDATE public.orders
      SET status = 'preparing', preparing_at = COALESCE(preparing_at, now()), updated_at = now()
      WHERE id = p_order_id
        AND COALESCE(status, 'pending') IN ('pending', 'confirmed');
    END IF;
  END IF;

  IF p_status = 'ready' AND p_all_item_keys IS NOT NULL AND array_length(p_all_item_keys, 1) > 0 THEN
    SELECT NOT EXISTS (
      SELECT 1
      FROM unnest(p_all_item_keys) AS expected(item_key)
      LEFT JOIN public.kitchen_queue_items kqi
        ON kqi.order_source = p_source
       AND kqi.order_id = p_order_id
       AND kqi.item_key = expected.item_key
       AND kqi.status = 'ready'
      WHERE kqi.id IS NULL
    ) INTO v_all_ready;

    IF v_all_ready THEN
      IF p_source = 'meal_schedule' THEN
        UPDATE public.meal_schedules
        SET order_status = 'ready', updated_at = now()
        WHERE id = p_order_id
          AND COALESCE(order_status, 'pending') IN ('pending', 'confirmed', 'preparing');
      ELSE
        UPDATE public.orders
        SET status = 'ready_for_pickup',
            ready_for_pickup_at = COALESCE(ready_for_pickup_at, now()),
            updated_at = now()
        WHERE id = p_order_id
          AND COALESCE(status, 'pending') IN ('pending', 'confirmed', 'preparing');
      END IF;
    END IF;
  END IF;

  RETURN v_item;
END;
$$;

REVOKE ALL ON FUNCTION public.partner_update_kitchen_item_status(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_update_kitchen_item_status(TEXT, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT[])
  TO authenticated;
