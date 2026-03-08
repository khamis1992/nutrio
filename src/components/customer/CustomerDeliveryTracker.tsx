import { useEffect, useState, useRef, Suspense, lazy } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Truck,
  Phone,
  Clock,
  CheckCircle2,
  Navigation,
  Star,
  ChevronLeft,
  RefreshCw,
  MapPin,
  ChefHat,
  Package,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
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
      { key: "pending",   label: t("tracking_status_finding_driver"),  description: t("tracking_status_finding_driver_desc") },
      { key: "assigned",  label: t("tracking_status_driver_assigned"), description: t("tracking_status_driver_assigned_desc") },
      { key: "accepted",  label: t("tracking_status_en_route"),        description: t("tracking_status_en_route_desc") },
      { key: "picked_up", label: t("tracking_step_on_the_way"),        description: t("tracking_status_on_the_way_desc") },
      { key: "delivered", label: t("tracking_step_delivered"),         description: t("tracking_status_delivered_desc") },
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
    
    if (timeMinutes < 1) return t("tracking_eta_less_than_1");
    if (timeMinutes === 1) return t("tracking_eta_1_min");
    return t("tracking_eta_mins").replace("{n}", String(timeMinutes));
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

  const STEPS = [
    { key: "pending",   label: t("tracking_step_order_placed"),   Icon: CircleDot },
    { key: "assigned",  label: t("tracking_step_driver_assigned"), Icon: Truck },
    { key: "picked_up", label: t("tracking_step_on_the_way"),     Icon: Navigation },
    { key: "delivered", label: t("tracking_step_delivered"),      Icon: CheckCircle2 },
  ];

  // ── Shared header ───────────────────────────────────────────────────────────
  const Header = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="pt-[env(safe-area-inset-top,20px)] px-5 pb-4 flex items-center gap-3 bg-white border-b border-gray-100 sticky top-0 z-10">
      {onBack && (
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 disabled:opacity-40 transition-all"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </div>
  );

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header title={t("tracking_order_tracking")} />
        <div className="flex-1 px-5 py-6 space-y-4">
          <Skeleton className="h-48 w-full rounded-3xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── No delivery job yet (preparing, no driver) ──────────────────────────────
  if (!deliveryJob) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header title={t("tracking_order_tracking")} subtitle={t("tracking_live_updates")} />

        <div className="flex-1 flex flex-col px-5 py-6 pb-32">
          {/* Animated illustration */}
          <div className="flex flex-col items-center pt-4 pb-8">
            <div className="relative w-40 h-40 mb-6">
              {/* Outer pulse ring */}
              <span className="absolute inset-0 rounded-full bg-[#48a98b]/10 animate-ping [animation-duration:2s]" />
              <span className="absolute inset-2 rounded-full bg-[#48a98b]/15 animate-ping [animation-duration:2.4s] [animation-delay:0.4s]" />
              {/* Main circle */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#48a98b] to-[#2d8a6e] flex items-center justify-center shadow-lg shadow-[#48a98b]/30">
                <ChefHat className="w-14 h-14 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              {t("tracking_preparing_order")}
            </h2>
            <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
              {t("tracking_kitchen_working")}
            </p>

            {/* Animated "finding driver" pill */}
            <div className="mt-5 flex items-center gap-2 bg-[#eaf7f0] text-[#48a98b] px-4 py-2 rounded-full font-medium text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#48a98b] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#48a98b]" />
              </span>
              {t("tracking_finding_driver_pill")}
            </div>
          </div>

          {/* Progress steps */}
          <div className="bg-gray-50 rounded-3xl p-5 mb-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{t("tracking_order_progress")}</p>
            <div className="space-y-4">
              {[
                { Icon: CircleDot,    label: t("tracking_step_order_received"),   done: true,  current: false },
                { Icon: ChefHat,      label: t("tracking_step_being_prepared"),   done: false, current: true  },
                { Icon: Truck,        label: t("tracking_step_driver_assigned"),  done: false, current: false },
                { Icon: MapPin,       label: t("tracking_step_out_for_delivery"), done: false, current: false },
                { Icon: CheckCircle2, label: t("tracking_step_delivered"),        done: false, current: false },
              ].map(({ Icon, label, done, current }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    done
                      ? "bg-[#48a98b] text-white"
                      : current
                      ? "bg-white border-2 border-[#48a98b] text-[#48a98b] shadow-sm"
                      : "bg-gray-200 text-gray-400"
                  }`}>
                    {current ? (
                      <span className="relative flex items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-[#48a98b] opacity-30" />
                        <Icon className="w-4 h-4 relative" />
                      </span>
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    done ? "text-[#48a98b]" : current ? "text-gray-900" : "text-gray-400"
                  }`}>
                    {label}
                  </span>
                  {current && (
                    <span className="ml-auto text-xs bg-[#48a98b] text-white px-2.5 py-0.5 rounded-full font-semibold">
                      {t("tracking_now")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info card */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
            <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{t("tracking_estimated_time")}</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {t("tracking_map_appears")}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom refresh button — sticky with safe area */}
        <div
          className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
        >
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full h-[52px] flex items-center justify-center gap-2 rounded-2xl bg-[#48a98b] text-white font-semibold text-sm shadow-sm shadow-[#48a98b]/30 hover:bg-[#3a8b72] active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? t("tracking_refreshing") : t("tracking_refresh_status")}
          </button>
        </div>
      </div>
    );
  }

  // ── Has delivery job ────────────────────────────────────────────────────────
  const currentStep = getStatusStep(deliveryJob.status);
  const statusIndex = getStatusIndex(deliveryJob.status);
  const showMap = driverLocation && (deliveryJob.status === "picked_up" || deliveryJob.status === "accepted");
  const eta = calculateETA();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header
        title={t("tracking_live_tracking")}
        subtitle={currentStep.label}
      />

      <div className="flex-1 px-5 py-5 space-y-4 pb-24">

        {/* Progress stepper */}
        <div className="bg-gray-50 rounded-3xl p-5">
          <div className="relative flex justify-between">
            {/* Background line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200" />
            {/* Active line */}
            <div
              className="absolute top-4 left-4 h-0.5 bg-[#48a98b] transition-all duration-700"
              style={{ width: `calc(${(statusIndex / (STEPS.length - 1)) * 100}% - 2rem)` }}
            />
            {STEPS.map(({ key, label, Icon }, i) => {
              const done = i < statusIndex;
              const active = i === statusIndex;
              return (
                <div key={key} className="flex flex-col items-center gap-1.5 relative z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    done    ? "bg-[#48a98b] text-white" :
                    active  ? "bg-white border-2 border-[#48a98b] text-[#48a98b] shadow-md" :
                              "bg-white border-2 border-gray-200 text-gray-300"
                  }`}>
                    {active ? (
                      <span className="relative flex items-center justify-center">
                        <span className="animate-ping absolute h-5 w-5 rounded-full bg-[#48a98b] opacity-25" />
                        <Icon className="w-3.5 h-3.5 relative" />
                      </span>
                    ) : (
                      <Icon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight max-w-[52px] ${
                    done || active ? "text-gray-700" : "text-gray-400"
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm font-semibold text-gray-900">{currentStep.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{currentStep.description}</p>
          </div>
        </div>

        {/* Live Map */}
        {showMap && (
          <div className="rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
            <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#48a98b] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#48a98b]" />
                </span>
                <span className="text-sm font-semibold text-gray-900">{t("tracking_live_location")}</span>
              </div>
              {eta && (
                <div className="flex items-center gap-1.5 bg-[#eaf7f0] text-[#48a98b] px-3 py-1 rounded-full text-xs font-semibold">
                  <Navigation className="w-3 h-3" />
                  {t("tracking_eta").replace("{eta}", eta)}
                </div>
              )}
            </div>
            <Suspense fallback={<Skeleton className="h-60 w-full" />}>
              <MapContainer
                center={[getMapCenter().lat, getMapCenter().lng]}
                zoom={15}
                style={{ height: "260px", width: "100%" }}
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
                    color="#48a98b"
                    weight={4}
                    opacity={0.7}
                  />
                )}
              </MapContainer>
            </Suspense>
            {driverLocation && (
              <div className="bg-gray-50 px-4 py-2 text-xs text-gray-400">
                {t("tracking_updated").replace("{time}", format(new Date(driverLocation.updated_at), "h:mm:ss a"))}
                {driverLocation.speed_kmh && (
                  <span className="ml-2">· {t("tracking_km_h").replace("{speed}", String(Math.round(driverLocation.speed_kmh)))}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Driver card */}
        {deliveryJob.driver && deliveryJob.status !== "delivered" && (
          <div className="bg-gray-50 rounded-3xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 bg-[#eaf7f0] rounded-full flex items-center justify-center text-2xl shrink-0">
              🧑‍🦽
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">{t("tracking_your_driver")}</p>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span>{deliveryJob.driver.rating?.toFixed(1) || "5.0"}</span>
                <span>·</span>
                <span className="capitalize">{deliveryJob.driver.vehicle_type}</span>
              </div>
            </div>
            {deliveryJob.driver.phone_number && (
              <button
                onClick={() => window.open(`tel:${deliveryJob.driver!.phone_number}`)}
                className="w-10 h-10 rounded-full bg-[#48a98b] flex items-center justify-center shrink-0 shadow-sm shadow-[#48a98b]/30"
              >
                <Phone className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        )}

        {/* Delivered */}
        {deliveryJob.status === "delivered" && (
          <div className="bg-[#eaf7f0] rounded-3xl p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-[#48a98b] rounded-full flex items-center justify-center mb-3 shadow-lg shadow-[#48a98b]/30">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-lg text-[#2d6b55]">{t("tracking_order_delivered")}</h3>
            <p className="text-sm text-[#48a98b] mt-1">{t("tracking_enjoy_meal")}</p>
            {deliveryJob.delivered_at && (
              <p className="text-xs text-[#48a98b]/70 mt-2">
                {t("tracking_delivered_at").replace("{time}", format(new Date(deliveryJob.delivered_at), "h:mm a"))}
              </p>
            )}
          </div>
        )}

        {/* Fee row */}
        <div className="flex items-center justify-between px-1 py-3 border-t border-gray-100 text-sm">
          <span className="text-gray-500">{t("tracking_delivery_fee")}</span>
          <span className="font-semibold text-gray-900">{deliveryJob.delivery_fee || 15} QAR</span>
        </div>
      </div>
    </div>
  );
}

export default CustomerDeliveryTracker;
