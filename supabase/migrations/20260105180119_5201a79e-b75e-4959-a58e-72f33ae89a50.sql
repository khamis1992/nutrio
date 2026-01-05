-- Remove the unique constraint that prevents multiple meals per slot
ALTER TABLE public.meal_schedules 
DROP CONSTRAINT IF EXISTS meal_schedules_user_id_scheduled_date_meal_type_key;