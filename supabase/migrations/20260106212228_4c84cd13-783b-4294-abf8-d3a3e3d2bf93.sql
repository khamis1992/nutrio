-- Create table for referral milestones configuration
CREATE TABLE public.referral_milestones (
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

-- Create table to track user milestone achievements
CREATE TABLE public.user_milestone_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  milestone_id UUID NOT NULL REFERENCES public.referral_milestones(id) ON DELETE CASCADE,
  achieved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  bonus_credited BOOLEAN NOT NULL DEFAULT false,
  credited_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, milestone_id)
);

-- Enable RLS
ALTER TABLE public.referral_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_milestone_achievements ENABLE ROW LEVEL SECURITY;

-- RLS policies for referral_milestones
CREATE POLICY "Anyone can view active milestones" 
ON public.referral_milestones 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Admins can manage milestones" 
ON public.referral_milestones 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for user_milestone_achievements
CREATE POLICY "Users can view their own achievements" 
ON public.user_milestone_achievements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all achievements" 
ON public.user_milestone_achievements 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default milestones
INSERT INTO public.referral_milestones (referral_count, bonus_amount, bonus_type, name, description) VALUES
(5, 10, 'cash', 'Getting Started', 'Earn $10 bonus for your first 5 referrals'),
(10, 25, 'cash', 'Rising Star', 'Earn $25 bonus for reaching 10 referrals'),
(25, 75, 'cash', 'Affiliate Pro', 'Earn $75 bonus for reaching 25 referrals'),
(50, 200, 'cash', 'Super Affiliate', 'Earn $200 bonus for reaching 50 referrals'),
(100, 500, 'cash', 'Elite Partner', 'Earn $500 bonus for reaching 100 referrals');

-- Function to check and award milestone bonuses
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

-- Create trigger to check milestones when a new referral is added
DROP TRIGGER IF EXISTS check_referral_milestones_trigger ON public.profiles;
CREATE TRIGGER check_referral_milestones_trigger
  AFTER INSERT OR UPDATE OF tier1_referrer_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.tier1_referrer_id IS NOT NULL)
  EXECUTE FUNCTION public.check_referral_milestones();