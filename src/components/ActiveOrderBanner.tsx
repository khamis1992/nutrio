import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChefHat,
  Truck,
  MapPin,
  ChevronRight,
  Package,
  Check,
  Clock,
  Utensils,
  CircleCheck,
  Loader2,
  X,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import flameLogo from "@/assets/flam.png";

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

const FoodEmoji = () => (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-orange-100 to-green-100 text-xs mr-2">
    🥗
  </span>
);

interface ActiveOrderBannerProps {
  userId: string;
}

export function ActiveOrderBanner({ userId }: ActiveOrderBannerProps) {
  const { t } = useLanguage();
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Journey steps with icons for each step
  const journeySteps: { status: OrderStatus; label: string; sublabel?: string; Icon: React.ElementType }[] = [
    { status: "pending",          label: t("order_status_placed"), Icon: CircleCheck },
    { status: "confirmed",        label: t("order_status_confirmed"),    Icon: Check },
    { status: "preparing",        label: t("order_status_preparing"),    sublabel: t("order_status_in_queue"),           Icon: ChefHat },
    { status: "ready",            label: t("order_status_ready"),        Icon: Package },
    { status: "out_for_delivery", label: t("order_status_on_the_way"),   sublabel: t("order_status_near_location"), Icon: Truck },
    { status: "delivered",        label: t("order_status_delivered"),    Icon: MapPin },
  ];

  const statusConfig: Record<OrderStatus, {
    label: string;
    shortLabel: string;
    badgeClass: string;
    textClass: string;
  }> = {
    pending: {
      label: t("order_status_pending"),
      shortLabel: t("order_status_pending_short"),
      badgeClass: "bg-[#bef264]",
      textClass: "text-green-900",
    },
    confirmed: {
      label: t("order_status_confirmed"),
      shortLabel: t("order_status_confirmed_short"),
      badgeClass: "bg-[#bef264]",
      textClass: "text-green-900",
    },
    preparing: {
      label: t("order_status_preparing"),
      shortLabel: t("order_status_preparing_short"),
      badgeClass: "bg-[#bef264]",
      textClass: "text-green-900",
    },
    ready: {
      label: t("order_status_ready"),
      shortLabel: t("order_status_ready_short"),
      badgeClass: "bg-[#bef264]",
      textClass: "text-green-900",
    },
    out_for_delivery: {
      label: t("order_status_on_the_way"),
      shortLabel: t("order_status_on_the_way_short"),
      badgeClass: "bg-green-700",
      textClass: "text-[#bef264]",
    },
    delivered: {
      label: t("order_status_delivered"),
      shortLabel: t("order_status_delivered_short"),
      badgeClass: "bg-green-700",
      textClass: "text-white",
    },
    completed: {
      label: t("order_status_completed"),
      shortLabel: t("order_status_completed_short"),
      badgeClass: "bg-green-700",
      textClass: "text-white",
    },
    cancelled: {
      label: t("order_status_cancelled"),
      shortLabel: t("order_status_cancelled_short"),
      badgeClass: "bg-red-500",
      textClass: "text-white",
    },
  };

  const fetchActiveOrders = useCallback(async () => {
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
          .select(`id, name, restaurant_id`)
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
            restaurant: restaurantsData.find(r => r.id === meal.restaurant_id) || { name: t("order_restaurant_default") },
          }));
        }
      }

      const orders: ActiveOrder[] = (schedules as MealSchedule[]).map((schedule) => {
        const meal = mealsData.find(m => m.id === schedule.meal_id);
        return {
          id: schedule.id,
          order_status: schedule.order_status,
          scheduled_date: schedule.scheduled_date,
          meal_name: meal?.name || t("order_meal_default"),
          restaurant_name: meal?.restaurant?.name || t("order_restaurant_default"),
          total_amount: schedule.addons_total || 0,
          delivery_type: schedule.delivery_type || "pickup",
        };
      });

      setActiveOrders(orders);
    } catch (err) {
      console.error("Error fetching active orders:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  const handleCancelOrder = async (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(t("order_cancel_confirm"))) return;
    setCancelling(orderId);
    try {
      const { data, error } = await supabase.rpc("cancel_meal_schedule", {
        p_schedule_id: orderId,
      });

      if (error) {
        const errorMessage = error.message || "";
        if (errorMessage.includes("preparing")) {
          toast.error(t("order_cannot_cancel_title"), {
            description: t("order_cannot_cancel_description"),
          });
          return;
        }
        throw error;
      }

      if (!data || !(data as { success?: boolean }).success) throw new Error(t("order_cancel_failed"));

      // Remove from UI — RPC is atomic, trust the success response
      setActiveOrders(prev => prev.filter(o => o.id !== orderId));
      toast.success(t("order_cancel_success"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("order_cancel_error");
      toast.error(message);
    } finally {
      setCancelling(null);
    }
  };

  useEffect(() => {
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
          // Small delay so the DB write is visible before re-reading
          setTimeout(() => fetchActiveOrders(), 300);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, fetchActiveOrders]);

  if (loading || activeOrders.length === 0) {
    return null;
  }

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return t("date_today");
    if (isTomorrow(date)) return t("date_tomorrow");
    return format(date, "MMM dd");
  };

  const getCurrentStepIndex = (status: OrderStatus) => {
    return journeySteps.findIndex(step => step.status === status);
  };

  const groupOrdersByRestaurant = (orders: ActiveOrder[]): GroupedRestaurantOrder[] => {
    const grouped = orders.reduce((acc, order) => {
      if (!acc[order.restaurant_name]) {
        acc[order.restaurant_name] = [];
      }
      acc[order.restaurant_name].push(order);
      return acc;
    }, {} as Record<string, ActiveOrder[]>);

    return Object.entries(grouped).map(([restaurant_name, orders]) => {
      const statuses = orders.map(o => o.order_status);
      const stepIndices = statuses.map(s => getCurrentStepIndex(s));
      const maxIndex = Math.max(...stepIndices);
      const latest_status = journeySteps[maxIndex]?.status || orders[0].order_status;

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
      {/* Section Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h3 className="font-semibold text-base flex items-center gap-2 text-slate-800">
          <span className="text-green-600">
            <Utensils className="w-5 h-5" />
          </span>
          {t("order_active_orders")} ({groupedOrders.length})
        </h3>
        <Link to="/dashboard">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-sm font-medium hover:bg-green-50 hover:text-green-700 transition-colors text-slate-600"
          >
            {t("order_view_all")}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {groupedOrders.map((group, index) => {
          const config = statusConfig[group.latest_status];
          const currentStepIndex = getCurrentStepIndex(group.latest_status);
          const canCancel = group.orders.some(
            o => o.order_status === "pending" || o.order_status === "confirmed"
          );
          const cancellableOrderId = group.orders.find(
            o => o.order_status === "pending" || o.order_status === "confirmed"
          )?.id;

          return (
            <motion.div
              key={group.restaurant_name}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.1, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              layout
            >
              <Link to={`/live/${group.orders[0].id}`}>
                <div className="group relative overflow-hidden rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white via-green-50/60 to-green-100/70 border border-green-100">
                  <div className="p-5">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        {/* Status Badge + Date/ETA */}
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`${config.badgeClass} ${config.textClass} font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5`}>
                            {group.latest_status === "out_for_delivery"
                              ? <Truck className="w-3.5 h-3.5" />
                              : <Clock className="w-3.5 h-3.5" />
                            }
                            {config.shortLabel}
                          </span>
                          <span className="text-sm text-slate-500 font-medium">
                            {group.latest_status === "out_for_delivery" ? t("order_eta") : t("order_est")} {getDateLabel(group.earliest_date)}
                          </span>
                        </div>

                        {/* Restaurant Name */}
                        <h4 className="font-bold text-xl text-green-950 mb-2">
                          {group.restaurant_name}
                        </h4>

                        {/* Meal Items */}
                        <div className="space-y-1">
                          {group.meal_names.slice(0, 2).map((mealName, idx) => (
                            <p key={idx} className="text-sm text-green-900/70 flex items-center font-medium">
                              <span className="mr-2">•</span>
                              <FoodEmoji />
                              {mealName}
                            </p>
                          ))}
                          {group.meal_names.length > 2 && (
                            <p className="text-xs text-green-700/60 ml-6">
                              +{group.meal_names.length - 2} {t("order_more_meals")}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Status Icon — top right */}
                      <div className="relative flex-shrink-0">
                        <motion.div
                          className="relative w-12 h-12 rounded-full bg-green-800 flex items-center justify-center shadow-lg"
                          animate={{ scale: [1, 1.08, 1] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                        >
                          {group.latest_status === "out_for_delivery"
                            ? <Truck className="w-6 h-6 text-white" />
                            : <Clock className="w-6 h-6 text-white" />
                          }
                        </motion.div>
                      </div>
                    </div>

                    {/* Progress Stepper */}
                    <div className="mt-6 mb-2">
                      <div className="relative px-1">
                        {/* Background Line */}
                        <div className="absolute top-5 left-6 right-6 h-0.5 bg-green-200/80" />

                        {/* Active Progress Line */}
                        <motion.div
                          className="absolute top-5 left-6 h-0.5 bg-green-600"
                          initial={{ width: "0%" }}
                          animate={{
                            width: `${(currentStepIndex / (journeySteps.length - 1)) * (100 - 8)}%`
                          }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          style={{ right: "auto" }}
                        />

                        {/* Steps */}
                        <div className="relative flex justify-between">
                          {journeySteps.map((step, stepIndex) => {
                            const isCompleted = stepIndex < currentStepIndex;
                            const isCurrent = stepIndex === currentStepIndex;
                            const StepIcon = step.Icon;

                            return (
                              <div
                                key={step.status}
                                className="flex flex-col items-center"
                                style={{ width: `${100 / journeySteps.length}%` }}
                              >
                                {/* Step Circle */}
                                {isCurrent ? (
                                  <div className="relative flex items-center justify-center w-11 h-11">
                                    {/* Ping rings — current step only */}
                                    <span className="absolute inset-0 rounded-full bg-green-400 opacity-40 animate-ping" />
                                    <span className="absolute inset-0 rounded-full bg-green-300 opacity-20 animate-ping [animation-delay:0.4s]" />
                                    <motion.div
                                      className="relative w-11 h-11 flex items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-green-500 z-10"
                                      animate={{ scale: [1, 1.06, 1] }}
                                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    >
                                      <motion.div
                                        className="absolute inset-0 rounded-full bg-green-400 blur-md"
                                        animate={{ scale: [1.2, 1.6, 1.2], opacity: [0.4, 0.1, 0.4] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                      />
                                      <motion.img
                                        src={flameLogo}
                                        alt="NutrioFuel"
                                        className="w-7 h-7 object-contain relative z-10"
                                        animate={{ scale: [1, 1.12, 1], rotate: [0, 5, -5, 0] }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                      />
                                    </motion.div>
                                  </div>
                                ) : (
                                  <div
                                    className={`
                                      relative flex items-center justify-center rounded-full z-10 transition-all duration-300 w-9 h-9
                                      ${isCompleted
                                        ? 'bg-green-700 text-white shadow-md'
                                        : 'bg-white/80 text-green-300 border border-green-200'
                                      }
                                    `}
                                  >
                                    {isCompleted
                                      ? <Check className="w-4 h-4" />
                                      : <StepIcon className="w-4 h-4 text-green-300" />
                                    }
                                  </div>
                                )}

                                {/* Step Label */}
                                <span className={`
                                  text-[10px] mt-1.5 text-center whitespace-nowrap leading-tight
                                  ${isCurrent ? 'font-bold text-green-900' : isCompleted ? 'font-semibold text-green-800' : 'font-medium text-green-400'}
                                `}>
                                  {step.label}
                                </span>

                                {/* Sublabel for current step */}
                                {isCurrent && step.sublabel && (
                                  <span className="text-[9px] text-green-700/70 mt-0.5 whitespace-nowrap italic">
                                    {step.sublabel}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Track Order Button */}
                    <div className="flex justify-end mt-4">
                      <motion.div
                        className="flex items-center gap-1 text-sm font-semibold text-green-900 bg-white/80 hover:bg-white border border-green-200 px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
                        whileHover={{ x: 2 }}
                      >
                        <span>{t("order_track")}</span>
                        <ChevronRight className="w-4 h-4" />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Cancel button — outside Link so it doesn't navigate */}
              {canCancel && cancellableOrderId && (
                <button
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border-t border-red-100 text-red-600 bg-red-50/60 text-sm font-semibold hover:bg-red-100 active:scale-[0.98] transition-all disabled:opacity-50 rounded-b-3xl"
                  onClick={(e) => handleCancelOrder(cancellableOrderId, e)}
                  disabled={cancelling === cancellableOrderId}
                >
                  {cancelling === cancellableOrderId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  {t("order_cancel")}
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
