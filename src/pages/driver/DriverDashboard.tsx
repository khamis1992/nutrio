import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Package, Navigation, Store, RefreshCw, Play, Square, Wifi, WifiOff, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  startBroadcasting,
  stopBroadcasting,
  subscribe,
  type BroadcastStatus,
} from "@/services/driver-location-service";


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

const asJsonObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

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
  const [gpsStatus, setGpsStatus] = useState<BroadcastStatus>("idle");
  const [gpsError, setGpsError] = useState<string | undefined>();
  const [gpsLastUpdate, setGpsLastUpdate] = useState<Date | null>(null);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);

  // Subscribe to GPS broadcast state
  useEffect(() => {
    const unsub = subscribe((s) => {
      setGpsStatus(s.status);
      setGpsError(s.errorMessage);
      setGpsLastUpdate(s.lastUpdate);
    });
    return unsub;
  }, []);

  // Ensure GPS broadcasting stops on unmount
  useEffect(() => {
    return () => {
      stopBroadcasting();
    };
  }, []);

  useEffect(() => {
    if (user) {
      fetchDriverData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (driverId) {
      fetchAvailableDeliveries();
      fetchActiveDelivery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          table: "delivery_jobs",
        },
        () => {
          fetchAvailableDeliveries();
          fetchActiveDelivery();
        }
      )
      .subscribe();

    // Poll every 15 seconds as a fallback
    const interval = setInterval(() => {
      fetchAvailableDeliveries();
      fetchActiveDelivery();
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Get driver_profile ID for GPS broadcasting
      const { data: profile } = await supabase
        .from("driver_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) setDriverProfileId(profile.id);
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
      // Fetch delivery jobs without embedded queries to avoid FK issues
      const { data: deliveries, error } = await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("status", "pending")
        .is("driver_id", null)
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) throw error;

      if (!deliveries || deliveries.length === 0) {
        setAvailableDeliveries([]);
        return;
      }

      // Get unique IDs for batch fetching
      const restaurantIds = [...new Set(deliveries.map(d => d.restaurant_id).filter((id): id is string => !!id))];
      const scheduleIds = [...new Set(deliveries.map(d => d.schedule_id).filter((id): id is string => !!id))];

      // Fetch restaurants separately
      const { data: restaurants } = restaurantIds.length > 0 ? await supabase
        .from("restaurants")
        .select("id, name, address")
        .in("id", restaurantIds) : { data: [] };

      const restaurantsMap: Record<string, { name: string; address: string | null }> = {};
      restaurants?.forEach(r => {
        restaurantsMap[r.id] = r;
      });

      // Fetch meal and customer info via RPC function
      const { data: mealInfo } = scheduleIds.length > 0 ? await supabase.rpc(
        "get_meal_info_for_schedules",
        { p_schedule_ids: scheduleIds }
      ) : { data: [] };

      // Create schedule info map from RPC result
      const scheduleMap: Record<string, { meal_name: string; customer_name: string; customer_phone: string | null }> = {};
      (Array.isArray(mealInfo) ? mealInfo : []).forEach((item) => {
        const info = asJsonObject(item);
        const scheduleId = readString(info?.schedule_id);
        if (!scheduleId) return;
        scheduleMap[scheduleId] = {
          meal_name: readString(info?.meal_name, "Meal"),
          customer_name: readString(info?.customer_name, "Customer"),
          customer_phone: typeof info?.customer_phone === "string" ? info.customer_phone : null,
        };
      });

      const transformed: AvailableDelivery[] = deliveries.map(d => ({
        id: d.id as string,
        status: (d.status as string) || "pending",
        pickup_address: (d.pickup_address as string) || "",
        delivery_address: (d.delivery_address as string) || "",
        estimated_distance_km: d.estimated_distance_km as number | null,
        delivery_fee: (d.delivery_fee as number) || 0,
        tip_amount: (d.tip_amount as number) || 0,
        created_at: (d.created_at as string) || new Date().toISOString(),
        restaurant: d.restaurant_id ? restaurantsMap[d.restaurant_id] || null : null,
        meal_schedule: d.schedule_id ? scheduleMap[d.schedule_id] || null : null,
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
      // Fetch active delivery job without embedded queries
      const { data: delivery, error } = await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("driver_id", driverId)
        .in("status", ["assigned", "accepted", "picked_up", "in_transit"])
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!delivery) {
        setActiveDelivery(null);
        return;
      }

      // Fetch restaurant separately
      let restaurantData = null;
      if (delivery.restaurant_id) {
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name, address")
          .eq("id", delivery.restaurant_id)
          .single();
        restaurantData = restaurant;
      }

      const { data: details, error: detailsError } = await supabase.rpc(
        "get_delivery_details_for_driver",
        { p_delivery_job_id: delivery.id }
      );
      if (detailsError) throw detailsError;

      const detailObject = asJsonObject(details);
      const mealScheduleData = detailObject ? {
        meal_name: readString(detailObject.meal_name, "Meal"),
        customer_name: readString(detailObject.customer_name, "Customer"),
        customer_phone: typeof detailObject.customer_phone === "string" ? detailObject.customer_phone : null,
      } : null;

      setActiveDelivery({
        id: delivery.id as string,
        status: (delivery.status as string) || "assigned",
        pickup_address: (delivery.pickup_address as string) || "",
        delivery_address: (delivery.delivery_address as string) || "",
        estimated_distance_km: delivery.estimated_distance_km as number | null,
        delivery_fee: (delivery.delivery_fee as number) || 0,
        tip_amount: (delivery.tip_amount as number) || 0,
        created_at: (delivery.created_at as string) || new Date().toISOString(),
        restaurant: restaurantData,
        meal_schedule: mealScheduleData,
      });
    } catch (error) {
      console.error("Error fetching active delivery:", error);
      setActiveDelivery(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchAvailableDeliveries(), fetchActiveDelivery()]);
  };

  const handleClaimDelivery = async (deliveryId: string) => {
    if (!driverId || !isOnline) return;

    setClaimingId(deliveryId);

    try {
      // Use atomic RPC function to prevent race conditions
      const { data: result, error } = await supabase.rpc("claim_delivery_job", {
        p_job_id: deliveryId,
        p_driver_id: driverId,
      });

      if (error) throw error;

      // Check the result from the atomic function
      const resultObject = asJsonObject(result);
      if (resultObject?.success !== true) {
        const errorMessages: Record<string, string> = {
          LOCKED: "This delivery is being processed. Please try again.",
          NOT_FOUND: "Delivery no longer exists.",
          ALREADY_CLAIMED: "This delivery was just claimed by another driver.",
          INVALID_STATE: "This delivery is no longer available.",
          DRIVER_UNAVAILABLE: "You must be online to claim deliveries.",
          DRIVER_BUSY: "You already have an active delivery. Complete it first.",
        };

        toast({
          title: "Unable to Claim",
          description: errorMessages[readString(resultObject?.code)] || readString(resultObject?.error, "Failed to claim delivery"),
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Delivery claimed!",
        description: "Navigate to the restaurant to pick up the order.",
      });

      navigate(`/driver/orders/${deliveryId}`);
    } catch (error) {
      console.error("Error claiming delivery:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to claim delivery",
        variant: "destructive",
      });
    } finally {
      setClaimingId(null);
    }
  };

  const handleStartShift = useCallback(async () => {
    if (!driverProfileId || !driverId) {
      toast({ title: "Error", description: "Driver profile not found", variant: "destructive" });
      return;
    }
    const ok = await startBroadcasting(driverProfileId);
    if (!ok) {
      toast({ title: "GPS Error", description: gpsError || "Could not start GPS", variant: "destructive" });
      return;
    }
    // Also set driver online
    const { error } = await supabase.from("drivers").update({ is_online: true }).eq("id", driverId);
    if (error) {
      await stopBroadcasting();
      toast({ title: "Shift Error", description: error.message, variant: "destructive" });
      return;
    }
    setIsOnline(true);
    toast({ title: "Shift Started", description: "GPS broadcasting active. You're now online." });
  }, [driverProfileId, driverId, gpsError, toast]);

  const handleEndShift = useCallback(async () => {
    if (driverId) {
      const { error } = await supabase.from("drivers").update({ is_online: false }).eq("id", driverId);
      if (error) {
        toast({ title: "Shift Error", description: error.message, variant: "destructive" });
        return;
      }
    }
    await stopBroadcasting();
    setIsOnline(false);
    toast({ title: "Shift Ended", description: "GPS broadcasting stopped." });
  }, [driverId, toast]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const totalEarnings = (delivery: AvailableDelivery) => delivery.delivery_fee + delivery.tip_amount;

  return (
    <div className="p-4 space-y-4">
        {/* GPS / Shift Control Card */}
        <Card className={`border ${gpsStatus === "broadcasting" ? "bg-green-500/10 border-green-500/20" : gpsStatus === "error" ? "bg-red-500/10 border-red-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {gpsStatus === "broadcasting" ? (
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Wifi className="h-5 w-5 text-green-600" />
                  </div>
                ) : gpsStatus === "error" ? (
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <WifiOff className="h-5 w-5 text-amber-600" />
                  </div>
                )}
                <div>
                  <p className={`font-medium ${gpsStatus === "broadcasting" ? "text-green-600" : gpsStatus === "error" ? "text-red-600" : "text-amber-600"}`}>
                    {gpsStatus === "broadcasting" ? "GPS Active" : gpsStatus === "error" ? "GPS Error" : "GPS Off"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {gpsStatus === "broadcasting"
                      ? `Last update: ${gpsLastUpdate ? new Date(gpsLastUpdate).toLocaleTimeString() : "waiting..."}`
                      : gpsStatus === "error"
                      ? gpsError || "Check GPS permissions"
                      : "Start your shift to begin broadcasting"}
                  </p>
                </div>
              </div>
              {gpsStatus === "broadcasting" ? (
                <Button variant="destructive" size="sm" onClick={handleEndShift} className="gap-1.5">
                  <Square className="w-3.5 h-3.5" /> End Shift
                </Button>
              ) : (
                <Button size="sm" onClick={handleStartShift} className="gap-1.5 bg-green-600 hover:bg-green-700">
                  <Play className="w-3.5 h-3.5" /> Start Shift
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

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
  );
}
