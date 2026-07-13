-- Make delivered-order nutrition logging owner-bound and idempotent.

ALTER TABLE public.meal_history
  ADD COLUMN IF NOT EXISTS source_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_meal_id UUID REFERENCES public.meals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_meal_history_delivered_order_meal
  ON public.meal_history (user_id, source_order_id, source_meal_id)
  WHERE source_order_id IS NOT NULL AND source_meal_id IS NOT NULL;

-- Keep only one actionable notification per delivered meal before enforcing idempotency.
DELETE FROM public.notifications newer
USING public.notifications older
WHERE newer.id <> older.id
  AND newer.user_id = older.user_id
  AND newer.related_entity_id = older.related_entity_id
  AND newer.type::TEXT = 'order_delivered'
  AND older.type::TEXT = 'order_delivered'
  AND newer.data ->> 'meal_id' = older.data ->> 'meal_id'
  AND newer.data ->> 'action' = 'add_to_progress'
  AND older.data ->> 'action' = 'add_to_progress'
  AND (COALESCE(newer.created_at, 'epoch'::TIMESTAMPTZ), newer.id)
    > (COALESCE(older.created_at, 'epoch'::TIMESTAMPTZ), older.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivered_meal_progress_notification
  ON public.notifications (user_id, related_entity_id, ((data ->> 'meal_id')))
  WHERE type = 'order_delivered'::public.notification_type
    AND data ->> 'action' = 'add_to_progress';

CREATE OR REPLACE FUNCTION public.notify_meal_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meal RECORD;
BEGIN
  IF NEW.user_id IS NULL
    OR NEW.status::TEXT <> 'delivered'
    OR (TG_OP = 'UPDATE' AND OLD.status::TEXT = 'delivered') THEN
    RETURN NEW;
  END IF;

  FOR v_meal IN
    WITH ordered_meals AS (
      SELECT oi.meal_id, SUM(GREATEST(oi.quantity, 1))::INTEGER AS quantity
      FROM public.order_items oi
      WHERE oi.order_id = NEW.id
        AND oi.meal_id IS NOT NULL
      GROUP BY oi.meal_id

      UNION ALL

      SELECT NEW.meal_id, 1
      WHERE NEW.meal_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.order_items oi
          WHERE oi.order_id = NEW.id
            AND oi.meal_id = NEW.meal_id
        )
    )
    SELECT
      m.id,
      m.name,
      COALESCE(m.calories, 0)::NUMERIC AS calories,
      COALESCE(m.protein_g, m.protein, 0)::NUMERIC AS protein_g,
      COALESCE(m.carbs_g, m.carbs, 0)::NUMERIC AS carbs_g,
      COALESCE(m.fat_g, m.fats, 0)::NUMERIC AS fat_g,
      om.quantity
    FROM ordered_meals om
    JOIN public.meals m ON m.id = om.meal_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      status,
      data,
      related_entity_type,
      related_entity_id,
      created_at
    )
    VALUES (
      NEW.user_id,
      'order_delivered'::public.notification_type,
      'Order Delivered! Add to Progress?',
      format('%s has been delivered. Would you like to add it to your Today''s Progress?', v_meal.name),
      'unread'::public.notification_status,
      jsonb_build_object(
        'order_id', NEW.id,
        'meal_id', v_meal.id,
        'meal_name', v_meal.name,
        'quantity', v_meal.quantity,
        'calories', v_meal.calories * v_meal.quantity,
        'protein_g', v_meal.protein_g * v_meal.quantity,
        'carbs_g', v_meal.carbs_g * v_meal.quantity,
        'fat_g', v_meal.fat_g * v_meal.quantity,
        'action', 'add_to_progress'
      ),
      'order',
      NEW.id,
      now()
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_order_delivered_notification ON public.orders;
CREATE TRIGGER tr_order_delivered_notification
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status::TEXT = 'delivered' AND OLD.status::TEXT IS DISTINCT FROM 'delivered')
  EXECUTE FUNCTION public.notify_meal_delivered();

DROP TRIGGER IF EXISTS tr_order_insert_delivered_notification ON public.orders;
CREATE TRIGGER tr_order_insert_delivered_notification
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.status::TEXT = 'delivered')
  EXECUTE FUNCTION public.notify_meal_delivered();

CREATE OR REPLACE FUNCTION public.add_delivered_meal_to_progress(
  p_order_id UUID,
  p_meal_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.orders%ROWTYPE;
  v_meal RECORD;
  v_quantity INTEGER;
  v_calories NUMERIC;
  v_protein NUMERIC;
  v_carbs NUMERIC;
  v_fat NUMERIC;
  v_history_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND user_id = v_actor
    AND status::TEXT IN ('delivered', 'completed')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERED_ORDER_NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(GREATEST(oi.quantity, 1)), 0)::INTEGER
  INTO v_quantity
  FROM public.order_items oi
  WHERE oi.order_id = v_order.id
    AND oi.meal_id = p_meal_id;

  IF v_quantity = 0 AND v_order.meal_id = p_meal_id THEN
    v_quantity := 1;
  END IF;

  IF v_quantity = 0 THEN
    RAISE EXCEPTION 'MEAL_NOT_IN_ORDER';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.meal_history mh
    WHERE mh.user_id = v_actor
      AND mh.source_order_id = p_order_id
      AND mh.source_meal_id = p_meal_id
  ) THEN
    RETURN true;
  END IF;

  SELECT
    m.name AS name,
    m.image_url AS image_url,
    COALESCE(m.calories, 0)::NUMERIC AS calories,
    COALESCE(m.protein_g, m.protein, 0)::NUMERIC AS protein_g,
    COALESCE(m.carbs_g, m.carbs, 0)::NUMERIC AS carbs_g,
    COALESCE(m.fat_g, m.fats, 0)::NUMERIC AS fat_g
  INTO v_meal
  FROM public.meals m
  WHERE m.id = p_meal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEAL_NOT_FOUND';
  END IF;

  v_calories := v_meal.calories * v_quantity;
  v_protein := v_meal.protein_g * v_quantity;
  v_carbs := v_meal.carbs_g * v_quantity;
  v_fat := v_meal.fat_g * v_quantity;

  INSERT INTO public.meal_history (
    user_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    image_url,
    logged_at,
    source,
    source_order_id,
    source_meal_id
  )
  VALUES (
    v_actor,
    v_meal.name,
    v_calories,
    v_protein,
    v_carbs,
    v_fat,
    v_meal.image_url,
    now(),
    'delivered_order',
    p_order_id,
    p_meal_id
  )
  RETURNING id INTO v_history_id;

  INSERT INTO public.progress_logs (
    user_id,
    log_date,
    calories_consumed,
    protein_consumed_g,
    carbs_consumed_g,
    fat_consumed_g,
    created_at,
    updated_at
  )
  VALUES (
    v_actor,
    (now() AT TIME ZONE 'Asia/Qatar')::DATE,
    v_calories,
    v_protein,
    v_carbs,
    v_fat,
    now(),
    now()
  )
  ON CONFLICT (user_id, log_date) DO UPDATE
  SET calories_consumed = COALESCE(public.progress_logs.calories_consumed, 0) + EXCLUDED.calories_consumed,
      protein_consumed_g = COALESCE(public.progress_logs.protein_consumed_g, 0) + EXCLUDED.protein_consumed_g,
      carbs_consumed_g = COALESCE(public.progress_logs.carbs_consumed_g, 0) + EXCLUDED.carbs_consumed_g,
      fat_consumed_g = COALESCE(public.progress_logs.fat_consumed_g, 0) + EXCLUDED.fat_consumed_g,
      updated_at = now();

  UPDATE public.profiles p
  SET total_meals_logged = counts.meal_count,
      updated_at = now()
  FROM (
    SELECT COUNT(*)::INTEGER AS meal_count
    FROM public.meal_history mh
    WHERE mh.user_id = v_actor
  ) counts
  WHERE p.user_id = v_actor;

  PERFORM public.award_xp(
    v_actor,
    10,
    'Delivered meal logged',
    'delivered_meal_log',
    p_order_id::TEXT || ':' || p_meal_id::TEXT,
    jsonb_build_object('meal_history_id', v_history_id, 'order_id', p_order_id, 'meal_id', p_meal_id)
  );

  PERFORM public.check_and_award_badges(v_actor);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.add_delivered_meal_to_progress(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_delivered_meal_to_progress(UUID, UUID) TO authenticated;
