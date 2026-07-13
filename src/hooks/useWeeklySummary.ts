import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, subDays } from "date-fns";

interface WeekComparison {
  thisWeekAvg: number;
  lastWeekAvg: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
}

interface ConsistencyData {
  daysLogged: number;
  totalDays: number;
  percentage: number;
  streak: number;
  bestStreak: number;
}

interface MacroAdherence {
  protein: { consumed: number; target: number; percentage: number };
  carbs: { consumed: number; target: number; percentage: number };
  fat: { consumed: number; target: number; percentage: number };
}

interface WeeklySummary {
  calories: WeekComparison;
  weight?: {
    current: number;
    change: number;
    trend: "up" | "down" | "stable";
  };
  consistency: ConsistencyData;
  macros: MacroAdherence;
}

async function fetchWeeklySummary(userId: string): Promise<WeeklySummary> {
  const today = new Date();
  const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const lastWeekStart = subDays(thisWeekStart, 7);
  const lastWeekEnd = subDays(thisWeekEnd, 7);

  const [thisWeekResult, lastWeekResult, goalsResult, streakResult] = await Promise.all([
    supabase
      .from("progress_logs")
      .select("log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, weight_kg")
      .eq("user_id", userId)
      .gte("log_date", format(thisWeekStart, "yyyy-MM-dd"))
      .lte("log_date", format(thisWeekEnd, "yyyy-MM-dd")),
    supabase
      .from("progress_logs")
      .select("log_date, calories_consumed")
      .eq("user_id", userId)
      .gte("log_date", format(lastWeekStart, "yyyy-MM-dd"))
      .lte("log_date", format(lastWeekEnd, "yyyy-MM-dd")),
    supabase
      .from("nutrition_goals")
      .select("protein_target_g, carbs_target_g, fat_target_g, daily_calorie_target")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("user_streaks")
      .select("current_streak, best_streak")
      .eq("user_id", userId)
      .eq("streak_type", "logging")
      .maybeSingle(),
  ]);

  if (thisWeekResult.error) throw thisWeekResult.error;
  if (lastWeekResult.error) throw lastWeekResult.error;
  if (goalsResult.error) throw goalsResult.error;
  if (streakResult.error) throw streakResult.error;

  const thisWeekData = thisWeekResult.data;
  const lastWeekData = lastWeekResult.data;
  const goals = goalsResult.data;
  const streakData = streakResult.data;

  const thisWeekLogs = thisWeekData || [];
  const lastWeekLogs = lastWeekData || [];

  const thisWeekAvg = thisWeekLogs.length > 0
    ? thisWeekLogs.reduce((sum, log) => sum + (log.calories_consumed || 0), 0) / thisWeekLogs.length
    : 0;

  const lastWeekAvg = lastWeekLogs.length > 0
    ? lastWeekLogs.reduce((sum, log) => sum + (log.calories_consumed || 0), 0) / lastWeekLogs.length
    : 0;

  const change = thisWeekAvg - lastWeekAvg;
  const changePercent = lastWeekAvg > 0 ? (change / lastWeekAvg) * 100 : 0;

  const avgProtein = thisWeekLogs.length > 0
    ? thisWeekLogs.reduce((sum, log) => sum + (log.protein_consumed_g || 0), 0) / thisWeekLogs.length
    : 0;
  const avgCarbs = thisWeekLogs.length > 0
    ? thisWeekLogs.reduce((sum, log) => sum + (log.carbs_consumed_g || 0), 0) / thisWeekLogs.length
    : 0;
  const avgFat = thisWeekLogs.length > 0
    ? thisWeekLogs.reduce((sum, log) => sum + (log.fat_consumed_g || 0), 0) / thisWeekLogs.length
    : 0;

  const weightLogs = thisWeekLogs.filter(log => log.weight_kg);
  const latestWeight = weightLogs.length > 0
    ? weightLogs[weightLogs.length - 1].weight_kg
    : null;

  const totalDays = 7;
  const daysLogged = new Set(thisWeekLogs.map(log => log.log_date)).size;

  return {
    calories: {
      thisWeekAvg: Math.round(thisWeekAvg),
      lastWeekAvg: Math.round(lastWeekAvg),
      change: Math.round(change),
      changePercent: Math.round(changePercent * 10) / 10,
      trend: change > 50 ? "up" : change < -50 ? "down" : "stable",
    },
    weight: latestWeight ? {
      current: latestWeight,
      change: 0,
      trend: "stable" as const,
    } : undefined,
    consistency: {
      daysLogged,
      totalDays,
      percentage: Math.round((daysLogged / totalDays) * 100),
      streak: streakData?.current_streak || 0,
      bestStreak: streakData?.best_streak || 0,
    },
    macros: {
      protein: {
        consumed: Math.round(avgProtein),
        target: goals?.protein_target_g || 0,
        percentage: goals?.protein_target_g
          ? Math.min(100, Math.round((avgProtein / goals.protein_target_g) * 100))
          : 0,
      },
      carbs: {
        consumed: Math.round(avgCarbs),
        target: goals?.carbs_target_g || 0,
        percentage: goals?.carbs_target_g
          ? Math.min(100, Math.round((avgCarbs / goals.carbs_target_g) * 100))
          : 0,
      },
      fat: {
        consumed: Math.round(avgFat),
        target: goals?.fat_target_g || 0,
        percentage: goals?.fat_target_g
          ? Math.min(100, Math.round((avgFat / goals.fat_target_g) * 100))
          : 0,
      },
    },
  };
}

export function useWeeklySummary(userId: string | undefined) {
  const { data: summary = null, isLoading: loading, error, refetch } = useQuery({
    queryKey: ["weeklySummary", userId],
    queryFn: () => fetchWeeklySummary(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  return { summary, loading, error, refresh: refetch };
}
