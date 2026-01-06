import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeliveryFeeSettings {
  standard: number;
  express: number;
  free_threshold: number;
  enabled: boolean;
}

const defaultSettings: DeliveryFeeSettings = {
  standard: 3.99,
  express: 6.99,
  free_threshold: 50,
  enabled: true,
};

export function useDeliveryFees() {
  const [settings, setSettings] = useState<DeliveryFeeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "delivery_fees")
          .maybeSingle();

        if (error) throw error;

        if (data?.value) {
          setSettings(data.value as unknown as DeliveryFeeSettings);
        }
      } catch (err) {
        console.error("Error fetching delivery fee settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const calculateDeliveryFee = (
    deliveryType: "standard" | "express",
    orderTotal: number = 0
  ): { fee: number; type: "standard" | "express" | "free" } => {
    if (!settings.enabled) {
      return { fee: 0, type: "free" };
    }

    // Free delivery for orders over threshold
    if (orderTotal >= settings.free_threshold) {
      return { fee: 0, type: "free" };
    }

    if (deliveryType === "express") {
      return { fee: settings.express, type: "express" };
    }

    return { fee: settings.standard, type: "standard" };
  };

  return {
    settings,
    loading,
    calculateDeliveryFee,
  };
}
