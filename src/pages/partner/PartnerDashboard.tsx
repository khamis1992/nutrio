import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  MessageSquare,
  Wallet,
  User,
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
interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  is_active: boolean;
  payout_rate: number;       // Gross per-meal price the restaurant charges
  commission_rate: number;   // % platform takes (set by admin)
}

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  delivery_time_slot: string | null;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
  created_at: string;
  meal: {
    name: string;
  };
}

interface Stats {
  totalMeals: number;
  activeOrders: number;
  todayOrders: number;
  urgentOrders: number; // Today's pending/confirmed — needs immediate attention
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
    totalRevenue: 0,
    weeklyRevenue: 0,
    lastWeekRevenue: 0,
    weeklyOrders: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPartnerData();
    }
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
          const newStatus = (payload.new as Record<string, any>)?.order_status;
          if (payload.eventType === "INSERT" || newStatus !== "cancelled") {
            fetchPartnerData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      setRestaurant(restaurantData);

      // Net payout = gross rate × (1 − commission%)
      const grossRate = restaurantData.payout_rate || 0;
      const commissionRate = restaurantData.commission_rate ?? 18;
      const payoutRate = grossRate * (1 - commissionRate / 100);

      // Fetch meals count (price removed - meals are subscription-based)
      const { data: mealsData, count: mealsCount } = await supabase
        .from("meals")
        .select("id", { count: "exact" })
        .eq("restaurant_id", restaurantData.id);

      const mealIds = mealsData?.map((m) => m.id) || [];

      if (mealIds.length === 0) {
        setStats({
          totalMeals: 0,
          activeOrders: 0,
          todayOrders: 0,
          urgentOrders: 0,
          totalRevenue: 0,
          weeklyRevenue: 0,
          lastWeekRevenue: 0,
          weeklyOrders: 0,
        });
        setRecentSchedules([]);
        setLoading(false);
        return;
      }

      // Fetch scheduled meals for this restaurant's meals
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          delivery_time_slot,
          meal_type,
          is_completed,
          order_status,
          created_at,
          meals:meal_id (
            name
          )
        `)
        .in("meal_id", mealIds)
        .neq("order_status", "cancelled")
        .order("scheduled_date", { ascending: true })
        .limit(10);

      if (schedulesError) throw schedulesError;

      const transformedSchedules: ScheduledMeal[] = (schedulesData || []).map((s: any) => ({
        id: s.id,
        scheduled_date: s.scheduled_date,
        delivery_time_slot: s.delivery_time_slot || null,
        meal_type: s.meal_type,
        is_completed: s.is_completed || false,
        order_status: s.order_status || "pending",
        created_at: s.created_at,
        meal: s.meals,
      }));

      setRecentSchedules(transformedSchedules);

      // Fetch all schedules for stats (not limited)
      // Include order_status to determine urgent orders
      const { data: allSchedules } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, is_completed, meal_id, order_status")
        .in("meal_id", mealIds)
        .neq("order_status", "cancelled");

      // Calculate stats
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      
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

      // Count active orders for today — matches what PartnerOrders page shows
      // Note: only today's pending/confirmed orders so restaurant can plan prep
      const activeOrders = (allSchedules || []).filter(
        (s) => !s.is_completed &&
               s.scheduled_date === todayStr &&
               (s.order_status === "pending" || s.order_status === "confirmed")
      ).length || 0;
      // Today's orders — for dashboard stat (orders scheduled for today)
      const todayOrders = (allSchedules || []).filter(
        (s) => s.scheduled_date === todayStr
      ).length || 0;
      // Urgent orders: today's pending/confirmed orders that need immediate attention
      const urgentOrders = (allSchedules || []).filter(
        (s) => !s.is_completed &&
               s.scheduled_date === todayStr &&
               (s.order_status === "pending" || s.order_status === "confirmed")
      ).length || 0;
      
      // Revenue calculation: meals_prepared × payout_rate (subscription model)
      const totalRevenue = (allSchedules?.length || 0) * payoutRate;

      // This week's revenue and orders
      const thisWeekSchedules = allSchedules?.filter(
        (s) => s.scheduled_date >= thisMondayStr && s.scheduled_date <= todayStr
      ) || [];
      const weeklyRevenue = thisWeekSchedules.length * payoutRate;
      const weeklyOrders = thisWeekSchedules.length;

      // Last week's revenue
      const lastWeekSchedules = allSchedules?.filter(
        (s) => s.scheduled_date >= lastMondayStr && s.scheduled_date <= lastSundayStr
      ) || [];
      const lastWeekRevenue = lastWeekSchedules.length * payoutRate;

      setStats({
        totalMeals: mealsCount || 0,
        activeOrders,
        todayOrders,
        urgentOrders,
        totalRevenue,
        weeklyRevenue,
        lastWeekRevenue,
        weeklyOrders,
      });
    } catch (error) {
      console.error("Error fetching partner data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
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
        title: newStatus ? "Restaurant is now Open" : "Restaurant is now Closed",
        description: newStatus
          ? "Your restaurant is visible to customers"
          : "Your restaurant is hidden from customers",
      });
    } catch (error) {
      console.error("Error toggling restaurant status:", error);
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  const weeklyChange = stats.lastWeekRevenue > 0
    ? ((stats.weeklyRevenue - stats.lastWeekRevenue) / stats.lastWeekRevenue) * 100
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
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
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
              You don't have a restaurant registered yet. Let's get you set up and start receiving orders.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/partner/onboarding")} className="w-full h-11" size="lg">
                Register Your Restaurant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full h-11">
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
      <div className="space-y-6">

        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
          {/* background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white" />
            <div className="absolute -bottom-12 -left-12 w-64 h-64 rounded-full bg-white" />
          </div>

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 overflow-hidden border border-white/30">
                {restaurant.logo_url ? (
                  <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-7 h-7 text-white" />
                )}
              </div>
              <div>
                <p className="text-primary-foreground/70 text-sm font-medium">{greeting}</p>
                <h1 className="text-xl font-bold leading-tight">{restaurant.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {restaurant.rating > 0 && (
                    <span className="flex items-center gap-1 text-sm text-primary-foreground/80">
                      <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                      {restaurant.rating.toFixed(1)}
                    </span>
                  )}
                  <Badge
                    className={cn(
                      "text-xs border font-semibold",
                      restaurant.is_active
                        ? "bg-green-500/20 text-green-100 border-green-400/40"
                        : "bg-white/10 text-white/70 border-white/20"
                    )}
                  >
                    {restaurant.is_active ? "● Open" : "○ Closed"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Open / Closed toggle */}
            <button
              onClick={toggleRestaurantActive}
              className={cn(
                "group relative flex flex-col items-center gap-1 shrink-0 rounded-2xl px-5 py-3 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white select-none shadow-lg active:scale-95",
                restaurant.is_active
                  ? "bg-white hover:bg-green-50"
                  : "bg-white/20 hover:bg-white/30 border border-white/40"
              )}
            >
              {/* Pulse ring when open */}
              {restaurant.is_active && (
                <span className="absolute inset-0 rounded-2xl animate-ping bg-white/30 pointer-events-none" />
              )}

              {/* Icon + label row */}
              <div className="relative flex items-center gap-2">
                {/* Status dot */}
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300",
                  restaurant.is_active
                    ? "bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]"
                    : "bg-white/60"
                )} />
                <span className={cn(
                  "text-sm font-bold tracking-widest",
                  restaurant.is_active ? "text-green-600" : "text-white"
                )}>
                  {restaurant.is_active ? "OPEN" : "CLOSED"}
                </span>
              </div>

              {/* Subtitle */}
              <span className={cn(
                "text-[10px] font-medium hidden sm:block",
                restaurant.is_active ? "text-gray-400" : "text-white/70"
              )}>
                {restaurant.is_active ? "Tap to close" : "Tap to open"}
              </span>
            </button>
          </div>

          {/* Commission rate pill */}
          <div className="mt-4 flex items-center gap-2 bg-amber-400 rounded-xl px-4 py-2 w-fit shadow-md">
            <Zap className="h-4 w-4 text-amber-900 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-800">
                Platform commission · set by admin
              </p>
              <p className="text-sm font-black text-amber-950">
                {restaurant.commission_rate ?? 18}% of each meal
              </p>
            </div>
          </div>
        </div>

        {/* Platform Announcements */}
        <AnnouncementsBanner audience="partners" />

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Menu Items",
              value: stats.totalMeals,
              icon: UtensilsCrossed,
              color: "text-violet-600",
              bg: "bg-violet-500/10",
              border: "border-l-violet-500",
              href: "/partner/menu",
            },
            {
              label: "Active Orders",
              value: stats.activeOrders,
              icon: Clock,
              color: "text-amber-600",
              bg: "bg-amber-500/10",
              border: "border-l-amber-500",
              href: "/partner/orders",
              urgent: stats.urgentOrders > 0,
            },
            {
              label: "Today's Orders",
              value: stats.todayOrders,
              icon: ShoppingBag,
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
              border: "border-l-emerald-500",
              href: "/partner/orders",
            },
            {
              label: "Total Revenue",
              value: formatCurrency(stats.totalRevenue),
              icon: DollarSign,
              color: "text-blue-600",
              bg: "bg-blue-500/10",
              border: "border-l-blue-500",
              href: "/partner/payouts",
            },
          ].map((stat) => (
            <Link key={stat.label} to={stat.href}>
              <Card className={cn(
                "h-full border-l-4 hover:shadow-md transition-all duration-200 group cursor-pointer",
                stat.border,
                stat.urgent && "ring-2 ring-amber-400/30 animate-pulse-subtle"
              )}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
                      <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                    </div>
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform", stat.bg)}>
                      <stat.icon className={cn("h-4 w-4", stat.color)} />
                    </div>
                  </div>
                  {stat.urgent && (
                    <p className="text-xs text-amber-600 font-medium mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Needs attention
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* ── Mid Row: Weekly Performance + Quick Actions ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Weekly performance card */}
          <Card className="lg:col-span-2 bg-gradient-to-br from-muted/40 to-muted/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">This Week's Performance</CardTitle>
                {weeklyChange !== null && (
                  <div className={cn(
                    "flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded-full",
                    weeklyChange >= 0
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-600"
                  )}>
                    {weeklyChange >= 0
                      ? <TrendingUp className="h-3.5 w-3.5" />
                      : <TrendingDown className="h-3.5 w-3.5" />}
                    {weeklyChange >= 0 ? "+" : ""}{weeklyChange.toFixed(1)}%
                  </div>
                )}
              </div>
              {weeklyChange !== null && (
                <p className="text-xs text-muted-foreground">vs last week</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-xl bg-background border">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(stats.weeklyRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Revenue</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-background border">
                  <p className="text-2xl font-bold">{stats.weeklyOrders}</p>
                  <p className="text-xs text-muted-foreground mt-1">Orders</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-background border">
                  <p className="text-2xl font-bold">
                    {stats.weeklyOrders > 0
                      ? formatCurrency(stats.weeklyRevenue / stats.weeklyOrders)
                      : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Avg / Order</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { label: "Manage Menu", icon: UtensilsCrossed, href: "/partner/menu", color: "text-violet-600", bg: "bg-violet-500/10" },
                { label: "View Orders", icon: Package, href: "/partner/orders", color: "text-amber-600", bg: "bg-amber-500/10", badge: stats.activeOrders > 0 ? stats.activeOrders : undefined },
                { label: "Analytics", icon: BarChart3, href: "/partner/analytics", color: "text-blue-600", bg: "bg-blue-500/10" },
                { label: "Payouts", icon: Wallet, href: "/partner/payouts", color: "text-emerald-600", bg: "bg-emerald-500/10" },
                { label: "Settings", icon: Settings, href: "/partner/settings", color: "text-slate-600", bg: "bg-slate-500/10" },
              ].map((action) => (
                <Link key={action.href} to={action.href}>
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group cursor-pointer">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", action.bg)}>
                      <action.icon className={cn("h-4 w-4", action.color)} />
                    </div>
                    <span className="text-sm font-medium flex-1">{action.label}</span>
                    {action.badge && (
                      <Badge className="h-5 text-xs bg-amber-500 text-white">{action.badge}</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Branch Orders Section */}
        <PartnerBranchOrders />

        {/* ── Recent Orders ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary">
                <Link to="/partner/orders" className="flex items-center gap-1 text-sm">
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-muted-foreground">No orders yet</p>
                <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                  Orders will appear here when customers schedule your meals
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link to="/partner/menu">Add meals to your menu</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentSchedules.slice(0, 5).map((schedule, idx) => {
                  const today = new Date().toISOString().split("T")[0];
                  const isCompleted = schedule.is_completed;
                  const isOverdue = !isCompleted && schedule.scheduled_date < today;
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0",
                          isCompleted ? "bg-emerald-500/10" : isOverdue ? "bg-amber-500/10" : "bg-blue-500/10"
                        )}>
                          🍽️
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">
                            {schedule.meal?.name || "Unknown Meal"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(schedule.scheduled_date + "T00:00:00").toLocaleDateString("en-US", {
                              weekday: "short", month: "short", day: "numeric"
                            })}
                            {" · "}
                            <span className="capitalize">{schedule.meal_type}</span>
                            {schedule.delivery_time_slot && (
                              <span className="ml-1 text-orange-600 font-medium">· {schedule.delivery_time_slot}</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isCompleted ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> Done
                          </span>
                        ) : isOverdue ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full">
                            <AlertCircle className="h-3 w-3" /> Overdue
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-500/10 px-2 py-1 rounded-full">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </PartnerLayout>
  );
};

export default PartnerDashboard;
