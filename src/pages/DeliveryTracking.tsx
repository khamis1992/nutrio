import { useEffect, useState, useRef, Suspense, lazy } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isTomorrow, addMinutes } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
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
} from "lucide-react";

// Lazy load map components
const MapContainer = lazy(() => import("@/components/maps/MapContainer"));
const DriverMarker = lazy(() => import("@/components/maps/DriverMarker"));

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
  driver?: {
    current_lat: number | null;
    current_lng: number | null;
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
}

const statusSteps: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "pending", label: "Order Placed", icon: Package },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { status: "preparing", label: "Preparing", icon: ChefHat },
  { status: "ready", label: "Ready", icon: Package },
  { status: "out_for_delivery", label: "On the Way", icon: Truck },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
];

const statusConfig: Record<OrderStatus, {
  label: string;
  color: string;
  bgColor: string;
  gradient: string;
}> = {
  pending: {
    label: "Pending",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    gradient: "from-amber-400 to-orange-500",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    gradient: "from-blue-400 to-indigo-500",
  },
  preparing: {
    label: "Preparing",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    gradient: "from-purple-400 to-pink-500",
  },
  ready: {
    label: "Ready",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    gradient: "from-cyan-400 to-teal-500",
  },
  out_for_delivery: {
    label: "On the Way",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    gradient: "from-orange-400 to-red-500",
  },
  delivered: {
    label: "Delivered",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    gradient: "from-emerald-400 to-green-500",
  },
  completed: {
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-50",
    gradient: "from-green-400 to-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-50",
    gradient: "from-red-400 to-rose-500",
  },
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

// Arrival Window Component
const ArrivalWindow = ({ estimatedMinutes }: { estimatedMinutes: number }) => {
  const start = addMinutes(new Date(), estimatedMinutes - 5);
  const end = addMinutes(new Date(), estimatedMinutes + 5);
  
  return (
    <div className="bg-primary/10 rounded-lg p-4 text-center">
      <p className="text-sm text-muted-foreground">Arriving between</p>
      <p className="text-2xl font-bold">
        {format(start, 'h:mm')} - {format(end, 'h:mm a')}
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        (~{estimatedMinutes} minutes)
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
}

const ContactSection = ({ restaurantPhone, restaurantAddress, driverName, driverPhone }: ContactSectionProps) => (
  <div className="pt-4 border-t border-border space-y-3">
    {restaurantAddress && (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{restaurantAddress}</span>
      </div>
    )}
    <div className="flex gap-2">
      {driverPhone && (
        <Button variant="outline" className="flex-1" asChild>
          <a href={`tel:${driverPhone}`}>
            <Phone className="h-4 w-4 mr-2" /> Call Driver
          </a>
        </Button>
      )}
      {restaurantPhone && (
        <Button variant="outline" className="flex-1" asChild>
          <a href={`tel:${restaurantPhone}`}>
            <Phone className="h-4 w-4 mr-2" /> Call Restaurant
          </a>
        </Button>
      )}
    </div>
  </div>
);

export default function DeliveryTracking() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const locationChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const orderUpdateChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const selectedOrderId = searchParams.get('id');

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
          driver:driver_id(
            current_lat,
            current_lng
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
        };
      });

      setOrders(activeOrders);

      // Subscribe to driver location updates for orders with assigned drivers
      const ordersWithDrivers = activeOrders.filter(o => o.delivery_job?.driver_id && o.order_status === "out_for_delivery");
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
              const location = payload.new as { driver_id: string; lat: number; lng: number };
              if (driverIds.includes(location.driver_id)) {
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
                            current_lat: location.lat,
                            current_lng: location.lng,
                          }
                        }
                      };
                    }
                    return order;
                  })
                );
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
    <div className="min-h-screen bg-gradient-to-b from-background to-slate-50/50 pb-24">
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
            const progress = ((currentStepIndex + 1) / statusSteps.length) * 100;
            
            // Show map if order is out for delivery and we have driver location
            const showMap = order.order_status === "out_for_delivery" && 
                           order.delivery_job?.driver?.current_lat && 
                           order.delivery_job?.driver?.current_lng;
            
            // Calculate map center - only show driver location for now
            // Restaurant/customer locations are not stored in the database
            const mapCenter = showMap 
              ? { lat: order.delivery_job!.driver!.current_lat!, lng: order.delivery_job!.driver!.current_lng! }
              : { lat: 25.2854, lng: 51.5310 }; // Doha default

            return (
              <Card key={order.id} className={`group overflow-hidden border-0 shadow-lg ${config.bgColor}`}>
                {/* Top progress bar */}
                <div className="relative h-1.5 bg-slate-100 overflow-hidden">
                  <div 
                    className={`absolute inset-y-0 left-0 bg-gradient-to-r ${config.gradient}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="outline"
                          className={`text-xs font-medium px-2.5 py-1 ${config.color} border-current bg-white/80 backdrop-blur-sm`}
                        >
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getDateLabel(order.scheduled_date)}
                        </span>
                      </div>
                      <CardTitle className="text-lg truncate">
                        {order.restaurant_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <div 
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}
                    >
                      {(() => {
                        const CurrentIcon = statusSteps[currentStepIndex]?.icon;
                        return CurrentIcon ? <CurrentIcon className="w-7 h-7 text-white" /> : null;
                      })()}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Estimated Time / Arrival Window */}
                  {order.order_status === "out_for_delivery" ? (
                    <ArrivalWindow estimatedMinutes={20} />
                  ) : (
                    <div className={`flex items-center gap-3 p-4 rounded-xl ${config.bgColor}`}>
                      <Clock className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <p className="font-medium text-sm text-foreground">Estimated Delivery</p>
                        <p className={`font-semibold ${config.color}`}>{estimatedTime}</p>
                      </div>
                    </div>
                  )}

                  {/* Live Map */}
                  {showMap && (
                    <div className="rounded-xl overflow-hidden border-2 border-primary/20">
                      <div className="bg-primary/5 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Live Location</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openGoogleMaps(
                            order.delivery_job!.driver!.current_lat!,
                            order.delivery_job!.driver!.current_lng!,
                            "Driver Location"
                          )}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open in Maps
                        </Button>
                      </div>
                      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                        <MapContainer
                          center={[mapCenter.lat, mapCenter.lng]}
                          zoom={15}
                          style={{ height: "250px", width: "100%" }}
                          scrollWheelZoom={false}
                        >
                          <DriverMarker
                            position={{ 
                              lat: order.delivery_job!.driver!.current_lat!,
                              lng: order.delivery_job!.driver!.current_lng!
                            }}
                            driverName="Driver"
                          />
                        </MapContainer>
                      </Suspense>
                    </div>
                  )}

                  {/* Progress Timeline */}
                  <div className="relative mt-6 mb-4">
                    {/* Connecting line */}
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200">
                      <div 
                        className={`h-full bg-gradient-to-r ${config.gradient}`}
                        style={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }}
                      />
                    </div>

                    {/* Steps */}
                    <div className="relative flex justify-between">
                      {statusSteps.map((step, stepIndex) => {
                        const isCompleted = stepIndex <= currentStepIndex;
                        const isCurrent = stepIndex === currentStepIndex;
                        const StepIcon = step.icon;

                        return (
                          <div 
                            key={step.status}
                            className="flex flex-col items-center"
                          >
                            <div
                              className={`
                                relative w-8 h-8 rounded-full flex items-center justify-center
                                transition-all duration-300 border-2
                                ${isCompleted 
                                  ? `bg-gradient-to-br ${config.gradient} border-transparent text-white shadow-md` 
                                  : 'bg-white border-slate-200 text-slate-300'
                                }
                                ${isCurrent ? `scale-110 shadow-lg ring-4 ${config.bgColor}` : ''}
                              `}
                            >
                              <StepIcon className="w-4 h-4" />
                            </div>
                            <span className={`
                              text-[10px] mt-1.5 font-medium transition-colors duration-300 text-center max-w-[60px]
                              ${isCompleted ? config.color : 'text-slate-300'}
                              ${isCurrent ? 'font-semibold' : ''}
                            `}>
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
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
                        <p className="font-medium text-sm truncate">
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
                    driverName={null}
                    driverPhone={null}
                  />


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
