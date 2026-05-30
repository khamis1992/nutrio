import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addDays } from "date-fns";

export interface DayEntry {
  date: string;
  dayLabel: string;
  calories: number;
  protein: number;
  waterGlasses: number;
  hasWorkout: boolean;
}

export function useWeekdayData(userId: string | undefined, calorieTarget: number) {
  const [days, setDays] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date();
      const mon = startOfWeek(today, { weekStartsOn: 1 });
      const sun = endOfWeek(today, { weekStartsOn: 1 });

      const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      const [{ data: logs }, { data: water }, { data: workouts }] = await Promise.all([
        supabase
          .from("progress_logs")
          .select("log_date, calories_consumed, protein_consumed_g")
          .eq("user_id", userId)
          .gte("log_date", format(mon, "yyyy-MM-dd"))
          .lte("log_date", format(sun, "yyyy-MM-dd"))
          .order("log_date"),
        supabase
          .from("water_intake")
          .select("log_date, glasses")
          .eq("user_id", userId)
          .gte("log_date", format(mon, "yyyy-MM-dd"))
          .lte("log_date", format(sun, "yyyy-MM-dd")),
        supabase
          .from("workout_sessions")
          .select("completed_at")
          .eq("user_id", userId)
          .gte("completed_at", format(mon, "yyyy-MM-dd"))
          .lte("completed_at", format(sun, "yyyy-MM-dd") + "T23:59:59"),
      ]);

      const waterByDate = new Map<string, number>();
      for (const w of water ?? []) {
        waterByDate.set(w.log_date, (waterByDate.get(w.log_date) ?? 0) + (w.glasses ?? 0));
      }

      const logByDate = new Map<string, { cal: number; prot: number }>();
      for (const l of logs ?? []) {
        logByDate.set(l.log_date, {
          cal: (l.calories_consumed ?? 0),
          prot: (l.protein_consumed_g ?? 0),
        });
      }

      const workoutDates = new Set((workouts ?? []).map((w) => w.completed_at?.split("T")[0]));

      const result: DayEntry[] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(mon, i);
        const dateStr = format(d, "yyyy-MM-dd");
        const calLog = logByDate.get(dateStr);
        result.push({
          date: dateStr,
          dayLabel: dayLabels[i],
          calories: calLog?.cal ?? 0,
          protein: calLog?.prot ?? 0,
          waterGlasses: waterByDate.get(dateStr) ?? 0,
          hasWorkout: workoutDates.has(dateStr),
        });
      }

      setDays(result);
    } catch (err) {
      console.error("useWeekdayData error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, calorieTarget]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { days, loading, refresh: fetch };
}
