import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface TodayProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

async function fetchTodayProgress(userId: string, selectedDate: Date): Promise<TodayProgress> {
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("progress_logs")
    .select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
    .eq("user_id", userId)
    .eq("log_date", dateStr)
    .maybeSingle();

  if (error) throw error;

  const values = {
    calories: data?.calories_consumed || 0,
    protein: data?.protein_consumed_g || 0,
    carbs: data?.carbs_consumed_g || 0,
    fat: data?.fat_consumed_g || 0,
  };

  return values;
}

export function useTodayProgress(userId: string | undefined, selectedDate: Date, _progressKey: number) {
  const enabled = !!userId;
  
  const { data: todayProgress = { calories: 0, protein: 0, carbs: 0, fat: 0 }, error, isLoading: loading } = useQuery({
    queryKey: ["todayProgress", userId, format(selectedDate, "yyyy-MM-dd")],
    queryFn: () => fetchTodayProgress(userId!, selectedDate),
    enabled,
    staleTime: 60 * 1000,
  });

  return { todayProgress, error, loading };
}
