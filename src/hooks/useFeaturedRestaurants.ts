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
        // Fetch active featured listings with restaurant data
        const { data: listings, error: listingsError } = await supabase
          .from("featured_listings")
          .select(`
            id,
            package_type,
            ends_at,
            restaurant_id
          `)
          .eq("status", "active")
          .lte("starts_at", new Date().toISOString())
          .gt("ends_at", new Date().toISOString());

        if (listingsError) throw listingsError;

        if (!listings || listings.length === 0) {
          setFeaturedRestaurants([]);
          setFeaturedIds(new Set());
          setLoading(false);
          return;
        }

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
            total_orders,
            meals!inner (id)
          `)
          .in("id", restaurantIds)
          .eq("approval_status", "approved")
          .eq("is_active", true);

        if (restaurantsError) throw restaurantsError;

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
            meal_count: r.meals?.length || 0,
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
