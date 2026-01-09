-- Add affiliate settings to platform_settings
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'affiliate_settings',
  '{
    "enabled": true,
    "tier1_commission": 10,
    "tier2_commission": 5,
    "tier3_commission": 2,
    "min_payout_threshold": 25,
    "commission_type": "percentage",
    "bonus_first_referral": 5,
    "bonus_milestone_10": 20,
    "bonus_milestone_25": 50,
    "bonus_milestone_50": 100
  }'::jsonb,
  'Multi-tier affiliate/MLM commission settings'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Create affiliate_commissions table to track earnings
CREATE TABLE public.affiliate_commissions (
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

-- Create affiliate_payouts table to track payout requests
CREATE TABLE public.affiliate_payouts (
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

-- Add referrer chain columns to profiles for tracking MLM hierarchy
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tier1_referrer_id UUID,
ADD COLUMN IF NOT EXISTS tier2_referrer_id UUID,
ADD COLUMN IF NOT EXISTS tier3_referrer_id UUID,
ADD COLUMN IF NOT EXISTS affiliate_balance NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_affiliate_earnings NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS affiliate_tier TEXT DEFAULT 'bronze' CHECK (affiliate_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));

-- Enable RLS on new tables
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for affiliate_commissions
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

-- RLS policies for affiliate_payouts
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

-- Create function to calculate and update affiliate tier based on total referrals
CREATE OR REPLACE FUNCTION public.update_affiliate_tier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_count INTEGER;
  new_tier TEXT;
BEGIN
  -- Count completed referrals
  SELECT COUNT(*) INTO referral_count
  FROM public.referrals
  WHERE referrer_id = NEW.referrer_id AND status = 'completed';
  
  -- Determine tier based on referral count
  IF referral_count >= 50 THEN
    new_tier := 'diamond';
  ELSIF referral_count >= 25 THEN
    new_tier := 'platinum';
  ELSIF referral_count >= 10 THEN
    new_tier := 'gold';
  ELSIF referral_count >= 5 THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;
  
  -- Update the referrer's tier
  UPDATE public.profiles
  SET affiliate_tier = new_tier
  WHERE user_id = NEW.referrer_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update affiliate tier on referral completion
CREATE TRIGGER update_affiliate_tier_on_referral
AFTER INSERT OR UPDATE ON public.referrals
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION public.update_affiliate_tier();

-- Create function to set referrer chain when a new user signs up with a referral
CREATE OR REPLACE FUNCTION public.set_referrer_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_profile RECORD;
BEGIN
  -- Only process if user was referred
  IF NEW.referred_by IS NOT NULL THEN
    -- Get the referrer's chain
    SELECT tier1_referrer_id, tier2_referrer_id INTO referrer_profile
    FROM public.profiles
    WHERE user_id = NEW.referred_by;
    
    -- Set the chain for the new user
    NEW.tier1_referrer_id := NEW.referred_by;
    NEW.tier2_referrer_id := referrer_profile.tier1_referrer_id;
    NEW.tier3_referrer_id := referrer_profile.tier2_referrer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to set referrer chain on profile update
CREATE TRIGGER set_referrer_chain_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (OLD.referred_by IS DISTINCT FROM NEW.referred_by AND NEW.referred_by IS NOT NULL)
EXECUTE FUNCTION public.set_referrer_chain();