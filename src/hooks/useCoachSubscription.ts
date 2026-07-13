import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";

interface CoachPricingInfo {
  coachId: string;
  coachName: string;
  coachAvatar: string | null;
  pricePerWeek: number;
  pricePerMonth: number;
  currency: string;
  isActive: boolean;
}

interface ExistingSubscription {
  id: string;
  plan: string;
  status: string;
  price: number;
  endDate: string;
}

export function useCoachSubscription(clientId: string | undefined, coachId: string | undefined) {
  const [pricing, setPricing] = useState<CoachPricingInfo | null>(null);
  const [existingSub, setExistingSub] = useState<ExistingSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPricing = useCallback(async () => {
    if (!coachId) { setLoading(false); return; }
    try {
      const [pricingResult, profileResult, subResult] = await Promise.all([
        supabase.from("coach_pricing").select("*").eq("coach_id", coachId).maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", coachId).single(),
        clientId
          ? supabase
              .from("coach_subscriptions")
              .select("*")
              .eq("coach_id", coachId)
              .eq("client_id", clientId)
              .in("status", ["active", "cancelled"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (pricingResult.data?.is_active) {
        setPricing({
          coachId,
          coachName: profileResult.data?.full_name || "Coach",
          coachAvatar: profileResult.data?.avatar_url || null,
          pricePerWeek: Number(pricingResult.data.price_per_week),
          pricePerMonth: Number(pricingResult.data.price_per_month),
          currency: pricingResult.data.currency || "QAR",
          isActive: pricingResult.data.is_active,
        });
      }
      if (subResult.data) {
        setExistingSub({
          id: subResult.data.id,
          plan: subResult.data.plan,
          status: subResult.data.status,
          price: Number(subResult.data.price),
          endDate: subResult.data.end_date,
        });
      }
    } catch (err) {
      console.error("Error fetching coach pricing:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId, clientId]);

  const cancelSubscription = async () => {
    if (!existingSub) return { success: false, error: new Error("Subscription not found") };
    try {
      const { error } = await supabase.rpc(
        "cancel_coach_subscription" as never,
        { p_subscription_id: existingSub.id } as never,
      );
      if (error) throw error;

      setExistingSub((prev) => prev ? { ...prev, status: "cancelled" } : null);
      if (clientId) {
        await syncCommunityChallengeProgressQuietly(clientId);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  };

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  return { pricing, existingSub, loading, cancelSubscription };
}
