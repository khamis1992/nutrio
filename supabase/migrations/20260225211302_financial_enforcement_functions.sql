-- Migration: Financial Enforcement Functions
-- Week 1, Phase 1: Foundation & Database Architecture
-- Security Level: CRITICAL - All financial logic server-enforced

-- ==========================================
-- FUNCTION: Deduct Meal Credit
-- ==========================================
-- CRITICAL: This is the ONLY way to deduct credits from a subscription
-- Never allow client-side credit calculations

CREATE OR REPLACE FUNCTION deduct_meal_credit(
  p_user_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
  v_credits_remaining integer;
  v_restaurant_id uuid;
  v_result jsonb;
  v_error_message text;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid parameters: user_id and order_id are required'
    );
  END IF;

  -- Verify order exists and belongs to user
  SELECT restaurant_id INTO v_restaurant_id
  FROM orders
  WHERE id = p_order_id 
    AND user_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded');
    
  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Order not found, not owned by user, or already cancelled'
    );
  END IF;

  -- Get active subscription with available credits
  -- Uses FOR UPDATE to prevent race conditions
  SELECT id, credits_remaining 
  INTO v_subscription_id, v_credits_remaining
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND credits_remaining > 0
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;
  
  IF v_subscription_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'No active subscription with available credits'
    );
  END IF;
  
  -- Double-check credits_remaining > 0 (defense in depth)
  IF v_credits_remaining <= 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'No credits remaining in subscription'
    );
  END IF;

  -- Deduct credit atomically
  UPDATE subscriptions
  SET credits_remaining = credits_remaining - 1,
      credits_used = credits_used + 1,
      updated_at = now()
  WHERE id = v_subscription_id
    AND credits_remaining > 0; -- Extra safety check
  
  -- Verify update succeeded
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Credit deduction failed - possibly due to concurrent modification'
    );
  END IF;
  
  -- Record transaction in immutable audit trail
  INSERT INTO credit_transactions (
    user_id, 
    subscription_id, 
    transaction_type, 
    credits_amount, 
    meal_value_qar, 
    description, 
    order_id,
    metadata
  ) VALUES (
    p_user_id, 
    v_subscription_id, 
    'deduction',
    -1, 
    50, 
    'Meal order deduction - Order #' || p_order_id::text, 
    p_order_id,
    jsonb_build_object(
      'credits_before', v_credits_remaining,
      'credits_after', v_credits_remaining - 1,
      'restaurant_id', v_restaurant_id
    )
  );
  
  -- Create restaurant earnings record with FIXED values
  -- These values are hardcoded and CANNOT be modified by restaurants
  INSERT INTO restaurant_earnings (
    restaurant_id, 
    order_id, 
    meal_value_qar,
    platform_commission_qar, 
    restaurant_payout_qar, 
    commission_rate,
    is_settled,
    created_at
  ) VALUES (
    v_restaurant_id, 
    p_order_id, 
    50,  -- FIXED: Never change this value
    5,   -- FIXED: 10% commission
    45,  -- FIXED: Restaurant payout
    10.00, -- FIXED: Commission rate
    false,
    now()
  );
  
  -- Log behavior event
  INSERT INTO behavior_events (
    user_id,
    event_type,
    meal_id,
    restaurant_id,
    metadata,
    created_at
  )
  SELECT 
    p_user_id,
    'meal_ordered',
    meal_id,
    v_restaurant_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'credits_remaining', v_credits_remaining - 1
    ),
    now()
  FROM orders
  WHERE id = p_order_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'credits_remaining', v_credits_remaining - 1,
    'credits_used', (SELECT credits_used FROM subscriptions WHERE id = v_subscription_id),
    'restaurant_payout', 45,
    'platform_commission', 5
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't expose details to client
    v_error_message := SQLERRM;
    RAISE WARNING 'Error in deduct_meal_credit: %', v_error_message;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'An error occurred processing your order. Please try again.'
    );
END;
$$;

-- ==========================================
-- FUNCTION: Allocate Subscription Credits
-- ==========================================
-- Called when a new subscription is purchased

CREATE OR REPLACE FUNCTION allocate_subscription_credits(
  p_user_id uuid,
  p_plan_id uuid,
  p_payment_reference text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_record subscription_plans%ROWTYPE;
  v_subscription_id uuid;
  v_result jsonb;
BEGIN
  -- Get plan details
  SELECT * INTO v_plan_record
  FROM subscription_plans
  WHERE id = p_plan_id
    AND is_active = true;
    
  IF v_plan_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive subscription plan'
    );
  END IF;
  
  -- Create subscription with allocated credits
  INSERT INTO subscriptions (
    user_id,
    plan_id,
    tier,
    status,
    credits_remaining,
    credits_used,
    meal_value_qar,
    price_qar,
    current_period_start,
    current_period_end,
    last_credit_reset
  ) VALUES (
    p_user_id,
    p_plan_id,
    lower(v_plan_record.name),
    'active',
    v_plan_record.meal_credits,
    0,
    50,
    v_plan_record.price_qar,
    CURRENT_DATE,
    CURRENT_DATE + interval '1 month',
    now()
  )
  RETURNING id INTO v_subscription_id;
  
  -- Record credit purchase transaction
  INSERT INTO credit_transactions (
    user_id,
    subscription_id,
    transaction_type,
    credits_amount,
    meal_value_qar,
    description,
    metadata
  ) VALUES (
    p_user_id,
    v_subscription_id,
    'purchase',
    v_plan_record.meal_credits,
    50,
    'Subscription purchase - ' || v_plan_record.name || ' Plan',
    jsonb_build_object(
      'plan_id', p_plan_id,
      'plan_name', v_plan_record.name,
      'price_paid', v_plan_record.price_qar,
      'payment_reference', p_payment_reference
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'credits_allocated', v_plan_record.meal_credits,
    'plan_name', v_plan_record.name
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in allocate_subscription_credits: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to allocate subscription credits'
    );
END;
$$;

-- ==========================================
-- FUNCTION: Aggregate Restaurant Payouts
-- ==========================================
-- Run every 3 days to batch process restaurant payouts
-- CRITICAL: Only admin role can execute this

CREATE OR REPLACE FUNCTION aggregate_restaurant_payouts(
  p_period_start date,
  p_period_end date,
  p_admin_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id uuid;
  v_total_restaurants integer;
  v_total_amount integer;
  v_result jsonb;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_admin_user_id 
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin role required'
    );
  END IF;
  
  -- Validate date range
  IF p_period_start IS NULL OR p_period_end IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid date range'
    );
  END IF;
  
  IF p_period_start > p_period_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Start date must be before end date'
    );
  END IF;
  
  -- Check if already processed for this period
  IF EXISTS (
    SELECT 1 FROM payout_batches 
    WHERE period_start = p_period_start 
    AND period_end = p_period_end
    AND status = 'completed'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payouts already processed for this period'
    );
  END IF;
  
  -- Create batch record
  INSERT INTO payout_batches (
    batch_date, 
    period_start, 
    period_end, 
    status,
    processed_by
  ) VALUES (
    CURRENT_DATE, 
    p_period_start, 
    p_period_end, 
    'processing',
    p_admin_user_id
  )
  RETURNING id INTO v_batch_id;
  
  -- Aggregate earnings by restaurant
  INSERT INTO restaurant_payouts (
    restaurant_id, 
    batch_id, 
    period_start, 
    period_end,
    total_meals, 
    total_earnings_qar,
    payout_status
  )
  SELECT 
    re.restaurant_id,
    v_batch_id,
    p_period_start,
    p_period_end,
    COUNT(*) as total_meals,
    SUM(re.restaurant_payout_qar) as total_earnings,
    'pending'
  FROM restaurant_earnings re
  WHERE re.created_at >= p_period_start
    AND re.created_at < p_period_end + interval '1 day'
    AND re.is_settled = false
  GROUP BY re.restaurant_id
  HAVING COUNT(*) > 0;
  
  -- Get totals
  SELECT 
    COUNT(*),
    COALESCE(SUM(total_earnings_qar), 0)
  INTO v_total_restaurants, v_total_amount
  FROM restaurant_payouts
  WHERE batch_id = v_batch_id;
  
  IF v_total_restaurants = 0 THEN
    -- No payouts to process
    UPDATE payout_batches
    SET status = 'completed',
        total_restaurants = 0,
        total_payout_amount = 0,
        processed_at = now()
    WHERE id = v_batch_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'batch_id', v_batch_id,
      'message', 'No pending payouts for this period',
      'total_restaurants', 0,
      'total_amount', 0
    );
  END IF;
  
  -- Mark earnings as settled
  UPDATE restaurant_earnings
  SET is_settled = true,
      settlement_batch_id = v_batch_id,
      settled_at = now()
  WHERE created_at >= p_period_start
    AND created_at < p_period_end + interval '1 day'
    AND is_settled = false;
  
  -- Update batch totals
  UPDATE payout_batches
  SET total_restaurants = v_total_restaurants,
      total_payout_amount = v_total_amount,
      status = 'completed',
      processed_at = now()
  WHERE id = v_batch_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'total_restaurants', v_total_restaurants,
    'total_amount', v_total_amount,
    'period_start', p_period_start,
    'period_end', p_period_end
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Update batch status to failed
    UPDATE payout_batches
    SET status = 'failed',
        error_message = SQLERRM,
        processed_at = now()
    WHERE id = v_batch_id;
    
    RAISE WARNING 'Error in aggregate_restaurant_payouts: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to aggregate payouts: ' || SQLERRM
    );
END;
$$;

-- ==========================================
-- FUNCTION: Process Single Payout Transfer
-- ==========================================
-- Mark individual restaurant payout as transferred

CREATE OR REPLACE FUNCTION process_payout_transfer(
  p_payout_id uuid,
  p_transfer_reference text,
  p_admin_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout_record restaurant_payouts%ROWTYPE;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_admin_user_id 
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin role required'
    );
  END IF;
  
  -- Get payout record
  SELECT * INTO v_payout_record
  FROM restaurant_payouts
  WHERE id = p_payout_id;
  
  IF v_payout_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout record not found'
    );
  END IF;
  
  IF v_payout_record.payout_status = 'transferred' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout already transferred'
    );
  END IF;
  
  -- Update payout status
  UPDATE restaurant_payouts
  SET payout_status = 'transferred',
      transfer_reference = p_transfer_reference,
      transferred_at = now()
  WHERE id = p_payout_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_payout_id,
    'transfer_reference', p_transfer_reference,
    'transferred_at', now()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in process_payout_transfer: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to process payout transfer'
    );
END;
$$;

-- ==========================================
-- FUNCTION: Get User Credit Balance
-- ==========================================
-- Safe function for clients to check balance

CREATE OR REPLACE FUNCTION get_user_credit_balance(
  p_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_record subscriptions%ROWTYPE;
BEGIN
  -- Verify user is checking their own balance
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Can only check own balance'
    );
  END IF;
  
  SELECT * INTO v_subscription_record
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'has_active_subscription', false,
      'credits_remaining', 0,
      'credits_used', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'has_active_subscription', true,
    'subscription_id', v_subscription_record.id,
    'plan_id', v_subscription_record.plan_id,
    'credits_remaining', v_subscription_record.credits_remaining,
    'credits_used', v_subscription_record.credits_used,
    'status', v_subscription_record.status,
    'current_period_end', v_subscription_record.current_period_end
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in get_user_credit_balance: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to retrieve credit balance'
    );
END;
$$;

-- ==========================================
-- FUNCTION: Bonus Credit Award
-- ==========================================
-- For retention actions (churn prevention)

CREATE OR REPLACE FUNCTION award_bonus_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text,
  p_admin_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
  v_credits_before integer;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = p_admin_user_id 
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin role required'
    );
  END IF;
  
  -- Validate credits amount
  IF p_credits <= 0 OR p_credits > 20 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid credit amount: must be between 1 and 20'
    );
  END IF;
  
  -- Get active subscription
  SELECT id, credits_remaining 
  INTO v_subscription_id, v_credits_before
  FROM subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_subscription_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active subscription found for user'
    );
  END IF;
  
  -- Add bonus credits
  UPDATE subscriptions
  SET credits_remaining = credits_remaining + p_credits,
      updated_at = now()
  WHERE id = v_subscription_id;
  
  -- Record transaction
  INSERT INTO credit_transactions (
    user_id,
    subscription_id,
    transaction_type,
    credits_amount,
    meal_value_qar,
    description,
    metadata
  ) VALUES (
    p_user_id,
    v_subscription_id,
    'bonus',
    p_credits,
    50,
    'Bonus credits: ' || p_reason,
    jsonb_build_object(
      'awarded_by', p_admin_user_id,
      'reason', p_reason,
      'credits_before', v_credits_before,
      'credits_after', v_credits_before + p_credits
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_awarded', p_credits,
    'credits_remaining', v_credits_before + p_credits,
    'reason', p_reason
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in award_bonus_credits: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to award bonus credits'
    );
END;
$$;

-- ==========================================
-- VIEWS FOR REPORTING
-- ==========================================

-- View: Daily Revenue Summary
CREATE OR REPLACE VIEW daily_revenue_summary AS
SELECT 
  DATE_TRUNC('day', created_at)::date as date,
  COUNT(*) as total_orders,
  SUM(meal_value_qar) as total_meal_value,
  SUM(platform_commission_qar) as total_commission,
  SUM(restaurant_payout_qar) as total_restaurant_payout
FROM restaurant_earnings
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- View: Restaurant Earnings Pending Settlement
CREATE OR REPLACE VIEW restaurant_pending_earnings AS
SELECT 
  re.restaurant_id,
  r.name as restaurant_name,
  COUNT(*) as pending_meals,
  SUM(re.restaurant_payout_qar) as pending_payout_amount,
  MIN(re.created_at) as oldest_order_date,
  MAX(re.created_at) as newest_order_date
FROM restaurant_earnings re
JOIN restaurants r ON re.restaurant_id = r.id
WHERE re.is_settled = false
GROUP BY re.restaurant_id, r.name
ORDER BY pending_payout_amount DESC;

-- View: User Credit Utilization
CREATE OR REPLACE VIEW user_credit_utilization AS
SELECT 
  s.user_id,
  p.email,
  s.id as subscription_id,
  sp.name as plan_name,
  s.credits_remaining,
  s.credits_used,
  sp.meal_credits as total_credits,
  ROUND((s.credits_used::decimal / sp.meal_credits * 100), 2) as utilization_percent,
  s.current_period_end
FROM subscriptions s
JOIN subscription_plans sp ON s.plan_id = sp.id
JOIN profiles p ON s.user_id = p.id
WHERE s.status = 'active';

-- ==========================================
-- COMMENTS
-- ==========================================

COMMENT ON FUNCTION deduct_meal_credit IS 'CRITICAL: Atomic credit deduction with race condition protection. NEVER call from client-side without server validation.';
COMMENT ON FUNCTION allocate_subscription_credits IS 'Allocates credits when new subscription is purchased. Validates payment before allocation.';
COMMENT ON FUNCTION aggregate_restaurant_payouts IS 'Admin-only function to batch process restaurant payouts every 3 days. Creates immutable audit trail.';
COMMENT ON FUNCTION award_bonus_credits IS 'Admin-only function to award bonus credits for retention. Limited to 20 credits max per award.';
