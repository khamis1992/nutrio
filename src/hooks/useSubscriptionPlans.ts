import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbSubscriptionPlan {
  id: string;
  tier: string;
  name_ar: string | null;
  description: string | null;
  description_en: string | null;
  short_description: string | null;
  short_description_ar: string | null;
  price_qar: number;
  billing_interval: string;
  meals_per_month: number;
  meals_per_week: number;
  snacks_per_month: number;
  daily_meals: number;
  daily_snacks: number;
  price_per_meal: number | null;
  price_per_snack: number | null;
  features: string[] | null;
  is_active: boolean | null;
  discount_percent: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export const useSubscriptionPlans = () => {
  const [plans, setPlans] = useState<DbSubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("is_active", true)
          .order("price_qar", { ascending: true });

        if (error) throw error;

        // Normalize data - use type assertion for new fields
        const normalized: DbSubscriptionPlan[] = (data || []).map((p: { id: string; tier: string; name_ar: string | null; description: string | null; description_en: string | null; short_description: string | null; short_description_ar: string | null; price_qar: number; billing_interval: string; meals_per_month: number; meals_per_week: number | null; features: unknown; is_active: boolean; sort_order: number; meal_types: unknown; created_at: string; updated_at: string }) => ({
          id: p.id,
          tier: p.tier,
          name_ar: p.name_ar ?? null,
          description: p.description ?? null,
          description_en: p.description_en ?? null,
          short_description: p.short_description ?? null,
          short_description_ar: p.short_description_ar ?? null,
          price_qar: p.price_qar,
          billing_interval: p.billing_interval,
          meals_per_month: p.meals_per_month,
          meals_per_week: p.meals_per_week ?? Math.round((p.meals_per_month ?? 0) / 4),
          snacks_per_month: p.snacks_per_month ?? 0,
          daily_meals: p.daily_meals ?? Math.round((p.meals_per_month ?? 0) / 30),
          daily_snacks: p.daily_snacks ?? Math.round((p.snacks_per_month ?? 0) / 30),
          price_per_meal: p.price_per_meal ?? null,
          price_per_snack: p.price_per_snack ?? null,
          features: Array.isArray(p.features) ? (p.features as string[]) : [],
          is_active: p.is_active,
          discount_percent: p.discount_percent,
          created_at: p.created_at,
          updated_at: p.updated_at,
        }));

        setPlans(normalized);
      } catch (err) {
        console.error("Error fetching subscription plans:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return { plans, loading, error };
};
