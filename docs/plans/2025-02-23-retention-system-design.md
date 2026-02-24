# Design Document: Advanced Subscription Retention System + Body Progress Dashboard

## 1. Executive Summary

This document outlines the design for implementing two major features to improve subscription retention and customer engagement:

1. **Smart Unused Meals Management**: Rollover credits (20% max) + Subscription freeze (7 days/month)
2. **Body Progress Dashboard**: Numeric health tracking with AI-calculated compliance scores

## 2. Database Schema Design

### 2.1 Subscription Rollover System

```sql
-- Table: subscription_rollovers
-- Purpose: Track rollover credits with expiration
CREATE TABLE subscription_rollovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) NOT NULL,
  rollover_credits integer NOT NULL CHECK (rollover_credits >= 0),
  source_cycle_start date NOT NULL, -- Which cycle these rolled over from
  source_cycle_end date NOT NULL,
  expiry_date date NOT NULL, -- End of next billing cycle
  is_consumed boolean DEFAULT false,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  
  -- Constraint: Expiry must be after source cycle
  CONSTRAINT valid_expiry CHECK (expiry_date > source_cycle_end)
);

-- Index for efficient queries
CREATE INDEX idx_rollovers_user_active ON subscription_rollovers(user_id, is_consumed, expiry_date) 
  WHERE is_consumed = false;
CREATE INDEX idx_rollovers_subscription ON subscription_rollovers(subscription_id);
CREATE INDEX idx_rollovers_expiry ON subscription_rollovers(expiry_date) 
  WHERE is_consumed = false;

-- RLS: Users can only see their own rollovers
ALTER TABLE subscription_rollovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rollover_user_own" ON subscription_rollovers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "rollover_admin_all" ON subscription_rollovers
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```

### 2.2 Subscription Freeze System

```sql
-- Table: subscription_freezes
-- Purpose: Track subscription freeze periods
CREATE TABLE subscription_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  subscription_id uuid REFERENCES subscriptions(id) NOT NULL,
  freeze_start_date date NOT NULL,
  freeze_end_date date NOT NULL,
  freeze_days integer NOT NULL CHECK (freeze_days > 0 AND freeze_days <= 7),
  billing_cycle_start date NOT NULL,
  billing_cycle_end date NOT NULL,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  requested_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  
  -- Constraint: Freeze must be within billing cycle
  CONSTRAINT valid_freeze_period CHECK (
    freeze_start_date >= billing_cycle_start AND 
    freeze_end_date <= billing_cycle_end AND
    freeze_end_date > freeze_start_date
  ),
  -- Constraint: Freeze cannot exceed 7 days
  CONSTRAINT max_freeze_days CHECK (freeze_days <= 7)
);

-- Indexes
CREATE INDEX idx_freezes_user_active ON subscription_freezes(user_id, status) 
  WHERE status IN ('scheduled', 'active');
CREATE INDEX idx_freezes_subscription ON subscription_freezes(subscription_id);
CREATE INDEX idx_freezes_cycle ON subscription_freezes(billing_cycle_start, billing_cycle_end);

-- RLS
ALTER TABLE subscription_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "freeze_user_own" ON subscription_freezes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "freeze_user_insert" ON subscription_freezes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "freeze_user_cancel" ON subscription_freezes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'scheduled')
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "freeze_admin_all" ON subscription_freezes
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```

### 2.3 User Body Metrics

```sql
-- Table: user_body_metrics
-- Purpose: Store weekly body measurements
CREATE TABLE user_body_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  recorded_at date NOT NULL,
  weight_kg decimal(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  waist_cm decimal(5,2) CHECK (waist_cm > 0 AND waist_cm < 300),
  body_fat_percent decimal(4,2) CHECK (body_fat_percent >= 0 AND body_fat_percent <= 100),
  muscle_mass_percent decimal(4,2) CHECK (muscle_mass_percent >= 0 AND muscle_mass_percent <= 100),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraint: Only one entry per week
  UNIQUE(user_id, recorded_at)
);

-- Indexes
CREATE INDEX idx_body_metrics_user_date ON user_body_metrics(user_id, recorded_at DESC);
CREATE INDEX idx_body_metrics_recorded ON user_body_metrics(recorded_at);

-- RLS
ALTER TABLE user_body_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "body_metrics_user_own" ON user_body_metrics
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "body_metrics_admin_all" ON user_body_metrics
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```

### 2.4 User Health Scores

```sql
-- Table: user_health_scores
-- Purpose: Store calculated compliance scores
CREATE TABLE user_health_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  calculated_at timestamptz DEFAULT now(),
  score_week_start date NOT NULL,
  
  -- Component scores (0-100)
  macro_adherence_score decimal(5,2) CHECK (macro_adherence_score BETWEEN 0 AND 100),
  meal_consistency_score decimal(5,2) CHECK (meal_consistency_score BETWEEN 0 AND 100),
  weight_logging_score decimal(5,2) CHECK (weight_logging_score BETWEEN 0 AND 100),
  protein_accuracy_score decimal(5,2) CHECK (protein_accuracy_score BETWEEN 0 AND 100),
  
  -- Final weighted score
  overall_score decimal(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  
  -- Score category
  category text GENERATED ALWAYS AS (
    CASE 
      WHEN overall_score >= 80 THEN 'green'
      WHEN overall_score >= 60 THEN 'orange'
      ELSE 'red'
    END
  ) STORED,
  
  -- Metrics used for calculation
  metrics_used jsonb NOT NULL DEFAULT '{}',
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(user_id, score_week_start)
);

-- Indexes
CREATE INDEX idx_health_scores_user ON user_health_scores(user_id, calculated_at DESC);
CREATE INDEX idx_health_scores_week ON user_health_scores(score_week_start);

-- RLS
ALTER TABLE user_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "health_scores_user_own" ON user_health_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "health_scores_admin_all" ON user_health_scores
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');
```

### 2.5 Retention Audit Logs

```sql
-- Table: retention_audit_logs
-- Purpose: Comprehensive audit trail for all retention actions
CREATE TABLE retention_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'rollover_calculated', 'rollover_consumed', 'rollover_expired',
    'freeze_scheduled', 'freeze_activated', 'freeze_completed', 'freeze_cancelled',
    'credit_consumed', 'subscription_renewed', 'health_score_calculated'
  )),
  subscription_id uuid REFERENCES subscriptions(id),
  action_details jsonb NOT NULL DEFAULT '{}',
  previous_state jsonb,
  new_state jsonb,
  triggered_by text NOT NULL CHECK (triggered_by IN ('user', 'system', 'admin')),
  triggered_by_user_id uuid REFERENCES auth.users,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX idx_audit_logs_user ON retention_audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON retention_audit_logs(action_type, created_at DESC);
CREATE INDEX idx_audit_logs_subscription ON retention_audit_logs(subscription_id);
CREATE INDEX idx_audit_logs_created ON retention_audit_logs(created_at DESC);

-- RLS
ALTER TABLE retention_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_user_own" ON retention_audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "audit_logs_admin_all" ON retention_audit_logs
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Immutable - no updates allowed
CREATE POLICY "audit_logs_no_update" ON retention_audit_logs
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "audit_logs_no_delete" ON retention_audit_logs
  FOR DELETE TO authenticated
  USING (false);
```

### 2.6 Modify Existing Subscriptions Table

```sql
-- Add new columns to subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS rollover_credits integer DEFAULT 0 CHECK (rollover_credits >= 0),
  ADD COLUMN IF NOT EXISTS rollover_expiry_date date,
  ADD COLUMN IF NOT EXISTS freeze_days_used integer DEFAULT 0 CHECK (freeze_days_used >= 0 AND freeze_days_used <= 7),
  ADD COLUMN IF NOT EXISTS billing_cycle_start date,
  ADD COLUMN IF NOT EXISTS billing_cycle_end date,
  ADD COLUMN IF NOT EXISTS last_health_score decimal(5,2),
  ADD COLUMN IF NOT EXISTS last_health_score_at timestamptz;

-- Update existing records with default cycle dates
UPDATE subscriptions 
SET billing_cycle_start = COALESCE(start_date, CURRENT_DATE),
    billing_cycle_end = COALESCE(end_date, CURRENT_DATE + INTERVAL '30 days')
WHERE billing_cycle_start IS NULL;

-- Indexes
CREATE INDEX idx_subscriptions_rollover ON subscriptions(user_id, rollover_credits) 
  WHERE rollover_credits > 0;
CREATE INDEX idx_subscriptions_freeze ON subscriptions(user_id, freeze_days_used);
CREATE INDEX idx_subscriptions_cycle ON subscriptions(billing_cycle_start, billing_cycle_end);
```

## 3. Database Functions

### 3.1 Calculate Rollover Credits

```sql
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
  v_monthly_credits integer;
  v_unused_credits integer;
  v_max_rollover integer;
  v_rollover_amount integer;
  v_cycle_start date;
  v_cycle_end date;
  v_result jsonb;
BEGIN
  -- Get subscription details
  SELECT * INTO v_subscription_record
  FROM subscriptions
  WHERE id = p_subscription_id 
    AND user_id = p_user_id
    AND status = 'active'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Active subscription not found'
    );
  END IF;
  
  -- Get plan details
  SELECT * INTO v_plan_record
  FROM subscription_plans
  WHERE id = v_subscription_record.plan_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Subscription plan not found'
    );
  END IF;
  
  -- Calculate monthly credits and unused
  v_monthly_credits := v_plan_record.meal_credits;
  v_unused_credits := v_subscription_record.credits_remaining;
  
  -- Calculate max rollover (20% rounded down)
  v_max_rollover := FLOOR(v_monthly_credits * 0.20);
  
  -- Determine actual rollover amount
  v_rollover_amount := LEAST(v_unused_credits, v_max_rollover);
  
  -- Calculate new cycle dates (extended by freeze days)
  v_cycle_start := v_subscription_record.billing_cycle_end + INTERVAL '1 day';
  v_cycle_end := v_cycle_start + INTERVAL '30 days' - INTERVAL '1 day';
  
  -- Apply freeze extension if there was a freeze
  IF v_subscription_record.freeze_days_used > 0 THEN
    v_cycle_end := v_cycle_end + (v_subscription_record.freeze_days_used || ' days')::interval;
  END IF;
  
  -- Create rollover record
  IF v_rollover_amount > 0 THEN
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
      v_subscription_record.billing_cycle_start,
      v_subscription_record.billing_cycle_end,
      v_cycle_end
    );
  END IF;
  
  -- Update subscription
  UPDATE subscriptions
  SET rollover_credits = v_rollover_amount,
      rollover_expiry_date = v_cycle_end,
      freeze_days_used = 0, -- Reset for new cycle
      billing_cycle_start = v_cycle_start,
      billing_cycle_end = v_cycle_end,
      credits_remaining = v_rollover_amount + v_monthly_credits,
      credits_used = 0,
      updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Log the rollover
  INSERT INTO retention_audit_logs (
    user_id,
    subscription_id,
    action_type,
    action_details,
    previous_state,
    new_state,
    triggered_by
  ) VALUES (
    p_user_id,
    p_subscription_id,
    'rollover_calculated',
    jsonb_build_object(
      'monthly_credits', v_monthly_credits,
      'unused_credits', v_unused_credits,
      'max_rollover_allowed', v_max_rollover,
      'rollover_applied', v_rollover_amount,
      'cycle_start', v_cycle_start,
      'cycle_end', v_cycle_end
    ),
    jsonb_build_object(
      'credits_remaining', v_unused_credits,
      'cycle_start', v_subscription_record.billing_cycle_start,
      'cycle_end', v_subscription_record.billing_cycle_end
    ),
    jsonb_build_object(
      'credits_remaining', v_rollover_amount + v_monthly_credits,
      'rollover_credits', v_rollover_amount,
      'cycle_start', v_cycle_start,
      'cycle_end', v_cycle_end
    ),
    'system'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'rollover_credits', v_rollover_amount,
    'new_cycle_start', v_cycle_start,
    'new_cycle_end', v_cycle_end,
    'total_credits', v_rollover_amount + v_monthly_credits
  );
END;
$$;
```

### 3.2 Request Subscription Freeze

```sql
CREATE OR REPLACE FUNCTION request_subscription_freeze(
  p_user_id uuid,
  p_subscription_id uuid,
  p_freeze_start_date date,
  p_freeze_end_date date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_record subscriptions%ROWTYPE;
  v_freeze_days integer;
  v_days_remaining integer;
  v_days_before_start integer;
  v_existing_freeze_days integer;
  v_result jsonb;
BEGIN
  -- Validate dates
  IF p_freeze_start_date >= p_freeze_end_date THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Freeze end date must be after start date'
    );
  END IF;
  
  -- Calculate freeze duration
  v_freeze_days := p_freeze_end_date - p_freeze_start_date;
  
  -- Must schedule at least 24 hours in advance
  v_days_before_start := p_freeze_start_date - CURRENT_DATE;
  IF v_days_before_start < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Freeze must be scheduled at least 24 hours in advance'
    );
  END IF;
  
  -- Get subscription
  SELECT * INTO v_subscription_record
  FROM subscriptions
  WHERE id = p_subscription_id 
    AND user_id = p_user_id
    AND status = 'active'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Active subscription not found'
    );
  END IF;
  
  -- Check if freeze is within current billing cycle
  IF p_freeze_start_date < v_subscription_record.billing_cycle_start OR 
     p_freeze_end_date > v_subscription_record.billing_cycle_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Freeze period must be within current billing cycle'
    );
  END IF;
  
  -- Check freeze days remaining
  v_days_remaining := 7 - v_subscription_record.freeze_days_used;
  IF v_freeze_days > v_days_remaining THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Only %s freeze days remaining this cycle', v_days_remaining)
    );
  END IF;
  
  -- Check for overlapping freezes
  SELECT COALESCE(SUM(freeze_days), 0) INTO v_existing_freeze_days
  FROM subscription_freezes
  WHERE subscription_id = p_subscription_id
    AND status IN ('scheduled', 'active')
    AND (
      (p_freeze_start_date BETWEEN freeze_start_date AND freeze_end_date) OR
      (p_freeze_end_date BETWEEN freeze_start_date AND freeze_end_date) OR
      (freeze_start_date BETWEEN p_freeze_start_date AND p_freeze_end_date)
    );
  
  IF v_existing_freeze_days > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Freeze period overlaps with existing scheduled freeze'
    );
  END IF;
  
  -- Create freeze record
  INSERT INTO subscription_freezes (
    user_id,
    subscription_id,
    freeze_start_date,
    freeze_end_date,
    freeze_days,
    billing_cycle_start,
    billing_cycle_end
  ) VALUES (
    p_user_id,
    p_subscription_id,
    p_freeze_start_date,
    p_freeze_end_date,
    v_freeze_days,
    v_subscription_record.billing_cycle_start,
    v_subscription_record.billing_cycle_end
  );
  
  -- Update subscription freeze days used
  UPDATE subscriptions
  SET freeze_days_used = freeze_days_used + v_freeze_days,
      updated_at = now()
  WHERE id = p_subscription_id;
  
  -- Log the action
  INSERT INTO retention_audit_logs (
    user_id,
    subscription_id,
    action_type,
    action_details,
    triggered_by,
    triggered_by_user_id
  ) VALUES (
    p_user_id,
    p_subscription_id,
    'freeze_scheduled',
    jsonb_build_object(
      'freeze_start', p_freeze_start_date,
      'freeze_end', p_freeze_end_date,
      'freeze_days', v_freeze_days,
      'days_remaining_after', v_days_remaining - v_freeze_days
    ),
    'user',
    p_user_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'freeze_days', v_freeze_days,
    'freeze_start', p_freeze_start_date,
    'freeze_end', p_freeze_end_date,
    'days_remaining_this_cycle', v_days_remaining - v_freeze_days
  );
END;
$$;
```

### 3.3 Consume Credit with Rollover Priority

```sql
CREATE OR REPLACE FUNCTION consume_meal_credit_v2(
  p_user_id uuid,
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription_id uuid;
  v_rollover_record subscription_rollovers%ROWTYPE;
  v_credits_remaining integer;
  v_consumed_from_rollover integer := 0;
  v_consumed_from_new integer := 0;
  v_result jsonb;
BEGIN
  -- Verify order exists and belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE id = p_order_id 
    AND user_id = p_user_id
    AND status NOT IN ('cancelled', 'refunded')
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Order not found or not valid'
    );
  END IF;
  
  -- Get active subscription
  SELECT id, credits_remaining, rollover_credits
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
  
  -- Check for active rollover credits (not expired)
  SELECT * INTO v_rollover_record
  FROM subscription_rollovers
  WHERE user_id = p_user_id
    AND subscription_id = v_subscription_id
    AND is_consumed = false
    AND expiry_date >= CURRENT_DATE
  ORDER BY expiry_date ASC -- Consume oldest first
  LIMIT 1
  FOR UPDATE;
  
  -- Consume from rollover first if available
  IF FOUND THEN
    UPDATE subscription_rollovers
    SET is_consumed = true,
        consumed_at = now()
    WHERE id = v_rollover_record.id;
    
    v_consumed_from_rollover := 1;
  ELSE
    -- No rollover, consume from new credits
    v_consumed_from_new := 1;
  END IF;
  
  -- Update subscription credits
  UPDATE subscriptions
  SET credits_remaining = credits_remaining - 1,
      credits_used = credits_used + 1,
      rollover_credits = CASE 
        WHEN v_consumed_from_rollover > 0 THEN GREATEST(0, rollover_credits - 1)
        ELSE rollover_credits
      END,
      updated_at = now()
  WHERE id = v_subscription_id
    AND credits_remaining > 0;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Credit deduction failed - concurrent modification'
    );
  END IF;
  
  -- Record transaction
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
    'Meal order deduction',
    p_order_id,
    jsonb_build_object(
      'consumed_from_rollover', v_consumed_from_rollover > 0,
      'rollover_id', v_rollover_record.id,
      'remaining_credits', v_credits_remaining - 1
    )
  );
  
  -- Log audit
  INSERT INTO retention_audit_logs (
    user_id,
    subscription_id,
    action_type,
    action_details,
    triggered_by,
    triggered_by_user_id
  ) VALUES (
    p_user_id,
    v_subscription_id,
    'credit_consumed',
    jsonb_build_object(
      'order_id', p_order_id,
      'from_rollover', v_consumed_from_rollover > 0,
      'rollover_credits_before', v_rollover_record.rollover_credits,
      'total_credits_remaining', v_credits_remaining - 1
    ),
    'user',
    p_user_id
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_remaining', v_credits_remaining - 1,
    'consumed_from_rollover', v_consumed_from_rollover > 0,
    'subscription_id', v_subscription_id
  );
END;
$$;
```

### 3.4 Calculate Health Compliance Score

```sql
CREATE OR REPLACE FUNCTION calculate_health_compliance_score(
  p_user_id uuid,
  p_week_start date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_macro_adherence decimal(5,2);
  v_meal_consistency decimal(5,2);
  v_weight_logging decimal(5,2);
  v_protein_accuracy decimal(5,2);
  v_overall_score decimal(5,2);
  v_weight_logs_count integer;
  v_target_meals integer;
  v_actual_meals integer;
  v_target_protein integer;
  v_actual_protein integer;
  v_result jsonb;
BEGIN
  -- Get user's nutrition targets
  SELECT target_protein INTO v_target_protein
  FROM profiles
  WHERE id = p_user_id;
  
  -- 1. Calculate Macro Adherence (40% weight)
  -- Based on weekly meal plan adherence
  SELECT 
    COALESCE(AVG(
      CASE 
        WHEN total_calories > 0 THEN 
          100 - LEAST(ABS(total_calories - (SELECT target_calories FROM profiles WHERE id = p_user_id))::decimal / 
            NULLIF((SELECT target_calories FROM profiles WHERE id = p_user_id), 0) * 100, 100)
        ELSE 0
      END
    ), 0) INTO v_macro_adherence
  FROM weekly_meal_plans
  WHERE user_id = p_user_id
    AND week_start_date >= p_week_start
    AND week_start_date < p_week_start + INTERVAL '7 days'
    AND user_accepted = true;
  
  -- 2. Calculate Meal Consistency (30% weight)
  -- Based on actual orders vs planned meals
  SELECT 
    COUNT(*) FILTER (WHERE order_id IS NOT NULL),
    COUNT(*)
  INTO v_actual_meals, v_target_meals
  FROM weekly_meal_plan_items wmpi
  JOIN weekly_meal_plans wmp ON wmp.id = wmpi.plan_id
  WHERE wmp.user_id = p_user_id
    AND wmp.week_start_date >= p_week_start
    AND wmp.week_start_date < p_week_start + INTERVAL '7 days';
  
  v_meal_consistency := CASE 
    WHEN v_target_meals > 0 THEN (v_actual_meals::decimal / v_target_meals) * 100
    ELSE 0
  END;
  
  -- 3. Calculate Weight Logging Consistency (20% weight)
  -- Based on weekly body metrics entries
  SELECT COUNT(*) INTO v_weight_logs_count
  FROM user_body_metrics
  WHERE user_id = p_user_id
    AND recorded_at >= p_week_start
    AND recorded_at < p_week_start + INTERVAL '7 days';
  
  v_weight_logging := LEAST(v_weight_logs_count::decimal / 1 * 100, 100); -- At least 1 log per week for full score
  
  -- 4. Calculate Protein Accuracy (10% weight)
  -- Based on actual protein intake vs target
  SELECT COALESCE(AVG(protein), 0) INTO v_actual_protein
  FROM weekly_meal_plan_items wmpi
  JOIN weekly_meal_plans wmp ON wmp.id = wmpi.plan_id
  WHERE wmp.user_id = p_user_id
    AND wmp.week_start_date >= p_week_start
    AND wmp.week_start_date < p_week_start + INTERVAL '7 days'
    AND wmpi.order_id IS NOT NULL;
  
  v_protein_accuracy := CASE 
    WHEN v_target_protein > 0 AND v_actual_protein > 0 THEN
      100 - LEAST(ABS(v_actual_protein - v_target_protein)::decimal / v_target_protein * 100, 100)
    ELSE 50 -- Neutral if no data
  END;
  
  -- Calculate weighted overall score
  v_overall_score := 
    (v_macro_adherence * 0.40) +
    (v_meal_consistency * 0.30) +
    (v_weight_logging * 0.20) +
    (v_protein_accuracy * 0.10);
  
  -- Ensure score is between 0 and 100
  v_overall_score := GREATEST(0, LEAST(100, v_overall_score));
  
  -- Round to 2 decimal places
  v_overall_score := ROUND(v_overall_score, 2);
  v_macro_adherence := ROUND(v_macro_adherence, 2);
  v_meal_consistency := ROUND(v_meal_consistency, 2);
  v_weight_logging := ROUND(v_weight_logging, 2);
  v_protein_accuracy := ROUND(v_protein_accuracy, 2);
  
  -- Insert or update health score
  INSERT INTO user_health_scores (
    user_id,
    score_week_start,
    macro_adherence_score,
    meal_consistency_score,
    weight_logging_score,
    protein_accuracy_score,
    overall_score,
    metrics_used
  ) VALUES (
    p_user_id,
    p_week_start,
    v_macro_adherence,
    v_meal_consistency,
    v_weight_logging,
    v_protein_accuracy,
    v_overall_score,
    jsonb_build_object(
      'weight_logs_count', v_weight_logs_count,
      'target_meals', v_target_meals,
      'actual_meals', v_actual_meals,
      'target_protein', v_target_protein,
      'actual_protein_avg', v_actual_protein
    )
  )
  ON CONFLICT (user_id, score_week_start)
  DO UPDATE SET
    macro_adherence_score = EXCLUDED.macro_adherence_score,
    meal_consistency_score = EXCLUDED.meal_consistency_score,
    weight_logging_score = EXCLUDED.weight_logging_score,
    protein_accuracy_score = EXCLUDED.protein_accuracy_score,
    overall_score = EXCLUDED.overall_score,
    metrics_used = EXCLUDED.metrics_used,
    calculated_at = now();
  
  -- Update subscription with latest score
  UPDATE subscriptions
  SET last_health_score = v_overall_score,
      last_health_score_at = now()
  WHERE user_id = p_user_id
    AND status = 'active';
  
  -- Log calculation
  INSERT INTO retention_audit_logs (
    user_id,
    action_type,
    action_details,
    triggered_by
  ) VALUES (
    p_user_id,
    'health_score_calculated',
    jsonb_build_object(
      'week_start', p_week_start,
      'macro_adherence', v_macro_adherence,
      'meal_consistency', v_meal_consistency,
      'weight_logging', v_weight_logging,
      'protein_accuracy', v_protein_accuracy,
      'overall_score', v_overall_score
    ),
    'system'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'overall_score', v_overall_score,
    'category', CASE 
      WHEN v_overall_score >= 80 THEN 'green'
      WHEN v_overall_score >= 60 THEN 'orange'
      ELSE 'red'
    END,
    'breakdown', jsonb_build_object(
      'macro_adherence', v_macro_adherence,
      'meal_consistency', v_meal_consistency,
      'weight_logging', v_weight_logging,
      'protein_accuracy', v_protein_accuracy
    )
  );
END;
$$;
```

## 4. Edge Functions

### 4.1 Process Subscription Renewal

**File**: `supabase/functions/process-subscription-renewal/index.ts`

**Purpose**: Handles subscription renewal with rollover calculation

**Logic**:
1. Check if subscription is due for renewal
2. Calculate rollover credits (20% max)
3. Apply freeze extensions if needed
4. Reset credits for new cycle
5. Log all actions

### 4.2 Handle Freeze Request

**File**: `supabase/functions/handle-freeze-request/index.ts`

**Purpose**: Processes subscription freeze requests

**Logic**:
1. Validate freeze dates (24h advance notice)
2. Check freeze days remaining (max 7 per cycle)
3. Prevent overlapping freezes
4. Create freeze record
5. Update subscription

### 4.3 Calculate Health Score

**File**: `supabase/functions/calculate-health-score/index.ts`

**Purpose**: Calculates weekly health compliance score

**Logic**:
1. Retrieve user's nutrition targets
2. Calculate macro adherence (40%)
3. Calculate meal consistency (30%)
4. Calculate weight logging consistency (20%)
5. Calculate protein accuracy (10%)
6. Store weighted overall score
7. Return score with breakdown

### 4.4 Cleanup Expired Rollovers

**File**: `supabase/functions/cleanup-expired-rollovers/index.ts`

**Purpose**: Cron job to handle expired rollover credits

**Logic**:
1. Find all expired rollover credits
2. Mark as consumed
3. Log expiration
4. Update subscription rollover count

## 5. Frontend Components

### 5.1 Customer Portal

#### Body Progress Dashboard

**File**: `src/pages/dashboard/BodyProgressDashboard.tsx`

**Components**:
- `WeightTrendChart` - Line chart showing weight over time
- `WaistMeasurementChart` - Waist circumference trends
- `BodyFatChart` - Body fat percentage over time
- `ComplianceScoreCard` - Current health score with visual indicator
- `MonthlyComparison` - Month-over-month stats
- `AddMetricsButton` - Opens modal to log new measurements

#### Weekly Metrics Form

**File**: `src/components/body-metrics/WeeklyMetricsForm.tsx`

**Fields**:
- Weight (kg) - Required
- Waist circumference (cm) - Optional
- Body fat % - Optional
- Muscle mass % - Optional
- Notes - Optional

**Validation**:
- Weight: 0-500kg
- Waist: 0-300cm
- Body fat: 0-100%
- Muscle mass: 0-100%

#### Freeze Subscription Modal

**File**: `src/components/subscription/FreezeSubscriptionModal.tsx`

**Features**:
- Date picker for freeze start/end
- Display remaining freeze days
- Validation messages
- Confirmation screen

#### Rollover Credits Display

**File**: `src/components/subscription/RolloverCreditsDisplay.tsx`

**Features**:
- Current rollover credits
- Expiry countdown
- Visual indicator in subscription card

### 5.2 Admin Portal

#### Freeze Management Panel

**File**: `src/pages/admin/subscriptions/FreezeManagementPanel.tsx`

**Features**:
- List all scheduled/active freezes
- Cancel freeze option
- Filter by status
- Export freeze history

#### Rollover Audit Log Viewer

**File**: `src/pages/admin/audit/RolloverAuditLogViewer.tsx`

**Features**:
- Filter by action type
- Filter by date range
- Filter by user
- Export to CSV

#### Retention Analytics Dashboard

**File**: `src/pages/admin/analytics/RetentionAnalyticsDashboard.tsx`

**Metrics**:
- Average rollover usage rate
- Freeze utilization rate
- Health score distribution
- Retention correlation analysis

## 6. Security & Abuse Prevention

### 6.1 Server-Side Validation

All critical calculations happen server-side:
- Rollover amount calculation
- Freeze day validation
- Credit consumption order
- Health score calculation

### 6.2 Rate Limiting

- Freeze requests: Max 3 per day per user
- Body metrics logging: Max 1 per day per user
- Score calculations: Automated, no user-initiated

### 6.3 RLS Policies

All new tables have strict RLS policies:
- Users can only access their own data
- Admins have full access
- Audit logs are immutable

### 6.4 Audit Trail

Every action is logged:
- Rollover calculations
- Freeze scheduling/completion
- Credit consumption
- Health score calculations

## 7. Scalability Considerations

### 7.1 Database Optimization

- Indexes on all query-heavy columns
- Partitioning for audit logs (by month)
- Materialized views for dashboard aggregations

### 7.2 Performance Targets

- Dashboard load: < 2 seconds
- Freeze request: < 1 second
- Score calculation: < 500ms
- Support 10,000+ concurrent users

### 7.3 Caching Strategy

- Cache health scores for 1 hour
- Cache rollover data for session
- Cache freeze status for 5 minutes

## 8. Edge Cases

### 8.1 Rollover Edge Cases

1. **User cancels subscription** - Rollover credits forfeited
2. **Downgrade plan** - Rollover recalculated based on new plan
3. **Upgrade plan** - Rollover remains, new credits added
4. **Freeze period** - Extends expiry date
5. **Multiple rollovers** - Consume oldest first (FIFO)

### 8.2 Freeze Edge Cases

1. **Freeze during freeze** - Prevented by validation
2. **Cancel freeze** - Only if status = 'scheduled'
3. **Subscription cancelled during freeze** - Freeze cancelled, pro-rated refund
4. **Freeze at cycle end** - Must not extend into next cycle

### 8.3 Body Metrics Edge Cases

1. **Multiple entries per week** - Update existing entry
2. **Missing weeks** - Affects weight logging score
3. **Extreme values** - Validation prevents unrealistic entries
4. **Retroactive entries** - Allowed but flagged in audit

## 9. Implementation Phases

### Phase 1: Database (Week 1)
- Create all new tables
- Write migration files
- Create database functions
- Set up RLS policies

### Phase 2: Backend (Week 2)
- Implement Edge Functions
- Set up cron jobs
- Write unit tests
- Security validation

### Phase 3: Customer Portal (Week 3)
- Body Progress Dashboard
- Weekly Metrics Form
- Freeze controls
- Rollover display

### Phase 4: Admin Portal (Week 4)
- Freeze management
- Audit log viewer
- Analytics dashboard
- Export tools

### Phase 5: Partner Portal (Week 4)
- Freeze status display
- Order processing updates

### Phase 6: Testing & Deployment (Week 5)
- Integration testing
- Load testing
- Security audit
- Production deployment

## 10. Success Metrics

### Retention Metrics
- Subscription renewal rate
- Rollover utilization rate (>50% target)
- Freeze utilization rate
- Customer retention rate

### Engagement Metrics
- Weekly body metrics logging rate
- Health score improvement over time
- Dashboard visit frequency
- Feature adoption rate

### Technical Metrics
- API response times
- Database query performance
- Error rates
- System uptime

---

**Document Status**: Ready for Implementation
**Last Updated**: 2025-02-23
**Next Review**: Before Phase 1 Completion
