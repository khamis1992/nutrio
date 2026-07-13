import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface FriendLeaderboardEntry {
  friend_user_id: string;
  friend_name: string;
  friend_avatar: string | null;
  current_streak: number;
  xp: number;
  level: number;
  total_meals_logged: number;
  nutrition_score: number;
  composite_score: number;
}

type FriendLeaderboardRpcClient = typeof supabase & {
  rpc(
    fn: "get_friend_leaderboard",
    args: { p_user_id: string },
  ): Promise<{
    data: FriendLeaderboardEntry[] | null;
    error: { message?: string } | null;
  }>;
};

const leaderboardRpc = supabase as FriendLeaderboardRpcClient;

export function useFriendLeaderboard(userId: string | undefined) {
  return useQuery({
    queryKey: ["friend_leaderboard", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await leaderboardRpc.rpc("get_friend_leaderboard", {
        p_user_id: userId,
      });
      if (error) throw error;

      return data || [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
