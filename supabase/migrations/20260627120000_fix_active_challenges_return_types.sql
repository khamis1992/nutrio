DROP FUNCTION IF EXISTS public.get_active_challenges(UUID);

CREATE OR REPLACE FUNCTION public.get_active_challenges(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  challenge_type TEXT,
  difficulty_level TEXT,
  category TEXT,
  target_value INTEGER,
  reward_points INTEGER,
  xp_reward INTEGER,
  wallet_reward_amount NUMERIC,
  participant_count INTEGER,
  start_date DATE,
  end_date DATE,
  is_joined BOOLEAN,
  user_progress INTEGER,
  user_rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cc.id,
    cc.title,
    cc.description,
    cc.challenge_type::TEXT,
    cc.difficulty_level::TEXT,
    cc.category::TEXT,
    cc.target_value::INTEGER,
    cc.reward_points::INTEGER,
    cc.xp_reward::INTEGER,
    cc.wallet_reward_amount,
    cc.participant_count::INTEGER,
    cc.start_date::DATE,
    cc.end_date::DATE,
    p_user_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.challenge_participants cp2
      WHERE cp2.challenge_id = cc.id
        AND cp2.user_id = p_user_id
    ) AS is_joined,
    COALESCE(cp.current_progress, 0)::INTEGER AS user_progress,
    COALESCE(cl.rank, 0)::INTEGER AS user_rank
  FROM public.community_challenges cc
  LEFT JOIN public.challenge_participants cp ON cc.id = cp.challenge_id AND cp.user_id = p_user_id
  LEFT JOIN public.challenge_leaderboard cl ON cc.id = cl.challenge_id AND cl.user_id = p_user_id
  WHERE cc.is_active = true
    AND cc.start_date <= CURRENT_DATE
    AND cc.end_date >= CURRENT_DATE
  ORDER BY cc.start_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_challenges(UUID) TO authenticated;
