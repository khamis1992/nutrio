-- Canonical, authenticated lifecycle for subscription orders and delivery jobs.

BEGIN;

-- Stop legacy triggers while existing rows are normalized.
DROP TRIGGER IF EXISTS on_delivery_job_status_change ON public.delivery_jobs;
DROP TRIGGER IF EXISTS validate_delivery_status_transition ON public.delivery_jobs;
DROP TRIGGER IF EXISTS trigger_validate_delivery_job_change ON public.delivery_jobs;

UPDATE public.meal_schedules
SET order_status = CASE order_status
  WHEN 'ready_for_pickup' THEN 'ready'
  WHEN 'claimed' THEN 'ready'
  WHEN 'assigned' THEN 'ready'
  WHEN 'accepted' THEN 'ready'
  WHEN 'picked_up' THEN 'out_for_delivery'
  WHEN 'on_the_way' THEN 'out_for_delivery'
  WHEN 'in_transit' THEN 'out_for_delivery'
  ELSE order_status
END
WHERE order_status IN (
  'ready_for_pickup', 'claimed', 'assigned', 'accepted',
  'picked_up', 'on_the_way', 'in_transit'
);

UPDATE public.delivery_jobs
SET status = CASE status
  WHEN 'claimed' THEN 'assigned'
  WHEN 'on_the_way' THEN 'in_transit'
  WHEN 'ready_for_pickup' THEN 'pending'
  WHEN 'scheduled' THEN 'pending'
  ELSE COALESCE(status, 'pending')
END
WHERE status IS NULL
   OR status IN ('claimed', 'on_the_way', 'ready_for_pickup', 'scheduled');

ALTER TABLE public.meal_schedules
  DROP CONSTRAINT IF EXISTS valid_order_status;
ALTER TABLE public.meal_schedules
  ADD CONSTRAINT valid_order_status CHECK (order_status IN (
    'pending', 'confirmed', 'preparing', 'ready',
    'out_for_delivery', 'delivered', 'completed', 'cancelled'
  )) NOT VALID;
ALTER TABLE public.meal_schedules VALIDATE CONSTRAINT valid_order_status;

ALTER TABLE public.delivery_jobs
  DROP CONSTRAINT IF EXISTS valid_delivery_job_status;
ALTER TABLE public.delivery_jobs
  ADD CONSTRAINT valid_delivery_job_status CHECK (status IN (
    'pending', 'assigned', 'accepted', 'picked_up', 'in_transit',
    'delivered', 'completed', 'failed', 'cancelled'
  )) NOT VALID;
ALTER TABLE public.delivery_jobs VALIDATE CONSTRAINT valid_delivery_job_status;
ALTER TABLE public.delivery_jobs ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_delivery_jobs_active_driver
  ON public.delivery_jobs (driver_id, status)
  WHERE status IN ('assigned', 'accepted', 'picked_up', 'in_transit');

CREATE INDEX IF NOT EXISTS idx_delivery_jobs_available
  ON public.delivery_jobs (created_at, id)
  WHERE status = 'pending' AND driver_id IS NULL;

CREATE OR REPLACE FUNCTION public.is_active_fleet_operator(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.fleet_managers fm
    WHERE fm.auth_user_id = p_user_id
      AND fm.is_active = true
      AND fm.role IN ('super_admin', 'fleet_manager')
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_fleet_operator(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_fleet_operator(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_restaurant_operator(
  p_restaurant_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.restaurants r
    WHERE r.id = p_restaurant_id
      AND (
        r.owner_id = p_user_id
        OR EXISTS (
          SELECT 1
          FROM public.restaurant_staff rs
          WHERE rs.restaurant_id = r.id
            AND rs.user_id = p_user_id
            AND rs.is_active = true
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_restaurant_operator(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_restaurant_operator(UUID, UUID) TO authenticated;

-- Keep delivery audit records separate from meal order history.
CREATE TABLE IF NOT EXISTS public.delivery_job_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_job_id UUID NOT NULL REFERENCES public.delivery_jobs(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role TEXT NOT NULL CHECK (
    changed_by_role IN ('customer', 'partner', 'driver', 'fleet', 'admin', 'system')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_job_status_history_job_created
  ON public.delivery_job_status_history (delivery_job_id, created_at DESC);

ALTER TABLE public.delivery_job_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized users can view delivery job history"
  ON public.delivery_job_status_history;
CREATE POLICY "Authorized users can view delivery job history"
  ON public.delivery_job_status_history
  FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_active_fleet_operator((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs dj
      JOIN public.meal_schedules ms ON ms.id = dj.schedule_id
      WHERE dj.id = delivery_job_status_history.delivery_job_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs dj
      JOIN public.drivers d ON d.id = dj.driver_id
      WHERE dj.id = delivery_job_status_history.delivery_job_id
        AND d.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs dj
      JOIN public.restaurants r ON r.id = dj.restaurant_id
      WHERE dj.id = delivery_job_status_history.delivery_job_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
  );

GRANT SELECT ON public.delivery_job_status_history TO authenticated;

CREATE OR REPLACE FUNCTION public.get_valid_next_statuses(current_status VARCHAR)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE current_status
    WHEN 'pending' THEN ARRAY['confirmed', 'cancelled']::TEXT[]
    WHEN 'confirmed' THEN ARRAY['preparing', 'cancelled']::TEXT[]
    WHEN 'preparing' THEN ARRAY['ready', 'cancelled']::TEXT[]
    WHEN 'ready' THEN ARRAY['out_for_delivery', 'cancelled']::TEXT[]
    WHEN 'out_for_delivery' THEN ARRAY['delivered']::TEXT[]
    WHEN 'delivered' THEN ARRAY['completed']::TEXT[]
    ELSE ARRAY[]::TEXT[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
  IF OLD.order_status IS NOT DISTINCT FROM NEW.order_status THEN
    RETURN NEW;
  END IF;

  IF NOT NEW.order_status = ANY(public.get_valid_next_statuses(OLD.order_status)) THEN
    RAISE EXCEPTION 'Invalid order status transition from % to %',
      OLD.order_status, NEW.order_status;
  END IF;

  v_actor_role := NULLIF(current_setting('app.current_user_role', true), '');
  IF v_actor_role IS NULL THEN
    IF COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
       OR (v_actor IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN
      v_actor_role := 'system';
    ELSIF public.has_role(v_actor, 'admin') THEN
      v_actor_role := 'admin';
    ELSIF EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = v_actor
    ) THEN
      v_actor_role := 'driver';
    ELSIF EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE public.is_restaurant_operator(r.id, v_actor)
    ) THEN
      v_actor_role := 'partner';
    ELSE
      v_actor_role := 'customer';
    END IF;
  END IF;

  INSERT INTO public.order_status_history (
    order_id, previous_status, new_status, changed_by, changed_by_role, changed_at
  ) VALUES (
    NEW.id, OLD.order_status, NEW.order_status, v_actor, v_actor_role, now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_validate_status_transition ON public.meal_schedules;
CREATE TRIGGER trigger_validate_status_transition
  BEFORE UPDATE OF order_status ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_status_transition();

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_new_status VARCHAR,
  p_user_role VARCHAR DEFAULT 'system'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.meal_schedules%ROWTYPE;
  v_actor UUID := auth.uid();
  v_actor_role TEXT;
  v_is_service BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_is_customer BOOLEAN := false;
  v_is_partner BOOLEAN := false;
  v_is_driver BOOLEAN := false;
BEGIN
  SELECT * INTO v_order
  FROM public.meal_schedules
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT p_new_status = ANY(public.get_valid_next_statuses(v_order.order_status)) THEN
    RAISE EXCEPTION 'Invalid order status transition from % to %',
      v_order.order_status, p_new_status;
  END IF;

  v_is_service :=
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR (v_actor IS NULL AND session_user IN ('postgres', 'supabase_admin'));

  IF NOT v_is_service AND v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_actor IS NOT NULL THEN
    v_is_admin := public.has_role(v_actor, 'admin');
    v_is_customer := v_order.user_id = v_actor;
    v_is_partner := EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE public.is_restaurant_operator(r.id, v_actor)
        AND r.id = v_order.restaurant_id
    ) OR EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = v_order.meal_id
        AND public.is_restaurant_operator(r.id, v_actor)
    );
    v_is_driver := EXISTS (
      SELECT 1
      FROM public.delivery_jobs dj
      JOIN public.drivers d ON d.id = dj.driver_id
      WHERE dj.schedule_id = v_order.id
        AND d.user_id = v_actor
    );
  END IF;

  IF v_is_service THEN
    v_actor_role := 'system';
  ELSIF v_is_admin THEN
    v_actor_role := 'admin';
  ELSIF v_is_customer AND (
    (v_order.order_status = 'pending' AND p_new_status = 'cancelled')
    OR (v_order.order_status = 'delivered' AND p_new_status = 'completed')
  ) THEN
    v_actor_role := 'customer';
  ELSIF v_is_partner AND (
    (v_order.order_status = 'pending' AND p_new_status = 'confirmed')
    OR (v_order.order_status = 'confirmed' AND p_new_status = 'preparing')
    OR (v_order.order_status = 'preparing' AND p_new_status = 'ready')
    OR (v_order.order_status IN ('pending', 'confirmed', 'preparing')
        AND p_new_status = 'cancelled')
  ) THEN
    v_actor_role := 'partner';
  ELSIF v_is_driver AND (
    (v_order.order_status = 'ready' AND p_new_status = 'out_for_delivery')
    OR (v_order.order_status = 'out_for_delivery' AND p_new_status = 'delivered')
  ) THEN
    v_actor_role := 'driver';
  ELSE
    RAISE EXCEPTION 'You are not allowed to perform this order status change';
  END IF;

  PERFORM set_config('app.current_user_role', v_actor_role, true);

  UPDATE public.meal_schedules
  SET order_status = p_new_status,
      updated_at = now()
  WHERE id = p_order_id;

  IF p_new_status = 'completed' THEN
    PERFORM public.award_xp(
      v_order.user_id,
      20,
      'Order completed',
      'order_completed',
      p_order_id::TEXT,
      jsonb_build_object('order_id', p_order_id, 'status', p_new_status)
    );
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(UUID, VARCHAR, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, VARCHAR, VARCHAR) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_delivery_job(
  p_job_id UUID,
  p_driver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.claim_delivery_job(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_delivery_job(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_delivery_job_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_valid_transition BOOLEAN := false;
BEGIN
  v_is_service :=
    COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role'
    OR (v_actor IS NULL AND session_user IN ('postgres', 'supabase_admin'));

  IF TG_OP = 'INSERT' THEN
    v_status_changed := true;
    v_driver_changed := NEW.driver_id IS NOT NULL;
  ELSE
    v_status_changed := OLD.status IS DISTINCT FROM NEW.status;
    v_driver_changed := OLD.driver_id IS DISTINCT FROM NEW.driver_id;
    v_link_changed := OLD.schedule_id IS DISTINCT FROM NEW.schedule_id
      OR OLD.restaurant_id IS DISTINCT FROM NEW.restaurant_id;
  END IF;

  IF NOT v_status_changed AND NOT v_driver_changed AND NOT v_link_changed THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NOT NULL THEN
    v_is_admin := public.has_role(v_actor, 'admin');
    v_is_fleet := public.is_active_fleet_operator(v_actor);
    v_is_driver := EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = v_actor
        AND d.id = COALESCE(NEW.driver_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.driver_id END)
    );
    v_is_customer := EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      WHERE ms.id = NEW.schedule_id
        AND ms.user_id = v_actor
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
    );
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NULL THEN
      NEW.status := 'pending';
    END IF;

    IF NOT (
      v_is_service OR v_is_admin OR v_is_fleet
      OR ((v_is_customer OR v_is_partner) AND NEW.status = 'pending' AND NEW.driver_id IS NULL)
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
$$;

CREATE TRIGGER trigger_validate_delivery_job_change
  BEFORE INSERT OR UPDATE OF status, driver_id, schedule_id, restaurant_id
  ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_delivery_job_change();

CREATE OR REPLACE FUNCTION public.sync_delivery_status_to_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_status TEXT;
  v_target_status TEXT;
  v_role TEXT := 'system';
BEGIN
  IF NEW.schedule_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_target_status := CASE NEW.status
    WHEN 'picked_up' THEN 'out_for_delivery'
    WHEN 'in_transit' THEN 'out_for_delivery'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'completed' THEN 'completed'
    ELSE NULL
  END;

  IF v_target_status IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT order_status INTO v_schedule_status
  FROM public.meal_schedules
  WHERE id = NEW.schedule_id
  FOR UPDATE;

  IF NOT FOUND OR v_schedule_status = v_target_status THEN
    RETURN NEW;
  END IF;

  IF NOT v_target_status = ANY(public.get_valid_next_statuses(v_schedule_status)) THEN
    RAISE EXCEPTION 'Delivery status % cannot move order % from % to %',
      NEW.status, NEW.schedule_id, v_schedule_status, v_target_status;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.id = NEW.driver_id AND d.user_id = auth.uid()
  ) THEN
    v_role := 'driver';
  END IF;

  PERFORM set_config('app.current_user_role', v_role, true);

  UPDATE public.meal_schedules
  SET order_status = v_target_status,
      updated_at = now()
  WHERE id = NEW.schedule_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_delivery_job_status_change
  AFTER INSERT OR UPDATE OF status ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_delivery_status_to_schedule();

CREATE OR REPLACE FUNCTION public.sync_driver_current_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.driver_id IS DISTINCT FROM NEW.driver_id AND OLD.driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET current_job_id = NULL,
        updated_at = now()
    WHERE id = OLD.driver_id
      AND current_job_id = OLD.id;
  END IF;

  IF NEW.driver_id IS NOT NULL
     AND NEW.status IN ('assigned', 'accepted', 'picked_up', 'in_transit') THEN
    UPDATE public.drivers
    SET current_job_id = NEW.id,
        updated_at = now()
    WHERE id = NEW.driver_id;
  ELSIF NEW.driver_id IS NOT NULL
        AND NEW.status IN ('delivered', 'completed', 'failed', 'cancelled') THEN
    UPDATE public.drivers
    SET current_job_id = NULL,
        updated_at = now()
    WHERE id = NEW.driver_id
      AND current_job_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_driver_current_job ON public.delivery_jobs;
CREATE TRIGGER trigger_sync_driver_current_job
  AFTER UPDATE OF status, driver_id ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_driver_current_job();

-- Replace permissive or stale delivery policies with one complete policy set.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'delivery_jobs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.delivery_jobs', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.delivery_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view delivery jobs"
  ON public.delivery_jobs FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_active_fleet_operator((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = (SELECT auth.uid())
        AND (d.id = delivery_jobs.driver_id OR (
          delivery_jobs.status = 'pending' AND delivery_jobs.driver_id IS NULL
          AND d.is_active = true AND d.is_online = true
          AND d.approval_status::TEXT = 'approved'
        ))
    )
    OR EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = delivery_jobs.restaurant_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Fleet and partners can create delivery jobs"
  ON public.delivery_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_active_fleet_operator((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = delivery_jobs.restaurant_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Authorized users can update delivery jobs"
  ON public.delivery_jobs FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_active_fleet_operator((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = (SELECT auth.uid())
        AND (d.id = delivery_jobs.driver_id
          OR (delivery_jobs.status = 'pending' AND delivery_jobs.driver_id IS NULL))
    )
    OR EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = delivery_jobs.restaurant_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_active_fleet_operator((SELECT auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.user_id = (SELECT auth.uid())
        AND (d.id = delivery_jobs.driver_id
          OR (delivery_jobs.status = 'pending' AND delivery_jobs.driver_id IS NULL))
    )
    OR EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.id = delivery_jobs.schedule_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = delivery_jobs.restaurant_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Admins can delete delivery jobs"
  ON public.delivery_jobs FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Drop every stale UPDATE policy, then restore the three intended owners.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meal_schedules'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.meal_schedules', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "Customers can update own schedules"
  ON public.meal_schedules FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Partners can update restaurant schedules"
  ON public.meal_schedules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_schedules.meal_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_schedules.meal_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
  );

CREATE POLICY "Admins can update schedules"
  ON public.meal_schedules FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Column privileges make order_status immutable to direct PostgREST updates.
DO $$
DECLARE
  v_columns TEXT;
BEGIN
  REVOKE UPDATE ON public.meal_schedules FROM authenticated, anon;

  SELECT string_agg(format('%I', column_name), ', ' ORDER BY ordinal_position)
  INTO v_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'meal_schedules'
    AND column_name <> 'order_status';

  IF v_columns IS NOT NULL THEN
    EXECUTE 'GRANT UPDATE (' || v_columns || ') ON public.meal_schedules TO authenticated';
  END IF;
END $$;

DROP POLICY IF EXISTS "Anyone can view order status history"
  ON public.order_status_history;
DROP POLICY IF EXISTS "Users can view their own order history"
  ON public.order_status_history;
DROP POLICY IF EXISTS "Authorized users can view order status history"
  ON public.order_status_history;

CREATE POLICY "Authorized users can view order status history"
  ON public.order_status_history FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      WHERE ms.id = order_status_history.order_id
        AND ms.user_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      JOIN public.meals m ON m.id = ms.meal_id
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE ms.id = order_status_history.order_id
        AND public.is_restaurant_operator(r.id, (SELECT auth.uid()))
    )
    OR EXISTS (
      SELECT 1
      FROM public.meal_schedules ms
      JOIN public.delivery_jobs dj ON dj.schedule_id = ms.id
      JOIN public.drivers d ON d.id = dj.driver_id
      WHERE ms.id = order_status_history.order_id
        AND d.user_id = (SELECT auth.uid())
    )
  );

GRANT SELECT ON public.order_status_history TO authenticated;

COMMIT;
