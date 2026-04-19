-- Create reschedule_meal RPC for atomic meal rescheduling
-- Handles: date change with delivery job update, meal type change, time slot change
-- Sends notification, validates ownership, prevents rescheduling cancelled orders

CREATE OR REPLACE FUNCTION public.reschedule_meal(
  p_schedule_id UUID,
  p_new_date DATE DEFAULT NULL,
  p_new_meal_type TEXT DEFAULT NULL,
  p_new_time_slot TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule RECORD;
  v_old_date DATE;
  v_old_meal_type TEXT;
  v_updates INT;
BEGIN
  SELECT id, user_id, scheduled_date, meal_type, order_status, meal_id, delivery_time_slot
  INTO v_schedule
  FROM public.meal_schedules
  WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Schedule not found');
  END IF;

  IF v_schedule.order_status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot reschedule a cancelled order');
  END IF;

  IF v_schedule.user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  v_old_date := v_schedule.scheduled_date;
  v_old_meal_type := v_schedule.meal_type;

  v_updates := 0;

  IF p_new_date IS NOT NULL AND p_new_date != v_old_date THEN
    UPDATE public.meal_schedules SET scheduled_date = p_new_date WHERE id = p_schedule_id;
    v_updates := v_updates + 1;

    IF EXISTS (
      SELECT 1 FROM public.delivery_jobs
      WHERE schedule_id = p_schedule_id
      AND status IN ('pending', 'scheduled', 'assigned')
    ) THEN
      UPDATE public.delivery_jobs
      SET scheduled_date = p_new_date
      WHERE schedule_id = p_schedule_id
      AND status IN ('pending', 'scheduled', 'assigned');
    END IF;
  END IF;

  IF p_new_meal_type IS NOT NULL AND p_new_meal_type != v_old_meal_type THEN
    UPDATE public.meal_schedules SET meal_type = p_new_meal_type WHERE id = p_schedule_id;
    v_updates := v_updates + 1;
  END IF;

  IF p_new_time_slot IS NOT NULL AND p_new_time_slot != v_schedule.delivery_time_slot THEN
    UPDATE public.meal_schedules SET delivery_time_slot = p_new_time_slot WHERE id = p_schedule_id;
    v_updates := v_updates + 1;
  END IF;

  IF v_updates = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No changes provided');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    v_schedule.user_id,
    'meal_rescheduled',
    'Meal Rescheduled',
    'Your meal has been rescheduled' ||
    CASE WHEN p_new_date IS NOT NULL AND p_new_date != v_old_date
      THEN ' to ' || p_new_date::TEXT ELSE '' END ||
    CASE WHEN p_new_meal_type IS NOT NULL AND p_new_meal_type != v_old_meal_type
      THEN ' as ' || p_new_meal_type ELSE '' END,
    p_schedule_id,
    'meal_schedule'
  );

  RETURN jsonb_build_object('success', true, 'updates', v_updates);
END;
$$;