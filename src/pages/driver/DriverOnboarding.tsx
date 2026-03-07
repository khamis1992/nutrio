import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Truck, ArrowLeft, Bike, Car, CheckCircle, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VehicleType = "bike" | "scooter" | "motorcycle" | "car";

interface VehicleOption {
  value: VehicleType;
  label: string;
  icon: React.ReactNode;
  requiresLicense: boolean;
}

const vehicleOptions: VehicleOption[] = [
  { value: "bike", label: "Bicycle", icon: <Bike className="h-5 w-5" />, requiresLicense: false },
  { value: "scooter", label: "Scooter", icon: <Bike className="h-5 w-5" />, requiresLicense: true },
  { value: "motorcycle", label: "Motorcycle", icon: <Truck className="h-5 w-5" />, requiresLicense: true },
  { value: "car", label: "Car", icon: <Car className="h-5 w-5" />, requiresLicense: true },
];

export default function DriverOnboarding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vehicle_type: "bike" as VehicleType,
    vehicle_make: "",
    vehicle_model: "",
    vehicle_plate: "",
    license_number: "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkDriverStatus();
  }, []);

  const checkDriverStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/driver/auth");
        return;
      }

      const { data: driver, error } = await supabase
        .from("drivers")
        .select("id, vehicle_type, vehicle_make, vehicle_model, vehicle_plate, license_number, approval_status")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (!driver) {
        navigate("/driver/auth");
        return;
      }

      setDriverId(driver.id);
      setApprovalStatus(driver.approval_status);

      if (driver.vehicle_type) {
        setFormData({
          vehicle_type: driver.vehicle_type as VehicleType,
          vehicle_make: driver.vehicle_make || "",
          vehicle_model: driver.vehicle_model || "",
          vehicle_plate: driver.vehicle_plate || "",
          license_number: driver.license_number || "",
        });
      }

      if (driver.approval_status === "approved") {
        navigate("/driver");
      }
    } catch (error) {
      console.error("Error checking driver status:", error);
      toast({
        title: "Error",
        description: "Failed to load driver information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverId) return;

    setSaving(true);

    try {
      const selectedVehicle = vehicleOptions.find(v => v.value === formData.vehicle_type);
      
      const updateData: Record<string, any> = {
        vehicle_type: formData.vehicle_type,
        vehicle_make: formData.vehicle_make || null,
        vehicle_model: formData.vehicle_model || null,
      };

      if (selectedVehicle?.requiresLicense) {
        updateData.vehicle_plate = formData.vehicle_plate || null;
        updateData.license_number = formData.license_number || null;
      }

      const { error } = await supabase
        .from("drivers")
        .update(updateData)
        .eq("id", driverId);

      if (error) throw error;

      toast({
        title: "Information saved!",
        description: "Your vehicle information has been submitted for review.",
      });

      setApprovalStatus("pending");
    } catch (error: any) {
      console.error("Error saving vehicle info:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save information",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500/5 via-background to-emerald-500/10 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  const selectedVehicle = vehicleOptions.find(v => v.value === formData.vehicle_type);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500/5 via-background to-emerald-500/10">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="h-4 w-4 rtl-flip-back" />
          Back to home
        </Link>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mb-4">
              <Truck className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Driver Onboarding</CardTitle>
            <CardDescription>
              Complete your vehicle information to start delivering
            </CardDescription>
          </CardHeader>

          <CardContent>
            {approvalStatus === "pending" && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-600">Application Under Review</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your application is being reviewed. You'll receive a notification once approved.
                  </p>
                </div>
              </div>
            )}

            {approvalStatus === "rejected" && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Application Rejected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your application was not approved. Please contact support for more information.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {vehicleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, vehicle_type: option.value })}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.vehicle_type === option.value
                          ? "border-green-500 bg-green-500/10"
                          : "border-border hover:border-green-500/50"
                      }`}
                    >
                      <div className={`${
                        formData.vehicle_type === option.value ? "text-green-600" : "text-muted-foreground"
                      }`}>
                        {option.icon}
                      </div>
                      <span className={`text-sm ${
                        formData.vehicle_type === option.value ? "text-green-600 font-medium" : "text-muted-foreground"
                      }`}>
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedVehicle?.requiresLicense && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_make">Vehicle Make</Label>
                      <Input
                        id="vehicle_make"
                        placeholder="e.g., Toyota"
                        value={formData.vehicle_make}
                        onChange={(e) => setFormData({ ...formData, vehicle_make: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_model">Vehicle Model</Label>
                      <Input
                        id="vehicle_model"
                        placeholder="e.g., Camry"
                        value={formData.vehicle_model}
                        onChange={(e) => setFormData({ ...formData, vehicle_model: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="vehicle_plate">License Plate</Label>
                      <Input
                        id="vehicle_plate"
                        placeholder="e.g., ABC 123"
                        value={formData.vehicle_plate}
                        onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="license_number">Driver's License Number</Label>
                      <Input
                        id="license_number"
                        placeholder="Enter license number"
                        value={formData.license_number}
                        onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.vehicle_type === "bike" && (
                <div className="p-4 bg-muted/50 rounded-xl">
                  <p className="text-sm text-muted-foreground">
                    No license or vehicle registration required for bicycle deliveries.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {approvalStatus === "pending" ? "Update Information" : "Submit for Approval"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
