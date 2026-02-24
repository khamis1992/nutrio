import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";

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

export function ScheduledMealNotifications() {
  const { pendingNotifications, dismissNotification, viewSchedule } = useScheduledMealNotifications();

  if (pendingNotifications.length === 0) return null;

  return (
    <div className="space-y-3">
      {pendingNotifications.map((notification) => (
        <Card key={notification.id} className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Meal Scheduled!</p>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {notification.meal_name} • {format(parseISO(notification.scheduled_date), "MMM d")} • {notification.calories} cal
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  variant="default"
                  className="h-8 text-xs"
                  onClick={() => {
                    viewSchedule();
                    dismissNotification(notification.id);
                  }}
                >
                  <Check className="w-3 h-3 mr-1" />
                  View Schedule
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => dismissNotification(notification.id)}
                >
                  <X className="w-3 h-3 mr-1" />
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
