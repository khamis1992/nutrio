import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addWaterEntry, deleteWaterEntry, fetchWaterEntriesForDate, fetchWaterMonthTotals } from "@/lib/water-service";

export interface WaterEntry {
  id: string;
  log_date: string;
  amount_ml: number;
  created_at: string;
}

const DEFAULT_GOAL_ML = 2500;
const GOAL_STORAGE_KEY = "water_goal_ml";

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

const xpRpc = supabase as AwardXpRpcClient;

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
      const data = await fetchWaterEntriesForDate(userId, date);
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
      try {
        return fetchWaterMonthTotals(userId, year, month);
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

    const previousTotal = entries
      .filter((entry) => entry.log_date === date)
      .reduce((sum, entry) => sum + entry.amount_ml, 0);

    const data = await addWaterEntry(userId, date, amountMl);
    setEntries((prev) => [data, ...prev]);

    const nextTotal = previousTotal + amountMl;
    if (previousTotal < goalMl && nextTotal >= goalMl) {
      try {
        await xpRpc.rpc("award_xp", {
          p_user_id: userId,
          p_xp_amount: 15,
          p_reason: "Daily water goal reached",
          p_action_type: "water_goal",
          p_source_id: date,
          p_metadata: { goal_ml: goalMl, total_ml: nextTotal },
        });
      } catch (xpError) {
        console.warn("Failed to award water goal XP:", xpError);
      }
    }

    return data;
  }, [entries, goalMl, userId]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      await deleteWaterEntry(userId, id);

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
