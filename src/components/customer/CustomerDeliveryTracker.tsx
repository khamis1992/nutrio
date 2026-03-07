import { useEffect, useState, useRef, Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Truck,
  Phone,
  Clock,
  CheckCircle2,
  Navigation,
  User,
  Star,
  ArrowLeft,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// Lazy load map components to avoid SSR issues
const MapContainer = lazy(() => import("@/components/maps/MapContainer"));
const DriverMarker = lazy(() => import("@/components/maps/DriverMarker"));
const RestaurantMarker = lazy(() => import("@/components/maps/Markers").then(m => ({ default: m.RestaurantMarker })));
const CustomerMarker = lazy(() => import("@/components/maps/Markers").then(m => ({ default: m.CustomerMarker })));
const RoutePolyline = lazy(() => import("@/components/maps/RoutePolyline").then(m => ({ default: m.RoutePolyline })));

interface CustomerDeliveryTrackerProps {
  scheduleId: string;
  onBack?: () => void;
  restaurantLocation?: { lat: number; lng: number; name: string; address?: string };
  customerLocation?: { lat: number; lng: number; name: string; address?: string };
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
  total_deliveries: number | null;
  current_lat: number | null;
  current_lng: number | null;
  user?: {
    raw_user_meta_data?: {
      name?: string;
    };
  };
}

interface DriverLocation {
  lat: number;
  lng: number;
  updated_at: string;
  speed_kmh?: number;
  heading?: number;
}

interface LocationPoint {
  lat: number;
  lng: number;
  timestamp?: string;
  speed?: number;
}

export function CustomerDeliveryTracker({
  scheduleId,
  onBack,
  restaurantLocation,
  customerLocation,
}: CustomerDeliveryTrackerProps) {
  const [deliveryJob, setDeliveryJob] = useState<DeliveryJob | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [routeHistory, setRouteHistory] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const locationChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    fetchDeliveryJob();

    // Subscribe to delivery job updates
    const jobChannel = supabase
      .channel(`customer-delivery-${scheduleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_jobs",
          filter: `schedule_id=eq.${scheduleId}`,
        },
        (payload) => {
          setDeliveryJob(payload.new as unknown as DeliveryJob);
        }
      )
      .subscribe();

    return () => {
      jobChannel.unsubscribe();
      if (locationChannelRef.current) {
        locationChannelRef.current.unsubscribe();
      }
    };
  }, [scheduleId]);

  // Subscribe to driver location updates when driver is assigned
  useEffect(() => {
    if (deliveryJob?.driver_id && deliveryJob.status !== "delivered") {
      // Fetch initial location and route history
      fetchDriverLocation(deliveryJob.driver_id);
      if (deliveryJob.picked_up_at) {
        fetchRouteHistory(deliveryJob.driver_id, deliveryJob.picked_up_at);
      }

      // Subscribe to real-time location updates
      locationChannelRef.current = supabase
        .channel(`driver-location-${deliveryJob.driver_id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "driver_locations",
            filter: `driver_id=eq.${deliveryJob.driver_id}`,
          },
          (payload) => {
            const location = payload.new as { 
              lat: number; 
              lng: number; 
              created_at: string;
              speed_kmh?: number;
              heading?: number;
            };
            setDriverLocation({
              lat: location.lat,
              lng: location.lng,
              updated_at: location.created_at,
              speed_kmh: location.speed_kmh,
              heading: location.heading,
            });
            // Add to route history
            setRouteHistory(prev => [...prev, { 
              lat: location.lat, 
              lng: location.lng,
              timestamp: location.created_at,
              speed: location.speed_kmh 
            }]);
          }
        )
        .subscribe();

      // Poll for location updates every 10 seconds as fallback
      const interval = setInterval(() => {
        fetchDriverLocation(deliveryJob.driver_id!);
      }, 10000);

      return () => {
        clearInterval(interval);
        if (locationChannelRef.current) {
          locationChannelRef.current.unsubscribe();
          locationChannelRef.current = null;
        }
      };
    }
    return undefined;
  }, [deliveryJob?.driver_id, deliveryJob?.status, deliveryJob?.picked_up_at]);

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
          .select("id, phone_number, vehicle_type, rating, total_deliveries, current_lat, current_lng")
          .eq("id", jobData.driver_id)
          .single();
        
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
      setRefreshing(false);
    }
  };

  const fetchDriverLocation = async (driverId: string) => {
    try {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("lat, lng, created_at, speed_kmh, heading")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      if (data && typeof data === 'object' && 'lat' in data) {
        const locationData = data as unknown as { 
          lat: number; 
          lng: number; 
          created_at: string;
          speed_kmh?: number;
          heading?: number;
        };
        setDriverLocation({
          lat: locationData.lat,
          lng: locationData.lng,
          updated_at: locationData.created_at,
          speed_kmh: locationData.speed_kmh,
          heading: locationData.heading,
        });
      }
    } catch (err) {
      console.error("Error fetching driver location:", err);
    }
  };

  const fetchRouteHistory = async (driverId: string, since: string) => {
    try {
      const { data, error } = await supabase
        .from("driver_locations")
        .select("lat, lng, created_at, speed_kmh")
        .eq("driver_id", driverId)
        .gte("created_at", since)
        .order("created_at", { ascending: true });

      if (error) throw error;
      if (data) {
        const history = data.map((loc: unknown) => {
          const location = loc as { lat: number; lng: number; created_at: string; speed_kmh?: number };
          return {
            lat: location.lat,
            lng: location.lng,
            timestamp: location.created_at,
            speed: location.speed_kmh,
          };
        });
        setRouteHistory(history);
      }
    } catch (err) {
      console.error("Error fetching route history:", err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeliveryJob();
    if (deliveryJob?.driver_id) {
      fetchDriverLocation(deliveryJob.driver_id);
      if (deliveryJob.picked_up_at) {
        fetchRouteHistory(deliveryJob.driver_id, deliveryJob.picked_up_at);
      }
    }
  };

  const getStatusStep = (status: string) => {
    const steps = [
      { key: "pending", label: "Finding Driver", description: "Looking for a nearby driver" },
      { key: "assigned", label: "Driver Assigned", description: "A driver has been assigned" },
      { key: "accepted", label: "Driver En Route", description: "Driver is heading to the restaurant" },
      { key: "picked_up", label: "On the Way", description: "Your order is on its way" },
      { key: "delivered", label: "Delivered", description: "Enjoy your meal!" },
    ];
    return steps.find((s) => s.key === status) || steps[0];
  };

  const getStatusIndex = (status: string) => {
    const order = ["pending", "assigned", "accepted", "picked_up", "delivered"];
    return order.indexOf(status);
  };

  // Calculate ETA
  const calculateETA = () => {
    if (!driverLocation || !customerLocation) return null;
    
    // Haversine distance
    const R = 6371; // Earth's radius in km
    const dLat = (customerLocation.lat - driverLocation.lat) * Math.PI / 180;
    const dLon = (customerLocation.lng - driverLocation.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(driverLocation.lat * Math.PI / 180) * Math.cos(customerLocation.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Estimate time based on average speed (30 km/h in city)
    const speed = driverLocation.speed_kmh || 30;
    const timeHours = distance / speed;
    const timeMinutes = Math.round(timeHours * 60);
    
    if (timeMinutes < 1) return "Less than 1 min";
    if (timeMinutes === 1) return "1 min";
    return `${timeMinutes} mins`;
  };

  // Calculate map center
  const getMapCenter = () => {
    if (driverLocation) {
      return { lat: driverLocation.lat, lng: driverLocation.lng };
    }
    if (restaurantLocation) {
      return { lat: restaurantLocation.lat, lng: restaurantLocation.lng };
    }
    if (customerLocation) {
      return { lat: customerLocation.lat, lng: customerLocation.lng };
    }
    // Default to Doha, Qatar
    return { lat: 25.2854, lng: 51.5310 };
  };

  if (loading) {
    return (
      <Card className="border-2 border-primary">
        <CardContent className="p-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!deliveryJob) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-8 text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          <h3 className="font-semibold mb-1">Preparing Your Order</h3>
          <p className="text-sm text-muted-foreground">
            Your order is being prepared. Delivery tracking will be available once a driver is assigned.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentStep = getStatusStep(deliveryJob.status);
  const statusIndex = getStatusIndex(deliveryJob.status);
  const showMap = driverLocation && (deliveryJob.status === "picked_up" || deliveryJob.status === "accepted");
  const eta = calculateETA();

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5 rtl-flip-back" />
              </Button>
            )}
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Live Delivery Tracking
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Badge
              className={
                deliveryJob.status === "delivered"
                  ? "bg-green-600"
                  : deliveryJob.status === "picked_up"
                  ? "bg-orange-500"
                  : "bg-blue-500"
              }
            >
              {currentStep.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Timeline */}
        <div className="relative">
          <div className="flex justify-between">
            {["pending", "assigned", "picked_up", "delivered"].map((step, index) => {
              const isCompleted = index <= statusIndex;
              const isCurrent = index === statusIndex;

              return (
                <div key={step} className="flex flex-col items-center relative z-10">
                  <div
                    className={`
                      h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium
                      ${isCompleted
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                      }
                      ${isCurrent ? "ring-4 ring-primary/20" : ""}
                    `}
                  >
                    {index + 1}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Progress Line */}
          <div className="absolute top-4 left-[12.5%] right-[12.5%] h-0.5 bg-muted -z-0">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(statusIndex / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-primary/5 p-4 rounded-lg">
          <p className="font-medium">{currentStep.label}</p>
          <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          {deliveryJob.picked_up_at && deliveryJob.status === "picked_up" && (
            <p className="text-sm text-muted-foreground mt-1">
              Picked up at {format(new Date(deliveryJob.picked_up_at), "h:mm a")}
            </p>
          )}
          {deliveryJob.delivered_at && (
            <p className="text-sm text-muted-foreground mt-1">
              Delivered at {format(new Date(deliveryJob.delivered_at), "h:mm a")}
            </p>
          )}
        </div>

        {/* Live Map */}
        {showMap && (
          <div className="rounded-xl overflow-hidden border-2 border-primary/20">
            <div className="bg-primary/5 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Live Location</span>
              </div>
              {eta && (
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-green-500 animate-pulse" />
                  <span className="text-sm font-medium text-green-600">
                    ETA: {eta}
                  </span>
                </div>
              )}
            </div>
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <MapContainer
                center={[getMapCenter().lat, getMapCenter().lng]}
                zoom={15}
                style={{ height: "300px", width: "100%" }}
                scrollWheelZoom={false}
              >
                {driverLocation && (
                  <DriverMarker
                    position={{ lat: driverLocation.lat, lng: driverLocation.lng }}
                    heading={driverLocation.heading}
                    speed={driverLocation.speed_kmh}
                    driverName="Driver"
                    eta={eta || undefined}
                  />
                )}
                {restaurantLocation && deliveryJob.status === "accepted" && (
                  <RestaurantMarker
                    position={{ lat: restaurantLocation.lat, lng: restaurantLocation.lng }}
                    title={restaurantLocation.name}
                    address={restaurantLocation.address}
                  />
                )}
                {customerLocation && deliveryJob.status === "picked_up" && (
                  <CustomerMarker
                    position={{ lat: customerLocation.lat, lng: customerLocation.lng }}
                    title={customerLocation.name}
                    address={customerLocation.address}
                  />
                )}
                {routeHistory.length > 1 && (
                  <RoutePolyline
                    positions={routeHistory}
                    color="#22c55e"
                    weight={4}
                    opacity={0.7}
                  />
                )}
              </MapContainer>
            </Suspense>
            {driverLocation && (
              <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                Updated {format(new Date(driverLocation.updated_at), "h:mm:ss a")}
                {driverLocation.speed_kmh && (
                  <span className="ml-2">• Speed: {Math.round(driverLocation.speed_kmh)} km/h</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Driver Information */}
        {deliveryJob.driver && deliveryJob.status !== "delivered" && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-4">
            <h4 className="font-semibold flex items-center gap-2 text-sm">
              <User className="w-4 h-4" />
              Your Driver
            </h4>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-xl">👤</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">Driver</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span>{deliveryJob.driver.rating || 5.0}</span>
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
                Call Driver
              </Button>
            )}
          </div>
        )}

        {/* Delivery Success */}
        {deliveryJob.status === "delivered" && (
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <h3 className="font-semibold text-green-700">Successfully Delivered!</h3>
            <p className="text-sm text-green-600">
              Your order has been delivered. Enjoy your meal!
            </p>
            {deliveryJob.delivered_at && (
              <p className="text-xs text-green-600 mt-1">
                At {format(new Date(deliveryJob.delivered_at), "h:mm a")}
              </p>
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

export default CustomerDeliveryTracker;
