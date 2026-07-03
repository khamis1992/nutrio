import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { ModifyOrderModal } from "@/components/ModifyOrderModal";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
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
  confirmed: { labelKey: "status_confirmed", icon: CheckCircle2, color: "bg-[#020617]/5 text-[#020617] border-[#020617]/10" },
  preparing: { labelKey: "status_preparing", icon: ChefHat, color: "bg-[#020617]/5 text-[#020617] border-[#020617]/10" },
  out_for_delivery: { labelKey: "status_out_for_delivery", icon: Truck, color: "bg-warning/10 text-warning border-warning/20" },
  delivered: { labelKey: "status_delivered", icon: CheckCircle2, color: "bg-[#020617]/5 text-[#020617] border-[#020617]/10" },
  cancelled: { labelKey: "status_cancelled", icon: XCircle, color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const OrderHistory = () => {
  const { t, isRTL } = useLanguage();
  useEffect(() => { document.title = `${t("order_history")} — Nutrio`; }, [t]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    if (tab === "completed" || tab === "scheduled") return tab;
    return "scheduled";
  });
  const [refreshing, setRefreshing] = useState(false);
  
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
    await fetchScheduledMeals(0, false);
    setRefreshing(false);
    toast({
      title: t("refreshed_toast"),
      description: "Your orders have been updated.",
    });
  };

  // Cancel order function
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    setCancelling(orderId);
    try {
      const { data, error } = await supabase.rpc("cancel_meal_schedule", {
        p_schedule_id: orderId,
        p_reason: null,
      });
      
      if (error) {
        const errorMessage = error.message || "";
        if (errorMessage.includes('preparing')) {
          throw new Error("Cannot cancel order - it's already being prepared. Please contact the restaurant for assistance.");
        }
        throw error;
      }
      
      if (!data?.success) throw new Error("Cancellation failed. Please try again.");

      setScheduledMeals(prev => prev.map(meal => 
        meal.id === orderId ? { ...meal, order_status: 'cancelled' } : meal
      ));
      
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
      fetchScheduledMeals(0, false);
    }
  }, [user, fetchScheduledMeals]);

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
    if (sessionStorage.getItem("nutrio_onboarding_done") === "true") return;
    if (profile && !profile.onboarding_completed && !profile.goal) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  const loadMoreScheduled = () => {
    if (!scheduledLoading && scheduledHasMore) {
      fetchScheduledMeals(scheduledPage + 1, true);
    }
  };

  const getStatusInfo = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    return { ...config, label: t(config.labelKey) };
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = format(today, "yyyy-MM-dd");
  const upcomingMeals = scheduledMeals.filter(m => !m.is_completed && m.scheduled_date >= todayStr);
  const completedMeals = scheduledMeals.filter(m => m.is_completed);
  const upcomingProgress = 0;

  const loading = scheduledLoading;

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
          actionClassName="rounded-full bg-[#020617] px-5 py-2.5 text-white shadow-[0_10px_22px_rgba(2,6,23,0.16)] hover:bg-slate-800"
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
              className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition-all active:scale-[0.99]"
              onClick={() => navigate(`/order/${schedule.id}`)}
            >
              <div className="p-4">
                {/* Card header */}
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 shadow-sm">
                    {schedule.meal?.image_url ? (
                      <img src={schedule.meal.image_url} alt={schedule.meal.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-[16px] font-black leading-tight text-slate-950">
                      {schedule.meal?.name || "Unknown Meal"}
                    </h3>
                    <p className="mt-1 truncate text-[12px] font-semibold text-slate-500">
                      {schedule.meal?.restaurant?.name || "Restaurant"}
                    </p>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${statusInfo.color}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusInfo.label}
                  </span>
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="flex items-center gap-1 rounded-full bg-[#020617]/5 px-2.5 py-1 text-[11px] font-bold text-[#020617]">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(schedule.scheduled_date), "MMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                    <Clock className="h-3 w-3" />
                    {schedule.meal_type}
                  </span>
                  {schedule.meal?.calories ? (
                    <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-600">
                      <Flame className="h-3 w-3" />
                      {schedule.meal.calories} cal
                    </span>
                  ) : null}
                  <span className="ml-auto rounded-full bg-[#020617]/5 px-2.5 py-1 text-[11px] font-extrabold text-[#020617]">
                    {t("included_badge")}
                  </span>
                </div>
              </div>

              {/* Action buttons: Modify and Cancel */}
              {canCancel && (
                <div className="flex gap-2 px-4 pb-4">
                  <button
                    data-testid="order-history-modify-btn"
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#020617] text-sm font-extrabold text-white transition-all active:scale-[0.98]"
                    onClick={(e) => { e.stopPropagation(); setModifyingSchedule(schedule); }}
                  >
                    <Pencil className="h-4 w-4" />
                    {t("modify_btn")}
                  </button>
                  <button
                    data-testid="order-history-cancel-btn"
                    className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-red-50 text-sm font-extrabold text-red-600 transition-all active:scale-[0.98] disabled:opacity-50"
                    onClick={(e) => { e.stopPropagation(); handleCancelOrder(schedule.id); }}
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
      className="min-h-screen bg-[#F7FAF8] pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center bg-[#F7FAF8] transition-all duration-200"
          style={{ height: `${pullDistance}px`, opacity: Math.min(pullDistance / minPullDistance, 1) }}
        >
          <div className="flex items-center gap-2 rounded-full bg-[#020617]/5 px-4 py-2 text-[#020617]">
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
        <div className="flex items-center justify-center border-b border-[#020617]/10 bg-[#020617]/5 py-3">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#020617]" />
          <span className="text-sm font-medium text-[#020617]">{t("refreshing_label")}</span>
        </div>
      )}

      {/* Native header */}
      <header className="sticky top-0 z-40 border-b border-emerald-50/90 bg-[#F7FAF8]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-[76px] max-w-[430px] items-center justify-between px-4 pt-[env(safe-area-inset-top)] rtl:flex-row-reverse">
          <button
            data-testid="order-history-back-btn"
            onClick={() => navigate("/dashboard")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100 transition-all active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#020617]">
              {t("scheduled_date_label")}
            </p>
            <h1 className="text-[22px] font-black leading-tight text-slate-950">{t("orders_page_title")}</h1>
          </div>
          <button
            data-testid="order-history-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100 transition-all active:scale-95 disabled:opacity-40"
          >
            <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-[430px] px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* iOS-style segment control */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
              {[
                { id: "scheduled", label: t("upcoming_tab"), count: upcomingMeals.length },
                { id: "completed", label: t("completed_tab"), count: completedMeals.length },
              ].map(({ id, label, count }) => (
                <button
                  key={id}
                  data-testid={`order-history-tab-${id}`}
                  onClick={() => setActiveTab(id)}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-full text-[12px] font-extrabold transition-all ${
                    activeTab === id
                      ? "bg-[#020617] text-white shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                      activeTab === id ? "bg-white/20 text-white" : "bg-[#020617]/5 text-[#020617]"
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
                {upcomingMeals.length > 0 && (
                  <div className="mb-4 rounded-[32px] bg-white p-5 shadow-[0_18px_38px_rgba(15,23,42,0.07)] ring-1 ring-slate-100">
                    <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#020617]/5 text-[#020617]">
                      <ShoppingBag className="h-8 w-8" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#020617]">{t("dashboard_this_month")}</p>
                      <h2 className="mt-1 text-[25px] font-black leading-tight text-slate-950">{t("upcoming_tab")}</h2>
                      <p className="mt-2 text-[12px] font-semibold text-slate-500">
                        {upcomingMeals.length} {t("orders_label")} · 0 completed
                      </p>
                    </div>
                    <span className="rounded-full bg-[#020617]/5 px-2.5 py-1 text-[11px] font-extrabold text-[#020617]">
                      {upcomingProgress}%
                    </span>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-[#020617]/5 p-3">
                        <p className="text-[20px] font-black leading-none text-slate-950">{upcomingMeals.length}</p>
                        <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-[#020617]">total</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-[20px] font-black leading-none text-slate-950">0</p>
                        <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">done</p>
                      </div>
                      <div className="rounded-2xl bg-orange-50 p-3">
                        <p className="text-[20px] font-black leading-none text-slate-950">{upcomingProgress}%</p>
                        <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-orange-600">progress</p>
                      </div>
                    </div>
                  </div>
                )}
                {renderScheduledMeals(upcomingMeals)}
                {upcomingMeals.length > 0 && scheduledHasMore && (
                  <button
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-extrabold text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition-all active:scale-[0.98] disabled:opacity-40"
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
                    className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-extrabold text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 transition-all active:scale-[0.98] disabled:opacity-40"
                    onClick={loadMoreScheduled}
                    disabled={scheduledLoading}
                  >
                    {scheduledLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("load_more_btn")}
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
