-- Make partner self-registration atomic and prevent legacy restaurant ownership
-- from granting partner access to unrelated portal users.

CREATE OR REPLACE FUNCTION public.is_restaurant_operator(
  p_restaurant_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
  SELECT p_user_id IS NOT NULL AND (
    EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = p_restaurant_id
        AND r.owner_id = p_user_id
        AND (
          public.has_role(p_user_id, 'partner'::public.app_role)
          OR public.has_role(p_user_id, 'restaurant'::public.app_role)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.restaurant_staff rs
      WHERE rs.restaurant_id = p_restaurant_id
        AND rs.user_id = p_user_id
        AND rs.is_active = true
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.is_restaurant_operator(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_restaurant_operator(uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_partner_application_from_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_restaurant_name text := NULLIF(BTRIM(v_metadata ->> 'restaurant_name'), '');
BEGIN
  IF v_metadata ->> 'account_type' IS DISTINCT FROM 'partner' THEN
    RETURN NEW;
  END IF;

  IF v_restaurant_name IS NULL OR char_length(v_restaurant_name) < 2 THEN
    RAISE EXCEPTION 'PARTNER_RESTAURANT_NAME_REQUIRED';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'partner'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    NULLIF(BTRIM(v_metadata ->> 'full_name'), ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      email = COALESCE(EXCLUDED.email, public.profiles.email);

  INSERT INTO public.restaurants (
    owner_id,
    name,
    description,
    phone,
    address,
    email,
    approval_status,
    is_active
  )
  SELECT
    NEW.id,
    v_restaurant_name,
    NULLIF(BTRIM(v_metadata ->> 'restaurant_description'), ''),
    NULLIF(BTRIM(v_metadata ->> 'restaurant_phone'), ''),
    NULLIF(BTRIM(v_metadata ->> 'restaurant_address'), ''),
    NEW.email,
    'pending'::public.approval_status,
    false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.restaurants r WHERE r.owner_id = NEW.id
  );

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_partner_application_from_signup()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_partner_application_from_signup()
  TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created_partner_application ON auth.users;
CREATE TRIGGER on_auth_user_created_partner_application
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_partner_application_from_signup();

-- Direct restaurant creation remains available to authenticated partner accounts
-- (for onboarding/re-application), but no longer grants arbitrary portal users a role.
DROP POLICY IF EXISTS "Partners can insert restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Partners can insert their own restaurants" ON public.restaurants;
CREATE POLICY "Partner roles can insert their own restaurants"
  ON public.restaurants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND approval_status = 'pending'::public.approval_status
    AND (
      public.has_role((SELECT auth.uid()), 'partner'::public.app_role)
      OR public.has_role((SELECT auth.uid()), 'restaurant'::public.app_role)
    )
  );

-- These rows were already quarantined as rejected/non-production restaurants.
-- Removing the unrelated driver owner closes legacy owner-based RLS paths while
-- preserving meals, schedules, and order history for administrative audit.
UPDATE public.restaurants r
SET owner_id = NULL
WHERE r.owner_id IS NOT NULL
  AND r.approval_status = 'rejected'::public.approval_status
  AND r.is_active = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = r.owner_id
      AND ur.role IN ('partner'::public.app_role, 'restaurant'::public.app_role)
  );
