-- Migration: Add payment verification to rollover logic
-- Ensures rollover credits are only granted after successful payment

-- Update the calculate_rollover_credits function to verify payment
CREATE OR REPLACE FUNCTION calculate_rollover_credits(
  p_subscription_id uuid,
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_record subscriptions%ROWTYPE;
  v_plan_record subscription_plans%ROWTYPE;
  v_latest_payment wallet_transactions%ROWTYPE;
  v_monthly_credits integer;
  v_unused_credits integer;
  v_max_rollover integer;
  v_rollover_amount integer;
  v_cycle_start date;
  v_cycle_end date;
  v_last_renewal_date timestamptz;
BEGIN
  -- Get subscription with FOR UPDATE to prevent race conditions
  SELECT * INTO v_subscription_record
  FROM subscriptions
  WHERE id = p_subscription_id 
    AND user_id = p_user_id
    AND status = 'active'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active subscription not found');
  END IF;

  -- Verify payment was made for this renewal period
  -- Check for successful payment transaction within last 35 days
  SELECT * INTO v_latest_payment
  FROM wallet_transactions
  WHERE user_id = p_user_id
    AND transaction_type = 'subscription_renewal'
    AND status = 'completed'
    AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '35 days')
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'No successful payment found for this billing cycle. Rollover credits require subscription renewal payment.'
    );
  END IF;

  -- Verify this is actually a renewal (not initial subscription)
  -- Check if there are previous credits_used > 0 indicating past usage
  IF v_subscription_record.credits_used = 0 AND v_subscription_record.created_at > CURRENT_TIMESTAMP - INTERVAL '3 days' THEN
    -- This appears to be a new subscription, not a renewal
    -- Only grant rollover on actual renewals, not initial subscriptions
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rollover credits are only available for subscription renewals, not initial subscriptions'
    );
  END IF;
  
  SELECT * INTO v_plan_record
  FROM subscription_plans
  WHERE id = v_subscription_record.plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription plan not found');
  END IF;
  
  -- Calculate rollover
  v_monthly_credits := v_plan_record.meal_credits;
  v_unused_credits := v_subscription_record.credits_remaining;
  v_max_rollover := FLOOR(v_monthly_credits * 0.20);  -- 20% max rollover
  v_rollover_amount := LEAST(v_unused_credits, v_max_rollover);
  
  -- Set billing cycle dates
  v_cycle_start := CURRENT_DATE;
  v_cycle_end := v_cycle_start + INTERVAL '30 days' - INTERVAL '1 day';
  
  -- Extend cycle for freeze days used
  IF v_subscription_record.freeze_days_used > 0 THEN
    v_cycle_end := v_cycle_end + (v_subscription_record.freeze_days_used || ' days')::interval;
  END IF;
  
  -- Create rollover record
  INSERT INTO subscription_rollovers (
    user_id,
    subscription_id,
    rollover_credits,
    source_cycle_start,
    source_cycle_end,
    expiry_date
  ) VALUES (
    p_user_id,
    p_subscription_id,
    v_rollover_amount,
    v_subscription_record.current_period_start,
    v_subscription_record.current_period_end,
    v_cycle_end  -- Expires at end of NEW billing cycle
  );
  
  -- Update subscription with rollover credits and reset freeze days
  UPDATE subscriptions
  SET 
    rollover_credits = v_rollover_amount,
    freeze_days_used = 0,
    updated_at = NOW()
  WHERE id = p_subscription_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'rollover_credits', v_rollover_amount,
    'max_rollover', v_max_rollover,
    'unused_credits', v_unused_credits,
    'expiry_date', v_cycle_end,
    'payment_verified', true,
    'message', 'Rollover credits granted after payment verification'
  );
END;
$$;

COMMENT ON FUNCTION calculate_rollover_credits IS 'Calculates rollover credits for a subscription renewal. Requires successful payment verification within last 35 days. Only grants rollover on renewals, not initial subscriptions.';

-- Add index for faster payment lookup
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_type_status_date 
ON wallet_transactions(user_id, transaction_type, status, created_at DESC);
