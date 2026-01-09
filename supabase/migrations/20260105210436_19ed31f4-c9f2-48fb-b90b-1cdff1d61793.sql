-- Create a function to notify restaurant owner when a meal is scheduled
CREATE OR REPLACE FUNCTION public.notify_partner_on_meal_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_restaurant_owner_id UUID;
  v_meal_name TEXT;
  v_restaurant_name TEXT;
  v_customer_name TEXT;
BEGIN
  -- Get meal and restaurant info
  SELECT m.name, r.name, r.owner_id 
  INTO v_meal_name, v_restaurant_name, v_restaurant_owner_id
  FROM public.meals m
  JOIN public.restaurants r ON m.restaurant_id = r.id
  WHERE m.id = NEW.meal_id;

  -- Get customer name
  SELECT COALESCE(full_name, 'A customer') INTO v_customer_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Only create notification if restaurant has an owner
  IF v_restaurant_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_restaurant_owner_id,
      'new_order',
      'New Meal Order',
      v_customer_name || ' scheduled ' || v_meal_name || ' for ' || NEW.meal_type || ' on ' || TO_CHAR(NEW.scheduled_date::date, 'Mon DD, YYYY'),
      jsonb_build_object('meal_id', NEW.meal_id, 'schedule_id', NEW.id, 'scheduled_date', NEW.scheduled_date)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on meal_schedules
DROP TRIGGER IF EXISTS on_meal_scheduled_notify_partner ON public.meal_schedules;
CREATE TRIGGER on_meal_scheduled_notify_partner
  AFTER INSERT ON public.meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_partner_on_meal_schedule();