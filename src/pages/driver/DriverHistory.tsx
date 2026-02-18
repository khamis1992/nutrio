import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, MapPin, Calendar, ChevronRight, TrendingUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DriverLayout } from "@/components/DriverLayout";

interface DeliveryHistory {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  delivery_fee: number;
  tip_amount: number;
  delivered_at: string;
  restaurant: {
    name: string;
  } | null;
}

export default function DriverHistory() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryHistory[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    totalEarnings: 0,
    avgEarnings: 0,
  });

  useEffect(() => {
    if (user) {
      fetchDriverData();
    }
  }, [user]);

  useEffect(() => {
    if (driverId) {
      fetchHistory();
    }
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
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!driverId) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          status,
          pickup_address,
          delivery_address,
          delivery_fee,
          tip_amount,
          delivered_at,
          restaurant:restaurants (name)
        `)
        .eq("driver_id", driverId)
        .eq("status", "delivered")
        .gte("delivered_at", thirtyDaysAgo.toISOString())
        .order("delivered_at", { ascending: false });

      if (error) throw error;

      const transformed: DeliveryHistory[] = (data || []).map((d: any) => ({
        id: d.id,
        status: d.status,
        pickup_address: d.pickup_address,
        delivery_address: d.delivery_address,
        delivery_fee: d.delivery_fee || 0,
        tip_amount: d.tip_amount || 0,
        delivered_at: d.delivered_at,
        restaurant: d.restaurant || null,
      }));

      setDeliveries(transformed);

      const totalEarnings = transformed.reduce(
        (sum, d) => sum + d.delivery_fee + d.tip_amount,
        0
      );

      setStats({
        total: transformed.length,
        totalEarnings,
        avgEarnings: transformed.length > 0 ? totalEarnings / transformed.length : 0,
      });
    } catch (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "Error",
        description: "Failed to load delivery history",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DriverLayout title="History">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout title="Delivery History" subtitle="Last 30 days">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Deliveries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-green-600">QAR {stats.totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Earnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold">QAR {stats.avgEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Avg/Order</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {deliveries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No deliveries in the last 30 days</p>
              </CardContent>
            </Card>
          ) : (
            deliveries.map((delivery) => (
              <Card key={delivery.id}>
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      🍽️
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold truncate">{delivery.restaurant?.name || "Restaurant"}</p>
                        <p className="font-bold text-green-600">
                          QAR {(delivery.delivery_fee + delivery.tip_amount).toFixed(2)}
                        </p>
                      </div>

                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {delivery.pickup_address}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(delivery.delivered_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{delivery.delivery_address}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DriverLayout>
  );
}
