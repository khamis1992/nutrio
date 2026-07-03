import { useState, useEffect, type ReactNode } from "react";
import {
  AlertTriangle,
  Bike,
  Calendar,
  Car,
  CheckCircle,
  Edit,
  Gauge,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  User,
  Wrench,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AddVehicleModal } from "@/fleet/components/vehicles/AddVehicleModal";
import { EditVehicleModal } from "@/fleet/components/vehicles/EditVehicleModal";
import type { Driver, Vehicle, VehicleStatus } from "@/fleet/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const C = {
  text: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  water: "#38BDF8",
  fat: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

type VehicleTypeFilter = Vehicle["type"] | "all";

export default function VehicleManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<VehicleTypeFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [expiringCount, setExpiringCount] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [quickAssignMap, setQuickAssignMap] = useState<Record<string, string>>({});
  const [assigningVehicleId, setAssigningVehicleId] = useState<string | null>(null);

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const query = supabase
        .from("vehicles")
        .select("*")
        .order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const transformedVehicles: Vehicle[] = (data || []).map((v: { id: string; city_id?: string; type: Vehicle["type"]; make?: string; model?: string; year?: number; color?: string; plate_number: string; registration_number?: string; insurance_provider?: string; insurance_expiry?: string; insurance_document_url?: string; status: string; assigned_driver_id?: string; assigned_driver_name?: string; vehicle_photo_url?: string; registration_document_url?: string; created_at: string; updated_at?: string }) => ({
        id: v.id,
        cityId: v.city_id || "",
        type: v.type,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        plateNumber: v.plate_number,
        registrationNumber: v.registration_number,
        insuranceProvider: v.insurance_provider,
        insuranceExpiry: v.insurance_expiry,
        insuranceDocumentUrl: v.insurance_document_url,
        status: v.status as VehicleStatus,
        assignedDriverId: v.assigned_driver_id,
        assignedDriverName: v.assigned_driver_name,
        vehiclePhotoUrl: v.vehicle_photo_url,
        registrationDocumentUrl: v.registration_document_url,
      }));

      setVehicles(transformedVehicles);

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const expiring = transformedVehicles.filter((v) => {
        if (!v.insuranceExpiry) return false;
        const expiryDate = new Date(v.insuranceExpiry);
        return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
      });

      setExpiringCount(expiring.length);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      toast({
        title: "Error",
        description: "Failed to load vehicles",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("approval_status", "approved")
        .eq("is_active", true);

      if (error) throw error;

      const transformedDrivers: Driver[] = (data || []).map((d: { id: string; user_id?: string; email?: string; phone_number?: string; full_name?: string; city_id?: string; assigned_zone_ids?: string[]; approval_status?: string; is_active?: boolean; is_online?: boolean; total_deliveries?: number; rating?: number; cancellation_rate?: number; wallet_balance?: number; total_earnings?: number; assigned_vehicle_id?: string; created_at: string; updated_at?: string }) => ({
        id: d.id,
        authUserId: d.user_id,
        email: d.email || "",
        phone: d.phone_number || "",
        fullName: d.full_name || `Driver ${d.phone_number?.slice(-4) || d.id.slice(0, 8)}`,
        cityId: d.city_id || "",
        assignedZoneIds: d.assigned_zone_ids || [],
        status: d.approval_status === "approved" && d.is_active ? "active" : "inactive",
        isOnline: d.is_online || false,
        totalDeliveries: d.total_deliveries || 0,
        rating: d.rating || 5.0,
        cancellationRate: d.cancellation_rate || 0,
        currentBalance: d.wallet_balance || 0,
        totalEarnings: d.total_earnings || 0,
        assignedVehicleId: d.assigned_vehicle_id,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));

      setDrivers(transformedDrivers);
    } catch (error) {
      console.error("Error fetching drivers:", error);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchDrivers();
  }, []);

  const filteredVehicles = vehicles.filter((v) => {
    const query = search.trim().toLowerCase();
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (typeFilter !== "all" && v.type !== typeFilter) return false;
    if (!query) return true;
    return [
      v.plateNumber,
      v.make,
      v.model,
      v.color,
      v.registrationNumber,
      drivers.find((d) => d.id === v.assignedDriverId)?.fullName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const stats = {
    total: vehicles.length,
    available: vehicles.filter((v) => v.status === "available").length,
    assigned: vehicles.filter((v) => v.status === "assigned").length,
    maintenance: vehicles.filter((v) => v.status === "maintenance").length,
  };

  const activeUtilization = stats.total > 0 ? Math.round((stats.assigned / stats.total) * 100) : 0;
  const unassignedDrivers = drivers.filter((d) => !d.assignedVehicleId).length;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      assigned: "border-transparent bg-[#7C83F6]/10 text-[#7C83F6]",
      available: "border-transparent bg-[#22C7A1]/10 text-[#0F9F82]",
      maintenance: "border-transparent bg-[#FB6B7A]/10 text-[#FB6B7A]",
      retired: "border-transparent bg-slate-200 text-slate-500",
    };

    const label = status.charAt(0).toUpperCase() + status.slice(1);

    return (
      <Badge className={cn("rounded-full px-3 py-1 text-[11px] font-black shadow-none", styles[status] || styles.retired)}>
        {label}
      </Badge>
    );
  };

  const getVehicleIcon = (type: string) => {
    const className = "h-6 w-6";
    switch (type) {
      case "motorcycle":
      case "bicycle":
        return <Bike className={className} />;
      case "car":
        return <Car className={className} />;
      case "van":
        return <Truck className={className} />;
      default:
        return <Truck className={className} />;
    }
  };

  const getVehicleAccent = (status: string) => {
    switch (status) {
      case "assigned":
        return C.protein;
      case "available":
        return C.progress;
      case "maintenance":
        return C.fat;
      default:
        return C.muted;
    }
  };

  const isInsuranceExpiringSoon = (expiryDate: string) => {
    const daysUntil = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30;
  };

  const isInsuranceExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const getInsuranceState = (vehicle: Vehicle) => {
    if (!vehicle.insuranceExpiry) return { label: "Not recorded", color: C.muted, tone: "bg-slate-100" };
    if (isInsuranceExpired(vehicle.insuranceExpiry)) return { label: "Expired", color: C.fat, tone: "bg-[#FB6B7A]/10" };
    if (isInsuranceExpiringSoon(vehicle.insuranceExpiry)) return { label: "Expiring soon", color: "#F59E0B", tone: "bg-amber-100" };
    return { label: "Protected", color: C.progress, tone: "bg-[#22C7A1]/10" };
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsEditModalOpen(true);
  };

  const handleStatusChange = async (vehicle: Vehicle, newStatus: VehicleStatus) => {
    try {
      const { error } = await supabase
        .from("vehicles")
        .update({ status: newStatus })
        .eq("id", vehicle.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Vehicle status updated to ${newStatus}`,
      });

      fetchVehicles();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const handleQuickAssign = async (vehicle: Vehicle) => {
    const driverId = quickAssignMap[vehicle.id];
    if (!driverId) return;
    setAssigningVehicleId(vehicle.id);
    try {
      if (vehicle.assignedDriverId) {
        await supabase
          .from("drivers")
          .update({ assigned_vehicle_id: null })
          .eq("id", vehicle.assignedDriverId);
      }

      await supabase
        .from("vehicles")
        .update({ assigned_driver_id: driverId, status: "assigned" })
        .eq("id", vehicle.id);

      await supabase
        .from("drivers")
        .update({ assigned_vehicle_id: vehicle.id })
        .eq("id", driverId);

      toast({ title: "Driver assigned", description: "Vehicle has been assigned successfully." });
      setQuickAssignMap((prev) => {
        const next = { ...prev };
        delete next[vehicle.id];
        return next;
      });
      fetchVehicles();
      fetchDrivers();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to assign driver.", variant: "destructive" });
    } finally {
      setAssigningVehicleId(null);
    }
  };

  const handleUnassignDriver = async (vehicle: Vehicle) => {
    if (!vehicle.assignedDriverId) return;
    setAssigningVehicleId(vehicle.id);
    try {
      await supabase
        .from("vehicles")
        .update({ assigned_driver_id: null, status: "available" })
        .eq("id", vehicle.id);

      await supabase
        .from("drivers")
        .update({ assigned_vehicle_id: null })
        .eq("id", vehicle.assignedDriverId);

      toast({ title: "Driver unassigned", description: "Vehicle is now available." });
      fetchVehicles();
      fetchDrivers();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to unassign driver.", variant: "destructive" });
    } finally {
      setAssigningVehicleId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-[28px]" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-[24px]" />
          <Skeleton className="h-64 rounded-[24px]" />
          <Skeleton className="h-64 rounded-[24px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#020617]">
      <section className="relative overflow-hidden rounded-[28px] border border-white bg-white p-5 shadow-[0_18px_45px_rgba(2,6,23,0.06)]">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(34,199,161,0.18),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_38%)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
              <Truck className="h-4 w-4 text-[#22C7A1]" />
              Fleet Assets
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-[#020617] md:text-4xl">Vehicles</h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#94A3B8]">
              Manage vehicle readiness, assignments, insurance risk, and service status from one operational control surface.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="h-11 rounded-full border-slate-200 bg-white px-5 font-black text-[#020617] shadow-sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4 text-[#94A3B8]" />
              Reset Filters
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="h-11 rounded-full bg-[#22C7A1] px-5 font-black text-white shadow-[0_12px_24px_rgba(34,199,161,0.24)] hover:bg-[#1DB492]"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Vehicle
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard title="Total Fleet" value={stats.total} icon={<Truck className="h-5 w-5" />} color={C.progress} helper={`${activeUtilization}% assigned`} />
        <KpiCard title="Available" value={stats.available} icon={<CheckCircle className="h-5 w-5" />} color={C.water} helper="Ready to dispatch" />
        <KpiCard title="Assigned" value={stats.assigned} icon={<User className="h-5 w-5" />} color={C.protein} helper="Linked to drivers" />
        <KpiCard title="Service" value={stats.maintenance} icon={<Wrench className="h-5 w-5" />} color={C.fat} helper="Needs attention" />
        <KpiCard title="Drivers Free" value={unassignedDrivers} icon={<Gauge className="h-5 w-5" />} color={C.progress} helper="No vehicle linked" />
      </section>

      {expiringCount > 0 && (
        <section className="rounded-[22px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-[#FB6B7A] shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-[#020617]">Insurance expiring soon</p>
              <p className="mt-1 text-sm font-medium text-[#94A3B8]">
                {expiringCount} vehicle(s) have insurance expiring within 30 days. Review documents before dispatch assignments.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_14px_35px_rgba(2,6,23,0.045)]">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search plate, model, color, registration, or driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 rounded-2xl border-slate-100 bg-[#F6F8FB] pl-11 text-sm font-semibold text-[#020617] shadow-none placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-[#F6F8FB] font-bold text-[#020617] shadow-none focus:ring-[#22C7A1]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as VehicleTypeFilter)}>
            <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-[#F6F8FB] font-bold text-[#020617] shadow-none focus:ring-[#22C7A1]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="motorcycle">Motorcycle</SelectItem>
              <SelectItem value="car">Car</SelectItem>
              <SelectItem value="bicycle">Bicycle</SelectItem>
              <SelectItem value="van">Van</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredVehicles.map((vehicle) => {
          const driver = vehicle.assignedDriverId
            ? drivers.find((d) => d.id === vehicle.assignedDriverId)
            : null;
          const accent = getVehicleAccent(vehicle.status);
          const insuranceState = getInsuranceState(vehicle);

          return (
            <Card key={vehicle.id} className="group h-full overflow-hidden rounded-[24px] border-slate-100 bg-white shadow-[0_14px_35px_rgba(2,6,23,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_42px_rgba(2,6,23,0.08)]">
              <CardContent className="p-0">
                <div className="relative p-4">
                  <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: accent }} />
                  <div className="flex items-start justify-between gap-3 pt-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl text-white shadow-[0_12px_22px_rgba(2,6,23,0.12)]" style={{ background: accent }}>
                        {getVehicleIcon(vehicle.type)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-xl font-black tracking-[-0.035em] text-[#020617]">{vehicle.plateNumber}</h3>
                        <p className="mt-0.5 truncate text-sm font-semibold text-[#94A3B8]">
                          {vehicle.make || "Fleet"} {vehicle.model || "vehicle"}
                          {vehicle.year ? ` (${vehicle.year})` : ""}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(vehicle.status)}
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <MiniMetric label="Type" value={formatVehicleType(vehicle.type)} color={C.water} />
                    <MiniMetric label="Color" value={vehicle.color || "Not set"} color={C.fat} />
                    <MiniMetric label="Use" value={`${activeUtilization}%`} color={C.progress} />
                  </div>

                  <div className="mt-4 space-y-3 rounded-[18px] bg-[#F6F8FB] p-3">
                    <InfoRow
                      icon={<User className="h-4 w-4" />}
                      label="Driver"
                      value={driver?.fullName || (vehicle.assignedDriverName ?? "Unassigned")}
                      valueClassName={!driver && !vehicle.assignedDriverName ? "text-[#94A3B8]" : undefined}
                    />
                    <InfoRow
                      icon={<ShieldCheck className="h-4 w-4" />}
                      label="Insurance"
                      value={vehicle.insuranceExpiry ? new Date(vehicle.insuranceExpiry).toLocaleDateString() : "Not recorded"}
                      right={
                        <span className={cn("rounded-full px-2 py-1 text-[10px] font-black", insuranceState.tone)} style={{ color: insuranceState.color }}>
                          {insuranceState.label}
                        </span>
                      }
                    />
                    {vehicle.registrationNumber && (
                      <InfoRow
                        icon={<Calendar className="h-4 w-4" />}
                        label="Registration"
                        value={vehicle.registrationNumber}
                      />
                    )}
                  </div>

                  {vehicle.status === "available" && (
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <Select
                        value={quickAssignMap[vehicle.id] || ""}
                        onValueChange={(val) =>
                          setQuickAssignMap((prev) => ({ ...prev, [vehicle.id]: val }))
                        }
                      >
                        <SelectTrigger className="h-10 rounded-2xl border-slate-100 bg-white text-xs font-bold shadow-none">
                          <SelectValue placeholder="Pick a driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers.filter((d) => !d.assignedVehicleId).map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.fullName} - {d.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        className="h-10 rounded-2xl bg-[#22C7A1] px-4 text-xs font-black text-white hover:bg-[#1DB492]"
                        disabled={!quickAssignMap[vehicle.id] || assigningVehicleId === vehicle.id}
                        onClick={() => handleQuickAssign(vehicle)}
                      >
                        {assigningVehicleId === vehicle.id ? "..." : "Assign"}
                      </Button>
                    </div>
                  )}

                  {vehicle.status === "assigned" && vehicle.assignedDriverId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 h-10 w-full rounded-2xl border-[#FB6B7A]/20 bg-[#FB6B7A]/5 text-xs font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                      disabled={assigningVehicleId === vehicle.id}
                      onClick={() => handleUnassignDriver(vehicle)}
                    >
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      {assigningVehicleId === vehicle.id ? "Unassigning..." : "Unassign Driver"}
                    </Button>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-2xl border-slate-100 bg-white font-black text-[#020617]"
                      onClick={() => handleEditClick(vehicle)}
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5 text-[#94A3B8]" />
                      Edit
                    </Button>
                    {vehicle.status === "maintenance" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-2xl border-[#22C7A1]/20 bg-[#22C7A1]/5 font-black text-[#0F9F82] hover:bg-[#22C7A1]/10 hover:text-[#0F9F82]"
                        onClick={() => handleStatusChange(vehicle, "available")}
                      >
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        Complete
                      </Button>
                    ) : vehicle.status !== "retired" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 rounded-2xl border-[#FB6B7A]/20 bg-[#FB6B7A]/5 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                        onClick={() => handleStatusChange(vehicle, "maintenance")}
                      >
                        <Wrench className="mr-1.5 h-3.5 w-3.5" />
                        Service
                      </Button>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {filteredVehicles.length === 0 && !isLoading && (
        <Card className="rounded-[24px] border-slate-100 bg-white shadow-[0_14px_35px_rgba(2,6,23,0.045)]">
          <CardContent className="px-6 py-12 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[#F6F8FB] text-[#38BDF8]">
              <Truck className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-[#020617]">No vehicles found</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-[#94A3B8]">
              {search || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your search or filters to widen the fleet view."
                : "Add your first vehicle to start tracking fleet capacity and assignments."}
            </p>
            {!search && statusFilter === "all" && typeFilter === "all" && (
              <Button onClick={() => setIsAddModalOpen(true)} className="mt-5 rounded-full bg-[#22C7A1] px-5 font-black text-white hover:bg-[#1DB492]">
                <Plus className="mr-2 h-4 w-4" />
                Add Vehicle
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <AddVehicleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={fetchVehicles}
      />

      <EditVehicleModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedVehicle(null);
        }}
        onSuccess={fetchVehicles}
        vehicle={selectedVehicle}
        availableDrivers={drivers}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
  color,
  helper,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  helper: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_35px_rgba(2,6,23,0.045)]">
      <div className="flex items-center justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: color }}>
          {icon}
        </div>
        <p className="text-3xl font-black tracking-[-0.06em] text-[#020617]">{value}</p>
      </div>
      <p className="mt-4 text-sm font-black text-[#020617]">{title}</p>
      <p className="mt-1 text-xs font-semibold text-[#94A3B8]">{helper}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="min-w-0 rounded-[16px] bg-[#F6F8FB] p-3">
      <div className="mb-2 h-1.5 w-8 rounded-full" style={{ background: color }} />
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-[#020617]">{value}</p>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  right,
  valueClassName,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  right?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-[#94A3B8]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{label}</p>
          <p className={cn("truncate text-sm font-black text-[#020617]", valueClassName)}>{value}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function formatVehicleType(type: string) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
