-- Replace permissive launch-era policies with portal-scoped access rules.

CREATE OR REPLACE FUNCTION public.can_manage_fleet_city(p_city_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.fleet_managers fm
      WHERE fm.auth_user_id = auth.uid()
        AND fm.is_active = true
        AND (
          fm.role = 'super_admin'
          OR (p_city_id IS NOT NULL AND p_city_id = ANY(COALESCE(fm.assigned_city_ids, ARRAY[]::uuid[])))
        )
    );
$function$;

REVOKE ALL ON FUNCTION public.can_manage_fleet_city(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_fleet_city(uuid) TO authenticated, service_role;

-- Public geographic catalogs are read-only; fleet operators manage their scope.
DROP POLICY IF EXISTS "Cities full access" ON public.cities;
CREATE POLICY "Public can view active cities"
  ON public.cities FOR SELECT TO anon, authenticated
  USING (is_active = true OR public.can_manage_fleet_city(id));
CREATE POLICY "Fleet operators can manage cities"
  ON public.cities FOR ALL TO authenticated
  USING (public.can_manage_fleet_city(id))
  WITH CHECK (public.can_manage_fleet_city(id));

DROP POLICY IF EXISTS "Zones full access" ON public.zones;
CREATE POLICY "Authenticated users can view active zones"
  ON public.zones FOR SELECT TO authenticated
  USING (is_active = true OR public.can_manage_fleet_city(city_id));
CREATE POLICY "Fleet operators can manage zones"
  ON public.zones FOR ALL TO authenticated
  USING (public.can_manage_fleet_city(city_id))
  WITH CHECK (public.can_manage_fleet_city(city_id));

DROP POLICY IF EXISTS "Vehicles full access" ON public.vehicles;
CREATE POLICY "Drivers can view assigned vehicles"
  ON public.vehicles FOR SELECT TO authenticated
  USING (
    public.can_manage_fleet_city(city_id)
    OR EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = vehicles.assigned_driver_id AND d.user_id = auth.uid()
    )
  );
CREATE POLICY "Fleet operators can manage vehicles"
  ON public.vehicles FOR ALL TO authenticated
  USING (public.can_manage_fleet_city(city_id))
  WITH CHECK (public.can_manage_fleet_city(city_id));

-- Fleet identities and logs are private to the owner, admins, and assigned fleet scope.
DROP POLICY IF EXISTS "Fleet managers full access" ON public.fleet_managers;
CREATE POLICY "Admins can manage fleet managers"
  ON public.fleet_managers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Fleet managers can update own safe profile"
  ON public.fleet_managers FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND is_active = true)
  WITH CHECK (auth_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_fleet_manager_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND (
       NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.assigned_city_ids IS DISTINCT FROM OLD.assigned_city_ids
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.country IS DISTINCT FROM OLD.country
     ) THEN
    RAISE EXCEPTION 'Fleet manager privileged fields may only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_fleet_manager_privileged_fields ON public.fleet_managers;
CREATE TRIGGER protect_fleet_manager_privileged_fields
BEFORE UPDATE ON public.fleet_managers
FOR EACH ROW EXECUTE FUNCTION public.protect_fleet_manager_privileged_fields();

DROP POLICY IF EXISTS "Fleet activity full access" ON public.fleet_activity_log;
CREATE POLICY "Fleet operators can view scoped activity"
  ON public.fleet_activity_log FOR SELECT TO authenticated
  USING (public.can_manage_fleet_city(city_id));
CREATE POLICY "Fleet operators can append own activity"
  ON public.fleet_activity_log FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_fleet_city(city_id)
    AND manager_id = (SELECT fm.id FROM public.fleet_managers fm WHERE fm.auth_user_id = auth.uid() AND fm.is_active = true LIMIT 1)
  );

-- Drivers can access their own records; fleet operators are limited by city.
DROP POLICY IF EXISTS "Anyone can create driver record" ON public.drivers;
CREATE POLICY "Fleet operators can create scoped drivers"
  ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_fleet_city(city_id));
CREATE POLICY "Fleet operators can update scoped drivers"
  ON public.drivers FOR UPDATE TO authenticated
  USING (public.can_manage_fleet_city(city_id))
  WITH CHECK (public.can_manage_fleet_city(city_id));

CREATE OR REPLACE FUNCTION public.protect_driver_financial_and_approval_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF auth.uid() = OLD.user_id
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND NOT public.can_manage_fleet_city(OLD.city_id)
     AND (
       NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
       OR NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
       OR NEW.total_earnings IS DISTINCT FROM OLD.total_earnings
       OR NEW.total_deliveries IS DISTINCT FROM OLD.total_deliveries
       OR NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.cancellation_rate IS DISTINCT FROM OLD.cancellation_rate
       OR NEW.payout_details IS DISTINCT FROM OLD.payout_details
       OR NEW.city_id IS DISTINCT FROM OLD.city_id
       OR NEW.assigned_zone_ids IS DISTINCT FROM OLD.assigned_zone_ids
     ) THEN
    RAISE EXCEPTION 'Driver financial, approval, and assignment fields require fleet approval';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_driver_financial_and_approval_fields ON public.drivers;
CREATE TRIGGER protect_driver_financial_and_approval_fields
BEFORE UPDATE ON public.drivers
FOR EACH ROW EXECUTE FUNCTION public.protect_driver_financial_and_approval_fields();

DROP POLICY IF EXISTS "Driver activity full access" ON public.driver_activity_log;
CREATE POLICY "Drivers can view own activity"
  ON public.driver_activity_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Drivers can append own activity"
  ON public.driver_activity_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Fleet operators can view driver activity"
  ON public.driver_activity_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.can_manage_fleet_city(d.city_id)));

DROP POLICY IF EXISTS "Driver documents full access" ON public.driver_documents;
CREATE POLICY "Drivers can view own documents"
  ON public.driver_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Drivers can upload own documents"
  ON public.driver_documents FOR INSERT TO authenticated
  WITH CHECK (
    verification_status = 'pending'
    AND verified_by IS NULL
    AND verified_at IS NULL
    AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
  );
CREATE POLICY "Fleet operators can manage driver documents"
  ON public.driver_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.can_manage_fleet_city(d.city_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND public.can_manage_fleet_city(d.city_id)));

-- Legacy deliveries remain visible only to involved users and approved drivers.
DROP POLICY IF EXISTS "Drivers can view available deliveries" ON public.deliveries_legacy;
CREATE POLICY "Authorized users can view legacy deliveries"
  ON public.deliveries_legacy FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid())
    OR (
      status = 'pending'::public.delivery_status
      AND driver_id IS NULL
      AND EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.is_active = true AND d.approval_status = 'approved')
    )
    OR public.is_restaurant_operator(restaurant_id, auth.uid())
  );
DROP POLICY IF EXISTS "System can create deliveries" ON public.deliveries_legacy;

-- Order history is private; inserts are performed by trusted backend code and triggers.
DROP POLICY IF EXISTS "Public read access for order_status_history" ON public.order_status_history;
DROP POLICY IF EXISTS "Allow inserts to order_status_history" ON public.order_status_history;

-- Partner requests are submitted through trusted backend workflows and read by admins only.
DROP POLICY IF EXISTS "Admins can view partner requests" ON public.partner_requests;
DROP POLICY IF EXISTS "Anyone can submit partner requests" ON public.partner_requests;
CREATE POLICY "Admins can view partner requests"
  ON public.partner_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can manage partner requests"
  ON public.partner_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "authenticated_can_manage_health_tips" ON public.health_tips;
CREATE POLICY "Admins can manage health tips"
  ON public.health_tips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "authenticated_users_full_access_restaurants" ON public.restaurants;

DROP POLICY IF EXISTS "Allow credit_wallet function to insert" ON wallet_service.wallet_transactions;

-- Remove direct API privileges that are unnecessary even with RLS enabled.
REVOKE ALL ON public.cities, public.health_tips, public.restaurants FROM anon;
REVOKE ALL ON public.deliveries_legacy, public.driver_activity_log, public.driver_documents,
  public.drivers, public.fleet_activity_log, public.fleet_managers, public.order_status_history,
  public.partner_requests, public.vehicles, public.zones FROM anon;
REVOKE ALL ON public.deliveries_legacy, public.driver_activity_log, public.fleet_activity_log,
  public.order_status_history FROM authenticated;
REVOKE INSERT ON wallet_service.wallet_transactions FROM authenticated;
REVOKE ALL ON public.analytics_daily_stats FROM anon, authenticated;

GRANT SELECT ON public.cities, public.health_tips, public.restaurants TO anon;
GRANT SELECT ON public.cities, public.health_tips, public.restaurants, public.zones TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers, public.driver_documents,
  public.fleet_managers, public.vehicles, public.zones TO authenticated;
GRANT SELECT, INSERT ON public.driver_activity_log, public.fleet_activity_log TO authenticated;
GRANT SELECT, UPDATE ON public.deliveries_legacy TO authenticated;
GRANT SELECT ON public.order_status_history, public.partner_requests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.partner_requests TO authenticated;

-- Internal utility schemas must not expose operational or cryptographic helpers to API roles.
DO $do$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('audit', 'rate_limit', 'security', 'soft_delete')
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path TO %I, public, pg_temp', fn.nspname, fn.proname, fn.args, fn.nspname);
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated', fn.nspname, fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', fn.nspname, fn.proname, fn.args);
  END LOOP;
END;
$do$;

-- These PostGIS inspection helpers do not need anonymous RPC exposure.
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.st_estimatedextent(text, text, text, boolean) FROM PUBLIC, anon;
