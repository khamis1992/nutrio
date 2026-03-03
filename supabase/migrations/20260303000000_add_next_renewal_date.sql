-- Migration: Add missing next_renewal_date column to subscriptions
-- Date: 2026-03-03
-- Fix: upgrade_subscription function failed with "record has no field next_renewal_date"
--      because the column was referenced but never added to the table.

-- 1. Add the column (safe if it already exists)
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS next_renewal_date DATE;

-- 2. Populate from end_date for existing rows
UPDATE subscriptions
SET next_renewal_date = end_date
WHERE next_renewal_date IS NULL AND end_date IS NOT NULL;

-- 3. For rows where end_date is also null, default to 1 month from start_date
UPDATE subscriptions
SET next_renewal_date = start_date + INTERVAL '1 month'
WHERE next_renewal_date IS NULL AND start_date IS NOT NULL;

-- 4. Re-create upgrade_subscription with safe COALESCE fallback
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
    v_renewal_date DATE;
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
        p_new_billing_interval := COALESCE(v_current_sub.billing_interval, 'monthly');
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

    -- Calculate prorated credit using next_renewal_date, falling back to end_date
    v_prorated_credit := 0;
    v_renewal_date := COALESCE(v_current_sub.next_renewal_date, v_current_sub.end_date);
    IF v_renewal_date IS NOT NULL AND v_renewal_date > CURRENT_DATE THEN
        v_prorated_credit := COALESCE(v_current_sub.price, 0) *
            (v_renewal_date - CURRENT_DATE)::INTEGER / 30.0;
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
        prorated_credit = v_prorated_credit
    WHERE id = p_subscription_id;

    -- Return success
    RETURN jsonb_build_object(
        'success', true,
        'prorated_credit', v_prorated_credit,
        'amount_due', v_new_price,
        'new_tier', p_new_tier,
        'new_billing_interval', p_new_billing_interval
    );
END;
$$;

GRANT EXECUTE ON FUNCTION upgrade_subscription TO authenticated;
