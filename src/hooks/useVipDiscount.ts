import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

interface VipSettings {
  vip_discount_percent: number;
  vip_benefits: {
    meal_discounts: boolean;
  };
}

const defaultVipSettings: VipSettings = {
  vip_discount_percent: 15,
  vip_benefits: {
    meal_discounts: true,
  },
};

export function useVipDiscount() {
  const { isVip } = useSubscription();
  const [vipSettings, setVipSettings] = useState<VipSettings>(defaultVipSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "vip_settings")
          .maybeSingle();

        if (error) throw error;

        if (data?.value) {
          const value = data.value as Record<string, unknown>;
          setVipSettings({
            vip_discount_percent: (value.vip_discount_percent as number) || defaultVipSettings.vip_discount_percent,
            vip_benefits: {
              meal_discounts: value.vip_benefits && typeof value.vip_benefits === 'object' 
                ? Boolean((value.vip_benefits as Record<string, unknown>).meal_discounts ?? true)
                : true,
            },
          });
        }
      } catch (err) {
        console.error("Error fetching VIP settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const discountPercent = isVip && vipSettings.vip_benefits.meal_discounts 
    ? vipSettings.vip_discount_percent 
    : 0;

  const calculateDiscountedPrice = (originalPrice: number): { 
    originalPrice: number; 
    discountedPrice: number; 
    hasDiscount: boolean;
    discountPercent: number;
  } => {
    const hasDiscount = discountPercent > 0;
    const discountedPrice = hasDiscount 
      ? originalPrice * (1 - discountPercent / 100) 
      : originalPrice;

    return {
      originalPrice,
      discountedPrice: Math.round(discountedPrice * 100) / 100,
      hasDiscount,
      discountPercent,
    };
  };

  return {
    isVip,
    discountPercent,
    calculateDiscountedPrice,
    loading,
  };
}
