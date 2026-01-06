import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { 
  ArrowLeft, 
  Calendar,
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
  Zap,
  DollarSign
} from "lucide-react";
import { format } from "date-fns";

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

interface ScheduledMealDetail {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
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

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { 
    label: "Pending", 
    icon: CircleDot, 
    color: "text-amber-600",
    bgColor: "bg-amber-500/10 border-amber-500/20" 
  },
  confirmed: { 
    label: "Confirmed", 
    icon: CheckCircle2, 
    color: "text-blue-600",
    bgColor: "bg-blue-500/10 border-blue-500/20" 
  },
  preparing: { 
    label: "Preparing", 
    icon: ChefHat, 
    color: "text-purple-600",
    bgColor: "bg-purple-500/10 border-purple-500/20" 
  },
  out_for_delivery: { 
    label: "Out for Delivery", 
    icon: Truck, 
    color: "text-orange-600",
    bgColor: "bg-orange-500/10 border-orange-500/20" 
  },
  delivered: { 
    label: "Delivered", 
    icon: CheckCircle2, 
    color: "text-green-600",
    bgColor: "bg-green-500/10 border-green-500/20" 
  },
  cancelled: { 
    label: "Cancelled", 
    icon: XCircle, 
    color: "text-red-600",
    bgColor: "bg-red-500/10 border-red-500/20" 
  },
};

const statusOrder = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered"];

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<ScheduledMealDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      fetchOrderDetail();
    }
  }, [user, id]);

  // Real-time subscription for status updates
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
  }, [id]);

  const fetchOrderDetail = async () => {
    if (!user || !id) return;

    try {
      // First fetch the meal schedule
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

      // Then fetch meal details with diet tags
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

      // Fetch schedule add-ons
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
        is_completed: data.is_completed,
        order_status: data.order_status || "pending",
        created_at: data.created_at,
        delivery_type: data.delivery_type,
        delivery_fee: data.delivery_fee,
        addons_total: data.addons_total || 0,
        addons: (addonsData || []).map((a: any) => ({
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

  const getStatusInfo = (status: string) => {
    return statusConfig[status] || statusConfig.pending;
  };

  const getCurrentStatusIndex = () => {
    if (!order) return 0;
    if (order.order_status === "cancelled") return -1;
    return statusOrder.indexOf(order.order_status);
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

  const statusInfo = getStatusInfo(order.order_status);
  const StatusIcon = statusInfo.icon;
  const currentStatusIndex = getCurrentStatusIndex();

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/orders")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Order Details</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <Card className={`border ${statusInfo.bgColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusInfo.bgColor}`}>
                <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
              </div>
              <div className="flex-1">
                <h2 className={`font-semibold text-lg ${statusInfo.color}`}>
                  {statusInfo.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {order.order_status === "delivered" 
                    ? "Your order has been delivered!"
                    : order.order_status === "cancelled"
                    ? "This order was cancelled"
                    : "Your order is being processed"
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Timeline */}
        {order.order_status !== "cancelled" && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Order Progress</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center justify-between">
                {statusOrder.map((status, index) => {
                  const config = statusConfig[status];
                  const Icon = config.icon;
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;

                  return (
                    <div key={status} className="flex flex-col items-center flex-1">
                      <div className="relative flex items-center w-full">
                        {index > 0 && (
                          <div 
                            className={`absolute left-0 right-1/2 h-1 -translate-y-1/2 top-1/2 ${
                              index <= currentStatusIndex ? "bg-primary" : "bg-muted"
                            }`} 
                          />
                        )}
                        {index < statusOrder.length - 1 && (
                          <div 
                            className={`absolute left-1/2 right-0 h-1 -translate-y-1/2 top-1/2 ${
                              index < currentStatusIndex ? "bg-primary" : "bg-muted"
                            }`} 
                          />
                        )}
                        <div 
                          className={`relative z-10 mx-auto w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            isCompleted 
                              ? "bg-primary border-primary text-primary-foreground" 
                              : "bg-background border-muted text-muted-foreground"
                          } ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <span className={`text-xs mt-2 text-center ${isCompleted ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {config.label.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meal Info */}
        {order.meal && (
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {order.meal.image_url ? (
                    <img 
                      src={order.meal.image_url} 
                      alt={order.meal.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{order.meal.name}</h3>
                  {order.meal.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                      {order.meal.description}
                    </p>
                  )}
                  {order.meal.diet_tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {order.meal.diet_tags.map((tag) => (
                        <Badge key={tag.name} variant="secondary" className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Nutrition Info */}
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Flame className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                  <p className="text-sm font-semibold">{order.meal.calories}</p>
                  <p className="text-xs text-muted-foreground">kcal</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Beef className="h-4 w-4 mx-auto mb-1 text-red-500" />
                  <p className="text-sm font-semibold">{order.meal.protein_g}g</p>
                  <p className="text-xs text-muted-foreground">Protein</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Wheat className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                  <p className="text-sm font-semibold">{order.meal.carbs_g}g</p>
                  <p className="text-xs text-muted-foreground">Carbs</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <Droplets className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                  <p className="text-sm font-semibold">{order.meal.fat_g}g</p>
                  <p className="text-xs text-muted-foreground">Fat</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Schedule Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Schedule Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Delivery Date</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(order.scheduled_date), "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Meal Type</p>
                <p className="text-sm text-muted-foreground capitalize">{order.meal_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <CircleDot className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Order Placed</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Restaurant Info */}
        {order.meal?.restaurant && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Restaurant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                  {order.meal.restaurant.logo_url ? (
                    <img 
                      src={order.meal.restaurant.logo_url} 
                      alt={order.meal.restaurant.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{order.meal.restaurant.name}</p>
                  {order.meal.restaurant.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {order.meal.restaurant.address}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery & Payment Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Delivery & Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                {order.delivery_type === "express" ? (
                  <Zap className="h-5 w-5 text-primary" />
                ) : (
                  <Truck className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Delivery Type</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {order.delivery_type === "free" ? "Free Delivery" : `${order.delivery_type || "Standard"} Delivery`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Delivery Fee</p>
                <p className="text-sm text-muted-foreground">
                  {order.delivery_fee === 0 || !order.delivery_fee ? "Free" : formatCurrency(order.delivery_fee)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Badge */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-primary">Subscription Order</p>
                <p className="text-sm text-muted-foreground">
                  This meal is included in your subscription plan
                </p>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Included
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <CustomerNavigation />
    </div>
  );
};

export default OrderDetail;
