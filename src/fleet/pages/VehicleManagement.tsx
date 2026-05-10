import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Plus, 
  Truck, 
  AlertTriangle,
  CheckCircle,
  User,
  Wrench,
  Calendar,
  Edit,
  Car,
  Bike,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AddVehicleModal } from "@/fleet/components/vehicles/AddVehicleModal";
import { EditVehicleModal } from "@/fleet/components/vehicles/EditVehicleModal";
import type { Vehicle, VehicleStatus, Driver } from "@/fleet/types";

export default function VehicleManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [expiringCount, setExpiringCount] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  // vehicleId → selected driverId for inline quick-assign
  const [quickAssignMap, setQuickAssignMap] = useState<Record<string, string>>({});
  const [assigningVehicleId, setAssigningVehicleId] = useState<string | null>(null);

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const query = supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const transformedVehicles: Vehicle[] = (data || []).map((v: { id: string; city_id?: string; type: string; make?: string; model?: string; year?: number; color?: string; plate_number: string; registration_number?: string; insurance_provider?: string; insurance_expiry?: string; insurance_document_url?: string; status: string; assigned_driver_id?: string; assigned_driver_name?: string; vehicle_photo_url?: string; registration_document_url?: string; created_at: string; updated_at?: string }) => ({
        id: v.id,
        cityId: v.city_id || '',
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
        createdAt: v.created_at,
        updatedAt: v.updated_at,
      }));

      setVehicles(transformedVehicles);

      // Calculate expiring insurance count
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      const expiring = transformedVehicles.filter(v => {
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
        .from('drivers')
        .select('*')
        .eq('approval_status', 'approved')
        .eq('is_active', true);

      if (error) throw error;

      const transformedDrivers: Driver[] = (data || []).map((d: { id: string; user_id?: string; email?: string; phone_number?: string; full_name?: string; city_id?: string; assigned_zone_ids?: string[]; approval_status?: string; is_active?: boolean; is_online?: boolean; total_deliveries?: number; rating?: number; cancellation_rate?: number; wallet_balance?: number; total_earnings?: number; assigned_vehicle_id?: string; created_at: string; updated_at?: string }) => ({
        id: d.id,
        authUserId: d.user_id,
        email: d.email || '',
        phone: d.phone_number || '',
        fullName: d.full_name || `Driver ${d.phone_number?.slice(-4) || d.id.slice(0, 8)}`,
        cityId: d.city_id || '',
        assignedZoneIds: d.assigned_zone_ids || [],
        status: d.approval_status === 'approved' && d.is_active ? 'active' : 'inactive',
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

  const filteredVehicles = vehicles.filter(v => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (search && !v.plateNumber.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "assigned":
        return <Badge className="bg-blue-500">Assigned</Badge>;
      case "available":
        return <Badge className="bg-green-500">Available</Badge>;
      case "maintenance":
        return <Badge variant="outline" className="text-amber-500 border-amber-500">Maintenance</Badge>;
      default:
        return <Badge variant="secondary">Retired</Badge>;
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "motorcycle":
        return <Bike className="h-6 w-6" />;
      case "car":
        return <Car className="h-6 w-6" />;
      case "van":
        return <Truck className="h-6 w-6" />;
      case "bicycle":
        return <div className="text-2xl">🚲</div>;
      default:
        return <Truck className="h-6 w-6" />;
    }
  };

  const isInsuranceExpiringSoon = (expiryDate: string) => {
    const daysUntil = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 30;
  };

  const isInsuranceExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const handleEditClick = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsEditModalOpen(true);
  };

  const handleStatusChange = async (vehicle: Vehicle, newStatus: VehicleStatus) => {
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ status: newStatus })
        .eq('id', vehicle.id);

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
      // Unassign previous driver if any
      if (vehicle.assignedDriverId) {
        await supabase
          .from("drivers")
          .update({ assigned_vehicle_id: null })
          .eq("id", vehicle.assignedDriverId);
      }
      // Assign vehicle → new driver
      await supabase
        .from("vehicles")
        .update({ assigned_driver_id: driverId, status: "assigned" })
        .eq("id", vehicle.id);
      // Assign driver → vehicle
      await supabase
        .from("drivers")
        .update({ assigned_vehicle_id: vehicle.id })
        .eq("id", driverId);

      toast({ title: "Driver assigned", description: "Vehicle has been assigned successfully." });
      setQuickAssignMap((prev) => { const n = { ...prev }; delete n[vehicle.id]; return n; });
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
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vehicles</h1>
          <p className="text-muted-foreground">Manage your fleet vehicles</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Alerts */}
      {expiringCount > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-900">Insurance Expiring Soon</p>
              <p className="text-sm text-amber-700">{expiringCount} vehicle(s) have insurance expiring within 30 days</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by plate number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-background"
            >
              <option value="all">All Status</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((vehicle) => (
          <Card key={vehicle.id} className="h-full hover:border-primary/50 transition-colors">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    {getVehicleIcon(vehicle.type)}
                  </div>
                  <div>
                    <h3 className="font-semibold">{vehicle.plateNumber}</h3>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.make} {vehicle.model}
                      {vehicle.year && ` (${vehicle.year})`}
                    </p>
                  </div>
                </div>
                {getStatusBadge(vehicle.status)}
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="capitalize">{vehicle.type}</span>
                </div>
                {vehicle.color && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Color</span>
                    <span>{vehicle.color}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Driver
                  </span>
                  <span className="font-medium">
                    {vehicle.assignedDriverId
                      ? drivers.find(d => d.id === vehicle.assignedDriverId)?.fullName || "Assigned"
                      : <span className="text-muted-foreground font-normal">Unassigned</span>
                    }
                  </span>
                </div>
                {vehicle.insuranceExpiry && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Insurance
                    </span>
                    <span className={
                      isInsuranceExpired(vehicle.insuranceExpiry) 
                        ? "text-red-500 font-medium" 
                        : isInsuranceExpiringSoon(vehicle.insuranceExpiry) 
                          ? "text-amber-500 font-medium" 
                          : ""
                    }>
                      {new Date(vehicle.insuranceExpiry).toLocaleDateString()}
                      {isInsuranceExpired(vehicle.insuranceExpiry) && (
                        <span className="ml-1 text-xs text-red-500">(Expired)</span>
                      )}
                      {isInsuranceExpiringSoon(vehicle.insuranceExpiry) && !isInsuranceExpired(vehicle.insuranceExpiry) && (
                        <AlertTriangle className="h-3 w-3 inline ml-1" />
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick-assign section for available vehicles */}
              {vehicle.status === "available" && (
                <div className="mt-3 flex gap-2">
                  <Select
                    value={quickAssignMap[vehicle.id] || ""}
                    onValueChange={(val) =>
                      setQuickAssignMap((prev) => ({ ...prev, [vehicle.id]: val }))
                    }
                  >
                    <SelectTrigger className="flex-1 h-8 text-xs">
                      <SelectValue placeholder="Pick a driver…" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.filter(d => !d.assignedVehicleId).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.fullName} — {d.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={!quickAssignMap[vehicle.id] || assigningVehicleId === vehicle.id}
                    onClick={() => handleQuickAssign(vehicle)}
                  >
                    {assigningVehicleId === vehicle.id ? "…" : "Assign"}
                  </Button>
                </div>
              )}

              {/* Unassign for assigned vehicles */}
              {vehicle.status === "assigned" && vehicle.assignedDriverId && (
                <div className="mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs text-destructive hover:text-destructive"
                    disabled={assigningVehicleId === vehicle.id}
                    onClick={() => handleUnassignDriver(vehicle)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    {assigningVehicleId === vehicle.id ? "Unassigning…" : "Unassign Driver"}
                  </Button>
                </div>
              )}

              <div className="mt-3 pt-3 border-t flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => handleEditClick(vehicle)}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                {vehicle.status === "maintenance" ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleStatusChange(vehicle, "available")}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Complete
                  </Button>
                ) : vehicle.status !== "retired" ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleStatusChange(vehicle, "maintenance")}
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    Service
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredVehicles.length === 0 && !isLoading && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">No vehicles found</h3>
            <p className="text-muted-foreground mt-1">
              {search ? "Try adjusting your search" : "Add your first vehicle to get started"}
            </p>
            {!search && (
              <Button onClick={() => setIsAddModalOpen(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
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
