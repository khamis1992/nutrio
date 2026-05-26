import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getQatarNow, getQatarDay } from "@/lib/dateUtils";

export interface MealReminder {
  mealType: "breakfast" | "lunch" | "dinner";
  label: string;
  pastDue: boolean;
}

const MEAL_DEADLINES: { type: MealReminder["mealType"]; hour: number; labelKey: string }[] = [
  { type: "breakfast", hour: 9, labelKey: "meal_breakfast" },
  { type: "lunch", hour: 13, labelKey: "meal_lunch" },
  { type: "dinner", hour: 19, labelKey: "meal_dinner" },
];

export function useMealReminders(userId: string | undefined) {
  const [pendingReminder, setPendingReminder] = useState<MealReminder | null>(null);
  const [loading, setLoading] = useState(true);

  const checkReminders = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      setPendingReminder(null);
      return;
    }

    try {
      const now = getQatarNow();
      const currentHour = now.getHours();
      const todayStr = getQatarDay();

      const { data: progress, error } = await supabase
        .from("progress_logs")
        .select("created_at, calories_consumed")
        .eq("user_id", userId)
        .eq("log_date", todayStr)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const hasLoggedToday = progress && progress.length > 0 &&
        progress.some((p) => (p.calories_consumed || 0) > 0);

      if (hasLoggedToday) {
        setPendingReminder(null);
        setLoading(false);
        return;
      }

      for (const deadline of MEAL_DEADLINES) {
        if (currentHour >= deadline.hour) {
          const pastDue = currentHour >= deadline.hour + 2;
          setPendingReminder({
            mealType: deadline.type,
            label: deadline.labelKey,
            pastDue,
          });
          setLoading(false);
          return;
        }
      }

      setPendingReminder(null);
    } catch (err) {
      console.error("useMealReminders error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkReminders();
  }, [checkReminders]);

  useEffect(() => {
    const interval = setInterval(checkReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  const dismissReminder = useCallback(() => {
    setPendingReminder(null);
  }, []);

  return {
    pendingReminder,
    loading,
    refresh: checkReminders,
    dismissReminder,
    hasReminder: pendingReminder !== null,
  };
}
