import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ChallengeTeamState } from "@/lib/challenge-teams";

type TeamRpcClient = typeof supabase & {
  rpc(
    fn: "get_challenge_team_state",
    args: { p_challenge_id: string },
  ): Promise<{ data: ChallengeTeamState | null; error: { message?: string } | null }>;
  rpc(
    fn: "create_challenge_team",
    args: { p_challenge_id: string; p_name: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    fn: "join_challenge_team",
    args: { p_join_code: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    fn: "leave_challenge_team",
    args: { p_team_id: string },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

const teamRpc = supabase as TeamRpcClient;

export function useChallengeTeam(challengeId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const queryKey = ["challenge-team", challengeId];
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await teamRpc.rpc("get_challenge_team_state", {
        p_challenge_id: challengeId,
      });
      if (error) throw new Error(error.message || "Could not load the team");
      return data ?? { team: null, members: [], leaderboard: [], team_size: 5 };
    },
    enabled: Boolean(challengeId) && enabled,
    staleTime: 20_000,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const createTeam = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await teamRpc.rpc("create_challenge_team", {
        p_challenge_id: challengeId,
        p_name: name,
      });
      if (error) throw new Error(error.message || "Could not create the team");
    },
    onSuccess: refresh,
  });

  const joinTeam = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await teamRpc.rpc("join_challenge_team", {
        p_join_code: code,
      });
      if (error) throw new Error(error.message || "Could not join the team");
    },
    onSuccess: refresh,
  });

  const leaveTeam = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await teamRpc.rpc("leave_challenge_team", {
        p_team_id: teamId,
      });
      if (error) throw new Error(error.message || "Could not leave the team");
    },
    onSuccess: refresh,
  });

  return { ...query, createTeam, joinTeam, leaveTeam };
}
