import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Star,
  Bike,
  Car,
  Settings,
  ChevronRight,
  LogOut,
  Loader2,
  DollarSign,
  Package,
  Phone,
  Mail,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { DriverLayoutContext } from "@/components/driver/DriverLayout";

type VehicleType = "bike" | "car";

const vehicleLabels: Record<VehicleType, string> = {
  bike: "Bicycle",
  car: "Car",
};

const vehicleIcons: Record<VehicleType, React.ReactNode> = {
  bike: <Bike className="h-5 w-5" />,
  car: <Car className="h-5 w-5" />,
};

export default function DriverProfile() {
  const navigate = useNavigate();
  const { driver } = useOutletContext<DriverLayoutContext>();
  const { signOut } = useAuth();
  const { toast } = useToast();

  const [saving, setSaving] = useState(false);
  const [vehicleInfo, setVehicleInfo] = useState({
    vehicle_type: (driver.vehicle_type as VehicleType) || "car",
    license_plate: driver.license_plate || "",
    phone_number: driver.phone_number || "",
  });

  const user = driver.user;

  const handleSave = async () => {
    setSaving(true);

    try {
      const { error } = await supabase
        .from("drivers")
        .update({
          vehicle_type: vehicleInfo.vehicle_type,
          license_plate: vehicleInfo.license_plate || null,
          phone_number: vehicleInfo.phone_number,
        })
        .eq("id", driver.id);

      if (error) throw error;

      toast({
        title: "Profile updated!",
        description: "Your information has been saved.",
      });
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save",
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

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Profile Header */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardContent className="p-6 text-center">
          <Avatar className="h-20 w-20 mx-auto mb-4 bg-white/20">
            <AvatarFallback className="bg-white/20 text-white text-2xl">
              {user?.raw_user_meta_data?.name?.charAt(0) || "D"}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">
            {user?.raw_user_meta_data?.name || "Driver"}
          </h2>
          <p className="text-primary-foreground/80 text-sm mt-1">
            {user?.email}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
              <Star className="w-4 h-4 fill-current" />
              <span>{driver.rating || 5.0}</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
              {vehicleIcons[vehicleInfo.vehicle_type]}
              <span className="capitalize">{vehicleInfo.vehicle_type}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{driver.total_deliveries || 0}</p>
            <p className="text-xs text-muted-foreground">Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-6 h-6 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{driver.total_earnings || 0}</p>
            <p className="text-xs text-muted-foreground">QAR Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">Contact Information</h3>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
              <Phone className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={vehicleInfo.phone_number}
                onChange={(e) => setVehicleInfo({ ...vehicleInfo, phone_number: e.target.value })}
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vehicle Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <Select
              value={vehicleInfo.vehicle_type}
              onValueChange={(value) => setVehicleInfo({ ...vehicleInfo, vehicle_type: value as VehicleType })}
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

          <div className="space-y-2">
            <Label htmlFor="licensePlate">License Plate</Label>
            <Input
              id="licensePlate"
              value={vehicleInfo.license_plate}
              onChange={(e) => setVehicleInfo({ ...vehicleInfo, license_plate: e.target.value })}
              placeholder="e.g., ABC 123"
            />
          </div>

          <Button 
            className="w-full" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
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
  );
}
