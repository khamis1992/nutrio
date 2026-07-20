import { supabase } from "@/integrations/supabase/client";
import { getQatarDay } from "@/lib/dateUtils";
import type { RolloverInfo, RolloverRecord, RolloverStats } from "@/types/retention";

export async function fetchActiveRolloverRecords(subscriptionId: string): Promise<RolloverRecord[]> {
  const today = getQatarDay();
  const { data, error } = await supabase
    .from("subscription_rollovers")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .eq("status", "active")
    .eq("is_consumed", false)
    .gt("rollover_credits", 0)
    .gte("expiry_date", today)
    .order("expiry_date", { ascending: true });

  if (error) throw error;
  return (data || []) as RolloverRecord[];
}

export async function fetchRolloverHistory(subscriptionId: string): Promise<RolloverRecord[]> {
  const { data, error } = await supabase
    .from("subscription_rollovers")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as RolloverRecord[];
}

export async function fetchRolloverCredits(subscriptionId: string): Promise<RolloverInfo> {
  const [{ data: subscription, error: subscriptionError }, activeRollovers] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("meals_per_month, meals_used_this_month, rollover_credits")
      .eq("id", subscriptionId)
      .single(),
    fetchActiveRolloverRecords(subscriptionId),
  ]);

  if (subscriptionError) throw subscriptionError;

  const activeRolloverCredits = activeRollovers.reduce(
    (sum, rollover) => sum + (rollover.rollover_credits || 0),
    0,
  );
  const rolloverCredits = activeRolloverCredits || subscription?.rollover_credits || 0;
  const totalCredits = Math.max(
    0,
    (subscription?.meals_per_month || 0) - (subscription?.meals_used_this_month || 0) + rolloverCredits,
  );

  return {
    rollover_credits: rolloverCredits,
    expiry_date: activeRollovers[0]?.expiry_date ?? null,
    total_credits: totalCredits,
    new_credits: Math.max(0, totalCredits - rolloverCredits),
  };
}

export async function fetchRolloverStats(subscriptionId: string): Promise<RolloverStats> {
  const history = await fetchRolloverHistory(subscriptionId);
  const consumed = history.filter((rollover) => rollover.is_consumed || rollover.status === "consumed");
  const expired = history.filter((rollover) => rollover.status === "expired");
  const totalCreditsRolled = history.reduce((sum, rollover) => sum + rollover.rollover_credits, 0);
  const totalCreditsConsumed = consumed.reduce((sum, rollover) => sum + rollover.rollover_credits, 0);

  return {
    totalRollovers: history.length,
    consumedRollovers: consumed.length,
    expiredRollovers: expired.length,
    utilizationRate: history.length > 0 ? Math.round((consumed.length / history.length) * 100) : 0,
    totalCreditsRolled,
    totalCreditsConsumed,
  };
}

export async function calculateRolloverCredits(subscriptionId: string, userId: string) {
  const { data, error } = await supabase.rpc("calculate_rollover_credits", {
    p_subscription_id: subscriptionId,
    p_user_id: userId,
  });

  if (error) throw error;
  return data;
}
