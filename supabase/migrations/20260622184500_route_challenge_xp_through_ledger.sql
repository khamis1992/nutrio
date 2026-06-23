-- Route community challenge XP through the centralized XP ledger.

CREATE OR REPLACE VIEW public.challenge_leaderboard AS
SELECT
  cp.challenge_id,
  cp.user_id,
  p.full_name AS user_name,
  p.avatar_url,
  cp.current_progress,
  cc.target_value,
  ROUND((cp.current_progress::DECIMAL / NULLIF(cc.target_value, 0)) * 100, 1) AS progress_percent,
  cp.completed_at,
  RANK() OVER (
    PARTITION BY cp.challenge_id
    ORDER BY cp.current_progress DESC, cp.completed_at ASC NULLS LAST
  ) AS rank
FROM public.challenge_participants cp
JOIN public.community_challenges cc ON cp.challenge_id = cc.id
LEFT JOIN public.profiles p ON cp.user_id = p.user_id
WHERE cc.is_active = true;

CREATE OR REPLACE FUNCTION public.update_challenge_progress(
  p_challenge_id UUID,
  p_user_id UUID,
  p_progress INTEGER
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

  SELECT id, title, target_value, xp_reward
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

    RETURN jsonb_build_object(
      'success', true,
      'completed', true,
      'progress', v_new_progress,
      'target', v_challenge.target_value,
      'xp', v_xp_result
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
