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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantId) {
      checkPremiumStatus();
    }
  }, [restaurantId]);

  const checkPremiumStatus = async () => {
    if (!restaurantId) return;

    try {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("premium_analytics_until")
        .eq("id", restaurantId)
        .single();

      if (restaurant?.premium_analytics_until) {
        const until = new Date(restaurant.premium_analytics_until);
        if (until > new Date()) {
          setHasPremium(true);
          setPremiumUntil(until);
        } else {
          setHasPremium(false);
          setPremiumUntil(null);
        }
      }
    } catch (error) {
      console.error("Error checking premium status:", error);
    } finally {
      setLoading(false);
    }
  };

  return { hasPremium, premiumUntil, loading, refetch: checkPremiumStatus };
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
        .single();

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
