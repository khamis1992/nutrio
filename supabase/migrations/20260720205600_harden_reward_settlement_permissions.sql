-- Keep reward settlement mutations server-owned even when a schema restore or
-- broad default grant gives new public-schema objects client privileges.

REVOKE ALL ON TABLE public.community_challenge_reward_settlements
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.community_challenge_reward_settlements
  TO authenticated;
GRANT ALL ON TABLE public.community_challenge_reward_settlements
  TO service_role;

REVOKE ALL ON FUNCTION public.grant_community_challenge_wallet_reward(UUID, UUID, UUID, INTEGER, TEXT, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reverse_community_challenge_wallet_reward(UUID, UUID, INTEGER, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_community_challenge_progress(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_community_challenge_progress(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_community_challenge_progress_for_user(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_ended_community_challenges(INTEGER)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.grant_community_challenge_wallet_reward(UUID, UUID, UUID, INTEGER, TEXT, NUMERIC, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reverse_community_challenge_wallet_reward(UUID, UUID, INTEGER, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_community_challenge_progress(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_community_challenge_progress(UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_community_challenge_progress_for_user(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_ended_community_challenges(INTEGER)
  TO service_role;

REVOKE ALL ON FUNCTION public.sync_my_community_challenges()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_my_community_challenges()
  TO authenticated, service_role;
