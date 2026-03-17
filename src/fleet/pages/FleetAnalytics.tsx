import { useEffect, useState } from "react";
import { format, startOfDay, subDays, endOfDay } from "date-fns";
import {
  BarChart2,
  Clock,
  Star,
  TrendingUp,
  Truck,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type RangePreset = "today" | "7d" | "30d";

function getRangeDates(preset: RangePreset): { from: string; to: string; label: string } {
  const now = new Date();
  if (preset === "today") {
    return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString(), label: format(now, "EEEE, MMM d") };
  }
  if (preset === "7d") {
    return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString(), label: "Last 7 days" };
  }
  return { from: startOfDay(subDays(now, 29)).toISOString(), to: endOfDay(now).toISOString(), label: "Last 30 days" };
}

interface TopDriver {
  driverId: string;
  driverName: string;
  deliveries: number;
}

interface SlowRestaurant {
  restaurantId: string;
  restaurantName: string;
  avgMinutes: number;
  orderCount: number;
}

interface AnalyticsData {
  dispatchedToday: number;
  avgWaitMinutes: number | null;
  topDrivers: TopDriver[];
  slowRestaurants: SlowRestaurant[];
}

async function fetchAnalytics(from: string, to: string): Promise<AnalyticsData> {
  // 1. Orders dispatched in range
  const { count: dispatchedToday } = await supabase
    .from("driver_assignment_history")
    .select("id", { count: "exact", head: true })
    .eq("action", "assigned")
    .gte("performed_at", from)
    .lte("performed_at", to);

  // 2. Average wait time (order created → first assignment in range)
  const { data: historyData } = await supabase
    .from("driver_assignment_history")
    .select("performed_at, job_id")
    .eq("action", "assigned")
    .gte("performed_at", from)
    .lte("performed_at", to)
    .limit(200);

  let avgWaitMinutes: number | null = null;
  if (historyData && historyData.length > 0) {
    const jobIds = historyData.map((h) => h.job_id).filter(Boolean) as string[];
    if (jobIds.length > 0) {
      const { data: jobsData } = await supabase
        .from("delivery_jobs")
        .select("id, schedule_id")
        .in("id", jobIds);

      const orderIds = (jobsData || []).map((j) => j.schedule_id).filter(Boolean) as string[];
      if (orderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from("orders")
          .select("id, created_at")
          .in("id", orderIds);

        const orderCreatedMap = new Map(
          (ordersData || []).map((o) => [o.id, o.created_at])
        );
        const jobOrderMap = new Map(
          (jobsData || []).map((j) => [j.id, j.schedule_id])
        );

        const waits = historyData
          .map((h) => {
            if (!h.job_id || !h.performed_at) return null;
            const orderId = jobOrderMap.get(h.job_id);
            if (!orderId) return null;
            const created = orderCreatedMap.get(orderId);
            if (!created) return null;
            return (new Date(h.performed_at).getTime() - new Date(created).getTime()) / 60000;
          })
          .filter((v): v is number => v !== null && v > 0);

        if (waits.length > 0) {
          avgWaitMinutes = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
        }
      }
    }
  }

  // 3. Top 5 drivers in range by completed deliveries
  const { data: completedJobsData } = await supabase
    .from("delivery_jobs")
    .select("driver_id")
    .in("status", ["delivered", "completed"])
    .gte("created_at", from)
    .lte("created_at", to)
    .limit(500);

  const driverDeliveryCount = new Map<string, number>();
  (completedJobsData || []).forEach((job) => {
    if (!job.driver_id) return;
    driverDeliveryCount.set(job.driver_id, (driverDeliveryCount.get(job.driver_id) || 0) + 1);
  });

  const topDriverIds = [...driverDeliveryCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let topDrivers: TopDriver[] = [];
  if (topDriverIds.length > 0) {
    const { data: driversData } = await supabase
      .from("drivers")
      .select("id, full_name, phone_number")
      .in("id", topDriverIds);

    topDrivers = topDriverIds.map((id) => {
      const driver = (driversData || []).find((d) => d.id === id);
      return {
        driverId: id,
        driverName: driver?.full_name || driver?.phone_number || "Driver",
        deliveries: driverDeliveryCount.get(id) || 0,
      };
    });
  }

  // 4. Bottleneck: top 3 restaurants with highest avg minutes from order created → picked_up
  const { data: pickedUpJobs } = await supabase
    .from("delivery_jobs")
    .select("schedule_id, restaurant_id, picked_up_at")
    .not("picked_up_at", "is", null)
    .not("restaurant_id", "is", null)
    .gte("created_at", from)
    .lte("created_at", to)
    .limit(500);

  let slowRestaurants: SlowRestaurant[] = [];
  if (pickedUpJobs && pickedUpJobs.length > 0) {
    const orderIds = pickedUpJobs.map((j) => j.schedule_id).filter(Boolean) as string[];
    const { data: ordersForJobs } = await supabase
      .from("orders")
      .select("id, created_at")
      .in("id", orderIds);

    const orderCreatedMap2 = new Map((ordersForJobs || []).map((o) => [o.id, o.created_at]));

    const restaurantWaits = new Map<string, { total: number; count: number }>();
    pickedUpJobs.forEach((job) => {
      if (!job.restaurant_id || !job.schedule_id || !job.picked_up_at) return;
      const created = orderCreatedMap2.get(job.schedule_id);
      if (!created) return;
      const waitMin = (new Date(job.picked_up_at).getTime() - new Date(created).getTime()) / 60000;
      if (waitMin <= 0) return;
      const existing = restaurantWaits.get(job.restaurant_id) || { total: 0, count: 0 };
      restaurantWaits.set(job.restaurant_id, { total: existing.total + waitMin, count: existing.count + 1 });
    });

    const topSlowIds = [...restaurantWaits.entries()]
      .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)
      .slice(0, 3)
      .map(([id]) => id);

    if (topSlowIds.length > 0) {
      const { data: restaurantsData } = await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", topSlowIds);

      slowRestaurants = topSlowIds.map((id) => {
        const r = (restaurantsData || []).find((x) => x.id === id);
        const w = restaurantWaits.get(id)!;
        return {
          restaurantId: id,
          restaurantName: r?.name || "Restaurant",
          avgMinutes: Math.round(w.total / w.count),
          orderCount: w.count,
        };
      });
    }
  }

  return {
    dispatchedToday: dispatchedToday || 0,
    avgWaitMinutes,
    topDrivers,
    slowRestaurants,
  };
}

export default function FleetAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<RangePreset>("today");

  useEffect(() => {
    setLoading(true);
    const { from, to } = getRangeDates(preset);
    fetchAnalytics(from, to)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [preset]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Fleet Analytics</h1>
          <p className="text-muted-foreground flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {getRangeDates(preset).label}
          </p>
        </div>
        <div className="flex rounded-lg border bg-muted/40 p-1 gap-1">
          {(["today", "7d", "30d"] as RangePreset[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant="ghost"
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 text-sm ${preset === p ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
            >
              {p === "today" ? "Today" : p === "7d" ? "7 days" : "30 days"}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.dispatchedToday ?? 0}</p>
                <p className="text-xs text-muted-foreground">Orders dispatched</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {data?.avgWaitMinutes != null ? `${data.avgWaitMinutes} min` : "—"}
                </p>
                <p className="text-xs text-muted-foreground">Avg wait time to assignment</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data?.topDrivers.length ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active drivers with deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top drivers + Bottleneck restaurants */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-base">Top Drivers Today</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {(!data?.topDrivers || data.topDrivers.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">No completed deliveries recorded yet today.</p>
            ) : (
              <div className="space-y-3">
                {data.topDrivers.map((driver, index) => (
                  <div key={driver.driverId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-5">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-sm">{driver.driverName}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      <BarChart2 className="w-3 h-3 mr-1" />
                      {driver.deliveries} deliveries
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <CardTitle className="text-base">Slow Restaurants (Today)</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {(!data?.slowRestaurants || data.slowRestaurants.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8">No pickup data available yet today.</p>
            ) : (
              <div className="space-y-3">
                {data.slowRestaurants.map((r) => (
                  <div key={r.restaurantId} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.restaurantName}</p>
                      <p className="text-xs text-muted-foreground">{r.orderCount} orders sampled</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={r.avgMinutes > 30 ? "text-red-600 border-red-400" : "text-amber-600 border-amber-400"}
                    >
                      <Clock className="w-3 h-3 mr-1" />
                      avg {r.avgMinutes} min
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
