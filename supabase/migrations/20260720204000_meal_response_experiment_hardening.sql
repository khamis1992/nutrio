BEGIN;

ALTER TABLE public.meal_response_experiments
  DROP CONSTRAINT IF EXISTS meal_response_experiments_minimum_repeats_per_arm_check;

ALTER TABLE public.meal_response_experiments
  ADD CONSTRAINT meal_response_experiments_minimum_repeats_per_arm_check
  CHECK (minimum_repeats_per_arm BETWEEN 4 AND 20);

CREATE OR REPLACE FUNCTION public.assert_meal_response_experiment_arms(p_arms JSONB)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
DECLARE
  v_arm JSONB;
  v_keys TEXT[] := '{}'::TEXT[];
  v_meal_ids UUID[] := '{}'::UUID[];
  v_key TEXT;
  v_meal_id UUID;
  v_catalog_calories INTEGER;
  v_calories INTEGER[] := '{}'::INTEGER[];
BEGIN
  IF jsonb_typeof(p_arms) <> 'array' OR jsonb_array_length(p_arms) <> 2 THEN
    RAISE EXCEPTION 'EXACTLY_TWO_ARMS_REQUIRED';
  END IF;

  FOR v_arm IN SELECT value FROM jsonb_array_elements(p_arms)
  LOOP
    IF jsonb_typeof(v_arm) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_EXPERIMENT_ARM';
    END IF;

    v_key := btrim(COALESCE(v_arm ->> 'key', ''));
    BEGIN
      v_meal_id := (v_arm ->> 'meal_id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'INVALID_EXPERIMENT_MEAL_ID';
    END;

    IF char_length(v_key) NOT BETWEEN 1 AND 40
       OR char_length(btrim(COALESCE(v_arm ->> 'label', ''))) NOT BETWEEN 1 AND 120
       OR v_meal_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_EXPERIMENT_ARM';
    END IF;
    IF v_key = ANY(v_keys) THEN
      RAISE EXCEPTION 'EXPERIMENT_ARM_KEYS_MUST_BE_UNIQUE';
    END IF;
    IF v_meal_id = ANY(v_meal_ids) THEN
      RAISE EXCEPTION 'EXPERIMENT_MEALS_MUST_BE_UNIQUE';
    END IF;

    SELECT meals.calories INTO v_catalog_calories
    FROM public.meals
    WHERE meals.id = v_meal_id
      AND meals.is_available IS TRUE
      AND meals.approval_status = 'approved'
      AND meals.deleted_at IS NULL;

    IF NOT FOUND OR v_catalog_calories IS NULL OR v_catalog_calories <= 0 THEN
      RAISE EXCEPTION 'EXPERIMENT_MEAL_NOT_AVAILABLE';
    END IF;
    IF COALESCE((v_arm ->> 'calories')::INTEGER, -1) <> v_catalog_calories THEN
      RAISE EXCEPTION 'EXPERIMENT_MEAL_CALORIES_MISMATCH';
    END IF;

    v_keys := array_append(v_keys, v_key);
    v_meal_ids := array_append(v_meal_ids, v_meal_id);
    v_calories := array_append(v_calories, v_catalog_calories);
  END LOOP;

  IF abs(v_calories[1] - v_calories[2])::NUMERIC
       / greatest(v_calories[1], v_calories[2])::NUMERIC > 0.20 THEN
    RAISE EXCEPTION 'EXPERIMENT_MEALS_MUST_BE_CALORIE_COMPARABLE';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_meal_response_assignment_consumption()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_expected_meal_id UUID;
  v_consumed_meal_id UUID;
BEGIN
  IF NEW.consumed_consumption_id IS NULL
     OR NEW.consumed_consumption_id IS NOT DISTINCT FROM OLD.consumed_consumption_id THEN
    RETURN NEW;
  END IF;

  SELECT (arm.value ->> 'meal_id')::UUID INTO v_expected_meal_id
  FROM public.meal_response_experiments experiments
  CROSS JOIN LATERAL jsonb_array_elements(experiments.arms) arm(value)
  WHERE experiments.id = NEW.experiment_id
    AND arm.value ->> 'key' = NEW.arm_key;

  SELECT COALESCE(consumptions.substitute_meal_id, consumptions.source_meal_id)
  INTO v_consumed_meal_id
  FROM public.meal_consumptions consumptions
  WHERE consumptions.id = NEW.consumed_consumption_id
    AND consumptions.user_id = NEW.user_id
    AND consumptions.status IN ('full', 'partial', 'substituted')
    AND consumptions.started_consuming_at IS NOT NULL;

  IF v_expected_meal_id IS NULL OR v_consumed_meal_id IS DISTINCT FROM v_expected_meal_id THEN
    RAISE EXCEPTION 'ASSIGNMENT_REQUIRES_EXPECTED_MEAL';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_meal_response_assignment_consumption
  ON public.meal_response_experiment_assignments;
CREATE TRIGGER validate_meal_response_assignment_consumption
  BEFORE UPDATE OF consumed_consumption_id
  ON public.meal_response_experiment_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_meal_response_assignment_consumption();

CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_response_assignment_consumption_unique
  ON public.meal_response_experiment_assignments (consumed_consumption_id)
  WHERE consumed_consumption_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_meal_response_experiment_catalog()
RETURNS TABLE (
  id UUID,
  name TEXT,
  calories INTEGER,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  image_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT meals.id, meals.name, meals.calories,
         COALESCE(meals.protein_g, meals.protein::NUMERIC),
         COALESCE(meals.carbs_g, meals.carbs::NUMERIC),
         COALESCE(meals.fat_g, meals.fats::NUMERIC),
         meals.image_url
  FROM public.meals
  WHERE auth.uid() IS NOT NULL
    AND meals.is_available IS TRUE
    AND meals.approval_status = 'approved'
    AND meals.deleted_at IS NULL
    AND meals.calories > 0
  ORDER BY meals.name
  LIMIT 100;
$function$;

ALTER FUNCTION public.create_meal_response_experiment(
  UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT
) RENAME TO create_meal_response_experiment_unhardened;

CREATE FUNCTION public.create_meal_response_experiment(
  p_request_id UUID,
  p_hypothesis TEXT,
  p_outcome_type TEXT,
  p_arms JSONB,
  p_minimum_repeats_per_arm SMALLINT DEFAULT 4,
  p_protocol_version TEXT DEFAULT 'n-of-1-v2'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF p_minimum_repeats_per_arm NOT BETWEEN 4 AND 20 THEN
    RAISE EXCEPTION 'INVALID_REPEAT_COUNT';
  END IF;
  PERFORM public.assert_meal_response_experiment_arms(p_arms);
  RETURN public.create_meal_response_experiment_unhardened(
    p_request_id, p_hypothesis, p_outcome_type, p_arms,
    p_minimum_repeats_per_arm, p_protocol_version
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_meal_response_experiment_unhardened(
  UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_meal_response_experiment_unhardened(
  UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT
) TO service_role;
REVOKE ALL ON FUNCTION public.create_meal_response_experiment(
  UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_meal_response_experiment(
  UUID, TEXT, TEXT, JSONB, SMALLINT, TEXT
) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_meal_response_experiment_catalog()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_meal_response_experiment_catalog()
  TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.validate_meal_response_assignment_consumption()
  FROM PUBLIC, anon, authenticated;

UPDATE public.platform_settings
SET value = COALESCE(value, '{}'::JSONB) || jsonb_build_object(
  'collection_enabled', TRUE,
  'episode_building_enabled', TRUE,
  'insight_display_enabled', TRUE,
  'ranking_use_enabled', TRUE,
  'experiments_enabled', TRUE
), updated_at = clock_timestamp()
WHERE key = 'meal-response-engine';

COMMIT;
