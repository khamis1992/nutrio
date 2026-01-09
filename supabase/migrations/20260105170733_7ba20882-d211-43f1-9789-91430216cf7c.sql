-- Add subscription quota tracking columns
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS meals_per_week integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS meals_used_this_week integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS week_start_date date DEFAULT CURRENT_DATE;

-- Create function to reset weekly meal quotas
CREATE OR REPLACE FUNCTION public.reset_weekly_meal_quotas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.subscriptions
  SET 
    meals_used_this_week = 0,
    week_start_date = CURRENT_DATE
  WHERE status = 'active'
    AND week_start_date < CURRENT_DATE - INTERVAL '6 days';
END;
$$;

-- Create function to increment meal usage
CREATE OR REPLACE FUNCTION public.increment_meal_usage(subscription_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_usage integer;
  max_meals integer;
BEGIN
  SELECT meals_used_this_week, meals_per_week 
  INTO current_usage, max_meals
  FROM public.subscriptions 
  WHERE id = subscription_id AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check if quota allows (0 means unlimited)
  IF max_meals > 0 AND current_usage >= max_meals THEN
    RETURN false;
  END IF;
  
  UPDATE public.subscriptions
  SET meals_used_this_week = meals_used_this_week + 1
  WHERE id = subscription_id;
  
  RETURN true;
END;
$$;