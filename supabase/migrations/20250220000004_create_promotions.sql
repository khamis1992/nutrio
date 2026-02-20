-- Migration: Create promotions and promotion_usage tables
-- Created: 2025-02-20
-- Purpose: Create tables for managing promotional codes and coupons

-- =====================
-- PROMOTIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_discount_amount NUMERIC(10,2) CHECK (max_discount_amount >= 0),
  max_uses INTEGER CHECK (max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  max_uses_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_uses_per_user > 0),
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- =====================
-- PROMOTION USAGE TABLE
-- =====================
CREATE TABLE IF NOT EXISTS public.promotion_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID REFERENCES public.promotions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_applied NUMERIC(10,2) NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_usage ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES
-- =====================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can manage promotions" ON public.promotions;
DROP POLICY IF EXISTS "Users can view their own promotion usage" ON public.promotion_usage;
DROP POLICY IF EXISTS "Anyone can view promotion usage" ON public.promotion_usage;

-- Promotions policies
CREATE POLICY "Anyone can view promotions" ON public.promotions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage promotions" ON public.promotions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Promotion Usage policies
CREATE POLICY "Anyone can view promotion usage" ON public.promotion_usage
  FOR SELECT USING (true);

CREATE POLICY "Users can view their own promotion usage" ON public.promotion_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all promotion usage" ON public.promotion_usage
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- FUNCTION: Update uses_count when promotion is used
-- =====================
CREATE OR REPLACE FUNCTION public.increment_promotion_uses()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.promotions
  SET uses_count = uses_count + 1
  WHERE id = NEW.promotion_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-increment uses_count
DROP TRIGGER IF EXISTS increment_promotion_uses_trigger ON public.promotion_usage;
CREATE TRIGGER increment_promotion_uses_trigger
  AFTER INSERT ON public.promotion_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_promotion_uses();

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_promotions_code ON public.promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_valid_dates ON public.promotions(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion_id ON public.promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_user_id ON public.promotion_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_used_at ON public.promotion_usage(used_at);
