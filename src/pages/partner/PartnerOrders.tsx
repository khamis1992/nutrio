import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Store,
  UtensilsCrossed,
  Package,
  Settings,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  ChefHat,
  Truck,
  User,
  Calendar,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RoleIndicator } from "@/components/RoleIndicator";
import { PartnerNavigation } from "@/components/PartnerNavigation";

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  meal: {
    name: string;
  } | null;
}

interface Order {
  id: string;
  status: string;
  total_price: number;
  delivery_date: string;
  meal_type: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  order_items: OrderItem[];
}

const statusOptions = [
  { value: "pending", label: "Pending", icon: Clock, color: "text-amber-500" },
  { value: "confirmed", label: "Confirmed", icon: CheckCircle, color: "text-blue-500" },
  { value: "preparing", label: "Preparing", icon: ChefHat, color: "text-purple-500" },
  { value: "out_for_delivery", label: "Out for Delivery", icon: Truck, color: "text-orange-500" },
  { value: "delivered", label: "Delivered", icon: CheckCircle, color: "text-green-500" },
  { value: "cancelled", label: "Cancelled", icon: XCircle, color: "text-destructive" },
];

const PartnerOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState("active");

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  // Subscribe to real-time order updates
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel("partner-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
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
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant) {
        navigate("/partner");
        return;
      }

      setRestaurantId(restaurant.id);

      // Fetch orders with items
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            id,
            quantity,
            unit_price,
            meal:meals (name)
          )
        `)
        .eq("restaurant_id", restaurant.id)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);
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

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus as "pending" | "confirmed" | "preparing" | "delivered" | "cancelled" })
        .eq("id", orderId);

      if (error) throw error;

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );

      toast({
        title: "Order updated",
        description: `Order status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "Failed to update order",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find((s) => s.value === status);
    if (!statusConfig) return <Badge variant="outline">{status}</Badge>;

    const colorClasses: Record<string, string> = {
      pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      confirmed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      preparing: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      out_for_delivery: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      delivered: "bg-green-500/10 text-green-600 border-green-500/20",
      cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    };

    return (
      <Badge variant="outline" className={colorClasses[status] || ""}>
        {statusConfig.label}
      </Badge>
    );
  };

  const activeOrders = orders.filter((o) =>
    ["pending", "confirmed", "preparing", "out_for_delivery"].includes(o.status || "")
  );
  const completedOrders = orders.filter((o) =>
    ["delivered", "cancelled"].includes(o.status || "")
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const renderOrders = (ordersList: Order[]) => {
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

    return ordersList.map((order) => (
      <Card key={order.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-semibold">Order #{order.id.slice(0, 8)}</p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(order.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            {getStatusBadge(order.status || "pending")}
          </div>

          {/* Order Items */}
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm py-1">
                <span>
                  {item.quantity}x {item.meal?.name || "Unknown Item"}
                </span>
                <span className="text-muted-foreground">
                  ${(item.quantity * parseFloat(item.unit_price.toString())).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-border mt-2 pt-2 flex justify-between font-medium">
              <span>Total</span>
              <span>${parseFloat(order.total_price.toString()).toFixed(2)}</span>
            </div>
          </div>

          {order.notes && (
            <p className="text-sm text-muted-foreground mb-3 italic">
              Note: {order.notes}
            </p>
          )}

          {/* Delivery Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Truck className="h-4 w-4" />
            <span>
              Delivery: {new Date(order.delivery_date).toLocaleDateString()}
              {order.meal_type && ` (${order.meal_type})`}
            </span>
          </div>

          {/* Status Update */}
          {!["delivered", "cancelled"].includes(order.status || "") && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Update status:</span>
              <Select
                value={order.status || "pending"}
                onValueChange={(value) => updateOrderStatus(order.id, value)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <status.icon className={`h-4 w-4 ${status.color}`} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/partner")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Orders</h1>
              <p className="text-sm text-muted-foreground">
                {activeOrders.length} active orders
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6">
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
            {renderOrders(activeOrders)}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {renderOrders(completedOrders)}
          </TabsContent>
        </Tabs>
      </main>

      <PartnerNavigation />
    </div>
  );
};

export default PartnerOrders;
