import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  normalizeCoachPerformanceDirective,
  type CoachPerformanceDirectiveInput,
} from "@/lib/daily-performance";

type RpcResult = { data: unknown; error: { message?: string } | null };
type RpcCall = (name: string, args?: Record<string, unknown>) => PromiseLike<RpcResult>;
const rpc: RpcCall = (name, args) => (supabase as unknown as { rpc: RpcCall }).rpc(name, args);

export function useCoachPerformanceDirective(clientId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["coach-performance-directive", user?.id ?? "anonymous", clientId ?? "none"] as const;

  const query = useQuery({
    queryKey,
    enabled: Boolean(user?.id && clientId),
    staleTime: 60_000,
    queryFn: async () => {
      const result = await rpc("get_coach_performance_directive", { p_client_id: clientId });
      if (result.error) throw new Error(result.error.message || "Could not load the performance directive");
      return normalizeCoachPerformanceDirective(result.data);
    },
  });

  const save = useMutation({
    mutationFn: async (input: CoachPerformanceDirectiveInput) => {
      const result = await rpc("upsert_coach_performance_directive", {
        p_client_id: input.client_id,
        p_directive_id: input.id ?? null,
        p_message: input.message,
        p_calorie_min: input.calorie_min,
        p_calorie_max: input.calorie_max,
        p_protein_min_g: input.protein_min_g,
        p_carbs_target_g: input.carbs_target_g,
        p_hydration_min_ml: input.hydration_min_ml,
        p_carb_focus: input.carb_focus,
        p_workout_intensity_cap: input.workout_intensity_cap,
        p_excluded_meal_types: input.excluded_meal_types,
        p_priority: input.priority,
        p_valid_from: input.valid_from,
        p_valid_until: input.valid_until,
      });
      if (result.error) throw new Error(result.error.message || "Could not save the performance directive");
      return normalizeCoachPerformanceDirective(result.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["daily-performance-decision", clientId] });
    },
  });

  const archive = useMutation({
    mutationFn: async (directiveId: string) => {
      const result = await rpc("archive_coach_performance_directive", { p_directive_id: directiveId });
      if (result.error) throw new Error(result.error.message || "Could not archive the performance directive");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["daily-performance-decision", clientId] });
    },
  });

  return { ...query, save, archive };
}
