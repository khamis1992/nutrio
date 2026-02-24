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
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  driver: DeliveryDriver | null;
}

interface DeliveryDriver {
  id: string;
  phone_number: string;
  vehicle_type: string;
  rating: number | null;
  current_lat: number | null;
  current_lng: number | null;
  user?: {
    raw_user_meta_data?: {
      name?: string;
    };
  };
}

export function PartnerDeliveryHandoff({ 
  scheduleId, 
  restaurantName 
}: PartnerDeliveryHandoffProps) {
  const [deliveryJob, setDeliveryJob] = useState<DeliveryJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeliveryJob = async () => {
      try {
        const { data, error } = await supabase
          .from("delivery_jobs")
          .select(`
            *,
            driver:driver_id(
              id,
              phone_number,
              vehicle_type,
              rating,
              current_lat,
              current_lng,
              user:user_id(
                raw_user_meta_data
              )
            )
          `)
          .eq("schedule_id", scheduleId)
          .single();

        if (error && error.code !== "PGRST116") throw error;
        setDeliveryJob(data as unknown as DeliveryJob);
      } catch (err) {
        console.error("Error fetching delivery job:", err);
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
              <p class="order-id">Order #${deliveryJob.id.slice(-6)}</p>
              <div id="qr-code"></div>
              <p class="instructions">
                Scan this QR code with the driver app<br>
                when handing over the order
              </p>
            </div>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
              new QRCode(document.getElementById("qr-code"), {
                text: "${deliveryJob.id}",
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
                value={deliveryJob.id} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <div>
              <p className="font-medium text-sm">Order #{deliveryJob.id.slice(-6)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Show this QR code to the driver when handing over the order
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrintQR}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print QR Code
            </Button>
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
                <p className="font-medium">
                  {deliveryJob.driver.user?.raw_user_meta_data?.name || "Driver"}
                </p>
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
