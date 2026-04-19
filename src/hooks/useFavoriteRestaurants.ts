import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useFavoriteRestaurants() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const favoriteIdsRef = useRef(favoriteIds);
  favoriteIdsRef.current = favoriteIds;

  // Fetch user's favorite restaurants
  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) {
        setFavoriteIds(new Set());
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_favorite_restaurants")
          .select("restaurant_id")
          .eq("user_id", user.id);

        if (error) throw error;

        setFavoriteIds(new Set(data?.map(f => f.restaurant_id) || []));
      } catch (err) {
        console.error("Error fetching favorites:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

  const toggleFavorite = useCallback(async (restaurantId: string, restaurantName: string) => {
    if (!user) {
      toast.error("Sign in required", { description: "Please sign in to save favorites" });
      return;
    }

    const isFavorite = favoriteIdsRef.current.has(restaurantId);
    setToggling(true);

    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFavorite) {
        next.delete(restaurantId);
      } else {
        next.add(restaurantId);
      }
      return next;
    });

    try {
      if (isFavorite) {
        const { error } = await supabase
          .from("user_favorite_restaurants")
          .delete()
          .eq("user_id", user.id)
          .eq("restaurant_id", restaurantId);

        if (error) throw error;

        toast.success("Removed from favorites", { description: `${restaurantName} has been removed from your favorites` });
      } else {
        const { error } = await supabase
          .from("user_favorite_restaurants")
          .insert({
            user_id: user.id,
            restaurant_id: restaurantId,
          });

        if (error) throw error;

        toast.success("Added to favorites", { description: `${restaurantName} has been saved to your favorites` });
      }
    } catch (err) {
      // Revert optimistic update
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFavorite) {
          next.add(restaurantId);
        } else {
          next.delete(restaurantId);
        }
        return next;
      });
      console.error("Error toggling favorite:", err);
      toast.error("Error", { description: "Failed to update favorites" });
    } finally {
      setToggling(false);
    }
  }, [user]);

  const isFavorite = useCallback((restaurantId: string) => {
    return favoriteIds.has(restaurantId);
  }, [favoriteIds]);

  return {
    favoriteIds,
    loading,
    toggling,
    toggleFavorite,
    isFavorite,
  };
}
