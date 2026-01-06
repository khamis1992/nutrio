-- Add premium analytics subscription tracking to restaurants
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS premium_analytics_until TIMESTAMPTZ;

-- Create table for premium analytics purchases
CREATE TABLE public.premium_analytics_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL,
  package_type TEXT NOT NULL, -- 'monthly', 'quarterly', 'yearly'
  price_paid NUMERIC NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.premium_analytics_purchases ENABLE ROW LEVEL SECURITY;

-- RLS policies for premium analytics purchases
CREATE POLICY "Partners can view their own premium analytics purchases"
  ON public.premium_analytics_purchases
  FOR SELECT
  USING (partner_id = auth.uid());

CREATE POLICY "Partners can create premium analytics purchases"
  ON public.premium_analytics_purchases
  FOR INSERT
  WITH CHECK (partner_id = auth.uid());

CREATE POLICY "Admins can view all premium analytics purchases"
  ON public.premium_analytics_purchases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Add premium analytics pricing to platform settings
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'premium_analytics_prices',
  '{"monthly": 29.99, "quarterly": 74.99, "yearly": 249.99}',
  'Pricing for premium analytics packages'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;