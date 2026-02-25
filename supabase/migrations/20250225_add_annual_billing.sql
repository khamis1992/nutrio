-- Migration: Annual Subscription Billing
-- Date: 2025-02-25
-- Description: Adds annual billing option with discount and proper renewal handling
-- Addresses: MW-001 (Annual Subscription Plans)

-- Add billing interval to subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(10) DEFAULT 'monthly' 
CHECK (billing_interval IN ('monthly', 'annual'));

-- Add annual discount tracking
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS annual_discount_percent INTEGER DEFAULT 0;

-- Add annual renewal date (for annual subscriptions)
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS annual_renewal_date DATE;

-- Create subscription plans reference table if not exists
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('basic', 'standard', 'premium', 'vip')),
    billing_interval VARCHAR(10) NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
    price_qar DECIMAL(10,2) NOT NULL,
    meals_per_month INTEGER NOT NULL,
    discount_percent INTEGER DEFAULT 0,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tier, billing_interval)
);

-- Insert default plans
INSERT INTO subscription_plans (tier, billing_interval, price_qar, meals_per_month, discount_percent, features) VALUES
    ('basic', 'monthly', 2900, 58, 0, '["Basic nutrition tracking", "Email support", "50+ restaurants"]'),
    ('basic', 'annual', 29000, 58, 17, '["Basic nutrition tracking", "Email support", "50+ restaurants", "2 months free"]'),
    ('standard', 'monthly', 3900, 78, 0, '["AI recommendations", "Priority support", "Weekly planning", "Most popular"]'),
    ('standard', 'annual', 39000, 78, 17, '["AI recommendations", "Priority support", "Weekly planning", "2 months free"]'),
    ('premium', 'monthly', 4900, 98, 0, '["Dietitian access", "All Premium features", "Family sharing"]'),
    ('premium', 'annual', 49000, 98, 17, '["Dietitian access", "All Premium features", "Family sharing", "2 months free"]'),
    ('vip', 'monthly', 0, 999, 0, '["Unlimited meals", "Priority delivery", "Personal coach", "15% meal discount"]'),
    ('vip', 'annual', 0, 999, 0, '["Unlimited meals", "Priority delivery", "Personal coach", "15% meal discount"]')
ON CONFLICT (tier, billing_interval) DO UPDATE SET
    price_qar = EXCLUDED.price_qar,
    discount_percent = EXCLUDED.discount_percent,
    updated_at = NOW();

-- Create index for plan lookups
CREATE INDEX idx_subscription_plans_lookup ON subscription_plans(tier, billing_interval, is_active);

-- Function to calculate annual price (2 months free = ~17% discount)
CREATE OR REPLACE FUNCTION calculate_annual_price(
    p_monthly_price DECIMAL(10,2)
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- 10 months price = 2 months free
    RETURN p_monthly_price * 10;
END;
$$;

-- Function to create subscription with proper billing interval
CREATE OR REPLACE FUNCTION create_subscription(
    p_user_id UUID,
    p_tier VARCHAR(20),
    p_billing_interval VARCHAR(10) DEFAULT 'monthly',
    p_payment_method_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_subscription_id UUID;
    v_result JSONB;
    v_next_renewal DATE;
    v_annual_renewal DATE;
BEGIN
    -- Validate tier
    IF p_tier NOT IN ('basic', 'standard', 'premium', 'vip') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invalid tier: ' || p_tier,
            'code', 'INVALID_TIER'
        );
    END IF;

    -- Get plan details
    SELECT * INTO v_plan
    FROM subscription_plans
    WHERE tier = p_tier
    AND billing_interval = p_billing_interval
    AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Plan not found: ' || p_tier || ' ' || p_billing_interval,
            'code', 'PLAN_NOT_FOUND'
        );
    END IF;

    -- Calculate renewal dates
    v_next_renewal := CASE 
        WHEN p_billing_interval = 'annual' THEN CURRENT_DATE + INTERVAL '1 month'
        ELSE CURRENT_DATE + INTERVAL '1 month'
    END;

    v_annual_renewal := CASE 
        WHEN p_billing_interval = 'annual' THEN CURRENT_DATE + INTERVAL '1 year'
        ELSE NULL
    END;

    -- Check for existing subscription
    IF EXISTS (SELECT 1 FROM subscriptions WHERE user_id = p_user_id AND status = 'active') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User already has an active subscription',
            'code', 'ALREADY_SUBSCRIBED'
        );
    END IF;

    -- Create subscription
    INSERT INTO subscriptions (
        user_id,
        tier,
        plan,
        status,
        billing_interval,
        annual_discount_percent,
        price,
        meals_per_month,
        meals_used_this_month,
        next_renewal_date,
        annual_renewal_date,
        payment_method_id,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_tier,
        p_tier,
        'active',
        p_billing_interval,
        v_plan.discount_percent,
        v_plan.price_qar,
        v_plan.meals_per_month,
        0,
        v_next_renewal,
        v_annual_renewal,
        p_payment_method_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_subscription_id;

    -- Return success
    SELECT jsonb_build_object(
        'success', true,
        'subscription_id', v_subscription_id,
        'tier', p_tier,
        'billing_interval', p_billing_interval,
        'price', v_plan.price_qar,
        'meals_per_month', v_plan.meals_per_month,
        'discount_percent', v_plan.discount_percent,
        'next_renewal', v_next_renewal,
        'annual_renewal', v_annual_renewal
    ) INTO v_result;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_subscription TO authenticated;

-- Function to upgrade subscription (handles billing interval changes)
CREATE OR REPLACE FUNCTION upgrade_subscription(
    p_subscription_id UUID,
    p_new_tier VARCHAR(20),
    p_new_billing_interval VARCHAR(10) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_sub RECORD;
    v_new_plan RECORD;
    v_prorated_credit DECIMAL(10,2);
    v_new_price DECIMAL(10,2);
    v_result JSONB;
BEGIN
    -- Get current subscription
    SELECT * INTO v_current_sub
    FROM subscriptions
    WHERE id = p_subscription_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Subscription not found',
            'code', 'NOT_FOUND'
        );
    END IF;

    -- Use current billing interval if not specified
    IF p_new_billing_interval IS NULL THEN
        p_new_billing_interval := v_current_sub.billing_interval;
    END IF;

    -- Get new plan
    SELECT * INTO v_new_plan
    FROM subscription_plans
    WHERE tier = p_new_tier
    AND billing_interval = p_new_billing_interval
    AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Target plan not found',
            'code', 'PLAN_NOT_FOUND'
        );
    END IF;

    -- Calculate prorated credit (if downgrading or mid-cycle)
    v_prorated_credit := 0;
    IF v_current_sub.next_renewal_date > CURRENT_DATE THEN
        v_prorated_credit := v_current_sub.price * 
            (v_current_sub.next_renewal_date - CURRENT_DATE)::INTEGER / 30.0;
    END IF;

    -- Calculate new price (minus prorated credit)
    v_new_price := GREATEST(0, v_new_plan.price_qar - v_prorated_credit);

    -- Update subscription
    UPDATE subscriptions
    SET tier = p_new_tier,
        plan = p_new_tier,
        billing_interval = p_new_billing_interval,
        price = v_new_plan.price_qar,
        annual_discount_percent = v_new_plan.discount_percent,
        meals_per_month = v_new_plan.meals_per_month,
        prorated_credit = v_prorated_credit,
        updated_at = NOW()
    WHERE id = p_subscription_id;

    -- Return success
    SELECT jsonb_build_object(
        'success', true,
        'subscription_id', p_subscription_id,
        'previous_tier', v_current_sub.tier,
        'new_tier', p_new_tier,
        'previous_billing', v_current_sub.billing_interval,
        'new_billing', p_new_billing_interval,
        'prorated_credit', v_prorated_credit,
        'amount_due', v_new_price
    ) INTO v_result;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;

GRANT EXECUTE ON FUNCTION upgrade_subscription TO authenticated;

-- Function to handle annual renewal
CREATE OR REPLACE FUNCTION process_annual_renewal(
    p_subscription_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
    v_result JSONB;
BEGIN
    -- Get subscription
    SELECT * INTO v_subscription
    FROM subscriptions
    WHERE id = p_subscription_id
    AND billing_interval = 'annual'
    AND status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Annual subscription not found or not active',
            'code', 'NOT_FOUND'
        );
    END IF;

    -- Check if it's time for annual renewal
    IF v_subscription.annual_renewal_date IS NULL OR 
       v_subscription.annual_renewal_date > CURRENT_DATE THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Not time for annual renewal yet',
            'code', 'NOT_DUE',
            'annual_renewal_date', v_subscription.annual_renewal_date
        );
    END IF;

    -- Reset monthly usage
    UPDATE subscriptions
    SET meals_used_this_month = 0,
        annual_renewal_date = CURRENT_DATE + INTERVAL '1 year',
        next_renewal_date = CURRENT_DATE + INTERVAL '1 month',
        updated_at = NOW()
    WHERE id = p_subscription_id;

    -- Return success
    SELECT jsonb_build_object(
        'success', true,
        'subscription_id', p_subscription_id,
        'action', 'annual_renewal_processed',
        'next_annual_renewal', CURRENT_DATE + INTERVAL '1 year'
    ) INTO v_result;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'code', SQLSTATE
    );
END;
$$;

-- Update the subscription renewal function to handle annual billing
CREATE OR REPLACE FUNCTION process_subscription_renewal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription RECORD;
    v_result JSONB;
BEGIN
    -- Process monthly renewals
    FOR v_subscription IN 
        SELECT * FROM subscriptions 
        WHERE status = 'active'
        AND next_renewal_date <= CURRENT_DATE
        AND billing_interval = 'monthly'
    LOOP
        -- Reset monthly usage
        UPDATE subscriptions
        SET meals_used_this_month = 0,
            next_renewal_date = CURRENT_DATE + INTERVAL '1 month',
            updated_at = NOW()
        WHERE id = v_subscription.id;
    END LOOP;

    -- Process annual renewals
    FOR v_subscription IN 
        SELECT * FROM subscriptions 
        WHERE status = 'active'
        AND annual_renewal_date <= CURRENT_DATE
        AND billing_interval = 'annual'
    LOOP
        SELECT process_annual_renewal(v_subscription.id) INTO v_result;
        
        IF NOT (v_result->>'success')::BOOLEAN THEN
            -- Log error for manual review
            RAISE WARNING 'Annual renewal failed for subscription %: %', 
                v_subscription.id, v_result->>'error';
        END IF;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION process_subscription_renewal IS 
'Daily cron job to process subscription renewals. Handles both monthly and annual billing.';

-- Enable RLS on subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active subscription plans"
ON subscription_plans
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Only admins can modify subscription plans"
ON subscription_plans
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true));
