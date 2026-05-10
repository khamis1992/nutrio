import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PremiumAnalyticsPrices {
  monthly: number;
  quarterly: number;
  yearly: number;
}

const defaultPrices: PremiumAnalyticsPrices = {
  monthly: 29.99,
  quarterly: 74.99,
  yearly: 249.99,
};

export function usePremiumAnalytics(restaurantId: string | null) {
  const [hasPremium, setHasPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<Date | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  // Start as false when no restaurantId yet — avoids permanent skeleton
  const [loading, setLoading] = useState(!!restaurantId);

  useEffect(() => {
    if (restaurantId) {
      setLoading(true);
      checkPremiumStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const checkPremiumStatus = async () => {
    if (!restaurantId) return;

    try {
      // Primary check: active purchase row (works even without premium_analytics_until column)
      const purchasesRes = await supabase
        .from("premium_analytics_purchases")
        .select("id, status, ends_at")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!purchasesRes.error && purchasesRes.data) {
        const activePurchase = purchasesRes.data.find(
          (p) => p.status === "active" && new Date(p.ends_at) > new Date()
        );
        const pendingPurchase = purchasesRes.data.find((p) => p.status === "pending");

        if (activePurchase) {
          setHasPremium(true);
          setPremiumUntil(new Date(activePurchase.ends_at));
          setHasPendingRequest(false);
          setLoading(false);
          return;
        }

        setHasPendingRequest(!!pendingPurchase);
      }

      // Fallback: also check premium_analytics_until column if it exists
      const restaurantRes = await supabase
        .from("restaurants")
        .select("premium_analytics_until")
        .eq("id", restaurantId)
        .maybeSingle();

      if (!restaurantRes.error && restaurantRes.data?.premium_analytics_until) {
        const until = new Date(restaurantRes.data.premium_analytics_until);
        if (until > new Date()) {
          setHasPremium(true);
          setPremiumUntil(until);
        }
      }
    } catch (error) {
      console.error("Error checking premium status:", error);
    } finally {
      setLoading(false);
    }
  };

  return { hasPremium, premiumUntil, hasPendingRequest, loading, refetch: checkPremiumStatus };
}

export function usePremiumAnalyticsPrices() {
  const [prices, setPrices] = useState<PremiumAnalyticsPrices>(defaultPrices);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "premium_analytics_prices")
        .maybeSingle();

      if (data?.value && typeof data.value === 'object' && !Array.isArray(data.value)) {
        const value = data.value as Record<string, unknown>;
        if ('monthly' in value && 'quarterly' in value && 'yearly' in value) {
          setPrices({
            monthly: Number(value.monthly) || defaultPrices.monthly,
            quarterly: Number(value.quarterly) || defaultPrices.quarterly,
            yearly: Number(value.yearly) || defaultPrices.yearly,
          });
        }
      }
    } catch (error) {
      console.error("Error fetching prices:", error);
    } finally {
      setLoading(false);
    }
  };

  return { prices, loading };
}
