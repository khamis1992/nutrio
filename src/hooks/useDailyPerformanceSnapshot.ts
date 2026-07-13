import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getQatarDay } from "@/lib/dateUtils";
import type { NutritionMatchedMeal, NutritionPerformanceResult } from "@/lib/nutrition-performance";

interface DailyPerformanceSnapshotInput {
  userId?: string;
  performance: NutritionPerformanceResult;
  matchedMeal: NutritionMatchedMeal | null;
  readinessScore: number | null;
  bodyLoad: number;
  caloriesConsumed: number;
  calorieTarget: number;
  proteinConsumed: number;
  proteinTarget: number;
  waterPercent: number;
  mealsLogged: number;
}

export type DailyPerformanceSnapshotProps = DailyPerformanceSnapshotInput;

export function useDailyPerformanceSnapshot(input: DailyPerformanceSnapshotInput) {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!input.userId) return;

    const today = getQatarDay();
    const key = [
      input.userId,
      today,
      input.bodyLoad,
      input.caloriesConsumed,
      input.proteinConsumed,
      input.waterPercent,
      input.mealsLogged,
      input.matchedMeal?.id ?? "none",
    ].join(":");

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    async function syncSnapshot() {
      const { error } = await supabase.rpc(
        "refresh_daily_performance_snapshot" as never,
        { p_snapshot_date: today } as never,
      );

      if (error) {
        if (lastKeyRef.current === key) {
          lastKeyRef.current = null;
        }
        console.warn("Failed to sync daily performance snapshot:", error);
      }
    }

    void syncSnapshot();
  }, [input]);
}

export function DailyPerformanceSnapshotSync(props: DailyPerformanceSnapshotProps) {
  useDailyPerformanceSnapshot(props);
  return null;
}
