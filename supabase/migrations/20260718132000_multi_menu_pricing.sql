-- Multi-menu offerings let one meal have distinct availability and reference
-- pricing for breakfast, lunch, dinner, and snack menus.

CREATE TABLE IF NOT EXISTS public.meal_menu_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0 AND price <= 10000),
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meal_id, meal_type)
);

CREATE INDEX IF NOT EXISTS meal_menu_offerings_meal_available_idx
  ON public.meal_menu_offerings (meal_id, meal_type)
  WHERE is_available = true;

ALTER TABLE public.meal_menu_offerings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active meal menu offerings"
  ON public.meal_menu_offerings;
CREATE POLICY "Public can view active meal menu offerings"
  ON public.meal_menu_offerings FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.meals m
      JOIN public.restaurants r ON r.id = m.restaurant_id
      WHERE m.id = meal_menu_offerings.meal_id
        AND (
          r.owner_id = auth.uid()
          OR (
            m.approval_status = 'approved'
            AND coalesce(m.is_available, false) = true
            AND m.deleted_at IS NULL
            AND r.approval_status = 'approved'::public.approval_status
            AND coalesce(r.is_active, false) = true
            AND r.deleted_at IS NULL
          )
        )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.meal_menu_offerings
  FROM anon, authenticated;
GRANT SELECT ON public.meal_menu_offerings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_meal_menu_offerings(
  p_meal_id UUID,
  p_offerings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED'; END IF;
  IF jsonb_typeof(p_offerings) <> 'array' OR jsonb_array_length(p_offerings) > 4 THEN
    RAISE EXCEPTION 'MENU_OFFERINGS_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.meals m
    JOIN public.restaurants r ON r.id = m.restaurant_id
    WHERE m.id = p_meal_id AND r.owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'MEAL_NOT_OWNED';
  END IF;

  SELECT count(DISTINCT lower(entry ->> 'meal_type'))
  INTO v_count
  FROM jsonb_array_elements(p_offerings) entry;
  IF v_count <> jsonb_array_length(p_offerings) THEN
    RAISE EXCEPTION 'MENU_OFFERINGS_DUPLICATE';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_offerings) entry
    WHERE lower(coalesce(entry ->> 'meal_type', '')) NOT IN ('breakfast', 'lunch', 'dinner', 'snack')
      OR coalesce(entry ->> 'price', '') !~ '^\d+(\.\d{1,2})?$'
      OR (entry ->> 'price')::NUMERIC NOT BETWEEN 0 AND 10000
  ) THEN
    RAISE EXCEPTION 'MENU_OFFERINGS_INVALID';
  END IF;

  DELETE FROM public.meal_menu_offerings WHERE meal_id = p_meal_id;
  INSERT INTO public.meal_menu_offerings (meal_id, meal_type, price, is_available)
  SELECT
    p_meal_id,
    lower(entry ->> 'meal_type'),
    round((entry ->> 'price')::NUMERIC, 2),
    coalesce((entry ->> 'is_available')::BOOLEAN, true)
  FROM jsonb_array_elements(p_offerings) entry;

  RETURN jsonb_build_object('success', true, 'count', jsonb_array_length(p_offerings));
END;
$$;

REVOKE ALL ON FUNCTION public.save_meal_menu_offerings(UUID, JSONB)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_meal_menu_offerings(UUID, JSONB)
  TO authenticated;

ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS menu_period TEXT,
  ADD COLUMN IF NOT EXISTS meal_price_snapshot NUMERIC(10, 2);

ALTER TABLE public.meal_schedules
  DROP CONSTRAINT IF EXISTS meal_schedules_menu_period_check,
  ADD CONSTRAINT meal_schedules_menu_period_check
    CHECK (menu_period IS NULL OR menu_period IN ('breakfast', 'lunch', 'dinner', 'snack')),
  DROP CONSTRAINT IF EXISTS meal_schedules_meal_price_snapshot_check,
  ADD CONSTRAINT meal_schedules_meal_price_snapshot_check
    CHECK (meal_price_snapshot IS NULL OR meal_price_snapshot >= 0);

CREATE OR REPLACE FUNCTION public.set_meal_schedule_menu_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_menu BOOLEAN;
  v_price NUMERIC(10, 2);
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.meal_menu_offerings WHERE meal_id = NEW.meal_id
  ) INTO v_has_menu;

  IF v_has_menu THEN
    SELECT price INTO v_price
    FROM public.meal_menu_offerings
    WHERE meal_id = NEW.meal_id
      AND meal_type = NEW.meal_type
      AND is_available = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'MEAL_NOT_OFFERED_FOR_PERIOD'; END IF;
  ELSE
    SELECT coalesce(price, 0) INTO v_price
    FROM public.meals WHERE id = NEW.meal_id;
  END IF;

  NEW.menu_period := NEW.meal_type;
  NEW.meal_price_snapshot := round(coalesce(v_price, 0), 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_meal_schedule_menu_price_trigger
  ON public.meal_schedules;
CREATE TRIGGER set_meal_schedule_menu_price_trigger
  BEFORE INSERT OR UPDATE OF meal_id, meal_type
  ON public.meal_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_meal_schedule_menu_price();

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
  m.created_at,
  coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'meal_type', mmo.meal_type,
      'price', mmo.price,
      'is_available', mmo.is_available
    ) ORDER BY array_position(ARRAY['breakfast', 'lunch', 'dinner', 'snack'], mmo.meal_type))
    FROM public.meal_menu_offerings mmo
    WHERE mmo.meal_id = m.id
  ), '[]'::JSONB) AS menu_offerings
FROM public.meals m
JOIN public.restaurants r ON r.id = m.restaurant_id
WHERE m.approval_status = 'approved'
  AND coalesce(m.is_available, false) = true
  AND m.deleted_at IS NULL
  AND r.approval_status = 'approved'::public.approval_status
  AND coalesce(r.is_active, false) = true
  AND r.deleted_at IS NULL;

REVOKE ALL ON public.public_meal_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_meal_catalog TO anon, authenticated;

COMMENT ON TABLE public.meal_menu_offerings IS
  'Optional per-period meal availability and reference pricing. No rows means the legacy base price applies all day.';
COMMENT ON COLUMN public.meal_schedules.meal_price_snapshot IS
  'Reference menu price fixed when the meal was scheduled; subscriptions still govern customer meal entitlement.';
