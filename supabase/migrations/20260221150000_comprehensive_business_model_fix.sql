-- ============================================================================
-- COMPREHENSIVE BUSINESS MODEL FIX MIGRATION
-- Fixes all critical issues identified in system validation audit
-- Created: 2026-02-21
-- ============================================================================

-- ============================================================================
-- 1. FIX SUBSCRIPTION TIER STRUCTURE
-- Change from 'standard'/'vip' to 'basic'/'standard'/'premium'/'vip'
-- ============================================================================

-- First, update existing data to new tier values
UPDATE public.subscriptions 
SET tier = CASE 
  WHEN tier = 'vip' THEN 'vip'
  WHEN meals_per_week = 5 THEN 'basic'
  WHEN meals_per_week = 10 THEN 'standard'
  WHEN meals_per_week = 15 THEN 'premium'
  WHEN meals_per_week = 0 THEN 'vip'
  ELSE 'basic'
END;

-- Drop old constraint and add new one
ALTER TABLE public.subscriptions 
DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_tier_check 
CHECK (tier IN ('basic', 'standard', 'premium', 'vip'));

-- Set default meals_per_week based on tier
UPDATE public.subscriptions 
SET meals_per_week = CASE tier
  WHEN 'basic' THEN 5
  WHEN 'standard' THEN 10
  WHEN 'premium' THEN 15
  WHEN 'vip' THEN 0  -- 0 means unlimited
END
WHERE meals_per_week IS NULL OR meals_per_week = 0 AND tier != 'vip';

-- ============================================================================
-- 2. ADD RESTAURANT PAYOUT RATE
-- Critical: Admin sets fixed per-meal payout rate per restaurant
-- ============================================================================

ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS payout_rate NUMERIC(10,2) NOT NULL DEFAULT 25.00,
ADD COLUMN IF NOT EXISTS payout_rate_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payout_rate_set_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bank_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS operating_hours JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS cuisine_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS avg_prep_time_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_meals_per_day INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- Add comment explaining payout_rate
COMMENT ON COLUMN public.restaurants.payout_rate IS 'Fixed QAR amount paid to restaurant per meal prepared (set by admin)';

-- Create index for payout calculations
CREATE INDEX IF NOT EXISTS idx_restaurants_payout_rate ON public.restaurants(payout_rate) 
WHERE approval_status = 'approved';

-- ============================================================================
-- 3. CREATE RESTAURANT DETAILS TABLE
-- Extended restaurant information for onboarding
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.restaurant_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
  
  -- Step 1: Restaurant Info
  cuisine_type TEXT[],
  dietary_tags TEXT[],
  
  -- Step 2: Contact & Operating Hours
  alternate_phone TEXT,
  website_url TEXT,
  operating_hours JSONB DEFAULT '{
    "monday": {"open": "09:00", "close": "22:00", "is_open": true},
    "tuesday": {"open": "09:00", "close": "22:00", "is_open": true},
    "wednesday": {"open": "09:00", "close": "22:00", "is_open": true},
    "thursday": {"open": "09:00", "close": "22:00", "is_open": true},
    "friday": {"open": "09:00", "close": "22:00", "is_open": true},
    "saturday": {"open": "09:00", "close": "22:00", "is_open": true},
    "sunday": {"open": "09:00", "close": "22:00", "is_open": true}
  }'::jsonb,
  
  -- Step 4: Operations & Banking
  avg_prep_time_minutes INTEGER DEFAULT 30 CHECK (avg_prep_time_minutes > 0),
  max_meals_per_day INTEGER DEFAULT 50 CHECK (max_meals_per_day > 0),
  
  -- Banking Information (encrypted/hashed in production)
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  bank_iban TEXT,
  swift_code TEXT,
  
  -- Onboarding tracking
  onboarding_step INTEGER DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 5),
  onboarding_completed BOOLEAN DEFAULT false,
  terms_accepted BOOLEAN DEFAULT false,
  terms_accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.restaurant_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Partners can view and manage their restaurant details"
  ON public.restaurant_details FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = restaurant_id AND r.owner_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all restaurant details"
  ON public.restaurant_details FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 4. FIX PARTNER EARNINGS CALCULATION
-- Use fixed payout_rate instead of meal price
-- ============================================================================

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_meal_schedule_confirmed ON public.meal_schedules;
DROP FUNCTION IF EXISTS public.create_partner_earning();

-- Create fixed partner earning function
CREATE OR REPLACE FUNCTION public.create_partner_earning()
RETURNS TRIGGER AS $$
DECLARE
  v_payout_rate NUMERIC(10, 2);
  v_restaurant_id UUID;
  v_delivery_fee NUMERIC(10, 2) := 0;
  v_net_amount NUMERIC(10, 2);
BEGIN
  -- Only process for confirmed/delivered orders
  IF NEW.order_status IN ('confirmed', 'preparing', 'delivered') THEN
    -- Get restaurant payout rate (NOT meal price)
    SELECT r.id, r.payout_rate 
    INTO v_restaurant_id, v_payout_rate
    FROM public.meals m
    JOIN public.restaurants r ON m.restaurant_id = r.id
    WHERE m.id = NEW.meal_id;
    
    IF v_restaurant_id IS NOT NULL AND v_payout_rate > 0 THEN
      -- Net amount is the fixed payout rate (no platform fee deduction)
      -- Platform margin is calculated separately: Subscription Revenue - Payouts
      v_net_amount := v_payout_rate;
      
      INSERT INTO public.partner_earnings (
        restaurant_id,
        meal_schedule_id,
        gross_amount,
        platform_fee,
        delivery_fee,
        net_amount
      ) VALUES (
        v_restaurant_id,
        NEW.id,
        v_payout_rate,  -- Gross = payout rate
        0,              -- No platform fee deducted from partner (margin tracked separately)
        v_delivery_fee,
        v_net_amount
      )
      ON CONFLICT DO NOTHING; -- Prevent duplicate earnings
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_meal_schedule_confirmed
  AFTER UPDATE OF order_status ON public.meal_schedules
  FOR EACH ROW
  WHEN (NEW.order_status = 'confirmed' AND OLD.order_status != 'confirmed')
  EXECUTE FUNCTION public.create_partner_earning();

-- ============================================================================
-- 5. FIX MEAL PRICE - MAKE OPTIONAL
-- Meals should not require pricing (subscription model)
-- ============================================================================

-- Make price nullable (will be NULL for subscription meals)
ALTER TABLE public.meals 
ALTER COLUMN price DROP NOT NULL;

-- Add comment explaining the field is deprecated
COMMENT ON COLUMN public.meals.price IS 'DEPRECATED: Meals are included in subscription. Field kept for legacy data.';

-- Add estimated_cost for internal cost tracking (not shown to customers)
ALTER TABLE public.meals 
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2);

COMMENT ON COLUMN public.meals.estimated_cost IS 'Internal cost estimate for margin calculations (not customer price)';

-- ============================================================================
-- 6. FIX RACE CONDITION IN MEAL QUOTA
-- Atomic increment with built-in check
-- ============================================================================

DROP FUNCTION IF EXISTS public.increment_meal_usage(uuid);

CREATE OR REPLACE FUNCTION public.increment_meal_usage(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  -- Atomic update: Only increment if quota allows
  -- meals_per_week = 0 means unlimited
  WITH updated AS (
    UPDATE public.subscriptions
    SET meals_used_this_week = meals_used_this_week + 1
    WHERE id = p_subscription_id 
      AND status = 'active'
      AND (meals_per_week = 0 OR meals_used_this_week < meals_per_week)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_updated_rows FROM updated;
  
  RETURN v_updated_rows > 0;
END;
$$;

-- ============================================================================
-- 7. CREATE WEEKLY RESET AUTOMATION
-- Automated cron job for resetting meal quotas
-- ============================================================================

-- Function to reset quotas (improved version)
CREATE OR REPLACE FUNCTION public.reset_weekly_meal_quotas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  UPDATE public.subscriptions
  SET 
    meals_used_this_week = 0,
    week_start_date = CURRENT_DATE
  WHERE status = 'active'
    AND (
      week_start_date IS NULL 
      OR week_start_date < CURRENT_DATE - INTERVAL '6 days'
    );
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  
  -- Log the reset
  INSERT INTO public.platform_logs (level, category, message, metadata)
  VALUES (
    'info',
    'subscription',
    format('Weekly meal quotas reset for %s subscriptions', v_reset_count),
    jsonb_build_object('reset_count', v_reset_count, 'reset_date', CURRENT_DATE)
  );
  
  RETURN v_reset_count;
END;
$$;

-- Note: Cron job must be created via Supabase dashboard or API
-- Schedule: 0 0 * * 0 (Every Sunday at midnight)
-- Command: SELECT reset_weekly_meal_quotas();

-- ============================================================================
-- 8. CREATE PLATFORM LOGS TABLE
-- For tracking automated processes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_logs_created_at ON public.platform_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_logs_category ON public.platform_logs(category);
CREATE INDEX IF NOT EXISTS idx_platform_logs_level ON public.platform_logs(level);

ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view platform logs"
  ON public.platform_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 9. ADD MARGIN TRACKING
-- Track platform profitability
-- ============================================================================

-- Add margin tracking to payouts table
ALTER TABLE public.payouts 
ADD COLUMN IF NOT EXISTS subscription_revenue NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS delivery_costs NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_margin NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC(5,2);

-- Create daily margin reports table
CREATE TABLE IF NOT EXISTS public.daily_margin_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  
  -- Revenue
  new_subscriptions_revenue NUMERIC(10,2) DEFAULT 0,
  recurring_subscriptions_revenue NUMERIC(10,2) DEFAULT 0,
  total_subscription_revenue NUMERIC(10,2) DEFAULT 0,
  
  -- Costs
  total_restaurant_payouts NUMERIC(10,2) DEFAULT 0,
  total_delivery_costs NUMERIC(10,2) DEFAULT 0,
  total_operational_costs NUMERIC(10,2) DEFAULT 0,
  
  -- Margin
  gross_margin NUMERIC(10,2) DEFAULT 0,
  gross_margin_percentage NUMERIC(5,2) DEFAULT 0,
  
  -- Metrics
  total_meals_served INTEGER DEFAULT 0,
  active_subscriptions INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_margin_reports_date ON public.daily_margin_reports(report_date);

ALTER TABLE public.daily_margin_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view margin reports"
  ON public.daily_margin_reports FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to calculate daily margin
CREATE OR REPLACE FUNCTION public.calculate_daily_margin(p_date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report_id UUID;
  v_subscription_revenue NUMERIC(10,2);
  v_total_payouts NUMERIC(10,2);
  v_total_meals INTEGER;
  v_active_subs INTEGER;
  v_gross_margin NUMERIC(10,2);
  v_margin_pct NUMERIC(5,2);
BEGIN
  -- Calculate subscription revenue for the date
  SELECT COALESCE(SUM(price), 0)
  INTO v_subscription_revenue
  FROM public.subscriptions
  WHERE DATE(start_date) = p_date
    AND status = 'active';
  
  -- Calculate total payouts for meals served on this date
  SELECT COALESCE(SUM(net_amount), 0), COUNT(*)
  INTO v_total_payouts, v_total_meals
  FROM public.partner_earnings
  WHERE DATE(created_at) = p_date
    AND status = 'paid';
  
  -- Count active subscriptions
  SELECT COUNT(*)
  INTO v_active_subs
  FROM public.subscriptions
  WHERE status = 'active'
    AND start_date <= p_date
    AND (end_date IS NULL OR end_date >= p_date);
  
  -- Calculate margin
  v_gross_margin := v_subscription_revenue - v_total_payouts;
  v_margin_pct := CASE 
    WHEN v_subscription_revenue > 0 
    THEN ROUND((v_gross_margin / v_subscription_revenue) * 100, 2)
    ELSE 0 
  END;
  
  -- Insert or update report
  INSERT INTO public.daily_margin_reports (
    report_date,
    new_subscriptions_revenue,
    total_subscription_revenue,
    total_restaurant_payouts,
    gross_margin,
    gross_margin_percentage,
    total_meals_served,
    active_subscriptions
  ) VALUES (
    p_date,
    v_subscription_revenue,
    v_subscription_revenue,
    v_total_payouts,
    v_gross_margin,
    v_margin_pct,
    v_total_meals,
    v_active_subs
  )
  ON CONFLICT (report_date) DO UPDATE SET
    new_subscriptions_revenue = EXCLUDED.new_subscriptions_revenue,
    total_subscription_revenue = EXCLUDED.total_subscription_revenue,
    total_restaurant_payouts = EXCLUDED.total_restaurant_payouts,
    gross_margin = EXCLUDED.gross_margin,
    gross_margin_percentage = EXCLUDED.gross_margin_percentage,
    total_meals_served = EXCLUDED.total_meals_served,
    active_subscriptions = EXCLUDED.active_subscriptions,
    updated_at = now()
  RETURNING id INTO v_report_id;
  
  RETURN v_report_id;
END;
$$;

-- ============================================================================
-- 10. CLEAN UP ORDERS TABLE
-- Remove per-meal pricing fields from subscription-based orders
-- ============================================================================

-- The orders table is currently dual-purpose. For the subscription model,
-- we primarily use meal_schedules. Let's ensure orders table is for legacy/compliance.

-- Add order type to distinguish
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_type TEXT DEFAULT 'subscription' 
CHECK (order_type IN ('subscription', 'legacy', 'manual'));

-- Make financial fields nullable (not used in subscription model)
ALTER TABLE public.orders 
ALTER COLUMN total_amount DROP NOT NULL,
ALTER COLUMN delivery_fee DROP NOT NULL;

-- ============================================================================
-- 11. UPDATE PLATFORM SETTINGS
-- Add subscription tier configuration
-- ============================================================================

-- Insert/update platform settings for tier configuration
INSERT INTO public.platform_settings (key, value, description) VALUES
('subscription_tiers', '{
  "basic": {"meals_per_week": 5, "weekly_price": 49.99, "monthly_price": 199.99},
  "standard": {"meals_per_week": 10, "weekly_price": 89.99, "monthly_price": 359.99},
  "premium": {"meals_per_week": 15, "weekly_price": 129.99, "monthly_price": 519.99},
  "vip": {"meals_per_week": 0, "weekly_price": 199.99, "monthly_price": 799.99, "unlimited": true}
}'::text, 'Subscription tier configuration (meals per week and pricing)')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

INSERT INTO public.platform_settings (key, value, description) VALUES
('default_restaurant_payout_rate', '82', 'Default payout percentage for new restaurants (Nutrio keeps 18%)')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  updated_at = now();

-- ============================================================================
-- 12. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_week_start ON public.subscriptions(week_start_date) 
WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_restaurants_approval_status ON public.restaurants(approval_status);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_order_status ON public.meal_schedules(order_status);
CREATE INDEX IF NOT EXISTS idx_partner_earnings_created_at ON public.partner_earnings(created_at);
CREATE INDEX IF NOT EXISTS idx_partner_earnings_status ON public.partner_earnings(status);

-- ============================================================================
-- 13. BACKFILL EXISTING DATA
-- ============================================================================

-- Set payout_rate for existing approved restaurants (if not set)
UPDATE public.restaurants 
SET 
  payout_rate = 25.00,
  payout_rate_set_at = COALESCE(approved_at, now()),
  payout_rate_set_by = COALESCE(approved_by, (
    SELECT user_id FROM public.user_roles 
    WHERE role = 'admin' 
    LIMIT 1
  ))
WHERE approval_status = 'approved' 
  AND payout_rate IS NULL;

-- Create restaurant_details for existing restaurants
INSERT INTO public.restaurant_details (restaurant_id)
SELECT id FROM public.restaurants r
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurant_details d WHERE d.restaurant_id = r.id
);

-- Recalculate partner earnings based on new payout_rate
-- (This is a one-time fix for existing data)
UPDATE public.partner_earnings pe
SET 
  gross_amount = r.payout_rate,
  net_amount = r.payout_rate,
  platform_fee = 0
FROM public.restaurants r
JOIN public.meals m ON m.restaurant_id = r.id
JOIN public.meal_schedules ms ON ms.meal_id = m.id
WHERE pe.meal_schedule_id = ms.id
  AND pe.gross_amount != r.payout_rate;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
