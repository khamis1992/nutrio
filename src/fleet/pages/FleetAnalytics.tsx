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

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type RangePreset = "today" | "7d" | "30d";

const C = {
  ink: "#020617",
  bg: "#F6F8FB",
  muted: "#94A3B8",
  border: "#E5EAF1",
  progress: "#22C7A1",
  water: "#38BDF8",
  protein: "#7C83F6",
  fat: "#FB6B7A",
  orange: "#F97316",
};

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

type MetricCardProps = {
  label: string;
  value: string | number;
  helper: string;
  icon: React.ElementType;
  accent: string;
  soft: string;
};

function MetricCard({ label, value, helper, icon: Icon, accent, soft }: MetricCardProps) {
  return (
    <div className="min-h-[138px] rounded-[26px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{label}</p>
          <p className="mt-2 text-[30px] font-black leading-none tracking-tight text-[#020617]">{value}</p>
        </div>
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]"
          style={{ backgroundColor: soft, color: accent }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-[12px] font-bold leading-5 text-[#94A3B8]">{helper}</p>
    </div>
  );
}

async function fetchAnalytics(from: string, to: string): Promise<AnalyticsData> {
  const { count: dispatchedToday } = await supabase
    .from("driver_assignment_history")
    .select("id", { count: "exact", head: true })
    .eq("action", "assigned")
    .gte("performed_at", from)
    .lte("performed_at", to);

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

        const orderCreatedMap = new Map((ordersData || []).map((o) => [o.id, o.created_at]));
        const jobOrderMap = new Map((jobsData || []).map((j) => [j.id, j.schedule_id]));

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
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-[30px]" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-36 rounded-[26px]" />
          <Skeleton className="h-36 rounded-[26px]" />
          <Skeleton className="h-36 rounded-[26px]" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-[30px]" />
          <Skeleton className="h-80 rounded-[30px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-[#020617]">
      <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.07)]">
        <div className="flex flex-col gap-5 bg-[#F6F8FB] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#22C7A1]">Fleet Performance</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#020617]">Analytics</h1>
            <p className="mt-2 flex items-center gap-2 text-sm font-bold text-[#94A3B8]">
              <Calendar className="h-4 w-4 text-[#38BDF8]" />
              {getRangeDates(preset).label}
            </p>
          </div>
          <div className="flex rounded-[18px] border border-[#E5EAF1] bg-white p-1.5 shadow-sm">
            {(["today", "7d", "30d"] as RangePreset[]).map((p) => (
              <Button
                key={p}
                size="sm"
                variant="ghost"
                onClick={() => setPreset(p)}
                className={`h-10 rounded-[14px] px-4 text-sm font-black transition ${
                  preset === p
                    ? "bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.14)] hover:bg-[#020617] hover:text-white"
                    : "text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                }`}
              >
                {p === "today" ? "Today" : p === "7d" ? "7 days" : "30 days"}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 border-t border-[#E5EAF1]">
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Dispatch</p>
            <p className="mt-1 text-lg font-black text-[#020617]">Live</p>
          </div>
          <div className="border-x border-[#E5EAF1] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Window</p>
            <p className="mt-1 text-lg font-black text-[#020617]">{preset === "today" ? "Daily" : preset === "7d" ? "Weekly" : "Monthly"}</p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Focus</p>
            <p className="mt-1 text-lg font-black text-[#020617]">Speed</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          label="Orders dispatched"
          value={data?.dispatchedToday ?? 0}
          helper="Assignments created during the selected reporting window."
          icon={Truck}
          accent={C.ink}
          soft={C.bg}
        />
        <MetricCard
          label="Avg wait"
          value={data?.avgWaitMinutes != null ? `${data.avgWaitMinutes} min` : "-"}
          helper="Average time from order creation to first driver assignment."
          icon={Clock}
          accent={C.water}
          soft="#EFF9FF"
        />
        <MetricCard
          label="Active drivers"
          value={data?.topDrivers.length ?? 0}
          helper="Drivers with completed deliveries in this period."
          icon={TrendingUp}
          accent={C.progress}
          soft="#EFFFFA"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">Leaderboard</p>
              <h2 className="mt-1 text-lg font-black text-[#020617]">Top Drivers</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-[#7C83F6] ring-1 ring-[#E5EAF1]">
              <Star className="h-5 w-5" />
            </div>
          </div>
          <div className="p-4">
            {(!data?.topDrivers || data.topDrivers.length === 0) ? (
              <div className="rounded-[22px] bg-[#F6F8FB] p-8 text-center ring-1 ring-[#E5EAF1]">
                <p className="text-sm font-black text-[#020617]">No completed deliveries yet</p>
                <p className="mt-1 text-xs font-semibold text-[#94A3B8]">Driver rankings will appear after delivery completion.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.topDrivers.map((driver, index) => (
                  <div
                    key={driver.driverId}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E5EAF1] bg-white p-3 shadow-[0_8px_18px_rgba(2,6,23,0.04)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F3F4FF] text-sm font-black text-[#7C83F6]">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-black text-[#020617]">{driver.driverName}</p>
                        <p className="text-xs font-semibold text-[#94A3B8]">Completed delivery volume</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-[#7C83F6]/20 bg-[#F3F4FF] font-black text-[#7C83F6]">
                      <BarChart2 className="mr-1 h-3 w-3" />
                      {driver.deliveries} deliveries
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FB6B7A]">Bottlenecks</p>
              <h2 className="mt-1 text-lg font-black text-[#020617]">Slow Restaurants</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white text-[#FB6B7A] ring-1 ring-[#E5EAF1]">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="p-4">
            {(!data?.slowRestaurants || data.slowRestaurants.length === 0) ? (
              <div className="rounded-[22px] bg-[#F6F8FB] p-8 text-center ring-1 ring-[#E5EAF1]">
                <p className="text-sm font-black text-[#020617]">No pickup delays found</p>
                <p className="mt-1 text-xs font-semibold text-[#94A3B8]">Bottleneck data will appear after pickup events are tracked.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.slowRestaurants.map((restaurant) => (
                  <div
                    key={restaurant.restaurantId}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-[#E5EAF1] bg-white p-3 shadow-[0_8px_18px_rgba(2,6,23,0.04)]"
                  >
                    <div>
                      <p className="text-sm font-black text-[#020617]">{restaurant.restaurantName}</p>
                      <p className="text-xs font-semibold text-[#94A3B8]">{restaurant.orderCount} orders sampled</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        restaurant.avgMinutes > 30
                          ? "border-[#FB6B7A]/25 bg-[#FFF0F2] font-black text-[#FB6B7A]"
                          : "border-[#F97316]/25 bg-[#FFF7ED] font-black text-[#F97316]"
                      }
                    >
                      <Clock className="mr-1 h-3 w-3" />
                      avg {restaurant.avgMinutes} min
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
