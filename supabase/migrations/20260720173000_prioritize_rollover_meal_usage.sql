-- Prioritize rollover meal credits in the active scheduling path.
--
-- schedule_meals_atomic calls increment_monthly_meal_usage for every customer
-- meal. Keep that integration point stable, but make it consume active
-- rollover credits before drawing from the current billing cycle.

CREATE OR REPLACE FUNCTION public.increment_monthly_meal_usage(
  p_subscription_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_subscription public.subscriptions%ROWTYPE;
  v_current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  v_current_week DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  v_monthly_used INTEGER;
  v_weekly_used INTEGER;
  v_rollover_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT *
    INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
    AND user_id = v_user_id
    AND status IN ('active', 'cancelled')
    AND (
      status = 'active'
      OR COALESCE(end_date, CURRENT_DATE - 1) >= CURRENT_DATE
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_subscription.tier, '') <> 'vip' THEN
    v_rollover_result := public.use_rollover_credit_if_available(
      p_subscription_id,
      v_user_id
    );

    IF COALESCE((v_rollover_result ->> 'used_rollover')::BOOLEAN, FALSE) THEN
      RETURN TRUE;
    END IF;
  END IF;

  v_monthly_used := CASE
    WHEN v_subscription.month_start_date IS NULL
      OR v_subscription.month_start_date < v_current_month THEN 0
    ELSE COALESCE(v_subscription.meals_used_this_month, 0)
  END;

  v_weekly_used := CASE
    WHEN v_subscription.week_start_date IS NULL
      OR v_subscription.week_start_date < v_current_week THEN 0
    ELSE COALESCE(v_subscription.meals_used_this_week, 0)
  END;

  IF COALESCE(v_subscription.tier, '') <> 'vip'
    AND COALESCE(v_subscription.meals_per_month, 0) > 0
    AND v_monthly_used >= v_subscription.meals_per_month THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_subscription.tier, '') <> 'vip'
    AND COALESCE(v_subscription.meals_per_week, 0) > 0
    AND v_weekly_used >= v_subscription.meals_per_week THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET meals_used_this_month = v_monthly_used + 1,
      month_start_date = v_current_month,
      meals_used_this_week = v_weekly_used + 1,
      week_start_date = v_current_week,
      updated_at = NOW()
  WHERE id = v_subscription.id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.increment_monthly_meal_usage(UUID) IS
  'Consumes active rollover meal credits before incrementing current-cycle meal usage.';
