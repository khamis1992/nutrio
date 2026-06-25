import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  addWaterEntry,
  deleteWaterEntry,
  fetchTodayWaterEntries,
  summarizeWaterMl,
  updateWaterEntryAmount,
  WATER_GLASS_ML,
} from "@/lib/water-service";
import { supabase } from "@/integrations/supabase/client";

interface WaterIntake {
  id: string;
  log_date: string;
  glasses: number;
  amount_ml: number;
  created_at: string;
}

interface DailyWaterSummary {
  total: number;
  target: number;
  totalMl: number;
  targetMl: number;
  percentage: number;
  logs: WaterIntake[];
}

async function fetchWaterIntake(userId: string): Promise<DailyWaterSummary> {
  const logs = await fetchTodayWaterEntries(userId);
  const totalMl = logs.reduce((sum, log) => sum + (log.amount_ml || 0), 0);
  const summary = summarizeWaterMl(totalMl);

  return {
    total: summary.glasses,
    target: summary.targetGlasses,
    totalMl: summary.totalMl,
    targetMl: summary.goalMl,
    percentage: summary.percentage,
    logs: logs.map((log) => ({
      id: log.id,
      log_date: log.log_date,
      amount_ml: log.amount_ml,
      created_at: log.created_at,
      glasses: Number(((log.amount_ml || 0) / WATER_GLASS_ML).toFixed(1)),
    })),
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
      const amountMl = Math.max(0, Math.round(glasses * WATER_GLASS_ML));
      if (amountMl <= 0) return;
      await addWaterEntry(userId, today, amountMl);

      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      console.error("Error adding water intake:", error);
    }
  };

  const removeWater = async (id: string) => {
    if (!userId) return;

    try {
      await deleteWaterEntry(userId, id);

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
        .from("water_entries")
        .select("id, amount_ml, created_at")
        .eq("user_id", userId)
        .eq("log_date", today)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing && existing.amount_ml > 0) {
        const nextMl = Math.max(0, existing.amount_ml - WATER_GLASS_ML);
        if (nextMl === 0) {
          await deleteWaterEntry(userId, existing.id);
        } else {
          await updateWaterEntryAmount(userId, existing.id, nextMl);
        }

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
