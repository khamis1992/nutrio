import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

interface DeliveredMealNotification {
  id: string;
  source_type: "order" | "meal_schedule";
  source_id: string;
  order_id: string;
  meal_id: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  quantity: number;
}

interface MealNotificationData {
  action: string;
  source_type?: "order" | "meal_schedule";
  source_id?: string;
  order_id: string;
  meal_id: string;
  meal_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  quantity?: number;
}

// Raw database row type (since generated types are stale)
interface NotificationRow {
  id: string;
  data: unknown;
}

export function useDeliveredMealNotifications() {
  const [pendingMeals, setPendingMeals] = useState<DeliveredMealNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPendingNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use raw SQL query to avoid type issues with stale generated types
      const { data, error } = await supabase
        .from("notifications")
        .select("id, data")
        .eq("user_id", user.id)
        .eq("type", "order_delivered")
        .eq("status", "unread")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const meals: DeliveredMealNotification[] = (data as unknown as NotificationRow[] || [])
        .filter(n => {
          const meta = n.data as MealNotificationData | null;
          return meta?.action === "add_to_progress" || meta?.action === "confirm_consumption";
        })
        .map(n => {
          const meta = n.data as MealNotificationData;
          return {
            id: n.id,
            source_type: meta.source_type === "meal_schedule" ? "meal_schedule" : "order",
            source_id: meta.source_id || meta.order_id,
            order_id: meta.order_id,
            meal_id: meta.meal_id,
            meal_name: meta.meal_name,
            calories: meta.calories,
            protein_g: meta.protein_g,
            carbs_g: meta.carbs_g,
            fat_g: meta.fat_g,
            quantity: meta.quantity || 1,
          };
        });

      setPendingMeals(meals);
    } catch (err) {
      console.error("Error fetching delivered meal notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      // Mark notification as read using status column (cast to avoid stale types)
      await (supabase as unknown as { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<unknown> } } }).from("notifications")
        .update({ status: "read" })
        .eq("id", notificationId);

      setPendingMeals(prev => prev.filter(m => m.id !== notificationId));
    } catch (err) {
      console.error("Error dismissing notification:", err);
    }
  }, []);

  useEffect(() => {
    fetchPendingNotifications();
  }, [fetchPendingNotifications]);

  useRealtimeTable("notifications", {
    event: "INSERT",
    filter: "type=eq.order_delivered",
    onChange: () => fetchPendingNotifications(),
  });

  return {
    pendingMeals,
    loading,
    dismissNotification,
    refresh: fetchPendingNotifications,
  };
}
