import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Car,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Search,
  Star,
  UserCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCity } from "@/fleet/context/CityContext";
import { useDrivers } from "@/fleet/hooks/useDrivers";

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
  fat: "#FB6B7A",
};

const statusOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending_verification", label: "Pending" },
  { value: "inactive", label: "Inactive" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">Active</Badge>;
    case "pending_verification":
      return <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#F97316]">Pending</Badge>;
    case "suspended":
      return <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#BE123C]">Suspended</Badge>;
    default:
      return <Badge className="border border-[#E5EAF1] bg-[#F6F8FB] text-[#64748B]">Inactive</Badge>;
  }
}

function DriverManagementSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 w-full rounded-[28px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-24 rounded-[24px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton key={item} className="h-56 rounded-[26px]" />
        ))}
      </div>
    </div>
  );
}

export default function DriverManagement() {
  const { selectedCities } = useCity();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const cityIds = useMemo(() => selectedCities.map((city) => city.id), [selectedCities]);
  const backendStatus = useMemo(() => {
    if (statusFilter === "active") return "approved";
    if (statusFilter === "pending_verification") return "pending";
    return "all";
  }, [statusFilter]);

  const { drivers, isLoading, total } = useDrivers({
    cityIds,
    status: backendStatus,
    search: search || undefined,
    page,
    limit: 20,
  });

  const visibleDrivers = useMemo(() => {
    if (statusFilter === "all") return drivers;
    return drivers.filter((driver) => driver.status === statusFilter);
  }, [drivers, statusFilter]);

  const stats = useMemo(() => {
    const online = visibleDrivers.filter((driver) => driver.isOnline).length;
    const active = visibleDrivers.filter((driver) => driver.status === "active").length;
    const pending = visibleDrivers.filter((driver) => driver.status === "pending_verification").length;
    const withVehicles = visibleDrivers.filter((driver) => driver.vehiclePlate).length;

    return { online, active, pending, withVehicles };
  }, [visibleDrivers]);

  if (isLoading) {
    return <DriverManagementSkeleton />;
  }

  return (
    <div className="space-y-5 bg-[#F6F8FB] px-1 pb-8 text-[#020617] sm:px-0">
      <div className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#7C83F6]">
              <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
              Fleet team
            </div>
            <h1 className="mt-3 text-[27px] font-black leading-tight text-[#020617]">Drivers</h1>
            <p className="mt-1 max-w-[34rem] text-sm font-semibold leading-6 text-[#64748B]">
              Manage driver availability, verification, vehicles, and live coverage from one mobile-ready view.
            </p>
          </div>
          <Link to="/fleet/drivers/new">
            <Button className="min-h-12 rounded-full bg-[#020617] px-4 font-black text-white shadow-none hover:bg-[#020617]/90">
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Online", value: stats.online, icon: Navigation, color: C.progress },
          { label: "Active", value: stats.active, icon: UserCheck, color: C.protein },
          { label: "Pending", value: stats.pending, icon: Clock, color: C.fat },
          { label: "Vehicles", value: stats.withVehicles, icon: Car, color: C.water },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black leading-none text-[#020617]">{value}</p>
                <p className="mt-1 text-xs font-bold text-[#94A3B8]">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card className="rounded-[26px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Search drivers, phones, plates..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 font-semibold text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusOptions.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(option.value);
                      setPage(1);
                    }}
                    className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black transition-colors ${
                      active ? "bg-[#020617] text-white" : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
              <button
                type="button"
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]"
                aria-label="More filters"
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {visibleDrivers.length === 0 ? (
        <Card className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F6F8FB] text-[#7C83F6]">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black text-[#020617]">No drivers found</h3>
            <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Try adjusting your search or status filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleDrivers.map((driver) => (
            <Link key={driver.id} to={`/fleet/drivers/${driver.id}`} className="block">
              <Card className="h-full rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1] transition duration-200 hover:-translate-y-0.5 hover:ring-[#CBD5E1]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
                        style={{
                          backgroundColor: driver.isOnline ? `${C.progress}18` : C.panel,
                          color: driver.isOnline ? C.progress : C.muted,
                        }}
                      >
                        {driver.fullName.charAt(0).toUpperCase()}
                        <span
                          className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white"
                          style={{ backgroundColor: driver.isOnline ? C.progress : "#CBD5E1" }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-black text-[#020617]">{driver.fullName}</h3>
                        <p className="truncate text-sm font-semibold text-[#94A3B8]">{driver.phone}</p>
                      </div>
                    </div>
                    {getStatusBadge(driver.status)}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-[#F6F8FB] p-3">
                      <Star className="mb-2 h-4 w-4 fill-[#FB6B7A] text-[#FB6B7A]" />
                      <p className="text-base font-black text-[#020617]">{driver.rating.toFixed(1)}</p>
                      <p className="text-[10px] font-black uppercase text-[#94A3B8]">Rating</p>
                    </div>
                    <div className="rounded-2xl bg-[#F6F8FB] p-3">
                      <Activity className="mb-2 h-4 w-4 text-[#7C83F6]" />
                      <p className="text-base font-black text-[#020617]">{driver.totalDeliveries}</p>
                      <p className="text-[10px] font-black uppercase text-[#94A3B8]">Trips</p>
                    </div>
                    <div className="rounded-2xl bg-[#F6F8FB] p-3">
                      <MapPin className="mb-2 h-4 w-4 text-[#38BDF8]" />
                      <p className="truncate text-base font-black text-[#020617]">{driver.cityId || "City"}</p>
                      <p className="text-[10px] font-black uppercase text-[#94A3B8]">Zone</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E5EAF1] pt-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#64748B]">
                        <Phone className="h-4 w-4 text-[#22C7A1]" />
                        <span className="truncate">{driver.phone}</span>
                      </div>
                      {driver.vehiclePlate && (
                        <div className="flex items-center gap-2 text-sm font-black text-[#020617]">
                          <Car className="h-4 w-4 text-[#7C83F6]" />
                          <span className="truncate font-mono">{driver.vehiclePlate}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between rounded-[24px] bg-white p-3 ring-1 ring-[#E5EAF1]">
          <p className="text-sm font-semibold text-[#94A3B8]">
            Showing {(page - 1) * 20 + 1} - {Math.min(page * 20, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((current) => current + 1)}
              disabled={page * 20 >= total}
              className="rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none"
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
