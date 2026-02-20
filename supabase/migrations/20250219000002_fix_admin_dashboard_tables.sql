-- ============================================================
-- NUTRIO ADMIN DASHBOARD - MISSING TABLES FIX
-- Run this in Supabase SQL Editor to fix the 404/400 errors
-- ============================================================

-- 1. CREATE HELPER FUNCTION (needed for triggers)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. CREATE APPROVAL_STATUS ENUM (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

-- 3. ADD APPROVAL_STATUS TO RESTAURANTS TABLE (if column doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.restaurants ADD COLUMN approval_status public.approval_status DEFAULT 'pending';
  END IF;
END
$$;

-- 4. CREATE PAYOUTS TABLE
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  order_count INTEGER NOT NULL DEFAULT 0,
  payout_method TEXT DEFAULT 'bank_transfer',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can manage payouts" ON public.payouts;

CREATE POLICY "Partners can view their payouts"
ON public.payouts FOR SELECT
USING (auth.uid() = partner_id);

CREATE POLICY "Admins can manage payouts"
ON public.payouts FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON public.payouts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. CREATE FEATURED_LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.featured_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('weekly', 'biweekly', 'monthly')),
  price_paid NUMERIC NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their own featured listings" ON public.featured_listings;
DROP POLICY IF EXISTS "Partners can create featured listings for their restaurants" ON public.featured_listings;
DROP POLICY IF EXISTS "Admins can manage all featured listings" ON public.featured_listings;
DROP POLICY IF EXISTS "Anyone can view active featured listings" ON public.featured_listings;

CREATE POLICY "Partners can view their own featured listings"
ON public.featured_listings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM restaurants r
  WHERE r.id = featured_listings.restaurant_id
  AND r.owner_id = auth.uid()
));

CREATE POLICY "Partners can create featured listings for their restaurants"
ON public.featured_listings
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants r
  WHERE r.id = featured_listings.restaurant_id
  AND r.owner_id = auth.uid()
));

CREATE POLICY "Admins can manage all featured listings"
ON public.featured_listings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active featured listings"
ON public.featured_listings
FOR SELECT
USING (status = 'active' AND starts_at <= now() AND ends_at > now());

CREATE TRIGGER update_featured_listings_updated_at
BEFORE UPDATE ON public.featured_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 6. CREATE AFFILIATE COMMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  tier INTEGER NOT NULL CHECK (tier >= 1 AND tier <= 3),
  order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own commissions" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "Admins can view all commissions" ON public.affiliate_commissions;
DROP POLICY IF EXISTS "Admins can update commissions" ON public.affiliate_commissions;

CREATE POLICY "Users can view their own commissions"
ON public.affiliate_commissions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all commissions"
ON public.affiliate_commissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update commissions"
ON public.affiliate_commissions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- 7. CREATE AFFILIATE PAYOUTS TABLE
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  payout_method TEXT DEFAULT 'bank_transfer',
  payout_details JSONB DEFAULT '{}',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payouts" ON public.affiliate_payouts;
DROP POLICY IF EXISTS "Users can request payouts" ON public.affiliate_payouts;
DROP POLICY IF EXISTS "Admins can view all payouts" ON public.affiliate_payouts;
DROP POLICY IF EXISTS "Admins can update payouts" ON public.affiliate_payouts;

CREATE POLICY "Users can view their own payouts"
ON public.affiliate_payouts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can request payouts"
ON public.affiliate_payouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payouts"
ON public.affiliate_payouts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update payouts"
ON public.affiliate_payouts
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- 8. CREATE AFFILIATE APPLICATIONS TABLE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'affiliate_status') THEN
    CREATE TYPE public.affiliate_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.affiliate_status NOT NULL DEFAULT 'pending',
  application_note TEXT,
  rejection_reason TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own application" ON public.affiliate_applications;
DROP POLICY IF EXISTS "Users can insert their own application" ON public.affiliate_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.affiliate_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.affiliate_applications;

CREATE POLICY "Users can view their own application"
ON public.affiliate_applications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own application"
ON public.affiliate_applications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
ON public.affiliate_applications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update applications"
ON public.affiliate_applications
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_affiliate_applications_updated_at
BEFORE UPDATE ON public.affiliate_applications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 9. ADD HELPER FUNCTION FOR CHECKING AFFILIATE STATUS
CREATE OR REPLACE FUNCTION public.is_approved_affiliate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.affiliate_applications
    WHERE user_id = _user_id
      AND status = 'approved'
  )
$$;

-- 10. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_payouts_partner ON public.payouts(partner_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created ON public.payouts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_featured_listings_restaurant ON public.featured_listings(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_featured_listings_status ON public.featured_listings(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_user ON public.affiliate_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON public.affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_user ON public.affiliate_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON public.affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_user ON public.affiliate_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON public.affiliate_applications(status);
CREATE INDEX IF NOT EXISTS idx_restaurants_approval_status ON public.restaurants(approval_status);

-- ============================================================
-- DONE! All missing tables created.
-- Refresh your admin dashboard page to see the data.
-- ============================================================
