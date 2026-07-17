-- Close authorization gaps left by launch-era driver, restaurant, finance,
-- delivery-assignment, and public media policies.

BEGIN;

-- ---------------------------------------------------------------------------
-- Driver registration and privileged fields
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_driver_authorization_boundary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_is_admin BOOLEAN := false;
  v_is_fleet_operator BOOLEAN := false;
  v_assignment_change_authorized BOOLEAN := false;
BEGIN
  IF v_actor IS NOT NULL THEN
    v_is_admin := COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      AND public.has_role(v_actor, 'admin'::public.app_role);
    v_is_fleet_operator := public.can_manage_fleet_city(NEW.city_id);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_is_service OR v_is_admin OR v_is_fleet_operator THEN
      RETURN NEW;
    END IF;

    IF v_actor IS NULL OR NEW.user_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'DRIVER_SELF_REGISTRATION_REQUIRED';
    END IF;

    -- Client-supplied approval, availability, assignment, and financial values
    -- are ignored. Fleet approval is a separate privileged action.
    NEW.approval_status := 'pending'::public.approval_status;
    NEW.is_active := false;
    NEW.is_online := false;
    NEW.current_job_id := NULL;
    NEW.wallet_balance := 0;
    NEW.total_earnings := 0;
    NEW.total_deliveries := 0;
    NEW.rating := 0;
    NEW.cancellation_rate := 0;
    NEW.assigned_zone_ids := ARRAY[]::UUID[];
    NEW.payout_details := NULL;
    NEW.status := 'pending_verification';
    RETURN NEW;
  END IF;

  IF v_is_service OR v_is_admin OR v_is_fleet_operator THEN
    RETURN NEW;
  END IF;

  v_assignment_change_authorized :=
    COALESCE(current_setting('app.delivery_claim_authorized', true), '') = 'true';

  -- The reviewed delivery lifecycle may update only the assignment pointer.
  -- Function ownership and trigger nesting never grant authority by themselves.
  IF v_assignment_change_authorized THEN
    IF (to_jsonb(NEW) - ARRAY['current_job_id', 'updated_at'])
       IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['current_job_id', 'updated_at']) THEN
      RAISE EXCEPTION 'DELIVERY_ASSIGNMENT_SCOPE_VIOLATION';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor IS NULL
     OR OLD.user_id IS DISTINCT FROM v_actor
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'DRIVER_UPDATE_FORBIDDEN';
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
     OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
     OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.cancellation_rate IS DISTINCT FROM OLD.cancellation_rate
     OR NEW.payout_details IS DISTINCT FROM OLD.payout_details
     OR NEW.city_id IS DISTINCT FROM OLD.city_id
     OR NEW.assigned_zone_ids IS DISTINCT FROM OLD.assigned_zone_ids
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.current_job_id IS DISTINCT FROM OLD.current_job_id THEN
    RAISE EXCEPTION 'DRIVER_PRIVILEGED_FIELDS_REQUIRE_FLEET_APPROVAL';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_driver_authorization_boundary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_driver_authorization_boundary()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_driver_authorization_boundary ON public.drivers;
CREATE TRIGGER enforce_driver_authorization_boundary
BEFORE INSERT OR UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_authorization_boundary();

-- The delivery lifecycle trigger receives a narrowly scoped, transaction-local
-- capability while synchronizing drivers.current_job_id. Restore the previous
-- value immediately so unrelated statements in the transaction cannot inherit
-- the capability.
CREATE OR REPLACE FUNCTION public.sync_driver_current_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_previous_authorization TEXT :=
    current_setting('app.delivery_claim_authorized', true);
BEGIN
  PERFORM set_config('app.delivery_claim_authorized', 'true', true);

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

  PERFORM set_config(
    'app.delivery_claim_authorized',
    COALESCE(v_previous_authorization, ''),
    true
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config(
    'app.delivery_claim_authorized',
    COALESCE(v_previous_authorization, ''),
    true
  );
  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_driver_current_job()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trigger_sync_driver_current_job ON public.delivery_jobs;
CREATE TRIGGER trigger_sync_driver_current_job
AFTER UPDATE OF status, driver_id ON public.delivery_jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_driver_current_job();

DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drivers'
      AND cmd IN ('INSERT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.drivers', v_policy.policyname);
  END LOOP;
END;
$do$;

CREATE POLICY drivers_self_register_pending
  ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND approval_status = 'pending'::public.approval_status
    AND COALESCE(is_active, false) = false
    AND COALESCE(is_online, false) = false
    AND current_job_id IS NULL
    AND COALESCE(wallet_balance, 0) = 0
    AND COALESCE(total_earnings, 0) = 0
    AND COALESCE(total_deliveries, 0) = 0
    AND COALESCE(rating, 0) = 0
    AND COALESCE(cancellation_rate, 0) = 0
    AND COALESCE(cardinality(assigned_zone_ids), 0) = 0
    AND payout_details IS NULL
    AND status = 'pending_verification'
  );

CREATE POLICY drivers_fleet_create_scoped
  ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_fleet_city(city_id));

CREATE POLICY drivers_aal2_admin_manage
  ON public.drivers FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Restaurant approval boundary and operator identity
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_restaurant_operator(
  p_restaurant_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT p_user_id IS NOT NULL
    AND (
      p_user_id = auth.uid()
      OR COALESCE(auth.role(), '') = 'service_role'
      OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    )
    AND EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = p_restaurant_id
        AND r.approval_status = 'approved'::public.approval_status
        AND COALESCE(r.is_active, false) = true
        AND r.deleted_at IS NULL
        AND (
          (
            r.owner_id = p_user_id
            AND (
              public.has_role(p_user_id, 'partner'::public.app_role)
              OR public.has_role(p_user_id, 'restaurant'::public.app_role)
            )
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurant_staff rs
            WHERE rs.restaurant_id = r.id
              AND rs.user_id = p_user_id
              AND rs.is_active = true
          )
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.is_restaurant_operator(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_restaurant_operator(UUID, UUID)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_restaurant_authorization_boundary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
DECLARE
  v_actor UUID := auth.uid();
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_is_admin BOOLEAN := false;
BEGIN
  IF v_actor IS NOT NULL THEN
    v_is_admin := COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      AND public.has_role(v_actor, 'admin'::public.app_role);
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_is_service OR v_is_admin THEN
      RETURN NEW;
    END IF;

    IF v_actor IS NULL
       OR NEW.owner_id IS DISTINCT FROM v_actor
       OR NOT (
         public.has_role(v_actor, 'partner'::public.app_role)
         OR public.has_role(v_actor, 'restaurant'::public.app_role)
       ) THEN
      RAISE EXCEPTION 'PARTNER_APPLICATION_REQUIRED';
    END IF;

    NEW.approval_status := 'pending'::public.approval_status;
    NEW.is_active := false;
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.commission_rate := 18.00;
    NEW.payout_rate := 25.00;
    NEW.payout_rate_set_at := NULL;
    NEW.payout_rate_set_by := NULL;
    NEW.bank_info := '{}'::JSONB;
    NEW.premium_analytics_until := NULL;
    NEW.current_day_orders := 0;
    NEW.total_orders := 0;
    NEW.avg_rating := 0;
    NEW.rating := 0;
    NEW.review_count := 0;
    NEW.reviews_count := 0;
    NEW.deleted_at := NULL;
    NEW.is_partner := true;
    RETURN NEW;
  END IF;

  IF v_is_service OR v_is_admin THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'RESTAURANT_UPDATE_FORBIDDEN';
  END IF;

  -- Enforce tenant identity inside the trigger. This remains effective when a
  -- legacy SECURITY DEFINER caller bypasses table RLS.
  IF OLD.owner_id IS DISTINCT FROM v_actor
     AND NOT (
       public.is_restaurant_operator(OLD.id, v_actor)
       AND (
         EXISTS (
           SELECT 1
           FROM public.restaurant_staff rs
           WHERE rs.restaurant_id = OLD.id
             AND rs.user_id = v_actor
             AND COALESCE(rs.is_active, false) = true
             AND rs.role IN ('owner', 'manager')
         )
         OR EXISTS (
           SELECT 1
           FROM public.staff_members sm
           JOIN public.staff_roles sr ON sr.id = sm.role_id
           WHERE sm.restaurant_id = OLD.id
             AND sm.user_id = v_actor
             AND COALESCE(sm.is_active, false) = true
             AND sr.permissions @> jsonb_build_array('manage_restaurant')
         )
       )
     ) THEN
    RAISE EXCEPTION 'RESTAURANT_TENANT_UPDATE_FORBIDDEN';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.payout_rate IS DISTINCT FROM OLD.payout_rate
     OR NEW.payout_rate_set_at IS DISTINCT FROM OLD.payout_rate_set_at
     OR NEW.payout_rate_set_by IS DISTINCT FROM OLD.payout_rate_set_by
     OR NEW.bank_info IS DISTINCT FROM OLD.bank_info
     OR NEW.premium_analytics_until IS DISTINCT FROM OLD.premium_analytics_until
     OR NEW.current_day_orders IS DISTINCT FROM OLD.current_day_orders
     OR NEW.daily_reset_at IS DISTINCT FROM OLD.daily_reset_at
     OR NEW.total_orders IS DISTINCT FROM OLD.total_orders
     OR NEW.avg_rating IS DISTINCT FROM OLD.avg_rating
     OR NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.review_count IS DISTINCT FROM OLD.review_count
     OR NEW.reviews_count IS DISTINCT FROM OLD.reviews_count
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.is_partner IS DISTINCT FROM OLD.is_partner
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'RESTAURANT_APPROVAL_AND_FINANCIAL_FIELDS_REQUIRE_ADMIN';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_restaurant_authorization_boundary()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_restaurant_authorization_boundary()
  TO service_role;

DROP TRIGGER IF EXISTS enforce_restaurant_authorization_boundary ON public.restaurants;
CREATE TRIGGER enforce_restaurant_authorization_boundary
BEFORE INSERT OR UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_authorization_boundary();

DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurants'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.restaurants', v_policy.policyname);
  END LOOP;
END;
$do$;

CREATE POLICY restaurants_partner_apply_pending
  ON public.restaurants FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND approval_status = 'pending'::public.approval_status
    AND COALESCE(is_active, false) = false
    AND approved_at IS NULL
    AND approved_by IS NULL
    AND (
      public.has_role((SELECT auth.uid()), 'partner'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'restaurant'::public.app_role)
    )
  );

CREATE POLICY restaurants_approved_operator_update
  ON public.restaurants FOR UPDATE TO authenticated
  USING (
    public.is_restaurant_operator(id, (SELECT auth.uid()))
    AND (
      owner_id = (SELECT auth.uid())
      OR public.has_staff_permission(id, 'manage_restaurant')
    )
  )
  WITH CHECK (
    public.is_restaurant_operator(id, (SELECT auth.uid()))
    AND (
      owner_id = (SELECT auth.uid())
      OR public.has_staff_permission(id, 'manage_restaurant')
    )
  );

CREATE POLICY restaurants_aal2_admin_manage
  ON public.restaurants FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Admin subscription and wallet adjustments require AAL2
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS subscriptions_admin_manage ON public.subscriptions;
CREATE POLICY subscriptions_admin_manage
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.admin_update_user_subscription_wallet(
  p_user_id UUID,
  p_subscription_id UUID DEFAULT NULL,
  p_plan TEXT DEFAULT 'monthly',
  p_status public.subscription_status DEFAULT 'active',
  p_tier TEXT DEFAULT 'basic',
  p_meals_per_week INTEGER DEFAULT 0,
  p_meals_per_month INTEGER DEFAULT 0,
  p_meals_used_this_week INTEGER DEFAULT 0,
  p_meals_used_this_month INTEGER DEFAULT 0,
  p_price NUMERIC DEFAULT 0,
  p_end_date DATE DEFAULT NULL,
  p_includes_gym BOOLEAN DEFAULT FALSE,
  p_wallet_balance NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_service BOOLEAN := COALESCE(auth.role(), '') = 'service_role';
  v_subscription_id UUID;
  v_wallet public.customer_wallets%ROWTYPE;
  v_current_balance NUMERIC(10, 2) := 0;
  v_next_balance NUMERIC(10, 2);
  v_delta NUMERIC(10, 2);
  v_transaction_id UUID;
  v_today DATE := CURRENT_DATE;
  v_effective_end_date DATE;
BEGIN
  IF NOT v_is_service AND (
    v_actor_id IS NULL
    OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    OR NOT public.has_role(v_actor_id, 'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_REQUIRED';
  END IF;

  IF COALESCE(p_meals_per_week, 0) NOT BETWEEN 0 AND 1000
     OR COALESCE(p_meals_per_month, 0) NOT BETWEEN 0 AND 5000
     OR COALESCE(p_meals_used_this_week, 0) NOT BETWEEN 0 AND 1000000
     OR COALESCE(p_meals_used_this_month, 0) NOT BETWEEN 0 AND 1000000
     OR COALESCE(p_price, 0) NOT BETWEEN 0 AND 10000000
     OR (p_wallet_balance IS NOT NULL AND p_wallet_balance NOT BETWEEN 0 AND 1000000000) THEN
    RAISE EXCEPTION 'INVALID_FINANCIAL_ADJUSTMENT';
  END IF;

  v_effective_end_date := CASE
    WHEN p_status = 'active'
      AND (p_end_date IS NULL OR p_end_date < v_today)
    THEN v_today + CASE
      WHEN lower(COALESCE(p_plan, 'monthly')) = 'weekly' THEN 7
      ELSE 30
    END
    ELSE p_end_date
  END;

  IF p_subscription_id IS NULL THEN
    INSERT INTO public.subscriptions (
      user_id,
      plan,
      plan_type,
      status,
      tier,
      meals_per_week,
      meals_per_month,
      meals_used_this_week,
      meals_used_this_month,
      price,
      start_date,
      end_date,
      active,
      week_start_date,
      month_start_date,
      updated_at
    ) VALUES (
      p_user_id,
      p_plan,
      p_plan,
      p_status,
      p_tier,
      GREATEST(COALESCE(p_meals_per_week, 0), 0),
      GREATEST(COALESCE(p_meals_per_month, 0), 0),
      GREATEST(COALESCE(p_meals_used_this_week, 0), 0),
      GREATEST(COALESCE(p_meals_used_this_month, 0), 0),
      GREATEST(COALESCE(p_price, 0), 0),
      v_today,
      v_effective_end_date,
      p_status = 'active',
      v_today,
      v_today,
      clock_timestamp()
    )
    RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.subscriptions
    SET plan = p_plan,
        plan_type = p_plan,
        status = p_status,
        tier = p_tier,
        meals_per_week = GREATEST(COALESCE(p_meals_per_week, 0), 0),
        meals_per_month = GREATEST(COALESCE(p_meals_per_month, 0), 0),
        meals_used_this_week = GREATEST(COALESCE(p_meals_used_this_week, 0), 0),
        meals_used_this_month = GREATEST(COALESCE(p_meals_used_this_month, 0), 0),
        price = GREATEST(COALESCE(p_price, 0), 0),
        end_date = v_effective_end_date,
        active = p_status = 'active',
        week_start_date = COALESCE(week_start_date, v_today),
        month_start_date = COALESCE(month_start_date, v_today),
        updated_at = clock_timestamp()
    WHERE id = p_subscription_id
      AND user_id = p_user_id
    RETURNING id INTO v_subscription_id;

    IF v_subscription_id IS NULL THEN
      RAISE EXCEPTION 'SUBSCRIPTION_NOT_FOUND';
    END IF;
  END IF;

  IF p_status = 'active' THEN
    UPDATE public.subscriptions
    SET active = false,
        status = 'expired',
        updated_at = clock_timestamp()
    WHERE user_id = p_user_id
      AND id <> v_subscription_id
      AND status = 'active';
  END IF;

  IF p_wallet_balance IS NOT NULL THEN
    v_next_balance := ROUND(GREATEST(COALESCE(p_wallet_balance, 0), 0), 2);

    INSERT INTO public.customer_wallets (
      user_id,
      balance,
      total_credits,
      total_debits,
      is_active
    ) VALUES (
      p_user_id,
      0,
      0,
      0,
      true
    )
    ON CONFLICT (user_id) DO NOTHING;

    SELECT *
    INTO v_wallet
    FROM public.customer_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'WALLET_NOT_FOUND';
    END IF;

    v_current_balance := COALESCE(v_wallet.balance, 0);
    v_delta := ROUND(v_next_balance - v_current_balance, 2);

    UPDATE public.customer_wallets
    SET balance = v_next_balance,
        total_credits = COALESCE(total_credits, 0)
          + CASE WHEN v_delta > 0 THEN v_delta ELSE 0 END,
        total_debits = COALESCE(total_debits, 0)
          + CASE WHEN v_delta < 0 THEN ABS(v_delta) ELSE 0 END,
        is_active = true,
        updated_at = clock_timestamp()
    WHERE id = v_wallet.id;

    IF ABS(v_delta) >= 0.01 THEN
      INSERT INTO public.wallet_transactions (
        wallet_id,
        user_id,
        type,
        amount,
        balance_after,
        reference_type,
        reference_id,
        description,
        metadata
      ) VALUES (
        v_wallet.id,
        p_user_id,
        CASE WHEN v_delta > 0 THEN 'credit' ELSE 'debit' END,
        ABS(v_delta),
        v_next_balance,
        NULL,
        v_subscription_id,
        'Admin adjusted wallet balance',
        jsonb_build_object(
          'source', 'admin_adjustment',
          'actor_id', v_actor_id,
          'previous_balance', v_current_balance,
          'new_balance', v_next_balance,
          'delta', v_delta,
          'aal', CASE WHEN v_is_service THEN 'service_role' ELSE auth.jwt() ->> 'aal' END
        )
      )
      RETURNING id INTO v_transaction_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'wallet_balance', COALESCE(v_next_balance, v_current_balance),
    'wallet_transaction_id', v_transaction_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_update_user_subscription_wallet(
  UUID, UUID, TEXT, public.subscription_status, TEXT, INTEGER, INTEGER,
  INTEGER, INTEGER, NUMERIC, DATE, BOOLEAN, NUMERIC
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_update_user_subscription_wallet(
  UUID, UUID, TEXT, public.subscription_status, TEXT, INTEGER, INTEGER,
  INTEGER, INTEGER, NUMERIC, DATE, BOOLEAN, NUMERIC
) TO authenticated, service_role;

-- Legacy assignment helpers must only be reached through trusted backend code.
DO $do$
DECLARE
  v_function REGPROCEDURE;
BEGIN
  FOR v_function IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('unassign_driver', 'auto_assign_driver')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role',
      v_function
    );
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function);
  END LOOP;
END;
$do$;

-- ---------------------------------------------------------------------------
-- Public catalog media: owner/operator-scoped writes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_write_restaurant_logo_object(
  p_name TEXT,
  p_owner_id TEXT,
  p_user_id UUID
)
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
      OR (
        COALESCE((storage.foldername(p_name))[1], '') = 'logos'
        AND (
          (
            p_owner_id = p_user_id::TEXT
            AND storage.filename(p_name) LIKE p_user_id::TEXT || '-%'
            AND (
              public.has_role(p_user_id, 'partner'::public.app_role)
              OR public.has_role(p_user_id, 'restaurant'::public.app_role)
            )
          )
          OR EXISTS (
            SELECT 1
            FROM public.restaurants r
            WHERE storage.filename(p_name) LIKE r.id::TEXT || '-%'
              AND public.is_restaurant_operator(r.id, p_user_id)
          )
        )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_write_meal_image_object(
  p_name TEXT,
  p_owner_id TEXT,
  p_user_id UUID
)
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
      OR (
        COALESCE((storage.foldername(p_name))[1], '') = 'meals'
        AND (
          EXISTS (
            SELECT 1
            FROM public.meals m
            WHERE storage.filename(p_name) LIKE m.id::TEXT || '-%'
              AND public.is_restaurant_operator(m.restaurant_id, p_user_id)
          )
          OR (
            p_owner_id = p_user_id::TEXT
            AND storage.filename(p_name) LIKE 'new-%'
            AND EXISTS (
              SELECT 1
              FROM public.restaurants r
              WHERE public.is_restaurant_operator(r.id, p_user_id)
            )
          )
        )
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_write_restaurant_logo_object(TEXT, TEXT, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_meal_image_object(TEXT, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_restaurant_logo_object(TEXT, TEXT, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_meal_image_object(TEXT, TEXT, UUID)
  TO authenticated, service_role;

-- Bucket metadata is a second line of defense. Supabase enforces these values
-- at upload time when the corresponding columns exist on storage.buckets. MIME
-- declarations are metadata checks and do not replace server-side magic-byte
-- validation.
DO $do$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'storage.buckets is required for public media hardening';
  END IF;

  IF (
    SELECT count(*)
    FROM storage.buckets
    WHERE id IN ('restaurant-logos', 'meal-images')
  ) <> 2 THEN
    RAISE EXCEPTION 'Expected public media buckets are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.buckets'::REGCLASS
      AND attname = 'file_size_limit'
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    EXECUTE $sql$
      UPDATE storage.buckets
      SET file_size_limit = LEAST(COALESCE(file_size_limit, 5242880), 5242880)
      WHERE id IN ('restaurant-logos', 'meal-images')
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.buckets'::REGCLASS
      AND attname = 'allowed_mime_types'
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    EXECUTE $sql$
      UPDATE storage.buckets
      SET allowed_mime_types = ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp'
      ]::TEXT[]
      WHERE id IN ('restaurant-logos', 'meal-images')
    $sql$;
  END IF;
END;
$do$;

DO $do$
DECLARE
  v_policy RECORD;
  v_expression TEXT;
BEGIN
  FOR v_policy IN
    SELECT policyname, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    v_expression := lower(
      COALESCE(v_policy.qual, '') || ' ' || COALESCE(v_policy.with_check, '')
    );

    IF v_expression LIKE '%restaurant-logos%'
       OR v_expression LIKE '%meal-images%'
       OR v_policy.policyname IN (
         'Partners can upload their restaurant logo',
         'Partners can update their restaurant logo',
         'Partners can delete their restaurant logo',
         'Authenticated users can upload owned restaurant logos',
         'Owners can update restaurant logos',
         'Owners can delete restaurant logos',
         'restaurant-logos insert',
         'restaurant-logos update',
         'restaurant-logos delete',
         'Partners can upload meal images',
         'Partners can update meal images',
         'Partners can delete meal images',
         'Authenticated users can upload meal images',
         'Authenticated users can update meal images',
         'Authenticated users can delete meal images',
         'Authenticated users can upload owned meal images',
         'Owners can update meal images',
         'Owners can delete meal images',
         'meal-images insert policy',
         'meal-images update policy',
         'meal-images delete policy'
       ) THEN
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON storage.objects',
        v_policy.policyname
      );
    END IF;
  END LOOP;
END;
$do$;

CREATE POLICY restaurant_logo_authorized_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND public.can_write_restaurant_logo_object(name, owner_id, (SELECT auth.uid()))
  );

CREATE POLICY restaurant_logo_authorized_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND public.can_write_restaurant_logo_object(name, owner_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND public.can_write_restaurant_logo_object(name, owner_id, (SELECT auth.uid()))
  );

CREATE POLICY restaurant_logo_authorized_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND public.can_write_restaurant_logo_object(name, owner_id, (SELECT auth.uid()))
  );

CREATE POLICY meal_image_authorized_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'meal-images'
    AND public.can_write_meal_image_object(name, owner_id, (SELECT auth.uid()))
  );

CREATE POLICY meal_image_authorized_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'meal-images'
    AND public.can_write_meal_image_object(name, owner_id, (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'meal-images'
    AND public.can_write_meal_image_object(name, owner_id, (SELECT auth.uid()))
  );

CREATE POLICY meal_image_authorized_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'meal-images'
    AND public.can_write_meal_image_object(name, owner_id, (SELECT auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Deployment assertions: abort instead of leaving a partially hardened state
-- ---------------------------------------------------------------------------

DO $do$
DECLARE
  v_policy RECORD;
  v_function RECORD;
  v_function_definition TEXT;
  v_invalid_bucket_setting BOOLEAN := false;
  v_finance_function REGPROCEDURE :=
    'public.admin_update_user_subscription_wallet(uuid,uuid,text,public.subscription_status,text,integer,integer,integer,integer,numeric,date,boolean,numeric)'::REGPROCEDURE;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'drivers'
      AND cmd IN ('INSERT', 'ALL')
      AND policyname NOT IN (
        'drivers_self_register_pending',
        'drivers_fleet_create_scoped',
        'drivers_aal2_admin_manage'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected driver INSERT/ALL policy remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.drivers'::REGCLASS
      AND t.tgname = 'enforce_driver_authorization_boundary'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Driver authorization trigger is missing or disabled';
  END IF;

  v_function_definition := lower(pg_get_functiondef(
    'public.enforce_driver_authorization_boundary()'::REGPROCEDURE
  ));
  IF v_function_definition LIKE '%rolsuper%'
     OR v_function_definition LIKE '%rolbypassrls%'
     OR v_function_definition LIKE '%v_is_trusted_definer%'
     OR v_function_definition LIKE '%pg_trigger_depth%' THEN
    RAISE EXCEPTION 'Driver boundary trusts an ambient definer or trigger depth';
  END IF;
  IF v_function_definition NOT LIKE '%app.delivery_claim_authorized%'
     OR v_function_definition NOT LIKE '%delivery_assignment_scope_violation%'
     OR v_function_definition NOT LIKE '%current_job_id%updated_at%' THEN
    RAISE EXCEPTION 'Driver assignment capability is not narrowly scoped';
  END IF;

  v_function_definition := lower(pg_get_functiondef(
    'public.sync_driver_current_job()'::REGPROCEDURE
  ));
  IF v_function_definition NOT LIKE '%set_config%app.delivery_claim_authorized%true%'
     OR v_function_definition LIKE '%pg_trigger_depth%' THEN
    RAISE EXCEPTION 'Driver delivery sync does not set the reviewed capability';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'restaurants'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND policyname NOT IN (
        'restaurants_partner_apply_pending',
        'restaurants_approved_operator_update',
        'restaurants_aal2_admin_manage'
      )
  ) THEN
    RAISE EXCEPTION 'Unexpected restaurant write policy remains';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.restaurants'::REGCLASS
      AND t.tgname = 'enforce_restaurant_authorization_boundary'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Restaurant authorization trigger is missing or disabled';
  END IF;

  v_function_definition := lower(pg_get_functiondef(
    'public.enforce_restaurant_authorization_boundary()'::REGPROCEDURE
  ));
  IF v_function_definition LIKE '%rolsuper%'
     OR v_function_definition LIKE '%rolbypassrls%'
     OR v_function_definition LIKE '%v_is_trusted_definer%' THEN
    RAISE EXCEPTION 'Restaurant boundary trusts an ambient definer';
  END IF;
  IF v_function_definition NOT LIKE '%old.owner_id%v_actor%'
     OR v_function_definition NOT LIKE '%restaurant_staff%'
     OR v_function_definition NOT LIKE '%manage_restaurant%'
     OR v_function_definition NOT LIKE '%is_restaurant_operator%'
     OR v_function_definition NOT LIKE '%restaurant_tenant_update_forbidden%' THEN
    RAISE EXCEPTION 'Restaurant trigger does not enforce tenant-scoped updates';
  END IF;

  v_function_definition := lower(pg_get_functiondef(
    'public.is_restaurant_operator(uuid,uuid)'::REGPROCEDURE
  ));
  IF v_function_definition NOT LIKE '%approval_status%approved%'
     OR v_function_definition NOT LIKE '%is_active%'
     OR v_function_definition NOT LIKE '%deleted_at%' THEN
    RAISE EXCEPTION 'Restaurant operator helper does not enforce active approval';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'subscriptions_admin_manage'
      AND lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, ''))
        LIKE '%user_roles%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscriptions'
      AND policyname = 'subscriptions_admin_manage'
      AND lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, ''))
        LIKE '%has_role%'
  ) THEN
    RAISE EXCEPTION 'Subscription admin policy is not MFA-aware';
  END IF;

  v_function_definition := lower(pg_get_functiondef(v_finance_function));
  IF v_function_definition NOT LIKE '%admin_aal2_required%'
     OR v_function_definition NOT LIKE '%auth.jwt%aal%'
     OR v_function_definition NOT LIKE '%has_role%admin%' THEN
    RAISE EXCEPTION 'Admin finance RPC does not enforce AAL2';
  END IF;

  IF has_function_privilege('anon', v_finance_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role can execute admin finance RPC';
  END IF;

  IF NOT has_function_privilege('authenticated', v_finance_function, 'EXECUTE')
     OR NOT has_function_privilege('service_role', v_finance_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'Admin finance RPC grants are incomplete';
  END IF;

  FOR v_function IN
    SELECT p.oid, p.oid::REGPROCEDURE AS signature
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('unassign_driver', 'auto_assign_driver')
  LOOP
    IF has_function_privilege('anon', v_function.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', v_function.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Legacy assignment RPC remains client-callable: %', v_function.signature;
    END IF;

    IF NOT has_function_privilege('service_role', v_function.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Service role cannot execute assignment RPC: %', v_function.signature;
    END IF;
  END LOOP;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'restaurant_logo_authorized_insert',
        'restaurant_logo_authorized_update',
        'restaurant_logo_authorized_delete',
        'meal_image_authorized_insert',
        'meal_image_authorized_update',
        'meal_image_authorized_delete'
      )
  ) <> 6 THEN
    RAISE EXCEPTION 'Expected media write policies were not installed';
  END IF;

  v_function_definition := lower(pg_get_functiondef(
    'public.can_write_restaurant_logo_object(text,text,uuid)'::REGPROCEDURE
  ));
  IF v_function_definition NOT LIKE '%p_owner_id%p_user_id%'
     OR v_function_definition NOT LIKE '%storage.filename(p_name)%p_user_id%-%'
     OR v_function_definition NOT LIKE '%has_role%partner%'
     OR v_function_definition NOT LIKE '%is_restaurant_operator%' THEN
    RAISE EXCEPTION 'Restaurant logo helper is not onboarding/operator scoped';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.buckets'::REGCLASS
      AND attname = 'file_size_limit'
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id IN ('restaurant-logos', 'meal-images')
          AND (file_size_limit IS NULL OR file_size_limit > 5242880)
      )
    $sql$ INTO v_invalid_bucket_setting;

    IF v_invalid_bucket_setting THEN
      RAISE EXCEPTION 'Public media bucket exceeds the 5 MiB upload cap';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.buckets'::REGCLASS
      AND attname = 'allowed_mime_types'
      AND attnum > 0
      AND NOT attisdropped
  ) THEN
    EXECUTE $sql$
      SELECT EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id IN ('restaurant-logos', 'meal-images')
          AND allowed_mime_types IS DISTINCT FROM ARRAY[
            'image/jpeg',
            'image/png',
            'image/webp'
          ]::TEXT[]
      )
    $sql$ INTO v_invalid_bucket_setting;

    IF v_invalid_bucket_setting THEN
      RAISE EXCEPTION 'Public media bucket MIME allowlist is not hardened';
    END IF;
  END IF;

  FOR v_policy IN
    SELECT policyname, cmd, qual, with_check
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  LOOP
    v_function_definition := lower(
      COALESCE(v_policy.qual, '') || ' ' || COALESCE(v_policy.with_check, '')
    );

    IF (
      v_function_definition LIKE '%restaurant-logos%'
      OR v_function_definition LIKE '%meal-images%'
    ) AND v_policy.policyname NOT IN (
      'restaurant_logo_authorized_insert',
      'restaurant_logo_authorized_update',
      'restaurant_logo_authorized_delete',
      'meal_image_authorized_insert',
      'meal_image_authorized_update',
      'meal_image_authorized_delete'
    ) THEN
      RAISE EXCEPTION 'Legacy media write policy remains: %', v_policy.policyname;
    END IF;

    IF v_function_definition NOT LIKE '%bucket_id%' THEN
      RAISE EXCEPTION 'Storage write policy is not bucket-scoped: %', v_policy.policyname;
    END IF;
  END LOOP;
END;
$do$;

NOTIFY pgrst, 'reload schema';

COMMIT;
