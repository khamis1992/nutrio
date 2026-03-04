import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DbSubscriptionPlan {
  id: string;
  tier: string;
  price_qar: number;
  billing_interval: string;
  meals_per_month: number;
  meals_per_week: number;
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

        // Normalize data — add computed meals_per_week if not present
        const normalized: DbSubscriptionPlan[] = (data || []).map((p) => ({
          ...p,
          meals_per_week: p.meals_per_week ?? Math.round((p.meals_per_month ?? 0) / 4),
          features: Array.isArray(p.features) ? (p.features as string[]) : [],
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
