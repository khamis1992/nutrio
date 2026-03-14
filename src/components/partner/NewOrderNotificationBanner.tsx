import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ShoppingBag } from "lucide-react";

interface OrderNotification {
  id: string;
  meal_name: string;
}

export function NewOrderNotificationBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(
      "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"
    );
    audioRef.current.volume = 0.5;
  }, []);

  // Fetch the partner's restaurant ID
  useEffect(() => {
    if (!user) return;
    const fetchRestaurant = async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) setRestaurantId(data.id);
    };
    fetchRestaurant();
  }, [user]);

  // Subscribe to real-time new orders for this restaurant
  useEffect(() => {
    if (!restaurantId) return;

    // Cache meal IDs to filter incoming events
    let mealIds: string[] = [];
    const fetchMealIds = async () => {
      const { data } = await supabase
        .from("meals")
        .select("id")
        .eq("restaurant_id", restaurantId);
      mealIds = data?.map((m) => m.id) || [];
    };
    fetchMealIds();

    const channel = supabase
      .channel("new-order-notification-banner")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "meal_schedules" },
        async (payload) => {
          const newSchedule = payload.new as { id: string; meal_id: string };
          if (!mealIds.includes(newSchedule.meal_id)) return;

          // Fetch meal name for the notification
          const { data: meal } = await supabase
            .from("meals")
            .select("name")
            .eq("id", newSchedule.meal_id)
            .maybeSingle();

          // Play notification sound
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }

          setNotifications((prev) => [
            { id: newSchedule.id, meal_name: meal?.name || "a meal" },
            ...prev,
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {notifications.map((notification) => (
        <Card
          key={notification.id}
          className="animate-fade-in border-green-500/30 bg-gradient-to-r from-green-500/5 to-green-500/10"
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-background/50 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-semibold text-sm">New Order Received!</h4>
                  <Badge
                    variant="outline"
                    className="text-xs text-green-600 border-green-500/50"
                  >
                    New
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  A customer ordered <span className="font-medium text-foreground">{notification.meal_name}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    navigate("/partner/orders");
                    dismiss(notification.id);
                  }}
                >
                  View Orders
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => dismiss(notification.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
