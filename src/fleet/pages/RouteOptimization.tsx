import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { calculateDistance, formatDistance } from "@/lib/distance";
import {
  loadAutoDispatchRules,
  setRoutePlanLock,
  isRoutePlanLocked,
} from "@/fleet/services/orderDispatch";
import {
  Route,
  MapPin,
  Users,
  Package,
  Zap,
  RotateCcw,
  CheckCircle,
  Truck,
  Navigation,
  WifiOff,
  AlertTriangle,
  Play,
} from "lucide-react";
import type { Driver } from "@/fleet/types";

// ─── Data shapes ────────────────────────────────────────────────────────────

interface Delivery {
  id: string;
  pickupAddress: string;
  deliveryAddress: string;
  priority: "high" | "normal" | "low";
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  restaurantName: string | null;
}

interface AssignedRoute {
  driverId: string;
  driverName: string;
  deliveries: (Delivery & { distanceKm: number | null })[];
  totalDistanceKm: number | null;
}

const MAX_JOBS_PER_DRIVER = 3;

// ─── Geo-aware nearest-driver algorithm ─────────────────────────────────────

function buildNearestDriverRoutes(
  deliveries: Delivery[],
  drivers: Driver[],
  jobCountMap: Map<string, number>
): AssignedRoute[] {
  // Sort deliveries: high priority first, then by pickup lat (rough geographic clustering)
  const sorted = [...deliveries].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority === "high" ? -1 : b.priority === "high" ? 1 : 0;
    }
    return 0;
  });

  // Working assignment map: driverId → deliveries assigned this session
  const sessionJobs = new Map<string, (Delivery & { distanceKm: number | null })[]>();
  drivers.forEach((d) => sessionJobs.set(d.id, []));

  for (const delivery of sorted) {
    const pickupLat = delivery.pickupLat;
    const pickupLng = delivery.pickupLng;

    // Score each driver: prefer closest with fewest jobs
    let bestDriverId: string | null = null;
    let bestScore = Infinity;

    for (const driver of drivers) {
      const currentJobs =
        (jobCountMap.get(driver.id) || 0) + (sessionJobs.get(driver.id)?.length || 0);

      if (currentJobs >= MAX_JOBS_PER_DRIVER) continue; // skip overloaded

      let distKm: number | null = null;
      if (
        pickupLat != null &&
        pickupLng != null &&
        driver.currentLatitude != null &&
        driver.currentLongitude != null
      ) {
        distKm = calculateDistance(
          driver.currentLatitude,
          driver.currentLongitude,
          pickupLat,
          pickupLng
        );
      }

      // Score = distance (km) * 10 + currentJobs * 5; lower is better
      // If no GPS, use a large penalty so GPS-available drivers are preferred
      const distScore = distKm != null ? distKm * 10 : 500;
      const score = distScore + currentJobs * 5;

      if (score < bestScore) {
        bestScore = score;
        bestDriverId = driver.id;
      }
    }

    if (bestDriverId) {
      const driverLat = drivers.find((d) => d.id === bestDriverId)?.currentLatitude;
      const driverLng = drivers.find((d) => d.id === bestDriverId)?.currentLongitude;
      let distKm: number | null = null;
      if (driverLat != null && driverLng != null && pickupLat != null && pickupLng != null) {
        distKm = calculateDistance(driverLat, driverLng, pickupLat, pickupLng);
      }
      sessionJobs.get(bestDriverId)!.push({ ...delivery, distanceKm: distKm });
    }
  }

  // Build result, excluding drivers with no deliveries
  return drivers
    .filter((d) => (sessionJobs.get(d.id)?.length || 0) > 0)
    .map((d) => {
      const jobs = sessionJobs.get(d.id)!;
      const totalDist = jobs.every((j) => j.distanceKm != null)
        ? jobs.reduce((sum, j) => sum + (j.distanceKm || 0), 0)
        : null;
      return {
        driverId: d.id,
        driverName: d.fullName,
        deliveries: jobs,
        totalDistanceKm: totalDist ? Math.round(totalDist * 10) / 10 : null,
      };
    });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RouteOptimization() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<Delivery[]>([]);
  const [activeJobCount, setActiveJobCount] = useState<Map<string, number>>(new Map());

  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedDeliveries, setSelectedDeliveries] = useState<string[]>([]);

  const [optimizedRoutes, setOptimizedRoutes] = useState<AssignedRoute[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Keep the route-plan lock in sync with whether we have an active preview
  useEffect(() => {
    setRoutePlanLock(optimizedRoutes.length > 0);
    return () => setRoutePlanLock(false); // always clear on unmount
  }, [optimizedRoutes.length]);

  // Whether any auto-dispatch rules are currently enabled
  const hasActiveRules = loadAutoDispatchRules().some((r) => r.enabled);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    await Promise.all([fetchDrivers(), fetchPendingDeliveries()]);
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("id, full_name, phone_number, rating, total_deliveries, is_online, is_active, current_lat, current_lng, last_location_update, assigned_vehicle_id, approval_status, wallet_balance, total_earnings")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .eq("is_online", true);

    if (error) { console.error(error); return; }

    const list: Driver[] = (data || []).map((d: any) => ({
      id: d.id,
      authUserId: d.user_id || "",
      email: "",
      phone: d.phone_number || "",
      fullName: d.full_name || `Driver ${(d.phone_number || "").slice(-4) || d.id.slice(0, 8)}`,
      cityId: "doha",
      assignedZoneIds: [],
      status: "active" as const,
      isOnline: true,
      currentLatitude: d.current_lat ?? undefined,
      currentLongitude: d.current_lng ?? undefined,
      locationUpdatedAt: d.last_location_update ?? undefined,
      totalDeliveries: d.total_deliveries || 0,
      rating: d.rating || 5.0,
      cancellationRate: 0,
      currentBalance: d.wallet_balance || 0,
      totalEarnings: d.total_earnings || 0,
      assignedVehicleId: d.assigned_vehicle_id || undefined,
      createdAt: d.created_at || new Date().toISOString(),
    }));

    setDrivers(list);

    // Fetch active job counts
    if (list.length > 0) {
      const { data: jobs } = await supabase
        .from("delivery_jobs")
        .select("driver_id")
        .in("driver_id", list.map((d) => d.id))
        .in("status", ["assigned", "accepted", "picked_up", "in_transit"]);

      const counts = new Map<string, number>();
      (jobs || []).forEach((j: any) => {
        if (j.driver_id) counts.set(j.driver_id, (counts.get(j.driver_id) || 0) + 1);
      });
      setActiveJobCount(counts);
    }
  };

  const fetchPendingDeliveries = async () => {
    const { data: jobs, error } = await supabase
      .from("delivery_jobs")
      .select(`
        id, status, pickup_address, delivery_address, delivery_lat, delivery_lng,
        restaurant_id,
        restaurants ( name, latitude, longitude )
      `)
      .in("status", ["pending", "confirmed", "preparing"])
      .is("driver_id", null)
      .limit(30);

    if (error) { console.error(error); return; }

    const list: Delivery[] = (jobs || []).map((j: any) => {
      const restaurant = j.restaurants as { name?: string; latitude?: number; longitude?: number } | null;
      return {
        id: j.id,
        pickupAddress: j.pickup_address || restaurant?.name || "Restaurant",
        deliveryAddress: j.delivery_address || "Customer location",
        priority: j.status === "preparing" ? "high" : "normal",
        pickupLat: restaurant?.latitude ?? null,
        pickupLng: restaurant?.longitude ?? null,
        deliveryLat: j.delivery_lat ?? null,
        deliveryLng: j.delivery_lng ?? null,
        restaurantName: restaurant?.name ?? null,
      };
    });

    setPendingDeliveries(list);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const toggleDriver = (id: string) =>
    setSelectedDrivers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleDelivery = (id: string) =>
    setSelectedDeliveries((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const gpsAgeMinutes = (updatedAt?: string): number | null => {
    if (!updatedAt) return null;
    return Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000);
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "high") return <Badge className="bg-red-500 text-[10px] px-1.5 py-0">High</Badge>;
    if (priority === "normal") return <Badge className="bg-blue-500 text-[10px] px-1.5 py-0">Normal</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Low</Badge>;
  };

  // ── Manual optimize (selected subset) ──────────────────────────────────

  const handleOptimizeSelected = () => {
    if (selectedDrivers.length === 0 || selectedDeliveries.length === 0) {
      toast({ title: "Select at least one driver and one delivery", variant: "destructive" });
      return;
    }
    setIsOptimizing(true);
    setTimeout(() => {
      const chosenDrivers = drivers.filter((d) => selectedDrivers.includes(d.id));
      const chosenDeliveries = pendingDeliveries.filter((d) => selectedDeliveries.includes(d.id));
      const routes = buildNearestDriverRoutes(chosenDeliveries, chosenDrivers, activeJobCount);
      setOptimizedRoutes(routes);
      setIsOptimizing(false);
      toast({ title: "Routes optimised", description: `${routes.length} drivers assigned based on proximity.` });
    }, 600);
  };

  // ── Auto-assign ALL ─────────────────────────────────────────────────────

  const handleAutoAssignAll = () => {
    if (drivers.length === 0) {
      toast({ title: "No online drivers available", variant: "destructive" });
      return;
    }
    if (pendingDeliveries.length === 0) {
      toast({ title: "No pending deliveries", variant: "destructive" });
      return;
    }
    setIsOptimizing(true);
    setTimeout(() => {
      const routes = buildNearestDriverRoutes(pendingDeliveries, drivers, activeJobCount);
      setOptimizedRoutes(routes);
      setIsOptimizing(false);
      const total = routes.reduce((s, r) => s + r.deliveries.length, 0);
      toast({ title: "Auto-plan ready", description: `${total} deliveries distributed across ${routes.length} drivers. Review and confirm below.` });
    }, 800);
  };

  // ── Confirm & write to DB ───────────────────────────────────────────────

  const handleConfirmAssign = async () => {
    setIsAssigning(true);
    try {
      let assigned = 0;
      let skipped = 0;

      for (const route of optimizedRoutes) {
        for (const delivery of route.deliveries) {
          // Freshness check — skip if auto-dispatch already grabbed this order
          const { data: current } = await supabase
            .from("delivery_jobs")
            .select("driver_id")
            .eq("id", delivery.id)
            .single();

          if (current?.driver_id) {
            skipped++;
            continue;
          }

          await supabase
            .from("delivery_jobs")
            .update({ driver_id: route.driverId, status: "assigned" })
            .eq("id", delivery.id);
          assigned++;
        }
      }

      setRoutePlanLock(false);
      setOptimizedRoutes([]);
      setSelectedDrivers([]);
      setSelectedDeliveries([]);
      fetchAll();

      toast({
        title: "Routes assigned",
        description: skipped > 0
          ? `${assigned} assigned, ${skipped} skipped (already taken by auto-dispatch). Opening Order Management…`
          : `${assigned} deliveries assigned. Opening Order Management…`,
      });

      setTimeout(() => navigate("/fleet/dispatch?tab=live"), 1400);
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to assign routes.", variant: "destructive" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReset = () => {
    setOptimizedRoutes([]);
    setSelectedDrivers([]);
    setSelectedDeliveries([]);
    setRoutePlanLock(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const hasPreview = optimizedRoutes.length > 0;
  const gpsDriverCount = drivers.filter((d) => d.currentLatitude != null).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Route Optimization</h1>
          <p className="text-muted-foreground">
            Smart, proximity-based delivery assignment for online drivers.
          </p>
          {gpsDriverCount < drivers.length && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {drivers.length - gpsDriverCount} driver(s) have no GPS — they will receive jobs only when all GPS-equipped drivers are full.
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            onClick={handleAutoAssignAll}
            disabled={isOptimizing || drivers.length === 0 || pendingDeliveries.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isOptimizing ? "Planning…" : "Auto-Assign All"}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Online Drivers", value: drivers.length, icon: Users, color: "text-green-600" },
          { label: "With GPS", value: gpsDriverCount, icon: Navigation, color: "text-blue-600" },
          { label: "Pending Deliveries", value: pendingDeliveries.length, icon: Package, color: "text-amber-600" },
          { label: "High Priority", value: pendingDeliveries.filter(d => d.priority === "high").length, icon: AlertTriangle, color: "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xl font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview panel (shown after optimize/auto-assign) */}
      {hasPreview && (
        <Card className="border-green-300 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-800">
              <Route className="h-4 w-4" />
              Route Preview — review before confirming
            </CardTitle>
            {hasActiveRules && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Auto-Dispatch is paused</strong> while this plan is open.
                  Confirm or discard to resume it. Any orders already grabbed by
                  auto-dispatch will be skipped automatically.
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {optimizedRoutes.map((route) => (
                <div key={route.driverId} className="rounded-lg border bg-white p-3 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm">{route.driverName}</p>
                    <Badge variant="secondary">{route.deliveries.length} job{route.deliveries.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  {route.totalDistanceKm != null && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Navigation className="h-3 w-3" />
                      ~{formatDistance(route.totalDistanceKm)} total pickup distance
                    </p>
                  )}
                  <ol className="space-y-1 mt-1">
                    {route.deliveries.map((d, idx) => (
                      <li key={d.id} className="text-xs flex gap-2 items-start">
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 font-medium">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="truncate block">{d.deliveryAddress}</span>
                          {d.distanceKm != null && (
                            <span className="text-muted-foreground">{formatDistance(d.distanceKm)} from driver</span>
                          )}
                        </span>
                        {getPriorityBadge(d.priority)}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button onClick={handleConfirmAssign} disabled={isAssigning} className="flex-1 sm:flex-none">
                <CheckCircle className="h-4 w-4 mr-2" />
                {isAssigning ? "Assigning…" : "Confirm & Assign"}
              </Button>
              <Button variant="outline" onClick={handleReset} disabled={isAssigning}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Driver list */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Online Drivers
              </CardTitle>
              <span className="text-xs text-muted-foreground">{selectedDrivers.length} selected</span>
            </div>
          </CardHeader>
          <CardContent>
            {drivers.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No online drivers right now.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {drivers.map((driver) => {
                  const ageMin = gpsAgeMinutes(driver.locationUpdatedAt);
                  const hasGps = driver.currentLatitude != null;
                  const activeJobs = activeJobCount.get(driver.id) || 0;
                  const overloaded = activeJobs >= MAX_JOBS_PER_DRIVER;
                  return (
                    <div
                      key={driver.id}
                      onClick={() => !overloaded && toggleDriver(driver.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        overloaded
                          ? "opacity-50 cursor-not-allowed bg-muted/30"
                          : selectedDrivers.includes(driver.id)
                            ? "bg-primary/10 border-primary cursor-pointer"
                            : "hover:bg-muted cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={selectedDrivers.includes(driver.id)}
                        disabled={overloaded}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{driver.fullName}</p>
                        <p className="text-xs text-muted-foreground">{driver.phone}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1">
                          {hasGps ? (
                            <Navigation className="h-3 w-3 text-green-500" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-muted-foreground" />
                          )}
                          {ageMin != null && (
                            <span className={`text-[10px] ${ageMin > 10 ? "text-amber-500" : "text-muted-foreground"}`}>
                              {ageMin}m ago
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{activeJobs} active job{activeJobs !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery list */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pending Deliveries
              </CardTitle>
              <span className="text-xs text-muted-foreground">{selectedDeliveries.length} selected</span>
            </div>
          </CardHeader>
          <CardContent>
            {pendingDeliveries.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No unassigned deliveries right now.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {pendingDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    onClick={() => toggleDelivery(delivery.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDeliveries.includes(delivery.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted"
                    }`}
                  >
                    <Checkbox
                      checked={selectedDeliveries.includes(delivery.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      {delivery.restaurantName && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          📍 {delivery.restaurantName}
                        </p>
                      )}
                      <p className="text-sm truncate">{delivery.deliveryAddress}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getPriorityBadge(delivery.priority)}
                        {delivery.pickupLat != null ? (
                          <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                            <Navigation className="h-2.5 w-2.5" /> GPS
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <WifiOff className="h-2.5 w-2.5" /> No coords
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manual optimize button */}
      {!hasPreview && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleOptimizeSelected}
            disabled={isOptimizing || selectedDrivers.length === 0 || selectedDeliveries.length === 0}
          >
            {isOptimizing ? (
              <>
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Optimising…
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Optimise Selected ({selectedDrivers.length} drivers · {selectedDeliveries.length} deliveries)
              </>
            )}
          </Button>
        </div>
      )}

    </div>
  );
}
