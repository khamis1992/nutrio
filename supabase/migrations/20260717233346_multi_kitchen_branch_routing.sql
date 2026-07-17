-- Production-ready restaurant branch routing for customer meal scheduling.
-- Chooses the best kitchen/branch during the atomic scheduling transaction and
-- stores an auditable routing decision on the meal schedule.

ALTER TABLE public.restaurant_branches
  ADD COLUMN IF NOT EXISTS is_accepting_orders BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_orders_per_slot INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS service_radius_km NUMERIC(8, 2) NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS avg_prep_time_minutes INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS routing_priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS routing_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_branches_max_orders_per_slot_check'
  ) THEN
    ALTER TABLE public.restaurant_branches
      ADD CONSTRAINT restaurant_branches_max_orders_per_slot_check
      CHECK (max_orders_per_slot BETWEEN 1 AND 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_branches_service_radius_km_check'
  ) THEN
    ALTER TABLE public.restaurant_branches
      ADD CONSTRAINT restaurant_branches_service_radius_km_check
      CHECK (service_radius_km BETWEEN 0.1 AND 250);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_branches_avg_prep_time_minutes_check'
  ) THEN
    ALTER TABLE public.restaurant_branches
      ADD CONSTRAINT restaurant_branches_avg_prep_time_minutes_check
      CHECK (avg_prep_time_minutes BETWEEN 0 AND 240);
  END IF;
END;
$$;

ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS routing_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS restaurant_branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL;

ALTER TABLE public.restaurant_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS restaurant_branches_admin_all ON public.restaurant_branches;
CREATE POLICY restaurant_branches_admin_all
  ON public.restaurant_branches
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS restaurant_branches_owner_select ON public.restaurant_branches;
CREATE POLICY restaurant_branches_owner_select
  ON public.restaurant_branches
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_branches.restaurant_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS restaurant_branches_owner_update_routing ON public.restaurant_branches;
CREATE POLICY restaurant_branches_owner_update_routing
  ON public.restaurant_branches
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_branches.restaurant_id
        AND r.owner_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = restaurant_branches.restaurant_id
        AND r.owner_id = (SELECT auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS meal_schedules_branch_slot_idx
  ON public.meal_schedules (
    restaurant_id,
    restaurant_branch_id,
    scheduled_date,
    delivery_time_slot
  )
  WHERE COALESCE(order_status, 'pending') NOT IN ('cancelled', 'rejected');

CREATE OR REPLACE FUNCTION public.haversine_km(
  p_lat1 NUMERIC,
  p_lon1 NUMERIC,
  p_lat2 NUMERIC,
  p_lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
RETURNS NULL ON NULL INPUT
SET search_path = public, pg_temp
AS $$
  SELECT ROUND(
    (
      6371 * 2 * ASIN(
        SQRT(
          POWER(SIN(RADIANS(($3 - $1) / 2)), 2)
          + COS(RADIANS($1)) * COS(RADIANS($3))
          * POWER(SIN(RADIANS(($4 - $2) / 2)), 2)
        )
      )
    )::NUMERIC,
    2
  );
$$;

CREATE OR REPLACE FUNCTION public.route_meal_schedule_branch(
  p_restaurant_id UUID,
  p_meal_id UUID,
  p_delivery_address_id UUID,
  p_scheduled_date DATE,
  p_delivery_time_slot TEXT,
  p_meal_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_address public.user_addresses%ROWTYPE;
  v_selected RECORD;
  v_candidates JSONB := '[]'::JSONB;
  v_has_branches BOOLEAN := FALSE;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'manual_review',
      'branch_id', NULL,
      'reason', 'restaurant_missing',
      'candidates', '[]'::JSONB
    );
  END IF;

  IF p_delivery_address_id IS NOT NULL THEN
    SELECT *
      INTO v_address
    FROM public.user_addresses ua
    WHERE ua.id = p_delivery_address_id
      AND (v_user_id IS NULL OR ua.user_id = v_user_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_branches rb
    WHERE rb.restaurant_id = p_restaurant_id
      AND COALESCE(rb.is_active, TRUE) = TRUE
  ) INTO v_has_branches;

  IF NOT v_has_branches THEN
    RETURN jsonb_build_object(
      'status', 'single_kitchen',
      'branch_id', NULL,
      'reason', 'restaurant_has_no_active_branches',
      'candidates', '[]'::JSONB
    );
  END IF;

  WITH branch_load AS (
    SELECT
      rb.id,
      rb.name,
      rb.address,
      rb.latitude,
      rb.longitude,
      rb.is_accepting_orders,
      rb.max_orders_per_slot,
      rb.service_radius_km,
      rb.avg_prep_time_minutes,
      rb.routing_priority,
      public.haversine_km(
        v_address.latitude::NUMERIC,
        v_address.longitude::NUMERIC,
        rb.latitude::NUMERIC,
        rb.longitude::NUMERIC
      ) AS distance_km,
      COUNT(ms.id)::INTEGER AS slot_load
    FROM public.restaurant_branches rb
    LEFT JOIN public.meal_schedules ms
      ON ms.restaurant_branch_id = rb.id
     AND ms.scheduled_date = p_scheduled_date
     AND COALESCE(ms.delivery_time_slot, '') = COALESCE(p_delivery_time_slot, '')
     AND COALESCE(ms.order_status, 'pending') NOT IN ('cancelled', 'rejected')
    WHERE rb.restaurant_id = p_restaurant_id
      AND COALESCE(rb.is_active, TRUE) = TRUE
    GROUP BY rb.id
  ),
  scored AS (
    SELECT
      bl.*,
      GREATEST(bl.max_orders_per_slot - bl.slot_load, 0) AS remaining_capacity,
      (
        COALESCE(bl.routing_priority, 0) * 10
        - COALESCE(bl.distance_km, 6) * 2
        - (bl.slot_load::NUMERIC / GREATEST(bl.max_orders_per_slot, 1)) * 25
        - COALESCE(bl.avg_prep_time_minutes, 20) * 0.05
      )::NUMERIC(12, 4) AS route_score,
      (
        COALESCE(bl.is_accepting_orders, TRUE) = TRUE
        AND bl.slot_load < bl.max_orders_per_slot
        AND (
          bl.distance_km IS NULL
          OR bl.distance_km <= bl.service_radius_km
        )
      ) AS eligible
    FROM branch_load bl
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'branch_id', id,
      'name', name,
      'eligible', eligible,
      'score', route_score,
      'distance_km', distance_km,
      'slot_load', slot_load,
      'max_orders_per_slot', max_orders_per_slot,
      'remaining_capacity', remaining_capacity,
      'service_radius_km', service_radius_km,
      'is_accepting_orders', is_accepting_orders,
      'avg_prep_time_minutes', avg_prep_time_minutes
    )
    ORDER BY eligible DESC, route_score DESC, distance_km ASC NULLS LAST, name ASC
  )
    INTO v_candidates
  FROM scored;

  WITH branch_load AS (
    SELECT
      rb.id,
      rb.name,
      rb.latitude,
      rb.longitude,
      rb.is_accepting_orders,
      rb.max_orders_per_slot,
      rb.service_radius_km,
      rb.avg_prep_time_minutes,
      rb.routing_priority,
      public.haversine_km(
        v_address.latitude::NUMERIC,
        v_address.longitude::NUMERIC,
        rb.latitude::NUMERIC,
        rb.longitude::NUMERIC
      ) AS distance_km,
      COUNT(ms.id)::INTEGER AS slot_load
    FROM public.restaurant_branches rb
    LEFT JOIN public.meal_schedules ms
      ON ms.restaurant_branch_id = rb.id
     AND ms.scheduled_date = p_scheduled_date
     AND COALESCE(ms.delivery_time_slot, '') = COALESCE(p_delivery_time_slot, '')
     AND COALESCE(ms.order_status, 'pending') NOT IN ('cancelled', 'rejected')
    WHERE rb.restaurant_id = p_restaurant_id
      AND COALESCE(rb.is_active, TRUE) = TRUE
    GROUP BY rb.id
  ),
  scored AS (
    SELECT
      bl.*,
      GREATEST(bl.max_orders_per_slot - bl.slot_load, 0) AS remaining_capacity,
      (
        COALESCE(bl.routing_priority, 0) * 10
        - COALESCE(bl.distance_km, 6) * 2
        - (bl.slot_load::NUMERIC / GREATEST(bl.max_orders_per_slot, 1)) * 25
        - COALESCE(bl.avg_prep_time_minutes, 20) * 0.05
      )::NUMERIC(12, 4) AS route_score,
      (
        COALESCE(bl.is_accepting_orders, TRUE) = TRUE
        AND bl.slot_load < bl.max_orders_per_slot
        AND (
          bl.distance_km IS NULL
          OR bl.distance_km <= bl.service_radius_km
        )
      ) AS eligible
    FROM branch_load bl
  )
  SELECT *
    INTO v_selected
  FROM scored
  WHERE eligible = TRUE
  ORDER BY route_score DESC, distance_km ASC NULLS LAST, name ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'routed',
      'branch_id', v_selected.id,
      'branch_name', v_selected.name,
      'score', v_selected.route_score,
      'reason', CASE
        WHEN v_selected.distance_km IS NULL THEN 'best_capacity_no_coordinates'
        ELSE 'best_distance_capacity_score'
      END,
      'distance_km', v_selected.distance_km,
      'slot_load', v_selected.slot_load,
      'remaining_capacity', v_selected.remaining_capacity,
      'meal_id', p_meal_id,
      'meal_type', p_meal_type,
      'candidates', COALESCE(v_candidates, '[]'::JSONB),
      'routed_at', now()
    );
  END IF;

  RETURN jsonb_build_object(
    'status', 'manual_review',
    'branch_id', NULL,
    'reason', 'no_branch_with_capacity_or_service_radius',
    'meal_id', p_meal_id,
    'meal_type', p_meal_type,
    'candidates', COALESCE(v_candidates, '[]'::JSONB),
    'routed_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_restaurant_branch_routing(
  p_branch_id UUID,
  p_is_accepting_orders BOOLEAN,
  p_max_orders_per_slot INTEGER,
  p_service_radius_km NUMERIC,
  p_avg_prep_time_minutes INTEGER,
  p_routing_priority INTEGER,
  p_routing_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_branch public.restaurant_branches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_branch_id IS NULL THEN
    RAISE EXCEPTION 'BRANCH_REQUIRED';
  END IF;

  IF p_max_orders_per_slot IS NULL OR p_max_orders_per_slot NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'BRANCH_SLOT_CAPACITY_INVALID';
  END IF;

  IF p_service_radius_km IS NULL OR p_service_radius_km < 0.1 OR p_service_radius_km > 250 THEN
    RAISE EXCEPTION 'BRANCH_SERVICE_RADIUS_INVALID';
  END IF;

  IF p_avg_prep_time_minutes IS NULL OR p_avg_prep_time_minutes NOT BETWEEN 0 AND 240 THEN
    RAISE EXCEPTION 'BRANCH_PREP_TIME_INVALID';
  END IF;

  IF LENGTH(COALESCE(p_routing_notes, '')) > 500 THEN
    RAISE EXCEPTION 'BRANCH_ROUTING_NOTES_TOO_LONG';
  END IF;

  SELECT rb.*
    INTO v_branch
  FROM public.restaurant_branches rb
  WHERE rb.id = p_branch_id
    AND (
      public.has_role(v_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.restaurants r
        WHERE r.id = rb.restaurant_id
          AND r.owner_id = v_user_id
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BRANCH_NOT_FOUND_OR_FORBIDDEN';
  END IF;

  UPDATE public.restaurant_branches rb
     SET is_accepting_orders = COALESCE(p_is_accepting_orders, TRUE),
         max_orders_per_slot = p_max_orders_per_slot,
         service_radius_km = ROUND(p_service_radius_km, 2),
         avg_prep_time_minutes = p_avg_prep_time_minutes,
         routing_priority = COALESCE(p_routing_priority, 0),
         routing_notes = NULLIF(TRIM(p_routing_notes), ''),
         updated_at = now()
   WHERE rb.id = p_branch_id
   RETURNING *
   INTO v_branch;

  RETURN jsonb_build_object(
    'success', TRUE,
    'branch_id', v_branch.id,
    'is_accepting_orders', v_branch.is_accepting_orders,
    'max_orders_per_slot', v_branch.max_orders_per_slot,
    'service_radius_km', v_branch.service_radius_km,
    'avg_prep_time_minutes', v_branch.avg_prep_time_minutes,
    'routing_priority', v_branch.routing_priority,
    'routing_notes', v_branch.routing_notes,
    'updated_at', v_branch.updated_at
  );
END;
$$;

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
  v_delivery_time_slot TEXT;
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
  v_routing JSONB;
  v_restaurant_branch_id UUID;
  v_customization_data JSONB;
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
    v_delivery_time_slot := NULLIF(v_item ->> 'delivery_time_slot', '');
    v_schedule_source := COALESCE(v_item ->> 'schedule_source', 'customer');
    v_coach_program_id := NULLIF(v_item ->> 'coach_program_id', '')::UUID;
    v_program_meal_id := NULLIF(v_item ->> 'program_meal_id', '')::UUID;
    v_coach_suggested_meal_id := NULLIF(v_item ->> 'coach_suggested_meal_id', '')::UUID;
    v_customization_data := COALESCE(v_item -> 'customization_data', '{}'::JSONB);

    IF v_meal_type NOT IN ('breakfast', 'lunch', 'dinner', 'snack') THEN
      RAISE EXCEPTION 'MEAL_TYPE_INVALID';
    END IF;
    IF v_scheduled_date < CURRENT_DATE THEN
      RAISE EXCEPTION 'SCHEDULE_DATE_INVALID';
    END IF;
    IF LENGTH(COALESCE(v_delivery_time_slot, '')) > 100
      OR LENGTH(COALESCE(v_item ->> 'restaurant_note', '')) > 1000
      OR OCTET_LENGTH(v_customization_data::TEXT) > 16384 THEN
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
    v_routing := public.route_meal_schedule_branch(
      v_meal.restaurant_id,
      v_meal.id,
      v_delivery_address_id,
      v_scheduled_date,
      v_delivery_time_slot,
      v_meal_type
    );
    v_restaurant_branch_id := NULLIF(v_routing ->> 'branch_id', '')::UUID;

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
      restaurant_branch_id,
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
      routing_metadata,
      request_batch_id,
      request_item_index
    ) VALUES (
      v_schedule_id,
      v_user_id,
      v_meal.id,
      v_meal.restaurant_id,
      v_restaurant_branch_id,
      v_scheduled_date,
      v_meal_type,
      FALSE,
      'pending',
      v_delivery_address_id,
      v_delivery_time_slot,
      v_customization_data,
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
      COALESCE(v_routing, '{}'::JSONB),
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

CREATE OR REPLACE FUNCTION public.sync_delivery_job_branch_from_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.restaurant_branch_id IS NULL AND NEW.schedule_id IS NOT NULL THEN
    SELECT ms.restaurant_branch_id
      INTO NEW.restaurant_branch_id
    FROM public.meal_schedules ms
    WHERE ms.id = NEW.schedule_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_delivery_job_branch_from_schedule_trigger ON public.delivery_jobs;
CREATE TRIGGER sync_delivery_job_branch_from_schedule_trigger
  BEFORE INSERT OR UPDATE OF schedule_id
  ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_delivery_job_branch_from_schedule();

CREATE OR REPLACE FUNCTION public.propagate_schedule_branch_to_delivery_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.delivery_jobs dj
     SET restaurant_branch_id = NEW.restaurant_branch_id
   WHERE dj.schedule_id = NEW.id
     AND dj.restaurant_branch_id IS DISTINCT FROM NEW.restaurant_branch_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS propagate_schedule_branch_to_delivery_jobs_trigger
  ON public.meal_schedules;
CREATE TRIGGER propagate_schedule_branch_to_delivery_jobs_trigger
  AFTER UPDATE OF restaurant_branch_id
  ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_schedule_branch_to_delivery_jobs();

GRANT EXECUTE ON FUNCTION public.route_meal_schedule_branch(UUID, UUID, UUID, DATE, TEXT, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_restaurant_branch_routing(UUID, BOOLEAN, INTEGER, NUMERIC, INTEGER, INTEGER, TEXT)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.route_meal_schedule_branch(UUID, UUID, UUID, DATE, TEXT, TEXT) IS
  'Routes a meal schedule to the best restaurant branch using distance, slot capacity, branch availability, load, and routing priority.';
COMMENT ON FUNCTION public.update_restaurant_branch_routing(UUID, BOOLEAN, INTEGER, NUMERIC, INTEGER, INTEGER, TEXT) IS
  'Safely updates operational routing controls for a restaurant branch owned by the current partner or by an admin.';
