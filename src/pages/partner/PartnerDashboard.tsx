import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Store,
  UtensilsCrossed,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  ChevronRight,
  Star,
  Package,
  BarChart3,
  Wallet,
  Power,
  CheckCircle2,
  AlertCircle,
  Settings,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { formatCurrency } from "@/lib/currency";
import { PartnerBranchOrders } from "@/components/partner/PartnerBranchOrders";
import { getQatarDay } from "@/lib/dateUtils";
interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  is_active: boolean;
  payout_rate: number; // Gross per-meal price the restaurant charges
  commission_rate: number; // % platform takes (set by admin)
}

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  delivery_time_slot: string | null;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
  created_at: string | null;
  meal: {
    name: string;
  };
}

interface Stats {
  totalMeals: number;
  activeOrders: number;
  todayOrders: number;
  urgentOrders: number; // Today's pending/confirmed orders that need attention.
  totalRevenue: number;
  weeklyRevenue: number;
  lastWeekRevenue: number;
  weeklyOrders: number;
}

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [recentSchedules, setRecentSchedules] = useState<ScheduledMeal[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalMeals: 0,
    activeOrders: 0,
    todayOrders: 0,
    urgentOrders: 0,
    totalRevenue: 0,
    weeklyRevenue: 0,
    lastWeekRevenue: 0,
    weeklyOrders: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPartnerData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Subscribe to real-time updates for meal schedules (scoped to partner's meals)
  useEffect(() => {
    if (!restaurant) return;

    const channel = supabase
      .channel(`partner-dashboard-rt-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_schedules",
        },
        (payload) => {
          const newStatus = (payload.new as Record<string, unknown>)
            ?.order_status;
          if (payload.eventType === "INSERT" || newStatus !== "cancelled") {
            fetchPartnerData();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => fetchPartnerData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant]);

  const fetchPartnerData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch partner's restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;

      if (!restaurantData) {
        // No restaurant found, partner needs to create one
        setLoading(false);
        return;
      }

      setRestaurant({
        id: restaurantData.id,
        name: restaurantData.name,
        logo_url: restaurantData.logo_url,
        rating: restaurantData.rating || 0,
        total_orders: restaurantData.total_orders || 0,
        is_active: restaurantData.is_active ?? false,
        payout_rate: restaurantData.payout_rate || 0,
        commission_rate: restaurantData.commission_rate || 0,
      });

      // Net payout = gross rate adjusted by platform commission.
      const grossRate = restaurantData.payout_rate || 0;
      const commissionRate = restaurantData.commission_rate ?? 18;
      const payoutRate = grossRate * (1 - commissionRate / 100);

      // Fetch meals count (price removed - meals are subscription-based)
      const { data: mealsData, count: mealsCount } = await supabase
        .from("meals")
        .select("id, name", { count: "exact" })
        .eq("restaurant_id", restaurantData.id);

      const mealIds = mealsData?.map((m) => m.id) || [];
      const mealNames = new Map((mealsData || []).map((meal) => [meal.id, meal.name]));

      const [schedulesResult, directOrdersResult] = await Promise.all([
        mealIds.length > 0
          ? supabase
              .from("meal_schedules")
              .select(`
          id,
          scheduled_date,
          delivery_time_slot,
          meal_type,
          is_completed,
          order_status,
          created_at,
          meals:meals!meal_schedules_meal_id_fkey (
            name
          )
        `)
              .in("meal_id", mealIds)
              .neq("order_status", "cancelled")
              .eq("is_completed", false)
              .gte("scheduled_date", getQatarDay())
              .order("scheduled_date", { ascending: true })
              .limit(10)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("orders")
          .select("id, created_at, status, restaurant_payout, meal_id")
          .eq("restaurant_id", restaurantData.id)
          .neq("status", "cancelled")
          .order("created_at", { ascending: false }),
      ]);

      const { data: schedulesData, error: schedulesError } = schedulesResult;
      const { data: directOrders, error: directOrdersError } = directOrdersResult;

      if (schedulesError) throw schedulesError;
      if (directOrdersError) throw directOrdersError;

      const transformedSchedules: ScheduledMeal[] = (schedulesData || []).map(
        (s) => ({
          id: s.id,
          scheduled_date: s.scheduled_date,
          delivery_time_slot: s.delivery_time_slot || null,
          meal_type: s.meal_type,
          is_completed: s.is_completed || false,
          order_status: s.order_status || "pending",
          created_at: s.created_at,
          meal: { name: s.meals?.name || "Meal" },
        }),
      );

      const transformedDirectOrders: ScheduledMeal[] = (directOrders || [])
        .filter((order) =>
          ["pending", "confirmed", "preparing", "ready_for_pickup", "out_for_delivery"].includes(
            order.status || "",
          ),
        )
        .slice(0, 10)
        .map((order) => ({
          id: order.id,
          scheduled_date: getQatarDay(new Date(order.created_at)),
          delivery_time_slot: null,
          meal_type: "order",
          is_completed: order.status === "completed" || order.status === "delivered",
          order_status: order.status === "ready_for_pickup" ? "ready" : order.status,
          created_at: order.created_at,
          meal: order.meal_id
            ? { name: mealNames.get(order.meal_id) || "Order" }
            : { name: "Order" },
        }));

      setRecentSchedules(
        [...transformedSchedules, ...transformedDirectOrders]
          .sort(
            (a, b) =>
              new Date(b.created_at || b.scheduled_date).getTime() -
              new Date(a.created_at || a.scheduled_date).getTime(),
          )
          .slice(0, 10),
      );

      // Fetch all schedules for stats (not limited)
      // Include order_status to determine urgent orders
      const { data: allSchedules } = mealIds.length > 0
        ? await supabase
            .from("meal_schedules")
            .select("id, scheduled_date, is_completed, meal_id, order_status")
            .in("meal_id", mealIds)
            .neq("order_status", "cancelled")
        : { data: [] };

      // Calculate stats
      const today = new Date();
      const todayStr = getQatarDay(today);

      // Calculate week boundaries (Monday to Sunday)
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + mondayOffset);
      const thisMondayStr = thisMonday.toISOString().split("T")[0];

      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastMondayStr = lastMonday.toISOString().split("T")[0];
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      const lastSundayStr = lastSunday.toISOString().split("T")[0];

      const directOrderDay = (order: { created_at: string }) =>
        getQatarDay(new Date(order.created_at));
      const directTodayOrders = (directOrders || []).filter(
        (order) => directOrderDay(order) === todayStr,
      );
      const directUrgentOrders = directTodayOrders.filter(
        (order) => order.status === "pending" || order.status === "confirmed",
      );

      // Count active orders for today to match what PartnerOrders shows.
      // Note: only today's pending/confirmed orders so restaurant can plan prep
      const activeOrders =
        (allSchedules || []).filter(
          (s) =>
            !s.is_completed &&
            s.scheduled_date === todayStr &&
            (s.order_status === "pending" || s.order_status === "confirmed"),
        ).length + directUrgentOrders.length || 0;
      // Today's orders for the dashboard stat.
      const todayOrders =
        (allSchedules || []).filter((s) => s.scheduled_date === todayStr)
          .length + directTodayOrders.length || 0;
      // Urgent orders: today's pending/confirmed orders that need immediate attention
      const urgentOrders =
        (allSchedules || []).filter(
          (s) =>
            !s.is_completed &&
            s.scheduled_date === todayStr &&
            (s.order_status === "pending" || s.order_status === "confirmed"),
        ).length + directUrgentOrders.length || 0;

      // Revenue calculation: prepared meals multiplied by payout rate.
      const directRevenue = (directOrders || []).reduce(
        (sum, order) => sum + (order.restaurant_payout || 0),
        0,
      );
      const totalRevenue = (allSchedules?.length || 0) * payoutRate + directRevenue;

      // This week's revenue and orders
      const thisWeekSchedules =
        allSchedules?.filter(
          (s) =>
            s.scheduled_date >= thisMondayStr && s.scheduled_date <= todayStr,
        ) || [];
      const weeklyRevenue = thisWeekSchedules.length * payoutRate;
      const thisWeekDirectOrders = (directOrders || []).filter((order) => {
        const day = directOrderDay(order);
        return day >= thisMondayStr && day <= todayStr;
      });
      const weeklyRevenueWithDirect = weeklyRevenue + thisWeekDirectOrders.reduce(
        (sum, order) => sum + (order.restaurant_payout || 0),
        0,
      );
      const weeklyOrders = thisWeekSchedules.length + thisWeekDirectOrders.length;

      // Last week's revenue
      const lastWeekSchedules =
        allSchedules?.filter(
          (s) =>
            s.scheduled_date >= lastMondayStr &&
            s.scheduled_date <= lastSundayStr,
        ) || [];
      const lastWeekRevenue = lastWeekSchedules.length * payoutRate;
      const lastWeekDirectRevenue = (directOrders || [])
        .filter((order) => {
          const day = directOrderDay(order);
          return day >= lastMondayStr && day <= lastSundayStr;
        })
        .reduce((sum, order) => sum + (order.restaurant_payout || 0), 0);

      setStats({
        totalMeals: mealsCount || 0,
        activeOrders,
        todayOrders,
        urgentOrders,
        totalRevenue,
        weeklyRevenue: weeklyRevenueWithDirect,
        lastWeekRevenue: lastWeekRevenue + lastWeekDirectRevenue,
        weeklyOrders,
      });
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : (error as { message?: string } | null)?.message || "Failed to load dashboard data";
      console.error("Error fetching partner data:", message, error);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRestaurantActive = async () => {
    if (!restaurant) return;
    const newStatus = !restaurant.is_active;
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ is_active: newStatus })
        .eq("id", restaurant.id);
      if (error) throw error;
      setRestaurant({ ...restaurant, is_active: newStatus });
      toast({
        title: newStatus
          ? "Restaurant is now Open"
          : "Restaurant is now Closed",
        description: newStatus
          ? "Your restaurant is visible to customers"
          : "Your restaurant is hidden from customers",
      });
    } catch (error) {
      console.error("Error toggling restaurant status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  const weeklyChange =
    stats.lastWeekRevenue > 0
      ? ((stats.weeklyRevenue - stats.lastWeekRevenue) /
          stats.lastWeekRevenue) *
        100
      : null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  if (loading) {
    return (
      <PartnerLayout title="Dashboard">
        <div className="space-y-6">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Skeleton className="h-44 rounded-xl lg:col-span-2" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </PartnerLayout>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-2">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Store className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Welcome, Partner!</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              You don't have a restaurant registered yet. Let's get you set up
              and start receiving orders.
            </p>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/partner/onboarding")}
                className="w-full h-11"
                size="lg"
              >
                Register Your Restaurant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
                className="w-full h-11"
              >
                Go to Customer Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PartnerLayout title="Dashboard">
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_22px_70px_rgba(2,6,23,0.06)]">
            <div className="grid gap-4 p-4 lg:grid-cols-[1.3fr_0.7fr] lg:p-5">
              <div className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-[#E5EAF1] bg-[#F6F8FB]">
                      {restaurant.logo_url ? (
                        <img
                          src={restaurant.logo_url}
                          alt={restaurant.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Store className="h-7 w-7 text-[#7C83F6]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#22C7A1]">
                        {greeting}
                      </p>
                      <h1 className="truncate text-2xl font-black tracking-tight text-[#020617]">
                        {restaurant.name}
                      </h1>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {restaurant.rating > 0 && (
                          <span className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E5EAF1] bg-white px-3 text-sm font-bold text-[#020617]">
                            <Star className="h-3.5 w-3.5 fill-[#F97316] text-[#F97316]" />
                            {restaurant.rating.toFixed(1)}
                          </span>
                        )}
                        <span
                          className={cn(
                            "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-black uppercase tracking-[0.12em]",
                            restaurant.is_active
                              ? "border-[#22C7A1]/35 bg-[#22C7A1]/10 text-[#0B9B7E]"
                              : "border-[#FB6B7A]/35 bg-[#FB6B7A]/10 text-[#FB6B7A]",
                          )}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              restaurant.is_active
                                ? "bg-[#22C7A1]"
                                : "bg-[#FB6B7A]",
                            )}
                          />
                          {restaurant.is_active ? "Open" : "Closed"}
                        </span>
                        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#E5EAF1] bg-[#F6F8FB] px-3 text-xs font-bold text-[#64748B]">
                          <Zap className="h-3.5 w-3.5 text-[#F97316]" />
                          {restaurant.commission_rate ?? 18}% commission
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleRestaurantActive}
                    className={cn(
                      "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-black transition active:scale-[0.98]",
                      restaurant.is_active
                        ? "bg-[#020617] text-white shadow-[0_16px_32px_rgba(2,6,23,0.18)]"
                        : "border border-[#E5EAF1] bg-white text-[#020617]",
                    )}
                  >
                    <Power className="h-4 w-4" />
                    {restaurant.is_active ? "Pause orders" : "Open restaurant"}
                  </button>
                </div>
                <div
                  className={cn(
                    "rounded-3xl border p-4",
                    stats.urgentOrders > 0
                      ? "border-[#FB6B7A]/30 bg-[#FB6B7A]/10"
                      : "border-[#22C7A1]/25 bg-[#22C7A1]/10",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                          stats.urgentOrders > 0
                            ? "bg-[#FB6B7A]/15 text-[#FB6B7A]"
                            : "bg-[#22C7A1]/15 text-[#0B9B7E]",
                        )}
                      >
                        {stats.urgentOrders > 0 ? (
                          <AlertCircle className="h-5 w-5" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-base font-black text-[#020617]">
                          {stats.urgentOrders > 0
                            ? `${stats.urgentOrders} orders need attention`
                            : "Operations are clear"}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[#64748B]">
                          {stats.urgentOrders > 0
                            ? "Review today's pending meals and delivery slots before prep starts."
                            : "No urgent orders are waiting right now. Keep your menu and schedule ready."}
                        </p>
                      </div>
                    </div>
                    <Button
                      asChild
                      className="h-11 rounded-2xl bg-[#020617] px-5 text-white hover:bg-[#020617]/90"
                    >
                      <Link to="/partner/orders">
                        View orders
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded-[24px] bg-[#020617] p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                      This week
                    </p>
                    <p className="mt-2 text-3xl font-black">
                      {formatCurrency(stats.weeklyRevenue)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-white/60">
                      {stats.weeklyOrders} scheduled meals
                    </p>
                  </div>
                  {weeklyChange !== null && (
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black",
                        weeklyChange >= 0
                          ? "bg-[#22C7A1]/20 text-[#22C7A1]"
                          : "bg-[#FB6B7A]/20 text-[#FB6B7A]",
                      )}
                    >
                      {weeklyChange >= 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {weeklyChange >= 0 ? "+" : ""}
                      {weeklyChange.toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                      Avg order
                    </p>
                    <p className="mt-2 text-lg font-black">
                      {stats.weeklyOrders > 0
                        ? formatCurrency(
                            stats.weeklyRevenue / stats.weeklyOrders,
                          )
                        : "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
                      Today
                    </p>
                    <p className="mt-2 text-lg font-black">
                      {stats.todayOrders} orders
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <AnnouncementsBanner audience="partners" />
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              {
                label: "Menu items",
                value: stats.totalMeals,
                icon: UtensilsCrossed,
                href: "/partner/menu",
                color: "#7C83F6",
                bg: "bg-[#7C83F6]/10",
              },
              {
                label: "Active orders",
                value: stats.activeOrders,
                icon: Clock,
                href: "/partner/orders",
                color: "#F97316",
                bg: "bg-[#F97316]/10",
              },
              {
                label: "Today's orders",
                value: stats.todayOrders,
                icon: ShoppingBag,
                href: "/partner/orders",
                color: "#22C7A1",
                bg: "bg-[#22C7A1]/10",
              },
              {
                label: "Total revenue",
                value: formatCurrency(stats.totalRevenue),
                icon: DollarSign,
                href: "/partner/payouts",
                color: "#38BDF8",
                bg: "bg-[#38BDF8]/10",
              },
            ].map((stat) => (
              <Link
                key={stat.label}
                to={stat.href}
                className="group rounded-3xl border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_36px_rgba(2,6,23,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_48px_rgba(2,6,23,0.08)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      {stat.label}
                    </p>
                    <p className="mt-3 truncate text-2xl font-black text-[#020617]">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      stat.bg,
                    )}
                  >
                    <stat.icon
                      className="h-5 w-5"
                      style={{ color: stat.color }}
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-bold text-[#94A3B8]">
                  <span>Open details</span>
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </section>
          <section className="grid gap-4 lg:grid-cols-[1fr_0.82fr]">
            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                    Performance
                  </p>
                  <h2 className="mt-1 text-xl font-black text-[#020617]">
                    Weekly operating snapshot
                  </h2>
                </div>
                <BarChart3 className="h-5 w-5 text-[#7C83F6]" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">Revenue</p>
                  <p className="mt-2 text-lg font-black text-[#020617]">
                    {formatCurrency(stats.weeklyRevenue)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">Orders</p>
                  <p className="mt-2 text-lg font-black text-[#020617]">
                    {stats.weeklyOrders}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                  <p className="text-xs font-bold text-[#94A3B8]">Average</p>
                  <p className="mt-2 text-lg font-black text-[#020617]">
                    {stats.weeklyOrders > 0
                      ? formatCurrency(stats.weeklyRevenue / stats.weeklyOrders)
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#22C7A1]">
                    Action center
                  </p>
                  <h2 className="mt-1 text-xl font-black text-[#020617]">
                    Run the restaurant
                  </h2>
                </div>
                <Settings className="h-5 w-5 text-[#94A3B8]" />
              </div>
              <div className="mt-4 space-y-2">
                {[
                  {
                    label: "Manage menu",
                    helper: "Meals, pricing, availability",
                    icon: UtensilsCrossed,
                    href: "/partner/menu",
                    color: "#7C83F6",
                  },
                  {
                    label: "View orders",
                    helper: `${stats.activeOrders} active today`,
                    icon: Package,
                    href: "/partner/orders",
                    color: "#F97316",
                  },
                  {
                    label: "Payouts",
                    helper: "Revenue and settlement",
                    icon: Wallet,
                    href: "/partner/payouts",
                    color: "#22C7A1",
                  },
                  {
                    label: "Settings",
                    helper: "Restaurant profile",
                    icon: Settings,
                    href: "/partner/settings",
                    color: "#94A3B8",
                  },
                ].map((action) => (
                  <Link
                    key={action.href}
                    to={action.href}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] px-3 transition hover:bg-white"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white">
                      <action.icon
                        className="h-5 w-5"
                        style={{ color: action.color }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-[#020617]">
                        {action.label}
                      </p>
                      <p className="truncate text-xs font-semibold text-[#94A3B8]">
                        {action.helper}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
                  </Link>
                ))}
              </div>
            </div>
          </section>
          <PartnerBranchOrders />
          <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_36px_rgba(2,6,23,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                  Recent schedule
                </p>
                <h2 className="mt-1 text-xl font-black text-[#020617]">
                  Upcoming customer meals
                </h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-10 rounded-2xl border-[#E5EAF1] bg-white text-[#020617]"
              >
                <Link to="/partner/orders">
                  View all
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            {recentSchedules.length === 0 ? (
              <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#E5EAF1] bg-[#F6F8FB] px-4 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
                  <ShoppingBag className="h-6 w-6 text-[#7C83F6]" />
                </div>
                <p className="mt-3 font-black text-[#020617]">No orders yet</p>
                <p className="mt-1 max-w-xs text-sm font-medium text-[#94A3B8]">
                  Orders will appear here when customers schedule meals from
                  your menu.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 h-10 rounded-2xl border-[#E5EAF1] bg-white"
                  asChild
                >
                  <Link to="/partner/menu">Add meals</Link>
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {recentSchedules.slice(0, 5).map((schedule) => {
                  const today = new Date().toISOString().split("T")[0];
                  const isCompleted = schedule.is_completed;
                  const isOverdue =
                    !isCompleted && schedule.scheduled_date < today;
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between gap-3 rounded-3xl border border-[#E5EAF1] bg-[#F6F8FB] p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white">
                          <UtensilsCrossed className="h-5 w-5 text-[#7C83F6]" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-black text-[#020617]">
                            {schedule.meal?.name || "Unknown meal"}
                          </p>
                          <p className="mt-1 truncate text-xs font-semibold text-[#94A3B8]">
                            {new Date(
                              schedule.scheduled_date + "T00:00:00",
                            ).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                            {" - "}
                            <span className="capitalize">
                              {schedule.meal_type}
                            </span>
                            {schedule.delivery_time_slot &&
                              ` - ${schedule.delivery_time_slot}`}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-black",
                          isCompleted
                            ? "bg-[#22C7A1]/10 text-[#0B9B7E]"
                            : isOverdue
                              ? "bg-[#FB6B7A]/10 text-[#FB6B7A]"
                              : "bg-[#F97316]/10 text-[#F97316]",
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : isOverdue ? (
                          <AlertCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        {isCompleted
                          ? "Done"
                          : isOverdue
                            ? "Overdue"
                            : "Pending"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </PartnerLayout>
  );
};

export default PartnerDashboard;
