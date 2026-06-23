import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  generateAllRecommendations,
  MealCandidate,
  OrderHistoryItem,
  RecommendationSections,
} from "@/lib/recommendation-engine";
import { getQatarDay } from "@/lib/dateUtils";

export function useMealRecommendations() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const userId = user?.id;

  const [candidates, setCandidates] = useState<MealCandidate[]>([]);
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [todayLogs, setTodayLogs] = useState<
    Array<{
      meal_type: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const today = getQatarDay();

      // Fetch meals
      const { data: mealsData, error: mealsError } = await supabase
        .from("meals")
        .select(
          "id, name, image_url, calories, protein_g, carbs_g, fat_g, price, meal_type, restaurant_id, ingredients, is_available, rating"
        )
        .eq("is_available", true)
        .order("rating", { ascending: false })
        .limit(100);

      if (mealsError) throw mealsError;

      // Fetch restaurants
      const restaurantIds = (mealsData || [])
        .map((m) => m.restaurant_id)
        .filter(Boolean) as string[];
      let restaurantsData: Array<Record<string, unknown>> = [];
      if (restaurantIds.length > 0) {
        const { data: rData, error: rError } = await supabase
          .from("restaurants")
          .select("id, name, logo_url, rating, total_orders")
          .in("id", [...new Set(restaurantIds)]);
        if (!rError) restaurantsData = (rData as Record<string, unknown>[]) || [];
      }

      const restaurantMap = new Map(
        restaurantsData.map((r) => [
          r.id as string,
          {
            name: (r.name as string) || "Restaurant",
            logo_url: (r.logo_url as string | null) || null,
            rating: parseFloat(String(r.rating || "0")) || 0,
            total_orders: (r.total_orders as number) || 0,
          },
        ])
      );

      const typedCandidates: MealCandidate[] = (mealsData || []).map((m) => {
        const r = m.restaurant_id ? restaurantMap.get(m.restaurant_id) : null;
        return {
          id: m.id as string,
          name: m.name as string,
          image_url: (m.image_url as string | null) || null,
          calories: (m.calories as number | null) ?? null,
          protein_g: (m.protein_g as number | null) ?? null,
          carbs_g: (m.carbs_g as number | null) ?? null,
          fat_g: (m.fat_g as number | null) ?? null,
          price: (m.price as number | null) ?? null,
          meal_type: (m.meal_type as string | null) || null,
          restaurant_id: (m.restaurant_id as string | null) || null,
          restaurant_name: r?.name || "Restaurant",
          restaurant_logo_url: r?.logo_url || null,
          rating: r?.rating || 0,
          total_orders: r?.total_orders || 0,
          is_available: (m.is_available as boolean | null) ?? true,
          ingredients: (m.ingredients as string | null) || null,
        };
      });

      // Fetch user orders (last 30)
      const { data: ordersData, error: ordersError } = await supabase
        .from("user_orders_view")
        .select(
          "meal_id, meal_name, restaurant_id, meal_type, calories, protein_g, carbs_g, fat_g, order_created_at"
        )
        .eq("user_id", userId)
        .order("order_created_at", { ascending: false })
        .limit(30);

      if (ordersError) throw ordersError;

      const typedOrders: OrderHistoryItem[] = (ordersData || []).map((o) => ({
        meal_id: o.meal_id as string,
        meal_name: o.meal_name as string,
        restaurant_id: o.restaurant_id as string,
        meal_type: o.meal_type as string,
        calories: o.calories as number,
        protein_g: o.protein_g as number,
        carbs_g: o.carbs_g as number,
        fat_g: o.fat_g as number,
        order_created_at: o.order_created_at as string,
      }));

      // Fetch today's progress logs
      const { data: logsData, error: logsError } = await supabase
        .from("progress_logs")
        .select("log_date, calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
        .eq("user_id", userId)
        .gte("log_date", today);

      if (logsError) throw logsError;

      const typedLogs = (logsData || [])
        .filter((l) => l.log_date >= today)
        .map((l) => ({
          meal_type: "logged",
          calories: l.calories_consumed as number,
          protein_g: l.protein_consumed_g as number,
          carbs_g: l.carbs_consumed_g as number,
          fat_g: l.fat_consumed_g as number,
        }));

      setCandidates(typedCandidates);
      setOrders(typedOrders);
      setTodayLogs(typedLogs);
    } catch (err) {
      console.error("Error fetching recommendation data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const healthGoals = useMemo(() => {
    if (!profile) return null;
    return {
      daily_calorie_target: profile.daily_calorie_target || 2000,
      protein_target_g: profile.protein_target_g || 150,
      carbs_target_g: profile.carbs_target_g || 200,
      fat_target_g: profile.fat_target_g || 65,
      goal_type: (profile.goal_type as string | null) || null,
    };
  }, [profile]);

  const recommendations: RecommendationSections = useMemo(() => {
    return generateAllRecommendations(candidates, orders, healthGoals, todayLogs);
  }, [candidates, orders, healthGoals, todayLogs]);

  return { recommendations, candidates, loading, refresh: fetchData };
}
