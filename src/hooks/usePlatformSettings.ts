import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PlatformSettings {
  commission_rates: {
    restaurant: number;
    delivery: number;
  };
  features: {
    referral_program: boolean;
    meal_scheduling: boolean;
    subscription_pause: boolean;
    delivery_tracking: boolean;
  };
  subscription_plans: {
    basic_price: number;
    premium_price: number;
    family_price: number;
  };
  notifications: {
    email_enabled: boolean;
    push_enabled: boolean;
    sms_enabled: boolean;
  };
}

const defaultSettings: PlatformSettings = {
  commission_rates: {
    restaurant: 15,
    delivery: 5,
  },
  features: {
    referral_program: true,
    meal_scheduling: true,
    subscription_pause: true,
    delivery_tracking: true,
  },
  subscription_plans: {
    basic_price: 49.99,
    premium_price: 99.99,
    family_price: 149.99,
  },
  notifications: {
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
  },
};

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("key, value");

        if (error) throw error;

        const newSettings = { ...defaultSettings };
        
        data?.forEach((setting) => {
          const value = setting.value as Record<string, unknown>;
          switch (setting.key) {
            case "commission_rates":
              newSettings.commission_rates = {
                restaurant: (value.restaurant as number) || defaultSettings.commission_rates.restaurant,
                delivery: (value.delivery as number) || defaultSettings.commission_rates.delivery,
              };
              break;
            case "features":
              newSettings.features = {
                referral_program: value.referral_program !== undefined ? Boolean(value.referral_program) : defaultSettings.features.referral_program,
                meal_scheduling: value.meal_scheduling !== undefined ? Boolean(value.meal_scheduling) : defaultSettings.features.meal_scheduling,
                subscription_pause: value.subscription_pause !== undefined ? Boolean(value.subscription_pause) : defaultSettings.features.subscription_pause,
                delivery_tracking: value.delivery_tracking !== undefined ? Boolean(value.delivery_tracking) : defaultSettings.features.delivery_tracking,
              };
              break;
            case "subscription_plans":
              newSettings.subscription_plans = {
                basic_price: (value.basic_price as number) || defaultSettings.subscription_plans.basic_price,
                premium_price: (value.premium_price as number) || defaultSettings.subscription_plans.premium_price,
                family_price: (value.family_price as number) || defaultSettings.subscription_plans.family_price,
              };
              break;
            case "notifications":
              newSettings.notifications = {
                email_enabled: value.email_enabled !== undefined ? Boolean(value.email_enabled) : defaultSettings.notifications.email_enabled,
                push_enabled: value.push_enabled !== undefined ? Boolean(value.push_enabled) : defaultSettings.notifications.push_enabled,
                sms_enabled: value.sms_enabled !== undefined ? Boolean(value.sms_enabled) : defaultSettings.notifications.sms_enabled,
              };
              break;
          }
        });

        setSettings(newSettings);
      } catch (err) {
        console.error("Error fetching platform settings:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading, error };
}

// Helper hooks for specific features
export function useFeatureEnabled(feature: keyof PlatformSettings['features']) {
  const { settings, loading } = usePlatformSettings();
  return { enabled: settings.features[feature], loading };
}

export function useNotificationSettings() {
  const { settings, loading } = usePlatformSettings();
  return { notifications: settings.notifications, loading };
}
