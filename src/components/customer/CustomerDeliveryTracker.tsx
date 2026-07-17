import { useEffect, useState, Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Truck,
  Phone,
  Clock,
  CheckCircle2,
  Navigation,
  ChevronLeft,
  RefreshCw,
  MapPin,
  ChefHat,
  CircleDot,
  User,
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
  created_at: string;
  driver: DeliveryDriver | null;
}

interface DeliveryDriver {
  id: string;
  full_name: string | null;
  phone_number: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  license_plate: string | null;
  rating: number | null;
  total_deliveries: number | null;
  current_lat: number | null;
  current_lng: number | null;
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

interface CustomerTrackingProjection {
  delivery_job: DeliveryJob | null;
  latest_location: DriverLocation | null;
}

type UntypedRpcResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

const callRpc = <T,>(name: string, args: Record<string, unknown>) =>
  (supabase as unknown as {
    rpc: (functionName: string, parameters: Record<string, unknown>) => Promise<UntypedRpcResult<T>>;
  }).rpc(name, args);

const safeFormat = (dateStr: string | null | undefined, fmt: string, fallback = ""): string => {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? fallback : format(d, fmt);
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getEtaMinutes = (
  driverLat: number,
  driverLng: number,
  customerLat: number,
  customerLng: number,
  speedKmh?: number
): number => {
  const distKm = haversineKm(driverLat, driverLng, customerLat, customerLng);
  const speed = speedKmh && speedKmh > 2 ? speedKmh : 25;
  return Math.max(1, Math.round((distKm / speed) * 60));
};

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

  useEffect(() => {
    setRouteHistory([]);
    void fetchDeliveryJob();

    const interval = window.setInterval(() => {
      void fetchDeliveryJob();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const fetchDeliveryJob = async () => {
    try {
      const { data, error } = await callRpc<CustomerTrackingProjection>(
        "get_customer_delivery_tracking",
        { p_source_id: scheduleId },
      );

      if (error) throw error;

      const job = data?.delivery_job ?? null;
      const latestLocation = data?.latest_location ?? null;
      setDeliveryJob(job);
      setDriverLocation(latestLocation);

      if (latestLocation) {
        setRouteHistory((previous) => {
          const lastPoint = previous[previous.length - 1];
          if (lastPoint?.timestamp === latestLocation.updated_at) return previous;
          return [...previous.slice(-199), {
            lat: latestLocation.lat,
            lng: latestLocation.lng,
            timestamp: latestLocation.updated_at,
            speed: latestLocation.speed_kmh,
          }];
        });
      } else if (!job || ["delivered", "completed", "failed", "cancelled"].includes(job.status)) {
        setRouteHistory([]);
      }
    } catch (err) {
      console.error("Error fetching delivery job:", err);
      setDeliveryJob(null);
      setDriverLocation(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchDeliveryJob();
  };

  const getStatusStep = (status: string | null) => {
    const steps = [
      { key: "pending",    label: t("tracking_status_finding_driver"),  description: t("tracking_status_finding_driver_desc") },
      { key: "assigned",   label: t("tracking_status_driver_assigned"), description: t("tracking_status_driver_assigned_desc") },
      { key: "accepted",   label: t("tracking_status_en_route"),        description: t("tracking_status_en_route_desc") },
      { key: "picked_up",  label: t("tracking_step_on_the_way"),        description: t("tracking_status_on_the_way_desc") },
      { key: "in_transit", label: t("tracking_step_on_the_way"),        description: t("tracking_status_on_the_way_desc") },
      { key: "delivered",  label: t("tracking_step_delivered"),         description: t("tracking_status_delivered_desc") },
      { key: "completed",  label: t("tracking_step_delivered"),         description: t("tracking_status_delivered_desc") },
    ];
    return steps.find((s) => s.key === status) || steps[0];
  };

  const getStatusIndex = (status: string | null) => {
    // Collapse internal sub-states to the 4 customer-facing stepper steps
    const normalize = (s: string | null) => {
      if (s === "accepted") return "assigned";
      if (s === "in_transit") return "picked_up";
      if (s === "completed") return "delivered";
      return s;
    };
    const order = ["pending", "assigned", "picked_up", "delivered"];
    return order.indexOf(normalize(status) ?? "");
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
    <div className="sticky top-0 z-30 border-b border-white/70 bg-[#F6F8FB]/95 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[430px] items-center gap-3">
      {onBack && (
        <button
          onClick={onBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#7C83F6]">
          {t("tracking_live_updates")}
        </p>
        <h1 className="truncate text-[22px] font-black leading-tight text-[#020617]">{title}</h1>
        {subtitle && <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-500">{subtitle}</p>}
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1] transition-all disabled:opacity-40"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
      </button>
      </div>
    </div>
  );

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-y-auto bg-[#F6F8FB] [-webkit-overflow-scrolling:touch]">
        <Header title={t("tracking_order_tracking")} />
        <div className="mx-auto w-full max-w-[430px] flex-1 space-y-4 px-4 py-5">
          <Skeleton className="h-64 w-full rounded-[32px]" />
          <Skeleton className="h-24 w-full rounded-[28px]" />
          <Skeleton className="h-40 w-full rounded-[28px]" />
        </div>
      </div>
    );
  }

  // ── No delivery job yet (preparing, no driver) ──────────────────────────────
  if (!deliveryJob) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-y-auto bg-[#F6F8FB] [-webkit-overflow-scrolling:touch]">
        <Header title={t("tracking_order_tracking")} subtitle={t("tracking_live_updates")} />

        <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-4 py-5 pb-28">
          {/* Animated illustration */}
          <div className="mb-4 rounded-[28px] bg-white px-5 py-7 text-center shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
            <div className="relative mx-auto mb-6 h-36 w-36">
              {/* Outer pulse ring */}
              <span className="absolute inset-0 rounded-full bg-[#F97316]/10 animate-ping [animation-duration:2s]" />
              <span className="absolute inset-2 rounded-full bg-[#F97316]/15 animate-ping [animation-duration:2.4s] [animation-delay:0.4s]" />
              {/* Main circle */}
              <div className="absolute inset-4 flex items-center justify-center rounded-full bg-[#FFF7ED] text-[#F97316] shadow-[0_18px_34px_rgba(249,115,22,0.14)] ring-1 ring-[#F97316]/20">
                <ChefHat className="h-12 w-12" />
              </div>
            </div>

            <h2 className="mb-2 text-[26px] font-black leading-tight text-slate-950">
              {t("tracking_preparing_order")}
            </h2>
            <p className="mx-auto max-w-xs text-[13px] font-semibold leading-relaxed text-slate-500">
              {t("tracking_kitchen_working")}
            </p>

            {/* Animated "finding driver" pill */}
            <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full bg-[#F3F4FF] px-4 py-2 text-sm font-extrabold text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#7C83F6] opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#7C83F6]" />
              </span>
              {t("tracking_finding_driver_pill")}
            </div>
          </div>

          {/* Progress steps */}
          <div className="mb-4 rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{t("tracking_order_progress")}</p>
            <div className="space-y-4">
              {[
                { Icon: CircleDot,    label: t("tracking_step_order_received"),   done: true,  current: false },
                { Icon: ChefHat,      label: t("tracking_step_being_prepared"),   done: false, current: true  },
                { Icon: Truck,        label: t("tracking_step_driver_assigned"),  done: false, current: false },
                { Icon: MapPin,       label: t("tracking_step_out_for_delivery"), done: false, current: false },
                { Icon: CheckCircle2, label: t("tracking_step_delivered"),        done: false, current: false },
              ].map(({ Icon, label, done, current }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                    done
                      ? "bg-[#22C7A1] text-white"
                      : current
                      ? "border-2 border-[#F97316] bg-white text-[#F97316] shadow-sm"
                      : "bg-slate-100 text-slate-400"
                  }`}>
                    {current ? (
                      <span className="relative flex items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-[#F97316] opacity-25" />
                        <Icon className="w-4 h-4 relative" />
                      </span>
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-sm font-bold ${
                    done ? "text-[#22C7A1]" : current ? "text-slate-950" : "text-slate-400"
                  }`}>
                    {label}
                  </span>
                  {current && (
                    <span className="ml-auto rounded-full bg-[#FFF7ED] px-2.5 py-0.5 text-xs font-extrabold text-[#F97316] ring-1 ring-[#F97316]/20">
                      {t("tracking_now")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info card */}
          <div className="flex gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#38BDF8]" />
            <div>
              <p className="text-sm font-black text-slate-950">{t("tracking_estimated_time")}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {t("tracking_map_appears")}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom refresh button — sticky with safe area */}
        <div
          className="sticky bottom-0 left-0 right-0 border-t border-slate-200/70 bg-white/95 px-4 pt-3 backdrop-blur-xl"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}
        >
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mx-auto flex h-14 w-full max-w-[430px] items-center justify-center gap-2 rounded-full bg-[#020617] text-sm font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] transition-all active:scale-[0.98] disabled:opacity-60"
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
  const statusIndex = Math.max(0, getStatusIndex(deliveryJob.status));
  const showMap = driverLocation && ["accepted", "picked_up", "in_transit"].includes(deliveryJob.status ?? "");
  const eta = calculateETA();

  return (
    <div className="flex h-[100dvh] flex-col overflow-y-auto bg-[#F6F8FB] [-webkit-overflow-scrolling:touch]">
      <Header
        title={t("tracking_live_tracking")}
        subtitle={currentStep.label}
      />

      <div className="mx-auto w-full max-w-[430px] flex-1 space-y-4 px-4 py-5 pb-24">

        <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                {deliveryJob.status === "delivered" ? t("tracking_step_delivered") : t("tracking_live_tracking")}
              </p>
              <h2 className="mt-1 text-[22px] font-black leading-tight text-[#020617]">{currentStep.label}</h2>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-500">{currentStep.description}</p>
            </div>
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ring-1 ${
              deliveryJob.status === "delivered"
                ? "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20"
                : "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/20"
            }`}>
              {deliveryJob.status === "delivered" ? <CheckCircle2 className="h-8 w-8" /> : <Truck className="h-8 w-8" />}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#EFF9FF] p-3 ring-1 ring-[#38BDF8]/20">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{t("tracking_eta")}</p>
              <p className="mt-1 text-[20px] font-black text-[#38BDF8]">{eta ?? "--"}</p>
            </div>
            <div className="rounded-2xl bg-[#F3F4FF] p-3 ring-1 ring-[#7C83F6]/20">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{t("tracking_updated").split("{time}")[0] || "Updated"}</p>
              <p className="mt-1 text-[20px] font-black text-[#7C83F6]">
                {driverLocation ? safeFormat(driverLocation.updated_at, "h:mm a", "--") : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="rounded-[28px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="relative flex justify-between">
            {/* Background line */}
            <div className="absolute left-4 right-4 top-4 h-0.5 bg-[#E5EAF1]" />
            {/* Active line */}
            <div
              className="absolute left-4 top-4 h-0.5 bg-[#22C7A1] transition-all duration-700"
              style={{ width: statusIndex <= 0 ? "0%" : `calc(${(statusIndex / (STEPS.length - 1)) * 100}% - 2rem)` }}
            />
            {STEPS.map(({ key, label, Icon }, i) => {
              const done = i < statusIndex;
              const active = i === statusIndex;
              return (
                <div key={key} className="relative z-10 flex flex-col items-center gap-1.5">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    done    ? "bg-[#22C7A1] text-white" :
                    active  ? "border-2 border-[#7C83F6] bg-white text-[#7C83F6] shadow-md" :
                              "border-2 border-slate-200 bg-white text-slate-300"
                  }`}>
                    {active ? (
                      <span className="relative flex items-center justify-center">
                        <span className="absolute h-5 w-5 animate-ping rounded-full bg-[#7C83F6] opacity-25" />
                        <Icon className="relative h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight max-w-[52px] ${
                    done || active ? "text-slate-700" : "text-slate-400"
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-black text-slate-950">{currentStep.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">{currentStep.description}</p>
          </div>
        </div>

        {/* Live Map */}
        {showMap && (
          <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C7A1] opacity-40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C7A1]" />
                </span>
                <span className="text-sm font-black text-slate-950">{t("tracking_live_location")}</span>
              </div>
              {eta && (
                <div className="flex items-center gap-1.5 rounded-full bg-[#EFF9FF] px-3 py-1 text-xs font-extrabold text-[#38BDF8] ring-1 ring-[#38BDF8]/20">
                  <Navigation className="h-3 w-3" />
                  {t("tracking_eta").replace("{eta}", eta)}
                </div>
              )}
            </div>
            <Suspense fallback={<Skeleton className="h-60 w-full" />}>
              <MapContainer
                center={[getMapCenter().lat, getMapCenter().lng]}
                zoom={15}
                style={{ height: "320px", width: "100%" }}
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
                {restaurantLocation && ["accepted", "picked_up"].includes(deliveryJob.status ?? "") && (
                  <RestaurantMarker
                    position={{ lat: restaurantLocation.lat, lng: restaurantLocation.lng }}
                    title={restaurantLocation.name}
                    address={restaurantLocation.address}
                  />
                )}
                {customerLocation && ["in_transit", "picked_up"].includes(deliveryJob.status ?? "") && (
                  <CustomerMarker
                    position={{ lat: customerLocation.lat, lng: customerLocation.lng }}
                    title={customerLocation.name}
                    address={customerLocation.address}
                  />
                )}
                {routeHistory.length > 1 && (
                  <RoutePolyline
                    positions={routeHistory}
                    color="#7C83F6"
                    weight={4}
                    opacity={0.7}
                  />
                )}
              </MapContainer>
            </Suspense>
            {driverLocation && (
              <div className="bg-[#F6F8FB] px-4 py-2 text-xs font-semibold text-slate-400">
                {t("tracking_updated").replace("{time}", safeFormat(driverLocation.updated_at, "h:mm:ss a", "—"))}
                {driverLocation.speed_kmh && (
                  <span className="ml-2">· {t("tracking_km_h").replace("{speed}", String(Math.round(driverLocation.speed_kmh)))}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Driver card */}
        {deliveryJob.driver && deliveryJob.status !== "delivered" && (
          <div className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{t("tracking_your_driver")}</p>
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                <User className="h-7 w-7" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="truncate text-base font-black leading-tight text-slate-950">
                  {deliveryJob.driver.full_name || t("tracking_your_driver")}
                </p>
                {/* ETA */}
                {driverLocation && customerLocation && deliveryJob.status === "picked_up" && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3.5 w-3.5 text-[#38BDF8]" />
                    <span className="text-sm font-extrabold text-[#38BDF8]">
                      ~{getEtaMinutes(
                        driverLocation.lat,
                        driverLocation.lng,
                        customerLocation.lat,
                        customerLocation.lng,
                        driverLocation.speed_kmh
                      )} min away
                    </span>
                  </div>
                )}
                {/* Vehicle info */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {deliveryJob.driver.vehicle_type && (
                    <span className="rounded-full border border-[#E5EAF1] bg-[#F6F8FB] px-2 py-0.5 text-xs font-semibold capitalize text-slate-600">
                      {deliveryJob.driver.vehicle_type}
                    </span>
                  )}
                  {(deliveryJob.driver.vehicle_make || deliveryJob.driver.vehicle_model) && (
                    <span className="text-xs font-semibold text-slate-500">
                      {[deliveryJob.driver.vehicle_make, deliveryJob.driver.vehicle_model].filter(Boolean).join(" ")}
                    </span>
                  )}
                  {deliveryJob.driver.license_plate && (
                    <span className="rounded bg-[#FFF7ED] px-2 py-0.5 font-mono text-xs font-bold text-[#F97316]">
                      {deliveryJob.driver.license_plate}
                    </span>
                  )}
                </div>
              </div>

              {/* Call button — phone preferred, email as fallback, hidden if neither */}
              {deliveryJob.driver.phone_number && (
                <a
                  href={`tel:${deliveryJob.driver.phone_number}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#020617] shadow-[0_12px_24px_rgba(2,6,23,0.18)] transition-transform active:scale-95"
                >
                  <Phone className="h-5 w-5 text-white" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Delivered */}
        {deliveryJob.status === "delivered" && (
          <div className="flex flex-col items-center rounded-[32px] bg-white p-6 text-center ring-1 ring-slate-100 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#EFFFFA] text-[#22C7A1] shadow-[0_16px_32px_rgba(34,199,161,0.16)] ring-1 ring-[#22C7A1]/20">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-black text-slate-950">{t("tracking_order_delivered")}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{t("tracking_enjoy_meal")}</p>
            {deliveryJob.delivered_at && (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {t("tracking_delivered_at").replace("{time}", safeFormat(deliveryJob.delivered_at, "h:mm a", "—"))}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default CustomerDeliveryTracker;
