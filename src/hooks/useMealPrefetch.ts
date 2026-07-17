import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMealPrefetch() {
  const queryClient = useQueryClient();

  const prefetchMeal = (mealId: string) => {
    const queryKey = ["meal", mealId];
    const alreadyCached = queryClient.getQueryData(queryKey);
    if (alreadyCached) return;

    queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("public_meal_catalog" as "meals")
          .select("*, restaurants(name, logo_url)")
          .eq("id", mealId)
          .single();

        if (error) throw error;
        return data;
      },
      staleTime: 5 * 60 * 1000,
    });
  };

  const prefetchRestaurant = (restaurantId: string) => {
    const queryKey = ["restaurant", restaurantId];
    const alreadyCached = queryClient.getQueryData(queryKey);
    if (alreadyCached) return;

    queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("public_restaurant_catalog" as "restaurants")
          .select("*")
          .eq("id", restaurantId)
          .single();

        if (error) throw error;
        return data;
      },
      staleTime: 10 * 60 * 1000,
    });
  };

  return { prefetchMeal, prefetchRestaurant };
}
