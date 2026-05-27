import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  const [subscribing, setSubscribing] = useState(false);

  const fetchPricing = useCallback(async () => {
    if (!coachId) { setLoading(false); return; }
    try {
      const [pricingResult, profileResult, subResult] = await Promise.all([
        supabase.from("coach_pricing").select("*").eq("coach_id", coachId).maybeSingle(),
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", coachId).single(),
        clientId ? supabase.from("coach_subscriptions").select("*").eq("coach_id", coachId).eq("client_id", clientId).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      if (pricingResult.data) {
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

  const subscribe = async (plan: "weekly" | "monthly", paymentMethod: string = "wallet") => {
    if (!clientId || !coachId || !pricing) return { success: false, error: new Error("Missing data") };
    setSubscribing(true);
    try {
      const price = plan === "weekly" ? pricing.pricePerWeek : pricing.pricePerMonth;
      const now = new Date();
      const endDate = new Date(now);
      if (plan === "weekly") endDate.setDate(endDate.getDate() + 7);
      else endDate.setMonth(endDate.getMonth() + 1);

      const { data, error } = await supabase.from("coach_subscriptions").insert({
        coach_id: coachId,
        client_id: clientId,
        plan,
        price,
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        payment_method: paymentMethod,
      }).select().single();

      if (error) throw error;

      setExistingSub({
        id: data.id,
        plan: data.plan,
        status: data.status,
        price: Number(data.price),
        endDate: data.end_date,
      });

      return { success: true, error: null, data };
    } catch (err) {
      return { success: false, error: err as Error };
    } finally {
      setSubscribing(false);
    }
  };

  const cancelSubscription = async () => {
    if (!existingSub) return;
    try {
      await supabase.from("coach_subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", existingSub.id);
      setExistingSub((prev) => prev ? { ...prev, status: "cancelled" } : null);
      return { success: true };
    } catch (err) {
      return { success: false, error: err as Error };
    }
  };

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  return { pricing, existingSub, loading, subscribing, subscribe, cancelSubscription };
}
