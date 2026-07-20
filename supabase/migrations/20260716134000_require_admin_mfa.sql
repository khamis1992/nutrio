BEGIN;

-- Centralize step-up enforcement. Existing RLS policies and SECURITY DEFINER
-- RPCs already call has_role, so requiring aal2 here protects the whole admin
-- data plane instead of relying on a cosmetic frontend gate.
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(auth.role(), '') = 'service_role' THEN EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = _role
    )
    WHEN auth.uid() IS NULL THEN FALSE
    WHEN _user_id <> auth.uid()
      AND NOT (
        COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        AND EXISTS (
          SELECT 1
          FROM public.user_roles current_actor_role
          WHERE current_actor_role.user_id = auth.uid()
            AND current_actor_role.role = 'admin'::public.app_role
        )
      )
    THEN FALSE
    WHEN _role = 'admin'::public.app_role
      AND COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
    THEN FALSE
    ELSE EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = _role
    )
  END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_record_mfa_verification()
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
BEGIN
  IF v_actor IS NULL
     OR COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'
     OR NOT public.has_role(v_actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'ADMIN_AAL2_REQUIRED';
  END IF;

  BEGIN
    v_headers := COALESCE(NULLIF(current_setting('request.headers', true), '')::JSONB, '{}'::JSONB);
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
    'authentication.admin_mfa_verified',
    'authentication',
    'medium',
    'auth',
    'success',
    v_actor,
    'admin',
    'admin',
    'step_up_authentication',
    'auth.session',
    v_actor::TEXT,
    COALESCE(v_headers ->> 'x-request-id', v_headers ->> 'sb-request-id'),
    v_ip,
    v_headers ->> 'cf-ipcountry',
    v_headers ->> 'user-agent',
    jsonb_build_object('aal', 'aal2'),
    repeat('0', 64)
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_record_mfa_verification() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_record_mfa_verification() TO authenticated;

COMMENT ON FUNCTION public.has_role(UUID, public.app_role) IS
  'Caller-scoped role check with mandatory aal2 step-up for admin privileges and cross-user role inspection.';

-- Remove or replace historical policies that read user_roles directly. A
-- direct role lookup would bypass the AAL check centralized in has_role.
DO $do$
BEGIN
  IF to_regclass('public.subscriptions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS subscriptions_admin_manage ON public.subscriptions';
    EXECUTE $policy$
      CREATE POLICY subscriptions_admin_manage
      ON public.subscriptions FOR ALL TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('public.premium_analytics_purchases') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all premium analytics purchases" ON public.premium_analytics_purchases';
  END IF;

  IF to_regclass('public.meal_reviews') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can moderate all reviews" ON public.meal_reviews';
    EXECUTE $policy$
      CREATE POLICY "Admins can moderate all reviews"
      ON public.meal_reviews FOR ALL TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('public.meal_skip_reasons') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all skip reasons for analytics" ON public.meal_skip_reasons';
    EXECUTE $policy$
      CREATE POLICY "Admins can view all skip reasons for analytics"
      ON public.meal_skip_reasons FOR ALL TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('public.gdpr_export_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all export logs" ON public.gdpr_export_logs';
    EXECUTE $policy$
      CREATE POLICY "Admins can view all export logs"
      ON public.gdpr_export_logs FOR SELECT TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('admin.disaster_recovery_procedures') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Only admins can view DR procedures" ON admin.disaster_recovery_procedures';
    EXECUTE $policy$
      CREATE POLICY "Only admins can view DR procedures"
      ON admin.disaster_recovery_procedures FOR ALL TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('public.coach_earnings') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_manage_earnings" ON public.coach_earnings';
    EXECUTE $policy$
      CREATE POLICY "admin_manage_earnings"
      ON public.coach_earnings FOR SELECT TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('public.platform_commission_config') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "admin_manage_commission" ON public.platform_commission_config';
    EXECUTE $policy$
      CREATE POLICY "admin_manage_commission"
      ON public.platform_commission_config FOR ALL TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('public.payment_provider_events') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS payment_provider_events_admin_read ON public.payment_provider_events';
    EXECUTE $policy$
      CREATE POLICY payment_provider_events_admin_read
      ON public.payment_provider_events FOR SELECT TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  IF to_regclass('public.coach_subscriptions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS coach_subscription_admin_manage ON public.coach_subscriptions';
    EXECUTE $policy$
      CREATE POLICY coach_subscription_admin_manage
      ON public.coach_subscriptions FOR ALL TO authenticated
      USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
      WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
    $policy$;
  END IF;

  -- Later hardened migrations already remove these policies. Dropping them
  -- again makes this migration safe against partially divergent environments.
  IF to_regclass('public.coach_withdrawal_requests') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "admins_manage_withdrawals" ON public.coach_withdrawal_requests';
    EXECUTE 'DROP POLICY IF EXISTS "admins_view_withdrawals" ON public.coach_withdrawal_requests';
  END IF;
  IF to_regclass('public.recovery_offers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access to recovery_offers" ON public.recovery_offers';
  END IF;
  IF to_regclass('public.subscription_recovery') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin full access to subscription_recovery" ON public.subscription_recovery';
  END IF;
  IF to_regclass('public.order_status_history') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert order status history" ON public.order_status_history';
    REVOKE INSERT, UPDATE, DELETE ON public.order_status_history FROM anon, authenticated;
  END IF;
END;
$do$;

-- Retire legacy financial entry points that accepted an arbitrary admin UUID.
-- Their verified, idempotent replacements remain available through the newer
-- payment, wallet, order, and payout lifecycle RPCs.
DO $do$
DECLARE
  v_signature REGPROCEDURE;
BEGIN
  FOR v_signature IN
    SELECT p.oid::REGPROCEDURE
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'aggregate_restaurant_payouts',
        'process_payout_transfer',
        'award_bonus_credits',
        'allocate_subscription_credits',
        'deduct_meal_credit'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_signature
    );
  END LOOP;
END;
$do$;

-- Close historical portal policies that checked user_roles directly and
-- therefore bypassed the MFA-aware role contract.
DO $do$
BEGIN
  IF to_regclass('public.delivery_groups') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all delivery groups" ON public.delivery_groups';
    EXECUTE 'CREATE POLICY "Admins can view all delivery groups" ON public.delivery_groups FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))';
  END IF;
  IF to_regclass('public.driver_earning_rules') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage driver earning rules" ON public.driver_earning_rules';
    EXECUTE 'CREATE POLICY "Admins can manage driver earning rules" ON public.driver_earning_rules FOR ALL TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role)) WITH CHECK (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))';
  END IF;
  IF to_regclass('public.driver_locations') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all locations" ON public.driver_locations';
    EXECUTE 'CREATE POLICY "Admins can view all locations" ON public.driver_locations FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))';
  END IF;
  IF to_regclass('public.drivers') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert drivers" ON public.drivers';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update drivers" ON public.drivers';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all drivers" ON public.drivers';
    EXECUTE 'CREATE POLICY "Admins can insert drivers" ON public.drivers FOR INSERT TO authenticated WITH CHECK (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))';
    EXECUTE 'CREATE POLICY "Admins can update drivers" ON public.drivers FOR UPDATE TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role)) WITH CHECK (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))';
    EXECUTE 'CREATE POLICY "Admins can view all drivers" ON public.drivers FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))';
  END IF;
  IF to_regclass('public.meals') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update any meal" ON public.meals';
    EXECUTE 'CREATE POLICY "Admins can update any meal" ON public.meals FOR UPDATE TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin''::public.app_role)) WITH CHECK (public.has_role((SELECT auth.uid()), ''admin''::public.app_role))';
  END IF;
END;
$do$;

DROP POLICY IF EXISTS notifications_authorized_insert ON public.notifications;
CREATE POLICY notifications_authorized_insert
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'staff'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.coach_client_assignments assignment
      WHERE assignment.coach_id = (SELECT auth.uid())
        AND assignment.client_id = notifications.user_id
        AND assignment.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.delivery_jobs job
      JOIN public.drivers driver ON driver.id = job.driver_id
      JOIN public.restaurants restaurant ON restaurant.id = job.restaurant_id
      WHERE job.id = NULLIF(notifications.data ->> 'delivery_job_id', '')::UUID
        AND driver.user_id = notifications.user_id
        AND restaurant.owner_id = (SELECT auth.uid())
    )
  );

-- Deployment guard: fail closed if another historical policy still grants
-- admin access by querying user_roles instead of the MFA-aware role function.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%user_roles%'
      AND lower(COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) LIKE '%admin%'
  LOOP
    RAISE EXCEPTION
      'Unsafe direct admin policy remains: %.% (%)',
      v_policy.schemaname,
      v_policy.tablename,
      v_policy.policyname;
  END LOOP;
END;
$do$;

NOTIFY pgrst, 'reload schema';

COMMIT;
