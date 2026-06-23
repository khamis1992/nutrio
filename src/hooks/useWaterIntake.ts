import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface WaterIntake {
  id: string;
  log_date: string;
  glasses: number;
}

interface DailyWaterSummary {
  total: number;
  target: number;
  percentage: number;
  logs: WaterIntake[];
}

async function fetchWaterIntake(userId: string): Promise<DailyWaterSummary> {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: logs, error } = await supabase
    .from("water_intake")
    .select("id, log_date, glasses")
    .eq("user_id", userId)
    .eq("log_date", today);

  if (error) throw error;

  const total = (logs || []).reduce((sum, log) => sum + (log.glasses || 0), 0);
  const target = 8;

  return {
    total,
    target,
    percentage: Math.min(100, Math.round((total / target) * 100)),
    logs: logs || [],
  };
}

export function useWaterIntake(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["waterIntake", userId];

  const { data: dailySummary = null, isLoading: loading, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchWaterIntake(userId!),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const addWater = async (glasses: number) => {
    if (!userId) return;

    try {
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: existing } = await supabase
        .from("water_intake")
        .select("id, glasses")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("water_intake")
          .update({ glasses: existing.glasses + glasses })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("water_intake")
          .insert({ user_id: userId, log_date: today, glasses });
      }

      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      console.error("Error adding water intake:", error);
    }
  };

  const removeWater = async (id: string) => {
    if (!userId) return;

    try {
      await supabase
        .from("water_intake")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      console.error("Error removing water intake:", error);
    }
  };

  const decrementWater = async () => {
    if (!userId) return;

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: existing } = await supabase
        .from("water_intake")
        .select("id, glasses")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (existing && existing.glasses > 0) {
        await supabase
          .from("water_intake")
          .update({ glasses: Math.max(0, existing.glasses - 1) })
          .eq("id", existing.id);

        await queryClient.invalidateQueries({ queryKey });
      }
    } catch (error) {
      console.error("Error decrementing water intake:", error);
    }
  };

  return {
    dailySummary,
    loading,
    addWater,
    removeWater,
    decrementWater,
    refresh: refetch,
  };
}
