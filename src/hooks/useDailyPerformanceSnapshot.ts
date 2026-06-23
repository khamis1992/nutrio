import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { NutritionMatchedMeal, NutritionPerformanceResult } from "@/lib/nutrition-performance";

type AwardXpRpcClient = typeof supabase & {
  rpc(
    fn: "award_xp",
    args: {
      p_user_id: string;
      p_xp_amount: number;
      p_reason?: string;
      p_action_type?: string;
      p_source_id?: string;
      p_metadata?: Record<string, unknown>;
    },
  ): Promise<{ data: unknown; error: unknown }>;
};

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

function buildAwards(input: DailyPerformanceSnapshotInput) {
  const today = format(new Date(), "yyyy-MM-dd");
  const awards: Array<{ actionType: string; sourceId: string; xp: number; reason: string }> = [];

  if (input.performance.score >= 85) {
    awards.push({
      actionType: "nutrition_fuel_score",
      sourceId: `fuel-score-${today}`,
      xp: 25,
      reason: "Strong daily fuel score",
    });
  }

  if (input.proteinTarget > 0 && input.proteinConsumed >= input.proteinTarget) {
    awards.push({
      actionType: "protein_target_day",
      sourceId: `protein-target-${today}`,
      xp: 20,
      reason: "Protein target reached",
    });
  }

  if (input.waterPercent >= 100) {
    awards.push({
      actionType: "hydration_target_day",
      sourceId: `hydration-target-${today}`,
      xp: 15,
      reason: "Hydration target reached",
    });
  }

  return awards;
}

export function useDailyPerformanceSnapshot(input: DailyPerformanceSnapshotInput) {
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!input.userId) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const key = [
      input.userId,
      today,
      input.performance.score,
      input.readinessScore ?? "none",
      input.bodyLoad,
      input.caloriesConsumed,
      input.proteinConsumed,
      input.waterPercent,
      input.mealsLogged,
      input.matchedMeal?.id ?? "none",
    ].join(":");

    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    let cancelled = false;

    async function syncSnapshot() {
      const awards = buildAwards(input);

      const { error } = await supabase
        .from("daily_performance_snapshots" as never)
        .upsert({
          user_id: input.userId,
          snapshot_date: today,
          nutrition_score: input.performance.score,
          readiness_score: input.readinessScore,
          body_load: input.bodyLoad,
          calories_consumed: Math.round(input.caloriesConsumed),
          calorie_target: Math.round(input.calorieTarget),
          protein_consumed_g: Math.round(input.proteinConsumed),
          protein_target_g: Math.round(input.proteinTarget),
          water_percent: Math.round(input.waterPercent),
          meals_logged: input.mealsLogged,
          recommended_meal_id: input.matchedMeal?.id ?? null,
          primary_reason: input.performance.primaryReason,
          reasons: input.performance.reasons,
          awards,
          updated_at: new Date().toISOString(),
        } as never, { onConflict: "user_id,snapshot_date" });

      if (error) {
        console.warn("Failed to sync daily performance snapshot:", error.message);
        return;
      }

      if (cancelled) return;

      const xpRpc = supabase as AwardXpRpcClient;
      await Promise.all(awards.map((award) => xpRpc.rpc("award_xp", {
        p_user_id: input.userId!,
        p_xp_amount: award.xp,
        p_reason: award.reason,
        p_action_type: award.actionType,
        p_source_id: award.sourceId,
        p_metadata: {
          nutrition_score: input.performance.score,
          readiness_score: input.readinessScore,
          body_load: input.bodyLoad,
        },
      })));
    }

    syncSnapshot();

    return () => {
      cancelled = true;
    };
  }, [input]);
}

export function DailyPerformanceSnapshotSync(props: DailyPerformanceSnapshotProps) {
  useDailyPerformanceSnapshot(props);
  return null;
}
