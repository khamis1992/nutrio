-- Create function to check and update affiliate tier based on referral count
CREATE OR REPLACE FUNCTION public.update_affiliate_tier()
RETURNS TRIGGER AS $$
DECLARE
  referral_count INTEGER;
  new_tier TEXT;
  old_tier TEXT;
BEGIN
  -- Get current tier
  old_tier := COALESCE(OLD.affiliate_tier, 'bronze');
  
  -- Count direct referrals
  SELECT COUNT(*) INTO referral_count
  FROM profiles
  WHERE tier1_referrer_id = NEW.user_id;
  
  -- Determine new tier based on referral count
  IF referral_count >= 100 THEN
    new_tier := 'diamond';
  ELSIF referral_count >= 50 THEN
    new_tier := 'platinum';
  ELSIF referral_count >= 25 THEN
    new_tier := 'gold';
  ELSIF referral_count >= 10 THEN
    new_tier := 'silver';
  ELSE
    new_tier := 'bronze';
  END IF;
  
  -- Update tier if changed
  IF new_tier != old_tier THEN
    NEW.affiliate_tier := new_tier;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update tier on profile changes
DROP TRIGGER IF EXISTS update_affiliate_tier_trigger ON public.profiles;
CREATE TRIGGER update_affiliate_tier_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_tier();

-- Create function to send tier upgrade notification
CREATE OR REPLACE FUNCTION public.notify_tier_upgrade()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send notification if tier actually changed and it's an upgrade
  IF OLD.affiliate_tier IS DISTINCT FROM NEW.affiliate_tier AND NEW.affiliate_tier IS NOT NULL THEN
    -- Check if it's an upgrade (not a downgrade)
    IF (
      (OLD.affiliate_tier = 'bronze' AND NEW.affiliate_tier IN ('silver', 'gold', 'platinum', 'diamond')) OR
      (OLD.affiliate_tier = 'silver' AND NEW.affiliate_tier IN ('gold', 'platinum', 'diamond')) OR
      (OLD.affiliate_tier = 'gold' AND NEW.affiliate_tier IN ('platinum', 'diamond')) OR
      (OLD.affiliate_tier = 'platinum' AND NEW.affiliate_tier = 'diamond')
    ) THEN
      -- Call the edge function
      PERFORM net.http_post(
        url := 'https://loepcagitrijlfksawfm.supabase.co/functions/v1/send-tier-upgrade-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbWhucGlucHN3bGh6aWZjZm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTU1MTYsImV4cCI6MjA4MzEzMTUxNn0.LLYu3z6Mc2-_rdSDrnlo3PVJHnuCjuec0sxlOKmz6fk'
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id,
          'old_tier', COALESCE(OLD.affiliate_tier, 'bronze'),
          'new_tier', NEW.affiliate_tier
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to send notification after tier upgrade
DROP TRIGGER IF EXISTS notify_tier_upgrade_trigger ON public.profiles;
CREATE TRIGGER notify_tier_upgrade_trigger
  AFTER UPDATE OF affiliate_tier ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tier_upgrade();

-- Also update tier when a new referral is added (when someone sets their tier1_referrer_id)
CREATE OR REPLACE FUNCTION public.check_referrer_tier_upgrade()
RETURNS TRIGGER AS $$
DECLARE
  referral_count INTEGER;
  current_tier TEXT;
  new_tier TEXT;
BEGIN
  -- Only process if tier1_referrer_id is set
  IF NEW.tier1_referrer_id IS NOT NULL THEN
    -- Count direct referrals for the referrer
    SELECT COUNT(*) INTO referral_count
    FROM profiles
    WHERE tier1_referrer_id = NEW.tier1_referrer_id;
    
    -- Get current tier
    SELECT COALESCE(affiliate_tier, 'bronze') INTO current_tier
    FROM profiles
    WHERE user_id = NEW.tier1_referrer_id;
    
    -- Determine new tier based on referral count
    IF referral_count >= 100 THEN
      new_tier := 'diamond';
    ELSIF referral_count >= 50 THEN
      new_tier := 'platinum';
    ELSIF referral_count >= 25 THEN
      new_tier := 'gold';
    ELSIF referral_count >= 10 THEN
      new_tier := 'silver';
    ELSE
      new_tier := 'bronze';
    END IF;
    
    -- Update referrer's tier if changed
    IF new_tier != current_tier THEN
      UPDATE profiles
      SET affiliate_tier = new_tier
      WHERE user_id = NEW.tier1_referrer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to check referrer tier when new referral is added
DROP TRIGGER IF EXISTS check_referrer_tier_upgrade_trigger ON public.profiles;
CREATE TRIGGER check_referrer_tier_upgrade_trigger
  AFTER INSERT OR UPDATE OF tier1_referrer_id ON public.profiles
  FOR EACH ROW
  WHEN (NEW.tier1_referrer_id IS NOT NULL)
  EXECUTE FUNCTION public.check_referrer_tier_upgrade();