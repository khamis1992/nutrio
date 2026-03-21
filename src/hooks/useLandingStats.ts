import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LandingStats {
  restaurants: number | null;
  members: number | null;
  ordersDelivered: number | null;
  avgRating: number | null;
  loading: boolean;
}

export function formatStat(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K+`;
  return `${n}+`;
}

export function useLandingStats(): LandingStats {
  const [restaurants, setRestaurants] = useState<number | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [ordersDelivered, setOrdersDelivered] = useState<number | null>(null);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const [restaurantsRes, membersRes, ordersRes, ratingRes] = await Promise.all([
          supabase
            .from("restaurants")
            .select("*", { count: "exact", head: true })
            .eq("approval_status", "approved")
            .eq("is_active", true),
          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true }),
          supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("status", "delivered"),
          supabase
            .from("meal_reviews")
            .select("rating")
            .eq("is_approved", true),
        ]);

        if (cancelled) return;

        setRestaurants(restaurantsRes.count ?? null);
        setMembers(membersRes.count ?? null);
        setOrdersDelivered(ordersRes.count ?? null);

        if (ratingRes.data && ratingRes.data.length > 0) {
          const sum = ratingRes.data.reduce((acc, r) => acc + (r.rating ?? 0), 0);
          const avg = sum / ratingRes.data.length;
          setAvgRating(Math.round(avg * 10) / 10);
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  return { restaurants, members, ordersDelivered, avgRating, loading };
}
