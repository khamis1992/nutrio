import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MapPin, Phone, Store, Package, CheckCircle, Navigation, ArrowLeft, ScanLine, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DriverLayout } from "@/components/DriverLayout";
import { DriverQRScanner } from "@/components/driver/DriverQRScanner";

interface DeliveryDetails {
  id: string;
  schedule_id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  estimated_distance_km: number | null;
  delivery_fee: number;
  tip_amount: number;
  delivery_notes: string | null;
  delivery_photo_url: string | null;
  restaurant: {
    name: string;
    address: string | null;
    phone: string | null;
  } | null;
  meal_schedule?: {
    meal_name: string;
    calories: number;
    customer_name: string;
    customer_phone: string | null;
    special_instructions: string | null;
    addons: string[];
  } | null;
}

// Map frontend display statuses to database statuses
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  assigned: { label: "Claimed", color: "bg-blue-500" },
  accepted: { label: "Accepted", color: "bg-blue-500" },
  picked_up: { label: "Picked Up", color: "bg-purple-500" },
  in_transit: { label: "On the Way", color: "bg-orange-500" },
  delivered: { label: "Delivered", color: "bg-green-500" },
  completed: { label: "Completed", color: "bg-green-600" },
  failed: { label: "Failed", color: "bg-red-500" },
  cancelled: { label: "Cancelled", color: "bg-gray-500" },
};



export default function DriverOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fetch driver ID on mount
  useEffect(() => {
    const fetchDriverId = async () => {
      if (!user) return;
      
      try {
        const { data: driver, error } = await supabase
          .from("drivers")
          .select("id")
          .eq("user_id", user.id)
          .single();
        
        if (error) throw error;
        setDriverId(driver.id);
      } catch (error) {
        console.error("Error fetching driver ID:", error);
        toast({
          title: "Error",
          description: "Failed to load driver information",
          variant: "destructive",
        });
      }
    };
    
    fetchDriverId();
  }, [user, toast]);

  useEffect(() => {
    if (id && driverId) {
      fetchDelivery();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, driverId]);

  const fetchDelivery = async () => {
    if (!id || !user) return;

    try {
      // Fetch delivery job without embedded queries
      const { data: deliveryData, error } = await supabase
        .from("delivery_jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      if (!deliveryData) {
        setDelivery(null);
        return;
      }

      // Fetch restaurant separately
      let restaurantData = null;
      if (deliveryData.restaurant_id) {
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("name, address, phone")
          .eq("id", deliveryData.restaurant_id)
          .single();
        restaurantData = restaurant;
      }

      // Fetch meal schedule and related data via RPC function
      let mealScheduleData = null;
      if (deliveryData.schedule_id) {
        const { data: details } = await supabase.rpc(
          "get_delivery_details_for_driver",
          { p_delivery_job_id: deliveryData.id }
        );

        if (details && !details.error) {
          mealScheduleData = {
            meal_name: details.meal_name || "Meal",
            calories: details.meal_calories || 0,
            customer_name: details.customer_name || "Customer",
            customer_phone: details.customer_phone || null,
            special_instructions: details.delivery_instructions || null,
            addons: [],
          };
        }
      }

      setDelivery({
        id: deliveryData.id,
        schedule_id: deliveryData.schedule_id,
        status: deliveryData.status || "pending",
        pickup_address: deliveryData.pickup_address || "",
        delivery_address: deliveryData.delivery_address || "",
        delivery_lat: deliveryData.delivery_lat,
        delivery_lng: deliveryData.delivery_lng,
        estimated_distance_km: deliveryData.estimated_distance_km,
        delivery_fee: deliveryData.delivery_fee || 0,
        tip_amount: deliveryData.tip_amount || 0,
        delivery_notes: deliveryData.delivery_notes,
        delivery_photo_url: deliveryData.delivery_photo_url,
        restaurant: restaurantData,
        meal_schedule: mealScheduleData,
      });
      setNotes(deliveryData.delivery_notes || "");
    } catch (error) {
      console.error("Error fetching delivery:", error);
      toast({
        title: "Error",
        description: "Failed to load delivery details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    if (!delivery) return;

    setUpdating(true);

    try {
      const updateData: Record<string, string | null> = { status: newStatus };

      if (newStatus === "picked_up") {
        updateData.picked_up_at = new Date().toISOString();
      } else if (newStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
        updateData.delivery_notes = notes;
      }

      const { error } = await supabase
        .from("delivery_jobs")
        .update(updateData)
        .eq("id", delivery.id);

      if (error) throw error;

      toast({
        title: "Status updated!",
        description: `Order marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
      });

      if (newStatus === "delivered") {
        navigate("/driver");
      } else {
        fetchDelivery();
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank");
  };

  const handleQRScan = async (qrData: string) => {
    if (!delivery || !id || !driverId) return;
    
    setUpdating(true);
    setScanResult(null);
    
    try {
      // Check if input is a 6-digit verification code or a QR code
      const isVerificationCode = /^\d{6}$/.test(qrData);
      
      let result;
      if (isVerificationCode) {
        // Use verification code RPC for 6-digit codes
        const { data, error } = await supabase.rpc("verify_pickup_by_code", {
          p_verification_code: qrData,
          p_driver_id: driverId,
        });
        result = { data, error };
      } else {
        // Use QR code RPC for other data (QR codes)
        const { data, error } = await supabase.rpc("verify_pickup_by_qr", {
          p_delivery_id: id,
          p_qr_code: qrData,
        });
        result = { data, error };
      }
      
      if (result.error) throw result.error;
      
      if (result.data?.success) {
        setScanResult({ success: true, message: "Pickup verified successfully!" });
        
        // Status is already updated by the verification function
        // Just refresh the delivery data to show the new status
        await fetchDelivery();
        
        setShowQRScanner(false);
      } else {
        setScanResult({ 
          success: false, 
          message: result.data?.error || "Invalid code. Please try again." 
        });
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      setScanResult({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to verify code" 
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <DriverLayout title="Order Details">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </DriverLayout>
    );
  }

  if (!delivery) {
    return (
      <DriverLayout title="Order Not Found">
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">Delivery not found</p>
            <Button className="mt-4" onClick={() => navigate("/driver")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </DriverLayout>
    );
  }

  const totalEarnings = delivery.delivery_fee + delivery.tip_amount;
  const statusConfig = STATUS_CONFIG[delivery.status] || { label: delivery.status, color: "bg-gray-500" };

  return (
    <DriverLayout title="Order Details">
      <div className="space-y-4">
        <div className="flex justify-start rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/driver")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              <p className="font-bold text-green-600 text-lg">QAR {totalEarnings.toFixed(2)}</p>
            </div>

            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Order #</p>
              <p className="font-mono text-sm font-medium">{delivery.schedule_id?.slice(0, 8) || delivery.id?.slice(0, 8)}</p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                🍽️
              </div>
              <div>
                <p className="font-semibold">{delivery.restaurant?.name || "Restaurant"}</p>
                <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
              </div>
            </div>

            {delivery.tip_amount > 0 && (
              <div className="p-3 bg-green-500/10 rounded-lg mb-4">
                <p className="text-sm text-green-600 font-medium">
                  +QAR {delivery.tip_amount.toFixed(2)} tip included!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Store className="h-4 w-4" />
              Pickup
            </h3>
            <p className="font-medium">{delivery.restaurant?.name || "Restaurant"}</p>
            <p className="text-sm text-muted-foreground mb-3">{delivery.pickup_address}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMaps(delivery.pickup_address)}
              >
                <Navigation className="h-4 w-4 mr-1" />
                Navigate
              </Button>
              {delivery.restaurant?.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`tel:${delivery.restaurant!.phone}`)}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Call
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {delivery.meal_schedule && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Order Details
              </h3>
              <div className="space-y-2">
                <p className="font-medium">{delivery.meal_schedule.meal_name}</p>
                <p className="text-sm text-muted-foreground">
                  {delivery.meal_schedule.calories} calories
                </p>
                {delivery.meal_schedule.addons.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Add-ons: </span>
                    <span>{delivery.meal_schedule.addons.join(", ")}</span>
                  </div>
                )}
                {delivery.meal_schedule.special_instructions && (
                  <div className="p-2 bg-amber-500/10 rounded text-sm">
                    <span className="text-amber-600 font-medium">Note: </span>
                    <span className="text-amber-700">{delivery.meal_schedule.special_instructions}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Delivery
            </h3>
            <p className="font-medium">{delivery.meal_schedule?.customer_name || "Customer"}</p>
            <p className="text-sm text-muted-foreground mb-1">{delivery.delivery_address}</p>
            {delivery.meal_schedule?.customer_phone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {delivery.meal_schedule.customer_phone}
              </p>
            )}

            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMaps(delivery.delivery_address)}
              >
                <Navigation className="h-4 w-4 mr-1" />
                Navigate
              </Button>
              {delivery.meal_schedule?.customer_phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`tel:${delivery.meal_schedule?.customer_phone}`)}
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Call Customer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {delivery.status !== "delivered" && (
          <Card>
            <CardContent className="p-4">
              <h3 className="font-semibold mb-3">Delivery Notes (optional)</h3>
              <Textarea
                placeholder="Add any notes about the delivery..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {(delivery.status === "assigned" || delivery.status === "accepted") && (
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={() => setShowConfirmDialog(true)}
              disabled={updating}
            >
              <ScanLine className="h-4 w-4 mr-2" />
              Scan QR to Pickup
            </Button>
          )}

          {delivery.status === "picked_up" && (
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={() => updateStatus("in_transit")}
              disabled={updating}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Start Delivery
            </Button>
          )}

          {delivery.status === "in_transit" && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={async () => {
                if (!delivery) return;
                setUpdating(true);
                try {
                  // Update delivery_jobs to completed directly
                  const { error: jobError } = await supabase
                    .from("delivery_jobs")
                    .update({
                      status: "completed",
                      delivered_at: new Date().toISOString(),
                      delivery_notes: notes,
                      updated_at: new Date().toISOString()
                    })
                    .eq("id", delivery.id);
                  if (jobError) throw jobError;

                  // Sync trigger will update meal_schedules to completed

                  toast({
                    title: "Delivery Completed!",
                    description: "Order marked as completed successfully",
                  });

                  // Navigate back to driver dashboard
                  navigate("/driver");
                } catch (error) {
                  console.error("Error completing delivery:", error);
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to complete delivery",
                    variant: "destructive",
                  });
                } finally {
                  setUpdating(false);
                }
              }}
              disabled={updating}
            >
              {updating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Complete Delivery
            </Button>
          )}

          {(delivery.status === "delivered" || delivery.status === "completed") && (
            <div className="p-4 bg-green-600/10 rounded-xl text-center border-2 border-green-600">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-600" />
              <p className="font-bold text-green-600 text-lg">Order Completed!</p>
              <p className="text-sm text-muted-foreground mt-1">
                You earned QAR {totalEarnings.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                This order has been successfully completed
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Pickup
            </DialogTitle>
            <DialogDescription>
              By scanning the QR code, you confirm that you are physically at the restaurant 
              and have received the order from the partner.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setShowConfirmDialog(false);
                setShowQRScanner(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <ScanLine className="w-4 h-4 mr-2" />
              Start Scanning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <DriverQRScanner
          onScan={handleQRScan}
          onClose={() => {
            setShowQRScanner(false);
            setScanResult(null);
          }}
          isScanning={updating}
          scanResult={scanResult}
          deliveryJobId={delivery?.id}
        />
      )}
    </DriverLayout>
  );
}
