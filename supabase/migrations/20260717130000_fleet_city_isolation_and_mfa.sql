BEGIN;

-- Fleet authorization must be anchored to an immutable operational city. A
-- portal filter is not an authorization boundary: every table and privileged
-- RPC below performs the same city check inside PostgreSQL.
ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE RESTRICT;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE RESTRICT;
ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE RESTRICT;
ALTER TABLE public.driver_payouts
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.cities(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS meal_schedules_city_dispatch_idx
  ON public.meal_schedules (city_id, order_status, scheduled_date);
CREATE INDEX IF NOT EXISTS orders_city_dispatch_idx
  ON public.orders (city_id, status, created_at);
CREATE INDEX IF NOT EXISTS delivery_jobs_city_status_idx
  ON public.delivery_jobs (city_id, status, created_at);
CREATE INDEX IF NOT EXISTS driver_payouts_city_status_idx
  ON public.driver_payouts (city_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.resolve_city_id(p_city_label TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT c.id
  FROM public.cities c
  WHERE p_city_label IS NOT NULL
    AND (
      regexp_replace(lower(trim(c.name)), '\s+', ' ', 'g') =
        regexp_replace(lower(trim(p_city_label)), '\s+', ' ', 'g')
      OR (
        c.name_ar IS NOT NULL
        AND regexp_replace(lower(trim(c.name_ar)), '\s+', ' ', 'g') =
          regexp_replace(lower(trim(p_city_label)), '\s+', ' ', 'g')
      )
    )
  ORDER BY COALESCE(c.is_active, false) DESC, c.created_at ASC NULLS LAST, c.id
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.resolve_city_id(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_city_id(TEXT) TO authenticated, service_role;

-- Backfill only from authoritative relationships. Records that cannot be
-- resolved stay NULL and are deliberately hidden from fleet operators until
-- an administrator corrects the source address.
UPDATE public.meal_schedules ms
SET city_id = public.resolve_city_id(ua.city)
FROM public.user_addresses ua
WHERE ms.city_id IS NULL
  AND ms.delivery_address_id = ua.id
  AND public.resolve_city_id(ua.city) IS NOT NULL;

UPDATE public.meal_schedules ms
SET city_id = (
  SELECT public.resolve_city_id(ua.city)
  FROM public.user_addresses ua
  WHERE ua.user_id = ms.user_id
    AND public.resolve_city_id(ua.city) IS NOT NULL
  ORDER BY COALESCE(ua.is_default, false) DESC, ua.updated_at DESC, ua.id
  LIMIT 1
)
WHERE ms.city_id IS NULL
  AND ms.delivery_address_id IS NULL
  AND COALESCE(ms.delivery_type, 'delivery') <> 'pickup';

UPDATE public.orders o
SET city_id = d.city_id
FROM public.drivers d
WHERE o.city_id IS NULL
  AND o.driver_id = d.id
  AND d.city_id IS NOT NULL;

UPDATE public.orders o
SET city_id = (
  SELECT public.resolve_city_id(ua.city)
  FROM public.user_addresses ua
  WHERE ua.user_id = o.user_id
    AND public.resolve_city_id(ua.city) IS NOT NULL
  ORDER BY COALESCE(ua.is_default, false) DESC, ua.updated_at DESC, ua.id
  LIMIT 1
)
WHERE o.city_id IS NULL
  AND o.user_id IS NOT NULL;

-- Separate updates avoid an accidental cross product while preserving source
-- priority: schedule/order delivery city wins over a driver assignment.
UPDATE public.delivery_jobs dj
SET city_id = ms.city_id
FROM public.meal_schedules ms
WHERE dj.city_id IS NULL
  AND dj.schedule_id = ms.id
  AND ms.city_id IS NOT NULL;

UPDATE public.delivery_jobs dj
SET city_id = o.city_id
FROM public.orders o
WHERE dj.city_id IS NULL
  AND dj.order_id = o.id
  AND o.city_id IS NOT NULL;

UPDATE public.delivery_jobs dj
SET city_id = d.city_id
FROM public.drivers d
WHERE dj.city_id IS NULL
  AND dj.driver_id = d.id
  AND d.city_id IS NOT NULL;

UPDATE public.driver_payouts dp
SET city_id = d.city_id
FROM public.drivers d
WHERE dp.city_id IS NULL
  AND dp.driver_id = d.id
  AND d.city_id IS NOT NULL;

-- Admin role checks already require aal2. Fleet super administrators now use
-- the same step-up requirement; city-scoped managers remain limited to their
-- explicit assigned_city_ids.
CREATE OR REPLACE FUNCTION public.can_manage_fleet_city(p_city_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.fleet_managers fm
      WHERE fm.auth_user_id = auth.uid()
        AND fm.is_active = true
        AND (
          (
            fm.role = 'super_admin'
            AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
          )
          OR (
            fm.role = 'fleet_manager'
            AND p_city_id IS NOT NULL
            AND p_city_id = ANY(COALESCE(fm.assigned_city_ids, ARRAY[]::UUID[]))
          )
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_active_fleet_operator(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_user_id IS NOT NULL
    AND p_user_id = auth.uid()
    AND (
      public.has_role(p_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1
        FROM public.fleet_managers fm
        WHERE fm.auth_user_id = p_user_id
          AND fm.is_active = true
          AND (
            fm.role = 'fleet_manager'
            OR (
              fm.role = 'super_admin'
              AND COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
            )
          )
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_manage_fleet_city(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_fleet_operator(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_fleet_city(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_fleet_operator(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.derive_meal_schedule_city()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_city_id UUID;
  v_is_privileged BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  IF NEW.delivery_address_id IS NOT NULL THEN
    SELECT public.resolve_city_id(ua.city)
    INTO v_city_id
    FROM public.user_addresses ua
    WHERE ua.id = NEW.delivery_address_id
      AND ua.user_id = NEW.user_id;
  ELSIF COALESCE(NEW.delivery_type, 'delivery') <> 'pickup' THEN
    SELECT public.resolve_city_id(ua.city)
    INTO v_city_id
    FROM public.user_addresses ua
    WHERE ua.user_id = NEW.user_id
    ORDER BY COALESCE(ua.is_default, false) DESC, ua.updated_at DESC, ua.id
    LIMIT 1;
  END IF;

  IF v_city_id IS NOT NULL THEN
    NEW.city_id := v_city_id;
  ELSIF NOT v_is_privileged THEN
    NEW.city_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS derive_meal_schedule_city_trigger ON public.meal_schedules;
CREATE TRIGGER derive_meal_schedule_city_trigger
  BEFORE INSERT OR UPDATE OF delivery_address_id, delivery_type, user_id, city_id
  ON public.meal_schedules
  FOR EACH ROW EXECUTE FUNCTION public.derive_meal_schedule_city();

CREATE OR REPLACE FUNCTION public.derive_order_city()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_address_city_id UUID;
  v_driver_city_id UUID;
  v_is_privileged BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    SELECT public.resolve_city_id(ua.city)
    INTO v_address_city_id
    FROM public.user_addresses ua
    WHERE ua.user_id = NEW.user_id
    ORDER BY COALESCE(ua.is_default, false) DESC, ua.updated_at DESC, ua.id
    LIMIT 1;
  END IF;

  IF NEW.driver_id IS NOT NULL THEN
    SELECT d.city_id INTO v_driver_city_id
    FROM public.drivers d
    WHERE d.id = NEW.driver_id;

    IF v_driver_city_id IS NULL THEN
      RAISE EXCEPTION 'DRIVER_CITY_REQUIRED';
    END IF;
  END IF;

  IF v_address_city_id IS NOT NULL
     AND v_driver_city_id IS NOT NULL
     AND v_address_city_id <> v_driver_city_id THEN
    RAISE EXCEPTION 'CROSS_CITY_DRIVER_ASSIGNMENT';
  END IF;

  IF v_address_city_id IS NOT NULL THEN
    NEW.city_id := v_address_city_id;
  ELSIF TG_OP = 'UPDATE'
        AND NOT v_is_privileged
        AND NEW.city_id IS DISTINCT FROM OLD.city_id THEN
    RAISE EXCEPTION 'ORDER_CITY_CHANGE_REQUIRES_ADMIN';
  ELSIF NEW.city_id IS NULL AND v_driver_city_id IS NOT NULL THEN
    NEW.city_id := v_driver_city_id;
  ELSIF TG_OP = 'INSERT' AND NOT v_is_privileged THEN
    NEW.city_id := NULL;
  END IF;

  IF NEW.city_id IS NOT NULL
     AND v_driver_city_id IS NOT NULL
     AND NEW.city_id <> v_driver_city_id THEN
    RAISE EXCEPTION 'CROSS_CITY_DRIVER_ASSIGNMENT';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS derive_order_city_trigger ON public.orders;
CREATE TRIGGER derive_order_city_trigger
  BEFORE INSERT OR UPDATE OF driver_id, user_id, city_id
  ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.derive_order_city();

CREATE OR REPLACE FUNCTION public.derive_delivery_job_city()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_source_city_id UUID;
  v_driver_city_id UUID;
  v_is_privileged BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::public.app_role);
BEGIN
  IF NEW.schedule_id IS NOT NULL AND NEW.order_id IS NOT NULL THEN
    RAISE EXCEPTION 'DELIVERY_JOB_SOURCE_CONFLICT';
  END IF;

  IF NEW.schedule_id IS NOT NULL THEN
    SELECT ms.city_id INTO v_source_city_id
    FROM public.meal_schedules ms
    WHERE ms.id = NEW.schedule_id;
  ELSIF NEW.order_id IS NOT NULL THEN
    SELECT o.city_id INTO v_source_city_id
    FROM public.orders o
    WHERE o.id = NEW.order_id;
  END IF;

  IF NEW.driver_id IS NOT NULL THEN
    SELECT d.city_id INTO v_driver_city_id
    FROM public.drivers d
    WHERE d.id = NEW.driver_id;

    IF v_driver_city_id IS NULL THEN
      RAISE EXCEPTION 'DRIVER_CITY_REQUIRED';
    END IF;
  END IF;

  IF v_source_city_id IS NOT NULL
     AND v_driver_city_id IS NOT NULL
     AND v_source_city_id <> v_driver_city_id THEN
    RAISE EXCEPTION 'CROSS_CITY_DRIVER_ASSIGNMENT';
  END IF;

  IF v_source_city_id IS NOT NULL THEN
    NEW.city_id := v_source_city_id;
  ELSIF v_driver_city_id IS NOT NULL THEN
    NEW.city_id := v_driver_city_id;
  ELSIF NOT v_is_privileged THEN
    NEW.city_id := NULL;
  END IF;

  IF NOT v_is_privileged
     AND (NEW.schedule_id IS NOT NULL OR NEW.order_id IS NOT NULL)
     AND v_source_city_id IS NULL THEN
    RAISE EXCEPTION 'DELIVERY_SOURCE_CITY_REQUIRED';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS derive_delivery_job_city_trigger ON public.delivery_jobs;
CREATE TRIGGER derive_delivery_job_city_trigger
  BEFORE INSERT OR UPDATE OF schedule_id, order_id, driver_id, city_id
  ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.derive_delivery_job_city();

CREATE OR REPLACE FUNCTION public.derive_driver_payout_city()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_city_id UUID;
BEGIN
  SELECT d.city_id INTO v_city_id
  FROM public.drivers d
  WHERE d.id = NEW.driver_id;

  IF v_city_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_CITY_REQUIRED';
  END IF;

  NEW.city_id := v_city_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS derive_driver_payout_city_trigger ON public.driver_payouts;
CREATE TRIGGER derive_driver_payout_city_trigger
  BEFORE INSERT OR UPDATE OF driver_id, city_id
  ON public.driver_payouts
  FOR EACH ROW EXECUTE FUNCTION public.derive_driver_payout_city();

CREATE OR REPLACE FUNCTION public.validate_delivery_job_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin');
  v_is_admin BOOLEAN := public.has_role(v_actor, 'admin');
  v_is_fleet BOOLEAN := NEW.city_id IS NOT NULL
    AND public.can_manage_fleet_city(NEW.city_id)
    AND (TG_OP = 'INSERT' OR public.can_manage_fleet_city(OLD.city_id));
  v_order_restaurant_id UUID;
BEGIN
  IF num_nonnulls(NEW.schedule_id, NEW.order_id) <> 1 THEN
    RAISE EXCEPTION 'DELIVERY_JOB_REQUIRES_EXACTLY_ONE_SOURCE';
  END IF;

  IF NEW.order_id IS NOT NULL THEN
    SELECT o.restaurant_id
    INTO v_order_restaurant_id
    FROM public.orders o
    WHERE o.id = NEW.order_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERY_ORDER_NOT_FOUND';
    END IF;

    IF NEW.restaurant_id IS NULL THEN
      NEW.restaurant_id := v_order_restaurant_id;
    ELSIF NEW.restaurant_id IS DISTINCT FROM v_order_restaurant_id THEN
      RAISE EXCEPTION 'DELIVERY_ORDER_RESTAURANT_MISMATCH';
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.order_id IS NOT NULL
     AND NOT (v_is_service OR v_is_admin OR v_is_fleet) THEN
    RAISE EXCEPTION 'ONLY_SCOPED_FLEET_CAN_CREATE_ORDER_DELIVERY';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.order_id IS DISTINCT FROM OLD.order_id
       OR NEW.schedule_id IS DISTINCT FROM OLD.schedule_id
     )
     AND NOT (v_is_service OR v_is_admin OR v_is_fleet) THEN
    RAISE EXCEPTION 'ONLY_SCOPED_FLEET_CAN_RELINK_DELIVERY';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_00_validate_delivery_job_source
  ON public.delivery_jobs;
CREATE TRIGGER trigger_00_validate_delivery_job_source
  BEFORE INSERT OR UPDATE OF order_id, schedule_id, restaurant_id, city_id
  ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_delivery_job_source();

REVOKE ALL ON FUNCTION public.validate_delivery_job_source() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.claim_delivery_job(
  p_job_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_driver public.drivers%ROWTYPE;
  v_job public.delivery_jobs%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers
  WHERE id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND OR v_driver.user_id <> v_actor THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'error', 'Driver identity mismatch');
  END IF;

  IF v_driver.city_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'DRIVER_CITY_REQUIRED', 'error', 'Driver city is not configured');
  END IF;

  IF NOT COALESCE(v_driver.is_active, false)
     OR NOT COALESCE(v_driver.is_online, false)
     OR COALESCE(v_driver.approval_status::TEXT, 'pending') <> 'approved' THEN
    RETURN jsonb_build_object('success', false, 'code', 'DRIVER_UNAVAILABLE', 'error', 'Driver is not available');
  END IF;

  SELECT * INTO v_job
  FROM public.delivery_jobs
  WHERE id = p_job_id
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'LOCKED', 'error', 'Delivery is currently being processed');
  END IF;

  IF v_job.city_id IS NULL OR v_job.city_id <> v_driver.city_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'CITY_MISMATCH', 'error', 'Delivery is outside the driver city');
  END IF;

  IF v_job.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATE', 'error', 'Delivery is no longer available');
  END IF;

  IF v_job.driver_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_CLAIMED', 'error', 'Delivery was already claimed');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.delivery_jobs
    WHERE driver_id = p_driver_id
      AND status IN ('assigned', 'accepted', 'picked_up', 'in_transit')
      AND id <> p_job_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'DRIVER_BUSY', 'error', 'Driver already has an active delivery');
  END IF;

  PERFORM set_config('app.delivery_claim_authorized', 'true', true);

  UPDATE public.delivery_jobs
  SET driver_id = p_driver_id,
      status = 'assigned',
      assigned_at = now(),
      assignment_attempted_at = now(),
      updated_at = now()
  WHERE id = p_job_id;

  UPDATE public.drivers
  SET current_job_id = p_job_id,
      updated_at = now()
  WHERE id = p_driver_id;

  INSERT INTO public.driver_assignment_history (
    job_id, driver_id, action, reason, performed_by, performed_at
  ) VALUES (
    p_job_id, p_driver_id, 'assigned', 'Driver self-claim', v_actor, now()
  );

  RETURN jsonb_build_object('success', true, 'job_id', p_job_id, 'driver_id', p_driver_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_delivery_job(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_delivery_job(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_delivery_details_for_driver(
  p_delivery_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT dj.* INTO v_job
  FROM public.delivery_jobs dj
  WHERE dj.id = p_delivery_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_JOB_NOT_FOUND';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.id = v_job.driver_id
        AND d.user_id = v_actor
        AND d.city_id = v_job.city_id
    )
    OR public.can_manage_fleet_city(v_job.city_id)
    OR public.has_role(v_actor, 'admin')
    OR COALESCE(auth.role(), '') = 'service_role'
  ) THEN
    RAISE EXCEPTION 'DELIVERY_JOB_ACCESS_DENIED';
  END IF;

  IF v_job.schedule_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'source', 'meal_schedule',
      'source_id', ms.id,
      'meal_name', COALESCE(m.name, 'Meal'),
      'meal_calories', COALESCE(m.calories, 0),
      'customer_name', COALESCE(p.full_name, 'Customer'),
      'customer_phone', ua.phone,
      'delivery_instructions', v_job.delivery_notes
    )
    INTO v_result
    FROM public.meal_schedules ms
    LEFT JOIN public.meals m ON m.id = ms.meal_id
    LEFT JOIN public.profiles p ON p.user_id = ms.user_id
    LEFT JOIN public.user_addresses ua ON ua.id = ms.delivery_address_id
    WHERE ms.id = v_job.schedule_id
      AND ms.city_id = v_job.city_id;
  ELSE
    SELECT jsonb_build_object(
      'source', 'order',
      'source_id', o.id,
      'meal_name', COALESCE(m.name, 'Order'),
      'meal_calories', COALESCE(m.calories, 0),
      'customer_name', COALESCE(p.full_name, 'Customer'),
      'customer_phone', o.phone_number,
      'delivery_instructions', COALESCE(
        o.special_instructions,
        o.notes,
        v_job.delivery_notes
      )
    )
    INTO v_result
    FROM public.orders o
    LEFT JOIN public.order_items oi ON oi.id = (
      SELECT oi2.id
      FROM public.order_items oi2
      WHERE oi2.order_id = o.id
      ORDER BY oi2.created_at, oi2.id
      LIMIT 1
    )
    LEFT JOIN public.meals m ON m.id = COALESCE(o.meal_id, oi.meal_id)
    LEFT JOIN public.profiles p ON p.user_id = o.user_id
    WHERE o.id = v_job.order_id
      AND o.city_id = v_job.city_id;
  END IF;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'DELIVERY_SOURCE_NOT_FOUND';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_delivery_details_for_driver(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_details_for_driver(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_delivery_job_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_is_fleet BOOLEAN := false;
  v_is_driver BOOLEAN := false;
  v_is_customer BOOLEAN := false;
  v_is_partner BOOLEAN := false;
  v_actor_role TEXT;
  v_status_changed BOOLEAN := false;
  v_driver_changed BOOLEAN := false;
  v_link_changed BOOLEAN := false;
  v_city_changed BOOLEAN := false;
  v_valid_transition BOOLEAN := false;
  v_driver_city_id UUID;
BEGIN
  v_is_service :=
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR COALESCE(auth.role(), '') = 'service_role'
    OR (v_actor IS NULL AND session_user IN ('postgres', 'supabase_admin'));

  IF TG_OP = 'INSERT' THEN
    v_status_changed := true;
    v_driver_changed := NEW.driver_id IS NOT NULL;
  ELSE
    v_status_changed := OLD.status IS DISTINCT FROM NEW.status;
    v_driver_changed := OLD.driver_id IS DISTINCT FROM NEW.driver_id;
    v_city_changed := OLD.city_id IS DISTINCT FROM NEW.city_id;
    v_link_changed := OLD.schedule_id IS DISTINCT FROM NEW.schedule_id
      OR OLD.order_id IS DISTINCT FROM NEW.order_id
      OR OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id;
  END IF;

  IF NEW.driver_id IS NOT NULL THEN
    SELECT d.city_id INTO v_driver_city_id
    FROM public.drivers d
    WHERE d.id = NEW.driver_id;

    IF v_driver_city_id IS NULL OR NEW.city_id IS NULL OR v_driver_city_id <> NEW.city_id THEN
      RAISE EXCEPTION 'CROSS_CITY_DRIVER_ASSIGNMENT';
    END IF;
  END IF;

  IF NOT v_status_changed
     AND NOT v_driver_changed
     AND NOT v_link_changed
     AND NOT v_city_changed THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NOT NULL THEN
    v_is_admin := public.has_role(v_actor, 'admin');
    v_is_fleet := NEW.city_id IS NOT NULL
      AND public.can_manage_fleet_city(NEW.city_id)
      AND (TG_OP = 'INSERT' OR public.can_manage_fleet_city(OLD.city_id));
    v_is_driver := EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = v_actor
        AND d.city_id = NEW.city_id
        AND d.id = COALESCE(NEW.driver_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.driver_id END)
    );
    v_is_customer := EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      WHERE ms.id = NEW.schedule_id
        AND ms.user_id = v_actor
    ) OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = NEW.order_id
        AND o.user_id = v_actor
    );
    v_is_partner := EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = NEW.restaurant_id
        AND public.is_restaurant_operator(r.id, v_actor)
    ) OR EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      JOIN public.meals m ON m.id = ms.meal_id
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE ms.id = NEW.schedule_id
        AND public.is_restaurant_operator(r.id, v_actor)
    ) OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = NEW.order_id
        AND o.restaurant_id IS NOT NULL
        AND public.is_restaurant_operator(o.restaurant_id, v_actor)
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN
      NEW.status := 'pending';
    END IF;

    IF NOT (
      v_is_service OR v_is_admin OR v_is_fleet
      OR ((v_is_customer OR v_is_partner)
        AND NEW.city_id IS NOT NULL
        AND NEW.status = 'pending'
        AND NEW.driver_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'You are not allowed to create this delivery job';
    END IF;

    v_actor_role := CASE
      WHEN v_is_service THEN 'system'
      WHEN v_is_admin THEN 'admin'
      WHEN v_is_fleet THEN 'fleet'
      WHEN v_is_partner THEN 'partner'
      ELSE 'customer'
    END;
  ELSE
    IF v_city_changed AND NOT (v_is_service OR v_is_admin) THEN
      RAISE EXCEPTION 'Only an administrator can change a delivery city';
    END IF;

    IF v_status_changed THEN
      v_valid_transition := CASE OLD.status
        WHEN 'pending' THEN NEW.status IN ('assigned', 'cancelled')
        WHEN 'assigned' THEN NEW.status IN ('accepted', 'pending', 'picked_up', 'failed', 'cancelled')
        WHEN 'accepted' THEN NEW.status IN ('picked_up', 'failed', 'cancelled')
        WHEN 'picked_up' THEN NEW.status IN ('in_transit', 'delivered', 'failed', 'cancelled')
        WHEN 'in_transit' THEN NEW.status IN ('delivered', 'failed', 'cancelled')
        WHEN 'delivered' THEN NEW.status = 'completed'
        ELSE false
      END;

      IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid delivery status transition from % to %', OLD.status, NEW.status;
      END IF;
    END IF;

    IF v_is_service THEN
      v_actor_role := 'system';
    ELSIF v_is_admin THEN
      v_actor_role := 'admin';
    ELSIF v_is_fleet THEN
      v_actor_role := 'fleet';
    ELSIF v_is_driver AND (
      (OLD.status = 'pending' AND NEW.status = 'assigned'
        AND COALESCE(current_setting('app.delivery_claim_authorized', true), '') = 'true')
      OR (OLD.status = 'assigned' AND NEW.status IN ('accepted', 'pending', 'picked_up', 'failed'))
      OR (OLD.status = 'accepted' AND NEW.status IN ('picked_up', 'failed'))
      OR (OLD.status = 'picked_up' AND NEW.status IN ('in_transit', 'delivered', 'failed'))
      OR (OLD.status = 'in_transit' AND NEW.status IN ('delivered', 'failed'))
    ) THEN
      v_actor_role := 'driver';
    ELSIF v_is_partner AND (
      (OLD.status IN ('pending', 'assigned', 'accepted') AND NEW.status = 'cancelled')
      OR (OLD.status IN ('assigned', 'accepted') AND NEW.status = 'picked_up')
    ) THEN
      v_actor_role := 'partner';
    ELSIF v_is_customer
      AND OLD.status IN ('pending', 'assigned')
      AND NEW.status = 'cancelled' THEN
      v_actor_role := 'customer';
    ELSE
      RAISE EXCEPTION 'You are not allowed to perform this delivery change';
    END IF;

    IF v_driver_changed AND NOT (
      v_is_service OR v_is_admin OR v_is_fleet
      OR (v_actor_role = 'driver' AND (
        (OLD.status = 'pending' AND NEW.status = 'assigned')
        OR (OLD.status = 'assigned' AND NEW.status = 'pending' AND NEW.driver_id IS NULL)
      ))
    ) THEN
      RAISE EXCEPTION 'Only fleet operators can reassign a delivery';
    END IF;

    IF v_link_changed AND NOT (v_is_service OR v_is_admin OR v_is_fleet) THEN
      RAISE EXCEPTION 'Only fleet operators can relink a delivery';
    END IF;
  END IF;

  IF NEW.status = 'assigned' THEN
    NEW.assigned_at := COALESCE(NEW.assigned_at, now());
  ELSIF NEW.status = 'accepted' THEN
    NEW.accepted_at := COALESCE(NEW.accepted_at, now());
  ELSIF NEW.status = 'picked_up' THEN
    NEW.picked_up_at := COALESCE(NEW.picked_up_at, now());
  ELSIF NEW.status = 'delivered' THEN
    NEW.delivered_at := COALESCE(NEW.delivered_at, now());
  ELSIF NEW.status = 'failed' THEN
    NEW.failed_at := COALESCE(NEW.failed_at, now());
  END IF;

  IF TG_OP = 'UPDATE' AND v_status_changed THEN
    INSERT INTO public.delivery_job_status_history (
      delivery_job_id, previous_status, new_status, changed_by, changed_by_role
    ) VALUES (
      NEW.id, OLD.status, NEW.status, v_actor, v_actor_role
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_validate_delivery_job_change ON public.delivery_jobs;
CREATE TRIGGER trigger_validate_delivery_job_change
  BEFORE INSERT OR UPDATE OF status, driver_id, schedule_id, order_id, restaurant_id, city_id
  ON public.delivery_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_delivery_job_change();

CREATE OR REPLACE FUNCTION public.create_driver_payout_for_operator(
  p_driver_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_request_key UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_details JSONB;
  v_city_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'FLEET_OPERATOR_REQUIRED';
  END IF;

  SELECT d.payout_details, d.city_id
  INTO v_details, v_city_id
  FROM public.drivers d
  WHERE d.id = p_driver_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND';
  END IF;

  IF v_city_id IS NULL THEN
    RAISE EXCEPTION 'DRIVER_CITY_REQUIRED';
  END IF;

  IF NOT public.can_manage_fleet_city(v_city_id) THEN
    RAISE EXCEPTION 'FLEET_CITY_ACCESS_DENIED';
  END IF;

  IF v_details IS NULL THEN
    RAISE EXCEPTION 'DRIVER_BANK_DETAILS_REQUIRED';
  END IF;

  RETURN public.reserve_driver_payout(
    p_driver_id,
    p_request_key,
    p_period_start,
    p_period_end,
    v_details,
    v_actor
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transition_driver_payout(
  p_payout_id UUID,
  p_action TEXT,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_payout public.driver_payouts%ROWTYPE;
  v_new_status TEXT;
  v_balance NUMERIC(10, 2);
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'FLEET_OPERATOR_REQUIRED';
  END IF;

  SELECT * INTO v_payout
  FROM public.driver_payouts
  WHERE id = p_payout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYOUT_NOT_FOUND';
  END IF;

  IF v_payout.city_id IS NULL
     OR NOT public.can_manage_fleet_city(v_payout.city_id) THEN
    RAISE EXCEPTION 'FLEET_CITY_ACCESS_DENIED';
  END IF;

  v_new_status := CASE p_action
    WHEN 'start' THEN 'processing'
    WHEN 'pay' THEN 'paid'
    WHEN 'reject' THEN 'failed'
    ELSE NULL
  END;

  IF v_new_status IS NULL
    OR (p_action = 'start' AND v_payout.status <> 'pending')
    OR (p_action IN ('pay', 'reject') AND v_payout.status NOT IN ('pending', 'processing')) THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_TRANSITION';
  END IF;

  IF p_action = 'pay' AND length(trim(COALESCE(p_payment_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'PAYMENT_REFERENCE_REQUIRED';
  END IF;

  UPDATE public.driver_payouts
  SET status = v_new_status,
      payment_reference = CASE WHEN p_action = 'pay' THEN trim(p_payment_reference) ELSE payment_reference END,
      rejection_reason = CASE WHEN p_action = 'reject' THEN NULLIF(trim(p_notes), '') ELSE NULL END,
      processed_at = CASE WHEN p_action IN ('pay', 'reject') THEN now() ELSE processed_at END,
      processed_by = v_actor,
      updated_at = now()
  WHERE id = v_payout.id;

  IF p_action = 'reject' THEN
    PERFORM 1 FROM public.drivers WHERE id = v_payout.driver_id FOR UPDATE;
    PERFORM set_config('app.driver_finance_authorized', 'true', true);

    UPDATE public.drivers
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_payout.amount,
        updated_at = now()
    WHERE id = v_payout.driver_id
    RETURNING wallet_balance INTO v_balance;

    INSERT INTO public.driver_wallet_transactions (
      driver_id, type, amount, balance_after, reference_type,
      reference_id, description
    ) VALUES (
      v_payout.driver_id, 'adjustment', v_payout.amount, v_balance,
      'withdrawal', v_payout.id,
      'Rejected payout returned to driver balance'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', v_payout.id,
    'status', v_new_status,
    'amount', v_payout.amount
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_driver_payout_for_operator(UUID, DATE, DATE, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_driver_payout(UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_driver_payout_for_operator(UUID, DATE, DATE, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_driver_payout(UUID, TEXT, TEXT, TEXT)
  TO authenticated;

-- Replace global fleet visibility with city-bound policies.
DROP POLICY IF EXISTS "Fleet operators can view dispatch orders" ON public.orders;
CREATE POLICY "Fleet operators can view scoped dispatch orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.can_manage_fleet_city(city_id));

DROP POLICY IF EXISTS "Fleet operators can view dispatch schedules" ON public.meal_schedules;
CREATE POLICY "Fleet operators can view scoped dispatch schedules"
  ON public.meal_schedules FOR SELECT TO authenticated
  USING (public.can_manage_fleet_city(city_id));

DROP POLICY IF EXISTS "Fleet operators can view dispatch customer profiles" ON public.profiles;
CREATE POLICY "Fleet operators can view scoped dispatch customer profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.user_id = profiles.user_id
        AND o.status IN ('preparing', 'ready_for_pickup')
        AND public.can_manage_fleet_city(o.city_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      WHERE ms.user_id = profiles.user_id
        AND ms.order_status IN ('preparing', 'ready')
        AND COALESCE(ms.delivery_type, 'delivery') <> 'pickup'
        AND public.can_manage_fleet_city(ms.city_id)
    )
  );

DROP POLICY IF EXISTS "Fleet operators can view dispatch addresses" ON public.user_addresses;
CREATE POLICY "Fleet operators can view scoped dispatch addresses"
  ON public.user_addresses FOR SELECT TO authenticated
  USING (
    public.can_manage_fleet_city(public.resolve_city_id(user_addresses.city))
    AND (
      EXISTS (
        SELECT 1
        FROM public.meal_schedules ms
        WHERE ms.delivery_address_id = user_addresses.id
          AND ms.user_id = user_addresses.user_id
          AND ms.order_status IN ('preparing', 'ready')
          AND COALESCE(ms.delivery_type, 'delivery') <> 'pickup'
          AND ms.city_id = public.resolve_city_id(user_addresses.city)
      )
      OR (
        COALESCE(user_addresses.is_default, false)
        AND EXISTS (
          SELECT 1
          FROM public.orders o
          WHERE o.user_id = user_addresses.user_id
            AND o.status IN ('preparing', 'ready_for_pickup')
            AND o.city_id = public.resolve_city_id(user_addresses.city)
        )
      )
    )
  );

DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'delivery_jobs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.delivery_jobs', v_policy.policyname);
  END LOOP;
END;
$do$;

CREATE POLICY "Authorized users can view city-scoped delivery jobs"
  ON public.delivery_jobs FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.can_manage_fleet_city(city_id)
    OR EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = (SELECT auth.uid())
        AND d.city_id = delivery_jobs.city_id
        AND (
          d.id = delivery_jobs.driver_id
          OR (
            delivery_jobs.status = 'pending'
            AND delivery_jobs.driver_id IS NULL
            AND d.is_active = true
            AND d.is_online = true
            AND d.approval_status::TEXT = 'approved'
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_jobs.order_id
        AND o.user_id = (SELECT auth.uid())
    )
    OR (
      delivery_jobs.restaurant_id IS NOT NULL
      AND public.is_restaurant_operator(delivery_jobs.restaurant_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Authorized users can create city-scoped delivery jobs"
  ON public.delivery_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.can_manage_fleet_city(city_id)
    OR (
      delivery_jobs.restaurant_id IS NOT NULL
      AND public.is_restaurant_operator(delivery_jobs.restaurant_id, (SELECT auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_jobs.order_id
        AND o.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Authorized users can update city-scoped delivery jobs"
  ON public.delivery_jobs FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.can_manage_fleet_city(city_id)
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = (SELECT auth.uid())
        AND d.city_id = delivery_jobs.city_id
        AND (
          d.id = delivery_jobs.driver_id
          OR (delivery_jobs.status = 'pending' AND delivery_jobs.driver_id IS NULL)
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_jobs.order_id
        AND o.user_id = (SELECT auth.uid())
    )
    OR (
      delivery_jobs.restaurant_id IS NOT NULL
      AND public.is_restaurant_operator(delivery_jobs.restaurant_id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.can_manage_fleet_city(city_id)
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = (SELECT auth.uid())
        AND d.city_id = delivery_jobs.city_id
        AND (
          d.id = delivery_jobs.driver_id
          OR (delivery_jobs.status = 'pending' AND delivery_jobs.driver_id IS NULL)
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_jobs.order_id
        AND o.user_id = (SELECT auth.uid())
    )
    OR (
      delivery_jobs.restaurant_id IS NOT NULL
      AND public.is_restaurant_operator(delivery_jobs.restaurant_id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Admins can delete delivery jobs"
  ON public.delivery_jobs FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS "Authorized users can view delivery job history"
  ON public.delivery_job_status_history;
CREATE POLICY "Authorized users can view city-scoped delivery job history"
  ON public.delivery_job_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.delivery_jobs dj
      LEFT JOIN public.meal_schedules ms ON ms.id = dj.schedule_id
      LEFT JOIN public.orders o ON o.id = dj.order_id
      LEFT JOIN public.drivers d ON d.id = dj.driver_id
      WHERE dj.id = delivery_job_status_history.delivery_job_id
        AND (
          public.has_role((SELECT auth.uid()), 'admin')
          OR public.can_manage_fleet_city(dj.city_id)
          OR d.user_id = (SELECT auth.uid())
          OR ms.user_id = (SELECT auth.uid())
          OR o.user_id = (SELECT auth.uid())
          OR (
            dj.restaurant_id IS NOT NULL
            AND public.is_restaurant_operator(dj.restaurant_id, (SELECT auth.uid()))
          )
        )
    )
  );

DROP POLICY IF EXISTS "Authorized users can view driver payouts" ON public.driver_payouts;
CREATE POLICY "Authorized users can view city-scoped driver payouts"
  ON public.driver_payouts FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.can_manage_fleet_city(city_id)
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_payouts.driver_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authorized users can view legacy driver withdrawals"
  ON public.driver_withdrawals;
CREATE POLICY "Authorized users can view scoped legacy driver withdrawals"
  ON public.driver_withdrawals FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_withdrawals.driver_id
        AND (
          d.user_id = (SELECT auth.uid())
          OR public.can_manage_fleet_city(d.city_id)
        )
    )
  );

CREATE OR REPLACE FUNCTION public.fleet_record_mfa_verification()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_headers JSONB := '{}'::JSONB;
  v_ip INET;
  v_event_id UUID;
  v_actor_role TEXT;
BEGIN
  IF v_actor IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'FLEET_AAL2_REQUIRED';
  END IF;

  IF public.has_role(v_actor, 'admin'::public.app_role) THEN
    v_actor_role := 'admin';
  ELSIF EXISTS (
    SELECT 1
    FROM public.fleet_managers fm
    WHERE fm.auth_user_id = v_actor
      AND fm.is_active = true
      AND fm.role = 'super_admin'
  ) THEN
    v_actor_role := 'fleet_super_admin';
  ELSE
    RAISE EXCEPTION 'FLEET_SUPER_ADMIN_REQUIRED';
  END IF;

  BEGIN
    v_headers := COALESCE(
      NULLIF(current_setting('request.headers', true), '')::JSONB,
      '{}'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::JSONB;
  END;

  BEGIN
    v_ip := NULLIF(trim(split_part(COALESCE(
      v_headers ->> 'cf-connecting-ip',
      v_headers ->> 'x-forwarded-for',
      ''
    ), ',', 1)), '')::INET;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ip := NULL;
  END;

  INSERT INTO security.event_ledger (
    event_type, category, severity, source, outcome, actor_user_id,
    actor_role, actor_type, action, resource_type, resource_id, request_id,
    ip_address, country_code, user_agent, metadata, event_hash
  ) VALUES (
    'authentication.fleet_mfa_verified',
    'authentication',
    'medium',
    'auth',
    'success',
    v_actor,
    v_actor_role,
    'admin',
    'step_up_authentication',
    'auth.session',
    v_actor::TEXT,
    COALESCE(v_headers ->> 'x-request-id', v_headers ->> 'sb-request-id'),
    v_ip,
    v_headers ->> 'cf-ipcountry',
    v_headers ->> 'user-agent',
    jsonb_build_object('aal', 'aal2', 'portal', 'fleet'),
    repeat('0', 64)
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.fleet_record_mfa_verification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fleet_record_mfa_verification() TO authenticated;

-- Surface unresolved legacy records in the immutable forensic ledger instead
-- of guessing a city and silently widening access.
DO $do$
DECLARE
  v_schedules BIGINT;
  v_orders BIGINT;
  v_jobs BIGINT;
  v_payouts BIGINT;
BEGIN
  SELECT count(*) INTO v_schedules
  FROM public.meal_schedules
  WHERE city_id IS NULL
    AND COALESCE(delivery_type, 'delivery') <> 'pickup';

  SELECT count(*) INTO v_orders
  FROM public.orders
  WHERE city_id IS NULL
    AND status NOT IN ('completed', 'cancelled');

  SELECT count(*) INTO v_jobs
  FROM public.delivery_jobs
  WHERE city_id IS NULL
    AND status NOT IN ('completed', 'cancelled', 'failed');

  SELECT count(*) INTO v_payouts
  FROM public.driver_payouts
  WHERE city_id IS NULL
    AND status IN ('pending', 'processing');

  IF v_schedules + v_orders + v_jobs + v_payouts > 0 THEN
    INSERT INTO security.event_ledger (
      event_type, category, severity, source, outcome, actor_type, action,
      resource_type, metadata, event_hash
    ) VALUES (
      'authorization.fleet_city_backfill_incomplete',
      'authorization',
      'high',
      'database',
      'blocked',
      'system',
      'fleet_city_backfill',
      'fleet.operations',
      jsonb_build_object(
        'unresolved_delivery_schedules', v_schedules,
        'unresolved_active_orders', v_orders,
        'unresolved_active_jobs', v_jobs,
        'unresolved_open_payouts', v_payouts,
        'fleet_access', 'denied_until_resolved'
      ),
      repeat('0', 64)
    );
  END IF;
END;
$do$;

COMMENT ON COLUMN public.delivery_jobs.city_id IS
  'Immutable fleet authorization boundary derived from the linked order or schedule.';
COMMENT ON COLUMN public.driver_payouts.city_id IS
  'Fleet authorization boundary copied from the driver city at payout creation.';
COMMENT ON FUNCTION public.can_manage_fleet_city(UUID) IS
  'Caller-scoped fleet authorization; super_admin access requires aal2 and managers are limited to assigned cities.';

COMMIT;
