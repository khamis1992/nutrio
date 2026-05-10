import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDriverDetail } from "@/fleet/hooks/useDrivers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  MapPin,
  Star,
  Truck,
  FileText,
  Activity,
  MessageSquare,
  Car,
  Bike,
  X,
  AlertTriangle,
  Calendar,
} from "lucide-react";

interface ActivityEntry {
  id: string;
  action: string;
  performedAt: string | null;
  reason: string | null;
}

interface AvailableVehicle {
  id: string;
  plateNumber: string;
  type: string;
  make: string | null;
  model: string | null;
}

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { driver, vehicle, isLoading, refetch } = useDriverDetail(id || "");

  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<AvailableVehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  // Fetch real activity for this driver
  useEffect(() => {
    if (!id) return;
    supabase
      .from("driver_assignment_history")
      .select("id, action, performed_at, reason")
      .eq("driver_id", id)
      .order("performed_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setActivity(
          (data || []).map((r) => ({
            id: r.id,
            action: r.action,
            performedAt: r.performed_at,
            reason: r.reason,
          }))
        );
      });
  }, [id]);

  // Fetch available (unassigned) vehicles for the assign dropdown
  useEffect(() => {
    supabase
      .from("vehicles")
      .select("id, plate_number, type, make, model")
      .eq("status", "available")
      .then(({ data }) => {
        setAvailableVehicles(
          (data || []).map((v: { id: string; plate_number: string; type: string; make?: string; model?: string }) => ({
            id: v.id,
            plateNumber: v.plate_number,
            type: v.type,
            make: v.make ?? null,
            model: v.model ?? null,
          }))
        );
      });
  }, []);

  const handleAssignVehicle = async () => {
    if (!driver || !selectedVehicleId) return;
    setAssigning(true);
    try {
      // Update vehicle: set driver + status = assigned
      const { error: vErr } = await supabase
        .from("vehicles")
        .update({ assigned_driver_id: driver.id, status: "assigned" })
        .eq("id", selectedVehicleId);
      if (vErr) throw vErr;

      // Update driver: set assigned_vehicle_id
      const { error: dErr } = await supabase
        .from("drivers")
        .update({ assigned_vehicle_id: selectedVehicleId })
        .eq("id", driver.id);
      if (dErr) throw dErr;

      toast({ title: "Vehicle assigned", description: "The vehicle has been linked to this driver." });
      setSelectedVehicleId("");
      refetch();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to assign vehicle.", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignVehicle = async () => {
    if (!driver || !vehicle) return;
    setUnassigning(true);
    try {
      // Reset vehicle to available
      const { error: vErr } = await supabase
        .from("vehicles")
        .update({ assigned_driver_id: null, status: "available" })
        .eq("id", vehicle.id);
      if (vErr) throw vErr;

      // Clear driver's vehicle
      const { error: dErr } = await supabase
        .from("drivers")
        .update({ assigned_vehicle_id: null })
        .eq("id", driver.id);
      if (dErr) throw dErr;

      toast({ title: "Vehicle unassigned", description: "The vehicle has been returned to the pool." });
      refetch();
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to unassign vehicle.", variant: "destructive" });
    } finally {
      setUnassigning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-500">Active</Badge>;
      case "pending_verification": return <Badge variant="outline" className="text-amber-500 border-amber-500">Pending</Badge>;
      case "suspended": return <Badge variant="destructive">Suspended</Badge>;
      default: return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const getVehicleIcon = (type: string) => {
    if (type === "motorcycle") return <Bike className="h-5 w-5" />;
    if (type === "car") return <Car className="h-5 w-5" />;
    return <Truck className="h-5 w-5" />;
  };

  const isInsuranceExpiringSoon = (expiry: string) => {
    const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 30;
  };

  const isInsuranceExpired = (expiry: string) => new Date(expiry) < new Date();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Driver not found</h2>
        <div className="mt-4">
          <Button onClick={() => navigate("/fleet/drivers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Drivers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate("/fleet/drivers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{driver.fullName}</h1>
          <p className="text-muted-foreground">Driver ID: {driver.id.slice(0, 8)}</p>
        </div>
        <Button variant="outline">
          <MessageSquare className="h-4 w-4 mr-2" />
          Message
        </Button>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">{driver.fullName.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-semibold">{driver.fullName}</h2>
                {getStatusBadge(driver.status)}
                <div className={`w-3 h-3 rounded-full ${driver.isOnline ? "bg-green-500" : "bg-gray-400"}`} />
                <span className="text-sm text-muted-foreground">{driver.isOnline ? "Online" : "Offline"}</span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{driver.phone}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{driver.cityId}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>{driver.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold">{driver.totalDeliveries}</p>
          <p className="text-sm text-muted-foreground">Total Deliveries</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold">{driver.rating.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground">Rating</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold">{driver.currentBalance.toFixed(0)}</p>
          <p className="text-sm text-muted-foreground">Wallet (QAR)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <p className="text-3xl font-bold">{driver.totalEarnings.toFixed(0)}</p>
          <p className="text-sm text-muted-foreground">Total Earnings</p>
        </CardContent></Card>
      </div>

      {/* Location & Vehicle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Current Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            {driver.currentLatitude && driver.currentLongitude ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latitude</span>
                  <span className="font-mono">{driver.currentLatitude.toFixed(6)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Longitude</span>
                  <span className="font-mono">{driver.currentLongitude.toFixed(6)}</span>
                </div>
                {driver.locationUpdatedAt && (
                  <p className="text-muted-foreground text-xs mt-2">
                    Updated {formatDistanceToNow(new Date(driver.locationUpdatedAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No location data available</p>
            )}
          </CardContent>
        </Card>

        {/* Assigned Vehicle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Assigned Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vehicle ? (
              <div className="space-y-3">
                {/* Vehicle summary */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {getVehicleIcon(vehicle.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold font-mono">{vehicle.plateNumber}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ")} · {vehicle.type}
                    </p>
                  </div>
                  <Badge className="bg-blue-500 shrink-0">Assigned</Badge>
                </div>

                {/* Insurance status */}
                {vehicle.insuranceExpiry && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      Insurance expiry
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
                        <span className="ml-1 text-xs">(Expired)</span>
                      )}
                      {isInsuranceExpiringSoon(vehicle.insuranceExpiry) && !isInsuranceExpired(vehicle.insuranceExpiry) && (
                        <AlertTriangle className="h-3 w-3 inline ml-1" />
                      )}
                    </span>
                  </div>
                )}

                {/* Unassign */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={handleUnassignVehicle}
                  disabled={unassigning}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  {unassigning ? "Unassigning…" : "Unassign Vehicle"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">No vehicle assigned to this driver.</p>
                <div className="flex gap-2">
                  <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={availableVehicles.length ? "Select vehicle…" : "No vehicles available"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          <span className="font-mono font-medium">{v.plateNumber}</span>
                          {" — "}
                          <span className="text-muted-foreground capitalize">
                            {[v.make, v.model].filter(Boolean).join(" ") || v.type}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleAssignVehicle}
                    disabled={!selectedVehicleId || assigning}
                  >
                    {assigning ? "Assigning…" : "Assign"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span>Driver's License</span>
              <Badge variant="outline">Pending</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span>Vehicle Registration</span>
              <Badge variant="outline">{vehicle ? "Linked" : "Pending"}</Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span>Insurance Document</span>
              <Badge variant="outline">
                {vehicle?.insuranceExpiry
                  ? isInsuranceExpired(vehicle.insuranceExpiry)
                    ? "Expired"
                    : "Valid"
                  : "Pending"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity History — real data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Dispatch Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No dispatch activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => {
                const dotColor =
                  entry.action === "assigned"
                    ? "bg-green-500"
                    : entry.action === "reassigned"
                      ? "bg-blue-500"
                      : "bg-amber-500";
                return (
                  <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</p>
                      {entry.reason && (
                        <p className="text-sm text-muted-foreground">{entry.reason}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {entry.performedAt
                        ? formatDistanceToNow(new Date(entry.performedAt), { addSuffix: true })
                        : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
