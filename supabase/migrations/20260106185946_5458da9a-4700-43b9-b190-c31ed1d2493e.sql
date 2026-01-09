-- Create featured_listings table for partner advertising
CREATE TABLE public.featured_listings (
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

-- Enable RLS
ALTER TABLE public.featured_listings ENABLE ROW LEVEL SECURITY;

-- Partners can view their own listings
CREATE POLICY "Partners can view their own featured listings"
ON public.featured_listings
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM restaurants r
  WHERE r.id = featured_listings.restaurant_id
  AND r.owner_id = auth.uid()
));

-- Partners can create listings for their restaurants
CREATE POLICY "Partners can create featured listings for their restaurants"
ON public.featured_listings
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM restaurants r
  WHERE r.id = featured_listings.restaurant_id
  AND r.owner_id = auth.uid()
));

-- Admins can manage all listings
CREATE POLICY "Admins can manage all featured listings"
ON public.featured_listings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active listings (for display purposes)
CREATE POLICY "Anyone can view active featured listings"
ON public.featured_listings
FOR SELECT
USING (status = 'active' AND starts_at <= now() AND ends_at > now());

-- Create trigger for updated_at
CREATE TRIGGER update_featured_listings_updated_at
BEFORE UPDATE ON public.featured_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add featured_listing_prices to platform_settings
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'featured_listing_prices',
  '{"weekly": 49, "biweekly": 89, "monthly": 149}'::jsonb,
  'Pricing for featured restaurant listings'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;