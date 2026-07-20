import { supabase } from "@/integrations/supabase/client";
import type {
  FreezeRequest,
  FreezeRequestResult,
  SubscriptionFreeze,
} from "@/types/retention";

function normalizeFreeze(row: Record<string, unknown>): SubscriptionFreeze {
  return {
    ...(row as unknown as SubscriptionFreeze),
    status: (row.status as SubscriptionFreeze["status"]) || "scheduled",
  };
}

export async function fetchSubscriptionFreezes(subscriptionId: string): Promise<SubscriptionFreeze[]> {
  const { data, error } = await supabase
    .from("subscription_freezes")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => normalizeFreeze(row));
}

export async function fetchAllSubscriptionFreezes(): Promise<SubscriptionFreeze[]> {
  const { data, error } = await supabase
    .from("subscription_freezes")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => normalizeFreeze(row));
}

export async function fetchActiveFreezes(subscriptionId: string): Promise<SubscriptionFreeze[]> {
  const { data, error } = await supabase
    .from("subscription_freezes")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .in("status", ["scheduled", "active"])
    .order("freeze_start_date", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => normalizeFreeze(row));
}

export async function fetchUserFreezes(userId: string): Promise<SubscriptionFreeze[]> {
  const { data, error } = await supabase
    .from("subscription_freezes")
    .select("*")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => normalizeFreeze(row));
}

export async function fetchFreezeDaysRemaining(subscriptionId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("freeze_days_used")
    .eq("id", subscriptionId)
    .single();

  if (error) throw error;

  const used = data?.freeze_days_used || 0;
  return { used, remaining: Math.max(0, 7 - used), total: 7 };
}

export async function requestSubscriptionFreeze(input: FreezeRequest): Promise<FreezeRequestResult> {
  const { data, error } = await supabase.functions.invoke("handle-freeze-request", {
    body: input,
  });

  if (error) throw error;
  return data as FreezeRequestResult;
}

export async function cancelSubscriptionFreeze(freezeId: string, reason = "User cancelled"): Promise<void> {
  const { data, error } = await supabase.rpc("cancel_subscription_freeze", {
    p_freeze_id: freezeId,
    p_reason: reason,
  });

  if (error) throw error;

  const result = data as { success?: boolean; error?: string } | null;
  if (!result?.success) throw new Error(result?.error || "Freeze cancellation failed");
}
