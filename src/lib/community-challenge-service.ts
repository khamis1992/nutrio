import { supabase } from "@/integrations/supabase/client";

type ActiveChallenge = {
  id: string;
  challenge_type: string | null;
  start_date: string;
  end_date: string;
  target_value: number;
  is_joined: boolean;
  user_progress: number | null;
};

const WATER_CHALLENGE_GOAL_ML = 2500;
const DEFAULT_PROTEIN_TARGET_G = 120;

const toDateTimeStart = (date: string) => `${date}T00:00:00`;
const toDateTimeEnd = (date: string) => `${date}T23:59:59`;

async function fetchJoinedChallenges(userId: string): Promise<ActiveChallenge[]> {
  const { data, error } = await supabase.rpc("get_active_challenges", {
    p_user_id: userId,
  });

  if (error) throw error;

  return ((data ?? []) as ActiveChallenge[]).filter((challenge) => challenge.is_joined);
}

async function countLoggedMeals(userId: string, startDate: string, endDate: string) {
  const { count, error } = await supabase
    .from("meal_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("logged_at", toDateTimeStart(startDate))
    .lte("logged_at", toDateTimeEnd(endDate));

  if (error) throw error;
  return count ?? 0;
}

async function countLoggedMealDays(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("progress_logs")
    .select("log_date, calories_consumed")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate);

  if (error) throw error;

  return new Set((data ?? []).filter((row) => (row.calories_consumed ?? 0) > 0).map((row) => row.log_date)).size;
}

async function fetchProteinTarget(userId: string) {
  const { data, error } = await supabase
    .from("nutrition_goals")
    .select("protein_target_g")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data?.protein_target_g && data.protein_target_g > 0 ? data.protein_target_g : DEFAULT_PROTEIN_TARGET_G;
}

async function countProteinTargetDays(userId: string, startDate: string, endDate: string) {
  const target = await fetchProteinTarget(userId);
  const { data, error } = await supabase
    .from("progress_logs")
    .select("log_date, protein_consumed_g")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate);

  if (error) throw error;

  return new Set((data ?? []).filter((row) => (row.protein_consumed_g ?? 0) >= target).map((row) => row.log_date)).size;
}

async function countHydrationTargetDays(userId: string, startDate: string, endDate: string) {
  const { data, error } = await supabase
    .from("water_entries")
    .select("log_date, amount_ml")
    .eq("user_id", userId)
    .gte("log_date", startDate)
    .lte("log_date", endDate);

  if (error) throw error;

  const totalsByDay = (data ?? []).reduce<Record<string, number>>((totals, row) => {
    totals[row.log_date] = (totals[row.log_date] ?? 0) + (row.amount_ml ?? 0);
    return totals;
  }, {});

  return Object.values(totalsByDay).filter((totalMl) => totalMl >= WATER_CHALLENGE_GOAL_ML).length;
}

async function calculateChallengeProgress(userId: string, challenge: ActiveChallenge) {
  const type = (challenge.challenge_type ?? "").toLowerCase();

  if (type === "meals" || type === "meal_logging") {
    return countLoggedMeals(userId, challenge.start_date, challenge.end_date);
  }

  if (type === "streak") {
    return countLoggedMealDays(userId, challenge.start_date, challenge.end_date);
  }

  if (type === "protein" || type === "nutrition") {
    return countProteinTargetDays(userId, challenge.start_date, challenge.end_date);
  }

  if (type === "water" || type === "hydration") {
    return countHydrationTargetDays(userId, challenge.start_date, challenge.end_date);
  }

  return challenge.user_progress ?? 0;
}

export async function syncCommunityChallengeProgress(userId: string) {
  const challenges = await fetchJoinedChallenges(userId);
  const results = [];

  for (const challenge of challenges) {
    const progress = await calculateChallengeProgress(userId, challenge);
    const { data, error } = await supabase.rpc("update_challenge_progress", {
      p_challenge_id: challenge.id,
      p_user_id: userId,
      p_progress: Math.max(0, Math.round(progress)),
    });

    if (error) throw error;
    results.push({ challengeId: challenge.id, progress, result: data });
  }

  return results;
}

export async function syncCommunityChallengeProgressQuietly(userId: string) {
  try {
    await syncCommunityChallengeProgress(userId);
  } catch (error) {
    console.warn("Failed to sync community challenge progress:", error);
  }
}
