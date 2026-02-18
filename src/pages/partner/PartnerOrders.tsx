import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
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
  User,
  Package,
  ChefHat,
  Truck,
  CircleDot,
  MapPin,
  Phone,
  Utensils,
  Flame,
  Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";

type OrderStatus = "pending" | "confirmed" | "preparing" | "delivered" | "cancelled";

const ORDER_STATUSES: { value: OrderStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "pending", label: "Pending", icon: <CircleDot className="h-4 w-4" />, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "confirmed", label: "Confirmed", icon: <CheckCircle className="h-4 w-4" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "preparing", label: "Preparing", icon: <ChefHat className="h-4 w-4" />, color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  { value: "delivered", label: "Delivered", icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-500/10 text-green-600 border-green-500/20" },
  { value: "cancelled", label: "Cancelled", icon: <CircleDot className="h-4 w-4" />, color: "bg-red-500/10 text-red-600 border-red-500/20" },
];

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
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState("active");

  useEffect(() => {
    if (user) {
      fetchOrders();
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
          fetchOrders();
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
      
      let profilesMap: Record<string, any> = {};
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

      // Fetch driver assignments
      let driversMap: Record<string, any> = {};
      if (scheduleIds.length > 0) {
        const { data: deliveries } = await supabase
          .from("deliveries")
          .select(`
            schedule_id,
            driver_id,
            driver:drivers (
              id,
              user_id
            )
          `)
          .in("schedule_id", scheduleIds)
          .not("driver_id", "is", null);
        
        if (deliveries) {
          driversMap = (deliveries as any[]).reduce((acc: any, d: any) => {
            if (d.driver_id) {
              acc[d.schedule_id] = {
                id: d.driver_id,
                full_name: null, // Will fetch separately if needed
              };
            }
            return acc;
          }, {});
        }
      }

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
        customer: null, // Simplified for now
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
      const { error } = await supabase
        .from("meal_schedules")
        .update({ order_status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Status updated",
        description: `Order marked as ${newStatus}`,
      });

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, order_status: newStatus } : o
        )
      );
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const activeOrders = orders.filter((o) => 
    o.order_status !== "delivered" && o.order_status !== "cancelled"
  );
  
  const completedOrders = orders.filter((o) => 
    o.order_status === "delivered"
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

  const renderOrders = (ordersList: Order[], showStatusControl = false) => {
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
      const statusConfig = getStatusConfig(order.order_status);

      return (
        <Card key={order.id}>
          <CardContent className="p-4">
            {/* Order Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
                  <Badge variant="outline" className={statusConfig.color}>
                    <span className="flex items-center gap-1">
                      {statusConfig.icon}
                      {statusConfig.label}
                    </span>
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
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
                    {order.meal?.calories || 0} kcal
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

            {/* Status Control */}
            {showStatusControl && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                <span className="text-sm text-muted-foreground">Update status:</span>
                <Select
                  value={order.order_status}
                  onValueChange={(value) => updateOrderStatus(order.id, value as OrderStatus)}
                >
                  <SelectTrigger className="w-[180px] h-9">
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
          </CardContent>
        </Card>
      );
    });
  };

  return (
    <PartnerLayout title="Orders" subtitle={`${activeOrders.length} active • ${completedOrders.length} completed`}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-full mb-6">
          <TabsTrigger value="active" className="relative">
            Active
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
