-- Admin operational dashboards must be able to audit every scheduled meal.
DROP POLICY IF EXISTS "Admins can view all meal schedules" ON public.meal_schedules;
CREATE POLICY "Admins can view all meal schedules"
  ON public.meal_schedules
  FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Fleet operators need read-only access to both customer order sources in
-- order to build the dispatch queue. Assignment writes remain guarded by the
-- delivery lifecycle trigger and delivery_jobs policies.
DROP POLICY IF EXISTS "Fleet operators can view dispatch orders" ON public.orders;
CREATE POLICY "Fleet operators can view dispatch orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (public.is_active_fleet_operator((SELECT auth.uid())));

DROP POLICY IF EXISTS "Fleet operators can view dispatch schedules" ON public.meal_schedules;
CREATE POLICY "Fleet operators can view dispatch schedules"
  ON public.meal_schedules
  FOR SELECT
  TO authenticated
  USING (public.is_active_fleet_operator((SELECT auth.uid())));

DROP POLICY IF EXISTS "Fleet operators can view dispatch customer profiles" ON public.profiles;
CREATE POLICY "Fleet operators can view dispatch customer profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_fleet_operator((SELECT auth.uid()))
    AND (
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.user_id = profiles.user_id
          AND o.status IN ('preparing', 'ready_for_pickup')
      )
      OR EXISTS (
        SELECT 1 FROM public.meal_schedules ms
        WHERE ms.user_id = profiles.user_id
          AND ms.order_status IN ('preparing', 'ready')
          AND COALESCE(ms.delivery_type, 'delivery') <> 'pickup'
      )
    )
  );

DROP POLICY IF EXISTS "Fleet operators can view dispatch addresses" ON public.user_addresses;
CREATE POLICY "Fleet operators can view dispatch addresses"
  ON public.user_addresses
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_fleet_operator((SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.meal_schedules ms
      WHERE ms.user_id = user_addresses.user_id
        AND ms.order_status IN ('preparing', 'ready')
        AND COALESCE(ms.delivery_type, 'delivery') <> 'pickup'
    )
  );
