CREATE OR REPLACE FUNCTION public.decrement_monthly_meal_usage(p_subscription_id UUID, p_count INTEGER DEFAULT 1)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $_$
BEGIN
IF NOT EXISTS (SELECT 1 FROM subscriptions WHERE id = p_subscription_id) THEN RAISE EXCEPTION 'subscription not found'; END IF;
UPDATE subscriptions SET meals_used_this_month = GREATEST(0, COALESCE(meals_used_this_month, 0) - p_count), meals_used_this_week = GREATEST(0, COALESCE(meals_used_this_week, 0) - p_count) WHERE id = p_subscription_id;
RETURN true;
END;
$_$;
