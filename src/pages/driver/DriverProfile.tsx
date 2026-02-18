import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Star,
  Bike,
  Car,
  Truck,
  Settings,
  ChevronRight,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DriverLayout } from "@/components/DriverLayout";

type VehicleType = "bike" | "scooter" | "motorcycle" | "car";

const vehicleLabels: Record<VehicleType, string> = {
  bike: "Bicycle",
  scooter: "Scooter",
  motorcycle: "Motorcycle",
  car: "Car",
};

const vehicleIcons: Record<VehicleType, React.ReactNode> = {
  bike: <Bike className="h-5 w-5" />,
  scooter: <Bike className="h-5 w-5" />,
  motorcycle: <Truck className="h-5 w-5" />,
  car: <Car className="h-5 w-5" />,
};

export default function DriverProfile() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
  });
  const [driverInfo, setDriverInfo] = useState({
    vehicle_type: "bike" as VehicleType,
    vehicle_make: "",
    vehicle_model: "",
    vehicle_plate: "",
    total_deliveries: 0,
    rating: 0,
    approval_status: "",
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setProfile({
        full_name: user.user_metadata?.full_name || "Demo Driver",
        email: user.email || "",
      });

      const { data: driverData, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (driverError) throw driverError;

      if (driverData) {
        setDriverId(driverData.id);
        setDriverInfo({
          vehicle_type: driverData.vehicle_type as VehicleType || "bike",
          vehicle_make: driverData.vehicle_make || "",
          vehicle_model: driverData.vehicle_model || "",
          vehicle_plate: driverData.vehicle_plate || "",
          total_deliveries: driverData.total_deliveries || 0,
          rating: driverData.rating || 0,
          approval_status: driverData.approval_status || "pending",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!driverId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("drivers")
        .update({
          vehicle_type: driverInfo.vehicle_type,
          vehicle_make: driverInfo.vehicle_make || null,
          vehicle_model: driverInfo.vehicle_model || null,
          vehicle_plate: driverInfo.vehicle_plate || null,
        })
        .eq("id", driverId);

      if (error) throw error;

      toast({
        title: "Vehicle updated!",
        description: "Your vehicle information has been saved.",
      });
    } catch (error: any) {
      console.error("Error saving vehicle:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save vehicle info",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/driver/auth");
  };

  if (loading) {
    return (
      <DriverLayout title="Profile">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DriverLayout>
    );
  }

  return (
    <DriverLayout title="Profile">
      <div className="space-y-4">
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-green-500/10 text-green-600 text-xl">
                  {profile.full_name?.charAt(0) || "D"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-lg">{profile.full_name || "Driver"}</h2>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm font-medium">{driverInfo.rating.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">
                    ({driverInfo.total_deliveries} deliveries)
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profile.full_name}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.email} disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vehicle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select
                value={driverInfo.vehicle_type}
                onValueChange={(value) => setDriverInfo({ ...driverInfo, vehicle_type: value as VehicleType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(vehicleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        {vehicleIcons[value as VehicleType]}
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicleMake">Make</Label>
                <Input
                  id="vehicleMake"
                  value={driverInfo.vehicle_make}
                  onChange={(e) => setDriverInfo({ ...driverInfo, vehicle_make: e.target.value })}
                  placeholder="e.g., Toyota"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleModel">Model</Label>
                <Input
                  id="vehicleModel"
                  value={driverInfo.vehicle_model}
                  onChange={(e) => setDriverInfo({ ...driverInfo, vehicle_model: e.target.value })}
                  placeholder="e.g., Camry"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">License Plate</Label>
              <Input
                id="vehiclePlate"
                value={driverInfo.vehicle_plate}
                onChange={(e) => setDriverInfo({ ...driverInfo, vehicle_plate: e.target.value })}
                placeholder="e.g., ABC 123"
              />
            </div>

            <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleSaveVehicle} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Vehicle
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={() => navigate("/driver/settings")}
          >
            <span className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            className="w-full justify-between text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </span>
          </Button>
        </div>
      </div>
    </DriverLayout>
  );
}
