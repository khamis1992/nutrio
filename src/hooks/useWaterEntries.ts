import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface WaterEntry {
  id: string;
  log_date: string;
  amount_ml: number;
  created_at: string;
}

const DEFAULT_GOAL_ML = 2500;
const GOAL_STORAGE_KEY = "water_goal_ml";

export function useWaterEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalMl, setGoalMlState] = useState(DEFAULT_GOAL_ML);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(GOAL_STORAGE_KEY);
      setGoalMlState(stored ? parseInt(stored, 10) : DEFAULT_GOAL_ML);
    }
  }, []);

  const setGoalMl = useCallback((ml: number) => {
    setGoalMlState(ml);
    if (typeof window !== "undefined") {
      localStorage.setItem(GOAL_STORAGE_KEY, String(ml));
    }
  }, []);

  const fetchEntries = useCallback(async (date: string) => {
    if (!userId) return;

    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("water_entries")
        .select("id, log_date, amount_ml, created_at")
        .eq("user_id", userId)
        .eq("log_date", date)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Error fetching water entries:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchMonthTotals = useCallback(
    async (year: number, month: number): Promise<Record<string, number>> => {
      if (!userId) return {};
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      try {
        const { data, error } = await (supabase as any)
          .from("water_entries")
          .select("log_date, amount_ml")
          .eq("user_id", userId)
          .gte("log_date", start)
          .lte("log_date", end);

        if (error) throw error;
        const totals: Record<string, number> = {};
        for (const row of data || []) {
          totals[row.log_date] = (totals[row.log_date] || 0) + row.amount_ml;
        }
        return totals;
      } catch (err) {
        console.error("Error fetching month totals:", err);
        return {};
      }
    },
    [userId]
  );

  const addEntry = useCallback(async (date: string, amountMl: number) => {
    if (!userId) {
      throw new Error("You must be signed in to log water");
    }
    if (amountMl <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    const { data, error } = await (supabase as any)
      .from("water_entries")
      .insert({
        user_id: userId,
        log_date: date,
        amount_ml: amountMl,
      })
      .select("id, log_date, amount_ml, created_at")
      .single();

    if (error) {
      console.error("Error adding water entry:", error);
      throw error;
    }
    setEntries((prev) => [data, ...prev]);
    return data;
  }, [userId]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      await (supabase as any)
        .from("water_entries")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error("Error deleting water entry:", err);
      throw err;
    }
  }, [userId]);

  const totalMl = entries.reduce((sum, e) => sum + e.amount_ml, 0);
  const percentage = goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;

  return {
    entries,
    totalMl,
    goalMl,
    setGoalMl,
    percentage,
    loading,
    fetchEntries,
    fetchMonthTotals,
    addEntry,
    deleteEntry,
  };
}
