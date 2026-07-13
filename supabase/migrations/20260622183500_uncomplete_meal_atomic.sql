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
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('s', false, 'e', 'forbidden', 'c', 'FORBIDDEN');
  END IF;

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

  p_log_date := v_schedule_record.scheduled_date::DATE;

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
  WHERE schedule_id = p_schedule_id
    AND user_id = p_user_id;

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
