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
      await (supabase as any).rpc("cleanup_old_top_meals");

      // Fetch top meals
      const { data, error } = await (supabase as any)
        .from("user_top_meals")
        .select(`
          id,
          meal_id,
          order_count,
          is_auto_added,
          last_ordered_at,
          added_at
        `)
        .eq("user_id", user.id)
        .order("order_count", { ascending: false })
        .order("last_ordered_at", { ascending: false });

      if (error) throw error;

      // Fetch meal details separately
      const mealIds = (data || []).map((item: any) => item.meal_id).filter(Boolean);
      
      let mealsData: any[] = [];
      let restaurantsData: any[] = [];
      
      if (mealIds.length > 0) {
        // Fetch meals
        const { data: meals, error: mealsError } = await supabase
          .from("meals")
          .select("id, name, image_url, calories, protein_g, rating, prep_time_minutes, restaurant_id")
          .in("id", mealIds);
        
        if (!mealsError && meals) {
          mealsData = meals;
          
          // Fetch restaurants
          const restaurantIds = meals.map((m: any) => m.restaurant_id).filter(Boolean);
          if (restaurantIds.length > 0) {
            const { data: restaurants, error: restaurantsError } = await supabase
              .from("restaurants")
              .select("id, name")
              .in("id", restaurantIds);
            
            if (!restaurantsError && restaurants) {
              restaurantsData = restaurants;
            }
          }
        }
      }

      // Transform the data
      const transformedMeals: TopMeal[] = (data || [])
        .map((item: any) => {
          // Find the meal details
          const meal = mealsData.find((m: any) => m.id === item.meal_id);
          // Find the restaurant details
          const restaurant = meal ? restaurantsData.find((r: any) => r.id === meal.restaurant_id) : null;
          
          return {
            id: item.id,
            meal_id: item.meal_id,
            name: meal?.name || "Unknown Meal",
            image_url: meal?.image_url,
            calories: meal?.calories || 0,
            protein_g: parseFloat(meal?.protein_g) || 0,
            rating: parseFloat(meal?.rating) || 0,
            prep_time_minutes: meal?.prep_time_minutes || 15,
            restaurant_name: restaurant?.name || "Unknown Restaurant",
            restaurant_id: meal?.restaurant_id,
            diet_tags: [], // Would need separate fetch for diet tags
            order_count: item.order_count,
            is_auto_added: item.is_auto_added,
            last_ordered_at: item.last_ordered_at,
            added_at: item.added_at,
          };
        })
        .filter((meal: TopMeal) => meal.meal_id); // Filter out any null meals

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
        const { error } = await (supabase as any).from("user_top_meals").upsert(
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
        const { error } = await (supabase as any)
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
