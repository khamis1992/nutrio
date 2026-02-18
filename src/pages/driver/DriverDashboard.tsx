import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Package, Navigation, Store, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DriverLayout } from "@/components/DriverLayout";

interface AvailableDelivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  estimated_distance_km: number | null;
  delivery_fee: number;
  tip_amount: number;
  created_at: string;
  restaurant: {
    name: string;
    address: string | null;
  } | null;
  meal_schedule?: {
    meal_name: string;
    customer_name: string;
    customer_phone: string | null;
  } | null;
}

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [availableDeliveries, setAvailableDeliveries] = useState<AvailableDelivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<AvailableDelivery | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ today: 0, week: 0, balance: 0 });

  useEffect(() => {
    if (user) {
      fetchDriverData();
    }
  }, [user]);

  useEffect(() => {
    if (driverId) {
      fetchAvailableDeliveries();
      fetchActiveDelivery();
      fetchStats();
    }
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel("driver-deliveries")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deliveries",
        },
        () => {
          fetchAvailableDeliveries();
          fetchActiveDelivery();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  const fetchDriverData = async () => {
    if (!user) return;

    try {
      const { data: driver, error } = await supabase
        .from("drivers")
        .select("id, is_online, wallet_balance, total_deliveries")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setDriverId(driver.id);
      setIsOnline(driver.is_online || false);
    } catch (error) {
      console.error("Error fetching driver data:", error);
      toast({
        title: "Error",
        description: "Failed to load driver data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableDeliveries = async () => {
    if (!driverId) return;

    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          status,
          pickup_address,
          delivery_address,
          estimated_distance_km,
          delivery_fee,
          tip_amount,
          created_at,
          restaurant:restaurants (name, address),
          meal_schedule:meal_schedules (
            meal_name,
            user_id
          )
        `)
        .eq("status", "pending")
        .is("driver_id", null)
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) throw error;

      // Fetch user profiles and addresses separately for customer info
      const userIds = (data || [])
        .filter((d: any) => d.meal_schedule?.user_id)
        .map((d: any) => d.meal_schedule.user_id);
      
      let profilesMap: Record<string, { full_name: string }> = {};
      let addressesMap: Record<string, { phone: string | null }> = {};
      
      if (userIds.length > 0) {
        const uniqueUserIds = [...new Set(userIds)];
        
        // Fetch profiles for names
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", uniqueUserIds);
        
        profiles?.forEach((p: any) => {
          profilesMap[p.user_id] = p;
        });
        
        // Fetch addresses for phone numbers
        const { data: addresses } = await supabase
          .from("user_addresses")
          .select("user_id, phone")
          .in("user_id", uniqueUserIds)
          .eq("is_default", true);
        
        addresses?.forEach((a: any) => {
          addressesMap[a.user_id] = a;
        });
      }

      const transformed: AvailableDelivery[] = (data || []).map((d: any) => ({
        id: d.id,
        status: d.status,
        pickup_address: d.pickup_address,
        delivery_address: d.delivery_address,
        estimated_distance_km: d.estimated_distance_km,
        delivery_fee: d.delivery_fee || 0,
        tip_amount: d.tip_amount || 0,
        created_at: d.created_at,
        restaurant: d.restaurant || null,
        meal_schedule: d.meal_schedule ? {
          meal_name: d.meal_schedule.meal_name,
          customer_name: profilesMap[d.meal_schedule.user_id]?.full_name || "Customer",
          customer_phone: addressesMap[d.meal_schedule.user_id]?.phone || null,
        } : null,
      }));

      setAvailableDeliveries(transformed);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const fetchActiveDelivery = async () => {
    if (!driverId) return;

    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          status,
          pickup_address,
          delivery_address,
          estimated_distance_km,
          delivery_fee,
          tip_amount,
          created_at,
          restaurant:restaurants (name, address),
          meal_schedule:meal_schedules (
            meal_name,
            user_id
          )
        `)
        .eq("driver_id", driverId)
        .in("status", ["claimed", "picked_up", "on_the_way"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const d = data as any;
        
        // Fetch customer info if meal_schedule exists
        let customerInfo = { name: "Customer", phone: null as string | null };
        if (d.meal_schedule?.user_id) {
          const [{ data: profile }, { data: address }] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", d.meal_schedule.user_id)
              .single(),
            supabase
              .from("user_addresses")
              .select("phone")
              .eq("user_id", d.meal_schedule.user_id)
              .eq("is_default", true)
              .single()
          ]);
          
          if (profile) {
            customerInfo.name = profile.full_name || "Customer";
          }
          if (address) {
            customerInfo.phone = address.phone;
          }
        }
        
        setActiveDelivery({
          id: d.id,
          status: d.status,
          pickup_address: d.pickup_address,
          delivery_address: d.delivery_address,
          estimated_distance_km: d.estimated_distance_km,
          delivery_fee: d.delivery_fee || 0,
          tip_amount: d.tip_amount || 0,
          created_at: d.created_at,
          restaurant: d.restaurant || null,
          meal_schedule: d.meal_schedule ? {
            meal_name: d.meal_schedule.meal_name,
            customer_name: customerInfo.name,
            customer_phone: customerInfo.phone,
          } : null,
        });
      } else {
        setActiveDelivery(null);
      }
    } catch (error) {
      console.error("Error fetching active delivery:", error);
    }
  };

  const fetchStats = async () => {
    if (!driverId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: driver } = await supabase
        .from("drivers")
        .select("wallet_balance")
        .eq("id", driverId)
        .single();

      const { count: todayCount } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("driver_id", driverId)
        .eq("status", "delivered")
        .gte("delivered_at", today.toISOString());

      const { count: weekCount } = await supabase
        .from("deliveries")
        .select("*", { count: "exact", head: true })
        .eq("driver_id", driverId)
        .eq("status", "delivered")
        .gte("delivered_at", weekAgo.toISOString());

      setStats({
        today: todayCount || 0,
        week: weekCount || 0,
        balance: driver?.wallet_balance || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAvailableDeliveries(), fetchStats()]);
  };

  const handleClaimDelivery = async (deliveryId: string) => {
    if (!driverId || !isOnline) return;

    setClaimingId(deliveryId);

    try {
      const { error } = await supabase
        .from("deliveries")
        .update({
          driver_id: driverId,
          status: "claimed",
          claimed_at: new Date().toISOString(),
        })
        .eq("id", deliveryId)
        .eq("status", "pending")
        .is("driver_id", null);

      if (error) throw error;

      toast({
        title: "Delivery claimed!",
        description: "Navigate to the restaurant to pick up the order.",
      });

      navigate(`/driver/orders/${deliveryId}`);
    } catch (error: any) {
      console.error("Error claiming delivery:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to claim delivery",
        variant: "destructive",
      });
    } finally {
      setClaimingId(null);
    }
  };

  if (loading) {
    return (
      <DriverLayout title="Driver Dashboard">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DriverLayout>
    );
  }

  const totalEarnings = (delivery: AvailableDelivery) => delivery.delivery_fee + delivery.tip_amount;

  return (
    <DriverLayout title="Available Orders" subtitle={`${availableDeliveries.length} orders nearby`}>
      <div className="space-y-4">
        {!isOnline && (
          <Card className="bg-amber-500/10 border-amber-500/20">
            <CardContent className="py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-600">You're Offline</p>
                <p className="text-sm text-muted-foreground">
                  Go online to see and claim delivery orders
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {activeDelivery && (
          <Card className="bg-green-500/10 border-green-500/20 cursor-pointer" onClick={() => navigate(`/driver/orders/${activeDelivery.id}`)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <Badge className="bg-green-600">Active Delivery</Badge>
                <span className="text-sm text-muted-foreground">
                  Tap to continue
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  🍽️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{activeDelivery.restaurant?.name || "Restaurant"}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {activeDelivery.delivery_address}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-green-600">QAR {totalEarnings(activeDelivery).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Available Orders</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {availableDeliveries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No orders available right now</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back soon for new delivery opportunities
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {availableDeliveries.map((delivery) => (
              <Card key={delivery.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      🍽️
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold truncate">{delivery.restaurant?.name || "Restaurant"}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Store className="h-3 w-3" />
                            <span className="truncate">{delivery.pickup_address}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-green-600">QAR {totalEarnings(delivery).toFixed(2)}</p>
                          {delivery.tip_amount > 0 && (
                            <p className="text-xs text-green-500">+QAR {delivery.tip_amount.toFixed(2)} tip</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        {delivery.estimated_distance_km && (
                          <span className="flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            {delivery.estimated_distance_km.toFixed(1)} km
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate max-w-[150px]">{delivery.delivery_address}</span>
                        </span>
                      </div>

                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleClaimDelivery(delivery.id)}
                        disabled={!isOnline || claimingId === delivery.id}
                      >
                        {claimingId === delivery.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Claim Delivery
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DriverLayout>
  );
}
