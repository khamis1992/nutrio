import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, subWeeks, format } from "date-fns";

interface WeeklyDataPoint {
  weekLabel: string;
  weekStart: string;
  avgProtein: number;
  avgCalories: number;
  avgCarbs: number;
  avgFat: number;
  muscleMassChange: number | null;
  bodyFatChange: number | null;
  latestMuscleMass: number | null;
  latestBodyFat: number | null;
}

interface CorrelationResult {
  dataPoints: WeeklyDataPoint[];
  proteinGroups: {
    high: { count: number; avgMuscleChange: number | null; avgFatChange: number | null; avgProtein: number };
    low: { count: number; avgMuscleChange: number | null; avgFatChange: number | null; avgProtein: number };
  };
  hasData: boolean;
  topInsight: string | null;
}

export function useBodyMetricsCorrelation(userId: string | undefined) {
  const [correlation, setCorrelation] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const weeks = 6;
    const today = new Date();

    try {
      const weekRequests = Array.from({ length: weeks }, (_, i) => {
        const base = subWeeks(today, i);
        return {
          weekStart: format(startOfWeek(base, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          weekEnd: format(endOfWeek(base, { weekStartsOn: 1 }), "yyyy-MM-dd"),
          label: format(startOfWeek(base, { weekStartsOn: 1 }), "MMM d"),
        };
      });

      const [{ data: logs }, { data: metrics }] = await Promise.all([
        supabase
          .from("progress_logs")
          .select("log_date, protein_consumed_g, calories_consumed, carbs_consumed_g, fat_consumed_g")
          .eq("user_id", userId)
          .gte("log_date", weekRequests[weeks - 1].weekStart)
          .lte("log_date", weekRequests[0].weekEnd),
        supabase
          .from("body_measurements")
          .select("log_date, muscle_mass_percent, body_fat_percent, weight_kg")
          .eq("user_id", userId)
          .gte("log_date", format(subWeeks(today, weeks + 1), "yyyy-MM-dd"))
          .order("log_date", { ascending: false }),
      ]);

      const weekData: WeeklyDataPoint[] = weekRequests.map((w) => {
        const weekLogs = (logs || []).filter(
          (l) => l.log_date >= w.weekStart && l.log_date <= w.weekEnd
        );
        const n = weekLogs.length || 1;
        const avgProtein = weekLogs.reduce((s, l) => s + (l.protein_consumed_g || 0), 0) / n;
        const avgCalories = weekLogs.reduce((s, l) => s + (l.calories_consumed || 0), 0) / n;
        const avgCarbs = weekLogs.reduce((s, l) => s + (l.carbs_consumed_g || 0), 0) / n;
        const avgFat = weekLogs.reduce((s, l) => s + (l.fat_consumed_g || 0), 0) / n;

        const weekMetrics = (metrics || []).filter(
          (m) => m.log_date >= w.weekStart && m.log_date <= w.weekEnd
        );

        const latestMetric = weekMetrics[0];

        return {
          weekLabel: w.label,
          weekStart: w.weekStart,
          avgProtein: Math.round(avgProtein),
          avgCalories: Math.round(avgCalories),
          avgCarbs: Math.round(avgCarbs),
          avgFat: Math.round(avgFat),
          muscleMassChange: null,
          bodyFatChange: null,
          latestMuscleMass: latestMetric?.muscle_mass_percent ?? null,
          latestBodyFat: latestMetric?.body_fat_percent ?? null,
        };
      });

      for (let i = 0; i < weekData.length - 1; i++) {
        const currentWeek = weekData[i];
        const previousWeek = weekData[i + 1];
        if (currentWeek.latestMuscleMass != null && previousWeek.latestMuscleMass != null) {
          currentWeek.muscleMassChange =
            currentWeek.latestMuscleMass - previousWeek.latestMuscleMass;
        }
        if (currentWeek.latestBodyFat != null && previousWeek.latestBodyFat != null) {
          currentWeek.bodyFatChange =
            currentWeek.latestBodyFat - previousWeek.latestBodyFat;
        }
      }

      const withProtein = weekData.filter((w) => w.avgProtein > 0);
      if (withProtein.length < 2) {
        setCorrelation({ dataPoints: [], proteinGroups: { high: { count: 0, avgMuscleChange: null, avgFatChange: null, avgProtein: 0 }, low: { count: 0, avgMuscleChange: null, avgFatChange: null, avgProtein: 0 } }, hasData: false, topInsight: null });
        setLoading(false);
        return;
      }

      const median = withProtein.map((w) => w.avgProtein).sort((a, b) => a - b)[Math.floor(withProtein.length / 2)];

      const highProteinWeeks = withProtein.filter((week) => week.avgProtein >= median);
      const lowProteinWeeks = withProtein.filter((week) => week.avgProtein < median);
      const highWeeks = highProteinWeeks.filter((week) => week.muscleMassChange != null);
      const lowWeeks = lowProteinWeeks.filter((week) => week.muscleMassChange != null);

      const highAvgMuscle = highWeeks.length > 0
        ? highWeeks.reduce((sum, week) => sum + (week.muscleMassChange ?? 0), 0) / highWeeks.length
        : null;
      const lowAvgMuscle = lowWeeks.length > 0
        ? lowWeeks.reduce((sum, week) => sum + (week.muscleMassChange ?? 0), 0) / lowWeeks.length
        : null;

      const highAvgProtein = highProteinWeeks.reduce((sum, week) => sum + week.avgProtein, 0) / highProteinWeeks.length;
      const lowAvgProtein = lowProteinWeeks.reduce((sum, week) => sum + week.avgProtein, 0) / (lowProteinWeeks.length || 1);

      let topInsight: string | null = null;
      if (highAvgMuscle != null && lowAvgMuscle != null && highWeeks.length >= 1 && lowWeeks.length >= 1) {
        const diff = highAvgMuscle - lowAvgMuscle;
        const direction = diff > 0 ? "gained" : diff < 0 ? "lost" : "maintained";

        if (diff !== 0 && Math.abs(diff) >= 0.05) {
          topInsight = `In weeks with +${Math.round(highAvgProtein)}g protein, you ${direction} ${Math.abs(diff).toFixed(1)}% more muscle mass vs weeks at ${Math.round(lowAvgProtein)}g`;
        } else if (highAvgMuscle > 0 && lowAvgMuscle <= 0) {
          topInsight = `High-protein weeks (${Math.round(highAvgProtein)}g) maintained muscle mass while lower-protein weeks saw decline`;
        }
      }

      setCorrelation({
        dataPoints: weekData.reverse(),
        proteinGroups: {
          high: {
            count: highWeeks.length,
            avgMuscleChange: highAvgMuscle,
            avgFatChange: null,
            avgProtein: Math.round(highAvgProtein),
          },
          low: {
            count: lowWeeks.length,
            avgMuscleChange: lowAvgMuscle,
            avgFatChange: null,
            avgProtein: Math.round(lowAvgProtein),
          },
        },
        hasData: withProtein.length >= 2,
        topInsight,
      });
    } catch (err) {
      console.error("Correlation computation error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    compute();
  }, [compute]);

  return { correlation, loading, refetch: compute };
}
