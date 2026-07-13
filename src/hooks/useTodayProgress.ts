import { useQuery } from "@tanstack/react-query";
import { fromZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { getQatarDay, QATAR_TIMEZONE } from "@/lib/dateUtils";

interface TodayProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  mealsLogged: number;
}

async function fetchTodayProgress(userId: string, selectedDate: Date): Promise<TodayProgress> {
  const dateStr = getQatarDay(selectedDate);
  const start = fromZonedTime(`${dateStr}T00:00:00`, QATAR_TIMEZONE);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [progressResult, mealHistoryResult] = await Promise.all([
    supabase
      .from("progress_logs")
      .select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g, fiber_consumed_g")
      .eq("user_id", userId)
      .eq("log_date", dateStr)
      .maybeSingle(),
    supabase
      .from("meal_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("logged_at", start.toISOString())
      .lt("logged_at", end.toISOString()),
  ]);

  if (progressResult.error) throw progressResult.error;
  if (mealHistoryResult.error) throw mealHistoryResult.error;

  const values = {
    calories: progressResult.data?.calories_consumed || 0,
    protein: progressResult.data?.protein_consumed_g || 0,
    carbs: progressResult.data?.carbs_consumed_g || 0,
    fat: progressResult.data?.fat_consumed_g || 0,
    fiber: progressResult.data?.fiber_consumed_g || 0,
    mealsLogged: mealHistoryResult.count ?? 0,
  };

  return values;
}

export function useTodayProgress(userId: string | undefined, selectedDate: Date, progressKey: number) {
  const enabled = !!userId;
  const dateKey = getQatarDay(selectedDate);
  
  const { data: todayProgress = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, mealsLogged: 0 }, error, isLoading: loading } = useQuery({
    queryKey: ["todayProgress", userId, dateKey, progressKey],
    queryFn: () => fetchTodayProgress(userId!, selectedDate),
    enabled,
    staleTime: 60 * 1000,
  });

  return { todayProgress, error, loading };
}
