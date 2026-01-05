import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { 
  ArrowLeft, 
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  Calendar,
  Flame,
  ShoppingBag,
  UtensilsCrossed,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

interface OrderItem {
  id: string;
  quantity: number;
  meal: {
    id: string;
    name: string;
    image_url: string | null;
    calories: number;
  } | null;
}

interface Order {
  id: string;
  created_at: string;
  delivery_date: string;
  status: string;
  meal_type: string | null;
  notes: string | null;
  restaurant: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  order_items: OrderItem[];
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "bg-yellow-500/10 text-yellow-600" },
  confirmed: { label: "Confirmed", icon: CheckCircle2, color: "bg-blue-500/10 text-blue-600" },
  preparing: { label: "Preparing", icon: Package, color: "bg-purple-500/10 text-purple-600" },
  out_for_delivery: { label: "Out for Delivery", icon: Truck, color: "bg-orange-500/10 text-orange-600" },
  delivered: { label: "Delivered", icon: CheckCircle2, color: "bg-green-500/10 text-green-600" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "bg-red-500/10 text-red-600" },
};

const OrderHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        created_at,
        delivery_date,
        status,
        meal_type,
        notes,
        restaurant:restaurants (
          id,
          name,
          logo_url
        ),
        order_items (
          id,
          quantity,
          meal:meals (
            id,
            name,
            image_url,
            calories
          )
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load order history",
        variant: "destructive",
      });
    } else {
      setOrders(data as unknown as Order[]);
    }
    setLoading(false);
  };

  const handleReorder = async (order: Order) => {
    if (!user) return;
    
    setReordering(order.id);
    
    try {
      // Create new order with same items (subscription-based, no price)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          restaurant_id: order.restaurant?.id,
          delivery_date: format(tomorrow, "yyyy-MM-dd"),
          total_price: 0, // Subscription-based, no charge
          status: "pending",
          meal_type: order.meal_type,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = order.order_items
        .filter(item => item.meal)
        .map(item => ({
          order_id: newOrder.id,
          meal_id: item.meal!.id,
          quantity: item.quantity,
          unit_price: 0, // Subscription-based
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Order placed!",
        description: "Your reorder has been placed successfully.",
      });

      // Refresh orders
      fetchOrders();
    } catch (error) {
      console.error("Error reordering:", error);
      toast({
        title: "Error",
        description: "Failed to place reorder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setReordering(null);
    }
  };

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.pending;
  };

  const getTotalCalories = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + ((item.meal?.calories || 0) * item.quantity), 0);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Order History</h1>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No orders yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start exploring our delicious meals and place your first order!
              </p>
              <Button onClick={() => navigate("/meals")}>
                Browse Meals
              </Button>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => {
            const statusInfo = getStatusInfo(order.status);
            const StatusIcon = statusInfo.icon;
            const totalCalories = getTotalCalories(order.order_items);
            
            return (
              <Card key={order.id} className="overflow-hidden">
                <CardContent className="p-4">
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                        {order.restaurant?.logo_url ? (
                          <img 
                            src={order.restaurant.logo_url} 
                            alt={order.restaurant.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {order.restaurant?.name || "Restaurant"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${statusInfo.color} border-0`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-2 mb-3">
                    {order.order_items.map((item) => (
                      <div 
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                      >
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                          {item.meal?.image_url ? (
                            <img 
                              src={item.meal.image_url} 
                              alt={item.meal.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.meal?.name || "Unknown meal"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                          Included
                        </Badge>
                      </div>
                    ))}
                  </div>

                  {/* Order Summary */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(order.delivery_date), "MMM d")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Flame className="h-3 w-3" />
                        {totalCalories} kcal
                      </span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      Subscription Order
                    </Badge>
                  </div>

                  {/* Reorder Button */}
                  {order.status === "delivered" && (
                    <Button
                      variant="outline"
                      className="w-full mt-3"
                      onClick={() => handleReorder(order)}
                      disabled={reordering === order.id}
                    >
                      {reordering === order.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Reorder
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <CustomerNavigation />
    </div>
  );
};

export default OrderHistory;
