-- Remove customer access to the base restaurant/meal records. Public and
-- customer code must use the reviewed catalog projections so internal owner,
-- moderation, cost, banking, and payout fields cannot be selected.

BEGIN;

-- Keep compatibility fields that are constant under the projection filters.
-- This lets existing catalog filters migrate without exposing rejected rows.
CREATE OR REPLACE VIEW public.public_restaurant_catalog
WITH (security_barrier = true)
AS
SELECT
  r.id,
  r.name,
  r.description,
  r.address,
  r.phone,
  r.phone_number,
  r.website,
  r.logo_url,
  r.image_url,
  r.latitude,
  r.longitude,
  r.location,
  r.building_number,
  r.street_number,
  r.zone_number,
  r.cuisine_type,
  r.cuisine_types,
  r.dietary_tags,
  r.operating_hours,
  r.avg_prep_time_minutes,
  r.rating,
  r.avg_rating,
  r.review_count,
  r.reviews_count,
  r.total_orders,
  r.status,
  r.is_partner,
  r.approval_status,
  r.is_active,
  r.deleted_at,
  r.created_at,
  r.updated_at
FROM public.restaurants r
WHERE r.approval_status = 'approved'::public.approval_status
  AND COALESCE(r.is_active, false) = true
  AND r.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.public_meal_catalog
WITH (security_barrier = true)
AS
SELECT
  m.id,
  m.restaurant_id,
  r.name AS restaurant_name,
  m.name,
  m.description,
  m.image_url,
  m.category,
  m.category_id,
  m.meal_type,
  m.ingredients,
  m.calories,
  m.protein,
  m.protein_g,
  m.carbs,
  m.carbs_g,
  m.fats,
  m.fat_g,
  m.fiber_g,
  m.price,
  m.prep_time_minutes,
  m.rating,
  m.avg_rating,
  m.review_count,
  m.order_count,
  m.is_featured,
  m.is_vip_exclusive,
  m.supports_high_protein,
  m.high_protein_price_adjustment,
  m.high_protein_calories_increase,
  m.high_protein_protein_increase,
  m.supports_large,
  m.large_price_adjustment,
  m.large_calories_increase,
  m.large_protein_increase,
  m.primary_language,
  m.vendor,
  m.featured_priority,
  m.approval_status,
  m.is_available,
  m.deleted_at,
  m.created_at
FROM public.meals m
JOIN public.restaurants r ON r.id = m.restaurant_id
WHERE m.approval_status = 'approved'
  AND COALESCE(m.is_available, false) = true
  AND m.deleted_at IS NULL
  AND r.approval_status = 'approved'::public.approval_status
  AND COALESCE(r.is_active, false) = true
  AND r.deleted_at IS NULL;

REVOKE ALL ON public.public_restaurant_catalog, public.public_meal_catalog
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_restaurant_catalog, public.public_meal_catalog
  TO anon, authenticated;

-- Remove every historical SELECT policy, including policy-name variants from
-- old migrations. Mutation policies are retained and remain field-guarded.
DO $do$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('restaurants', 'meals')
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  END LOOP;
END;
$do$;

CREATE POLICY restaurants_operator_select
  ON public.restaurants FOR SELECT TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.staff_members sm
      WHERE sm.restaurant_id = restaurants.id
        AND sm.user_id = (SELECT auth.uid())
        AND COALESCE(sm.is_active, false) = true
    )
  );

CREATE POLICY restaurants_aal2_admin_select
  ON public.restaurants FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

CREATE POLICY meals_operator_select
  ON public.meals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = meals.restaurant_id
        AND (
          r.owner_id = (SELECT auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.staff_members sm
            WHERE sm.restaurant_id = r.id
              AND sm.user_id = (SELECT auth.uid())
              AND COALESCE(sm.is_active, false) = true
          )
        )
    )
  );

CREATE POLICY meals_aal2_admin_select
  ON public.meals FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    AND public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

REVOKE SELECT ON public.restaurants, public.meals FROM PUBLIC, anon;
GRANT SELECT ON public.restaurants, public.meals TO authenticated;

COMMENT ON VIEW public.public_restaurant_catalog IS
  'Approved public restaurant projection. Excludes ownership, contact email, capacity, banking, commission, payout, approval, and rejection evidence.';
COMMENT ON VIEW public.public_meal_catalog IS
  'Approved public meal projection. Excludes estimated cost and rejected, unavailable, or deleted rows.';

COMMIT;
