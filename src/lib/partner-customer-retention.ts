import { supabase } from "@/integrations/supabase/client";

export interface PartnerCustomerRetentionStatus {
  userId: string;
  subscriptionStatus: string | null;
  planType: string | null;
  tier: string | null;
  remainingMeals: number | null;
  rolloverCredits: number;
  activeFreeze: {
    id: string;
    startDate: string;
    endDate: string;
    days: number;
    status: string;
  } | null;
}

interface SubscriptionRow {
  user_id: string;
  status: string | null;
  plan: string | null;
  tier: string | null;
  meals_per_month: number | null;
  meals_used_this_month: number | null;
  rollover_credits: number | null;
}

interface FreezeRow {
  id: string;
  user_id: string;
  freeze_start_date: string;
  freeze_end_date: string;
  freeze_days: number;
  status: string;
}

export async function fetchPartnerCustomerRetentionStatuses(
  userIds: string[],
): Promise<Record<string, PartnerCustomerRetentionStatus>> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return {};

  const today = new Date().toISOString().slice(0, 10);

  const [subscriptionResult, freezeResult] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("user_id, status, plan, tier, meals_per_month, meals_used_this_month, rollover_credits")
      .in("user_id", uniqueUserIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("subscription_freezes")
      .select("id, user_id, freeze_start_date, freeze_end_date, freeze_days, status")
      .in("user_id", uniqueUserIds)
      .in("status", ["scheduled", "active"])
      .gte("freeze_end_date", today)
      .order("freeze_start_date", { ascending: true }),
  ]);

  if (subscriptionResult.error) throw subscriptionResult.error;
  if (freezeResult.error) throw freezeResult.error;

  const statuses: Record<string, PartnerCustomerRetentionStatus> = Object.fromEntries(
    uniqueUserIds.map((userId) => [
      userId,
      {
        userId,
        subscriptionStatus: null,
        planType: null,
        tier: null,
        remainingMeals: null,
        rolloverCredits: 0,
        activeFreeze: null,
      } satisfies PartnerCustomerRetentionStatus,
    ]),
  );

  for (const subscription of (subscriptionResult.data || []) as SubscriptionRow[]) {
    const current = statuses[subscription.user_id];
    if (!current || current.subscriptionStatus) continue;
    current.subscriptionStatus = subscription.status;
    current.planType = subscription.plan;
    current.tier = subscription.tier;
    current.remainingMeals = typeof subscription.meals_per_month === "number"
      ? Math.max(0, subscription.meals_per_month - (subscription.meals_used_this_month ?? 0))
      : null;
    current.rolloverCredits = subscription.rollover_credits ?? 0;
  }

  for (const freeze of (freezeResult.data || []) as FreezeRow[]) {
    const current = statuses[freeze.user_id];
    if (!current || current.activeFreeze) continue;
    current.activeFreeze = {
      id: freeze.id,
      startDate: freeze.freeze_start_date,
      endDate: freeze.freeze_end_date,
      days: freeze.freeze_days,
      status: freeze.status,
    };
  }

  return statuses;
}
