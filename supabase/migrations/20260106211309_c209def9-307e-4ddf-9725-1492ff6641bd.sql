-- Create function to get affiliate leaderboard by earnings
CREATE OR REPLACE FUNCTION public.get_affiliate_leaderboard_earnings(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  total_affiliate_earnings NUMERIC,
  affiliate_tier TEXT,
  referral_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    COALESCE(p.total_affiliate_earnings, 0) as total_affiliate_earnings,
    COALESCE(p.affiliate_tier, 'bronze') as affiliate_tier,
    (
      SELECT COUNT(*)::BIGINT 
      FROM profiles ref 
      WHERE ref.tier1_referrer_id = p.user_id
    ) as referral_count
  FROM profiles p
  WHERE COALESCE(p.total_affiliate_earnings, 0) > 0
  ORDER BY p.total_affiliate_earnings DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to get affiliate leaderboard by referral count
CREATE OR REPLACE FUNCTION public.get_affiliate_leaderboard_referrals(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  total_affiliate_earnings NUMERIC,
  affiliate_tier TEXT,
  referral_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.avatar_url,
    COALESCE(p.total_affiliate_earnings, 0) as total_affiliate_earnings,
    COALESCE(p.affiliate_tier, 'bronze') as affiliate_tier,
    (
      SELECT COUNT(*)::BIGINT 
      FROM profiles ref 
      WHERE ref.tier1_referrer_id = p.user_id
    ) as referral_count
  FROM profiles p
  WHERE EXISTS (SELECT 1 FROM profiles ref WHERE ref.tier1_referrer_id = p.user_id)
  ORDER BY referral_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to get user's affiliate rank
CREATE OR REPLACE FUNCTION public.get_user_affiliate_rank(user_uuid UUID)
RETURNS TABLE (
  earnings INTEGER,
  referrals INTEGER
) AS $$
DECLARE
  earnings_rank INTEGER;
  referrals_rank INTEGER;
  user_earnings NUMERIC;
  user_referral_count BIGINT;
BEGIN
  -- Get user's earnings
  SELECT COALESCE(p.total_affiliate_earnings, 0) INTO user_earnings
  FROM profiles p WHERE p.user_id = user_uuid;
  
  -- Get user's referral count
  SELECT COUNT(*)::BIGINT INTO user_referral_count
  FROM profiles ref WHERE ref.tier1_referrer_id = user_uuid;
  
  -- Calculate earnings rank
  SELECT COUNT(*)::INTEGER + 1 INTO earnings_rank
  FROM profiles p
  WHERE COALESCE(p.total_affiliate_earnings, 0) > COALESCE(user_earnings, 0);
  
  -- Calculate referrals rank
  SELECT COUNT(*)::INTEGER + 1 INTO referrals_rank
  FROM profiles p
  WHERE (SELECT COUNT(*) FROM profiles ref WHERE ref.tier1_referrer_id = p.user_id) > user_referral_count;
  
  RETURN QUERY SELECT earnings_rank, referrals_rank;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;