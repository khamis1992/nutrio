-- Migration: Convert subscription tracking from weekly to monthly
-- Created: 2026-02-23
-- Purpose: Track meals on a monthly basis instead of weekly

-- Add monthly tracking columns
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS meals_per_month INTEGER,
ADD COLUMN IF NOT EXISTS meals_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS month_start_date DATE;

-- Migrate existing data: convert weekly to monthly (×4.3 weeks)
UPDATE public.subscriptions
SET 
    meals_per_month = COALESCE(
        meals_per_month,
        CASE 
            WHEN meals_per_week = 0 THEN 0  -- Unlimited/VIP
            ELSE ROUND(meals_per_week * 4.3)
        END
    ),
    meals_used_this_month = COALESCE(
        meals_used_this_month,
        ROUND(meals_used_this_week * 4.3)
    ),
    month_start_date = COALESCE(
        month_start_date,
        DATE_TRUNC('month', CURRENT_DATE)
    )
WHERE meals_per_month IS NULL;

-- Function to increment monthly meal usage
CREATE OR REPLACE FUNCTION public.increment_monthly_meal_usage(
    p_subscription_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_subscription RECORD;
    v_current_month DATE;
BEGIN
    v_current_month := DATE_TRUNC('month', CURRENT_DATE);
    
    -- Get subscription details
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE id = p_subscription_id;
    
    IF v_subscription.id IS NULL THEN
        RAISE EXCEPTION 'Subscription not found';
    END IF;
    
    -- Check if we need to reset for new month
    IF v_subscription.month_start_date IS NULL OR v_subscription.month_start_date < v_current_month THEN
        -- Reset for new month
        UPDATE public.subscriptions
        SET 
            meals_used_this_month = 1,
            month_start_date = v_current_month,
            meals_used_this_week = 1,  -- Keep weekly in sync
            week_start_date = DATE_TRUNC('week', CURRENT_DATE)
        WHERE id = p_subscription_id;
    ELSE
        -- Increment existing month
        UPDATE public.subscriptions
        SET 
            meals_used_this_month = COALESCE(meals_used_this_month, 0) + 1,
            meals_used_this_week = COALESCE(meals_used_this_week, 0) + 1  -- Keep weekly in sync
        WHERE id = p_subscription_id;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and reset monthly quota if needed
CREATE OR REPLACE FUNCTION public.check_and_reset_monthly_quota()
RETURNS TRIGGER AS $$
DECLARE
    v_current_month DATE;
BEGIN
    v_current_month := DATE_TRUNC('month', CURRENT_DATE);
    
    -- If month_start_date is from a previous month, reset the counter
    IF NEW.month_start_date IS NULL OR NEW.month_start_date < v_current_month THEN
        NEW.meals_used_this_month := 0;
        NEW.month_start_date := v_current_month;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-reset monthly quota
DROP TRIGGER IF EXISTS tr_check_monthly_quota ON public.subscriptions;
CREATE TRIGGER tr_check_monthly_quota
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_and_reset_monthly_quota();

-- Update existing subscriptions to set proper monthly values based on plans
-- Standard plan: 10 meals/week = 43 meals/month
UPDATE public.subscriptions
SET meals_per_month = 43
WHERE plan = 'Standard' AND meals_per_month IS NULL;

-- Premium plan: Let's assume 15 meals/week = 65 meals/month
UPDATE public.subscriptions
SET meals_per_month = 65
WHERE plan = 'Premium' AND meals_per_month IS NULL;

-- Basic plan: Let's assume 5 meals/week = 22 meals/month
UPDATE public.subscriptions
SET meals_per_month = 22
WHERE plan = 'Basic' AND meals_per_month IS NULL;

-- VIP/Unlimited: Set to 0 (unlimited)
UPDATE public.subscriptions
SET meals_per_month = 0
WHERE tier = 'vip' OR meals_per_week = 0;

-- Set default month_start_date for all subscriptions
UPDATE public.subscriptions
SET month_start_date = DATE_TRUNC('month', CURRENT_DATE)
WHERE month_start_date IS NULL;

-- Comments
COMMENT ON COLUMN public.subscriptions.meals_per_month IS 'Number of meals allowed per month';
COMMENT ON COLUMN public.subscriptions.meals_used_this_month IS 'Number of meals used in current month';
COMMENT ON COLUMN public.subscriptions.month_start_date IS 'Start date of current month tracking period';
COMMENT ON FUNCTION public.increment_monthly_meal_usage(UUID) IS 'Increments the monthly meal usage counter for a subscription';
