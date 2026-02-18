import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Phone, Store, Package, CheckCircle, Navigation, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DriverLayout } from "@/components/DriverLayout";

interface DeliveryDetails {
  id: string;
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  claimed: { label: "Claimed", color: "bg-blue-500" },
  picked_up: { label: "Picked Up", color: "bg-purple-500" },
  on_the_way: { label: "On the Way", color: "bg-orange-500" },
  delivered: { label: "Delivered", color: "bg-green-500" },
};

export default function DriverOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryDetails | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (id && user) {
      fetchDelivery();
    }
  }, [id, user]);

  const fetchDelivery = async () => {
    if (!id || !user) return;

    try {
      const { data, error } = await supabase
        .from("deliveries")
        .select(`
          id,
          status,
          pickup_address,
          delivery_address,
          delivery_lat,
          delivery_lng,
          estimated_distance_km,
          delivery_fee,
          tip_amount,
          delivery_notes,
          delivery_photo_url,
          restaurant:restaurants (name, address, phone),
          meal_schedule:meal_schedules (
            meal_name,
            calories,
            special_instructions,
            user_id
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      if (data) {
        const d = data as any;
        
        // Fetch customer info and addons
        let mealScheduleData = null;
        if (d.meal_schedule) {
          const [{ data: profile }, { data: address }, { data: addons }] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name")
              .eq("user_id", d.meal_schedule.user_id)
              .single(),
            supabase
              .from("user_addresses")
              .select("phone")
              .eq("user_id", d.meal_schedule.user_id)
              .eq("is_default", true)
              .single(),
            supabase
              .from("schedule_addons")
              .select("addon_name")
              .eq("schedule_id", id)
          ]);
          
          mealScheduleData = {
            meal_name: d.meal_schedule.meal_name,
            calories: d.meal_schedule.calories,
            customer_name: profile?.full_name || "Customer",
            customer_phone: address?.phone || null,
            special_instructions: d.meal_schedule.special_instructions,
            addons: addons?.map((a: any) => a.addon_name) || [],
          };
        }
        
        setDelivery({
          id: d.id,
          status: d.status,
          pickup_address: d.pickup_address,
          delivery_address: d.delivery_address,
          delivery_lat: d.delivery_lat,
          delivery_lng: d.delivery_lng,
          estimated_distance_km: d.estimated_distance_km,
          delivery_fee: d.delivery_fee || 0,
          tip_amount: d.tip_amount || 0,
          delivery_notes: d.delivery_notes,
          delivery_photo_url: d.delivery_photo_url,
          restaurant: d.restaurant || null,
          meal_schedule: mealScheduleData,
        });
        setNotes(d.delivery_notes || "");
      }
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
      const updateData: Record<string, any> = { status: newStatus };

      if (newStatus === "picked_up") {
        updateData.picked_up_at = new Date().toISOString();
      } else if (newStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
        updateData.delivery_notes = notes;
      }

      const { error } = await supabase
        .from("deliveries")
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
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/driver")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
              <p className="font-bold text-green-600 text-lg">QAR {totalEarnings.toFixed(2)}</p>
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
                  onClick={() => window.open(`tel:${delivery.restaurant.phone}`)}
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
          {delivery.status === "claimed" && (
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={() => updateStatus("picked_up")}
              disabled={updating}
            >
              <Package className="h-4 w-4 mr-2" />
              Confirm Pickup
            </Button>
          )}

          {delivery.status === "picked_up" && (
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={() => updateStatus("on_the_way")}
              disabled={updating}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Start Delivery
            </Button>
          )}

          {delivery.status === "on_the_way" && (
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => updateStatus("delivered")}
              disabled={updating}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirm Delivery
            </Button>
          )}

          {delivery.status === "delivered" && (
            <div className="p-4 bg-green-500/10 rounded-xl text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="font-semibold text-green-600">Delivery Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">
                You earned QAR {totalEarnings.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>
    </DriverLayout>
  );
}
