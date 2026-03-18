ALTER TABLE public.meal_schedules
  ADD COLUMN IF NOT EXISTS delivery_time_slot TEXT;
