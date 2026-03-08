import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Clock,
  ChefHat,
  Truck,
  CheckCheck,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/constants/order-status";

interface ActiveOrder {
  id: string;
  restaurant_name: string;
  restaurant_logo: string;
  status: OrderStatus;
  delivery_date: string;
  meal_type: string;
  meal_name: string;
  driver_name?: string;
  driver_phone?: string;
  estimated_arrival?: string;
}

export function OrderTrackingHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActiveOrders = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("meal_schedules")
      .select(
        `
        id,
        scheduled_date,
        meal_type,
        order_status,
        meals (name, restaurants (name, logo_url)),
        delivery_jobs (driver_id, drivers (full_name, phone))
      `
      )
      .eq("user_id", user.id)
      .in("order_status", [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
      ])
      .order("scheduled_date", { ascending: true });

    if (!error && data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = (data as any[]).map((order) => ({
        id: order.id as string,
        restaurant_name: order.meals?.restaurants?.name || "Unknown",
        restaurant_logo: order.meals?.restaurants?.logo_url || "",
        status: order.order_status as OrderStatus,
        delivery_date: order.scheduled_date as string,
        meal_type: order.meal_type as string,
        meal_name: order.meals?.name || "Unknown meal",
        driver_name: order.delivery_jobs?.[0]?.drivers?.full_name,
        driver_phone: order.delivery_jobs?.[0]?.drivers?.phone,
      }));
      
      setActiveOrders(orders);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchActiveOrders();
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("order-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meal_schedules",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchActiveOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveOrders();
  };

  const getStatusIcon = (status: OrderStatus) => {
    const icons: Record<string, typeof Package> = {
      pending: Package,
      confirmed: CheckCheck,
      preparing: ChefHat,
      ready: Package,
      out_for_delivery: Truck,
      delivered: CheckCheck,
    };
    const Icon = icons[status] || Package;
    return <Icon className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading your orders...</p>
        </CardContent>
      </Card>
    );
  }

  if (activeOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            No Active Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You don&apos;t have any orders being prepared right now.
          </p>
          <Button onClick={() => navigate("/meals")}>
            Browse Meals <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Active Orders ({activeOrders.length})
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh orders"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeOrders.map((order) => {
          const statusConfig = ORDER_STATUS_CONFIG[order.status];

          return (
            <Link
              key={order.id}
              to={`/tracking?id=${order.id}`}
              className="block"
            >
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <div
                  className={`h-12 w-12 rounded-full ${statusConfig.color} flex items-center justify-center text-white`}
                >
                  {getStatusIcon(order.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{order.meal_name}</p>
                    <Badge variant="outline" className="text-xs">
                      {order.meal_type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {order.restaurant_name}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {statusConfig.label} • {statusConfig.description}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </Link>
          );
        })}

        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate("/dashboard")}
        >
          View All Orders
        </Button>
      </CardContent>
    </Card>
  );
}
