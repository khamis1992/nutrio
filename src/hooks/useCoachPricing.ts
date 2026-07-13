import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CoachPricing {
  coach_id: string;
  price_per_week: number;
  price_per_month: number;
  currency: string;
  is_active: boolean;
}

export function useCoachPricing(coachId: string | undefined) {
  const [pricing, setPricing] = useState<CoachPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPricing = useCallback(async () => {
    if (!coachId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("coach_pricing")
        .select("*")
        .eq("coach_id", coachId)
        .maybeSingle();
      setPricing(data);
    } catch (err) {
      console.error("Error fetching coach pricing:", err);
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  const savePricing = async (pricePerWeek: number, pricePerMonth: number, active: boolean) => {
    if (!coachId) return { success: false, error: new Error("Coach profile is unavailable") };
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("coach_pricing")
        .upsert({
          coach_id: coachId,
          price_per_week: pricePerWeek,
          price_per_month: pricePerMonth,
          is_active: active,
        }, { onConflict: "coach_id" })
        .select()
        .single();
      if (error) throw error;
      setPricing(data);
      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: err as Error };
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { fetchPricing(); }, [fetchPricing]);

  return { pricing, loading, saving, savePricing, refresh: fetchPricing };
}
