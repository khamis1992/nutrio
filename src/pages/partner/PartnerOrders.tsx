import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Clock,
  CheckCircle,
  Package,
  ChefHat,
  Truck,
  CircleDot,
  MapPin,
  Phone,
  Utensils,
  Flame,
  Info,
  CheckCheck,
  X,
  Play,
  Box,
  ArrowRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { PartnerDeliveryHandoff } from "@/components/partner/PartnerDeliveryHandoff";

// Extended order status type with all new statuses
type OrderStatus = 
  | "pending" 
  | "confirmed" 
  | "preparing" 
  | "ready" 
  | "out_for_delivery" 
  | "delivered" 
  | "completed" 
  | "cancelled";

// Status configuration with icons and colors
const STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  icon: React.ReactNode; 
  color: string;
  description: string;
}> = {
  pending: {
    label: "Pending",
    icon: <CircleDot className="h-4 w-4" />,
    color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    description: "Waiting for you to accept",
  },
  confirmed: {
    label: "Confirmed",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    description: "Accepted, ready to prepare",
  },
  preparing: {
    label: "Preparing",
    icon: <ChefHat className="h-4 w-4" />,
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    description: "Currently cooking",
  },
  ready: {
    label: "Ready",
    icon: <Box className="h-4 w-4" />,
    color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    description: "Ready for pickup/delivery",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    icon: <Truck className="h-4 w-4" />,
    color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    description: "Driver is on the way",
  },
  delivered: {
    label: "Delivered",
    icon: <CheckCheck className="h-4 w-4" />,
    color: "bg-green-500/10 text-green-600 border-green-500/20",
    description: "Customer received the order",
  },
  completed: {
    label: "Completed",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    description: "Order finished",
  },
  cancelled: {
    label: "Cancelled",
    icon: <X className="h-4 w-4" />,
    color: "bg-red-500/10 text-red-600 border-red-500/20",
    description: "Order cancelled",
  },
};

// Action buttons configuration for each status
const ACTION_BUTTONS: Record<OrderStatus, Array<{
  action: OrderStatus;
  label: string;
  icon: React.ReactNode;
  variant: "default" | "secondary" | "outline" | "destructive";
}>> = {
  pending: [
    { action: "confirmed", label: "Accept Order", icon: <CheckCircle className="h-4 w-4" />, variant: "default" },
    { action: "cancelled", label: "Cancel Order", icon: <X className="h-4 w-4" />, variant: "destructive" },
  ],
  confirmed: [
    { action: "preparing", label: "Start Preparing", icon: <Play className="h-4 w-4" />, variant: "default" },
    { action: "cancelled", label: "Cancel Order", icon: <X className="h-4 w-4" />, variant: "destructive" },
  ],
  preparing: [
    { action: "ready", label: "Mark Ready", icon: <Box className="h-4 w-4" />, variant: "default" },
    { action: "cancelled", label: "Cancel Order", icon: <X className="h-4 w-4" />, variant: "destructive" },
  ],
  ready: [
    // Partners cannot transition to out_for_delivery - this is handled automatically
    // when a driver is assigned via the driver assignment system
    { action: "cancelled", label: "Cancel Order", icon: <X className="h-4 w-4" />, variant: "destructive" },
  ],
  out_for_delivery: [
    // Partners cannot change status once handed to driver
  ],
  delivered: [
    // Partners cannot change status - only customer can mark as completed
  ],
  completed: [
    // No actions for completed orders
  ],
  cancelled: [
    // No actions for cancelled orders
  ],
};

// Status flow visualization
const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "completed"];

interface ScheduleAddon {
  id: string;
  addon_name: string;
  quantity: number;
}

interface Order {
  id: string;
  order_status: OrderStatus;
  scheduled_date: string;
  meal_type: string;
  delivery_type: string;
  delivery_fee: number | null;
  addons_total: number | null;
  created_at: string;
  meal: {
    id: string;
    name: string;
    image_url: string | null;
    calories: number;
    price: number;
  } | null;
  customer: {
    full_name: string | null;
    phone: string | null;
  } | null;
  delivery_address: {
    address_line1: string;
    address_line2: string | null;
    city: string;
    phone: string | null;
    delivery_instructions: string | null;
  } | null;
  addons: ScheduleAddon[];
  driver: {
    id: string;
    full_name: string | null;
  } | null;
}

const PartnerOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState("active");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
    setLastUpdate(new Date());
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  // Initialize audio for new order notifications
  useEffect(() => {
    // Create audio element with a pleasant notification sound
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audioRef.current.volume = 0.5;
  }, []);

  // Polling for new orders (fallback for real-time)
  useEffect(() => {
    if (!restaurantId) return;

    // Poll every 10 seconds for new orders as a fallback
    pollIntervalRef.current = setInterval(() => {
      fetchOrders();
      setLastUpdate(new Date());
    }, 10000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [restaurantId]);

  // Play notification sound when new orders arrive
  const playNewOrderSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((e) => {
        // Browser might block autoplay until user interaction
        console.log("Audio play failed:", e);
      });
    }
  };

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
        (payload) => {
          // Check if a new order was inserted
          if (payload.eventType === "INSERT") {
            playNewOrderSound();
            toast({
              title: "New Order!",
              description: "A new order has been placed",
            });
          }
          // Add small delay to ensure DB transaction is committed
          setTimeout(() => {
            fetchOrders();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchOrders = async () => {
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
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch meal schedules (orders) for these meals
      const { data: schedules, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          meal_type,
          order_status,
          delivery_type,
          delivery_fee,
          addons_total,
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
        .order("created_at", { ascending: false });

      if (schedulesError) throw schedulesError;

      // Get user info from auth
      const userIds = [...new Set((schedules || []).map((s: any) => s.user_id))];
      
      let addressesMap: Record<string, any> = {};
      
      if (userIds.length > 0) {
        // Fetch default addresses
        const { data: addresses } = await supabase
          .from("user_addresses")
          .select("user_id, address_line1, address_line2, city, phone, delivery_instructions, is_default")
          .in("user_id", userIds)
          .eq("is_default", true);
        
        if (addresses) {
          addressesMap = addresses.reduce((acc: any, a: any) => {
            acc[a.user_id] = a;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Fetch addons for each schedule
      const scheduleIds = (schedules || []).map((s: any) => s.id);
      let addonsMap: Record<string, ScheduleAddon[]> = {};
      
      if (scheduleIds.length > 0) {
        const { data: addonsData } = await supabase
          .from("schedule_addons")
          .select(`
            schedule_id,
            quantity,
            addon:meal_addons (name)
          `)
          .in("schedule_id", scheduleIds);
        
        if (addonsData) {
          addonsMap = (addonsData as any[]).reduce((acc: any, a: any) => {
            if (!acc[a.schedule_id]) acc[a.schedule_id] = [];
            acc[a.schedule_id].push({
              id: `${a.schedule_id}-${a.addon?.name}`,
              addon_name: a.addon?.name || "Add-on",
              quantity: a.quantity,
            });
            return acc;
          }, {});
        }
      }

      // Fetch driver assignments (commented out until deliveries table is in types)
      const driversMap: Record<string, any> = {};

      // Transform data
      const transformedOrders: Order[] = (schedules || []).map((s: any) => ({
        id: s.id,
        order_status: (s.order_status || "pending") as OrderStatus,
        scheduled_date: s.scheduled_date,
        meal_type: s.meal_type,
        delivery_type: s.delivery_type || "standard",
        delivery_fee: s.delivery_fee,
        addons_total: s.addons_total || 0,
        created_at: s.created_at,
        meal: s.meals,
        customer: null,
        delivery_address: addressesMap[s.user_id] ? {
          address_line1: addressesMap[s.user_id].address_line1,
          address_line2: addressesMap[s.user_id].address_line2,
          city: addressesMap[s.user_id].city,
          phone: addressesMap[s.user_id].phone,
          delivery_instructions: addressesMap[s.user_id].delivery_instructions,
        } : null,
        addons: addonsMap[s.id] || [],
        driver: driversMap[s.id] || null,
      }));

      setOrders(transformedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      // Use the database function for role-based status update
      const { error } = await supabase.rpc("update_order_status", {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_user_role: "partner",
      });

      if (error) throw error;

      const statusLabel = STATUS_CONFIG[newStatus].label;
      toast({
        title: "Status updated",
        description: `Order marked as ${statusLabel}`,
      });

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, order_status: newStatus } : o
        )
      );
    } catch (error: any) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const activeOrders = orders.filter((o) => 
    o.order_status !== "completed" && o.order_status !== "cancelled"
  );
  
  const completedOrders = orders.filter((o) => 
    o.order_status === "completed" || o.order_status === "cancelled"
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

  // Status Progress Bar Component
  const StatusProgressBar = ({ currentStatus }: { currentStatus: OrderStatus }) => {
    if (currentStatus === "cancelled") {
      return (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Order Cancelled</span>
        </div>
      );
    }

    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    
    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Progress</span>
          <span>Step {currentIndex + 1} of {STATUS_FLOW.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {STATUS_FLOW.map((status, index) => {
            const isActive = index <= currentIndex;
            const isCurrent = index === currentIndex;
            
            return (
              <div key={status} className="flex items-center flex-1">
                <div 
                  className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                    isActive 
                      ? isCurrent 
                        ? "bg-primary" 
                        : "bg-primary/60"
                      : "bg-muted"
                  }`}
                />
                {index < STATUS_FLOW.length - 1 && (
                  <ArrowRight className="h-3 w-3 mx-0.5 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
          <span>Order</span>
          <span>Ready</span>
          <span>Complete</span>
        </div>
      </div>
    );
  };

  const renderOrders = (ordersList: Order[], showActions = false) => {
    if (ordersList.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No orders found</p>
          </CardContent>
        </Card>
      );
    }

    return ordersList.map((order) => {
      const statusConfig = STATUS_CONFIG[order.order_status];
      const availableActions = ACTION_BUTTONS[order.order_status] || [];

      return (
        <Card key={order.id} className="overflow-hidden">
          <CardContent className="p-4">
            {/* Order Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Order #</p>
                    <p className="font-mono text-sm font-semibold">{order.id.slice(0, 8)}</p>
                  </div>
                  <Badge variant="outline" className={statusConfig.color}>
                    <span className="flex items-center gap-1">
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {statusConfig.description}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {new Date(order.created_at).toLocaleDateString()} • {order.meal_type}
                </p>
              </div>
              {order.driver && (
                <div className="text-right">
                  <Badge className="bg-green-500/10 text-green-600">
                    <Truck className="h-3 w-3 mr-1" />
                    Driver Assigned
                  </Badge>
                </div>
              )}
            </div>

            {/* Status Progress Bar */}
            <div className="mb-4">
              <StatusProgressBar currentStatus={order.order_status} />
            </div>

            <Separator className="my-3" />

            {/* Meal Details */}
            <div className="flex gap-3 mb-4">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {order.meal?.image_url ? (
                  <img 
                    src={order.meal.image_url} 
                    alt={order.meal.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Utensils className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium">{order.meal?.name || "Meal"}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {order.meal?.calories || 0} cal
                  </span>
                  {order.addons.length > 0 && (
                    <span>+{order.addons.length} add-ons</span>
                  )}
                </div>
                {order.addons.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {order.addons.map(a => `${a.addon_name} x${a.quantity}`).join(", ")}
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Address */}
            {order.delivery_address && (
              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Delivery Address
                </p>
                <p className="text-sm">
                  {order.delivery_address.address_line1}
                  {order.delivery_address.address_line2 && `, ${order.delivery_address.address_line2}`}
                  {order.delivery_address.city && `, ${order.delivery_address.city}`}
                </p>
                {order.delivery_address.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Phone className="h-3 w-3" />
                    {order.delivery_address.phone}
                  </p>
                )}
                {order.delivery_address.delivery_instructions && (
                  <p className="text-sm text-amber-600 mt-2 flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5" />
                    {order.delivery_address.delivery_instructions}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {showActions && availableActions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t">
                <span className="text-sm text-muted-foreground mr-2">Next action:</span>
                {availableActions.map((action) => (
                  <Button
                    key={action.action}
                    size="sm"
                    variant={action.variant}
                    onClick={() => updateOrderStatus(order.id, action.action)}
                    className="flex items-center gap-1"
                  >
                    {action.icon}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/* Delivery Handoff Section - Show for ready/out_for_delivery orders */}
            {(order.order_status === "ready" || order.order_status === "out_for_delivery") && (
              <div className="mt-4 pt-3 border-t">
                <PartnerDeliveryHandoff 
                  scheduleId={order.id} 
                  restaurantName={restaurantName}
                />
              </div>
            )}

            {/* Waiting Message */}
            {showActions && availableActions.length === 0 && order.order_status === "out_for_delivery" && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                <Truck className="h-4 w-4" />
                <span>Driver is delivering this order. No action needed.</span>
              </div>
            )}
          </CardContent>
        </Card>
      );
    });
  };

  return (
    <PartnerLayout 
      title="Orders" 
      subtitle={`${activeOrders.length} active • ${completedOrders.length} completed • Updated ${lastUpdate.toLocaleTimeString()}`}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full mb-6">
          <TabsTrigger value="active" className="relative">
            Active Orders
            {activeOrders.length > 0 && (
              <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeOrders.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {renderOrders(activeOrders, true)}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {renderOrders(completedOrders)}
        </TabsContent>
      </Tabs>
    </PartnerLayout>
  );
};

export default PartnerOrders;
