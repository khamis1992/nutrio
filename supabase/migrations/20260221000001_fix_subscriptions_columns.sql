-- Emergency Fix: Add Missing Columns to Subscriptions Table
-- Fixes: column subscriptions.status does not exist
-- Created: 2026-02-21

-- First, ensure the enum types exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'pending');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
    CREATE TYPE public.subscription_plan AS ENUM ('weekly', 'monthly');
  END IF;
END $$;

-- Add missing columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS status public.subscription_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS plan public.subscription_plan,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS meals_per_week INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS meals_used_this_week INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS week_start_date DATE,
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' CHECK (tier IN ('standard', 'vip'));

-- If there's an existing plan_name column, migrate it to plan
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'plan_name'
  ) THEN
    -- Update plan from plan_name
    UPDATE public.subscriptions 
    SET plan = CASE 
      WHEN plan_name ILIKE '%weekly%' THEN 'weekly'::public.subscription_plan
      WHEN plan_name ILIKE '%monthly%' THEN 'monthly'::public.subscription_plan
      ELSE 'weekly'::public.subscription_plan
    END
    WHERE plan IS NULL;
  END IF;
END $$;

-- If there's an existing status column with different type, update it
DO $$
BEGIN
  -- Check if status column exists but with wrong type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'status'
  ) THEN
    -- Try to update existing values
    UPDATE public.subscriptions 
    SET status = 'active'::public.subscription_status
    WHERE status IS NULL;
  END IF;
END $$;

-- Migrate existing dates if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'started_at'
  ) THEN
    UPDATE public.subscriptions 
    SET start_date = started_at::date
    WHERE start_date IS NULL AND started_at IS NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'expires_at'
  ) THEN
    UPDATE public.subscriptions 
    SET end_date = expires_at::date
    WHERE end_date IS NULL AND expires_at IS NOT NULL;
  END IF;
END $$;

-- Fix restaurants/meals relationship issue
-- Ensure meals table has restaurant_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meals' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE public.meals ADD COLUMN restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_meals_restaurant_id ON public.meals(restaurant_id);
