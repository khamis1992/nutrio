import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  CheckCircle,
  Calendar,
  User,
  Utensils,
  Package,
  ChefHat,
  Truck,
  CircleDot,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";

type OrderStatus = "pending" | "confirmed" | "preparing" | "delivered";

const ORDER_STATUSES: { value: OrderStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "pending", label: "Pending", icon: <CircleDot className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "confirmed", label: "Confirmed", icon: <CheckCircle className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "preparing", label: "Preparing", icon: <ChefHat className="h-4 w-4" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { value: "delivered", label: "Delivered", icon: <Truck className="h-4 w-4" />, color: "bg-green-500/10 text-green-600 border-green-500/20" },
];

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: OrderStatus;
  created_at: string;
  user_id: string;
  meal: {
    id: string;
    name: string;
    image_url: string | null;
    calories: number;
    price: number;
  };
  profile: {
    full_name: string | null;
  } | null;
}

const PartnerOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [scheduledMeals, setScheduledMeals] = useState<ScheduledMeal[]>([]);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    if (user) {
      fetchScheduledMeals();
    }
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("partner-meal-schedules")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_schedules",
        },
        () => {
          fetchScheduledMeals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchScheduledMeals = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get partner's restaurant
      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant) {
        navigate("/partner");
        return;
      }

      setRestaurantId(restaurant.id);
      setRestaurantName(restaurant.name);

      // Get all meal IDs for this restaurant
      const { data: meals, error: mealsError } = await supabase
        .from("meals")
        .select("id")
        .eq("restaurant_id", restaurant.id);

      if (mealsError) throw mealsError;

      const mealIds = meals?.map((m) => m.id) || [];

      if (mealIds.length === 0) {
        setScheduledMeals([]);
        setLoading(false);
        return;
      }

      // Fetch scheduled meals for these meal IDs
      const { data: schedules, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          user_id,
          meals:meal_id (
            id,
            name,
            image_url,
            calories,
            price
          )
        `)
        .in("meal_id", mealIds)
        .order("scheduled_date", { ascending: false });

      if (schedulesError) throw schedulesError;

      // Fetch user profiles for the scheduled meals
      const userIds = [...new Set((schedules || []).map((s) => s.user_id))];
      
      let profilesMap: Record<string, { full_name: string | null }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name };
            return acc;
          }, {} as Record<string, { full_name: string | null }>);
        }
      }

      // Transform data
      const transformedSchedules: ScheduledMeal[] = (schedules || []).map((s: any) => ({
        id: s.id,
        scheduled_date: s.scheduled_date,
        meal_type: s.meal_type,
        is_completed: s.is_completed || false,
        order_status: (s.order_status || "pending") as OrderStatus,
        created_at: s.created_at,
        user_id: s.user_id,
        meal: s.meals,
        profile: profilesMap[s.user_id] || null,
      }));

      setScheduledMeals(transformedSchedules);
    } catch (error) {
      console.error("Error fetching scheduled meals:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (scheduleId: string, newStatus: OrderStatus, schedule: ScheduledMeal) => {
    try {
      const isCompleted = newStatus === "delivered";
      
      const { error } = await supabase
        .from("meal_schedules")
        .update({ 
          order_status: newStatus,
          is_completed: isCompleted 
        })
        .eq("id", scheduleId);

      if (error) throw error;

      // Create notification for the customer
      const statusConfig = ORDER_STATUSES.find(s => s.value === newStatus);
      const notificationTitle = getNotificationTitle(newStatus);
      const notificationMessage = getNotificationMessage(newStatus, schedule.meal?.name || "Your meal", restaurantName);

      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: schedule.user_id,
          type: "order_update",
          title: notificationTitle,
          message: notificationMessage,
          metadata: {
            schedule_id: scheduleId,
            meal_name: schedule.meal?.name,
            restaurant_name: restaurantName,
            new_status: newStatus,
          },
        });

      if (notifError) {
        console.error("Error creating notification:", notifError);
      }

      setScheduledMeals((prev) =>
        prev.map((s) => 
          s.id === scheduleId 
            ? { ...s, order_status: newStatus, is_completed: isCompleted } 
            : s
        )
      );

      toast({
        title: "Status updated",
        description: `Order marked as ${statusConfig?.label || newStatus}`,
      });
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const getNotificationTitle = (status: OrderStatus): string => {
    switch (status) {
      case "confirmed":
        return "Order Confirmed! ✓";
      case "preparing":
        return "Your meal is being prepared 👨‍🍳";
      case "delivered":
        return "Order Delivered! 🎉";
      default:
        return "Order Update";
    }
  };

  const getNotificationMessage = (status: OrderStatus, mealName: string, restaurant: string): string => {
    switch (status) {
      case "confirmed":
        return `${restaurant} has confirmed your order for ${mealName}. It will be prepared soon!`;
      case "preparing":
        return `${restaurant} is now preparing your ${mealName}. It will be ready shortly!`;
      case "delivered":
        return `Your ${mealName} from ${restaurant} has been delivered. Enjoy your meal!`;
      default:
        return `Your order for ${mealName} has been updated to ${status}.`;
    }
  };

  const today = new Date().toISOString().split("T")[0];
  
  const upcomingOrders = scheduledMeals.filter(
    (s) => !s.is_completed && s.scheduled_date >= today
  );
  const completedOrders = scheduledMeals.filter((s) => s.is_completed);
  const pastOrders = scheduledMeals.filter(
    (s) => !s.is_completed && s.scheduled_date < today
  );

  if (loading) {
    return (
      <PartnerLayout title="Orders">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </PartnerLayout>
    );
  }

  const getStatusConfig = (status: OrderStatus) => {
    return ORDER_STATUSES.find(s => s.value === status) || ORDER_STATUSES[0];
  };

  const renderSchedules = (schedulesList: ScheduledMeal[], showStatusControl = false) => {
    if (schedulesList.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No orders found</p>
          </CardContent>
        </Card>
      );
    }

    return schedulesList.map((schedule) => {
      const statusConfig = getStatusConfig(schedule.order_status);
      const isOverdue = schedule.scheduled_date < today && !schedule.is_completed;

      return (
        <Card key={schedule.id}>
          <CardContent className="p-4">
            <div className="flex gap-4">
              {/* Meal Image */}
              <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-3xl overflow-hidden shrink-0">
                {schedule.meal?.image_url ? (
                  <img
                    src={schedule.meal.image_url}
                    alt={schedule.meal.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  "🍽️"
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold truncate">{schedule.meal?.name || "Unknown Meal"}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <User className="h-3 w-3" />
                      <span>{schedule.profile?.full_name || "Customer"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOverdue && (
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
                    )}
                    <Badge variant="outline" className={statusConfig.color}>
                      <span className="flex items-center gap-1">
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(schedule.scheduled_date).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Utensils className="h-3 w-3" />
                    {schedule.meal_type}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {schedule.meal?.calories} kcal
                  </span>
                </div>

                {showStatusControl && !schedule.is_completed && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Update status:</span>
                    <Select
                      value={schedule.order_status}
                      onValueChange={(value) => updateOrderStatus(schedule.id, value as OrderStatus, schedule)}
                    >
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <span className="flex items-center gap-2">
                              {status.icon}
                              {status.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    });
  };

  return (
    <PartnerLayout title="Orders" subtitle={`${upcomingOrders.length} upcoming • ${pastOrders.length} overdue`}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full mb-6">
          <TabsTrigger value="upcoming" className="relative">
            Upcoming
            {upcomingOrders.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {upcomingOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue" className="relative">
            Overdue
            {pastOrders.length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pastOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {renderSchedules(upcomingOrders, true)}
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          {renderSchedules(pastOrders, true)}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {renderSchedules(completedOrders)}
        </TabsContent>
      </Tabs>
    </PartnerLayout>
  );
};

export default PartnerOrders;
