DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meal_schedules' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE public.meal_schedules ADD COLUMN cancellation_reason TEXT;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.decrement_monthly_meal_usage(
    p_subscription_id UUID,
    p_count INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
BEGIN
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE id = p_subscription_id;

    IF v_subscription.id IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
        RETURN FALSE;
    END IF;

    UPDATE public.subscriptions
    SET meals_used_this_month = GREATEST(0, COALESCE(meals_used_this_month, 0) - p_count),
        meals_used_this_week = GREATEST(0, COALESCE(meals_used_this_week, 0) - p_count)
    WHERE id = p_subscription_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_monthly_meal_usage(UUID, INTEGER) TO authenticated;