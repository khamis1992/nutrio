import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { OneTapReorder } from "@/components/OneTapReorder";
import { ModifyOrderModal } from "@/components/ModifyOrderModal";
import { EmptyState } from "@/components/EmptyState";
import { 
  ArrowLeft, 
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  RefreshCw,
  Calendar,
  Flame,
  ShoppingBag,
  UtensilsCrossed,
  Loader2,
  ChefHat,
  CircleDot,
  RotateCcw,
  Trash2,
  Pencil
} from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
}

interface Meal {
  id: string;
  name: string;
  image_url: string | null;
  calories: number;
  restaurant_id: string;
}

interface OrderItem {
  id: string;
  quantity: number;
  meal_id: string;
  meal?: Meal;
}

interface Order {
  id: string;
  created_at: string;
  estimated_delivery_time?: string;
  status: string;
  meal_id: string | null;
  notes: string | null;
  restaurant_id: string | null;
  restaurant?: Restaurant;
  order_items: OrderItem[];
}

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
  created_at: string;
  meal_id: string;
  meal?: Meal & { restaurant?: Restaurant };
}

// Raw types from Supabase (with possible nulls)
interface RawOrder {
  id: string;
  created_at: string;
  estimated_delivery_time: string | null;
  status: string | null;
  meal_id: string | null;
  notes: string | null;
  restaurant_id: string | null;
}

interface RawOrderItem {
  id: string;
  order_id: string;
  quantity: number;
  meal_id: string | null;
}

interface RawScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean | null;
  order_status: string | null;
  created_at: string;
  meal_id: string;
}

const statusConfig: Record<string, { labelKey: string; icon: React.ElementType; color: string }> = {
  pending: { labelKey: "status_pending", icon: CircleDot, color: "bg-warning/10 text-warning border-warning/20" },
  confirmed: { labelKey: "status_confirmed", icon: CheckCircle2, color: "bg-primary/10 text-primary border-primary/20" },
  preparing: { labelKey: "status_preparing", icon: ChefHat, color: "bg-primary/10 text-primary border-primary/20" },
  out_for_delivery: { labelKey: "status_out_for_delivery", icon: Truck, color: "bg-warning/10 text-warning border-warning/20" },
  delivered: { labelKey: "status_delivered", icon: CheckCircle2, color: "bg-primary/10 text-primary border-primary/20" },
  cancelled: { labelKey: "status_cancelled", icon: XCircle, color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const OrderHistory = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [reordering, setReordering] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("scheduled");
  const [refreshing, setRefreshing] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  
  // Scheduled meals state
  const [scheduledMeals, setScheduledMeals] = useState<ScheduledMeal[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledPage, setScheduledPage] = useState(0);
  const [scheduledHasMore, setScheduledHasMore] = useState(true);
  
  // Order modification state
  const [modifyingSchedule, setModifyingSchedule] = useState<ScheduledMeal | null>(null);
  
  // Pull to refresh handlers
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const minPullDistance = 80;

  // Fetch orders with manual relationship joining
  const fetchOrders = useCallback(async (page: number, append: boolean = false) => {
    if (!user) return;
    
    setOrdersLoading(true);
    try {
      const pageSize = 10;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, created_at, estimated_delivery_time, status, notes, restaurant_id, meal_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (ordersError) throw ordersError;
      
      if (!ordersData || ordersData.length === 0) {
        setOrdersHasMore(false);
        setOrdersLoading(false);
        return;
      }

      // Get unique restaurant IDs (filter out nulls)
      const restaurantIds = [...new Set(
        (ordersData as RawOrder[])
          .map(o => o.restaurant_id)
          .filter((id): id is string => id !== null)
      )];
      
      // Fetch restaurants
      let restaurantsData: Restaurant[] = [];
      if (restaurantIds.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name, logo_url")
          .in("id", restaurantIds);
        restaurantsData = restaurants || [];
      }

      // Fetch order items for these orders
      const orderIds = (ordersData as RawOrder[]).map(o => o.id);
      const { data: orderItemsData } = await supabase
        .from("order_items")
        .select("id, order_id, quantity, meal_id")
        .in("order_id", orderIds);

      // Get unique meal IDs from order items (filter out nulls)
      const mealIds = [...new Set(
        (orderItemsData || [] as RawOrderItem[])
          .map(oi => oi.meal_id)
          .filter((id): id is string => id !== null)
      )];
      
      // Fetch meals
      let mealsData: Meal[] = [];
      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, image_url, calories, restaurant_id")
          .in("id", mealIds);
        mealsData = meals || [];
      }

      // Transform and combine data
      const transformedOrders: Order[] = (ordersData as RawOrder[]).map(order => ({
        id: order.id,
        created_at: order.created_at,
        estimated_delivery_time: order.estimated_delivery_time || undefined,
        status: order.status || "pending",
        meal_id: order.meal_id,
        notes: order.notes,
        restaurant_id: order.restaurant_id,
        restaurant: restaurantsData.find(r => r.id === order.restaurant_id),
        order_items: (orderItemsData || [] as RawOrderItem[])
          .filter(oi => oi.order_id === order.id)
          .map(oi => ({
            id: oi.id,
            quantity: oi.quantity,
            meal_id: oi.meal_id || "",
            meal: mealsData.find(m => m.id === oi.meal_id),
          })),
      }));

      setOrders(prev => append ? [...prev, ...transformedOrders] : transformedOrders);
      setOrdersPage(page);
      setOrdersHasMore(ordersData.length === pageSize);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  // Fetch scheduled meals with manual relationship joining
  const fetchScheduledMeals = useCallback(async (page: number, append: boolean = false) => {
    if (!user) return;
    
    setScheduledLoading(true);
    try {
      const pageSize = 10;
      const from = page * pageSize;
      const to = from + pageSize - 1;

      // Fetch scheduled meals
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, meal_type, is_completed, order_status, created_at, meal_id")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: false })
        .range(from, to);

      if (schedulesError) throw schedulesError;
      
      if (!schedulesData || schedulesData.length === 0) {
        setScheduledHasMore(false);
        setScheduledLoading(false);
        return;
      }

      // Get unique meal IDs
      const mealIds = [...new Set(
        (schedulesData as RawScheduledMeal[])
          .map(s => s.meal_id)
          .filter((id): id is string => !!id)
      )];
      
      // Fetch meals with restaurant info
      let mealsData: (Meal & { restaurant?: Restaurant })[] = [];
      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, image_url, calories, restaurant_id")
          .in("id", mealIds);
        
        if (meals && meals.length > 0) {
          // Get unique restaurant IDs (filter out nulls)
          const restaurantIds = [...new Set(
            meals
              .map(m => m.restaurant_id)
              .filter((id): id is string => id !== null)
          )];
          
          // Fetch restaurants
          let restaurantsData: Restaurant[] = [];
          if (restaurantIds.length > 0) {
            const { data: restaurants } = await supabase
              .from("restaurants")
              .select("id, name, logo_url")
              .in("id", restaurantIds);
            restaurantsData = restaurants || [];
          }
          
          // Combine meals with restaurants
          mealsData = meals.map(meal => ({
            ...meal,
            restaurant: restaurantsData.find(r => r.id === meal.restaurant_id),
          }));
        }
      }

      // Transform data
      const transformedSchedules: ScheduledMeal[] = (schedulesData as RawScheduledMeal[]).map(schedule => ({
        id: schedule.id,
        scheduled_date: schedule.scheduled_date,
        meal_type: schedule.meal_type,
        is_completed: schedule.is_completed || false,
        order_status: schedule.order_status || "pending",
        created_at: schedule.created_at,
        meal_id: schedule.meal_id,
        meal: mealsData.find(m => m.id === schedule.meal_id),
      }));

      setScheduledMeals(prev => append ? [...prev, ...transformedSchedules] : transformedSchedules);
      setScheduledPage(page);
      setScheduledHasMore(schedulesData.length === pageSize);
    } catch (error) {
      console.error("Error fetching scheduled meals:", error);
    } finally {
      setScheduledLoading(false);
    }
  }, [user]);

  // Pull to refresh functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const currentY = e.targetTouches[0].clientY;
    const distance = currentY - touchStart;
    
    // Only allow pull down when at top of page
    if (window.scrollY === 0 && distance > 0) {
      setPullDistance(Math.min(distance, 150));
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !pullDistance) return;
    
    if (pullDistance > minPullDistance && window.scrollY === 0) {
      handleRefresh();
    }
    
    setPullDistance(0);
    setTouchStart(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchOrders(0, false),
      fetchScheduledMeals(0, false)
    ]);
    setRefreshing(false);
    toast({
      title: t("refreshed_toast"),
      description: "Your orders have been updated.",
    });
  };

  // Cancel order function
  const handleCancelOrder = async (orderId: string, orderType: 'scheduled' | 'order') => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    setCancelling(orderId);
    try {
      if (orderType === 'scheduled') {
        const { data, error } = await supabase.rpc("cancel_meal_schedule", {
          p_schedule_id: orderId,
        });
        
        // Handle specific error for "preparing" status
        if (error) {
          const errorMessage = error.message || "";
          if (errorMessage.includes('preparing')) {
            throw new Error("Cannot cancel order - it's already being prepared. Please contact the restaurant for assistance.");
          }
          throw error;
        }
        
        if (!data?.success) throw new Error("Cancellation failed. Please try again.");

        // Update local state
        setScheduledMeals(prev => prev.map(meal => 
          meal.id === orderId ? { ...meal, order_status: 'cancelled' } : meal
        ));
      } else {
        const { error } = await supabase
          .from("orders")
          .update({ status: 'cancelled' })
          .eq("id", orderId);
        
        if (error) throw error;
        
        // Update local state
        setOrders(prev => prev.map(order => 
          order.id === orderId ? { ...order, status: 'cancelled' } : order
        ));
      }
      
      toast({
        title: t("order_cancelled_toast"),
        description: t("order_cancelled_desc"),
      });
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast({
        title: t("error"),
        description: "Failed to cancel order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancelling(null);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchOrders(0, false);
      fetchScheduledMeals(0, false);
    }
  }, [user, fetchOrders, fetchScheduledMeals]);

// Real-time subscription for scheduled meals status updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('customer-meal-schedules')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meal_schedules',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as { order_status: string }).order_status;
          const oldStatus = (payload.old as { order_status: string }).order_status;
          
          // Show toast notification when status changes
          if (newStatus !== oldStatus) {
            const statusMessages: Record<string, string> = {
              confirmed: t("status_update_confirmed"),
              preparing: t("status_update_preparing"),
              ready: t("status_update_ready"),
              out_for_delivery: t("status_update_out_for_delivery"),
              delivered: t("status_update_delivered"),
              completed: t("status_update_completed"),
              cancelled: t("status_update_cancelled"),
            };
            
            if (statusMessages[newStatus]) {
              toast.success(statusMessages[newStatus]);
            }
          }
          
          // Refresh the list when an update occurs
          fetchScheduledMeals(0, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetchScheduledMeals, toast]);

  // Check if user completed onboarding
  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  const loadMoreOrders = () => {
    if (!ordersLoading && ordersHasMore) {
      fetchOrders(ordersPage + 1, true);
    }
  };

  const loadMoreScheduled = () => {
    if (!scheduledLoading && scheduledHasMore) {
      fetchScheduledMeals(scheduledPage + 1, true);
    }
  };

  const handleReorder = async (order: Order) => {
    if (!user) return;
    
    setReordering(order.id);

    try {
      // Create new order with same items (subscription-based, no price)
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          restaurant_id: order.restaurant?.id,
          estimated_delivery_time: format(tomorrow, "yyyy-MM-dd'T'HH:mm:ss"),
          total_amount: 0, // Subscription-based, no charge
          status: "pending",
          meal_id: order.meal_id,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = order.order_items
        .filter(item => item.meal)
        .map(item => ({
          order_id: newOrder.id,
          meal_id: item.meal!.id,
          meal_name: item.meal!.name,
          quantity: item.quantity,
          unit_price: 0, // Subscription-based
          subtotal: 0, // Subscription-based
        }));

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;
      }

      toast({
        title: t("order_placed_toast"),
        description: t("reorder_placed_desc"),
      });

      // Refresh orders
      fetchOrders(0, false);
    } catch (error) {
      console.error("Error reordering:", error);
      toast({
        title: t("error"),
        description: "Failed to place reorder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setReordering(null);
    }
  };

  const getStatusInfo = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return { ...config, label: t(config.labelKey) };
  };

  const getTotalCalories = (items: OrderItem[]) => {
    return items.reduce((sum, item) => sum + ((item.meal?.calories || 0) * item.quantity), 0);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = format(today, "yyyy-MM-dd");
  const upcomingMeals = scheduledMeals.filter(m => !m.is_completed && m.scheduled_date >= todayStr);
  const completedMeals = scheduledMeals.filter(m => m.is_completed);

  const loading = ordersLoading || scheduledLoading;

  // ── Scheduled meal card (native style) ──────────────────────────────────
  const renderScheduledMeals = (meals: ScheduledMeal[]) => {
    if (meals.length === 0) {
      return (
        <EmptyState
          icon={<ShoppingBag className="w-9 h-9" />}
          title={t("no_scheduled_meals_title")}
          description={t("schedule_meals_cta")}
          actionLabel={t("browse_meals_btn")}
          actionHref="/meals"
        />
      );
    }

    return (
      <div className="space-y-3">
        {meals.map((schedule) => {
          const statusInfo = getStatusInfo(schedule.order_status);
          const StatusIcon = statusInfo.icon;
          const canCancel = schedule.order_status === 'pending' || schedule.order_status === 'confirmed';

          return (
            <div
              key={schedule.id}
              className="bg-card/95 rounded-3xl border border-border/70 shadow-md overflow-hidden active:scale-[0.99] transition-all"
              onClick={() => navigate(`/order/${schedule.id}`)}
            >
              <div className="p-4">
                {/* Card header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden shrink-0 shadow-sm">
                    {schedule.meal?.image_url ? (
                      <img src={schedule.meal.image_url} alt={schedule.meal.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-foreground truncate">
                      {schedule.meal?.name || "Unknown Meal"}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {schedule.meal?.restaurant?.name || "Restaurant"}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusInfo.label}
                  </span>
                </div>

                {/* Meta chips */}
                <div className="flex items-center gap-2 pt-3 border-t border-border/60 flex-wrap">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(schedule.scheduled_date), "MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    <Clock className="h-3 w-3" />
                    {schedule.meal_type}
                  </span>
                  {schedule.meal?.calories ? (
                    <span className="flex items-center gap-1 text-xs text-warning font-semibold bg-warning/10 px-2 py-1 rounded-full">
                      <Flame className="h-3 w-3" />
                      {schedule.meal.calories} cal
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {t("included_badge")}
                  </span>
                </div>
              </div>

              {/* Action buttons: Modify and Cancel */}
              {canCancel && (
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-primary/20 text-primary bg-primary/5 text-sm font-semibold hover:bg-primary/10 active:scale-[0.98] transition-all"
                    onClick={(e) => { e.stopPropagation(); setModifyingSchedule(schedule); }}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("modify_btn")}
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-destructive/20 text-destructive bg-destructive/10 text-sm font-semibold hover:bg-destructive/20 active:scale-[0.98] transition-all disabled:opacity-50"
                    onClick={(e) => { e.stopPropagation(); handleCancelOrder(schedule.id, 'scheduled'); }}
                    disabled={cancelling === schedule.id}
                  >
                    {cancelling === schedule.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {t("cancel_btn")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center transition-all duration-200"
          style={{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / minPullDistance, 1) }}
        >
          <div className="flex items-center gap-2 text-primary bg-primary/10 px-4 py-2 rounded-full">
            <RotateCcw
              className="h-4 w-4"
              style={{ transform: `rotate(${pullDistance * 2}deg)` }}
            />
            <span className="text-sm font-medium">
              {pullDistance > minPullDistance ? t("release_to_refresh") : t("pull_to_refresh")}
            </span>
          </div>
        </div>
      )}

      {/* Refreshing banner */}
      {refreshing && (
        <div className="flex items-center justify-center py-3 bg-primary/5 border-b border-primary/10">
          <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
          <span className="text-sm font-medium text-primary">{t("refreshing_label")}</span>
        </div>
      )}

      {/* Native header */}
      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/70 pt-safe">
          <div className="px-4 pt-[env(safe-area-inset-top)] h-16 flex items-center justify-between rtl:flex-row-reverse">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold tracking-tight">{t("orders_page_title")}</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 active:scale-95 transition-all disabled:opacity-40"
          >
            <RefreshCw className={`h-4.5 w-4.5 text-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading && orders.length === 0 && scheduledMeals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </div>
        ) : (
          <>
            {/* iOS-style segment control */}
            <div className="bg-muted rounded-2xl p-1 flex gap-1 mb-5">
              {[
                { id: "scheduled", label: t("upcoming_tab"), count: upcomingMeals.length },
                { id: "completed", label: t("completed_tab"), count: completedMeals.length },
                { id: "orders",    label: t("orders_tab"),    count: orders.length },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === id ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Upcoming tab */}
            {activeTab === "scheduled" && (
              <>
                {renderScheduledMeals(upcomingMeals)}
                {scheduledHasMore && (
                  <button
                    className="w-full mt-3 py-3 rounded-2xl border border-border/70 bg-card/90 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    onClick={loadMoreScheduled}
                    disabled={scheduledLoading}
                  >
                    {scheduledLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("load_more_btn")}
                  </button>
                )}
              </>
            )}

            {/* Completed tab */}
            {activeTab === "completed" && (
              <>
                {renderScheduledMeals(completedMeals)}
                {scheduledHasMore && (
                  <button
                    className="w-full mt-3 py-3 rounded-2xl border border-border/70 bg-card/90 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    onClick={loadMoreScheduled}
                    disabled={scheduledLoading}
                  >
                    {scheduledLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("load_more_btn")}
                  </button>
                )}
              </>
            )}

            {/* Orders tab */}
            {activeTab === "orders" && (
              <>
                {orders.length === 0 ? (
                  <EmptyState
                    icon={<ShoppingBag className="w-9 h-9" />}
                    title={t("no_data")}
                    description={t("no_data_desc_orders")}
                    actionLabel={t("browse_meals_btn")}
                    actionHref="/meals"
                  />
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => {
                      const statusInfo = getStatusInfo(order.status);
                      const StatusIcon = statusInfo.icon;
                      const totalCalories = getTotalCalories(order.order_items);

                      return (
                        <div key={order.id} className="bg-card/95 rounded-3xl border border-border/70 shadow-md overflow-hidden">
                          <div className="p-4">
                            {/* Restaurant row */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden shrink-0 shadow-sm">
                                {order.restaurant?.logo_url ? (
                                  <img src={order.restaurant.logo_url} alt={order.restaurant.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Package className="h-6 w-6 text-muted-foreground/50" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base text-foreground truncate">
                                  {order.restaurant?.name || "Restaurant"}
                                </h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                              <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </span>
                            </div>

                            {/* Order items */}
                            {order.order_items.length > 0 && (
                              <div className="space-y-2 mb-3">
                                {order.order_items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-muted/50">
                                    <div className="w-11 h-11 rounded-xl bg-muted overflow-hidden shrink-0">
                                      {item.meal?.image_url ? (
                                        <img src={item.meal.image_url} alt={item.meal.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <UtensilsCrossed className="h-4 w-4 text-muted-foreground/50" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate text-foreground">
                                        {item.meal?.name || "Unknown meal"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                      Included
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Meta chips */}
                            <div className="flex items-center gap-2 pt-3 border-t border-border/60 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(order.estimated_delivery_time || order.created_at), "MMM d")}
                              </span>
                              {totalCalories > 0 && (
                                <span className="flex items-center gap-1 text-xs text-warning font-semibold bg-warning/10 px-2 py-1 rounded-full">
                                  <Flame className="h-3 w-3" />
                                  {totalCalories} cal
                                </span>
                              )}
                              <span className="ml-auto text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded-full">
                                {t("subscription")}
                              </span>
                            </div>

                            {/* Reorder */}
                            {(order.status === "delivered" || order.status === "completed") && (
                              <div className="mt-3">
                                <OneTapReorder
                                  orderId={order.id}
                                  items={order.order_items.map((item) => ({
                                    meal_id: item.meal_id,
                                    meal_name: item.meal?.name || "Unknown Meal",
                                    quantity: item.quantity,
                                    price: 0,
                                    image_url: item.meal?.image_url,
                                    restaurant_id: order.restaurant_id || undefined,
                                    restaurant_name: order.restaurant?.name,
                                  }))}
                                  orderTotal={0}
                                  variant="outline"
                                  size="default"
                                  className="w-full rounded-2xl"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {ordersHasMore && (
                  <button
                    className="w-full mt-3 py-3 rounded-2xl border border-border/70 bg-card/90 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    onClick={loadMoreOrders}
                    disabled={ordersLoading}
                  >
                    {ordersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `${t("load_more_btn")} (${ordersPage * 10}+ ${t("orders_label")})`}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modify Order Modal */}
      <ModifyOrderModal
        isOpen={!!modifyingSchedule}
        onClose={() => setModifyingSchedule(null)}
        schedule={modifyingSchedule}
        onModified={() => {
          // Refresh the scheduled meals after modification
          fetchScheduledMeals(0, false);
        }}
      />    </div>
  );
};

export default OrderHistory;
