-- Fix missing tables and columns for referral system
-- Using IF NOT EXISTS to avoid errors if objects already exist

-- Create affiliate_commissions table if not exists
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

-- Create affiliate_payouts table if not exists
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

-- Add referrer chain columns to profiles if not exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tier1_referrer_id UUID,
ADD COLUMN IF NOT EXISTS tier2_referrer_id UUID,
ADD COLUMN IF NOT EXISTS tier3_referrer_id UUID,
ADD COLUMN IF NOT EXISTS affiliate_balance NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_affiliate_earnings NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS affiliate_tier TEXT DEFAULT 'bronze' CHECK (affiliate_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));

-- Create referral_milestones table if not exists
CREATE TABLE IF NOT EXISTS public.referral_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_count INTEGER NOT NULL,
  bonus_amount NUMERIC NOT NULL,
  bonus_type TEXT NOT NULL DEFAULT 'cash',
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_milestone_achievements table if not exists
CREATE TABLE IF NOT EXISTS public.user_milestone_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  milestone_id UUID NOT NULL REFERENCES public.referral_milestones(id) ON DELETE CASCADE,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bonus_credited BOOLEAN NOT NULL DEFAULT false,
  credited_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, milestone_id)
);

-- Enable RLS on tables
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_milestone_achievements ENABLE ROW LEVEL SECURITY;

-- Insert default milestones if table is empty
INSERT INTO public.referral_milestones (referral_count, bonus_amount, bonus_type, name, description)
SELECT * FROM (VALUES
  (5, 10, 'cash', 'Getting Started', 'Earn $10 bonus for your first 5 referrals'),
  (10, 25, 'cash', 'Rising Star', 'Earn $25 bonus for reaching 10 referrals'),
  (25, 75, 'cash', 'Affiliate Pro', 'Earn $75 bonus for reaching 25 referrals'),
  (50, 200, 'cash', 'Super Affiliate', 'Earn $200 bonus for reaching 50 referrals'),
  (100, 500, 'cash', 'Elite Partner', 'Earn $500 bonus for reaching 100 referrals')
) AS v(referral_count, bonus_amount, bonus_type, name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.referral_milestones);

-- Create or replace function to check and award milestone bonuses
CREATE OR REPLACE FUNCTION public.check_referral_milestones()
RETURNS TRIGGER AS $$
DECLARE
  referral_count INTEGER;
  milestone RECORD;
  existing_achievement UUID;
BEGIN
  -- Count direct referrals for this user
  SELECT COUNT(*) INTO referral_count
  FROM profiles
  WHERE tier1_referrer_id = NEW.tier1_referrer_id;
  
  -- Check each active milestone
  FOR milestone IN 
    SELECT id, referral_count as required_count, bonus_amount
    FROM referral_milestones 
    WHERE is_active = true AND referral_count <= referral_count
    ORDER BY referral_count ASC
  LOOP
    -- Check if user already achieved this milestone
    SELECT id INTO existing_achievement
    FROM user_milestone_achievements
    WHERE user_id = NEW.tier1_referrer_id AND milestone_id = milestone.id;
    
    -- If not achieved, create achievement and credit bonus
    IF existing_achievement IS NULL THEN
      -- Insert achievement record
      INSERT INTO user_milestone_achievements (user_id, milestone_id, bonus_credited, credited_at)
      VALUES (NEW.tier1_referrer_id, milestone.id, true, now());
      
      -- Credit bonus to affiliate balance
      UPDATE profiles
      SET 
        affiliate_balance = COALESCE(affiliate_balance, 0) + milestone.bonus_amount,
        total_affiliate_earnings = COALESCE(total_affiliate_earnings, 0) + milestone.bonus_amount
      WHERE user_id = NEW.tier1_referrer_id;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS check_referral_milestones_trigger ON public.profiles;
CREATE TRIGGER check_referral_milestones_trigger
  AFTER INSERT OR UPDATE OF tier1_referrer_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.tier1_referrer_id IS NOT NULL)
  EXECUTE FUNCTION public.check_referral_milestones();

-- Create RLS policies for referral_milestones
DROP POLICY IF EXISTS "Anyone can view active milestones" ON public.referral_milestones;
DROP POLICY IF EXISTS "Authenticated users can view active milestones" ON public.referral_milestones;
CREATE POLICY "Authenticated users can view active milestones"
ON public.referral_milestones
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage milestones" ON public.referral_milestones;
CREATE POLICY "Admins can manage milestones"
ON public.referral_milestones
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RLS policies for user_milestone_achievements
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.user_milestone_achievements;
CREATE POLICY "Users can view their own achievements"
ON public.user_milestone_achievements
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all achievements" ON public.user_milestone_achievements;
CREATE POLICY "Admins can view all achievements"
ON public.user_milestone_achievements
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RLS policies for affiliate_commissions
DROP POLICY IF EXISTS "Users can view their own commissions" ON public.affiliate_commissions;
CREATE POLICY "Users can view their own commissions"
ON public.affiliate_commissions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all commissions" ON public.affiliate_commissions;
CREATE POLICY "Admins can view all commissions"
ON public.affiliate_commissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update commissions" ON public.affiliate_commissions;
CREATE POLICY "Admins can update commissions"
ON public.affiliate_commissions
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create RLS policies for affiliate_payouts
DROP POLICY IF EXISTS "Users can view their own payouts" ON public.affiliate_payouts;
CREATE POLICY "Users can view their own payouts"
ON public.affiliate_payouts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can request payouts" ON public.affiliate_payouts;
CREATE POLICY "Users can request payouts"
ON public.affiliate_payouts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all payouts" ON public.affiliate_payouts;
CREATE POLICY "Admins can view all payouts"
ON public.affiliate_payouts
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update payouts" ON public.affiliate_payouts;
CREATE POLICY "Admins can update payouts"
ON public.affiliate_payouts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));
