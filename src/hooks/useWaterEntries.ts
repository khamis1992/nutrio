import { useState, useCallback } from "react";
import { addWaterEntry, deleteWaterEntry, fetchWaterEntriesForDate, fetchWaterMonthTotals } from "@/lib/water-service";
import { useHealthTrackingGoals } from "@/hooks/useHealthTrackingGoals";

export interface WaterEntry {
  id: string;
  log_date: string;
  amount_ml: number;
  created_at: string;
}

const normalizeWaterEntry = (entry: Omit<WaterEntry, "created_at"> & { created_at: string | null }): WaterEntry => ({
  ...entry,
  created_at: entry.created_at ?? "",
});

export function useWaterEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const {
    goals,
    loading: goalsLoading,
    updateGoals,
  } = useHealthTrackingGoals(userId);
  const goalMl = goals.waterGoalMl;

  const setGoalMl = useCallback(async (ml: number) => {
    await updateGoals({ waterGoalMl: ml });
  }, [updateGoals]);

  const fetchEntries = useCallback(async (date: string) => {
    if (!userId) return;

    try {
      setEntriesLoading(true);
      const data = await fetchWaterEntriesForDate(userId, date);
      setEntries((data ?? []).map(normalizeWaterEntry));
    } catch (err) {
      console.error("Error fetching water entries:", err);
    } finally {
      setEntriesLoading(false);
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

    const data = await addWaterEntry(userId, date, amountMl);
    setEntries((prev) => [normalizeWaterEntry(data), ...prev]);

    return normalizeWaterEntry(data);
  }, [userId]);

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
    loading: entriesLoading || goalsLoading,
    fetchEntries,
    fetchMonthTotals,
    addEntry,
    deleteEntry,
  };
}
