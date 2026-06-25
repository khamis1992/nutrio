import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";

export const WATER_GLASS_ML = 250;
export const DEFAULT_WATER_GOAL_ML = 2500;

export interface WaterEntrySummary {
  totalMl: number;
  goalMl: number;
  glasses: number;
  targetGlasses: number;
  percentage: number;
}

export function summarizeWaterMl(totalMl: number, goalMl = DEFAULT_WATER_GOAL_ML): WaterEntrySummary {
  const safeGoal = goalMl > 0 ? goalMl : DEFAULT_WATER_GOAL_ML;
  return {
    totalMl,
    goalMl: safeGoal,
    glasses: Number((totalMl / WATER_GLASS_ML).toFixed(1)),
    targetGlasses: Number((safeGoal / WATER_GLASS_ML).toFixed(1)),
    percentage: Math.min(100, Math.round((totalMl / safeGoal) * 100)),
  };
}

export async function fetchWaterEntriesForRange(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("water_entries")
    .select("id, log_date, amount_ml, created_at")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchWaterEntriesForDate(userId: string, date: string) {
  return fetchWaterEntriesForRange(userId, date, date);
}

export async function fetchTodayWaterEntries(userId: string) {
  const today = format(new Date(), "yyyy-MM-dd");
  return fetchWaterEntriesForDate(userId, today);
}

export async function fetchWaterMonthTotals(userId: string, year: number, month: number): Promise<Record<string, number>> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const rows = await fetchWaterEntriesForRange(userId, start, end);

  return rows.reduce<Record<string, number>>((totals, row) => {
    totals[row.log_date] = (totals[row.log_date] || 0) + (row.amount_ml || 0);
    return totals;
  }, {});
}

export async function addWaterEntry(userId: string, date: string, amountMl: number) {
  const { data, error } = await supabase
    .from("water_entries")
    .insert({
      user_id: userId,
      log_date: date,
      amount_ml: amountMl,
    })
    .select("id, log_date, amount_ml, created_at")
    .single();

  if (error) throw error;
  await syncCommunityChallengeProgressQuietly(userId);
  return data;
}

export async function updateWaterEntryAmount(userId: string, id: string, amountMl: number) {
  const { error } = await supabase
    .from("water_entries")
    .update({ amount_ml: amountMl })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
  await syncCommunityChallengeProgressQuietly(userId);
}

export async function deleteWaterEntry(userId: string, id: string) {
  const { error } = await supabase
    .from("water_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
  await syncCommunityChallengeProgressQuietly(userId);
}
