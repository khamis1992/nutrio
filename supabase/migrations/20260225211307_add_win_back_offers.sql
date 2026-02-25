-- Migration: Win-Back Offers and Cancellation Flow
-- Date: 2025-02-25
-- Description: Creates tables and functions for progressive retention offers during cancellation
-- Addresses: MW-002 (Win-Back Offers)

-- Create cancellation flow tracking table
CREATE TABLE IF NOT EXISTS cancellation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    step_reached INTEGER NOT NULL CHECK (step_reached BETWEEN 1 AND 4),
    -- Step 1: Survey, Step 2: Pause offer, Step 3: Discount offer, Step 4: Downgrade offer
    cancellation_reason VARCHAR(50),
    reason_details TEXT,
    offer_shown VARCHAR(50),
    offer_accepted BOOLEAN DEFAULT false,
    final_action VARCHAR(50) CHECK (final_action IN ('cancelled', 'paused', 'discounted', 'downgraded', 'retained')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    retained_until DATE
);

CREATE INDEX idx_cancellation_attempts_user ON cancellation_attempts(user_id);
CREATE INDEX idx_cancellation_attempts_subscription ON cancellation_attempts(subscription_id);
CREATE INDEX idx_cancellation_attempts_recent ON cancellation_attempts(created_at) WHERE resolved_at IS NULL;

-- Create win-back offers configuration table
CREATE TABLE IF NOT EXISTS win_back_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_code VARCHAR(50) UNIQUE NOT NULL,
    offer_type VARCHAR(20) NOT NULL CHECK (offer_type IN ('pause', 'discount', 'downgrade', 'bonus')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- For pause offers
    pause_duration_days INTEGER,
    -- For discount offers
    discount_percent INTEGER,
    discount_duration_months INTEGER,
    -- For downgrade offers
    target_tier VARCHAR(20),
    -- For bonus offers
    bonus_credits INTEGER,
    -- Conditions
    min_subscription_months INTEGER DEFAULT 0,
    max_previous_cancellations INTEGER DEFAULT 999,
    applicable_tiers VARCHAR(20)[] DEFAULT ARRAY['basic', 'standard', 'premium', 'vip'],
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default win-back offers
INSERT INTO win_back_offers (offer_code, offer_type, name, description, pause_duration_days, discount_percent, discount_duration_months, target_tier, bonus_credits, priority) VALUES
    ('PAUSE_14', 'pause', '14-Day Pause', 'Pause your subscription for 14 days without losing benefits', 14, NULL, NULL, NULL, NULL, 100),
    ('PAUSE_30', 'pause', '30-Day Pause', 'Pause for a full month - perfect for vacation', 30, NULL, NULL, NULL, NULL, 90),
    ('DISCOUNT_30_1M', 'discount', '30% Off Next Month', 'Get 30% off your next monthly bill', NULL, 30, 1, NULL, NULL, 80),
    ('DISCOUNT_50_1M', 'discount', '50% Off Next Month', 'Half price for the next month to keep you on track', NULL, 50, 1, NULL, NULL, 70),
    ('DOWNGRADE_BASIC', 'downgrade', 'Switch to Basic', 'Move to our Basic plan to reduce costs', NULL, NULL, NULL, 'basic', NULL, 60),
    ('BONUS_100_CREDITS', 'bonus', '100 Bonus Credits', 'Get 100 QAR in bonus credits added to your wallet', NULL, NULL, NULL, NULL, 100, 50)
ON CONFLICT (offer_code) DO NOTHING;

-- Create cancellation reasons enum
CREATE TYPE cancellation_reason AS ENUM (
    'too_expensive',
    'not_using_enough',
    'moving_away',
    'dietary_changes',
    'quality_issues',
    'delivery_issues',
    'found_alternative',
    'temporary_break',
    'other'
);

-- Add cancellation reason to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancellation_reason cancellation_reason;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancellation_details TEXT;

-- Function to determine appropriate win-back offer based on user history
CREATE OR REPLACE FUNCTION get_win_back_offers(
    p_user_id UUID,
    p_subscription_id UUID,
    p_step INTEGER
)
RETURNS TABLE (
    offer_id UUID,
    offer_code VARCHAR(50),
    offer_type VARCHAR(20),
    name VARCHAR(100),
    description TEXT,
    pause_duration_days INTEGER,
    discount_percent INTEGER,
    discount_duration_months INTEGER,
    target_tier VARCHAR(20),
    bonus_credits INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
    v_months_subscribed INTEGER;
    v_previous_cancellations INTEGER;
    v_current_tier VARCHAR(20);
BEGIN
    -- Get subscription details
    SELECT * INTO v_subscription
    FROM subscriptions
    WHERE id = p_subscription_id
    AND user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_current_tier := v_subscription.tier;
    v_months_subscribed := COALESCE(
        EXTRACT(MONTH FROM AGE(NOW(), v_subscription.created_at)),
        0
    )::INTEGER;

    -- Count previous cancellation attempts
    SELECT COUNT(*) INTO v_previous_cancellations
    FROM cancellation_attempts
    WHERE user_id = p_user_id
    AND final_action = 'cancelled';

    -- Return appropriate offers based on step and eligibility
    RETURN QUERY
    SELECT 
        wbo.id,
        wbo.offer_code,
        wbo.offer_type,
        wbo.name,
        wbo.description,
        wbo.pause_duration_days,
        wbo.discount_percent,
        wbo.discount_duration_months,
        wbo.target_tier,
        wbo.bonus_credits
    FROM win_back_offers wbo
    WHERE wbo.is_active = true
    AND v_current_tier = ANY(wbo.applicable_tiers)
    AND v_months_subscribed >= wbo.min_subscription_months
    AND v_previous_cancellations <= wbo.max_previous_cancellations
    AND (
        -- Step 2: Pause offers
        (p_step = 2 AND wbo.offer_type = 'pause') OR
        -- Step 3: Discount offers (only if pause declined or not applicable)
        (p_step = 3 AND wbo.offer_type = 'discount') OR
        -- Step 4: Downgrade offers
        (p_step = 4 AND wbo.offer_type = 'downgrade') OR
        -- Bonus offers can appear at any step
        (wbo.offer_type = 'bonus')
    )
    ORDER BY wbo.priority ASC, wbo.created_at DESC
    LIMIT 3;
END;
$$;

GRANT EXECUTE ON FUNCTION get_win_back_offers TO authenticated;

-- Function to process cancellation with win-back flow
CREATE OR REPLACE FUNCTION process_cancellation(
    p_subscription_id UUID,
    p_step INTEGER,
    p_reason cancellation_reason DEFAULT NULL,
    p_reason_details TEXT DEFAULT NULL,
    p_offer_code VARCHAR(50) DEFAULT NULL,
    p_accept_offer BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
    v_offer RECORD;
    v_attempt_id UUID;
    v_result JSONB;
    v_new_renewal_date DATE;
BEGIN
    -- Get subscription with lock
    SELECT * INTO v_subscription
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

    -- Record the cancellation attempt
    INSERT INTO cancellation_attempts (
        user_id,
        subscription_id,
        step_reached,
        cancellation_reason,
        reason_details,
        offer_shown,
        offer_accepted
    ) VALUES (
        v_subscription.user_id,
        p_subscription_id,
        p_step,
        p_reason,
        p_reason_details,
        p_offer_code,
        p_accept_offer
    )
    RETURNING id INTO v_attempt_id;

    -- If user accepted an offer, process it
    IF p_accept_offer AND p_offer_code IS NOT NULL THEN
        SELECT * INTO v_offer
        FROM win_back_offers
        WHERE offer_code = p_offer_code
        AND is_active = true;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Offer not found or inactive',
                'code', 'OFFER_INVALID'
            );
        END IF;

        -- Process based on offer type
        CASE v_offer.offer_type
            WHEN 'pause' THEN
                -- Calculate new renewal date
                v_new_renewal_date := v_subscription.next_renewal_date + v_offer.pause_duration_days;
                
                UPDATE subscriptions
                SET status = 'paused',
                    paused_at = NOW(),
                    next_renewal_date = v_new_renewal_date,
                    cancellation_reason = p_reason,
                    cancellation_details = p_reason_details,
                    updated_at = NOW()
                WHERE id = p_subscription_id;

                UPDATE cancellation_attempts
                SET final_action = 'paused',
                    resolved_at = NOW()
                WHERE id = v_attempt_id;

                RETURN jsonb_build_object(
                    'success', true,
                    'action', 'paused',
                    'message', 'Your subscription has been paused for ' || v_offer.pause_duration_days || ' days',
                    'resumes_on', v_new_renewal_date
                );

            WHEN 'discount' THEN
                -- Apply discount (this would integrate with billing system)
                UPDATE subscriptions
                SET current_discount_percent = v_offer.discount_percent,
                    discount_expires_at = CURRENT_DATE + (v_offer.discount_duration_months || ' months')::INTERVAL,
                    cancellation_reason = p_reason,
                    cancellation_details = p_reason_details,
                    updated_at = NOW()
                WHERE id = p_subscription_id;

                UPDATE cancellation_attempts
                SET final_action = 'discounted',
                    resolved_at = NOW(),
                    retained_until = CURRENT_DATE + (v_offer.discount_duration_months || ' months')::INTERVAL
                WHERE id = v_attempt_id;

                RETURN jsonb_build_object(
                    'success', true,
                    'action', 'discounted',
                    'message', v_offer.discount_percent || '% discount applied for ' || v_offer.discount_duration_months || ' month(s)',
                    'discount_percent', v_offer.discount_percent
                );

            WHEN 'downgrade' THEN
                -- Process downgrade
                PERFORM upgrade_subscription(p_subscription_id, v_offer.target_tier);

                UPDATE cancellation_attempts
                SET final_action = 'downgraded',
                    resolved_at = NOW()
                WHERE id = v_attempt_id;

                RETURN jsonb_build_object(
                    'success', true,
                    'action', 'downgraded',
                    'message', 'Subscription downgraded to ' || v_offer.target_tier,
                    'new_tier', v_offer.target_tier
                );

            WHEN 'bonus' THEN
                -- Add bonus credits to wallet
                PERFORM credit_wallet(
                    v_subscription.user_id,
                    v_offer.bonus_credits,
                    'Win-back bonus: ' || v_offer.name,
                    v_attempt_id::TEXT
                );

                UPDATE cancellation_attempts
                SET final_action = 'retained',
                    resolved_at = NOW()
                WHERE id = v_attempt_id;

                RETURN jsonb_build_object(
                    'success', true,
                    'action', 'retained',
                    'message', v_offer.bonus_credits || ' QAR bonus credits added to your wallet',
                    'bonus_credits', v_offer.bonus_credits
                );
        END CASE;
    END IF;

    -- If this is the final step and no offer accepted, actually cancel
    IF p_step >= 4 AND NOT p_accept_offer THEN
        UPDATE subscriptions
        SET status = 'cancelled',
            cancelled_at = NOW(),
            cancellation_reason = p_reason,
            cancellation_details = p_reason_details,
            updated_at = NOW()
        WHERE id = p_subscription_id;

        UPDATE cancellation_attempts
        SET final_action = 'cancelled',
            resolved_at = NOW()
        WHERE id = v_attempt_id;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'cancelled',
            'message', 'Your subscription has been cancelled. You will have access until ' || v_subscription.next_renewal_date
        );
    END IF;

    -- Return next step info
    RETURN jsonb_build_object(
        'success', true,
        'action', 'continue',
        'current_step', p_step,
        'next_step', p_step + 1,
        'offers', (
            SELECT jsonb_agg(row_to_json(o))
            FROM get_win_back_offers(v_subscription.user_id, p_subscription_id, p_step + 1) o
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION process_cancellation TO authenticated;

-- Function to resume paused subscription
CREATE OR REPLACE FUNCTION resume_subscription(
    p_subscription_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_subscription RECORD;
BEGIN
    SELECT * INTO v_subscription
    FROM subscriptions
    WHERE id = p_subscription_id
    AND status = 'paused'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Paused subscription not found',
            'code', 'NOT_FOUND'
        );
    END IF;

    UPDATE subscriptions
    SET status = 'active',
        resumed_at = NOW(),
        next_renewal_date = CASE 
            WHEN next_renewal_date < CURRENT_DATE THEN CURRENT_DATE + INTERVAL '1 month'
            ELSE next_renewal_date
        END,
        updated_at = NOW()
    WHERE id = p_subscription_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Subscription resumed successfully',
        'next_renewal', v_subscription.next_renewal_date
    );
END;
$$;

GRANT EXECUTE ON FUNCTION resume_subscription TO authenticated;

-- Add columns for tracking discount periods
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS current_discount_percent INTEGER DEFAULT 0;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS discount_expires_at DATE;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMPTZ;

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE cancellation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE win_back_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cancellation attempts"
ON cancellation_attempts
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all cancellation attempts"
ON cancellation_attempts
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true));

CREATE POLICY "Anyone can view active win-back offers"
ON win_back_offers
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Only admins can modify win-back offers"
ON win_back_offers
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true))
WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND is_admin = true));
