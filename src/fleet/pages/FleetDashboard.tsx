import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import {
  Activity,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Package,
  Plus,
  Radio,
  Route,
  Truck,
  Users,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCity } from "@/fleet/context/CityContext";
import { useFleetStats } from "@/fleet/hooks/useDrivers";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

interface ActivityEntry {
  id: string;
  action: string;
  performedAt: string | null;
  driverName: string;
  reason: string | null;
}

type KpiCardProps = {
  label: string;
  value: number | string;
  helper: string;
  icon: React.ElementType;
  accent: string;
  soft: string;
};

function KpiCard({ label, value, helper, icon: Icon, accent, soft }: KpiCardProps) {
  return (
    <div className="min-h-[132px] rounded-[26px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{label}</p>
          <p className="mt-2 text-[30px] font-black leading-none tracking-[-0.04em] text-[#020617]">{value}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px]" style={{ backgroundColor: soft, color: accent }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-[12px] font-bold leading-5 text-[#94A3B8]">{helper}</p>
    </div>
  );
}

function QuickAction({
  to,
  label,
  helper,
  icon: Icon,
  accent,
  soft,
}: {
  to: string;
  label: string;
  helper: string;
  icon: React.ElementType;
  accent: string;
  soft: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[94px] items-center gap-3 rounded-[24px] border border-[#E5EAF1] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition active:scale-[0.99]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]" style={{ backgroundColor: soft, color: accent }}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-black leading-tight text-[#020617]">{label}</p>
        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-[#94A3B8]">{helper}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[#94A3B8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}

function FleetDashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-44 rounded-[30px]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-32 rounded-[26px]" />
        <Skeleton className="h-32 rounded-[26px]" />
        <Skeleton className="h-32 rounded-[26px]" />
        <Skeleton className="h-32 rounded-[26px]" />
      </div>
      <Skeleton className="h-72 rounded-[30px]" />
    </div>
  );
}

export default function FleetDashboard() {
  const { selectedCities, setSelectedCities, availableCities } = useCity();
  const cityIds = useMemo(() => selectedCities.map((city) => city.id), [selectedCities]);
  const { stats, isLoading } = useFleetStats(cityIds);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (cityFilter === "all") {
      setSelectedCities([]);
      return;
    }
    const city = availableCities.find((item) => item.id === cityFilter);
    setSelectedCities(city ? [city] : []);
  }, [availableCities, cityFilter, setSelectedCities]);

  useEffect(() => {
    async function loadActivity() {
      const { data } = await supabase
        .from("driver_assignment_history")
        .select("id, action, performed_at, reason, driver_id")
        .order("performed_at", { ascending: false })
        .limit(5);

      if (!data) return;

      const driverIds = [
        ...new Set(
          data
            .map((row) => row.driver_id)
            .filter((driverId): driverId is string => Boolean(driverId)),
        ),
      ];
      const nameMap: Record<string, string> = {};
      if (driverIds.length > 0) {
        const { data: drivers } = await supabase
          .from("drivers")
          .select("id, full_name, phone_number")
          .in("id", driverIds);
        (drivers || []).forEach((driver) => {
          nameMap[driver.id] = driver.full_name || driver.phone_number || "Driver";
        });
      }

      setRecentActivity(
        data.map((row) => ({
          id: row.id,
          action: row.action,
          performedAt: row.performed_at,
          driverName: row.driver_id ? (nameMap[row.driver_id] || "Driver") : "Driver",
          reason: row.reason,
        })),
      );
    }

    loadActivity().catch(console.error);
  }, []);

  if (isLoading) return <FleetDashboardSkeleton />;

  const safeStats = stats || {
    totalDrivers: 0,
    activeDrivers: 0,
    onlineDrivers: 0,
    ordersInProgress: 0,
    todayDeliveries: 0,
    averageDeliveryTime: 0,
    cities: [],
  };

  const onlineRate = Math.round((safeStats.onlineDrivers / Math.max(safeStats.totalDrivers, 1)) * 100);
  const activeRate = Math.round((safeStats.activeDrivers / Math.max(safeStats.totalDrivers, 1)) * 100);
  const offlineDrivers = Math.max(0, safeStats.totalDrivers - safeStats.onlineDrivers);
  const selectedCityLabel = cityFilter === "all"
    ? "All cities"
    : availableCities.find((city) => city.id === cityFilter)?.name || "Selected city";

  return (
    <div className="min-h-full bg-[#F6F8FB] pb-8 text-[#020617]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.07)] lg:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#020617] ring-1 ring-[#E5EAF1]">
                <Radio className="h-3.5 w-3.5 text-[#22C7A1]" />
                Live fleet control
              </div>
              <h1 className="mt-4 max-w-2xl text-[34px] font-black leading-[0.96] tracking-[-0.05em] text-[#020617] lg:text-[44px]">
                Fleet operations, ready for dispatch.
              </h1>
              <p className="mt-3 max-w-2xl text-[14px] font-semibold leading-6 text-[#94A3B8]">
                Monitor drivers, active orders, city coverage, and operational movement from one clean control surface.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Coverage</p>
              <select
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                className="h-12 min-w-[190px] rounded-[18px] border border-[#E5EAF1] bg-white px-3 text-[13px] font-black text-[#020617] outline-none"
              >
                <option value="all">All Cities</option>
                {availableCities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-[20px] bg-[#EFFFFA] p-3 ring-1 ring-[#22C7A1]/20">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">Scope</p>
              <p className="mt-1 text-[15px] font-black text-[#020617]">{selectedCityLabel}</p>
            </div>
            <div className="rounded-[20px] bg-[#EFF9FF] p-3 ring-1 ring-[#38BDF8]/20">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#38BDF8]">Online</p>
              <p className="mt-1 text-[15px] font-black text-[#020617]">{onlineRate}%</p>
            </div>
            <div className="rounded-[20px] bg-[#F3F4FF] p-3 ring-1 ring-[#7C83F6]/20">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7C83F6]">Active</p>
              <p className="mt-1 text-[15px] font-black text-[#020617]">{activeRate}%</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Drivers"
            value={safeStats.totalDrivers}
            helper={`${safeStats.activeDrivers} active in fleet`}
            icon={Users}
            accent={C.protein}
            soft="#F3F4FF"
          />
          <KpiCard
            label="Online now"
            value={safeStats.onlineDrivers}
            helper={`${offlineDrivers} currently offline`}
            icon={Radio}
            accent={C.progress}
            soft="#EFFFFA"
          />
          <KpiCard
            label="Active orders"
            value={safeStats.ordersInProgress}
            helper="Awaiting or in delivery flow"
            icon={Package}
            accent={C.fat}
            soft="#FFF0F2"
          />
          <KpiCard
            label="Delivered"
            value={safeStats.todayDeliveries}
            helper="Completed today"
            icon={CheckCircle2}
            accent={C.water}
            soft="#EFF9FF"
          />
        </section>

        <Link
          to="/fleet/dispatch"
          className="group block overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-[#020617] p-4 text-white shadow-[0_18px_44px_rgba(2,6,23,0.18)] transition active:scale-[0.995]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white text-[#020617]">
                <Package className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#38BDF8]">Primary workflow</p>
                <h2 className="mt-1 text-[20px] font-black leading-tight">Dispatch Center</h2>
                <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-white/65">
                  Assign live orders, review bulk routes, and manage automatic dispatch rules.
                </p>
              </div>
            </div>
            <ChevronRight className="h-6 w-6 shrink-0 text-white/60 transition group-hover:translate-x-1" />
          </div>
        </Link>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <QuickAction to="/fleet/drivers" label="Drivers" helper="Manage approvals, availability, and profiles." icon={Users} accent={C.protein} soft="#F3F4FF" />
          <QuickAction to="/fleet/vehicles" label="Vehicles" helper="Track fleet assets and assigned vehicles." icon={Truck} accent={C.orange} soft="#FFF7ED" />
          <QuickAction to="/fleet/tracking" label="Live tracking" helper="Watch active driver movement and locations." icon={MapPin} accent={C.progress} soft="#EFFFFA" />
          <QuickAction to="/fleet/analytics" label="Analytics" helper="Review performance, timing, and delivery trends." icon={BarChart2} accent={C.water} soft="#EFF9FF" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[30px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">Driver status</p>
                <h2 className="mt-1 text-[21px] font-black text-[#020617]">Availability mix</h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-5">
              <div className="relative h-32 w-32 shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="#E5EAF1" strokeWidth="12" />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="#22C7A1"
                    strokeLinecap="round"
                    strokeWidth="12"
                    strokeDasharray={`${onlineRate * 3.016} 301.6`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[27px] font-black leading-none text-[#020617]">{onlineRate}%</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">online</p>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                {[
                  { label: "Online", value: safeStats.onlineDrivers, color: C.progress, bg: "#EFFFFA" },
                  { label: "Active", value: safeStats.activeDrivers, color: C.protein, bg: "#F3F4FF" },
                  { label: "Offline", value: offlineDrivers, color: C.muted, bg: C.bg },
                ].map((item) => (
                  <div key={item.label} className="rounded-[18px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[12px] font-black text-[#020617]">{item.label}</span>
                      </div>
                      <span className="text-[14px] font-black text-[#020617]">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[30px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#FB6B7A]">Recent activity</p>
                <h2 className="mt-1 text-[21px] font-black text-[#020617]">Dispatch movement</h2>
              </div>
              <Link to="/fleet/dispatch" className="rounded-full bg-[#F6F8FB] px-3 py-2 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                View all
              </Link>
            </div>

            <div className="mt-4 space-y-2">
              {recentActivity.length === 0 ? (
                <div className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-5 text-center">
                  <Route className="mx-auto h-6 w-6 text-[#94A3B8]" />
                  <p className="mt-2 text-[13px] font-black text-[#020617]">No recent dispatch activity</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#94A3B8]">New driver assignment events will appear here.</p>
                </div>
              ) : (
                recentActivity.map((entry) => {
                  const isAssign = entry.action === "assigned";
                  const isReassign = entry.action === "reassigned";
                  const accent = isAssign ? C.progress : isReassign ? C.water : C.orange;
                  const soft = isAssign ? "#EFFFFA" : isReassign ? "#EFF9FF" : "#FFF7ED";
                  const label = isAssign ? "Order assigned" : isReassign ? "Order reassigned" : entry.action.replace(/_/g, " ");

                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]" style={{ backgroundColor: soft, color: accent }}>
                          <Activity className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black capitalize text-[#020617]">{label}</p>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#94A3B8]">
                            {entry.driverName}{entry.reason ? ` - ${entry.reason}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-bold text-[#94A3B8]">
                        {entry.performedAt ? formatDistanceToNow(new Date(entry.performedAt), { addSuffix: true }) : "-"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[#FFF0F2] text-[#FB6B7A]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[17px] font-black text-[#020617]">Need more drivers?</p>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#94A3B8]">
                  Add drivers to improve city coverage and reduce dispatch pressure.
                </p>
              </div>
            </div>
            <Link
              to="/fleet/drivers"
              className={cn(
                "inline-flex min-h-12 items-center justify-center gap-2 rounded-[18px] bg-[#020617] px-5 text-[13px] font-black text-white transition active:scale-[0.98]",
              )}
            >
              <Plus className="h-4 w-4" />
              Add Driver
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
