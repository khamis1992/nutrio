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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantId) {
      checkPremiumStatus();
    }
  }, [restaurantId]);

  const checkPremiumStatus = async () => {
    if (!restaurantId) return;

    try {
      // Check premium_analytics_until on the restaurant row
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
        } else {
          setHasPremium(false);
          setPremiumUntil(null);
        }
      }

      // Check for a pending purchase — table may not exist yet if migration not applied
      const pendingRes = await supabase
        .from("premium_analytics_purchases")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .limit(1);

      if (!pendingRes.error) {
        setHasPendingRequest((pendingRes.data?.length ?? 0) > 0);
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
