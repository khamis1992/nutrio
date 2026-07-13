-- Partners may request a featured placement, but only an administrator may
-- activate it after payment has been verified.
DROP POLICY IF EXISTS "Partners can create featured listings for their restaurants"
  ON public.featured_listings;

UPDATE public.featured_listings
SET status = 'expired',
    updated_at = now()
WHERE status = 'active'
  AND ends_at <= now();

CREATE OR REPLACE FUNCTION public.request_featured_listing(
  p_package_type TEXT
)
RETURNS public.featured_listings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_restaurant_id UUID;
  v_prices JSONB;
  v_price NUMERIC;
  v_duration_days INTEGER;
  v_listing public.featured_listings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;

  IF p_package_type NOT IN ('weekly', 'biweekly', 'monthly') THEN
    RAISE EXCEPTION 'FEATURED_PACKAGE_INVALID';
  END IF;

  SELECT id
  INTO v_restaurant_id
  FROM public.restaurants
  WHERE owner_id = v_user_id
  ORDER BY created_at
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'RESTAURANT_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.featured_listings
    WHERE restaurant_id = v_restaurant_id
      AND (
        status = 'pending'
        OR (status = 'active' AND ends_at > now())
      )
  ) THEN
    RAISE EXCEPTION 'FEATURED_LISTING_ALREADY_OPEN';
  END IF;

  SELECT value
  INTO v_prices
  FROM public.platform_settings
  WHERE key = 'featured_listing_prices';

  v_price := CASE p_package_type
    WHEN 'weekly' THEN COALESCE((v_prices ->> 'weekly')::NUMERIC, 49)
    WHEN 'biweekly' THEN COALESCE((v_prices ->> 'biweekly')::NUMERIC, 89)
    WHEN 'monthly' THEN COALESCE((v_prices ->> 'monthly')::NUMERIC, 149)
  END;

  v_duration_days := CASE p_package_type
    WHEN 'weekly' THEN 7
    WHEN 'biweekly' THEN 14
    WHEN 'monthly' THEN 30
  END;

  INSERT INTO public.featured_listings (
    restaurant_id,
    package_type,
    price_paid,
    starts_at,
    ends_at,
    status,
    payment_reference
  )
  VALUES (
    v_restaurant_id,
    p_package_type,
    v_price,
    now(),
    now() + make_interval(days => v_duration_days),
    'pending',
    NULL
  )
  RETURNING * INTO v_listing;

  RETURN v_listing;
END;
$$;

REVOKE ALL ON FUNCTION public.request_featured_listing(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_featured_listing(TEXT) TO authenticated;

COMMENT ON FUNCTION public.request_featured_listing(TEXT) IS
  'Creates a server-priced pending featured placement request. It never activates a placement or records unverified revenue.';
