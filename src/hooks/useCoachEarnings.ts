import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCoachAvailableBalance } from "@/lib/payouts";

export interface CoachEarning {
  id: string;
  coach_id: string;
  client_id: string;
  subscription_id: string | null;
  amount: number;
  commission_pct: number;
  commission_amount: number;
  net_amount: number;
  transaction_type: "subscription" | "renewal" | "refund" | "bonus";
  status: "pending" | "settled" | "refunded";
  settled_at: string | null;
  created_at: string;
}

export interface CoachEarningsSummary {
  totalEarned: number;
  pendingAmount: number;
  settledAmount: number;
  availableToWithdraw: number;
  thisMonthEarned: number;
}

const earningTypes: CoachEarning["transaction_type"][] = ["subscription", "renewal", "refund", "bonus"];
const earningStatuses: CoachEarning["status"][] = ["pending", "settled", "refunded"];

const normalizeEarning = (earning: {
  id: string; coach_id: string; client_id: string; subscription_id: string | null;
  amount: number; commission_pct: number; commission_amount: number; net_amount: number;
  transaction_type: string; status: string; settled_at: string | null; created_at: string;
}): CoachEarning => ({
  ...earning,
  transaction_type: earningTypes.includes(earning.transaction_type as CoachEarning["transaction_type"])
    ? earning.transaction_type as CoachEarning["transaction_type"]
    : "subscription",
  status: earningStatuses.includes(earning.status as CoachEarning["status"])
    ? earning.status as CoachEarning["status"]
    : "pending",
});

interface ClientSubscription {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  plan: string;
  price: number;
  status: string;
  startDate: string;
}

export function useCoachEarnings(coachId: string | undefined) {
  const [earnings, setEarnings] = useState<CoachEarning[]>([]);
  const [summary, setSummary] = useState<CoachEarningsSummary>({
    totalEarned: 0, pendingAmount: 0, settledAmount: 0, availableToWithdraw: 0, thisMonthEarned: 0,
  });
  const [subscriptions, setSubscriptions] = useState<ClientSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionPct, setCommissionPct] = useState(20);

  const fetchEarnings = useCallback(async () => {
    if (!coachId) { setLoading(false); return; }
    try {
      const [earningsResult, subscriptionsResult, configResult, availableToWithdraw] = await Promise.all([
        supabase.from("coach_earnings").select("*").eq("coach_id", coachId).order("created_at", { ascending: false }),
        supabase.from("coach_subscriptions").select("id, client_id, plan, price, status, start_date").eq("coach_id", coachId).order("created_at", { ascending: false }),
        supabase.from("platform_commission_config").select("commission_pct").single(),
        getCoachAvailableBalance(coachId),
      ]);

      if (earningsResult.error) throw earningsResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (configResult.error) throw configResult.error;

      const earningsData = earningsResult.data;
      const subsData = subscriptionsResult.data;
      const configData = configResult.data;

      setEarnings((earningsData ?? []).map(normalizeEarning));
      if (configData) setCommissionPct(configData.commission_pct);

      // Calculate summary
      const totalEarned = (earningsData || []).reduce((s, e) => s + Number(e.amount), 0);
      const settledAmount = (earningsData || []).filter(e => e.status === "settled").reduce((s, e) => s + Number(e.net_amount), 0);
      const pendingAmount = (earningsData || []).filter(e => e.status === "pending").reduce((s, e) => s + Number(e.net_amount), 0);
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const thisMonthEarned = (earningsData || []).filter(e => e.created_at >= thisMonthStart).reduce((s, e) => s + Number(e.net_amount), 0);

      setSummary({
        totalEarned,
        pendingAmount,
        settledAmount,
        availableToWithdraw,
        thisMonthEarned,
      });

      // Map subscriptions with client names
      if (subsData?.length) {
        const clientIds = [...new Set(subsData.map(s => s.client_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", clientIds);
        const profileMap = new Map(
          (profiles || []).map((profile) => [profile.user_id, profile]),
        );
        setSubscriptions(
          subsData.map(s => ({
            id: s.id,
            clientId: s.client_id,
            clientName: profileMap.get(s.client_id)?.full_name || "Client",
            clientAvatar: profileMap.get(s.client_id)?.avatar_url || null,
            plan: s.plan,
            price: Number(s.price),
            status: s.status,
            startDate: s.start_date,
          }))
        );
      } else {
        setSubscriptions([]);
      }
    } catch (err) {
      console.error("Error fetching coach earnings:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  return { earnings, summary, subscriptions, loading, commissionPct, refresh: fetchEarnings };
}
