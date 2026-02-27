import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat,
  Truck,
  Utensils,
  MapPin,
  ChevronRight,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

interface ActiveOrder {
  id: string;
  order_status: OrderStatus;
  scheduled_date: string;
  meal_name: string;
  restaurant_name: string;
  total_amount: number;
  delivery_type: string;
}

interface GroupedRestaurantOrder {
  restaurant_name: string;
  orders: ActiveOrder[];
  meal_count: number;
  meal_names: string[];
  earliest_date: string;
  latest_status: OrderStatus;
  all_statuses: OrderStatus[];
}

interface MealSchedule {
  id: string;
  scheduled_date: string;
  order_status: OrderStatus;
  meal_id: string;
  addons_total: number | null;
  delivery_fee: number | null;
  delivery_type: string | null;
}

interface Meal {
  id: string;
  name: string;
  restaurant_id: string | null;
}

interface Restaurant {
  id: string;
  name: string;
}

// Define the journey steps with their order
const journeySteps: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: "pending", label: "Order Placed", icon: AlertCircle },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { status: "preparing", label: "Preparing", icon: ChefHat },
  { status: "ready", label: "Ready", icon: Package },
  { status: "out_for_delivery", label: "On the Way", icon: Truck },
  { status: "delivered", label: "Delivered", icon: MapPin },
];

const statusConfig: Record<OrderStatus, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  gradient: string;
  glowColor: string;
}> = {
  pending: {
    label: "Pending",
    icon: AlertCircle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    gradient: "from-amber-400 to-orange-500",
    glowColor: "shadow-amber-400/30",
  },
  confirmed: {
    label: "Confirmed",
    icon: CheckCircle2,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    gradient: "from-blue-400 to-indigo-500",
    glowColor: "shadow-blue-400/30",
  },
  preparing: {
    label: "Preparing",
    icon: ChefHat,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    gradient: "from-purple-400 to-pink-500",
    glowColor: "shadow-purple-400/30",
  },
  ready: {
    label: "Ready",
    icon: Package,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    gradient: "from-cyan-400 to-teal-500",
    glowColor: "shadow-cyan-400/30",
  },
  out_for_delivery: {
    label: "On the Way",
    icon: Truck,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    gradient: "from-orange-400 to-red-500",
    glowColor: "shadow-orange-400/30",
  },
  delivered: {
    label: "Delivered",
    icon: MapPin,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    gradient: "from-emerald-400 to-green-500",
    glowColor: "shadow-emerald-400/30",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    gradient: "from-green-400 to-emerald-500",
    glowColor: "shadow-green-400/30",
  },
  cancelled: {
    label: "Cancelled",
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    gradient: "from-red-400 to-rose-500",
    glowColor: "shadow-red-400/30",
  },
};

interface ActiveOrderBannerProps {
  userId: string;
}

export function ActiveOrderBanner({ userId }: ActiveOrderBannerProps) {
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveOrders = async () => {
      try {
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
          .eq("user_id", userId)
          .in("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"])
          .order("scheduled_date", { ascending: true })
          .limit(3);

        if (schedulesError) throw schedulesError;
        if (!schedules || schedules.length === 0) {
          setActiveOrders([]);
          setLoading(false);
          return;
        }

        const mealIds = [...new Set(schedules.map(s => s.meal_id).filter(Boolean))];

        let mealsData: (Meal & { restaurant?: { name: string } })[] = [];
        if (mealIds.length > 0) {
          const { data: meals, error: mealsError } = await supabase
            .from("meals")
            .select(`
              id,
              name,
              restaurant_id
            `)
            .in("id", mealIds);

          if (!mealsError && meals) {
            const restaurantIds = [...new Set(meals.map((m: Meal) => m.restaurant_id).filter(Boolean))] as string[];

            let restaurantsData: Restaurant[] = [];
            if (restaurantIds.length > 0) {
              const { data: restaurants, error: restaurantsError } = await supabase
                .from("restaurants")
                .select("id, name")
                .in("id", restaurantIds);

              if (!restaurantsError && restaurants) {
                restaurantsData = restaurants as Restaurant[];
              }
            }

            mealsData = (meals as Meal[]).map(meal => ({
              ...meal,
              restaurant: restaurantsData.find(r => r.id === meal.restaurant_id) || { name: "Restaurant" }
            }));
          }
        }

        const orders: ActiveOrder[] = (schedules as MealSchedule[]).map((schedule) => {
          const meal = mealsData.find(m => m.id === schedule.meal_id);
          return {
            id: schedule.id,
            order_status: schedule.order_status,
            scheduled_date: schedule.scheduled_date,
            meal_name: meal?.name || "Meal",
            restaurant_name: meal?.restaurant?.name || "Restaurant",
            total_amount: (schedule.addons_total || 0),
            delivery_type: schedule.delivery_type || "pickup",
          };
        });

        setActiveOrders(orders);
      } catch (err) {
        console.error("Error fetching active orders:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveOrders();

    const subscription = supabase
      .channel("active-orders")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "meal_schedules",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchActiveOrders();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  if (loading || activeOrders.length === 0) {
    return null;
  }

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "MMM dd");
  };

  const getCurrentStepIndex = (status: OrderStatus) => {
    return journeySteps.findIndex(step => step.status === status);
  };

  // Group orders by restaurant
  const groupOrdersByRestaurant = (orders: ActiveOrder[]): GroupedRestaurantOrder[] => {
    const grouped = orders.reduce((acc, order) => {
      if (!acc[order.restaurant_name]) {
        acc[order.restaurant_name] = [];
      }
      acc[order.restaurant_name].push(order);
      return acc;
    }, {} as Record<string, ActiveOrder[]>);

    return Object.entries(grouped).map(([restaurant_name, orders]) => {
      // Get the "latest" status (furthest along in the journey)
      const statuses = orders.map(o => o.order_status);
      const stepIndices = statuses.map(s => getCurrentStepIndex(s));
      const maxIndex = Math.max(...stepIndices);
      const latest_status = journeySteps[maxIndex]?.status || orders[0].order_status;

      // Get earliest scheduled date
      const dates = orders.map(o => new Date(o.scheduled_date));
      const earliest_date = new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0];

      return {
        restaurant_name,
        orders,
        meal_count: orders.length,
        meal_names: orders.map(o => o.meal_name),
        earliest_date,
        latest_status,
        all_statuses: statuses,
      };
    });
  };

  const groupedOrders = groupOrdersByRestaurant(activeOrders);

  return (
    <div className="space-y-4">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <Utensils className="w-4 h-4 text-primary" />
          </motion.div>
          Active Orders ({groupedOrders.length})
        </h3>
        <Link to="/orders">
          <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-primary/10 hover:text-primary transition-colors">
            View All
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {groupedOrders.map((group, index) => {
          const config = statusConfig[group.latest_status];
          const currentStepIndex = getCurrentStepIndex(group.latest_status);
          const progress = ((currentStepIndex + 1) / journeySteps.length) * 100;

          return (
            <motion.div
              key={group.restaurant_name}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              layout
            >
              <Link to="/tracking">
                <Card
                  className={`group overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-500 cursor-pointer bg-gradient-to-br from-white to-slate-50/50 ${config.glowColor} hover:shadow-lg`}
                >
                  {/* Top progress bar */}
                  <div className="relative h-1 bg-slate-100 overflow-hidden">
                    <motion.div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${config.gradient}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                    />
                  </div>

                  <CardContent className="p-5">
                    {/* Header with status badge */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium px-2.5 py-1 ${config.color} border-current bg-white/80 backdrop-blur-sm`}
                            >
                              <config.icon className="w-3 h-3 mr-1.5" />
                              {config.label}
                            </Badge>
                          </motion.div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getDateLabel(group.earliest_date)}
                          </span>
                          {group.meal_count > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              {group.meal_count} meals
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-base text-slate-900 truncate group-hover:text-primary transition-colors">
                          {group.restaurant_name}
                        </h4>
                        <div className="mt-1 space-y-0.5">
                          {group.meal_names.slice(0, 3).map((mealName, idx) => (
                            <p key={idx} className="text-sm text-muted-foreground truncate">
                              • {mealName}
                            </p>
                          ))}
                          {group.meal_names.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{group.meal_names.length - 3} more meals
                            </p>
                          )}
                        </div>
                      </div>
                      <motion.div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg ${config.glowColor} shadow-lg`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      >
                        <config.icon className="w-6 h-6 text-white" />
                      </motion.div>
                    </div>

                    {/* Animated Journey Timeline */}
                    <div className="relative mt-6 mb-4">
                      {/* Connecting line */}
                      <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200">
                        <motion.div 
                          className={`h-full bg-gradient-to-r ${config.gradient}`}
                          initial={{ width: "0%" }}
                          animate={{ width: `${(currentStepIndex / (journeySteps.length - 1)) * 100}%` }}
                          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
                        />
                      </div>

                      {/* Steps */}
                      <div className="relative flex justify-between">
                        {journeySteps.map((step, stepIndex) => {
                          const isCompleted = stepIndex <= currentStepIndex;
                          const isCurrent = stepIndex === currentStepIndex;
                          const StepIcon = step.icon;

                          return (
                            <motion.div 
                              key={step.status}
                              className="flex flex-col items-center"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.6 + stepIndex * 0.05 }}
                            >
                              <motion.div
                                className={`
                                  relative w-8 h-8 rounded-full flex items-center justify-center
                                  transition-all duration-300 border-2
                                  ${isCompleted 
                                    ? `bg-gradient-to-br ${config.gradient} border-transparent text-white shadow-md ${config.glowColor}` 
                                    : 'bg-white border-slate-200 text-slate-300'
                                  }
                                  ${isCurrent ? `scale-110 shadow-lg ring-4 ${config.bgColor} ${config.glowColor} ring-opacity-50` : ''}
                                `}
                                animate={isCurrent ? {
                                  scale: [1, 1.15, 1],
                                  boxShadow: [
                                    `0 0 0 0px rgba(var(--tw-shadow-color), 0)`,
                                    `0 0 0 8px rgba(var(--tw-shadow-color), 0.2)`,
                                    `0 0 0 0px rgba(var(--tw-shadow-color), 0)`
                                  ]
                                } : {}}
                                transition={isCurrent ? {
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                } : {}}
                              >
                                <StepIcon className="w-4 h-4" />
                                {isCurrent && (
                                  <motion.div
                                    className="absolute inset-0 rounded-full bg-white/30"
                                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                  />
                                )}
                              </motion.div>
                              <span className={`
                                text-[10px] mt-1.5 font-medium transition-colors duration-300
                                ${isCompleted ? config.color : 'text-slate-300'}
                                ${isCurrent ? 'font-semibold' : ''}
                              `}>
                                {step.label}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer with action */}
                    <div className="flex items-center justify-end pt-3 border-t border-slate-100">
                      <motion.div
                        className="flex items-center gap-1 text-xs font-medium text-primary"
                        whileHover={{ x: 3 }}
                      >
                        <span>Track Order</span>
                        <ChevronRight className="w-3 h-3" />
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
