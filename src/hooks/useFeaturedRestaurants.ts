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
        // Use the database's current time for comparison
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
          console.log("No active featured listings found");
          setFeaturedRestaurants([]);
          setFeaturedIds(new Set());
          setLoading(false);
          return;
        }

        console.log("Found featured listings:", listings.length, listings);

        // Fetch restaurant details for featured listings
        const restaurantIds = listings.map((l) => l.restaurant_id);
        const { data: restaurants, error: restaurantsError } = await supabase
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
          .eq("is_active", true);

        if (restaurantsError) {
          console.error("Error fetching restaurants:", restaurantsError);
          throw restaurantsError;
        }

        console.log("Found restaurants:", restaurants?.length, restaurants);

        // Fetch meal counts for each restaurant
        const { data: mealCounts, error: mealError } = await supabase
          .from("meals")
          .select("restaurant_id, id")
          .in("restaurant_id", restaurantIds)
          .eq("is_available", true);

        if (mealError) {
          console.error("Error fetching meals:", mealError);
        }

        // Count meals per restaurant
        const mealCountMap = new Map<string, number>();
        mealCounts?.forEach((meal) => {
          const current = mealCountMap.get(meal.restaurant_id) || 0;
          mealCountMap.set(meal.restaurant_id, current + 1);
        });

        // Map restaurants with featured listing info
        const featured: FeaturedRestaurant[] = (restaurants || []).map((r: any) => {
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

        console.log("Mapped featured restaurants:", featured.length, featured);

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
