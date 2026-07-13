import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  RefreshCw,
  Route,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useFleetAuth } from "@/fleet/hooks/useFleetAuth";
import {
  assignDispatchOrder,
  getDispatchActivity,
  getDispatchDrivers,
  getDispatchOrders,
  subscribeToDispatchOrders,
  loadAutoDispatchRules,
  isRoutePlanLocked,
  type DispatchActivityRecord,
  type DispatchDriverRecord,
  type DispatchOrderRecord,
} from "@/fleet/services/orderDispatch";
import {
  getDispatchRecommendations,
  type DispatchRecommendation,
} from "@/fleet/lib/dispatchRecommendations";
import { evaluateAutoDispatchRules } from "@/fleet/lib/autoDispatch";
import { DispatchMap, type DispatchMapDriver } from "@/fleet/components/dispatch/DispatchMap";
import { FleetBranchOrders } from "@/fleet/components/FleetBranchOrders";
import { useTracking } from "@/fleet/context/TrackingContext";
import { formatDistance } from "@/lib/distance";
import { useNow, getUrgencyClass, formatElapsed } from "@/fleet/hooks/useDispatchTimer";

type OrderFilter = "all" | "preparing" | "ready_for_pickup";

function getOrderStatusBadge(status: string) {
  if (status === "ready_for_pickup" || status === "ready") {
    return (
      <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Ready
      </Badge>
    );
  }

  return (
    <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#F97316]">
      <ChefHat className="w-3 h-3 mr-1" />
      Preparing
    </Badge>
  );
}

function getRecommendationTypeBadge(type: DispatchRecommendation["type"]) {
  switch (type) {
    case "idle_nearest":
      return <Badge variant="outline" className="border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">Nearest idle</Badge>;
    case "route_compatible":
      return <Badge className="border border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#0369A1]">Route match</Badge>;
    case "busy_fallback":
      return <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#BE123C]">Busy fallback</Badge>;
    default:
      return <Badge className="border border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#4F46E5]">Available</Badge>;
  }
}

function ReliabilityBadge({ tier, label, score }: { tier: string; label: string; score: number }) {
  const colours: Record<string, string> = {
    green: "bg-[#22C7A1]/10 text-[#047857] border-[#22C7A1]/25",
    amber: "bg-[#FB6B7A]/10 text-[#F97316] border-[#FB6B7A]/25",
    red: "bg-[#FB6B7A]/10 text-[#BE123C] border-[#FB6B7A]/25",
  };
  return (
    <Badge variant="outline" className={`border ${colours[tier] ?? ""}`} title={`Reliability score: ${score}/100`}>
      {label}
    </Badge>
  );
}

function buildWhatsAppLink(phone: string | null, driverName: string, orderId: string, restaurant: string, address: string | null): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, "");
  const number = cleaned.startsWith("974") ? cleaned : `974${cleaned}`;
  const text = encodeURIComponent(
    `Hi ${driverName}, please pick up order #${orderId.slice(0, 8)} from ${restaurant}${address ? ` — ${address}` : ""}.`
  );
  return `https://wa.me/${number}?text=${text}`;
}

export default function OrderManagement() {
  const { toast } = useToast();
  const { user } = useFleetAuth();
  const navigate = useNavigate();
  const now = useNow();
  const { drivers: liveDrivers } = useTracking();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningDriverId, setAssigningDriverId] = useState<string | null>(null);
  const [orders, setOrders] = useState<DispatchOrderRecord[]>([]);
  const [drivers, setDrivers] = useState<DispatchDriverRecord[]>([]);
  const [activity, setActivity] = useState<DispatchActivityRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mapSelectedDriverId, setMapSelectedDriverId] = useState<string | null>(null);
  const [showDriverBoard, setShowDriverBoard] = useState(true);
  const [assignNotes, setAssignNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"dispatch" | "branches">("dispatch");

  // Debounce realtime triggers so rapid changes don't flood requests
  const realtimeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [ordersData, driversData, activityData] = await Promise.all([
        getDispatchOrders(),
        getDispatchDrivers(),
        getDispatchActivity(),
      ]);

      setOrders(ordersData);
      setDrivers(driversData);
      setActivity(activityData);
    } catch (error) {
      console.error("Error loading fleet order management data:", error);
      toast({
        title: "Error",
        description: "Failed to load dispatch data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription — silently refresh when orders change
  useEffect(() => {
    const unsubscribe = subscribeToDispatchOrders(() => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      realtimeTimer.current = setTimeout(() => fetchData(true), 1500);
    });

    return () => {
      if (realtimeTimer.current) clearTimeout(realtimeTimer.current);
      unsubscribe();
    };
  }, [fetchData]);

  // 6-B: Merge live WebSocket positions into fetched driver records
  const driversWithLive = useMemo<DispatchDriverRecord[]>(() => {
    if (liveDrivers.length === 0) return drivers;
    return drivers.map((d) => {
      const live = liveDrivers.find((ld) => ld.driverId === d.id);
      if (!live) return d;
      return {
        ...d,
        currentLat: live.latitude,
        currentLng: live.longitude,
        locationUpdatedAt: live.timestamp,
      };
    });
  }, [drivers, liveDrivers]);

  const recommendationMap = useMemo(() => {
    const map = new Map<string, DispatchRecommendation[]>();
    orders.forEach((order) => {
      map.set(order.id, getDispatchRecommendations(order, driversWithLive));
    });
    return map;
  }, [orders, driversWithLive]);

  // 7-C: Auto-dispatch rule runner — evaluates every 60 s
  // Pauses automatically while Route Optimization has an active unconfirmed plan.
  const [autoDispatchPaused, setAutoDispatchPaused] = useState(false);

  useEffect(() => {
    const run = async () => {
      // Check lock set by Route Optimization preview
      if (isRoutePlanLocked()) {
        setAutoDispatchPaused(true);
        return;
      }
      setAutoDispatchPaused(false);

      const rules = loadAutoDispatchRules();
      const actions = evaluateAutoDispatchRules(rules, orders, recommendationMap, Date.now());
      for (const action of actions) {
        try {
          const autoOrder = orders.find((o) => o.id === action.orderId);
          await assignDispatchOrder({
            orderId: action.orderId,
            driverId: action.driverId,
            managerId: user?.id || null,
            reason: action.reason,
            source: autoOrder?.source ?? "order",
          });
          toast({
            title: "Auto-dispatched",
            description: `Rule "${action.ruleName}" assigned an order automatically.`,
          });
        } catch (err) {
          console.error("[AutoDispatch] Failed to assign:", err);
        }
      }
      if (actions.length > 0) fetchData(true);
    };

    const interval = setInterval(run, 60_000);
    return () => clearInterval(interval);
  }, [orders, recommendationMap, user, toast, fetchData]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...orders]
      .filter((order) => (filter === "all" ? true : order.status === filter))
      .filter((order) => {
        if (!query) return true;
        return (
          order.restaurantName.toLowerCase().includes(query) ||
          order.customerName.toLowerCase().includes(query) ||
          order.mealName.toLowerCase().includes(query) ||
          (order.deliveryAddress || "").toLowerCase().includes(query) ||
          (order.branchName || "").toLowerCase().includes(query)
        );
      })
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status === "ready_for_pickup" ? -1 : 1;
        }
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      });
  }, [filter, orders, search]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    if (!selectedOrderId || !filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(filteredOrders[0].id);
    }
  }, [filteredOrders, selectedOrderId]);

  const selectedOrder = filteredOrders.find((order) => order.id === selectedOrderId) || null;
  const selectedRecommendations = selectedOrder ? recommendationMap.get(selectedOrder.id) || [] : [];
  const topRecommendation = selectedRecommendations[0] || null;

  const groupedOrders = useMemo(() => {
    return filteredOrders.reduce<Record<string, DispatchOrderRecord[]>>((groups, order) => {
      const groupKey = order.branchName || order.restaurantName;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(order);
      return groups;
    }, {});
  }, [filteredOrders]);

  const stats = useMemo(() => ({
    preparing: orders.filter((order) => order.status === "preparing").length,
    ready: orders.filter((order) => order.status === "ready_for_pickup").length,
    assigned: orders.filter((order) => order.assignedDriverId).length,
    onlineDrivers: drivers.filter((driver) => driver.isOnline).length,
  }), [drivers, orders]);

  const handleAssign = async (driverId: string, reason: string) => {
    if (!selectedOrder) return;

    // 8-D: warn operator before assigning a low-reliability driver
    const rec = selectedRecommendations.find((r) => r.driverId === driverId);
    if (rec?.reliabilityTier === "red") {
      const confirmed = window.confirm(
        "This driver has a low reliability score. Are you sure you want to assign them?"
      );
      if (!confirmed) return;
    }

    setAssigningDriverId(driverId);
    try {
      await assignDispatchOrder({
        orderId: selectedOrder.id,
        driverId,
        managerId: user?.id || null,
        reason,
        notes: assignNotes.trim() || undefined,
        source: selectedOrder.source,
      });

      setAssignNotes("");
      toast({
        title: selectedOrder.assignedDriverId ? "Order Reassigned" : "Driver Assigned",
        description: `${selectedOrder.mealName} is now assigned from the fleet portal.`,
      });

      await fetchData(true);
    } catch (error) {
      console.error("Error assigning order:", error);
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Could not assign this order to the selected driver.",
        variant: "destructive",
      });
    } finally {
      setAssigningDriverId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 w-full" />)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
          <Skeleton className="h-[620px] w-full" />
          <Skeleton className="h-[620px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-[#020617]">
      {/* Header + tabs */}
      <div className="rounded-[26px] bg-white p-4 ring-1 ring-[#E5EAF1]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#7C83F6]">Live operations</p>
          <h1 className="mt-1 text-[22px] font-black text-[#020617]">Order Management</h1>
          <p className="text-sm font-semibold text-[#64748B]">
            Dispatch orders and view branch queues from one place.
          </p>
          {autoDispatchPaused && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 text-xs font-black text-[#BE123C]">
              <AlertTriangle className="h-3 w-3" />
              Auto-Dispatch paused — route plan in progress
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-[#F6F8FB] p-1 ring-1 ring-[#E5EAF1]">
            <button
              type="button"
              onClick={() => setActiveTab("dispatch")}
              className={`min-h-10 rounded-full px-4 text-sm font-black transition-colors ${activeTab === "dispatch" ? "bg-[#020617] text-white" : "text-[#64748B]"}`}
            >
              Dispatch Queue
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("branches")}
              className={`min-h-10 rounded-full px-4 text-sm font-black transition-colors ${activeTab === "branches" ? "bg-[#020617] text-white" : "text-[#64748B]"}`}
            >
              By Branch
            </button>
          </div>
          {activeTab === "dispatch" && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/fleet/dispatch?tab=bulk")}
                title="Open Route Optimization to batch-assign multiple orders at once"
                className="rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none"
              >
                <Route className="w-4 h-4 mr-2" />
                Batch Plan
              </Button>
              <Button variant="outline" onClick={() => fetchData(true)} disabled={refreshing} className="rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none">
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Branch Orders tab */}
      {activeTab === "branches" && (
        <FleetBranchOrders />
      )}

      {activeTab !== "dispatch" && null}

      {/* Dispatch tab content */}
      {activeTab === "dispatch" && <>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="rounded-[24px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FB6B7A]/10 flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-[#FB6B7A]" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#020617]">{stats.preparing}</p>
                <p className="text-xs font-bold text-[#94A3B8]">Preparing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#22C7A1]/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-[#22C7A1]" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#020617]">{stats.ready}</p>
                <p className="text-xs font-bold text-[#94A3B8]">Ready for Pickup</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#38BDF8]/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-[#38BDF8]" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#020617]">{stats.assigned}</p>
                <p className="text-xs font-bold text-[#94A3B8]">Already Assigned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-[24px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#7C83F6]/10 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-[#7C83F6]" />
              </div>
              <div>
                <p className="text-2xl font-black text-[#020617]">{stats.onlineDrivers}</p>
                <p className="text-xs font-bold text-[#94A3B8]">Online Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Board — collapsible */}
      <Card className="rounded-[26px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
        <CardHeader className="pb-3">
          <button
            type="button"
            className="flex items-center justify-between w-full"
            onClick={() => setShowDriverBoard((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#7C83F6]" />
              <CardTitle className="text-base font-black text-[#020617]">Driver Board</CardTitle>
              <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">{stats.onlineDrivers} online</Badge>
            </div>
            {showDriverBoard ? <ChevronUp className="w-4 h-4 text-[#94A3B8]" /> : <ChevronDown className="w-4 h-4 text-[#94A3B8]" />}
          </button>
        </CardHeader>
        {showDriverBoard && (
          <CardContent className="pt-0">
            {drivers.length === 0 ? (
              <p className="text-sm font-semibold text-[#94A3B8]">No active drivers found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {drivers.map((driver) => {
                  const isOverloaded = driver.activeJobs.length >= 3;
                  const locationAgeMin = driver.locationUpdatedAt
                    ? Math.round((Date.now() - new Date(driver.locationUpdatedAt).getTime()) / 60000)
                    : null;
                  return (
                    <div
                      key={driver.id}
                      data-testid={`fleet-driver-${driver.id}`}
                      data-active-delivery-job-ids={driver.activeJobs.map((job) => job.id).join(",")}
                      className={`rounded-2xl border p-3 text-sm flex flex-col gap-1 ${isOverloaded ? "border-[#FB6B7A]/30 bg-[#FB6B7A]/10" : "border-[#E5EAF1] bg-[#F6F8FB]"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${driver.isOnline ? "bg-[#22C7A1]" : "bg-[#CBD5E1]"}`} />
                        <span className="font-black truncate text-[#020617]">{driver.fullName}</span>
                        {isOverloaded && <AlertTriangle className="w-3 h-3 text-[#FB6B7A] shrink-0" />}
                      </div>
                      <div className="text-xs font-semibold text-[#94A3B8] flex gap-2 flex-wrap">
                        <span>{driver.activeJobs.length} active</span>
                        {locationAgeMin != null && <span>GPS {locationAgeMin}m ago</span>}
                        {driver.vehiclePlate && <span className="font-mono">{driver.vehiclePlate}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Dispatch queue + details */}
      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
        {/* Queue */}
        <Card className="min-h-[620px] rounded-[26px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-black text-[#020617]">Dispatch Queue</CardTitle>
              <Badge className="border border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#4F46E5]">{filteredOrders.length} orders</Badge>
            </div>
            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search branch, meal, customer..."
                className="rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] placeholder:text-[#94A3B8]"
              />
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as OrderFilter)}
                className="h-10 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617]"
              >
                <option value="all">All</option>
                <option value="preparing">Preparing</option>
                <option value="ready_for_pickup">Ready</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-5">
                {Object.entries(groupedOrders).map(([groupName, groupOrders]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-[#020617]">{groupName}</p>
                      <Badge variant="outline" className="border-[#E5EAF1] text-[#94A3B8]">{groupOrders.length}</Badge>
                    </div>
                    {groupOrders.map((order) => {
                      const recommendation = recommendationMap.get(order.id)?.[0] || null;
                      const isSelected = selectedOrderId === order.id;
                      const elapsedMin = Math.round((now - new Date(order.createdAt).getTime()) / 60000);
                      const urgency = getUrgencyClass(elapsedMin);

                      return (
                        <button
                          key={order.id}
                          data-testid={`fleet-order-${order.id}`}
                          data-delivery-job-id={order.existingJobId || undefined}
                          data-order-source={order.source}
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                            isSelected ? "border-[#020617] bg-[#F6F8FB]" : `border-[#E5EAF1] bg-white hover:border-[#7C83F6]/40 ${urgency}`
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {getOrderStatusBadge(order.status)}
                                {order.assignedDriverId && <Badge variant="secondary">Assigned</Badge>}
                                {elapsedMin >= 10 && (
                                  <Badge
                                    variant="outline"
                                    className={elapsedMin >= 20 ? "border-[#FB6B7A] text-[#BE123C]" : "border-[#FB6B7A]/50 text-[#F97316]"}
                                  >
                                    <Clock className="w-3 h-3 mr-1" />
                                    {formatElapsed(elapsedMin)}
                                  </Badge>
                                )}
                              </div>
                              <div>
                                <p className="font-black text-[#020617]">{order.mealName}</p>
                                <p className="text-xs font-semibold text-[#94A3B8]">{order.customerName}</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#94A3B8]">
                              {format(new Date(order.createdAt), "HH:mm")}
                            </span>
                          </div>
                          <div className="mt-3 text-xs font-semibold text-[#94A3B8] space-y-1">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate">{order.pickupAddress || "No pickup address"}</span>
                            </div>
                            {recommendation ? (
                              <div className="flex items-center gap-2 text-[#020617]">
                                <Sparkles className="w-3 h-3 text-[#7C83F6]" />
                                <span className="truncate">{recommendation.reason}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-3 h-3 text-[#FB6B7A]" />
                                <span>No eligible drivers right now</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}

                {filteredOrders.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F6F8FB] p-8 text-center text-sm font-semibold text-[#94A3B8]">
                    No dispatchable orders match the current filters.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="min-h-[620px] rounded-[26px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardHeader>
            <CardTitle className="text-lg font-black text-[#020617]">Dispatch Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedOrder ? (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F6F8FB] p-12 text-center text-sm font-semibold text-[#94A3B8]">
                Select an order from the queue to review smart driver recommendations.
              </div>
            ) : (
              <div className="space-y-6">
                {/* 6-C: Mini dispatch map */}
                {(() => {
                  const mapDrivers: DispatchMapDriver[] = selectedRecommendations
                    .slice(0, 6)
                    .map((rec, idx) => {
                      const d = driversWithLive.find((x) => x.id === rec.driverId);
                      if (!d || d.currentLat == null || d.currentLng == null) return null;
                      return {
                        id: d.id,
                        name: d.fullName,
                        lat: d.currentLat,
                        lng: d.currentLng,
                        isTop: idx === 0,
                      };
                    })
                    .filter((x): x is DispatchMapDriver => x !== null);

                  return (
                    <DispatchMap
                      pickupLat={selectedOrder.pickupLat}
                      pickupLng={selectedOrder.pickupLng}
                      dropoffLat={selectedOrder.deliveryLat}
                      dropoffLng={selectedOrder.deliveryLng}
                      drivers={mapDrivers}
                      selectedDriverId={mapSelectedDriverId}
                      onDriverClick={(id) => setMapSelectedDriverId((prev) => (prev === id ? null : id))}
                      className="h-52"
                    />
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card
                    data-testid={`fleet-order-detail-${selectedOrder.id}`}
                    data-delivery-job-id={selectedOrder.existingJobId || undefined}
                    className="rounded-[22px] border-0 bg-[#F6F8FB] shadow-none ring-1 ring-[#E5EAF1]"
                  >
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getOrderStatusBadge(selectedOrder.status)}
                        {selectedOrder.assignedDriverName && (
                          <Badge variant="secondary">Current: {selectedOrder.assignedDriverName}</Badge>
                        )}
                      </div>
                      <div>
                        <p className="font-black text-[#020617]">{selectedOrder.mealName}</p>
                        <p className="text-sm font-semibold text-[#94A3B8]">{selectedOrder.restaurantName}</p>
                      </div>
                      <div className="space-y-1 text-sm font-semibold text-[#020617]">
                        <p><span className="text-[#94A3B8]">Customer:</span> {selectedOrder.customerName}</p>
                        <p><span className="text-[#94A3B8]">Phone:</span> {selectedOrder.customerPhone || "N/A"}</p>
                        <p><span className="text-[#94A3B8]">Pickup:</span> {selectedOrder.pickupAddress || "N/A"}</p>
                        <p><span className="text-[#94A3B8]">Dropoff:</span> {selectedOrder.deliveryAddress || "N/A"}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[22px] border-0 bg-[#F6F8FB] shadow-none ring-1 ring-[#E5EAF1]">
                    <CardContent className="pt-4 space-y-3">
                      <div>
                        <p className="text-sm font-bold text-[#94A3B8]">Top recommendation</p>
                        <p className="font-black text-[#020617]">
                          {topRecommendation
                            ? driversWithLive.find((driver) => driver.id === topRecommendation.driverId)?.fullName || "Driver"
                            : "No recommendation"}
                        </p>
                        <p className="text-sm font-semibold text-[#64748B]">
                          {topRecommendation ? topRecommendation.reason : "No eligible online drivers with live location."}
                        </p>
                      </div>
                      {topRecommendation && (
                        <Button
                          className="min-h-11 w-full rounded-full bg-[#020617] font-black text-white shadow-none hover:bg-[#020617]/90"
                          disabled={assigningDriverId !== null}
                          onClick={() =>
                            handleAssign(
                              topRecommendation.driverId,
                              `Best match selected by fleet operator: ${topRecommendation.reason}`
                            )
                          }
                        >
                          <Truck className="w-4 h-4 mr-2" />
                          {selectedOrder.assignedDriverId ? "Reassign Best Match" : "Assign Best Match"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Operator notes */}
                <div className="space-y-2">
                  <label htmlFor="dispatch-notes" className="text-sm font-black text-[#020617]">
                    Operator notes <span className="font-semibold text-[#94A3B8]">(optional, saved with assignment)</span>
                  </label>
                  <textarea
                    id="dispatch-notes"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    placeholder="e.g. Call driver before pickup, fragile items..."
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] px-3 py-2 text-sm font-semibold text-[#020617] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#7C83F6]/30"
                  />
                </div>

                {/* Recommended drivers list */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-black text-[#020617]">Recommended Drivers</h2>
                    <Badge variant="outline" className="border-[#E5EAF1] text-[#94A3B8]">{selectedRecommendations.length} candidates</Badge>
                  </div>

                  {selectedRecommendations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F6F8FB] p-8 text-center text-sm font-semibold text-[#94A3B8]">
                      No suitable drivers are currently online with fresh location data.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedRecommendations.slice(0, 6).map((recommendation, index) => {
                        const driver = driversWithLive.find((item) => item.id === recommendation.driverId);
                        if (!driver) return null;

                        const isAssignedDriver = selectedOrder.assignedDriverId === driver.id;
                        const isMapSelected = mapSelectedDriverId === driver.id;
                        const waLink = buildWhatsAppLink(
                          driver.phone,
                          driver.fullName,
                          selectedOrder.id,
                          selectedOrder.restaurantName,
                          selectedOrder.pickupAddress
                        );

                        return (
                          <Card
                            key={driver.id}
                            className={`rounded-[22px] border-0 bg-white shadow-none ring-1 ${
                              isMapSelected ? "ring-[#7C83F6]" : index === 0 ? "ring-[#22C7A1]/50" : "ring-[#E5EAF1]"
                            }`}
                          >
                            <CardContent className="pt-4">
                              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-black text-[#020617]">{driver.fullName}</p>
                                    {index === 0 && <Badge className="bg-[#020617] text-white">Best match</Badge>}
                                    {getRecommendationTypeBadge(recommendation.type)}
                                    <ReliabilityBadge
                                      tier={recommendation.reliabilityTier}
                                      label={recommendation.reliabilityLabel}
                                      score={recommendation.reliabilityScore}
                                    />
                                    {isAssignedDriver && <Badge variant="secondary">Current driver</Badge>}
                                    {isMapSelected && (
                                      <Badge className="border border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#4F46E5]">
                                        Map selected
                                      </Badge>
                                    )}
                                    {recommendation.isOverloaded && (
                                      <Badge variant="outline" className="border-[#FB6B7A]/50 text-[#BE123C]">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        Overloaded
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-[#94A3B8]">
                                    <span>{driver.phone || "No phone"}</span>
                                    <span>Rating {driver.rating?.toFixed(1) || "5.0"}</span>
                                    <span>{driver.activeJobs.length} active jobs</span>
                                    {recommendation.distanceKm != null && (
                                      <span>{formatDistance(recommendation.distanceKm)}</span>
                                    )}
                                    {recommendation.estimatedPickupMinutes != null && (
                                      <span className="font-black text-[#020617]">
                                        ~{recommendation.estimatedPickupMinutes} min to pickup
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm font-semibold text-[#020617]">{recommendation.reason}</p>
                                  {recommendation.routeCompatibilityKm != null && (
                                    <p className="text-xs font-semibold text-[#94A3B8]">
                                      Current drop-off is {formatDistance(recommendation.routeCompatibilityKm)} from this pickup.
                                    </p>
                                  )}
                                  {recommendation.warnings.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {recommendation.warnings.map((warning) => (
                                        <Badge key={warning} variant="outline" className="border-[#FB6B7A]/40 text-[#F97316]">
                                          {warning}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {waLink && (
                                    <a href={waLink} target="_blank" rel="noopener noreferrer">
                                      <Button variant="ghost" size="icon" title="Open WhatsApp">
                                        <MessageCircle className="w-4 h-4 text-[#22C7A1]" />
                                      </Button>
                                    </a>
                                  )}
                                  <Button
                                    variant={index === 0 ? "default" : "outline"}
                                    disabled={assigningDriverId !== null || isAssignedDriver}
                                    className={index === 0 ? "rounded-full bg-[#020617] font-black text-white shadow-none hover:bg-[#020617]/90" : "rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none"}
                                    onClick={() =>
                                      handleAssign(
                                        driver.id,
                                        `Manual operator dispatch: ${recommendation.reason}`
                                      )
                                    }
                                  >
                                    {assigningDriverId === driver.id
                                      ? "Assigning..."
                                      : isAssignedDriver
                                        ? "Already assigned"
                                        : selectedOrder.assignedDriverId
                                          ? "Reassign"
                                          : "Assign"}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="rounded-[26px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
        <CardHeader>
          <CardTitle className="text-lg font-black text-[#020617]">Recent Dispatch Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F6F8FB] p-8 text-center text-sm font-semibold text-[#94A3B8]">
              No manual dispatch activity recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => {
                const isHandedOver =
                  entry.jobStatus === "picked_up" ||
                  entry.jobStatus === "in_transit" ||
                  entry.jobStatus === "delivered" ||
                  entry.jobStatus === "completed";

                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{entry.action}</Badge>
                        <span className="font-black text-[#020617]">{entry.driverName}</span>
                        {entry.orderId && (
                          <span className="text-sm font-semibold text-[#94A3B8]">Order #{entry.orderId.slice(0, 8)}</span>
                        )}
                        {isHandedOver && (
                          <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Picked up
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#64748B]">{entry.reason || "Manual fleet dispatch action"}</p>
                      {entry.notes && (
                        <p className="text-xs font-semibold italic text-[#94A3B8]">Note: {entry.notes}</p>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-[#94A3B8] flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{entry.performedAt ? format(new Date(entry.performedAt), "MMM d, HH:mm") : "Just now"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      </> /* end activeTab === "dispatch" */}
    </div>
  );
}
