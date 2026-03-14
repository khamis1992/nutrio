-- Create premium_analytics_purchases table if it doesn't exist, then ensure status column is present
CREATE TABLE IF NOT EXISTS public.premium_analytics_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  partner_id UUID,
  package_type TEXT,
  price_paid NUMERIC(10, 2),
  ends_at TIMESTAMPTZ,
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- In case the table already existed without the status column, add it safely
ALTER TABLE public.premium_analytics_purchases
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rejected', 'expired'));
