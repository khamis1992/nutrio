-- Agent 2: Meal Nutrition Quality and Micronutrients.
-- Adds explicit nutrient provenance/completeness without converting missing
-- micronutrients into fake measured zeroes.

ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS sugar_g NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS saturated_fat_g NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS cholesterol_mg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS potassium_mg NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS nutrition_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS nutrition_provenance JSONB NOT NULL DEFAULT jsonb_build_object(
    'source', 'partner_entered',
    'source_record_id', NULL,
    'version', 1
  ),
  ADD COLUMN IF NOT EXISTS nutrient_completeness_score INTEGER NOT NULL DEFAULT 0 CHECK (nutrient_completeness_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS nutrient_missing_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS nutrient_invalid_codes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE OR REPLACE FUNCTION public.calculate_nutrient_completeness(p_nutrition JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_required TEXT[] := ARRAY['calories', 'protein_g', 'carbs_g', 'fat_g'];
  v_quality TEXT[] := ARRAY['fiber_g', 'sugar_g', 'sodium_mg'];
  v_all TEXT[] := v_required || v_quality;
  v_code TEXT;
  v_value NUMERIC;
  v_present_required INTEGER := 0;
  v_present_quality INTEGER := 0;
  v_missing TEXT[] := ARRAY[]::TEXT[];
  v_invalid TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOREACH v_code IN ARRAY v_all LOOP
    IF NOT p_nutrition ? v_code OR NULLIF(BTRIM(p_nutrition ->> v_code), '') IS NULL THEN
      v_missing := array_append(v_missing, v_code);
    ELSE
      BEGIN
        v_value := (p_nutrition ->> v_code)::NUMERIC;
        IF v_value < 0 THEN
          v_invalid := array_append(v_invalid, v_code);
        ELSIF v_code = ANY(v_required) THEN
          v_present_required := v_present_required + 1;
        ELSE
          v_present_quality := v_present_quality + 1;
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        v_invalid := array_append(v_invalid, v_code);
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'score', ROUND((v_present_required::NUMERIC / array_length(v_required, 1)) * 70 + (v_present_quality::NUMERIC / array_length(v_quality, 1)) * 30)::INTEGER,
    'missing_codes', v_missing,
    'invalid_codes', v_invalid,
    'required_missing_codes', (
      SELECT COALESCE(array_agg(code), ARRAY[]::TEXT[])
      FROM unnest(v_required) AS code
      WHERE code = ANY(v_missing) OR code = ANY(v_invalid)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_meal_nutrition_quality()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.calculate_nutrient_completeness(jsonb_build_object(
    'calories', NEW.calories,
    'protein_g', NEW.protein_g,
    'carbs_g', NEW.carbs_g,
    'fat_g', NEW.fat_g,
    'fiber_g', NEW.fiber_g,
    'sugar_g', NEW.sugar_g,
    'sodium_mg', NEW.sodium_mg
  ));

  NEW.nutrient_completeness_score := COALESCE((v_result ->> 'score')::INTEGER, 0);
  NEW.nutrient_missing_codes := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(v_result -> 'missing_codes')),
    ARRAY[]::TEXT[]
  );
  NEW.nutrient_invalid_codes := COALESCE(
    ARRAY(SELECT jsonb_array_elements_text(v_result -> 'invalid_codes')),
    ARRAY[]::TEXT[]
  );
  NEW.nutrition_version := GREATEST(COALESCE(NEW.nutrition_version, 1), 1);
  NEW.nutrition_provenance := COALESCE(NEW.nutrition_provenance, '{}'::JSONB)
    || jsonb_build_object(
      'version', NEW.nutrition_version,
      'captured_at', NOW(),
      'source', COALESCE(NEW.nutrition_provenance ->> 'source', 'partner_entered')
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_meal_nutrition_quality ON public.meals;
CREATE TRIGGER trg_apply_meal_nutrition_quality
BEFORE INSERT OR UPDATE OF
  calories, protein_g, carbs_g, fat_g, fiber_g,
  sugar_g, sodium_mg, nutrition_version, nutrition_provenance
ON public.meals
FOR EACH ROW
EXECUTE FUNCTION public.apply_meal_nutrition_quality();

UPDATE public.meals
SET nutrition_version = GREATEST(COALESCE(nutrition_version, 1), 1)
WHERE nutrient_completeness_score = 0
   OR nutrient_missing_codes = ARRAY[]::TEXT[]
   OR nutrient_invalid_codes = ARRAY[]::TEXT[];

CREATE OR REPLACE VIEW public.partner_meal_nutrition_missing_queue AS
SELECT
  m.id AS meal_id,
  m.restaurant_id,
  m.name AS meal_name,
  m.approval_status,
  m.is_available,
  m.nutrient_completeness_score,
  m.nutrient_missing_codes,
  m.nutrient_invalid_codes,
  m.nutrition_version,
  NULL::TIMESTAMPTZ AS updated_at
FROM public.meals m
WHERE COALESCE(m.nutrient_completeness_score, 0) < 100
   OR COALESCE(array_length(m.nutrient_invalid_codes, 1), 0) > 0;

CREATE OR REPLACE FUNCTION public.get_user_micronutrient_adequacy(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  nutrient_code TEXT,
  label_en TEXT,
  label_ar TEXT,
  unit TEXT,
  target NUMERIC,
  direction TEXT,
  consumed NUMERIC,
  percentage INTEGER,
  status TEXT,
  measured_entries INTEGER,
  missing_entries INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_start DATE := COALESCE(p_start_date, (NOW() AT TIME ZONE 'Asia/Qatar')::DATE);
  v_end DATE := COALESCE(p_end_date, COALESCE(p_start_date, (NOW() AT TIME ZONE 'Asia/Qatar')::DATE));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF v_start > v_end OR v_end > (NOW() AT TIME ZONE 'Asia/Qatar')::DATE OR v_start < (NOW() AT TIME ZONE 'Asia/Qatar')::DATE - 370 THEN
    RAISE EXCEPTION 'INVALID_DATE_RANGE';
  END IF;

  RETURN QUERY
  WITH targets AS (
    SELECT * FROM (VALUES
      ('fiber_g', 'Fiber', 'الألياف', 'g', 30::NUMERIC, 'minimum'),
      ('sodium_mg', 'Sodium', 'الصوديوم', 'mg', 2300::NUMERIC, 'maximum'),
      ('sugar_g', 'Sugar', 'السكر', 'g', 45::NUMERIC, 'maximum')
    ) AS t(nutrient_code, label_en, label_ar, unit, target, direction)
  ),
  history AS (
    SELECT
      mh.*,
      (COALESCE(mh.logged_at, mh.created_at, NOW()) AT TIME ZONE 'Asia/Qatar')::DATE AS local_log_date
    FROM public.meal_history mh
    WHERE mh.user_id = v_user_id
  ),
  expanded AS (
    SELECT 'fiber_g' AS nutrient_code, fiber_g::NUMERIC AS value FROM history WHERE local_log_date BETWEEN v_start AND v_end
    UNION ALL
    SELECT 'sodium_mg', sodium_mg::NUMERIC FROM history WHERE local_log_date BETWEEN v_start AND v_end
    UNION ALL
    SELECT 'sugar_g', sugar_g::NUMERIC FROM history WHERE local_log_date BETWEEN v_start AND v_end
  ),
  aggregated AS (
    SELECT
      e.nutrient_code,
      SUM(e.value) FILTER (WHERE e.value IS NOT NULL) AS consumed,
      COUNT(*) FILTER (WHERE e.value IS NOT NULL) AS measured_entries,
      COUNT(*) FILTER (WHERE e.value IS NULL) AS missing_entries
    FROM expanded e
    GROUP BY e.nutrient_code
  )
  SELECT
    t.nutrient_code,
    t.label_en,
    t.label_ar,
    t.unit,
    t.target,
    t.direction,
    ROUND(a.consumed, 2) AS consumed,
    CASE
      WHEN a.measured_entries IS NULL OR a.measured_entries = 0 THEN NULL
      ELSE ROUND((COALESCE(a.consumed, 0) / NULLIF(t.target, 0)) * 100)::INTEGER
    END AS percentage,
    CASE
      WHEN a.measured_entries IS NULL OR a.measured_entries = 0 THEN 'missing'
      WHEN t.direction = 'minimum' AND COALESCE(a.consumed, 0) >= t.target THEN 'on_track'
      WHEN t.direction = 'minimum' THEN 'low'
      WHEN t.direction = 'maximum' AND COALESCE(a.consumed, 0) <= t.target THEN 'on_track'
      ELSE 'over_limit'
    END AS status,
    COALESCE(a.measured_entries, 0)::INTEGER AS measured_entries,
    COALESCE(a.missing_entries, 0)::INTEGER AS missing_entries
  FROM targets t
  LEFT JOIN aggregated a ON a.nutrient_code = t.nutrient_code
  ORDER BY array_position(ARRAY['fiber_g', 'sodium_mg', 'sugar_g'], t.nutrient_code);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_micronutrient_adequacy(DATE, DATE) TO authenticated;
