import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TopMeal {
  id: string;
  meal_id: string;
  name: string;
  image_url: string | null;
  calories: number;
  protein_g: number;
  rating: number;
  prep_time_minutes: number;
  restaurant_name: string;
  restaurant_id: string;
  diet_tags: string[];
  order_count: number;
  is_auto_added: boolean;
  last_ordered_at: string | null;
  added_at: string;
}

export function useTopMeals() {
  const { user } = useAuth();
  const [topMeals, setTopMeals] = useState<TopMeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTopMeals = useCallback(async () => {
    if (!user) {
      setTopMeals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // First, clean up old auto-added meals (older than 3 days with < 5 orders)
      await supabase.rpc("cleanup_old_top_meals");

      // Fetch top meals with meal details
      const { data, error } = await supabase
        .from("user_top_meals")
        .select(`
          id,
          meal_id,
          order_count,
          is_auto_added,
          last_ordered_at,
          added_at,
          meals:meal_id (
            id,
            name,
            image_url,
            calories,
            protein_g,
            rating,
            prep_time_minutes,
            restaurant_id,
            restaurants:restaurant_id (
              name
            )
          )
        `)
        .eq("user_id", user.id)
        .order("order_count", { ascending: false })
        .order("last_ordered_at", { ascending: false });

      if (error) throw error;

      // Transform the data
      const transformedMeals: TopMeal[] = (data || [])
        .map((item: any) => ({
          id: item.id,
          meal_id: item.meal_id,
          name: item.meals?.name || "Unknown Meal",
          image_url: item.meals?.image_url,
          calories: item.meals?.calories || 0,
          protein_g: parseFloat(item.meals?.protein_g) || 0,
          rating: parseFloat(item.meals?.rating) || 0,
          prep_time_minutes: item.meals?.prep_time_minutes || 15,
          restaurant_name: item.meals?.restaurants?.name || "Unknown Restaurant",
          restaurant_id: item.meals?.restaurant_id,
          diet_tags: [], // Would need separate fetch for diet tags
          order_count: item.order_count,
          is_auto_added: item.is_auto_added,
          last_ordered_at: item.last_ordered_at,
          added_at: item.added_at,
        }))
        .filter((meal) => meal.meal_id); // Filter out any null meals

      setTopMeals(transformedMeals);
    } catch (error) {
      console.error("Error fetching top meals:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add a meal to top meals manually
  const addToTopMeals = useCallback(
    async (mealId: string) => {
      if (!user) return false;

      try {
        const { error } = await supabase.from("user_top_meals").upsert(
          {
            user_id: user.id,
            meal_id: mealId,
            is_auto_added: false,
            order_count: 1,
            last_ordered_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,meal_id",
            ignoreDuplicates: false,
          }
        );

        if (error) throw error;

        // Refresh the list
        await fetchTopMeals();
        return true;
      } catch (error) {
        console.error("Error adding to top meals:", error);
        return false;
      }
    },
    [user, fetchTopMeals]
  );

  // Remove a meal from top meals
  const removeFromTopMeals = useCallback(
    async (topMealId: string) => {
      if (!user) return false;

      try {
        const { error } = await supabase
          .from("user_top_meals")
          .delete()
          .eq("id", topMealId)
          .eq("user_id", user.id);

        if (error) throw error;

        // Update local state
        setTopMeals((prev) => prev.filter((meal) => meal.id !== topMealId));
        return true;
      } catch (error) {
        console.error("Error removing from top meals:", error);
        return false;
      }
    },
    [user]
  );

  // Check if a meal is in top meals
  const isInTopMeals = useCallback(
    (mealId: string) => {
      return topMeals.some((meal) => meal.meal_id === mealId);
    },
    [topMeals]
  );

  useEffect(() => {
    fetchTopMeals();
  }, [fetchTopMeals]);

  return {
    topMeals,
    loading,
    fetchTopMeals,
    addToTopMeals,
    removeFromTopMeals,
    isInTopMeals,
  };
}
