import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getQatarDay } from "@/lib/dateUtils";
import { normalizeDailyPerformanceDecision } from "@/lib/daily-performance";

type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcCall = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
const rpc: RpcCall = (name, args) => (supabase as unknown as { rpc: RpcCall }).rpc(name, args);

export function useDailyPerformanceDecision(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const date = getQatarDay();
  const isCoachView = Boolean(clientId);
  const subjectId = clientId ?? user?.id;
  const queryKey = ["daily-performance-decision", subjectId ?? "anonymous", date] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(user?.id && subjectId),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const result = isCoachView
        ? await rpc("get_client_daily_performance_decision", {
          p_client_id: clientId,
          p_decision_date: date,
        })
        : await rpc("get_my_daily_performance_decision", { p_decision_date: date });
      if (result.error) throw new Error(result.error.message || "Could not load today's performance decision");
      return normalizeDailyPerformanceDecision(result.data);
    },
  });

  const setRecommendedMeal = useMutation({
    mutationFn: async (mealId: string) => {
      if (isCoachView) return;
      const result = await rpc("set_my_daily_performance_meal", {
        p_decision_date: date,
        p_meal_id: mealId,
      });
      if (result.error) throw new Error(result.error.message || "Could not save the recommended meal");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, setRecommendedMeal, date };
}
