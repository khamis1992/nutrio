import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseDeliveryNotificationsProps {
  userId: string | undefined;
  enabled?: boolean;
}

export function useDeliveryNotifications({ userId, enabled = true }: UseDeliveryNotificationsProps) {
  const { toast } = useToast();

  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icon-192x192.png",
        badge: "/icon-72x72.png",
        tag: "delivery-update",
        requireInteraction: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !userId) return;

    // Request permission on mount
    requestNotificationPermission();

    // Subscribe to delivery job updates for this user
    const channel = supabase
      .channel(`delivery-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_jobs",
        },
        async (payload) => {
          const job = payload.new as { 
            id: string; 
            status: string; 
            schedule_id: string;
            driver_id: string | null;
          };
          const oldJob = payload.old as { status: string };

          // Only notify on status changes
          if (job.status === oldJob.status) return;

          // Get schedule info to verify this belongs to the user
          const { data: schedule } = await supabase
            .from("meal_schedules")
            .select("user_id, meal:meal_id(name)")
            .eq("id", job.schedule_id)
            .single();

          if (!schedule || (schedule as { user_id: string }).user_id !== userId) return;

          const mealName = (schedule as { meal: { name: string } }).meal?.name || "Your order";

          // Send notification based on status
          switch (job.status) {
            case "assigned":
              toast({
                title: "🚚 Driver Assigned!",
                description: `A driver has been assigned to deliver your ${mealName}.`,
              });
              sendBrowserNotification(
                "Driver Assigned",
                `A driver has been assigned to deliver your ${mealName}.`
              );
              break;

            case "accepted":
              toast({
                title: "🚗 Driver En Route",
                description: "Your driver is heading to the restaurant to pick up your order.",
              });
              sendBrowserNotification(
                "Driver En Route",
                "Your driver is heading to the restaurant to pick up your order."
              );
              break;

            case "picked_up":
              toast({
                title: "📦 Order Picked Up!",
                description: `Your ${mealName} is on the way! Track your delivery in real-time.`,
              });
              sendBrowserNotification(
                "Order On The Way!",
                `Your ${mealName} has been picked up and is heading to you.`
              );
              break;

            case "delivered":
              toast({
                title: "✅ Order Delivered!",
                description: `Your ${mealName} has been delivered. Enjoy your meal!`,
              });
              sendBrowserNotification(
                "Order Delivered!",
                `Your ${mealName} has been delivered. Enjoy your meal!`
              );
              break;

            case "failed":
              toast({
                title: "⚠️ Delivery Issue",
                description: "There was an issue with your delivery. Our team will contact you shortly.",
                variant: "destructive",
              });
              sendBrowserNotification(
                "Delivery Issue",
                "There was an issue with your delivery. Our team will contact you shortly."
              );
              break;
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, enabled, toast, sendBrowserNotification, requestNotificationPermission]);

  return { requestNotificationPermission };
}
