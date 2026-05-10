import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ScheduledMealNotification {
  id: string;
  meal_name: string;
  scheduled_date: string;
  meal_type: string;
  calories: number;
}

interface NotificationData {
  meal_id: string;
  meal_name: string;
  scheduled_date: string;
  meal_type: string;
  calories: number;
  action: string;
}

interface NotificationRow {
  id: string;
  data: unknown;
  created_at: string;
}

export function useScheduledMealNotifications() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [pendingNotifications, setPendingNotifications] = useState<ScheduledMealNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPendingNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("id, data, created_at")
        .eq("user_id", user.id)
        .eq("type", "meal_scheduled")
        .eq("status", "unread")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const notifications: ScheduledMealNotification[] = (data as unknown as NotificationRow[] || [])
        .map(n => {
          const meta = n.data as NotificationData;
          return {
            id: n.id,
            meal_name: meta.meal_name,
            scheduled_date: meta.scheduled_date,
            meal_type: meta.meal_type,
            calories: meta.calories,
          };
        });

      setPendingNotifications(notifications);
    } catch (err) {
      console.error("Error fetching scheduled meal notifications:", err);
    }
  }, []);

  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      await (supabase as unknown as { 
        from: (table: string) => { 
          update: (values: Record<string, unknown>) => { 
            eq: (column: string, value: string) => Promise<unknown> 
          } 
        } 
      }).from("notifications")
        .update({ status: "read" })
        .eq("id", notificationId);

      setPendingNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error("Error dismissing notification:", err);
    }
  }, []);

  const viewSchedule = useCallback(() => {
    navigate("/schedule");
  }, [navigate]);

  useEffect(() => {
    fetchPendingNotifications();

    // Set up realtime subscription for new notifications
    const subscription = supabase
      .channel("scheduled-meals")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "type=eq.meal_scheduled",
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
    pendingNotifications,
    loading,
    dismissNotification,
    viewSchedule,
    refresh: fetchPendingNotifications,
  };
}
