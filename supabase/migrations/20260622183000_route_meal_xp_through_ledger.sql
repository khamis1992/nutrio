-- Route meal XP through the centralized award_xp ledger.

DROP FUNCTION IF EXISTS public.award_xp_for_meal_log(UUID);
DROP FUNCTION IF EXISTS public.award_xp_for_meal_log(UUID, INTEGER);

CREATE OR REPLACE FUNCTION public.award_xp_for_meal_log(
  p_user_id UUID,
  p_xp_amount INTEGER DEFAULT 10,
  p_source_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.award_xp(
    p_user_id,
    p_xp_amount,
    'Meal logged',
    'meal_log',
    COALESCE(p_source_id, 'manual-' || gen_random_uuid()::text),
    jsonb_build_object('source', 'meal_log')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_meal_atomic(
  p_schedule_id UUID,
  p_user_id UUID,
  p_log_date DATE,
  p_calories INTEGER DEFAULT 0,
  p_protein_g INTEGER DEFAULT 0,
  p_carbs_g INTEGER DEFAULT 0,
  p_fat_g INTEGER DEFAULT 0,
  p_fiber_g INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_record RECORD;
  v_existing_progress RECORD;
  v_result JSONB;
  v_meal_name TEXT;
  v_logged_at TIMESTAMPTZ;
  v_xp_result JSONB;
  v_daily_target INTEGER;
  v_total_calories INTEGER;
  v_daily_xp_result JSONB;
BEGIN
  SELECT ms.*, m.calories, m.protein_g, m.carbs_g, m.fat_g, m.fiber_g, m.name
  INTO v_schedule_record
  FROM public.meal_schedules ms
  JOIN public.meals m ON ms.meal_id = m.id
  WHERE ms.id = p_schedule_id
    AND ms.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('s', false, 'e', 'not found', 'c', 'NOT_FOUND');
  END IF;

  IF v_schedule_record.is_completed THEN
    RETURN jsonb_build_object('s', true, 'm', 'already done', 'a', true);
  END IF;

  IF p_calories = 0 THEN p_calories := COALESCE(v_schedule_record.calories, 0); END IF;
  IF p_protein_g = 0 THEN p_protein_g := COALESCE(v_schedule_record.protein_g, 0); END IF;
  IF p_carbs_g = 0 THEN p_carbs_g := COALESCE(v_schedule_record.carbs_g, 0); END IF;
  IF p_fat_g = 0 THEN p_fat_g := COALESCE(v_schedule_record.fat_g, 0); END IF;
  IF p_fiber_g = 0 THEN p_fiber_g := COALESCE(v_schedule_record.fiber_g, 0); END IF;

  v_meal_name := v_schedule_record.name;
  v_logged_at := now();

  SELECT *
  INTO v_existing_progress
  FROM public.progress_logs
  WHERE user_id = p_user_id
    AND log_date = p_log_date
  FOR UPDATE;

  UPDATE public.meal_schedules
  SET is_completed = true,
      completed_at = now(),
      updated_at = now()
  WHERE id = p_schedule_id;

  IF v_existing_progress IS NULL THEN
    INSERT INTO public.progress_logs (
      user_id,
      log_date,
      calories_consumed,
      protein_consumed_g,
      carbs_consumed_g,
      fat_consumed_g,
      fiber_consumed_g,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      p_log_date,
      p_calories,
      p_protein_g,
      p_carbs_g,
      p_fat_g,
      p_fiber_g,
      now(),
      now()
    );
  ELSE
    UPDATE public.progress_logs
    SET calories_consumed = COALESCE(calories_consumed, 0) + p_calories,
        protein_consumed_g = COALESCE(protein_consumed_g, 0) + p_protein_g,
        carbs_consumed_g = COALESCE(carbs_consumed_g, 0) + p_carbs_g,
        fat_consumed_g = COALESCE(fat_consumed_g, 0) + p_fat_g,
        fiber_consumed_g = COALESCE(fiber_consumed_g, 0) + p_fiber_g,
        updated_at = now()
    WHERE id = v_existing_progress.id;
  END IF;

  INSERT INTO public.meal_history (user_id, name, calories, protein_g, carbs_g, fat_g, logged_at)
  VALUES (p_user_id, COALESCE(v_meal_name, 'Meal'), p_calories, p_protein_g, p_carbs_g, p_fat_g, v_logged_at);

  UPDATE public.profiles
  SET total_meals_logged = COALESCE(total_meals_logged, 0) + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  SELECT COALESCE(daily_calorie_target, 0)
  INTO v_daily_target
  FROM public.profiles
  WHERE user_id = p_user_id;

  SELECT COALESCE(calories_consumed, 0)
  INTO v_total_calories
  FROM public.progress_logs
  WHERE user_id = p_user_id
    AND log_date = p_log_date;

  v_xp_result := public.award_xp(
    p_user_id,
    10,
    'Scheduled meal completed',
    'meal_completed',
    p_schedule_id::text,
    jsonb_build_object('schedule_id', p_schedule_id, 'log_date', p_log_date)
  );

  IF v_daily_target > 0 AND v_total_calories >= v_daily_target THEN
    v_daily_xp_result := public.award_xp(
      p_user_id,
      25,
      'Daily nutrition goal completed',
      'daily_nutrition_complete',
      p_log_date::text,
      jsonb_build_object(
        'log_date', p_log_date,
        'calories_consumed', v_total_calories,
        'daily_calorie_target', v_daily_target
      )
    );
  END IF;

  v_result := jsonb_build_object(
    's', true,
    'id', p_schedule_id,
    'c', true,
    'a', false,
    'xp', v_xp_result,
    'daily_xp', v_daily_xp_result,
    'n', jsonb_build_object(
      'cal', p_calories,
      'pro', p_protein_g,
      'car', p_carbs_g,
      'fat', p_fat_g,
      'fib', p_fiber_g
    )
  );

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.uncomplete_meal_atomic(
  p_schedule_id UUID,
  p_user_id UUID,
  p_log_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schedule_record RECORD;
  v_existing_progress RECORD;
  v_logged_nutrition RECORD;
  v_result JSONB;
  v_xp_result JSONB;
BEGIN
  SELECT ms.*, m.calories, m.protein_g, m.carbs_g, m.fat_g, m.fiber_g
  INTO v_schedule_record
  FROM public.meal_schedules ms
  JOIN public.meals m ON ms.meal_id = m.id
  WHERE ms.id = p_schedule_id
    AND ms.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('s', false, 'e', 'not found', 'c', 'NOT_FOUND');
  END IF;

  IF NOT v_schedule_record.is_completed THEN
    RETURN jsonb_build_object('s', true, 'm', 'was not completed', 'u', true);
  END IF;

  SELECT calories, protein_g, carbs_g, fat_g
  INTO v_logged_nutrition
  FROM public.meal_history
  WHERE user_id = p_user_id
    AND logged_at::date = p_log_date
    AND name = (SELECT name FROM public.meals WHERE id = v_schedule_record.meal_id)
  ORDER BY logged_at DESC
  LIMIT 1;

  IF v_logged_nutrition IS NULL THEN
    v_logged_nutrition.calories := COALESCE(v_schedule_record.calories, 0);
    v_logged_nutrition.protein_g := COALESCE(v_schedule_record.protein_g, 0);
    v_logged_nutrition.carbs_g := COALESCE(v_schedule_record.carbs_g, 0);
    v_logged_nutrition.fat_g := COALESCE(v_schedule_record.fat_g, 0);
  END IF;

  SELECT *
  INTO v_existing_progress
  FROM public.progress_logs
  WHERE user_id = p_user_id
    AND log_date = p_log_date
  FOR UPDATE;

  UPDATE public.meal_schedules
  SET is_completed = false,
      completed_at = NULL,
      updated_at = now()
  WHERE id = p_schedule_id;

  IF v_existing_progress IS NOT NULL THEN
    UPDATE public.progress_logs
    SET calories_consumed = GREATEST(0, COALESCE(calories_consumed, 0) - COALESCE(v_logged_nutrition.calories, 0)),
        protein_consumed_g = GREATEST(0, COALESCE(protein_consumed_g, 0) - COALESCE(v_logged_nutrition.protein_g, 0)),
        carbs_consumed_g = GREATEST(0, COALESCE(carbs_consumed_g, 0) - COALESCE(v_logged_nutrition.carbs_g, 0)),
        fat_consumed_g = GREATEST(0, COALESCE(fat_consumed_g, 0) - COALESCE(v_logged_nutrition.fat_g, 0)),
        updated_at = now()
    WHERE id = v_existing_progress.id;
  END IF;

  DELETE FROM public.meal_history
  WHERE name = (SELECT name FROM public.meals WHERE id = v_schedule_record.meal_id)
    AND user_id = p_user_id
    AND logged_at::date = p_log_date;

  UPDATE public.profiles
  SET total_meals_logged = GREATEST(0, COALESCE(total_meals_logged, 0) - 1),
      updated_at = now()
  WHERE user_id = p_user_id;

  v_xp_result := public.award_xp(
    p_user_id,
    -10,
    'Scheduled meal uncompleted',
    'meal_uncompleted',
    p_schedule_id::text,
    jsonb_build_object('schedule_id', p_schedule_id, 'log_date', p_log_date)
  );

  v_result := jsonb_build_object(
    's', true,
    'id', p_schedule_id,
    'c', false,
    'xp', v_xp_result,
    'n', jsonb_build_object(
      'cal', COALESCE(v_logged_nutrition.calories, 0),
      'pro', COALESCE(v_logged_nutrition.protein_g, 0),
      'car', COALESCE(v_logged_nutrition.carbs_g, 0),
      'fat', COALESCE(v_logged_nutrition.fat_g, 0)
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_xp_for_meal_log(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_meal_atomic(UUID, UUID, DATE, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncomplete_meal_atomic(UUID, UUID, DATE) TO authenticated;
