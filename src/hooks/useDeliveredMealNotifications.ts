import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DeliveredMealNotification {
  id: string;
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
  const { toast } = useToast();
  const [pendingMeals, setPendingMeals] = useState<DeliveredMealNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPendingNotifications = useCallback(async () => {
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
          return meta?.action === "add_to_progress";
        })
        .map(n => {
          const meta = n.data as MealNotificationData;
          return {
            id: n.id,
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
    }
  }, []);

  const addToProgress = useCallback(async (notification: DeliveredMealNotification) => {
    setLoading(true);
    try {
      // Use raw SQL since the function might not be in types yet
      const { error } = await (supabase as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<{ error: Error | null }> }).rpc("add_delivered_meal_to_progress", {
        p_order_id: notification.order_id,
        p_meal_id: notification.meal_id,
      });

      if (error) throw error;

      // Mark notification as read using status column (cast to avoid stale types)
      await (supabase as unknown as { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<unknown> } } }).from("notifications")
        .update({ status: "read" })
        .eq("id", notification.id);

      // Remove from pending list
      setPendingMeals(prev => prev.filter(m => m.id !== notification.id));

      toast({
        title: "Added to Progress!",
        description: `${notification.meal_name} has been added to your Today's Progress.`,
      });

      return true;
    } catch (err) {
      console.error("Error adding meal to progress:", err);
      toast({
        title: "Error",
        description: "Could not add meal to progress. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [toast]);

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

    // Set up realtime subscription for new notifications
    const subscription = supabase
      .channel("delivered-meals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "type=eq.order_delivered",
        },
        () => {
          fetchPendingNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchPendingNotifications]);

  return {
    pendingMeals,
    loading,
    addToProgress,
    dismissNotification,
    refresh: fetchPendingNotifications,
  };
}
