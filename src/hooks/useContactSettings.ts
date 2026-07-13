import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export interface ContactSettings {
  support_email: string;
  phone: string;
  address_en: string;
  address_ar: string;
  map_url: string;
  hours_en: string;
  hours_ar: string;
}

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  support_email: "support@nutrio.me",
  phone: "+974 4000 0000",
  address_en: "Doha, Qatar",
  address_ar: "الدوحة، قطر",
  map_url: "https://maps.google.com/?q=Doha,Qatar",
  hours_en: "Support Hours: 8AM - 10PM (Qatar)",
  hours_ar: "ساعات الدعم: 8 صباحاً - 10 مساءً (قطر)",
};

export function useContactSettings() {
  const [settings, setSettings] = useState<ContactSettings>(DEFAULT_CONTACT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "contact_settings")
        .maybeSingle();

      if (error) {
        console.error("Could not load contact settings:", error);
      } else if (mounted && data?.value && typeof data.value === "object" && !Array.isArray(data.value)) {
        setSettings({
          ...DEFAULT_CONTACT_SETTINGS,
          ...(data.value as unknown as Partial<ContactSettings>),
        });
      }

      if (mounted) setLoading(false);
    };

    void loadSettings();
    return () => { mounted = false; };
  }, []);

  return { settings, loading };
}
