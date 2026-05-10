import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeaturedRestaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
  featured_listing_id: string;
  package_type: string;
  ends_at: string;
}

export function useFeaturedRestaurants() {
  const [featuredRestaurants, setFeaturedRestaurants] = useState<FeaturedRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchFeaturedRestaurants = async () => {
      try {
        const { data: listings, error: listingsError } = await supabase
          .from("featured_listings")
          .select(`
            id,
            package_type,
            ends_at,
            restaurant_id
          `)
          .eq("status", "active")
          .filter("starts_at", "lte", "now()")
          .filter("ends_at", "gt", "now()");

        if (listingsError) {
          console.error("Error fetching featured listings:", listingsError);
          throw listingsError;
        }

        if (!listings || listings.length === 0) {
          setFeaturedRestaurants([]);
          setFeaturedIds(new Set());
          setLoading(false);
          return;
        }

        const restaurantIds = listings.map((l) => l.restaurant_id);

        const [restaurantsResult, mealCountsResult] = await Promise.all([
          supabase
            .from("restaurants")
            .select(`
              id,
              name,
              description,
              logo_url,
              rating,
              total_orders
            `)
            .in("id", restaurantIds)
            .eq("approval_status", "approved")
            .eq("is_active", true),
          supabase
            .from("meals")
            .select("restaurant_id, id")
            .in("restaurant_id", restaurantIds)
            .eq("is_available", true),
        ]);

        if (restaurantsResult.error) {
          console.error("Error fetching restaurants:", restaurantsResult.error);
          throw restaurantsResult.error;
        }

        const restaurants = restaurantsResult.data;
        const mealCounts = mealCountsResult.data;
        if (mealCountsResult.error) {
          console.error("Error fetching meals:", mealCountsResult.error);
        }

        // Count meals per restaurant
        const mealCountMap = new Map<string, number>();
        mealCounts?.forEach((meal) => {
          if (meal.restaurant_id) {
            const current = mealCountMap.get(meal.restaurant_id) || 0;
            mealCountMap.set(meal.restaurant_id, current + 1);
          }
        });

        // Map restaurants with featured listing info
        const featured: FeaturedRestaurant[] = (restaurants || []).map((r: { id: string; name: string; description: string | null; logo_url: string | null; }) => {
          const listing = listings.find((l) => l.restaurant_id === r.id);
          return {
            id: r.id,
            name: r.name,
            description: r.description,
            logo_url: r.logo_url,
            rating: parseFloat(r.rating) || 0,
            total_orders: r.total_orders || 0,
            meal_count: mealCountMap.get(r.id) || 0,
            featured_listing_id: listing?.id || "",
            package_type: listing?.package_type || "",
            ends_at: listing?.ends_at || "",
          };
        });

        setFeaturedRestaurants(featured);
        setFeaturedIds(new Set(featured.map((f) => f.id)));
      } catch (err) {
        console.error("Error fetching featured restaurants:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedRestaurants();
  }, []);

  const isFeatured = (restaurantId: string) => featuredIds.has(restaurantId);

  return { featuredRestaurants, loading, isFeatured, featuredIds };
}
