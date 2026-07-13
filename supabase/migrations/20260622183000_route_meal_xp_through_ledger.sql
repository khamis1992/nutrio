-- Route meal XP through the centralized award_xp ledger.

ALTER TABLE public.meal_history
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.meal_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_request_id UUID,
  ADD COLUMN IF NOT EXISTS source_item_index INTEGER;

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
-- Privileges and the reverse operation are installed by the follow-up migrations.
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
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('s', false, 'e', 'forbidden', 'c', 'FORBIDDEN');
  END IF;

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

  -- Nutrition and log date are authoritative server data. Caller-supplied
  -- values are retained in the legacy signature only for compatibility.
  p_log_date := v_schedule_record.scheduled_date::DATE;
  p_calories := COALESCE(v_schedule_record.calories, 0);
  p_protein_g := COALESCE(v_schedule_record.protein_g, 0);
  p_carbs_g := COALESCE(v_schedule_record.carbs_g, 0);
  p_fat_g := COALESCE(v_schedule_record.fat_g, 0);
  p_fiber_g := COALESCE(v_schedule_record.fiber_g, 0);

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

  INSERT INTO public.meal_history (
    user_id,
    name,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    logged_at,
    schedule_id,
    source
  )
  VALUES (
    p_user_id,
    COALESCE(v_meal_name, 'Meal'),
    p_calories,
    p_protein_g,
    p_carbs_g,
    p_fat_g,
    v_logged_at,
    p_schedule_id,
    'scheduled'
  );

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

