import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { withRetry } from "@/lib/retry";

interface TodayProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function useTodayProgress(userId: string | undefined, selectedDate: Date, progressKey: number) {
  const [todayProgress, setTodayProgress] = useState<TodayProgress>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const fetchTodayProgress = async () => {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await withRetry(async () => {
          const result = await supabase
            .from("progress_logs")
            .select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
            .eq("user_id", userId)
            .eq("log_date", dateStr)
            .maybeSingle();
          if (result.error) throw result.error;
          return result;
        }, { maxAttempts: 2, delayMs: 500 });

        if (cancelled) return;

        if (fetchError) {
          throw fetchError;
        }

        if (!data) {
          setTodayProgress({ calories: 0, protein: 0, carbs: 0, fat: 0 });
          return;
        }

        setTodayProgress({
          calories: data.calories_consumed || 0,
          protein: data.protein_consumed_g || 0,
          carbs: data.carbs_consumed_g || 0,
          fat: data.fat_consumed_g || 0,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching progress:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTodayProgress();
    return () => { cancelled = true; };
  }, [userId, progressKey, selectedDate]);

  return { todayProgress, setTodayProgress, error, loading };
}
