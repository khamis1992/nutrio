-- Add wallet credit rewards to community challenges.

ALTER TABLE public.community_challenges
ADD COLUMN IF NOT EXISTS wallet_reward_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_challenge_progress(
  p_challenge_id UUID,
  p_user_id UUID,
  p_progress INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_challenge RECORD;
  v_new_progress INTEGER;
  v_was_completed BOOLEAN;
  v_xp_result JSONB;
  v_wallet_transaction_id UUID;
BEGIN
  SELECT *
  INTO v_participant
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not participating in this challenge');
  END IF;

  SELECT id, title, target_value, xp_reward, wallet_reward_amount
  INTO v_challenge
  FROM public.community_challenges
  WHERE id = p_challenge_id
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive');
  END IF;

  v_was_completed := v_participant.completed_at IS NOT NULL;
  v_new_progress := LEAST(GREATEST(p_progress, 0), COALESCE(v_challenge.target_value, 0));

  UPDATE public.challenge_participants
  SET current_progress = v_new_progress,
      completed_at = CASE
        WHEN v_new_progress >= v_challenge.target_value AND completed_at IS NULL
        THEN now()
        ELSE completed_at
      END,
      updated_at = now()
  WHERE id = v_participant.id;

  IF NOT v_was_completed AND v_new_progress >= v_challenge.target_value THEN
    v_xp_result := public.award_xp(
      p_user_id,
      COALESCE(v_challenge.xp_reward, 100),
      'Community challenge completed: ' || COALESCE(v_challenge.title, 'Challenge'),
      'community_challenge_complete',
      p_challenge_id::text,
      jsonb_build_object('challenge_id', p_challenge_id)
    );

    IF COALESCE(v_challenge.wallet_reward_amount, 0) > 0 THEN
      v_wallet_transaction_id := public.credit_wallet(
        p_user_id,
        v_challenge.wallet_reward_amount,
        'reward',
        'community_challenge',
        p_challenge_id,
        'Community challenge reward: ' || COALESCE(v_challenge.title, 'Challenge'),
        jsonb_build_object('challenge_id', p_challenge_id)
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'completed', true,
      'progress', v_new_progress,
      'target', v_challenge.target_value,
      'xp', v_xp_result,
      'wallet_transaction_id', v_wallet_transaction_id,
      'wallet_reward_amount', COALESCE(v_challenge.wallet_reward_amount, 0)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'completed', v_new_progress >= v_challenge.target_value,
    'progress', v_new_progress,
    'target', v_challenge.target_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_challenge_progress(UUID, UUID, INTEGER) TO authenticated;

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
    cc.target_value,
    cc.reward_points,
    cc.xp_reward,
    cc.wallet_reward_amount,
    cc.participant_count,
    cc.start_date::DATE,
    cc.end_date::DATE,
    p_user_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.challenge_participants cp2
      WHERE cp2.challenge_id = cc.id
        AND cp2.user_id = p_user_id
    ) AS is_joined,
    COALESCE(cp.current_progress, 0) AS user_progress,
    COALESCE(cl.rank, 0) AS user_rank
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
