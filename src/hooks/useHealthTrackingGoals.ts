import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_WATER_GOAL_ML = 2500;
export const DEFAULT_STEP_GOAL = 6000;

export interface HealthTrackingGoals {
  waterGoalMl: number;
  stepGoal: number;
}

interface HealthTrackingGoalRow {
  water_goal_ml?: number | null;
  step_goal?: number | null;
}

const defaults: HealthTrackingGoals = {
  waterGoalMl: DEFAULT_WATER_GOAL_ML,
  stepGoal: DEFAULT_STEP_GOAL,
};

function normalizeGoals(data: unknown): HealthTrackingGoals {
  const row = (Array.isArray(data) ? data[0] : data) as HealthTrackingGoalRow | null;
  const waterGoalMl = Number(row?.water_goal_ml);
  const stepGoal = Number(row?.step_goal);

  return {
    waterGoalMl: Number.isFinite(waterGoalMl) && waterGoalMl >= 1000
      ? waterGoalMl
      : defaults.waterGoalMl,
    stepGoal: Number.isFinite(stepGoal) && stepGoal >= 1000
      ? stepGoal
      : defaults.stepGoal,
  };
}

export function useHealthTrackingGoals(userId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ["healthTrackingGoals", userId];

  const query = useQuery({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_own_health_tracking_goals" as never,
      );
      if (error) throw error;
      return normalizeGoals(data);
    },
  });

  const mutation = useMutation({
    mutationFn: async (updates: { waterGoalMl?: number; stepGoal?: number }) => {
      if (!userId) throw new Error("AUTHENTICATION_REQUIRED");
      const { data, error } = await supabase.rpc(
        "set_own_health_tracking_goals" as never,
        {
          p_water_goal_ml: updates.waterGoalMl ?? null,
          p_step_goal: updates.stepGoal ?? null,
        } as never,
      );
      if (error) throw error;
      return normalizeGoals(data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    goals: query.data ?? defaults,
    loading: Boolean(userId) && query.isLoading,
    error: query.error,
    updateGoals: mutation.mutateAsync,
    updating: mutation.isPending,
    refresh: query.refetch,
  };
}
