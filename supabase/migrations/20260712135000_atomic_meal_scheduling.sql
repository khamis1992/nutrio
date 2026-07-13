-- Keep customer quota, wallet add-ons, schedule rows, and partner ownership in
-- one transaction so every portal observes the same order state.

ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS request_batch_id UUID,
  ADD COLUMN IF NOT EXISTS request_item_index INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS meal_schedules_request_item_unique
  ON public.meal_schedules (user_id, request_batch_id, request_item_index)
  WHERE request_batch_id IS NOT NULL;

REVOKE INSERT ON public.meal_schedules FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.schedule_addons FROM anon, authenticated;
GRANT SELECT ON public.schedule_addons TO authenticated;
GRANT ALL ON public.meal_schedules, public.schedule_addons TO service_role;

CREATE OR REPLACE FUNCTION public.set_meal_schedule_restaurant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.restaurant_id IS NULL
    OR TG_OP = 'UPDATE' AND OLD.meal_id IS DISTINCT FROM NEW.meal_id THEN
    SELECT m.restaurant_id
      INTO NEW.restaurant_id
    FROM public.meals m
    WHERE m.id = NEW.meal_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_meal_schedule_restaurant_id_trigger
  ON public.meal_schedules;
CREATE TRIGGER set_meal_schedule_restaurant_id_trigger
  BEFORE INSERT OR UPDATE OF meal_id
  ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_meal_schedule_restaurant_id();

CREATE OR REPLACE FUNCTION public.schedule_meals_atomic(
  p_subscription_id UUID,
  p_items JSONB,
  p_request_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_item JSONB;
  v_addon_item JSONB;
  v_meal public.meals%ROWTYPE;
  v_addon public.meal_addons%ROWTYPE;
  v_schedule_id UUID;
  v_schedule_ids UUID[] := ARRAY[]::UUID[];
  v_item_index INTEGER := 0;
  v_item_count INTEGER;
  v_meal_type TEXT;
  v_scheduled_date DATE;
  v_delivery_address_id UUID;
  v_schedule_source TEXT;
  v_coach_program_id UUID;
  v_program_meal_id UUID;
  v_coach_suggested_meal_id UUID;
  v_addon_id UUID;
  v_addon_quantity INTEGER;
  v_addon_count INTEGER;
  v_addons JSONB;
  v_addons_total NUMERIC(10, 2);
  v_existing_ids UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_request_batch_id IS NULL THEN
    RAISE EXCEPTION 'SCHEDULE_REQUEST_ID_REQUIRED';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'SCHEDULE_ITEMS_INVALID';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 14 THEN
    RAISE EXCEPTION 'SCHEDULE_ITEM_COUNT_INVALID';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_user_id::TEXT || ':' || p_request_batch_id::TEXT, 0)
  );

  SELECT ARRAY_AGG(ms.id ORDER BY ms.request_item_index)
    INTO v_existing_ids
  FROM public.meal_schedules ms
  WHERE ms.user_id = v_user_id
    AND ms.request_batch_id = p_request_batch_id;

  IF COALESCE(array_length(v_existing_ids, 1), 0) > 0 THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'already_processed', TRUE,
      'schedule_ids', to_jsonb(v_existing_ids)
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.id = p_subscription_id
      AND s.user_id = v_user_id
      AND s.status IN ('active', 'cancelled')
      AND (
        s.status = 'active'
        OR COALESCE(s.end_date, CURRENT_DATE - 1) >= CURRENT_DATE
      )
  ) THEN
    RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_item_index := v_item_index + 1;
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'SCHEDULE_ITEM_INVALID';
    END IF;
    v_meal_type := LOWER(COALESCE(v_item ->> 'meal_type', ''));
    v_scheduled_date := (v_item ->> 'scheduled_date')::DATE;
    v_delivery_address_id := NULLIF(v_item ->> 'delivery_address_id', '')::UUID;
    v_schedule_source := COALESCE(v_item ->> 'schedule_source', 'customer');
    v_coach_program_id := NULLIF(v_item ->> 'coach_program_id', '')::UUID;
    v_program_meal_id := NULLIF(v_item ->> 'program_meal_id', '')::UUID;
    v_coach_suggested_meal_id := NULLIF(v_item ->> 'coach_suggested_meal_id', '')::UUID;

    IF v_meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack') THEN
      RAISE EXCEPTION 'MEAL_TYPE_INVALID';
    END IF;
    IF v_scheduled_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'SCHEDULE_DATE_INVALID';
    END IF;
    IF LENGTH(COALESCE(v_item ->> 'delivery_time_slot', '')) > 100
      OR LENGTH(COALESCE(v_item ->> 'restaurant_note', '')) > 1000
      OR OCTET_LENGTH(COALESCE(v_item -> 'customization_data', '{}'::JSONB)::TEXT) > 16384 THEN
      RAISE EXCEPTION 'SCHEDULE_DETAILS_TOO_LARGE';
    END IF;

    SELECT *
      INTO v_meal
    FROM public.meals m
    WHERE m.id = (v_item ->> 'meal_id')::UUID
      AND COALESCE(m.is_available, FALSE) = TRUE
      AND m.deleted_at IS NULL
      AND (m.approval_status IS NULL OR m.approval_status = 'approved')
    FOR SHARE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'MEAL_NOT_AVAILABLE';
    END IF;

    IF v_delivery_address_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.user_addresses ua
        WHERE ua.id = v_delivery_address_id
          AND ua.user_id = v_user_id
      ) THEN
      RAISE EXCEPTION 'DELIVERY_ADDRESS_NOT_FOUND';
    END IF;

    IF v_schedule_source NOT IN ('customer', 'coach_program', 'coach_replacement') THEN
      RAISE EXCEPTION 'SCHEDULE_SOURCE_INVALID';
    END IF;

    IF v_schedule_source <> 'customer' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.coach_programs cp
        JOIN public.program_meals pm
          ON pm.program_id = cp.id
        WHERE cp.id = v_coach_program_id
          AND cp.client_id = v_user_id
          AND cp.status = 'active'
          AND pm.id = v_program_meal_id
          AND pm.assigned_date = v_scheduled_date
          AND pm.meal_type = v_meal_type
          AND pm.meal_id = v_coach_suggested_meal_id
      ) THEN
        RAISE EXCEPTION 'COACH_MEAL_CONTEXT_INVALID';
      END IF;
    ELSE
      v_coach_program_id := NULL;
      v_program_meal_id := NULL;
      v_coach_suggested_meal_id := NULL;
    END IF;

    IF NOT public.increment_monthly_meal_usage(p_subscription_id) THEN
      RAISE EXCEPTION 'MEAL_QUOTA_EXHAUSTED';
    END IF;
    IF v_meal_type = 'snack'
      AND NOT public.increment_snack_usage(p_subscription_id) THEN
      RAISE EXCEPTION 'SNACK_QUOTA_EXHAUSTED';
    END IF;

    v_schedule_id := gen_random_uuid();
    v_addons_total := 0;

    IF v_item ? 'addons'
      AND jsonb_typeof(v_item -> 'addons') <> 'array' THEN
      RAISE EXCEPTION 'SCHEDULE_ADDONS_INVALID';
    END IF;
    v_addons := CASE
      WHEN jsonb_typeof(v_item -> 'addons') = 'array' THEN v_item -> 'addons'
      ELSE '[]'::JSONB
    END;
    v_addon_count := jsonb_array_length(v_addons);
    IF v_addon_count > 20 THEN
      RAISE EXCEPTION 'SCHEDULE_ADDONS_INVALID';
    END IF;

    FOR v_addon_item IN
      SELECT jsonb_build_object(
        'addon_id', source.addon_id,
        'quantity', SUM(source.quantity)
      )
      FROM (
        SELECT
          (entry ->> 'addon_id')::UUID AS addon_id,
          (entry ->> 'quantity')::INTEGER AS quantity
        FROM jsonb_array_elements(v_addons) entry
      ) source
      GROUP BY source.addon_id
    LOOP
      v_addon_id := (v_addon_item ->> 'addon_id')::UUID;
      v_addon_quantity := (v_addon_item ->> 'quantity')::INTEGER;

      IF v_addon_quantity < 1 OR v_addon_quantity > 20 THEN
        RAISE EXCEPTION 'SCHEDULE_ADDON_QUANTITY_INVALID';
      END IF;

      SELECT *
        INTO v_addon
      FROM public.meal_addons ma
      WHERE ma.id = v_addon_id
        AND ma.meal_id = v_meal.id
        AND ma.is_available = TRUE
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'MEAL_ADDON_NOT_AVAILABLE';
      END IF;

      v_addons_total := v_addons_total
        + ROUND(v_addon.price::NUMERIC * v_addon_quantity, 2);
    END LOOP;

    INSERT INTO public.meal_schedules (
      id,
      user_id,
      meal_id,
      restaurant_id,
      scheduled_date,
      meal_type,
      is_completed,
      order_status,
      delivery_address_id,
      delivery_time_slot,
      customization_data,
      restaurant_note,
      schedule_source,
      coach_program_id,
      program_meal_id,
      coach_suggested_meal_id,
      coach_replacement_status,
      coach_replacement_delta,
      addons_total,
      request_batch_id,
      request_item_index
    ) VALUES (
      v_schedule_id,
      v_user_id,
      v_meal.id,
      v_meal.restaurant_id,
      v_scheduled_date,
      v_meal_type,
      FALSE,
      'pending',
      v_delivery_address_id,
      NULLIF(v_item ->> 'delivery_time_slot', ''),
      COALESCE(v_item -> 'customization_data', '{}'::JSONB),
      NULLIF(TRIM(v_item ->> 'restaurant_note'), ''),
      v_schedule_source,
      v_coach_program_id,
      v_program_meal_id,
      v_coach_suggested_meal_id,
      CASE
        WHEN v_schedule_source = 'customer' THEN NULL
        ELSE NULLIF(v_item ->> 'coach_replacement_status', '')
      END,
      CASE
        WHEN v_schedule_source = 'customer' THEN NULL
        ELSE v_item -> 'coach_replacement_delta'
      END,
      v_addons_total,
      p_request_batch_id,
      v_item_index
    );

    IF v_addons_total > 0 THEN
      PERFORM public.debit_wallet(
        v_user_id,
        v_addons_total,
        'meal_addons',
        v_schedule_id,
        'Meal add-ons',
        jsonb_build_object('meal_id', v_meal.id)
      );

    END IF;

    IF v_addon_count > 0 THEN
      INSERT INTO public.schedule_addons (
        schedule_id,
        addon_id,
        quantity,
        unit_price
      )
      SELECT
        v_schedule_id,
        source.addon_id,
        source.quantity,
        ma.price
      FROM (
        SELECT
          (entry ->> 'addon_id')::UUID AS addon_id,
          SUM((entry ->> 'quantity')::INTEGER)::INTEGER AS quantity
        FROM jsonb_array_elements(v_addons) entry
        GROUP BY (entry ->> 'addon_id')::UUID
      ) source
      JOIN public.meal_addons ma ON ma.id = source.addon_id;
    END IF;

    v_schedule_ids := array_append(v_schedule_ids, v_schedule_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_processed', FALSE,
    'schedule_ids', to_jsonb(v_schedule_ids)
  );
END;
$$;
