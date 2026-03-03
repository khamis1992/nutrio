import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isTomorrow, addMinutes } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Package, 
  ChefHat, 
  Truck,
  CheckCircle2, 
  Clock,
  MapPin,
  Phone,
  RefreshCw,
  ExternalLink,
  Check,
} from "lucide-react";
import flameLogo from "@/assets/flam.png";

// Import map components directly to avoid StrictMode issues with lazy loading
import MapContainer from "@/components/maps/MapContainer";
import DriverMarker from "@/components/maps/DriverMarker";
import { Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

type OrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "completed" | "cancelled";

interface MealSchedule {
  id: string;
  scheduled_date: string;
  order_status: OrderStatus | null;
  meal_id: string;
  addons_total: number | null;
  delivery_fee: number | null;
  delivery_type: string | null;
}

interface Meal {
  id: string;
  name: string;
  image_url: string | null;
  restaurant_id: string | null;
  restaurant?: {
    name: string;
    phone: string | null;
    address: string | null;
  };
}

interface DeliveryJob {
  id: string;
  driver_id: string | null;
  status: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  driver?: {
    current_lat: number | null;
    current_lng: number | null;
    full_name: string | null;
    phone_number: string | null;
  } | null;
}

interface ActiveOrder {
  id: string;
  order_status: OrderStatus | null;
  scheduled_date: string;
  meal_name: string;
  meal_image: string | null;
  restaurant_name: string;
  restaurant_phone: string | null;
  restaurant_address: string | null;
  total_amount: number;
  delivery_type: string;
  delivery_job?: DeliveryJob | null;
  driver_name?: string | null;
  driver_phone?: string | null;
}

// 5 steps - removed Confirmed to match reference design
const statusSteps: { status: OrderStatus; label: string; sublabel?: string }[] = [
  { status: "pending", label: "Order Placed" },
  { status: "preparing", label: "Preparing", sublabel: "In Queue" },
  { status: "ready", label: "Ready" },
  { status: "out_for_delivery", label: "On the Way", sublabel: "Near Your Location" },
  { status: "delivered", label: "Delivered" },
];

const statusConfig: Record<OrderStatus, {
  label: string;
  shortLabel: string;
  badgeClass: string;
  textClass: string;
}> = {
  pending: {
    label: "Pending",
    shortLabel: "PENDING",
    badgeClass: "bg-[#bef264]",
    textClass: "text-green-900",
  },
  confirmed: {
    label: "Confirmed",
    shortLabel: "CONFIRMED",
    badgeClass: "bg-[#bef264]",
    textClass: "text-green-900",
  },
  preparing: {
    label: "Preparing",
    shortLabel: "PREPARING",
    badgeClass: "bg-[#bef264]",
    textClass: "text-green-900",
  },
  ready: {
    label: "Ready",
    shortLabel: "READY",
    badgeClass: "bg-[#bef264]",
    textClass: "text-green-900",
  },
  out_for_delivery: {
    label: "On the Way",
    shortLabel: "ON THE WAY",
    badgeClass: "bg-green-700",
    textClass: "text-[#bef264]",
  },
  delivered: {
    label: "Delivered",
    shortLabel: "DELIVERED",
    badgeClass: "bg-green-700",
    textClass: "text-white",
  },
  completed: {
    label: "Completed",
    shortLabel: "COMPLETED",
    badgeClass: "bg-green-700",
    textClass: "text-white",
  },
  cancelled: {
    label: "Cancelled",
    shortLabel: "CANCELLED",
    badgeClass: "bg-red-500",
    textClass: "text-white",
  },
};

// Food emoji for meal items
const FoodEmoji = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-orange-100 to-green-100 text-xs mr-2">
    🥗
  </span>
);

const haversineDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calculateEtaMinutes = (driverLat: number, driverLng: number, destLat: number, destLng: number): number => {
  const distKm = haversineDistanceKm(driverLat, driverLng, destLat, destLng);
  return Math.max(2, Math.round((distKm / 30) * 60)); // 30 km/h average city speed
};

const getCurrentStepIndex = (status: OrderStatus) => {
  return statusSteps.findIndex(s => s.status === status);
};

const getEstimatedTime = (status: OrderStatus, deliveryDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = format(today, "yyyy-MM-dd");
  const isDeliveryToday = deliveryDate === todayStr;
  
  if (!isDeliveryToday) {
    const date = new Date(deliveryDate);
    if (isTomorrow(date)) {
      return "Tomorrow";
    }
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  
  switch (status) {
    case 'pending':
      return 'Waiting for confirmation';
    case 'confirmed':
      return 'Starting preparation soon';
    case 'preparing':
      return '15-25 min remaining';
    case 'ready':
      return 'Ready for pickup/delivery';
    case 'out_for_delivery':
      return '5-15 min remaining';
    case 'delivered':
      return 'Delivered today';
    default:
      return 'Processing';
  }
};

// ── Road-following route line using OSRM (free, no API key) ─────────────
// Injects route animation CSS once into the document
const ROUTE_STYLE_ID = "nutrio-route-anim";
function injectRouteStyles() {
  if (document.getElementById(ROUTE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = ROUTE_STYLE_ID;
  style.textContent = `
    /* Flowing dash — travels from driver to customer */
    @keyframes routeFlow {
      from { stroke-dashoffset: 400; }
      to   { stroke-dashoffset: 0; }
    }
    /* Glow pulse on main line */
    @keyframes routeGlow {
      0%,100% { filter: drop-shadow(0 0 3px #4ade80) drop-shadow(0 0 6px #16a34a); }
      50%      { filter: drop-shadow(0 0 8px #86efac) drop-shadow(0 0 16px #22c55e); }
    }
    .route-glow path {
      animation: routeGlow 2s ease-in-out infinite;
    }
    .route-flow path {
      stroke-dasharray: 16 12;
      animation: routeFlow 1.4s linear infinite;
    }
  `;
  document.head.appendChild(style);
}

function RoutePolyline({
  from,
  to,
}: {
  from: [number, number];
  to: [number, number];
}) {
  const [routePoints, setRoutePoints] = useState<[number, number][]>([from, to]);
  const abortRef = useRef<AbortController | null>(null);

  // Inject CSS animation once on mount
  useEffect(() => { injectRouteStyles(); }, []);

  const fetchRoute = useCallback(async () => {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${from[1]},${from[0]};${to[1]},${to[0]}` +
      `?overview=full&geometries=geojson&alternatives=3`;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(url, { signal: abortRef.current.signal });
      const data = await res.json();

      if (data?.routes?.length) {
        const shortest = [...data.routes].sort(
          (a: { distance: number }, b: { distance: number }) => a.distance - b.distance
        )[0];

        if (shortest?.geometry?.coordinates) {
          const pts: [number, number][] = shortest.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );
          setRoutePoints(pts);
        }
      }
    } catch {
      // keep straight fallback on error
    }
  }, [from[0], from[1], to[0], to[1]]);

  useEffect(() => {
    fetchRoute();
    return () => abortRef.current?.abort();
  }, [fetchRoute]);

  return (
    <>
      {/* 1. White halo / outline for contrast */}
      <Polyline
        positions={routePoints}
        pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.55, lineCap: "round", lineJoin: "round" }}
      />

      {/* 2. Main glowing green road line */}
      <Polyline
        positions={routePoints}
        className="route-glow"
        pathOptions={{ color: "#16a34a", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round" }}
      />

      {/* 3. Bright flowing dash that travels from driver → customer */}
      <Polyline
        positions={routePoints}
        className="route-flow"
        pathOptions={{ color: "#86efac", weight: 3, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
      />
    </>
  );
}

// Fits the map to show both driver and customer markers
function MapBoundsFitter({ driverPos, customerPos }: { driverPos: [number, number]; customerPos: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds([driverPos, customerPos], { padding: [50, 50], maxZoom: 16 });
  }, [driverPos[0], driverPos[1], customerPos[0], customerPos[1]]);
  return null;
}

const destinationIcon = L.divIcon({
  html: `
    <div style="position:relative;width:48px;height:56px;display:flex;flex-direction:column;align-items:center;">
      <!-- Pin body -->
      <div style="
        width:44px;height:44px;
        background:linear-gradient(135deg,#16a34a,#15803d);
        border-radius:50% 50% 50% 4px;
        transform:rotate(45deg);
        box-shadow:0 4px 16px rgba(22,163,74,0.45),0 2px 6px rgba(0,0,0,0.25);
        border:2.5px solid #fff;
        display:flex;align-items:center;justify-content:center;
      ">
        <!-- Inner white circle -->
        <div style="
          transform:rotate(-45deg);
          width:28px;height:28px;
          background:#fff;
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
        ">
          <!-- House SVG -->
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
      </div>
      <!-- Pin tail shadow -->
      <div style="
        width:10px;height:10px;
        background:rgba(0,0,0,0.15);
        border-radius:50%;
        margin-top:-4px;
        filter:blur(3px);
      "></div>
    </div>`,
  className: "",
  iconSize: [48, 56],
  iconAnchor: [24, 54],
});

// Arrival Window Component — updates every 30 s so the clock stays accurate
const ArrivalWindow = ({ estimatedMinutes }: { estimatedMinutes: number }) => {
  const [now, setNow] = useState(new Date());

  // Tick every 30 seconds so displayed times don't go stale
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = addMinutes(now, Math.max(0, estimatedMinutes - 5));
  const end   = addMinutes(now, estimatedMinutes + 5);

  return (
    <div className="bg-primary/10 rounded-xl p-4 text-center space-y-1">
      {/* Live pulse header */}
      <div className="flex items-center justify-center gap-2 mb-1">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">Live ETA</p>
      </div>

      <p className="text-sm text-muted-foreground">Arriving between</p>
      <p className="text-2xl font-bold text-foreground">
        {format(start, 'h:mm')} – {format(end, 'h:mm a')}
      </p>
      <p className="text-sm text-muted-foreground">
        ~{estimatedMinutes} min away
      </p>
    </div>
  );
};

// Contact Section Component
interface ContactSectionProps {
  restaurantPhone?: string | null;
  restaurantAddress?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  isOnTheWay?: boolean;
}

const ContactSection = ({ restaurantPhone, restaurantAddress, driverName, driverPhone, isOnTheWay }: ContactSectionProps) => (
  <div className="pt-4 border-t border-border space-y-3">
    {restaurantAddress && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{restaurantAddress}</span>
      </div>
    )}
    
    {/* Driver Info Card - Show when order is on the way */}
    {isOnTheWay && driverName && (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
          <Truck className="w-5 h-5 text-green-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800">Your Driver</p>
          <p className="text-xs text-green-600">{driverName}</p>
        </div>
      </div>
    )}
    
    <div className="flex gap-2">
      {isOnTheWay ? (
        driverPhone ? (
          <Button variant="default" className="flex-1 bg-green-600 hover:bg-green-700" asChild>
            <a href={`tel:${driverPhone}`}>
              <Phone className="h-4 w-4 mr-2" />
              Call Driver{driverName ? ` · ${driverName}` : ""}
            </a>
          </Button>
        ) : (
          <Button variant="default" className="flex-1 bg-green-600/60 cursor-not-allowed" disabled>
            <Phone className="h-4 w-4 mr-2" />
            Call Driver{driverName ? ` · ${driverName}` : ""}
          </Button>
        )
      ) : (
        restaurantPhone && (
          <Button variant="outline" className="flex-1" asChild>
            <a href={`tel:${restaurantPhone}`}>
              <Phone className="h-4 w-4 mr-2" /> Call Restaurant
            </a>
          </Button>
        )
      )}
    </div>
  </div>
);

export default function DeliveryTracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerLocation, setCustomerLocation] = useState<[number, number] | null>(null);
  const locationChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const orderUpdateChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch customer's default delivery address and geocode it
  useEffect(() => {
    if (!user) return;

    const loadCustomerLocation = async () => {
      try {
        // 1. Try browser geolocation first (most accurate, no CORS issues)
        if (navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { 
                enableHighAccuracy: true, 
                timeout: 5000,
                maximumAge: 300000 // 5 minutes cache
              });
            });
            setCustomerLocation([position.coords.latitude, position.coords.longitude]);
            return;
          } catch {
            // Geolocation denied or unavailable, continue to address lookup
          }
        }

        // 2. Try to geocode saved default address using a CORS proxy
        const { data: addresses } = await supabase
          .from("user_addresses")
          .select("address_line1, city, state, country, postal_code")
          .eq("user_id", user.id)
          .eq("is_default", true)
          .limit(1);

        if (addresses && addresses.length > 0) {
          const addr = addresses[0];
          const city = addr.city?.trim() || "";
          const street = addr.address_line1?.trim() || "";
          const country = addr.country?.toLowerCase() === "united states" ? "Qatar" : (addr.country || "Qatar");

          // Build query string
          const query = [street, city, country].filter(Boolean).join(", ");
          
          if (query) {
            try {
              // Use a CORS proxy service (allorigins.win is a free public proxy)
              const res = await fetch(
                `https://api.allorigins.win/raw?url=${encodeURIComponent(
                  `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=qa`
                )}`,
                { 
                  headers: { 
                    "Accept-Language": "en",
                    "User-Agent": "NutrioFuel/1.0"
                  } 
                }
              );
              const data = await res.json();
              if (data && data.length > 0) {
                setCustomerLocation([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
                return;
              }
            } catch {
              // Geocoding failed, use default location
            }
          }
        }

        // 3. Fallback to Doha, Qatar (default)
        setCustomerLocation([25.2854, 51.5310]);
      } catch {
        // Error loading customer location, use default
        setCustomerLocation([25.2854, 51.5310]);
      }
    };

    loadCustomerLocation();
  }, [user]);

  const fetchActiveOrders = async () => {
    if (!user) return;

    try {
      // Fetch meal schedules with meal_id
      const { data: schedules, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          order_status,
          meal_id,
          addons_total,
          delivery_fee,
          delivery_type
        `)
        .eq("user_id", user.id)
        .in("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"] as const)
        .order("scheduled_date", { ascending: true })
        .limit(10);

      if (schedulesError) throw schedulesError;
      
      if (!schedules || schedules.length === 0) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Type cast the schedules data
      const typedSchedules = schedules as MealSchedule[];

      // Get unique meal IDs
      const mealIds = [...new Set(typedSchedules.map(s => s.meal_id).filter(Boolean))];

      // Fetch meals with restaurant data
      let mealsData: Meal[] = [];
      if (mealIds.length > 0) {
        const { data: meals, error: mealsError } = await supabase
          .from("meals")
          .select(`
            id,
            name,
            image_url,
            restaurant_id
          `)
          .in("id", mealIds);

        if (!mealsError && meals) {
          // Get unique restaurant IDs
          const restaurantIds = [...new Set(meals.map((m: { restaurant_id: string | null }) => m.restaurant_id).filter(Boolean))] as string[];

          // Fetch restaurants
          let restaurantsData: { 
            id: string; 
            name: string; 
            phone: string | null; 
            address: string | null;
          }[] = [];
          if (restaurantIds.length > 0) {
            const { data: restaurants, error: restaurantsError } = await supabase
              .from("restaurants")
              .select("id, name, phone, address")
              .in("id", restaurantIds);

            if (!restaurantsError && restaurants) {
              restaurantsData = restaurants;
            }
          }

          // Merge meals with restaurant data
          mealsData = meals.map((meal: { id: string; name: string; image_url: string | null; restaurant_id: string | null }) => ({
            ...meal,
            restaurant: restaurantsData.find(r => r.id === meal.restaurant_id) || { 
              name: "Restaurant", 
              phone: null, 
              address: null,
            }
          }));
        }
      }

      // Fetch delivery jobs for these schedules
      const scheduleIds = typedSchedules.map(s => s.id);
      const { data: deliveryJobs, error: jobsError } = await supabase
        .from("delivery_jobs")
        .select(`
          id,
          schedule_id,
          driver_id,
          status,
          picked_up_at,
          delivered_at,
          delivery_lat,
          delivery_lng,
          driver:driver_id(
            current_lat,
            current_lng,
            full_name,
            phone_number
          )
        `)
        .in("schedule_id", scheduleIds);

      if (jobsError) {
        console.error("Error fetching delivery jobs:", jobsError);
      }

      // Build orders with joined data
      const activeOrders: ActiveOrder[] = typedSchedules.map((schedule) => {
        const meal = mealsData.find(m => m.id === schedule.meal_id);
        const deliveryJob = deliveryJobs?.find((job: { schedule_id: string }) => job.schedule_id === schedule.id);
        
        return {
          id: schedule.id,
          order_status: schedule.order_status,
          scheduled_date: schedule.scheduled_date,
          meal_name: meal?.name || "Meal",
          meal_image: meal?.image_url || null,
          restaurant_name: meal?.restaurant?.name || "Restaurant",
          restaurant_phone: meal?.restaurant?.phone || null,
          restaurant_address: meal?.restaurant?.address || null,
          total_amount: (schedule.addons_total || 0),
          delivery_type: schedule.delivery_type || "delivery",
          delivery_job: deliveryJob || null,
          driver_name: deliveryJob?.driver?.full_name || null,
          driver_phone: deliveryJob?.driver?.phone_number || null,
        };
      });

      setOrders(activeOrders);

      // Stop tracking if no orders are out for delivery any more
      const ordersWithDrivers = activeOrders.filter(o => o.delivery_job?.driver_id && o.order_status === "out_for_delivery");
      if (ordersWithDrivers.length === 0 && locationChannelRef.current) {
        locationChannelRef.current.unsubscribe();
        locationChannelRef.current = null;
      }
      if (ordersWithDrivers.length > 0) {
        const driverIds = ordersWithDrivers.map(o => o.delivery_job!.driver_id!);
        
        locationChannelRef.current = supabase
          .channel('driver-locations-tracking')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'driver_locations',
            },
            (payload) => {
              const location = payload.new as { 
                driver_id: string; 
                location: { coordinates: [number, number] } | { lat: number; lng: number } | any;
                lat?: number;
                lng?: number;
                heading?: number;
                speed_kmh?: number;
              };
              
              if (driverIds.includes(location.driver_id)) {
                // Extract lat/lng from PostGIS geometry or direct fields
                let lat: number | null = null;
                let lng: number | null = null;
                
                // Handle different location formats
                if (location.location && typeof location.location === 'object') {
                  if (location.location.coordinates && Array.isArray(location.location.coordinates)) {
                    // PostGIS geometry format: [lng, lat]
                    lng = location.location.coordinates[0];
                    lat = location.location.coordinates[1];
                  } else if ('lat' in location.location && 'lng' in location.location) {
                    // Direct lat/lng object
                    lat = location.location.lat;
                    lng = location.location.lng;
                  }
                }
                
                // Fallback to direct fields if available
                if (lat === null && location.lat !== undefined) lat = location.lat;
                if (lng === null && location.lng !== undefined) lng = location.lng;
                
                if (lat !== null && lng !== null) {
                  // Update the order with new driver location
                  setOrders(prevOrders => 
                    prevOrders.map(order => {
                      if (order.delivery_job?.driver_id === location.driver_id) {
                        return {
                          ...order,
                          delivery_job: {
                            ...order.delivery_job!,
                            driver: {
                              ...order.delivery_job!.driver!,
                              current_lat: lat!,
                              current_lng: lng!,
                            }
                          }
                        };
                      }
                      return order;
                    })
                  );
                }
              }
            }
          )
          .subscribe();
      }
    } catch (err) {
      console.error("Error fetching active orders:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActiveOrders();

    // Set up realtime subscription for order updates
    const channel = supabase
      .channel('meal-schedule-tracking')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meal_schedules',
          filter: `user_id=eq.${user?.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as { order_status: string }).order_status;
          const oldStatus = (payload.old as { order_status: string }).order_status;
          
          // Show toast notification when status changes
          if (newStatus !== oldStatus) {
            const statusMessages: Record<string, string> = {
              confirmed: 'Your order has been confirmed!',
              preparing: 'Your meal is being prepared',
              ready: 'Your meal is ready for pickup',
              out_for_delivery: 'Your driver is on the way!',
              delivered: 'Your meal has been delivered!',
            };
            
            if (statusMessages[newStatus]) {
              toast.success(statusMessages[newStatus]);
            }
          }
          
          fetchActiveOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (locationChannelRef.current) {
        locationChannelRef.current.unsubscribe();
      }
      if (orderUpdateChannelRef.current) {
        orderUpdateChannelRef.current.unsubscribe();
      }
    };
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveOrders();
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM dd");
  };

  const openGoogleMaps = (lat: number, lng: number, label: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${encodeURIComponent(label)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-6 w-40" />
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-6 space-y-4">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-96 w-full rounded-xl" />
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
                className="rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">Track Orders</h1>
                <p className="text-sm text-muted-foreground">
                  {orders.length} active order{orders.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-full"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {orders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No Active Orders</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any orders being prepared or delivered right now.
              </p>
              <Button onClick={() => navigate('/meals')}>
                Browse Meals
              </Button>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => {
            const status = order.order_status || "pending";
            const currentStepIndex = getCurrentStepIndex(status);
            const config = statusConfig[status];
            const estimatedTime = getEstimatedTime(status, order.scheduled_date);
            
            // Stop tracking once delivered
            const isDelivered = status === "delivered" || status === "completed";

            // Show map only when driver is on the way
            const showMap = !!customerLocation && order.order_status === "out_for_delivery";

            // Driver location (only available when out_for_delivery)
            const hasDriverLocation = order.order_status === "out_for_delivery" &&
              order.delivery_job?.driver?.current_lat &&
              order.delivery_job?.driver?.current_lng;

            // Map centers on driver when tracking, otherwise on customer's home
            const mapCenter = hasDriverLocation
              ? { lat: order.delivery_job!.driver!.current_lat!, lng: order.delivery_job!.driver!.current_lng! }
              : customerLocation
              ? { lat: customerLocation[0], lng: customerLocation[1] }
              : { lat: 25.2854, lng: 51.5310 };

            return (
              <Card key={order.id} className="group overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white rounded-3xl">
                {/* Top gradient border */}
                <div className="h-1.5 bg-gradient-to-r from-green-400 via-lime-400 to-green-500" />

                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Status Badge and Date */}
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          className={`${config.badgeClass} ${config.textClass} font-bold text-xs px-4 py-1.5 rounded-full border-0 shadow-sm flex items-center gap-1.5`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {config.shortLabel}
                        </Badge>
                        <span className="text-sm text-muted-foreground font-medium">
                          est. {getDateLabel(order.scheduled_date)}
                        </span>
                      </div>
                      <CardTitle className="text-2xl font-bold text-slate-900 truncate">
                        {order.restaurant_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    {/* Clock Icon Button */}
                    <div className="w-12 h-12 rounded-full bg-green-700 flex items-center justify-center shadow-lg flex-shrink-0">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* ── Delivered celebration — replaces all tracking UI ── */}
                  {isDelivered ? (
                    <div className="flex flex-col items-center text-center py-6 space-y-4">
                      {/* Animated checkmark ring */}
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-24 h-24 rounded-full bg-green-100 animate-ping opacity-40" />
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-xl shadow-green-400/40">
                          <CheckCircle2 className="w-10 h-10 text-white" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-green-700">Your meal has been delivered! 🎉</h3>
                        <p className="text-sm text-muted-foreground mt-1">Enjoy your meal. Tracking has stopped.</p>
                      </div>
                      <Button
                        className="rounded-2xl px-6 shadow-sm shadow-primary/20"
                        onClick={() => navigate("/orders")}
                      >
                        View Order History
                      </Button>
                    </div>
                  ) : (
                  <>
                  {/* Estimated Time / Arrival Window */}
                  {order.order_status === "out_for_delivery" ? (
                    <ArrivalWindow
                      estimatedMinutes={
                        order.delivery_job?.driver?.current_lat &&
                        order.delivery_job?.driver?.current_lng &&
                        customerLocation
                          ? calculateEtaMinutes(
                              order.delivery_job.driver.current_lat,
                              order.delivery_job.driver.current_lng,
                              customerLocation[0],
                              customerLocation[1]
                            )
                          : 20
                      }
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50">
                      <Clock className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-sm text-foreground">Estimated Delivery</p>
                        <p className="font-semibold text-green-600">{estimatedTime}</p>
                      </div>
                    </div>
                  )}

                  {/* Delivery Map — always shown when customer location is known */}
                  {showMap && customerLocation && (
                    <div className="rounded-xl overflow-hidden border-2 border-green-500/20">
                      <div className="bg-green-50 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium">
                            {hasDriverLocation ? "Live Tracking" : "Delivery Location"}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openGoogleMaps(
                            customerLocation[0],
                            customerLocation[1],
                            "Your Delivery Location"
                          )}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open in Maps
                        </Button>
                      </div>
                      <MapContainer
                        center={[mapCenter.lat, mapCenter.lng]}
                        zoom={hasDriverLocation ? 15 : 16}
                        style={{ height: "250px", width: "100%" }}
                        scrollWheelZoom={false}
                      >
                        {/* Customer home pin — always shown */}
                        <Marker
                          position={customerLocation}
                          icon={destinationIcon}
                        />

                        {/* Driver pin + route line + bounds fit — only when out for delivery */}
                        {hasDriverLocation && (
                          <>
                            {/* Road-following route between driver and customer */}
                            <RoutePolyline
                              from={[order.delivery_job!.driver!.current_lat!, order.delivery_job!.driver!.current_lng!]}
                              to={customerLocation}
                            />
                            <DriverMarker
                              position={{
                                lat: order.delivery_job!.driver!.current_lat!,
                                lng: order.delivery_job!.driver!.current_lng!,
                              }}
                              driverName="Driver"
                              eta={`${calculateEtaMinutes(
                                order.delivery_job!.driver!.current_lat!,
                                order.delivery_job!.driver!.current_lng!,
                                customerLocation[0],
                                customerLocation[1]
                              )} min`}
                            />
                            <MapBoundsFitter
                              driverPos={[
                                order.delivery_job!.driver!.current_lat!,
                                order.delivery_job!.driver!.current_lng!,
                              ]}
                              customerPos={customerLocation}
                            />
                          </>
                        )}
                      </MapContainer>
                    </div>
                  )}

                  {/* Progress Timeline - Straight line with 5 steps */}
                  <div className="mt-8 mb-4">
                    <div className="relative px-2">
                      {/* Background Line */}
                      <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-200" />
                      
                      {/* Active Progress Line */}
                      <motion.div 
                        className="absolute top-5 left-8 h-0.5 bg-green-500"
                        initial={{ width: "0%" }}
                        animate={{ 
                          width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` 
                        }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        style={{ 
                          right: 'auto',
                          maxWidth: 'calc(100% - 64px)'
                        }}
                      />
                      
                      {/* Steps */}
                      <div className="relative flex justify-between">
                        {statusSteps.map((step, stepIndex) => {
                          const isCompleted = stepIndex < currentStepIndex;
                          const isCurrent = stepIndex === currentStepIndex;

                          return (
                            <div 
                              key={step.status}
                              className="flex flex-col items-center"
                              style={{ width: `${100 / statusSteps.length}%` }}
                            >
                              {/* Step Circle */}
                              <motion.div
                                className={`
                                  relative w-10 h-10 rounded-full flex items-center justify-center
                                  transition-all duration-300 z-10
                                  ${isCompleted 
                                    ? 'bg-green-600 text-white shadow-md' 
                                    : isCurrent
                                      ? 'bg-white text-green-600 shadow-lg ring-2 ring-green-400'
                                      : 'bg-white text-slate-300 border-2 border-slate-200'
                                  }
                                `}
                                animate={isCurrent ? {
                                  scale: [1, 1.05, 1],
                                } : {}}
                                transition={isCurrent ? {
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                } : {}}
                              >
                                {isCurrent ? (
                                  <div className="relative">
                                    {/* Glow effect */}
                                    <motion.div
                                      className="absolute inset-0 rounded-full bg-green-400 blur-md"
                                      animate={{
                                        scale: [1.2, 1.5, 1.2],
                                        opacity: [0.6, 0.3, 0.6],
                                      }}
                                      transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                      }}
                                    />
                                    <motion.div
                                      className="absolute inset-0 rounded-full bg-lime-300 blur-sm"
                                      animate={{
                                        scale: [1, 1.3, 1],
                                        opacity: [0.8, 0.4, 0.8],
                                      }}
                                      transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                      }}
                                    />
                                    <motion.img 
                                      src={flameLogo} 
                                      alt="NutrioFuel" 
                                      className="w-7 h-7 object-contain relative z-10"
                                      animate={{
                                        scale: [1, 1.1, 1],
                                        rotate: [0, 5, -5, 0],
                                      }}
                                      transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: "easeInOut"
                                      }}
                                    />
                                  </div>
                                ) : isCompleted ? (
                                  <Check className="w-5 h-5" />
                                ) : (
                                  <div className="w-2 h-2 rounded-full bg-slate-300" />
                                )}
                              </motion.div>
                              
                              {/* Step Label */}
                              <span className={`
                                text-[11px] mt-2 font-semibold text-center whitespace-nowrap
                                ${isCompleted || isCurrent ? 'text-slate-700' : 'text-slate-400'}
                                ${isCurrent ? 'font-bold' : ''}
                              `}>
                                {step.label}
                              </span>
                              
                              {/* Step Sublabel (only for current) */}
                              {isCurrent && step.sublabel && (
                                <span className="text-[10px] text-slate-500 mt-0.5 font-medium whitespace-nowrap">
                                  {step.sublabel}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">Order Items</p>
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                      {order.meal_image ? (
                        <img 
                          src={order.meal_image} 
                          alt={order.meal_name}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                          <ChefHat className="h-6 w-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm flex items-center">
                          <span className="text-slate-400 mr-2">•</span>
                          <FoodEmoji />
                          {order.meal_name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatCurrency(order.total_amount)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Section */}
                  <ContactSection
                    restaurantPhone={order.restaurant_phone}
                    restaurantAddress={order.restaurant_address}
                    driverName={order.driver_name}
                    driverPhone={order.driver_phone}
                    isOnTheWay={order.order_status === "out_for_delivery"}
                  />
                  </> // end non-delivered tracking UI
                  )} {/* end isDelivered ternary */}
                </CardContent>
              </Card>
            );
          })
        )}

        {/* View Past Orders Link */}
        {orders.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/orders')}
          >
            View Order History
          </Button>
        )}
      </main>
    </div>
  );
}
