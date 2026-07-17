import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { SocialLeagueData } from "@/lib/social-leagues";

type SocialLeagueRpcClient = typeof supabase & {
  rpc(fn: "get_my_social_league"): Promise<{
    data: SocialLeagueData | null;
    error: { message?: string } | null;
  }>;
};

const socialLeagueRpc = supabase as SocialLeagueRpcClient;

export function useSocialLeague(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["social-league", userId],
    queryFn: async () => {
      const { data, error } = await socialLeagueRpc.rpc("get_my_social_league");
      if (error) throw error;
      if (!data) throw new Error("League data is unavailable");
      return data;
    },
    enabled: Boolean(userId) && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
