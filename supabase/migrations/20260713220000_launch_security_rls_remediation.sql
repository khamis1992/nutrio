-- Launch security remediation for public API tables and legacy views.

-- Public read-only catalog tables. Mutations are admin/service-only.
DO $do$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'challenge_definitions', 'addon_categories', 'delivery_zones',
    'cuisine_types', 'achievement_definitions', 'faq'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_public_read', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (is_active = true OR public.has_role((SELECT auth.uid()), ''admin''))',
      v_table || '_public_read', v_table
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_table || '_admin_manage', v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role((SELECT auth.uid()), ''admin'')) WITH CHECK (public.has_role((SELECT auth.uid()), ''admin''))',
      v_table || '_admin_manage', v_table
    );
  END LOOP;
END;
$do$;

ALTER TABLE public.allergen_tags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.allergen_tags FROM anon, authenticated;
GRANT SELECT ON public.allergen_tags TO anon, authenticated;
GRANT ALL ON public.allergen_tags TO service_role;
DROP POLICY IF EXISTS allergen_tags_public_read ON public.allergen_tags;
CREATE POLICY allergen_tags_public_read ON public.allergen_tags
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS allergen_tags_admin_manage ON public.allergen_tags;
CREATE POLICY allergen_tags_admin_manage ON public.allergen_tags FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

-- Coach/client assignments already have ownership policies; enforce them.
ALTER TABLE public.coach_client_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_client_assignments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_client_assignments TO authenticated;
GRANT ALL ON public.coach_client_assignments TO service_role;

-- Restaurant-owned menu configuration.
DO $do$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['addons', 'meal_ingredients', 'meal_options', 'meal_option_values', 'restaurant_hours'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
  END LOOP;
END;
$do$;

DROP POLICY IF EXISTS addons_public_read ON public.addons;
CREATE POLICY addons_public_read ON public.addons FOR SELECT TO anon, authenticated
  USING (is_active OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = (SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));
DROP POLICY IF EXISTS addons_owner_manage ON public.addons;
CREATE POLICY addons_owner_manage ON public.addons FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = (SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.owner_id = (SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS meal_ingredients_public_read ON public.meal_ingredients;
CREATE POLICY meal_ingredients_public_read ON public.meal_ingredients FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS meal_ingredients_owner_manage ON public.meal_ingredients;
CREATE POLICY meal_ingredients_owner_manage ON public.meal_ingredients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m JOIN public.restaurants r ON r.id=m.restaurant_id WHERE m.id=meal_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meals m JOIN public.restaurants r ON r.id=m.restaurant_id WHERE m.id=meal_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS meal_options_public_read ON public.meal_options;
CREATE POLICY meal_options_public_read ON public.meal_options FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS meal_options_owner_manage ON public.meal_options;
CREATE POLICY meal_options_owner_manage ON public.meal_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meals m JOIN public.restaurants r ON r.id=m.restaurant_id WHERE m.id=meal_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meals m JOIN public.restaurants r ON r.id=m.restaurant_id WHERE m.id=meal_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS meal_option_values_public_read ON public.meal_option_values;
CREATE POLICY meal_option_values_public_read ON public.meal_option_values FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS meal_option_values_owner_manage ON public.meal_option_values;
CREATE POLICY meal_option_values_owner_manage ON public.meal_option_values FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.meal_options mo JOIN public.meals m ON m.id=mo.meal_id JOIN public.restaurants r ON r.id=m.restaurant_id WHERE mo.id=meal_option_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meal_options mo JOIN public.meals m ON m.id=mo.meal_id JOIN public.restaurants r ON r.id=m.restaurant_id WHERE mo.id=meal_option_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))));

DROP POLICY IF EXISTS restaurant_hours_public_read ON public.restaurant_hours;
CREATE POLICY restaurant_hours_public_read ON public.restaurant_hours FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS restaurant_hours_owner_manage ON public.restaurant_hours;
CREATE POLICY restaurant_hours_owner_manage ON public.restaurant_hours FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND (r.owner_id=(SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'))));

-- Partner financial and staff records.
ALTER TABLE public.premium_analytics_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premium_analytics_purchases, public.restaurant_payouts, public.restaurant_staff FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_analytics_purchases, public.restaurant_staff TO authenticated;
GRANT SELECT ON public.restaurant_payouts TO authenticated;
GRANT ALL ON public.premium_analytics_purchases, public.restaurant_payouts, public.restaurant_staff TO service_role;

DROP POLICY IF EXISTS premium_analytics_owner_read ON public.premium_analytics_purchases;
CREATE POLICY premium_analytics_owner_read ON public.premium_analytics_purchases FOR SELECT TO authenticated
  USING (partner_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND r.owner_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));
DROP POLICY IF EXISTS premium_analytics_admin_manage ON public.premium_analytics_purchases;
CREATE POLICY premium_analytics_admin_manage ON public.premium_analytics_purchases FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin')) WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS restaurant_payouts_owner_read ON public.restaurant_payouts;
CREATE POLICY restaurant_payouts_owner_read ON public.restaurant_payouts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND r.owner_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS restaurant_staff_scoped_read ON public.restaurant_staff;
CREATE POLICY restaurant_staff_scoped_read ON public.restaurant_staff FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.user_id=(SELECT auth.uid())) OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND r.owner_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));
DROP POLICY IF EXISTS restaurant_staff_owner_manage ON public.restaurant_staff;
CREATE POLICY restaurant_staff_owner_manage ON public.restaurant_staff FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND r.owner_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id=restaurant_id AND r.owner_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));

-- Driver data is visible only to the driver or admins. License data is no longer public.
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_profiles, public.driver_orders FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.driver_profiles TO authenticated;
GRANT SELECT, UPDATE ON public.driver_orders TO authenticated;
GRANT ALL ON public.driver_profiles, public.driver_orders TO service_role;

DROP POLICY IF EXISTS driver_profiles_owner_read ON public.driver_profiles;
CREATE POLICY driver_profiles_owner_read ON public.driver_profiles FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.user_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));
DROP POLICY IF EXISTS driver_profiles_owner_update ON public.driver_profiles;
CREATE POLICY driver_profiles_owner_update ON public.driver_profiles FOR UPDATE TO authenticated
  USING (user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.user_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (user_id=(SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=user_id AND p.user_id=(SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));

DROP POLICY IF EXISTS driver_orders_owner_read ON public.driver_orders;
CREATE POLICY driver_orders_owner_read ON public.driver_orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.driver_profiles dp LEFT JOIN public.profiles p ON p.id=dp.user_id WHERE dp.id=driver_id AND (dp.user_id=(SELECT auth.uid()) OR p.user_id=(SELECT auth.uid()))) OR public.has_role((SELECT auth.uid()), 'admin'));
DROP POLICY IF EXISTS driver_orders_owner_update ON public.driver_orders;
CREATE POLICY driver_orders_owner_update ON public.driver_orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.driver_profiles dp LEFT JOIN public.profiles p ON p.id=dp.user_id WHERE dp.id=driver_id AND (dp.user_id=(SELECT auth.uid()) OR p.user_id=(SELECT auth.uid()))) OR public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.driver_profiles dp LEFT JOIN public.profiles p ON p.id=dp.user_id WHERE dp.id=driver_id AND (dp.user_id=(SELECT auth.uid()) OR p.user_id=(SELECT auth.uid()))) OR public.has_role((SELECT auth.uid()), 'admin'));

-- Internal operational tables are service-only.
DO $do$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'delivery_status_history', 'verification_attempts', 'rate_limits',
    'revoked_tokens', 'edge_function_schedule', 'test_table'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', v_table);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_table);
  END LOOP;
END;
$do$;

-- Views must respect the invoking role and underlying RLS policies.
ALTER VIEW public.user_orders_view SET (security_invoker = true);
ALTER VIEW public.webhook_queue_status SET (security_invoker = true);
ALTER VIEW public.restaurant_capacity_status SET (security_invoker = true);
ALTER VIEW public.challenge_leaderboard SET (security_invoker = true);
ALTER VIEW public.slow_query_candidates SET (security_invoker = true);
ALTER VIEW public.restaurant_details_secure SET (security_invoker = true);
ALTER VIEW public.translation_statistics SET (security_invoker = true);

REVOKE ALL ON public.user_orders_view, public.webhook_queue_status,
  public.restaurant_capacity_status, public.challenge_leaderboard,
  public.slow_query_candidates, public.restaurant_details_secure,
  public.translation_statistics FROM anon, authenticated;
GRANT SELECT ON public.user_orders_view, public.restaurant_capacity_status,
  public.challenge_leaderboard, public.restaurant_details_secure,
  public.translation_statistics TO authenticated;
GRANT SELECT ON public.webhook_queue_status, public.slow_query_candidates TO service_role;
