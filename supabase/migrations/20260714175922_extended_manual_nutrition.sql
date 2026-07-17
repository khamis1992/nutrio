-- Reconciled with the applied remote migration version; executable SQL is unchanged.
-- Preserve extended nutrition for manually logged foods without changing the
-- existing RPC contract used by older mobile clients.

ALTER TABLE public.meal_history
  ADD COLUMN IF NOT EXISTS fiber_g NUMERIC(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sugar_g NUMERIC(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nutrient_data JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE OR REPLACE FUNCTION public.log_manual_meal_items_v2(
  p_items JSONB,
  p_log_date DATE DEFAULT NULL,
  p_request_id UUID DEFAULT gen_random_uuid(),
  p_source TEXT DEFAULT 'manual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Qatar')::DATE;
  v_source TEXT;
  v_item JSONB;
  v_item_index INTEGER;
  v_name TEXT;
  v_image_url TEXT;
  v_calories INTEGER;
  v_protein INTEGER;
  v_carbs INTEGER;
  v_fat INTEGER;
  v_fiber NUMERIC(8, 2);
  v_sugar NUMERIC(8, 2);
  v_sodium NUMERIC(10, 2);
  v_total_calories INTEGER := 0;
  v_total_protein INTEGER := 0;
  v_total_carbs INTEGER := 0;
  v_total_fat INTEGER := 0;
  v_total_fiber NUMERIC(10, 2) := 0;
  v_total_sugar NUMERIC(10, 2) := 0;
  v_total_sodium NUMERIC(12, 2) := 0;
  v_history_id UUID;
  v_history_ids UUID[] := ARRAY[]::UUID[];
  v_existing_ids UUID[];
  v_daily_award_count INTEGER := 0;
  v_remaining_awards INTEGER := 0;
  v_xp_awarded INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'REQUEST_ID_REQUIRED';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::TEXT, 0));

  SELECT ARRAY_AGG(mh.id ORDER BY mh.source_item_index)
  INTO v_existing_ids
  FROM public.meal_history mh
  WHERE mh.user_id = v_user_id
    AND mh.source_request_id = p_request_id;

  IF COALESCE(array_length(v_existing_ids, 1), 0) > 0 THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'duplicate', TRUE,
      'history_ids', to_jsonb(v_existing_ids),
      'logged_count', array_length(v_existing_ids, 1),
      'xp_awarded', 0
    );
  END IF;

  p_log_date := COALESCE(p_log_date, v_today);
  IF p_log_date < v_today - 365 OR p_log_date > v_today THEN
    RAISE EXCEPTION 'INVALID_LOG_DATE';
  END IF;
  IF jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 20 THEN
    RAISE EXCEPTION 'INVALID_MEAL_ITEMS';
  END IF;

  v_source := LEFT(
    REGEXP_REPLACE(COALESCE(NULLIF(BTRIM(p_source), ''), 'manual'), '[^a-zA-Z0-9_-]', '', 'g'),
    40
  );
  IF v_source = '' THEN v_source := 'manual'; END IF;

  FOR v_item, v_item_index IN
    SELECT value, ordinality::INTEGER
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_name := BTRIM(COALESCE(v_item ->> 'name', ''));
    v_image_url := NULLIF(BTRIM(v_item ->> 'image_url'), '');
    v_calories := ROUND(COALESCE((v_item ->> 'calories')::NUMERIC, 0));
    v_protein := ROUND(COALESCE((v_item ->> 'protein_g')::NUMERIC, 0));
    v_carbs := ROUND(COALESCE((v_item ->> 'carbs_g')::NUMERIC, 0));
    v_fat := ROUND(COALESCE((v_item ->> 'fat_g')::NUMERIC, 0));
    v_fiber := ROUND(COALESCE((v_item ->> 'fiber_g')::NUMERIC, 0), 2);
    v_sugar := ROUND(COALESCE((v_item ->> 'sugar_g')::NUMERIC, 0), 2);
    v_sodium := ROUND(COALESCE((v_item ->> 'sodium_mg')::NUMERIC, 0), 2);

    IF v_name = '' OR LENGTH(v_name) > 120
      OR v_calories < 0 OR v_calories > 5000
      OR v_protein < 0 OR v_protein > 1000
      OR v_carbs < 0 OR v_carbs > 1000
      OR v_fat < 0 OR v_fat > 1000
      OR v_fiber < 0 OR v_fiber > 1000
      OR v_sugar < 0 OR v_sugar > 1000
      OR v_sodium < 0 OR v_sodium > 100000
      OR COALESCE(LENGTH(v_image_url), 0) > 2048 THEN
      RAISE EXCEPTION 'INVALID_MEAL_ITEM_AT_INDEX_%', v_item_index;
    END IF;
    IF v_calories = 0 AND v_protein = 0 AND v_carbs = 0 AND v_fat = 0 THEN
      RAISE EXCEPTION 'EMPTY_NUTRITION_AT_INDEX_%', v_item_index;
    END IF;

    INSERT INTO public.meal_history (
      user_id, name, calories, protein_g, carbs_g, fat_g,
      fiber_g, sugar_g, sodium_mg, nutrient_data, image_url, logged_at,
      source, source_request_id, source_item_index
    ) VALUES (
      v_user_id, v_name, v_calories, v_protein, v_carbs, v_fat,
      v_fiber, v_sugar, v_sodium,
      jsonb_strip_nulls(v_item - ARRAY['name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'image_url']::TEXT[]),
      v_image_url,
      (p_log_date::TIMESTAMP + LOCALTIME) AT TIME ZONE 'Asia/Qatar',
      v_source, p_request_id, v_item_index
    ) RETURNING id INTO v_history_id;

    v_history_ids := array_append(v_history_ids, v_history_id);
    v_total_calories := v_total_calories + v_calories;
    v_total_protein := v_total_protein + v_protein;
    v_total_carbs := v_total_carbs + v_carbs;
    v_total_fat := v_total_fat + v_fat;
    v_total_fiber := v_total_fiber + v_fiber;
    v_total_sugar := v_total_sugar + v_sugar;
    v_total_sodium := v_total_sodium + v_sodium;
  END LOOP;

  INSERT INTO public.progress_logs (
    user_id, log_date, calories_consumed, protein_consumed_g,
    carbs_consumed_g, fat_consumed_g, fiber_consumed_g, created_at, updated_at
  ) VALUES (
    v_user_id, p_log_date, v_total_calories, v_total_protein,
    v_total_carbs, v_total_fat, v_total_fiber, NOW(), NOW()
  )
  ON CONFLICT (user_id, log_date) DO UPDATE SET
    calories_consumed = COALESCE(public.progress_logs.calories_consumed, 0) + EXCLUDED.calories_consumed,
    protein_consumed_g = COALESCE(public.progress_logs.protein_consumed_g, 0) + EXCLUDED.protein_consumed_g,
    carbs_consumed_g = COALESCE(public.progress_logs.carbs_consumed_g, 0) + EXCLUDED.carbs_consumed_g,
    fat_consumed_g = COALESCE(public.progress_logs.fat_consumed_g, 0) + EXCLUDED.fat_consumed_g,
    fiber_consumed_g = COALESCE(public.progress_logs.fiber_consumed_g, 0) + EXCLUDED.fiber_consumed_g,
    updated_at = NOW();

  SELECT COUNT(*)::INTEGER INTO v_daily_award_count
  FROM public.xp_transactions xt
  WHERE xt.user_id = v_user_id
    AND xt.action_type = 'manual_meal_log'
    AND xt.xp_amount > 0
    AND (xt.created_at AT TIME ZONE 'Asia/Qatar')::DATE = v_today;

  IF p_log_date = v_today THEN
    v_remaining_awards := GREATEST(0, 3 - v_daily_award_count);
    FOREACH v_history_id IN ARRAY v_history_ids LOOP
      EXIT WHEN v_remaining_awards <= 0;
      PERFORM public.award_xp(
        v_user_id, 10, 'Meal logged', 'manual_meal_log', v_history_id::TEXT,
        jsonb_build_object('meal_history_id', v_history_id, 'log_date', p_log_date, 'source', v_source)
      );
      v_remaining_awards := v_remaining_awards - 1;
      v_xp_awarded := v_xp_awarded + 10;
    END LOOP;
  END IF;

  UPDATE public.profiles p
  SET total_meals_logged = counts.meal_count, updated_at = NOW()
  FROM (
    SELECT COUNT(*)::INTEGER AS meal_count
    FROM public.meal_history mh
    WHERE mh.user_id = v_user_id
  ) counts
  WHERE p.user_id = v_user_id;

  PERFORM public.check_and_award_badges(v_user_id);

  RETURN jsonb_build_object(
    'success', TRUE,
    'duplicate', FALSE,
    'history_ids', to_jsonb(v_history_ids),
    'logged_count', array_length(v_history_ids, 1),
    'calories', v_total_calories,
    'protein', v_total_protein,
    'carbs', v_total_carbs,
    'fat', v_total_fat,
    'fiber', v_total_fiber,
    'sugar', v_total_sugar,
    'sodium', v_total_sodium,
    'xp_awarded', v_xp_awarded
  );
END;
$$;

-- Existing delete flows already reverse calories and macros. This trigger
-- reverses the newly stored fiber value for every deletion path.
CREATE OR REPLACE FUNCTION public.reverse_deleted_meal_fiber()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.progress_logs
  SET fiber_consumed_g = GREATEST(0, COALESCE(fiber_consumed_g, 0) - COALESCE(OLD.fiber_g, 0)),
      updated_at = NOW()
  WHERE user_id = OLD.user_id
    AND log_date = (COALESCE(OLD.logged_at, OLD.created_at, NOW()) AT TIME ZONE 'Asia/Qatar')::DATE;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_deleted_meal_fiber ON public.meal_history;
CREATE TRIGGER trg_reverse_deleted_meal_fiber
AFTER DELETE ON public.meal_history
FOR EACH ROW
WHEN (OLD.fiber_g > 0)
EXECUTE FUNCTION public.reverse_deleted_meal_fiber();

GRANT EXECUTE ON FUNCTION public.log_manual_meal_items_v2(JSONB, DATE, UUID, TEXT) TO authenticated;
