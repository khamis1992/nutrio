import { useState, useEffect, useCallback } from "react";
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

export function useWaterIntake(userId: string | undefined) {
  const [dailySummary, setDailySummary] = useState<DailyWaterSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTodayIntake = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch today's water intake logs
      const { data: logs, error } = await (supabase as any)
        .from("water_intake")
        .select("id, log_date, glasses")
        .eq("user_id", userId)
        .eq("log_date", today);

      if (error) throw error;

      // Calculate total glasses
      const total = (logs || []).reduce((sum: number, log: WaterIntake) => sum + (log.glasses || 0), 0);

      // Default target: 8 glasses per day
      const target = 8;
      const percentage = Math.min(100, Math.round((total / target) * 100));

      setDailySummary({
        total,
        target,
        percentage,
        logs: logs || [],
      });
    } catch (error) {
      console.error("Error fetching water intake:", error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addWater = useCallback(async (glasses: number) => {
    if (!userId) return;

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      // Check if entry exists for today
      const { data: existing } = await (supabase as any)
        .from("water_intake")
        .select("id, glasses")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (existing) {
        // Update existing
        await (supabase as any)
          .from("water_intake")
          .update({ glasses: existing.glasses + glasses })
          .eq("id", existing.id);
      } else {
        // Insert new
        await (supabase as any)
          .from("water_intake")
          .insert({
            user_id: userId,
            log_date: today,
            glasses: glasses,
          });
      }

      await fetchTodayIntake();
    } catch (error) {
      console.error("Error adding water intake:", error);
    }
  }, [userId, fetchTodayIntake]);

  const removeWater = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      await (supabase as any)
        .from("water_intake")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      await fetchTodayIntake();
    } catch (error) {
      console.error("Error removing water intake:", error);
    }
  }, [userId, fetchTodayIntake]);

  const decrementWater = useCallback(async () => {
    if (!userId) return;

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: existing } = await (supabase as any)
        .from("water_intake")
        .select("id, glasses")
        .eq("user_id", userId)
        .eq("log_date", today)
        .maybeSingle();

      if (existing && existing.glasses > 0) {
        await (supabase as any)
          .from("water_intake")
          .update({ glasses: Math.max(0, existing.glasses - 1) })
          .eq("id", existing.id);
        await fetchTodayIntake();
      }
    } catch (error) {
      console.error("Error decrementing water intake:", error);
    }
  }, [userId, fetchTodayIntake]);

  useEffect(() => {
    fetchTodayIntake();
  }, [fetchTodayIntake]);

  return {
    dailySummary,
    loading,
    addWater,
    removeWater,
    decrementWater,
    refresh: fetchTodayIntake,
  };
}
