-- Close remaining caller-controlled financial and entitlement paths.

-- Seeded recovery venues were illustrative data, not verified partners. Keep
-- their records for admin review but never expose them as launch inventory.
UPDATE public.recovery_partners
SET is_active = FALSE
WHERE name IN (
  'Serenity Spa & Wellness',
  'CryoQatar Recovery Center',
  'Zen Float Therapy',
  'Doha Sports Massage',
  'The Healing Room',
  'IceMan Cryotherapy & Recovery'
);

INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'recovery_credits',
  '{"enabled": false, "monthly_credits": 0}'::JSONB,
  'Recovery partner entitlement. Enable only after verified partners are onboarded.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- The original tables referenced profiles.id even though every caller and RLS
-- policy uses auth.uid(). Preserve valid rows by translating them once, then
-- make auth.users the canonical identity.
UPDATE public.member_recovery_credits target
SET total_credits = GREATEST(target.total_credits, legacy.total_credits),
    used_credits = GREATEST(target.used_credits, legacy.used_credits),
    period_end = GREATEST(target.period_end, legacy.period_end)
FROM public.member_recovery_credits legacy
JOIN public.profiles p ON p.id = legacy.user_id
WHERE p.user_id IS NOT NULL
  AND target.user_id = p.user_id
  AND target.period_start = legacy.period_start
  AND target.id <> legacy.id;

DELETE FROM public.member_recovery_credits legacy
USING public.profiles p
WHERE legacy.user_id = p.id
  AND p.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.member_recovery_credits target
    WHERE target.user_id = p.user_id
      AND target.period_start = legacy.period_start
      AND target.id <> legacy.id
  );

UPDATE public.member_recovery_credits mrc
SET user_id = p.user_id
FROM public.profiles p
WHERE mrc.user_id = p.id
  AND p.user_id IS NOT NULL
  AND mrc.user_id IS DISTINCT FROM p.user_id;

UPDATE public.recovery_bookings rb
SET user_id = p.user_id
FROM public.profiles p
WHERE rb.user_id = p.id
  AND p.user_id IS NOT NULL
  AND rb.user_id IS DISTINCT FROM p.user_id;

DELETE FROM public.recovery_bookings rb
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = rb.user_id);

DELETE FROM public.member_recovery_credits mrc
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = mrc.user_id);

ALTER TABLE public.member_recovery_credits
  DROP CONSTRAINT IF EXISTS member_recovery_credits_user_id_fkey,
  ADD CONSTRAINT member_recovery_credits_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.recovery_bookings
  DROP CONSTRAINT IF EXISTS recovery_bookings_user_id_fkey,
  ADD CONSTRAINT recovery_bookings_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Wallet creation is server-owned so a customer cannot choose an opening
-- balance while creating their own wallet row.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customer_wallets'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.customer_wallets',
      v_policy.policyname
    );
  END LOOP;
END;
$$;

CREATE POLICY customer_wallet_owner_read
  ON public.customer_wallets
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY customer_wallet_admin_read
  ON public.customer_wallets
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

REVOKE ALL ON public.customer_wallets FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.customer_wallets FROM authenticated;
GRANT SELECT ON public.customer_wallets TO authenticated;
GRANT ALL ON public.customer_wallets TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM anon, authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_customer_wallet()
RETURNS public.customer_wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_wallet public.customer_wallets%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('wallet:' || v_actor::TEXT, 0));

  SELECT *
    INTO v_wallet
  FROM public.customer_wallets cw
  WHERE cw.user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.customer_wallets (
      user_id,
      balance,
      total_credits,
      total_debits,
      is_active
    ) VALUES (
      v_actor,
      0,
      0,
      0,
      TRUE
    )
    RETURNING * INTO v_wallet;
  END IF;

  RETURN v_wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_customer_wallet()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_customer_wallet()
  TO authenticated, service_role;

-- Delivery jobs support two explicit sources: subscription schedules and
-- one-time orders. A UUID can never be treated as both table types.
ALTER TABLE public.delivery_jobs
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.delivery_jobs
  ALTER COLUMN schedule_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_jobs_order_id
  ON public.delivery_jobs(order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.delivery_jobs
  DROP CONSTRAINT IF EXISTS delivery_jobs_exactly_one_source;
ALTER TABLE public.delivery_jobs
  ADD CONSTRAINT delivery_jobs_exactly_one_source
  CHECK (num_nonnulls(schedule_id, order_id) = 1) NOT VALID;
ALTER TABLE public.delivery_jobs
  VALIDATE CONSTRAINT delivery_jobs_exactly_one_source;

CREATE OR REPLACE FUNCTION public.validate_delivery_job_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin');
  v_is_fleet BOOLEAN := public.is_active_fleet_operator(v_actor);
  v_is_admin BOOLEAN := public.has_role(v_actor, 'admin');
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

  IF TG_OP = 'INSERT' AND NEW.order_id IS NOT NULL
    AND NOT (v_is_service OR v_is_admin OR v_is_fleet) THEN
    RAISE EXCEPTION 'ONLY_FLEET_CAN_CREATE_ORDER_DELIVERY';
  END IF;

  IF TG_OP = 'UPDATE'
    AND (
      NEW.order_id IS DISTINCT FROM OLD.order_id
      OR NEW.schedule_id IS DISTINCT FROM OLD.schedule_id
    )
    AND NOT (v_is_service OR v_is_admin OR v_is_fleet) THEN
    RAISE EXCEPTION 'ONLY_FLEET_CAN_RELINK_DELIVERY';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_00_validate_delivery_job_source
  ON public.delivery_jobs;
CREATE TRIGGER trigger_00_validate_delivery_job_source
  BEFORE INSERT OR UPDATE OF order_id, schedule_id, restaurant_id
  ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_delivery_job_source();

REVOKE ALL ON FUNCTION public.validate_delivery_job_source() FROM PUBLIC;

DROP POLICY IF EXISTS delivery_job_order_owner_read
  ON public.delivery_jobs;
CREATE POLICY delivery_job_order_owner_read
  ON public.delivery_jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = delivery_jobs.order_id
        AND o.user_id = (SELECT auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.sync_delivery_status_to_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.order_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.orders o
  SET driver_id = NEW.driver_id,
      status = CASE NEW.status
        WHEN 'assigned' THEN 'confirmed'::public.order_status
        WHEN 'accepted' THEN 'confirmed'::public.order_status
        WHEN 'picked_up' THEN 'picked_up'::public.order_status
        WHEN 'in_transit' THEN 'out_for_delivery'::public.order_status
        WHEN 'delivered' THEN 'delivered'::public.order_status
        WHEN 'completed' THEN 'completed'::public.order_status
        WHEN 'cancelled' THEN 'cancelled'::public.order_status
        ELSE o.status
      END,
      delivered_at = CASE
        WHEN NEW.status IN ('delivered', 'completed')
          THEN COALESCE(o.delivered_at, NEW.delivered_at, NOW())
        ELSE o.delivered_at
      END,
      updated_at = NOW()
  WHERE o.id = NEW.order_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_delivery_status_to_order
  ON public.delivery_jobs;
CREATE TRIGGER trigger_sync_delivery_status_to_order
  AFTER INSERT OR UPDATE OF status, driver_id
  ON public.delivery_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_delivery_status_to_order();

REVOKE ALL ON FUNCTION public.sync_delivery_status_to_order() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_delivery_details_for_driver(
  p_delivery_job_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_job public.delivery_jobs%ROWTYPE;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT dj.*
    INTO v_job
  FROM public.delivery_jobs dj
  WHERE dj.id = p_delivery_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_JOB_NOT_FOUND';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = v_job.driver_id AND d.user_id = v_actor
    )
    OR public.is_active_fleet_operator(v_actor)
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
    WHERE ms.id = v_job.schedule_id;
  ELSE
    SELECT jsonb_build_object(
      'source', 'order',
      'source_id', o.id,
      'meal_name', COALESCE(m.name, 'Order'),
      'meal_calories', COALESCE(m.calories, 0),
      'customer_name', COALESCE(p.full_name, 'Customer'),
      'customer_phone', o.phone_number,
      'delivery_instructions', COALESCE(o.special_instructions, o.notes, v_job.delivery_notes)
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
    WHERE o.id = v_job.order_id;
  END IF;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'DELIVERY_SOURCE_NOT_FOUND';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_delivery_details_for_driver(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_details_for_driver(UUID)
  TO authenticated, service_role;

-- Customers may read orders, but order creation and financial values are
-- produced by trusted scheduling/payment flows.
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own pending orders" ON public.orders;
DROP POLICY IF EXISTS "Partners can update order status" ON public.orders;
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
GRANT ALL ON public.orders, public.order_items TO service_role;

CREATE OR REPLACE FUNCTION public.process_direct_order_cancellation(
  p_order_id UUID,
  p_cancelled_by UUID,
  p_cancelled_by_role TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_refund_amount NUMERIC(10, 2);
  v_wallet_transaction_id UUID;
  v_cancellation_id UUID;
BEGIN
  IF p_cancelled_by_role NOT IN ('customer', 'partner', 'admin', 'system') THEN
    RAISE EXCEPTION 'INVALID_CANCELLATION_ROLE';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.user_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_CUSTOMER_NOT_FOUND';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'already_cancelled', TRUE,
      'order_id', v_order.id,
      'refund_amount', 0
    );
  END IF;

  IF p_cancelled_by_role = 'customer' AND v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'ORDER_CANNOT_BE_CANCELLED';
  ELSIF p_cancelled_by_role = 'partner'
    AND v_order.status NOT IN ('pending', 'confirmed', 'preparing', 'ready_for_pickup') THEN
    RAISE EXCEPTION 'ORDER_CANNOT_BE_CANCELLED';
  ELSIF p_cancelled_by_role IN ('admin', 'system')
    AND v_order.status IN ('delivered', 'completed') THEN
    RAISE EXCEPTION 'ORDER_CANNOT_BE_CANCELLED';
  END IF;

  v_refund_amount := GREATEST(COALESCE(v_order.total_amount, 0), 0);
  IF v_refund_amount > 0 AND v_order.user_id IS NOT NULL THEN
    v_wallet_transaction_id := public.credit_wallet(
      v_order.user_id,
      v_refund_amount,
      'refund',
      'order',
      v_order.id,
      'Refund for cancelled order',
      jsonb_build_object(
        'order_id', v_order.id,
        'cancelled_by_role', p_cancelled_by_role,
        'reason', LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), 'Order cancellation'), 500)
      )
    );
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

  UPDATE public.delivery_jobs
  SET status = 'cancelled',
      failure_reason = LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), 'Order cancellation'), 500),
      updated_at = NOW()
  WHERE order_id = v_order.id
    AND status IN ('pending', 'assigned', 'accepted');

  UPDATE public.orders
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = v_order.id;

  INSERT INTO public.order_cancellations (
    order_id, user_id, cancelled_by, cancelled_by_role, reason,
    reason_category, refund_amount, refund_type, wallet_transaction_id,
    order_status_at_cancel, cancellation_fee
  ) VALUES (
    v_order.id,
    v_order.user_id,
    p_cancelled_by,
    p_cancelled_by_role,
    LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), 'Order cancellation'), 500),
    'other',
    v_refund_amount,
    CASE WHEN v_refund_amount > 0 THEN 'full' ELSE 'none' END,
    v_wallet_transaction_id,
    v_order.status,
    0
  )
  RETURNING id INTO v_cancellation_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_cancelled', FALSE,
    'order_id', v_order.id,
    'cancellation_id', v_cancellation_id,
    'refund_amount', v_refund_amount,
    'wallet_transaction_id', v_wallet_transaction_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_direct_order_cancellation(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_direct_order_cancellation(UUID, UUID, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.partner_update_order_status(
  p_source TEXT,
  p_order_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.orders%ROWTYPE;
  v_target public.order_status;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_source = 'meal_schedule' THEN
    PERFORM public.update_order_status(p_order_id, p_new_status, 'partner');
    RETURN jsonb_build_object(
      'success', TRUE,
      'source', 'meal_schedule',
      'order_id', p_order_id,
      'status', p_new_status
    );
  END IF;

  IF p_source <> 'order' THEN
    RAISE EXCEPTION 'INVALID_ORDER_SOURCE';
  END IF;

  v_target := CASE p_new_status
    WHEN 'ready' THEN 'ready_for_pickup'::public.order_status
    ELSE p_new_status::public.order_status
  END;

  SELECT o.*
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.restaurant_id IS NOT NULL
    AND public.is_restaurant_operator(o.restaurant_id, v_actor)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_ACCESS_DENIED';
  END IF;

  IF NOT (
    (v_order.status = 'pending' AND v_target IN ('confirmed', 'cancelled'))
    OR (v_order.status = 'confirmed' AND v_target IN ('preparing', 'cancelled'))
    OR (v_order.status = 'preparing' AND v_target IN ('ready_for_pickup', 'cancelled'))
    OR (v_order.status = 'ready_for_pickup' AND v_target = 'cancelled')
  ) THEN
    RAISE EXCEPTION 'INVALID_ORDER_STATUS_TRANSITION';
  END IF;

  IF v_target = 'cancelled' THEN
    RETURN public.process_direct_order_cancellation(
      v_order.id,
      v_actor,
      'partner',
      'Restaurant cancellation'
    );
  END IF;

  UPDATE public.orders
  SET status = v_target,
      preparing_at = CASE
        WHEN v_target = 'preparing' THEN COALESCE(preparing_at, NOW())
        ELSE preparing_at
      END,
      ready_for_pickup_at = CASE
        WHEN v_target = 'ready_for_pickup' THEN COALESCE(ready_for_pickup_at, NOW())
        ELSE ready_for_pickup_at
      END,
      updated_at = NOW()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'source', 'order',
    'order_id', v_order.id,
    'status', v_target
  );
END;
$$;

REVOKE ALL ON FUNCTION public.partner_update_order_status(TEXT, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_update_order_status(TEXT, UUID, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_update_order_status(
  p_source TEXT,
  p_order_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.orders%ROWTYPE;
  v_target public.order_status;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_ACCESS_REQUIRED';
  END IF;

  IF p_source = 'meal_schedule' THEN
    IF p_new_status = 'cancelled' THEN
      RETURN public.admin_cancel_meal_schedule(p_order_id, p_reason);
    END IF;

    PERFORM public.update_order_status(p_order_id, p_new_status, 'admin');
    RETURN jsonb_build_object(
      'success', TRUE,
      'source', 'meal_schedule',
      'order_id', p_order_id,
      'status', p_new_status
    );
  END IF;

  IF p_source <> 'order' THEN
    RAISE EXCEPTION 'INVALID_ORDER_SOURCE';
  END IF;

  v_target := p_new_status::public.order_status;
  IF v_target NOT IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'ADMIN_STATUS_NOT_SUPPORTED';
  END IF;

  SELECT o.* INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_target = 'completed' AND v_order.status <> 'delivered' THEN
    RAISE EXCEPTION 'ORDER_MUST_BE_DELIVERED_FIRST';
  END IF;

  IF v_target = 'cancelled'
    AND v_order.status IN ('delivered', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'ORDER_CANNOT_BE_CANCELLED';
  END IF;

  IF v_target = 'cancelled' THEN
    RETURN public.process_direct_order_cancellation(
      v_order.id,
      v_actor,
      'admin',
      COALESCE(NULLIF(TRIM(p_reason), ''), 'Admin cancellation')
    );
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', TRUE);

  UPDATE public.delivery_jobs
  SET status = 'cancelled',
      failure_reason = LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), 'Admin cancellation'), 500),
      updated_at = NOW()
  WHERE order_id = v_order.id
    AND v_target = 'cancelled'
    AND status IN ('pending', 'assigned', 'accepted');

  UPDATE public.orders
  SET status = v_target,
      updated_at = NOW()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'source', 'order',
    'order_id', v_order.id,
    'status', v_target
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_order_status(TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(TEXT, UUID, TEXT, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_order_financial_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_is_trusted BOOLEAN :=
    COALESCE(auth.role(), '') = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin')
    OR public.has_role(v_actor, 'admin');
BEGIN
  IF NOT v_is_trusted AND (
    NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
    OR NEW.restaurant_branch_id IS DISTINCT FROM OLD.restaurant_branch_id
    OR NEW.meal_id IS DISTINCT FROM OLD.meal_id
    OR NEW.order_type IS DISTINCT FROM OLD.order_type
    OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
    OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
    OR NEW.tip_amount IS DISTINCT FROM OLD.tip_amount
    OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
    OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
    OR NEW.restaurant_payout IS DISTINCT FROM OLD.restaurant_payout
  ) THEN
    RAISE EXCEPTION 'ORDER_FINANCIAL_FIELDS_ARE_SERVER_MANAGED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_order_financial_fields_trigger ON public.orders;
CREATE TRIGGER guard_order_financial_fields_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_financial_fields();

CREATE OR REPLACE FUNCTION public.cancel_customer_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Customer cancellation'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.orders%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT *
    INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'already_cancelled', TRUE,
      'order_id', v_order.id,
      'refund_amount', 0
    );
  END IF;

  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'ORDER_CANNOT_BE_CANCELLED';
  END IF;

  RETURN public.process_direct_order_cancellation(
    v_order.id,
    v_actor,
    'customer',
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Customer cancellation')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_customer_order(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_customer_order(UUID, TEXT)
  TO authenticated, service_role;

-- Recovery credits are derived from an active subscription and an explicit
-- platform entitlement. The browser can no longer create credits or QR codes.
ALTER TABLE public.recovery_bookings
  ADD COLUMN IF NOT EXISTS credit_period_start DATE;

UPDATE public.recovery_bookings
SET credit_period_start = DATE_TRUNC('month', created_at AT TIME ZONE 'Asia/Qatar')::DATE
WHERE credit_period_start IS NULL;

DO $$
DECLARE
  v_policy RECORD;
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['member_recovery_credits', 'recovery_bookings'] LOOP
    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;
  END LOOP;
END;
$$;

CREATE POLICY recovery_credit_owner_read
  ON public.member_recovery_credits
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY recovery_booking_owner_read
  ON public.recovery_bookings
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY recovery_credit_admin_read
  ON public.member_recovery_credits
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY recovery_booking_admin_read
  ON public.recovery_bookings
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

REVOKE ALL ON public.member_recovery_credits, public.recovery_bookings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.member_recovery_credits, public.recovery_bookings
  FROM authenticated;
GRANT SELECT ON public.member_recovery_credits, public.recovery_bookings
  TO authenticated;
GRANT ALL ON public.member_recovery_credits, public.recovery_bookings
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_recovery_credits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_period_start DATE;
  v_period_end DATE;
  v_enabled BOOLEAN := FALSE;
  v_monthly_credits INTEGER := 0;
  v_credits public.member_recovery_credits%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  v_period_start := DATE_TRUNC('month', v_today)::DATE;
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = v_actor
      AND s.status IN ('active', 'cancelled')
      AND COALESCE(s.end_date::DATE, v_today - 1) >= v_today
  ) THEN
    SELECT
      COALESCE((ps.value ->> 'enabled')::BOOLEAN, FALSE),
      GREATEST(0, COALESCE((ps.value ->> 'monthly_credits')::INTEGER, 0))
      INTO v_enabled, v_monthly_credits
    FROM public.platform_settings ps
    WHERE ps.key = 'recovery_credits';
  END IF;

  IF NOT COALESCE(v_enabled, FALSE) THEN
    v_monthly_credits := 0;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('recovery:' || v_actor::TEXT || ':' || v_period_start::TEXT, 0)
  );

  INSERT INTO public.member_recovery_credits (
    user_id,
    total_credits,
    used_credits,
    period_start,
    period_end
  ) VALUES (
    v_actor,
    v_monthly_credits,
    0,
    v_period_start,
    v_period_end
  )
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET
    total_credits = GREATEST(
      EXCLUDED.total_credits,
      public.member_recovery_credits.used_credits
    ),
    period_end = EXCLUDED.period_end
  RETURNING * INTO v_credits;

  RETURN TO_JSONB(v_credits);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_recovery_booking(
  p_partner_id UUID,
  p_service_name TEXT,
  p_booking_date DATE,
  p_booking_time TIME,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_period_start DATE := DATE_TRUNC('month', (NOW() AT TIME ZONE 'Asia/Qatar')::DATE)::DATE;
  v_partner public.recovery_partners%ROWTYPE;
  v_service JSONB;
  v_required_credits INTEGER;
  v_booking public.recovery_bookings%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_booking_date < v_today OR p_booking_date > v_today + 90 THEN
    RAISE EXCEPTION 'RECOVERY_BOOKING_DATE_INVALID';
  END IF;

  SELECT *
    INTO v_partner
  FROM public.recovery_partners rp
  WHERE rp.id = p_partner_id
    AND rp.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_PARTNER_NOT_FOUND';
  END IF;

  SELECT service
    INTO v_service
  FROM JSONB_ARRAY_ELEMENTS(COALESCE(v_partner.services, '[]'::JSONB)) AS item(service)
  WHERE service ->> 'name' = p_service_name
  LIMIT 1;

  v_required_credits := COALESCE((v_service ->> 'credits_required')::INTEGER, 0);
  IF v_service IS NULL OR v_required_credits <= 0 THEN
    RAISE EXCEPTION 'RECOVERY_SERVICE_NOT_FOUND';
  END IF;

  PERFORM public.get_or_create_recovery_credits();
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      'recovery-slot:' || p_partner_id::TEXT || ':'
        || p_booking_date::TEXT || ':' || p_booking_time::TEXT,
      0
    )
  );

  IF EXISTS (
    SELECT 1
    FROM public.recovery_bookings rb
    WHERE rb.partner_id = p_partner_id
      AND rb.booking_date = p_booking_date
      AND rb.booking_time = p_booking_time
      AND rb.status = 'booked'
  ) THEN
    RAISE EXCEPTION 'RECOVERY_SLOT_UNAVAILABLE';
  END IF;

  UPDATE public.member_recovery_credits mrc
  SET used_credits = mrc.used_credits + v_required_credits
  WHERE mrc.user_id = v_actor
    AND mrc.period_start = v_period_start
    AND mrc.used_credits + v_required_credits <= mrc.total_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_RECOVERY_CREDITS';
  END IF;

  INSERT INTO public.recovery_bookings (
    user_id,
    partner_id,
    service_name,
    credits_used,
    booking_date,
    booking_time,
    status,
    qr_code,
    notes,
    credit_period_start
  ) VALUES (
    v_actor,
    p_partner_id,
    p_service_name,
    v_required_credits,
    p_booking_date,
    p_booking_time,
    'booked',
    'NR-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 20)),
    LEFT(NULLIF(TRIM(p_notes), ''), 500),
    v_period_start
  )
  RETURNING * INTO v_booking;

  RETURN TO_JSONB(v_booking);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_recovery_booking(
  p_booking_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_now TIMESTAMP := NOW() AT TIME ZONE 'Asia/Qatar';
  v_booking public.recovery_bookings%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT *
    INTO v_booking
  FROM public.recovery_bookings rb
  WHERE rb.id = p_booking_id
    AND rb.user_id = v_actor
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_BOOKING_NOT_FOUND';
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'already_cancelled', TRUE,
      'booking_id', v_booking.id
    );
  END IF;

  IF v_booking.status <> 'booked' THEN
    RAISE EXCEPTION 'RECOVERY_BOOKING_CANNOT_BE_CANCELLED';
  END IF;

  IF (v_booking.booking_date + v_booking.booking_time)
    <= v_now + INTERVAL '2 hours' THEN
    RAISE EXCEPTION 'RECOVERY_CANCELLATION_WINDOW_CLOSED';
  END IF;

  UPDATE public.recovery_bookings
  SET status = 'cancelled'
  WHERE id = v_booking.id;

  UPDATE public.member_recovery_credits
  SET used_credits = GREATEST(0, used_credits - v_booking.credits_used)
  WHERE user_id = v_actor
    AND period_start = v_booking.credit_period_start;

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_cancelled', FALSE,
    'booking_id', v_booking.id,
    'credits_restored', v_booking.credits_used
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_recovery_booking(
  p_booking_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_booking public.recovery_bookings%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  IF p_status NOT IN ('completed', 'no_show') THEN
    RAISE EXCEPTION 'RECOVERY_BOOKING_STATUS_INVALID';
  END IF;

  SELECT *
    INTO v_booking
  FROM public.recovery_bookings rb
  WHERE rb.id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECOVERY_BOOKING_NOT_FOUND';
  END IF;

  IF v_booking.status = p_status THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'already_processed', TRUE,
      'booking_id', v_booking.id,
      'status', v_booking.status
    );
  END IF;

  IF v_booking.status <> 'booked' THEN
    RAISE EXCEPTION 'RECOVERY_BOOKING_TRANSITION_INVALID';
  END IF;

  UPDATE public.recovery_bookings
  SET status = p_status
  WHERE id = v_booking.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'already_processed', FALSE,
    'booking_id', v_booking.id,
    'status', p_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_recovery_credits()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_recovery_booking(UUID, TEXT, DATE, TIME, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_recovery_booking(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_recovery_booking(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_recovery_credits(),
  public.create_recovery_booking(UUID, TEXT, DATE, TIME, TEXT),
  public.cancel_recovery_booking(UUID),
  public.transition_recovery_booking(UUID, TEXT)
TO authenticated, service_role;

-- Preserve the admin announcement workflow through an authenticated wrapper.
CREATE OR REPLACE FUNCTION public.send_announcement_notification_secure(
  p_announcement_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  RETURN public.send_announcement_notification(p_announcement_id);
END;
$$;

REVOKE ALL ON FUNCTION public.send_announcement_notification_secure(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_announcement_notification_secure(UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.retry_verified_payment_fulfillment(
  p_payment_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_payment public.payments%ROWTYPE;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  SELECT *
    INTO v_payment
  FROM public.payments p
  WHERE p.id = p_payment_id
    AND p.status = 'completed'
    AND p.verified_at IS NOT NULL
    AND p.provider_transaction_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VERIFIED_PAYMENT_NOT_FOUND';
  END IF;

  RETURN public.finalize_verified_sadad_payment(
    v_payment.id,
    v_payment.provider_transaction_id,
    COALESCE(v_payment.gateway_response, '{}'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retry_verified_payment_fulfillment(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_verified_payment_fulfillment(UUID)
  TO authenticated, service_role;

-- Revoke legacy and unmanaged privilege-bearing functions by every installed
-- overload. Trusted triggers continue to run as their function owner.
DO $$
DECLARE
  v_signature REGPROCEDURE;
BEGIN
  FOR v_signature IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'cancel_order',
        'auto_retry_failed_payments',
        'ensure_admin_role',
        'ensure_fleet_manager_role',
        'book_recovery_session',
        'increment_recovery_credits',
        'decrement_recovery_credits',
        'get_wallet_balance',
        'get_user_push_tokens',
        'deactivate_old_push_tokens',
        'update_push_token_usage',
        'add_staff_member_with_user',
        'send_announcement_notification',
        'send_whatsapp_notification'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_signature
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
  END LOOP;
END;
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
