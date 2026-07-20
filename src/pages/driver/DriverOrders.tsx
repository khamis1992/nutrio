import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CustomerSubscriptionBadge } from "@/components/partner/CustomerSubscriptionBadge";
import {
  fetchPartnerCustomerRetentionStatuses,
  type PartnerCustomerRetentionStatus,
} from "@/lib/partner-customer-retention";
import type { Database } from "@/integrations/supabase/types";


interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  delivery_fee: number;
  tip_amount: number;
  created_at: string;
  claimed_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  user_id: string | null;
  restaurant: {
    name: string;
  } | null;
}

type DeliveryJobRow = Database["public"]["Tables"]["delivery_jobs"]["Row"];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  assigned: { label: "Assigned", color: "bg-blue-500" },
  accepted: { label: "Accepted", color: "bg-blue-500" },
  picked_up: { label: "Picked Up", color: "bg-purple-500" },
  in_transit: { label: "In Transit", color: "bg-orange-500" },
  delivered: { label: "Delivered", color: "bg-green-500" },
  completed: { label: "Completed", color: "bg-green-600" },
  failed: { label: "Failed", color: "bg-red-500" },
  cancelled: { label: "Cancelled", color: "bg-gray-500" },
};

export default function DriverOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [completedDeliveries, setCompletedDeliveries] = useState<Delivery[]>([]);
  const [retentionStatuses, setRetentionStatuses] = useState<Record<string, PartnerCustomerRetentionStatus>>({});

  useEffect(() => {
    if (user) {
      fetchDriverData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (driverId) {
      fetchDeliveries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel("driver-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_jobs",
        },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const fetchDriverData = async () => {
    if (!user) return;

    try {
      const { data: driver, error } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setDriverId(driver.id);
    } catch (error) {
      console.error("Error fetching driver data:", error);
      toast({
        title: "Error",
        description: "Failed to load driver data",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const fetchDeliveries = async () => {
    if (!driverId) return;

    try {
      // Fetch active delivery jobs without embedded queries
      const { data: active, error: activeError } = await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("driver_id", driverId)
        .in("status", ["assigned", "accepted", "picked_up", "in_transit"])
        .order("created_at", { ascending: false });

      if (activeError) throw activeError;

      // Fetch completed delivery jobs (delivered and completed statuses)
      const { data: completed, error: completedError } = await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("driver_id", driverId)
        .in("status", ["delivered", "completed"])
        .order("delivered_at", { ascending: false })
        .limit(50);

      if (completedError) throw completedError;

      // Get unique restaurant IDs
      const allJobs = [...(active || []), ...(completed || [])];
      const restaurantIds = [...new Set(allJobs.map(j => j.restaurant_id).filter((id): id is string => !!id))];

      // Fetch restaurants separately
      const { data: restaurants } = restaurantIds.length > 0 ? await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", restaurantIds) : { data: [] };

      const restaurantsMap: Record<string, { name: string }> = {};
      restaurants?.forEach(r => {
        restaurantsMap[r.id] = r;
      });

      const orderIds = [...new Set(allJobs.map(j => j.order_id).filter((id): id is string => !!id))];
      const scheduleIds = [...new Set(allJobs.map(j => j.schedule_id).filter((id): id is string => !!id))];

      const [ordersResult, schedulesResult] = await Promise.all([
        orderIds.length > 0
          ? supabase.from("orders").select("id, user_id").in("id", orderIds)
          : Promise.resolve({ data: [], error: null }),
        scheduleIds.length > 0
          ? supabase.from("meal_schedules").select("id, user_id").in("id", scheduleIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (schedulesResult.error) throw schedulesResult.error;

      const userIdByOrderId: Record<string, string> = {};
      ordersResult.data?.forEach(order => {
        if (order.user_id) userIdByOrderId[order.id] = order.user_id;
      });

      const userIdByScheduleId: Record<string, string> = {};
      schedulesResult.data?.forEach(schedule => {
        if (schedule.user_id) userIdByScheduleId[schedule.id] = schedule.user_id;
      });

      const transformDelivery = (d: DeliveryJobRow): Delivery => ({
        id: d.id,
        status: d.status ?? "assigned",
        pickup_address: d.pickup_address || "",
        delivery_address: d.delivery_address || "",
        delivery_fee: d.delivery_fee || 0,
        tip_amount: d.tip_amount || 0,
        created_at: d.created_at ?? d.assigned_at ?? "",
        claimed_at: d.assigned_at,
        picked_up_at: d.picked_up_at,
        delivered_at: d.delivered_at,
        user_id: d.order_id
          ? userIdByOrderId[d.order_id] ?? null
          : d.schedule_id
            ? userIdByScheduleId[d.schedule_id] ?? null
            : null,
        restaurant: d.restaurant_id ? restaurantsMap[d.restaurant_id] ?? null : null,
      });

      const nextActiveDeliveries = (active || []).map(transformDelivery);
      const nextCompletedDeliveries = (completed || []).map(transformDelivery);
      const deliveryUserIds = [
        ...nextActiveDeliveries,
        ...nextCompletedDeliveries,
      ].map(delivery => delivery.user_id).filter((id): id is string => !!id);

      setRetentionStatuses(await fetchPartnerCustomerRetentionStatuses(deliveryUserIds));
      setActiveDeliveries(nextActiveDeliveries);
      setCompletedDeliveries(nextCompletedDeliveries);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderDeliveryCard = (delivery: Delivery, isActive: boolean = false) => {
    const statusConfig = STATUS_CONFIG[delivery.status] || { label: delivery.status, color: "bg-gray-500" };
    const totalEarnings = delivery.delivery_fee + delivery.tip_amount;

    return (
      <Card
        key={delivery.id}
        className={`cursor-pointer transition-all hover:shadow-md ${isActive ? "border-green-500/50" : ""}`}
        onClick={() => navigate(`/driver/orders/${delivery.id}`)}
      >
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
              🍽️
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-semibold truncate">{delivery.restaurant?.name || "Restaurant"}</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-green-600">QAR {totalEarnings.toFixed(2)}</p>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <p className="text-sm text-muted-foreground truncate mb-2">
                {delivery.pickup_address}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                  {delivery.tip_amount > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-500/50">
                      +QAR {delivery.tip_amount.toFixed(2)} tip
                    </Badge>
                  )}
                  <CustomerSubscriptionBadge
                    compact
                    status={delivery.user_id ? retentionStatuses[delivery.user_id] : null}
                  />
                </div>

                {delivery.delivered_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(delivery.delivered_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4">
      <Tabs defaultValue="active">
        <TabsList className="grid grid-cols-2 w-full mb-4">
          <TabsTrigger value="active" className="relative">
            Active
            {activeDeliveries.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                {activeDeliveries.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {activeDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No active deliveries</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Claim an order from the dashboard to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            activeDeliveries.map((delivery) => renderDeliveryCard(delivery, true))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-3">
          {completedDeliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No completed deliveries yet</p>
              </CardContent>
            </Card>
          ) : (
            completedDeliveries.map((delivery) => renderDeliveryCard(delivery, false))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
