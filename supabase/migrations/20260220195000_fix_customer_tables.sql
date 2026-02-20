-- Migration to fix missing tables and columns for customer app
-- Created: 2026-02-20

-- ============================================
-- 1. FIX SUBSCRIPTIONS TABLE
-- ============================================

-- Add missing columns to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS plan TEXT,
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'standard' CHECK (tier IN ('standard', 'vip')),
ADD COLUMN IF NOT EXISTS meals_used_this_week INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS week_start_date DATE;

-- Migrate existing data (only if source columns exist)
DO $$
BEGIN
  -- Check if plan_name column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'plan_name'
  ) THEN
    EXECUTE 'UPDATE public.subscriptions SET plan = plan_name WHERE plan IS NULL';
  END IF;
  
  -- Check if started_at column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'started_at'
  ) THEN
    EXECUTE 'UPDATE public.subscriptions SET start_date = started_at::date WHERE start_date IS NULL';
  END IF;
  
  -- Check if expires_at column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'expires_at'
  ) THEN
    EXECUTE 'UPDATE public.subscriptions SET end_date = expires_at::date WHERE end_date IS NULL';
  END IF;
END $$;

-- ============================================
-- 2. CREATE USER_FAVORITE_RESTAURANTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_favorite_restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_favorite_restaurants ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own favorites" ON public.user_favorite_restaurants;
DROP POLICY IF EXISTS "Users can add their own favorites" ON public.user_favorite_restaurants;
DROP POLICY IF EXISTS "Users can remove their own favorites" ON public.user_favorite_restaurants;

CREATE POLICY "Users can view their own favorites" 
ON public.user_favorite_restaurants 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites" 
ON public.user_favorite_restaurants 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites" 
ON public.user_favorite_restaurants 
FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================
-- 3. CREATE PROGRESS_LOGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.progress_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) CHECK (weight_kg > 0 AND weight_kg < 500),
  calories_consumed INTEGER DEFAULT 0,
  protein_consumed_g INTEGER DEFAULT 0,
  carbs_consumed_g INTEGER DEFAULT 0,
  fat_consumed_g INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

-- Enable Row Level Security
ALTER TABLE public.progress_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own progress" ON public.progress_logs;
DROP POLICY IF EXISTS "Users can manage their own progress" ON public.progress_logs;

CREATE POLICY "Users can view their own progress" 
ON public.progress_logs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own progress" 
ON public.progress_logs 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_progress_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_progress_logs_updated_at ON public.progress_logs;
CREATE TRIGGER update_progress_logs_updated_at
  BEFORE UPDATE ON public.progress_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_progress_logs_updated_at();

-- ============================================
-- 4. FIX RESTAURANTS MEALS RELATIONSHIP
-- ============================================

-- Ensure proper foreign key relationship exists
-- The issue is likely that the relationship isn't being recognized by PostgREST
-- Let's make sure meals table has proper restaurant_id reference

-- Check if meals table has restaurant_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meals' AND column_name = 'restaurant_id'
  ) THEN
    ALTER TABLE public.meals ADD COLUMN restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_favorite_restaurants_user_id ON public.user_favorite_restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_restaurants_restaurant_id ON public.user_favorite_restaurants(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_progress_logs_user_date ON public.progress_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
