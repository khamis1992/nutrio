import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  Car,
  CheckCircle,
  Clock,
  RefreshCw,
  Search,
  Star,
  Truck,
  User,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Driver {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  is_online: boolean;
  total_deliveries: number;
  rating: number | null;
  wallet_balance: number;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  profile: {
    full_name: string | null;
    email: string;
  } | null;
}

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
  fat: "#FB6B7A",
};

const tabs = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "online", label: "Online" },
];

function getStatusBadge(status: Driver["approval_status"]) {
  switch (status) {
    case "approved":
      return <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">Approved</Badge>;
    case "pending":
      return <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#F97316]">Pending</Badge>;
    case "rejected":
      return <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#BE123C]">Rejected</Badge>;
    default:
      return <Badge className="border border-[#E5EAF1] bg-[#F6F8FB] text-[#64748B]">{status}</Badge>;
  }
}

function getVehicleIcon(type: string) {
  switch (type) {
    case "car":
      return <Car className="h-4 w-4" />;
    case "bike":
      return <Bike className="h-4 w-4" />;
    default:
      return <Truck className="h-4 w-4" />;
  }
}

function DriverSkeleton() {
  return (
    <AdminLayout title="Driver Management">
      <div className="space-y-5 bg-[#F6F8FB]">
        <Skeleton className="h-36 rounded-[28px]" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-24 rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-[26px]" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-52 rounded-[28px]" />
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}

export default function AdminDrivers() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("drivers")
        .select(`
          id,
          user_id,
          vehicle_type,
          vehicle_make,
          vehicle_model,
          vehicle_plate,
          is_online,
          total_deliveries,
          rating,
          wallet_balance,
          approval_status,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((data || []).map((driver) => driver.user_id).filter(Boolean))];
      let profilesMap: Record<string, { full_name: string | null; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        } else if (profiles) {
          profilesMap = profiles.reduce((acc, profile) => {
            acc[profile.user_id] = {
              full_name: profile.full_name,
              email: profile.email || "",
            };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string }>);
        }
      }

      const transformed: Driver[] = (data || []).map((driver) => ({
        ...driver,
        profile: profilesMap[driver.user_id] || null,
      }));

      setDrivers(transformed);
    } catch (error) {
      console.warn("Error fetching drivers (table may be empty):", error);
    } finally {
      setLoading(false);
    }
  };

  const updateApprovalStatus = async (driverId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ approval_status: status })
        .eq("id", driverId);

      if (error) throw error;

      setDrivers((prev) =>
        prev.map((driver) =>
          driver.id === driverId ? { ...driver, approval_status: status } : driver
        )
      );

      toast({
        title: `Driver ${status}`,
        description: `Driver has been ${status} successfully`,
      });
    } catch (error) {
      console.error("Error updating driver:", error);
      toast({
        title: "Error",
        description: "Failed to update driver status",
        variant: "destructive",
      });
    }
  };

  const stats = useMemo(() => ({
    total: drivers.length,
    pending: drivers.filter((driver) => driver.approval_status === "pending").length,
    approved: drivers.filter((driver) => driver.approval_status === "approved").length,
    online: drivers.filter((driver) => driver.is_online).length,
    totalEarnings: drivers.reduce((sum, driver) => sum + driver.wallet_balance, 0),
    totalDeliveries: drivers.reduce((sum, driver) => sum + driver.total_deliveries, 0),
  }), [drivers]);

  const filteredDrivers = useMemo(() => {
    const searchLower = searchQuery.trim().toLowerCase();

    return drivers.filter((driver) => {
      const matchesSearch =
        !searchLower ||
        driver.profile?.full_name?.toLowerCase().includes(searchLower) ||
        driver.profile?.email?.toLowerCase().includes(searchLower) ||
        driver.vehicle_plate?.toLowerCase().includes(searchLower) ||
        driver.vehicle_type?.toLowerCase().includes(searchLower);

      const matchesTab =
        activeTab === "all" ||
        (activeTab === "pending" && driver.approval_status === "pending") ||
        (activeTab === "approved" && driver.approval_status === "approved") ||
        (activeTab === "online" && driver.is_online);

      return matchesSearch && matchesTab;
    });
  }, [activeTab, drivers, searchQuery]);

  if (loading) {
    return <DriverSkeleton />;
  }

  return (
    <AdminLayout title="Driver Management" subtitle="Manage drivers and deliveries">
      <div className="space-y-5 bg-[#F6F8FB] pb-8 text-[#020617]">
        <div className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#7C83F6]">
                <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                Admin fleet
              </div>
              <h1 className="mt-3 text-[28px] font-black leading-tight text-[#020617]">Driver approvals</h1>
              <p className="mt-1 max-w-[40rem] text-sm font-semibold leading-6 text-[#64748B]">
                Review registered drivers, approve access, monitor online coverage, and track fleet wallet balances.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchDrivers}
              className="min-h-12 rounded-full border-[#E5EAF1] bg-white px-4 font-black text-[#020617] shadow-none"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Total Drivers", value: stats.total, icon: Users, color: C.protein },
            { label: "Approved", value: stats.approved, icon: CheckCircle, color: C.progress },
            { label: "Deliveries", value: stats.totalDeliveries, icon: Truck, color: C.water },
            { label: "Wallet", value: `QAR ${stats.totalEarnings.toFixed(0)}`, icon: Wallet, color: C.fat },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-2xl font-black leading-none text-[#020617]">{value}</p>
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
                  placeholder="Search name, email, plate, vehicle..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 font-semibold text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {tabs.map((tab) => {
                  const count =
                    tab.value === "all" ? stats.total :
                    tab.value === "pending" ? stats.pending :
                    tab.value === "approved" ? stats.approved :
                    stats.online;
                  const active = activeTab === tab.value;

                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTab(tab.value)}
                      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black transition-colors ${
                        active ? "bg-[#020617] text-white" : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                      }`}
                    >
                      {tab.label} <span className={active ? "text-white/75" : "text-[#94A3B8]"}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredDrivers.length === 0 ? (
          <Card className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
            <CardContent className="px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F6F8FB] text-[#7C83F6]">
                <Users className="h-8 w-8" />
              </div>
              <p className="text-lg font-black text-[#020617]">No drivers found</p>
              <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                Drivers will appear here once they register through the Driver portal.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredDrivers.map((driver) => {
              const driverName = driver.profile?.full_name || "Unnamed Driver";
              const vehicleLabel = [driver.vehicle_make, driver.vehicle_model].filter(Boolean).join(" ") || driver.vehicle_type;

              return (
                <Card key={driver.id} className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#7C83F6]">
                          <User className="h-6 w-6" />
                          <span
                            className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white"
                            style={{ backgroundColor: driver.is_online ? C.progress : "#CBD5E1" }}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-black text-[#020617]">{driverName}</h3>
                          <p className="truncate text-sm font-semibold text-[#94A3B8]">{driver.profile?.email || "No email"}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {getStatusBadge(driver.approval_status)}
                            {driver.is_online && (
                              <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">Online</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {driver.approval_status === "pending" && (
                        <div className="grid grid-cols-2 gap-2 sm:flex">
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-10 rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 font-black text-[#047857] shadow-none hover:bg-[#22C7A1]/15"
                            onClick={() => updateApprovalStatus(driver.id, "approved")}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-10 rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 font-black text-[#BE123C] shadow-none hover:bg-[#FB6B7A]/15"
                            onClick={() => updateApprovalStatus(driver.id, "rejected")}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-2xl bg-[#F6F8FB] p-3">
                        <div className="mb-2 text-[#38BDF8]">{getVehicleIcon(driver.vehicle_type)}</div>
                        <p className="truncate text-sm font-black capitalize text-[#020617]">{vehicleLabel}</p>
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">{driver.vehicle_plate || "No plate"}</p>
                      </div>
                      <div className="rounded-2xl bg-[#F6F8FB] p-3">
                        <Truck className="mb-2 h-4 w-4 text-[#7C83F6]" />
                        <p className="text-sm font-black text-[#020617]">{driver.total_deliveries}</p>
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">Deliveries</p>
                      </div>
                      <div className="rounded-2xl bg-[#F6F8FB] p-3">
                        <Star className="mb-2 h-4 w-4 fill-[#FB6B7A] text-[#FB6B7A]" />
                        <p className="text-sm font-black text-[#020617]">{driver.rating?.toFixed(1) || "0.0"}</p>
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">Rating</p>
                      </div>
                      <div className="rounded-2xl bg-[#F6F8FB] p-3">
                        <Wallet className="mb-2 h-4 w-4 text-[#22C7A1]" />
                        <p className="truncate text-sm font-black text-[#020617]">QAR {driver.wallet_balance.toFixed(2)}</p>
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">Wallet</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
