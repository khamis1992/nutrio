import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserOrder {
  id: string;
  user_id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_created_at: string;
  delivery_type: string | null;
  delivery_fee: number | null;
  meal_id: string;
  meal_name: string;
  meal_description: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_image_url: string | null;
  restaurant_id: string;
  restaurant_name: string;
  restaurant_logo_url: string | null;
}

export interface OrderFilters {
  mealType?: string | null;
  status?: 'completed' | 'pending' | null;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

export interface OrderStats {
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  total_calories: number;
  total_protein: number;
  favorite_restaurant: string | null;
  favorite_meal_type: string | null;
}

export const useUserOrders = (userId: string | null) => {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({});

  const fetchOrders = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from("user_orders_view")
        .select("*")
        .eq("user_id", userId);

      // Apply filters
      if (filters.mealType) {
        query = query.eq("meal_type", filters.mealType);
      }

      if (filters.status === 'completed') {
        query = query.eq("is_completed", true);
      } else if (filters.status === 'pending') {
        query = query.eq("is_completed", false);
      }

      if (filters.dateFrom) {
        query = query.gte("scheduled_date", filters.dateFrom.toISOString().split('T')[0]);
      }

      if (filters.dateTo) {
        query = query.lte("scheduled_date", filters.dateTo.toISOString().split('T')[0]);
      }

      const { data, error: fetchError } = await query
        .order("scheduled_date", { ascending: false });

      if (fetchError) throw fetchError;

      setOrders(data || []);

      // Calculate stats
      if (data && data.length > 0) {
        const totalOrders = data.length;
        const completedOrders = data.filter(o => o.is_completed).length;
        const totalCalories = data.reduce((sum, o) => sum + (o.calories || 0), 0);
        const totalProtein = data.reduce((sum, o) => sum + (o.protein_g || 0), 0);

        // Find favorite restaurant
        const restaurantCounts: Record<string, number> = {};
        data.forEach(o => {
          restaurantCounts[o.restaurant_name] = (restaurantCounts[o.restaurant_name] || 0) + 1;
        });
        const favoriteRestaurant = Object.entries(restaurantCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        // Find favorite meal type
        const mealTypeCounts: Record<string, number> = {};
        data.forEach(o => {
          mealTypeCounts[o.meal_type] = (mealTypeCounts[o.meal_type] || 0) + 1;
        });
        const favoriteMealType = Object.entries(mealTypeCounts)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        setStats({
          total_orders: totalOrders,
          completed_orders: completedOrders,
          pending_orders: totalOrders - completedOrders,
          total_calories: totalCalories,
          total_protein: totalProtein,
          favorite_restaurant: favoriteRestaurant,
          favorite_meal_type: favoriteMealType,
        });
      } else {
        setStats({
          total_orders: 0,
          completed_orders: 0,
          pending_orders: 0,
          total_calories: 0,
          total_protein: 0,
          favorite_restaurant: null,
          favorite_meal_type: null,
        });
      }
    } catch (err) {
      console.error("Error fetching user orders:", err);
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const updateFilters = useCallback((newFilters: Partial<OrderFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return {
    orders,
    stats,
    loading,
    error,
    filters,
    updateFilters,
    clearFilters,
    refetch: fetchOrders,
  };
};

export default useUserOrders;
