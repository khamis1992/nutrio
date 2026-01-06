-- Function to calculate and credit affiliate commissions when an order is placed
CREATE OR REPLACE FUNCTION public.calculate_affiliate_commissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_profile RECORD;
  affiliate_settings JSONB;
  tier1_rate NUMERIC;
  tier2_rate NUMERIC;
  tier3_rate NUMERIC;
  commission_amount NUMERIC;
  is_enabled BOOLEAN;
BEGIN
  -- Only process completed/confirmed orders
  IF NEW.status NOT IN ('confirmed', 'delivered') THEN
    RETURN NEW;
  END IF;
  
  -- Skip if already processed (status changed from confirmed to delivered)
  IF OLD IS NOT NULL AND OLD.status IN ('confirmed', 'delivered') THEN
    RETURN NEW;
  END IF;

  -- Get user profile with referrer chain
  SELECT tier1_referrer_id, tier2_referrer_id, tier3_referrer_id
  INTO user_profile
  FROM profiles
  WHERE user_id = NEW.user_id;

  -- If no referrers, nothing to do
  IF user_profile.tier1_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get affiliate settings
  SELECT value INTO affiliate_settings
  FROM platform_settings
  WHERE key = 'affiliate_settings';

  -- Check if affiliate program is enabled
  is_enabled := COALESCE((affiliate_settings->>'enabled')::BOOLEAN, false);
  IF NOT is_enabled THEN
    RETURN NEW;
  END IF;

  -- Get commission rates
  tier1_rate := COALESCE((affiliate_settings->>'tier1_commission')::NUMERIC, 10) / 100;
  tier2_rate := COALESCE((affiliate_settings->>'tier2_commission')::NUMERIC, 5) / 100;
  tier3_rate := COALESCE((affiliate_settings->>'tier3_commission')::NUMERIC, 2) / 100;

  -- Tier 1 Commission
  IF user_profile.tier1_referrer_id IS NOT NULL THEN
    commission_amount := NEW.total_price * tier1_rate;
    
    -- Insert commission record
    INSERT INTO affiliate_commissions (
      user_id, source_user_id, order_id, tier, order_amount, 
      commission_rate, commission_amount, status
    ) VALUES (
      user_profile.tier1_referrer_id, NEW.user_id, NEW.id, 1, 
      NEW.total_price, tier1_rate * 100, commission_amount, 'pending'
    );
    
    -- Update referrer's balance
    UPDATE profiles
    SET 
      affiliate_balance = COALESCE(affiliate_balance, 0) + commission_amount,
      total_affiliate_earnings = COALESCE(total_affiliate_earnings, 0) + commission_amount
    WHERE user_id = user_profile.tier1_referrer_id;
  END IF;

  -- Tier 2 Commission
  IF user_profile.tier2_referrer_id IS NOT NULL THEN
    commission_amount := NEW.total_price * tier2_rate;
    
    INSERT INTO affiliate_commissions (
      user_id, source_user_id, order_id, tier, order_amount,
      commission_rate, commission_amount, status
    ) VALUES (
      user_profile.tier2_referrer_id, NEW.user_id, NEW.id, 2,
      NEW.total_price, tier2_rate * 100, commission_amount, 'pending'
    );
    
    UPDATE profiles
    SET 
      affiliate_balance = COALESCE(affiliate_balance, 0) + commission_amount,
      total_affiliate_earnings = COALESCE(total_affiliate_earnings, 0) + commission_amount
    WHERE user_id = user_profile.tier2_referrer_id;
  END IF;

  -- Tier 3 Commission
  IF user_profile.tier3_referrer_id IS NOT NULL THEN
    commission_amount := NEW.total_price * tier3_rate;
    
    INSERT INTO affiliate_commissions (
      user_id, source_user_id, order_id, tier, order_amount,
      commission_rate, commission_amount, status
    ) VALUES (
      user_profile.tier3_referrer_id, NEW.user_id, NEW.id, 3,
      NEW.total_price, tier3_rate * 100, commission_amount, 'pending'
    );
    
    UPDATE profiles
    SET 
      affiliate_balance = COALESCE(affiliate_balance, 0) + commission_amount,
      total_affiliate_earnings = COALESCE(total_affiliate_earnings, 0) + commission_amount
    WHERE user_id = user_profile.tier3_referrer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS calculate_affiliate_commissions_trigger ON orders;
CREATE TRIGGER calculate_affiliate_commissions_trigger
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_affiliate_commissions();

-- Also add a function to mark commissions as paid when payouts are approved
CREATE OR REPLACE FUNCTION public.mark_commissions_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- When a payout is approved, mark pending commissions as paid
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    UPDATE affiliate_commissions
    SET 
      status = 'paid',
      paid_at = NOW()
    WHERE user_id = NEW.user_id
      AND status = 'pending'
      AND commission_amount <= NEW.amount;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on affiliate_payouts table
DROP TRIGGER IF EXISTS mark_commissions_paid_trigger ON affiliate_payouts;
CREATE TRIGGER mark_commissions_paid_trigger
  AFTER UPDATE OF status ON affiliate_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_commissions_paid();