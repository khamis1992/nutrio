import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import type { LucideIcon } from "lucide-react";
import { 
  Truck, 
  Phone,
  Clock,
  CheckCircle2,
  Printer,
  Loader2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PartnerDeliveryHandoffProps {
  scheduleId: string;
  restaurantName: string;
}

interface DeliveryJob {
  id: string;
  status: string;
  schedule_id: string;
  driver_id: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  delivery_fee: number;
  driver_earnings: number;
  created_at: string;
  pickup_verification_code: string | null;
  verification_expires_at: string | null;
  qr_scanned_at: string | null;
  driver: DeliveryDriver | null;
}

interface DeliveryDriver {
  id: string;
  phone_number: string;
  vehicle_type: string;
  rating: number | null;
  current_lat: number | null;
  current_lng: number | null;
}

export function PartnerDeliveryHandoff({
  scheduleId,
  restaurantName
}: PartnerDeliveryHandoffProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [deliveryJob, setDeliveryJob] = useState<DeliveryJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeliveryJob = async () => {
      try {
        // Fetch delivery job without embedded driver (PostgREST FK issue)
        const { data: jobData, error: jobError } = await supabase
          .from("delivery_jobs")
          .select("*")
          .eq("schedule_id", scheduleId)
          .single();

        // PGRST116 = no rows found (no delivery job yet)
        if (jobError && jobError.code !== "PGRST116") {
          console.error("Error fetching delivery job:", jobError);
          setDeliveryJob(null);
          return;
        }
        
        // If no job data, just return (delivery job doesn't exist yet)
        if (!jobData) {
          setDeliveryJob(null);
          return;
        }
        
        // If job has a driver, fetch driver separately
        let driverData = null;
        if (jobData?.driver_id) {
          const { data: driver, error: driverError } = await supabase
            .from("drivers")
            .select("id, phone_number, vehicle_type, rating, current_lat, current_lng")
            .eq("id", jobData.driver_id)
            .maybeSingle();
          
          if (!driverError && driver) {
            driverData = driver;
          }
        }
        
        setDeliveryJob({
          ...jobData,
          driver: driverData
        } as unknown as DeliveryJob);
      } catch (err) {
        console.error("Error fetching delivery job:", err);
        setDeliveryJob(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryJob();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`delivery-${scheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_jobs",
          filter: `schedule_id=eq.${scheduleId}`
        },
        (payload) => {
          setDeliveryJob(payload.new as unknown as DeliveryJob);
        }
      )
      .subscribe();

  return () => {
      subscription.unsubscribe();
    };
  }, [scheduleId]);

  const handleRefreshCode = async () => {
    if (!deliveryJob || !user) return;

    setRefreshing(true);
    try {
      const { data, error } = await supabase.rpc("refresh_verification_code", {
        p_delivery_job_id: deliveryJob.id,
        p_partner_user_id: user.id,
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Code Refreshed",
          description: "New verification code generated",
        });
        // Refresh the delivery job data
        const { data: jobData } = await supabase
          .from("delivery_jobs")
          .select("*")
          .eq("id", deliveryJob.id)
          .single();

        if (jobData) {
          setDeliveryJob({ ...deliveryJob, ...jobData });
        }
      } else {
        toast({
          title: "Error",
          description: data?.error || "Failed to refresh code",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error refreshing code:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to refresh code",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const isCodeExpired = () => {
    if (!deliveryJob?.verification_expires_at) return false;
    return new Date(deliveryJob.verification_expires_at) < new Date();
  };

  // Set QR code value when delivery job is loaded
  // Uses the delivery job ID directly — the generate_pickup_qr_code RPC
  // requires pgcrypto (digest function) which is not enabled on this instance.
  useEffect(() => {
    if (!deliveryJob || deliveryJob.status === "picked_up" || deliveryJob.status === "delivered") {
      setQrCode(null);
      return;
    }
    setQrCode(deliveryJob.id);
  }, [deliveryJob?.id, deliveryJob?.status]);

  const handlePrintQR = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow && deliveryJob) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Delivery QR Code</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                margin: 0;
                font-family: Arial, sans-serif;
                text-align: center;
              }
              .qr-container {
                padding: 40px;
                border: 2px dashed #ccc;
                border-radius: 10px;
              }
              h1 {
                margin-bottom: 10px;
                color: #333;
              }
              .order-id {
                font-size: 24px;
                font-weight: bold;
                color: #666;
                margin-bottom: 30px;
              }
              .instructions {
                margin-top: 30px;
                color: #666;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <h1>${restaurantName}</h1>
              <p class="order-id">Order #${scheduleId.slice(0, 8)}</p>
              <div id="qr-code"></div>
              <p class="instructions">
                Scan this QR code with the driver app<br>
                when handing over the order
              </p>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
              new QRCode(document.getElementById("qr-code"), {
                text: "${qrCode || deliveryJob.id}",
                width: 256,
                height: 256,
              });
              setTimeout(() => window.print(), 100);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (loading) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p>Loading delivery information...</p>
        </CardContent>
      </Card>
    );
  }

  if (!deliveryJob) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold mb-1">Waiting for Driver Assignment</h3>
          <p className="text-sm text-muted-foreground">
            This order will be assigned to a driver soon
          </p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    pending: { 
      label: "Finding Driver", 
      color: "bg-yellow-500",
      icon: Clock 
    },
    assigned: { 
      label: "Driver Assigned", 
      color: "bg-blue-500",
      icon: Truck 
    },
    accepted: { 
      label: "Driver Coming", 
      color: "bg-blue-500",
      icon: Truck 
    },
    picked_up: { 
      label: "Picked Up", 
      color: "bg-green-500",
      icon: CheckCircle2 
    },
    delivered: { 
      label: "Delivered", 
      color: "bg-green-600",
      icon: CheckCircle2 
    },
  };

  const config = statusConfig[deliveryJob.status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Delivery Status
          </CardTitle>
          <Badge className={config.color}>
            <Icon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code Section - Show until picked up */}
        {!['picked_up', 'delivered'].includes(deliveryJob.status) && (
          <div className="text-center space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
              <QRCodeSVG 
                value={qrCode || deliveryJob.id} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <div>
              <p className="font-medium text-sm">Order #{scheduleId.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Show this QR code to the driver when handing over the order
              </p>
            </div>
            
            {/* 6-Digit Verification Code */}
            {deliveryJob.pickup_verification_code && (
              <div className="bg-primary/10 p-3 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Or tell driver this code:</p>
                <p className="text-2xl font-bold tracking-widest text-primary">
                  {deliveryJob.pickup_verification_code}
                </p>
                {deliveryJob.verification_expires_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Expires at {format(new Date(deliveryJob.verification_expires_at), "h:mm a")}
                  </p>
                )}
              </div>
            )}
            
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handlePrintQR}
              >
                <Printer className="w-4 h-4 mr-2" />
                Print QR Code
              </Button>
              {isCodeExpired() && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefreshCode}
                  disabled={refreshing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh Code
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Success Message - Show when picked up */}
        {deliveryJob.status === "picked_up" && (
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <h3 className="font-semibold text-green-700">Order Picked Up</h3>
            <p className="text-sm text-green-600">
              Picked up at {deliveryJob.picked_up_at && 
                format(new Date(deliveryJob.picked_up_at), "h:mm a")
              }
            </p>
          </div>
        )}

        {/* Delivered Message */}
        {deliveryJob.status === "delivered" && (
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <h3 className="font-semibold text-green-700">Successfully Delivered</h3>
            <p className="text-sm text-green-600">
              Delivered at {deliveryJob.delivered_at && 
                format(new Date(deliveryJob.delivered_at), "h:mm a")
              }
            </p>
          </div>
        )}

        {/* Driver Information */}
        {deliveryJob.driver && deliveryJob.status !== "delivered" && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <h4 className="font-semibold flex items-center gap-2 text-sm">
              <Truck className="w-4 h-4" />
              Driver Information
            </h4>
            
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-xl">👤</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">Driver</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>⭐ {deliveryJob.driver.rating || 5.0}</span>
                  <span>•</span>
                  <span className="capitalize">{deliveryJob.driver.vehicle_type}</span>
                </div>
              </div>
            </div>

            {deliveryJob.driver.phone_number && (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.open(`tel:${deliveryJob.driver!.phone_number}`)}
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Driver ({deliveryJob.driver.phone_number})
              </Button>
            )}
          </div>
        )}

        {/* Delivery Fee */}
        <div className="flex items-center justify-between pt-3 border-t text-sm">
          <span className="text-muted-foreground">Delivery Fee</span>
          <span className="font-medium">{deliveryJob.delivery_fee || 15} QAR</span>
        </div>
      </CardContent>
    </Card>
  );
}
