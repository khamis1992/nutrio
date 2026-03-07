import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { 
  ArrowLeft, 
  Clock,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Loader2,
  CheckCircle2,
  XCircle,
  Truck,
  ChefHat,
  CircleDot,
  MapPin,
  Store,
  UtensilsCrossed,
  Phone,
  Package,
  CheckCheck,
  X,
  Box,
  ChevronRight,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

interface ScheduleAddon {
  id: string;
  addon_id: string;
  quantity: number;
  unit_price: number;
  addon: {
    name: string;
    category: string;
  };
}

interface RawScheduleAddon {
  id: string;
  addon_id: string;
  quantity: number;
  unit_price: number;
  addon: {
    name: string;
    category: string;
  };
}

type OrderStatus = 
  | "pending" 
  | "confirmed" 
  | "preparing" 
  | "ready" 
  | "out_for_delivery" 
  | "delivered" 
  | "completed" 
  | "cancelled";

interface ScheduledMealDetail {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: OrderStatus;
  created_at: string;
  delivery_type: string | null;
  delivery_fee: number | null;
  addons_total: number | null;
  addons: ScheduleAddon[];
  meal: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number | null;
    prep_time_minutes: number | null;
    restaurant: {
      id: string;
      name: string;
      logo_url: string | null;
      address: string | null;
      phone: string | null;
    } | null;
    diet_tags: { name: string }[];
  } | null;
}

const statusSteps: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Order Confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: Box },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCheck },
];

const getStatusIndex = (status: OrderStatus) => {
  const index = statusSteps.findIndex(s => s.key === status);
  return index === -1 ? 0 : index;
};

const getEstimatedArrival = (status: OrderStatus, scheduledDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduleDate = new Date(scheduledDate);
  
  if (!isToday(scheduleDate) && !isTomorrow(scheduleDate)) {
    return format(scheduleDate, "MMM d");
  }
  
  const now = new Date();
  let estimatedTime: Date;
  
  switch (status) {
    case 'pending':
    case 'confirmed':
      estimatedTime = new Date(now.getTime() + 45 * 60000); // +45 min
      break;
    case 'preparing':
      estimatedTime = new Date(now.getTime() + 25 * 60000); // +25 min
      break;
    case 'ready':
      estimatedTime = new Date(now.getTime() + 15 * 60000); // +15 min
      break;
    case 'out_for_delivery':
      estimatedTime = new Date(now.getTime() + 10 * 60000); // +10 min
      break;
    case 'delivered':
    case 'completed':
      return "Delivered";
    default:
      estimatedTime = new Date(now.getTime() + 45 * 60000);
  }
  
  return format(estimatedTime, "h:mm a");
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
const [order, setOrder] = useState<ScheduledMealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [driverPhone, setDriverPhone] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user && id) {
      fetchOrderDetail();
    }
  }, [user, id]);

  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`order-detail-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meal_schedules',
          filter: `id=eq.${id}`,
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
              completed: 'Order completed. Enjoy your meal!',
              cancelled: 'Your order has been cancelled',
            };
            
            if (statusMessages[newStatus]) {
              toast.success(statusMessages[newStatus]);
            }
          }
          
          setOrder((prev) => prev ? {
            ...prev,
            order_status: payload.new.order_status,
            is_completed: payload.new.is_completed,
          } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, toast]);

  // Fetch driver info when the order is out for delivery
  useEffect(() => {
    if (!id || order?.order_status !== "out_for_delivery") return;

    const fetchDriver = async () => {
      try {
        // Fetch any delivery job for this schedule (regardless of job status)
        const { data } = await supabase
          .from("delivery_jobs")
          .select("drivers(full_name, phone_number)")
          .eq("schedule_id", id)
          .not("driver_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const driver = (data as any)?.drivers;
        // Always set driver name; phone may be null (shown as disabled button)
        if (driver) {
          setDriverName(driver.full_name || null);
          setDriverPhone(driver.phone_number || null);
        }
      } catch {
        // best-effort — silently ignore
      }
    };

    fetchDriver();
  }, [id, order?.order_status]);

  const fetchOrderDetail = async () => {
    if (!user || !id) return;

    try {
      const { data, error } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          meal_id,
          delivery_type,
          delivery_fee,
          addons_total
        `)
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      const { data: mealData, error: mealError } = await supabase
        .from("meals")
        .select(`
          id,
          name,
          description,
          image_url,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          fiber_g,
          prep_time_minutes,
          restaurant:restaurants (
            id,
            name,
            logo_url,
            address,
            phone
          ),
          meal_diet_tags (
            diet_tags (name)
          )
        `)
        .eq("id", data.meal_id)
        .single();

      if (mealError) throw mealError;

      const { data: addonsData } = await supabase
        .from("schedule_addons")
        .select(`
          id,
          addon_id,
          quantity,
          unit_price,
          addon:meal_addons (name, category)
        `)
        .eq("schedule_id", data.id);

      const transformed: ScheduledMealDetail = {
        id: data.id,
        scheduled_date: data.scheduled_date,
        meal_type: data.meal_type,
        is_completed: !!data.is_completed,
        order_status: (data.order_status || "pending") as OrderStatus,
        created_at: data.created_at,
        delivery_type: data.delivery_type,
        delivery_fee: data.delivery_fee,
        addons_total: data.addons_total || 0,
        addons: (addonsData || []).map((a: RawScheduleAddon) => ({
          id: a.id,
          addon_id: a.addon_id,
          quantity: a.quantity,
          unit_price: a.unit_price,
          addon: a.addon,
        })),
        meal: mealData ? {
          ...mealData,
          diet_tags: mealData.meal_diet_tags?.map((mdt: any) => mdt.diet_tags).filter(Boolean) || [],
        } : null,
      };

      setOrder(transformed);
    } catch (error) {
      console.error("Error fetching order detail:", error);
      navigate("/orders");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: OrderStatus) => {
    if (!order || !id) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("meal_schedules")
        .update({ order_status: newStatus })
        .eq("id", id);

      if (error) throw error;
      setOrder((prev) => prev ? { ...prev, order_status: newStatus } : null);
    } catch (error: any) {
      console.error("Error updating order:", error);
      alert(error.message || "Failed to update order");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!order || !id) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setUpdating(true);
    try {
      const { data, error } = await supabase.rpc("cancel_meal_schedule", {
        p_schedule_id: id,
      });
      
      // Handle specific error for "preparing" status
      if (error) {
        const errorMessage = error.message || "";
        if (errorMessage.includes('preparing')) {
          setUpdating(false);
          toast({
            title: "Cannot Cancel Order",
            description: "Your order is already being prepared. Please contact the restaurant for assistance.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }
      
      if (!data?.success) throw new Error("Cancellation failed. Please try again.");
      setOrder(prev => prev ? { ...prev, order_status: "cancelled" } : null);
    } catch (err: any) {
      const errorMessage = err.message || "";
      if (errorMessage.includes('preparing')) {
        toast({
          title: "Cannot Cancel Order",
          description: "Your order is already being prepared. Please contact the restaurant for assistance.",
          variant: "destructive",
        });
      } else {
        alert(err.message || "Failed to cancel order");
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const currentStep = getStatusIndex(order.order_status);
  const estimatedArrival = getEstimatedArrival(order.order_status, order.scheduled_date);
  const isCancelled = order.order_status === "cancelled";
  const isCompleted = order.order_status === "completed" || order.order_status === "delivered";
  const canCancel = order.order_status === "pending" || order.order_status === "confirmed";
  const isOutForDelivery = order.order_status === "out_for_delivery";
  const isDelivered = order.order_status === "delivered";

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-white sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 rtl:flex-row-reverse">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/orders")}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5 rtl-flip-back" />
          </Button>
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium">Real-time order tracking</span>
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Restaurant Name */}
        {order.meal?.restaurant && (
          <div className="text-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">{order.meal.restaurant.name}</h1>
            <p className="text-sm text-gray-500 mt-1">Order #{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
        )}

        {/* Arriving Soon Card */}
        {!isCancelled && !isCompleted && (
          <Card className="bg-orange-400 border-orange-400 text-white overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium opacity-90">Arriving soon</p>
                  <p className="text-xl font-bold">{estimatedArrival}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        {!isCancelled && (
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="space-y-0">
                {statusSteps.map((step, index) => {
                  const isCompleted = index <= currentStep;
                  const isCurrent = index === currentStep;
                  const isLast = index === statusSteps.length - 1;

                  return (
                    <div key={step.key} className="flex gap-4">
                      {/* Timeline line and icon */}
                      <div className="flex flex-col items-center">
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCompleted 
                              ? 'bg-orange-400 border-orange-400 text-white' 
                              : 'bg-white border-gray-300 text-gray-400'
                          } ${isCurrent ? 'ring-4 ring-orange-100' : ''}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <CircleDot className="h-4 w-4" />
                          )}
                        </div>
                        {!isLast && (
                          <div 
                            className={`w-0.5 h-12 mt-1 ${
                              index < currentStep ? 'bg-orange-400' : 'bg-gray-200'
                            }`} 
                          />
                        )}
                      </div>

                      {/* Label */}
                      <div className={`pb-8 ${isLast ? '' : ''}`}>
                        <p className={`font-medium ${
                          isCompleted ? 'text-gray-900' : 'text-gray-400'
                        } ${isCurrent ? 'text-orange-600' : ''}`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {index === 0 && "Waiting for restaurant confirmation"}
                            {index === 1 && "Restaurant accepted your order"}
                            {index === 2 && "Chef is preparing your meal"}
                            {index === 3 && "Ready for pickup or delivery"}
                            {index === 4 && "Driver is on the way"}
                            {index === 5 && "Enjoy your meal!"}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancelled Order Message */}
        {isCancelled && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-red-600">Order Cancelled</p>
                  <p className="text-sm text-red-600/70">
                    This order has been cancelled and will not be processed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Food Image Card */}
        {order.meal && (
          <Card className="overflow-hidden">
            <div className="aspect-video relative">
              {order.meal.image_url ? (
                <img 
                  src={order.meal.image_url} 
                  alt={order.meal.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                  <UtensilsCrossed className="h-16 w-16 text-gray-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-bold text-lg">{order.meal.name}</h3>
                {order.meal.diet_tags.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {order.meal.diet_tags.slice(0, 3).map((tag) => (
                      <Badge key={tag.name} variant="secondary" className="bg-white/20 text-white border-0">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <CardContent className="p-4">
              {/* Nutrition Info */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-xl bg-orange-50">
                  <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                  <p className="text-lg font-bold text-gray-900">{order.meal.calories}</p>
                  <p className="text-xs text-gray-500">cal</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-red-50">
                  <Beef className="h-5 w-5 mx-auto mb-1 text-red-500" />
                  <p className="text-lg font-bold text-gray-900">{order.meal.protein_g}g</p>
                  <p className="text-xs text-gray-500">Protein</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-50">
                  <Wheat className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                  <p className="text-lg font-bold text-gray-900">{order.meal.carbs_g}g</p>
                  <p className="text-xs text-gray-500">Carbs</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-50">
                  <Droplets className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                  <p className="text-lg font-bold text-gray-900">{order.meal.fat_g}g</p>
                  <p className="text-xs text-gray-500">Fat</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Section */}
        {order.meal?.restaurant && (
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  {order.meal.restaurant.logo_url ? (
                    <img 
                      src={order.meal.restaurant.logo_url} 
                      alt={order.meal.restaurant.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-orange-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{order.meal.restaurant.name}</p>
                  {order.meal.restaurant.address && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {order.meal.restaurant.address}
                    </p>
                  )}
                </div>
              </div>

              {isOutForDelivery ? (
                driverPhone ? (
                  <a
                    href={`tel:${driverPhone}`}
                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 hover:bg-blue-100 rounded-xl text-blue-700 font-medium transition-colors border border-blue-200"
                  >
                    <Phone className="h-5 w-5" />
                    Call Driver{driverName ? ` · ${driverName}` : ""}
                  </a>
                ) : (
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 rounded-xl text-blue-400 font-medium border border-blue-200 opacity-60 cursor-not-allowed"
                  >
                    <Phone className="h-5 w-5" />
                    Call Driver{driverName ? ` · ${driverName}` : ""}
                  </button>
                )
              ) : order.meal.restaurant.phone ? (
                <a
                  href={`tel:${order.meal.restaurant.phone}`}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  Contact Restaurant
                </a>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Delivery Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Scheduled Delivery</p>
                <p className="text-sm text-gray-500">
                  {format(new Date(order.scheduled_date), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Truck className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Delivery Type</p>
                <p className="text-sm text-gray-500 capitalize">
                  {order.delivery_type === "free" ? "Free Delivery" : `${order.delivery_type || "Standard"} Delivery`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Order Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency((order.addons_total || 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {canCancel && (
          <Button 
            variant="outline" 
            className="w-full h-12 text-red-600 border-red-200 hover:bg-red-50"
            onClick={handleCancelOrder}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <X className="h-4 w-4 mr-2" />
            )}
            Cancel Order
          </Button>
        )}

        {isOutForDelivery && (
          <Button 
            className="w-full h-12 bg-green-600 hover:bg-green-700"
            onClick={() => updateOrderStatus("delivered")}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4 mr-2" />
            )}
            I Received My Order
          </Button>
        )}

        {isDelivered && (
          <Button 
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => updateOrderStatus("completed")}
            disabled={updating}
          >
            {updating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Mark as Completed
          </Button>
        )}

        {/* View Order History Link */}
        <Link to="/orders">
          <Button 
            variant="ghost" 
            className="w-full text-gray-500"
          >
            View All Orders
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      <CustomerNavigation />
    </div>
  );
};

export default OrderDetail;
