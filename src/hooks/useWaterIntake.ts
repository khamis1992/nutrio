import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addWaterEntry,
  deleteWaterEntry,
  fetchWaterEntriesForDate,
  summarizeWaterMl,
  updateWaterEntryAmount,
  WATER_GLASS_ML,
} from "@/lib/water-service";
import { supabase } from "@/integrations/supabase/client";
import { getQatarDay } from "@/lib/dateUtils";
import { useHealthTrackingGoals } from "@/hooks/useHealthTrackingGoals";

interface WaterIntake {
  id: string;
  log_date: string;
  glasses: number;
  amount_ml: number;
  created_at: string | null;
}

interface DailyWaterSummary {
  total: number;
  target: number;
  totalMl: number;
  targetMl: number;
  percentage: number;
  logs: WaterIntake[];
}

async function fetchWaterIntake(userId: string, dateKey: string, goalMl: number): Promise<DailyWaterSummary> {
  const logs = await fetchWaterEntriesForDate(userId, dateKey);
  const totalMl = logs.reduce((sum, log) => sum + (log.amount_ml || 0), 0);
  const summary = summarizeWaterMl(totalMl, goalMl);

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

export function useWaterIntake(userId: string | undefined, selectedDate: Date = new Date()) {
  const queryClient = useQueryClient();
  const { goals, loading: goalsLoading, error: goalsError } = useHealthTrackingGoals(userId);
  const dateKey = getQatarDay(selectedDate);
  const queryKey = ["waterIntake", userId, dateKey, goals.waterGoalMl];

  const { data: dailySummary = null, isLoading: loading, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchWaterIntake(userId!, dateKey, goals.waterGoalMl),
    enabled: Boolean(userId) && !goalsLoading && !goalsError,
    staleTime: 60 * 1000,
  });

  const addWater = async (glasses: number) => {
    if (!userId) return;

    try {
      const amountMl = Math.max(0, Math.round(glasses * WATER_GLASS_ML));
      if (amountMl <= 0) return;
      await addWaterEntry(userId, dateKey, amountMl);

      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      console.error("Error adding water intake:", error);
      throw error;
    }
  };

  const removeWater = async (id: string) => {
    if (!userId) return;

    try {
      await deleteWaterEntry(userId, id);

      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      console.error("Error removing water intake:", error);
      throw error;
    }
  };

  const decrementWater = async () => {
    if (!userId) return false;

    try {
      const { data: existing, error } = await supabase
        .from("water_entries")
        .select("id, amount_ml, created_at")
        .eq("user_id", userId)
        .eq("log_date", dateKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (existing && existing.amount_ml > 0) {
        const nextMl = Math.max(0, existing.amount_ml - WATER_GLASS_ML);
        if (nextMl === 0) {
          await deleteWaterEntry(userId, existing.id);
        } else {
          await updateWaterEntryAmount(userId, existing.id, nextMl);
        }

        await queryClient.invalidateQueries({ queryKey });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error decrementing water intake:", error);
      return false;
    }
  };

  return {
    dailySummary,
    loading: loading || goalsLoading,
    error: error ?? goalsError,
    addWater,
    removeWater,
    decrementWater,
    refresh: refetch,
  };
}
