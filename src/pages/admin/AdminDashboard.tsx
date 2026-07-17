import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AdminMetricTile,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Users,
  ShoppingBag,
  TrendingUp,
  Clock,
  DollarSign,
  BarChart3,
  Wallet,
  UserCheck,
  Truck,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { formatCurrency } from "@/lib/currency";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface Stats {
  totalRestaurants: number;
  approvedRestaurants: number;
  pendingApprovals: number;
  totalUsers: number;
  totalOrders: number;
  totalMeals: number;
  todayOrders: number;
  weeklyRevenue: number;
  pendingPayouts: number;
  pendingPayoutsAmount: number;
  totalCommissionsPaid: number;
  pendingAffiliatePayouts: number;
  fleetOnlineDrivers: number;
  fleetOrdersInProgress: number;
  fleetTodayDeliveries: number;
}

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface CommissionData {
  date: string;
  amount: number;
  count: number;
}

interface RecentActivity {
  id: string;
  type: "restaurant" | "order" | "user";
  title: string;
  description: string;
  time: string;
}

const AdminDashboard = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats>({
    totalRestaurants: 0,
    approvedRestaurants: 0,
    pendingApprovals: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalMeals: 0,
    todayOrders: 0,
    weeklyRevenue: 0,
    pendingPayouts: 0,
    pendingPayoutsAmount: 0,
    totalCommissionsPaid: 0,
    pendingAffiliatePayouts: 0,
    fleetOnlineDrivers: 0,
    fleetOrdersInProgress: 0,
    fleetTodayDeliveries: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [commissionData, setCommissionData] = useState<CommissionData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_schedules" },
        () => {
          fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurants" },
        () => {
          fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions" },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      restaurantsRes,
      approvedRes,
      pendingRes,
      profilesRes,
      schedulesRes,
      mealsRes,
      todaySchedulesRes,
      pendingPayoutsRes,
      commissionsRes,
      pendingAffiliatePayoutsRes,
      ordersRes,
      todayOrdersRes,
    ] = await Promise.all([
      supabase.from("restaurants").select("*", { count: "exact", head: true }),
      supabase
        .from("restaurants")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "approved"),
      supabase
        .from("restaurants")
        .select("*", { count: "exact", head: true })
        .eq("approval_status", "pending"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase
        .from("meal_schedules")
        .select("*", { count: "exact", head: true })
        .neq("order_status", "cancelled"),
      supabase.from("meals").select("*", { count: "exact", head: true }),
      supabase
        .from("meal_schedules")
        .select("*", { count: "exact", head: true })
        .eq("scheduled_date", today)
        .neq("order_status", "cancelled"),
      supabase.from("payouts").select("amount").eq("status", "pending"),
      supabase
        .from("affiliate_commissions")
        .select("commission_amount, created_at, status")
        .gte("created_at", thirtyDaysAgo.toISOString()),
      supabase
        .from("affiliate_payouts")
        .select("amount")
        .eq("status", "pending"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${today}T00:00:00+03:00`)
        .lt("created_at", `${today}T23:59:59.999+03:00`)
        .neq("status", "cancelled"),
    ]);

    // Fleet stats
    const [fleetDriversRes, fleetOrdersRes, fleetTodayRes] = await Promise.all([
      supabase
        .from("drivers")
        .select("is_online", { count: "exact" })
        .eq("is_online", true),
      supabase
        .from("delivery_jobs")
        .select("id", { count: "exact" })
        .in("status", [
          "assigned",
          "accepted",
          "picked_up",
          "in_transit",
          "on_the_way",
        ]),
      supabase
        .from("delivery_jobs")
        .select("id", { count: "exact" })
        .eq("status", "completed")
        .gte("delivered_at", today),
    ]);

    // Also count partner-initiated payout requests (pending + processing)
    const { data: partnerPayoutsData } = await supabase
      .from("partner_payouts")
      .select("amount")
      .in("status", ["pending", "processing"]);

    // Calculate pending payouts amount (admin-generated + partner-requested)
    const pendingPayoutsAmount =
      (pendingPayoutsRes.data || []).reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      ) +
      (partnerPayoutsData || []).reduce((sum, p) => sum + Number(p.amount), 0);

    // Calculate total commissions paid
    const totalCommissionsPaid = (commissionsRes.data || [])
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + Number(c.commission_amount), 0);

    // Calculate pending affiliate payouts
    const pendingAffiliatePayouts =
      pendingAffiliatePayoutsRes.data?.length || 0;

    // Process commission data for chart (last 30 days)
    const commissionMap: Record<string, { amount: number; count: number }> = {};
    (commissionsRes.data || []).forEach((c) => {
      const dateStr = new Date(c.created_at).toISOString().split("T")[0];
      if (!commissionMap[dateStr]) {
        commissionMap[dateStr] = { amount: 0, count: 0 };
      }
      commissionMap[dateStr].amount += Number(c.commission_amount);
      commissionMap[dateStr].count++;
    });

    const last30Days: CommissionData[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      last30Days.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        amount: commissionMap[dateStr]?.amount || 0,
        count: commissionMap[dateStr]?.count || 0,
      });
    }
    setCommissionData(last30Days);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: weeklySchedules } = await supabase
      .from("meal_schedules")
      .select("scheduled_date, meal_id")
      .gte("scheduled_date", weekAgo.toISOString().split("T")[0])
      .neq("order_status", "cancelled");

    const { data: weeklyOrders } = await supabase
      .from("orders")
      .select("created_at, total_amount")
      .gte(
        "created_at",
        `${weekAgo.toISOString().split("T")[0]}T00:00:00+03:00`,
      )
      .neq("status", "cancelled");

    const { data: allMeals } = await supabase.from("meals").select("id, price");

    const mealPrices = (allMeals || []).reduce(
      (acc, m) => {
        acc[m.id] = m.price || 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    let weeklyRevenue = 0;

    (weeklySchedules || []).forEach((s) => {
      if (!dailyMap[s.scheduled_date]) {
        dailyMap[s.scheduled_date] = { orders: 0, revenue: 0 };
      }
      dailyMap[s.scheduled_date].orders++;
      const price = mealPrices[s.meal_id] || 0;
      dailyMap[s.scheduled_date].revenue += price;
      weeklyRevenue += price;
    });

    (weeklyOrders || []).forEach((order) => {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Qatar",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(order.created_at));
      if (!dailyMap[date]) {
        dailyMap[date] = { orders: 0, revenue: 0 };
      }
      const amount = Number(order.total_amount) || 0;
      dailyMap[date].orders++;
      dailyMap[date].revenue += amount;
      weeklyRevenue += amount;
    });

    const last7Days: DailyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      last7Days.push({
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        orders: dailyMap[dateStr]?.orders || 0,
        revenue: dailyMap[dateStr]?.revenue || 0,
      });
    }
    setDailyData(last7Days);

    const { data: recentRestaurants } = await supabase
      .from("restaurants")
      .select("id, name, created_at, approval_status")
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: recentSchedules } = await supabase
      .from("meal_schedules")
      .select(
        "id, created_at, order_status, meals:meals!meal_schedules_meal_id_fkey(name)",
      )
      .order("created_at", { ascending: false })
      .neq("order_status", "cancelled")
      .limit(3);

    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, created_at, status, meal_id")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(3);

    const recentOrderMealIds = (recentOrders || [])
      .map((order) => order.meal_id)
      .filter(Boolean) as string[];
    const { data: recentOrderMeals } = recentOrderMealIds.length
      ? await supabase
          .from("meals")
          .select("id, name")
          .in("id", recentOrderMealIds)
      : { data: [] as { id: string; name: string }[] };
    const recentOrderMealMap = new Map(
      (recentOrderMeals || []).map((meal) => [meal.id, meal.name]),
    );

    const activities: RecentActivity[] = [];

    (recentRestaurants || []).forEach((r) => {
      activities.push({
        id: r.id,
        type: "restaurant",
        title: r.name,
        description:
          r.approval_status === "pending"
            ? "New registration"
            : `Status: ${r.approval_status}`,
        time: new Date(r.created_at || 0).toLocaleString(),
      });
    });

    (recentSchedules || []).forEach((s) => {
      activities.push({
        id: s.id,
        type: "order",
        title: s.meals?.name || "Meal Order",
        description:
          s.order_status === "completed"
            ? "Meal completed"
            : "New meal scheduled",
        time: new Date(s.created_at || 0).toLocaleString(),
      });
    });

    (recentOrders || []).forEach((order) => {
      activities.push({
        id: order.id,
        type: "order",
        title:
          (order.meal_id && recentOrderMealMap.get(order.meal_id)) ||
          "Direct order",
        description:
          order.status === "completed" || order.status === "delivered"
            ? "Order completed"
            : `Order status: ${order.status}`,
        time: new Date(order.created_at).toLocaleString(),
      });
    });

    setRecentActivity(
      activities
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 5),
    );

    setStats({
      totalRestaurants: restaurantsRes.count || 0,
      approvedRestaurants: approvedRes.count || 0,
      pendingApprovals: pendingRes.count || 0,
      totalUsers: profilesRes.count || 0,
      totalOrders: (schedulesRes.count || 0) + (ordersRes.count || 0),
      totalMeals: mealsRes.count || 0,
      todayOrders: (todaySchedulesRes.count || 0) + (todayOrdersRes.count || 0),
      weeklyRevenue,
      pendingPayouts:
        (pendingPayoutsRes.data?.length || 0) +
        (partnerPayoutsData?.length || 0),
      pendingPayoutsAmount,
      totalCommissionsPaid,
      pendingAffiliatePayouts,
      fleetOnlineDrivers: fleetDriversRes.count || 0,
      fleetOrdersInProgress: fleetOrdersRes.count || 0,
      fleetTodayDeliveries: fleetTodayRes.count || 0,
    });
  };

  const navItems = [
    {
      icon: Store,
      label: "Restaurants",
      to: "/admin/restaurants",
      count: stats.pendingApprovals,
      color: "#22C7A1",
    },
    { icon: Users, label: "Users", to: "/admin/users", color: "#7C83F6" },
    {
      icon: ShoppingBag,
      label: "Orders",
      to: "/admin/orders",
      color: "#22C7A1",
    },
    {
      icon: Wallet,
      label: "Payouts",
      to: "/admin/payouts",
      count: stats.pendingPayouts,
      color: "#F97316",
    },
    {
      icon: UserCheck,
      label: "Affiliates",
      to: "/admin/affiliate-payouts",
      count: stats.pendingAffiliatePayouts,
      color: "#38BDF8",
    },
    {
      icon: BarChart3,
      label: "Analytics",
      to: "/admin/analytics",
      color: "#7C83F6",
    },
  ];

  const metricCards = [
    {
      icon: Store,
      label: "Active restaurants",
      value: stats.approvedRestaurants.toLocaleString(),
      sub: `${stats.totalRestaurants.toLocaleString()} total`,
      color: "#22C7A1",
    },
    {
      icon: Users,
      label: "Total users",
      value: stats.totalUsers.toLocaleString(),
      sub: "Customer profiles",
      color: "#7C83F6",
    },
    {
      icon: ShoppingBag,
      label: "Today's orders",
      value: stats.todayOrders.toLocaleString(),
      sub: `${stats.totalOrders.toLocaleString()} all time`,
      color: "#22C7A1",
    },
    {
      icon: DollarSign,
      label: "Weekly revenue",
      value: formatCurrency(stats.weeklyRevenue),
      sub: "Scheduled meals",
      color: "#F97316",
    },
  ];

  const fleetCards = [
    {
      icon: Truck,
      label: "Online drivers",
      value: stats.fleetOnlineDrivers,
      color: "#22C7A1",
    },
    {
      icon: ShoppingBag,
      label: "In progress",
      value: stats.fleetOrdersInProgress,
      color: "#7C83F6",
    },
    {
      icon: BarChart3,
      label: "Delivered today",
      value: stats.fleetTodayDeliveries,
      color: "#38BDF8",
    },
  ];

  const priorityActions = [
    {
      show: stats.pendingApprovals > 0,
      to: "/admin/restaurants",
      icon: Clock,
      title: "Review restaurant applications",
      detail: `${stats.pendingApprovals} partner ${stats.pendingApprovals === 1 ? "application" : "applications"} waiting`,
      action: "Open queue",
      color: "#F97316",
    },
    {
      show: stats.pendingPayouts > 0,
      to: "/admin/payouts",
      icon: Wallet,
      title: "Release partner payouts",
      detail: `${stats.pendingPayouts} payout ${stats.pendingPayouts === 1 ? "request" : "requests"} worth ${formatCurrency(stats.pendingPayoutsAmount)}`,
      action: "Process",
      color: "#22C7A1",
    },
    {
      show: stats.pendingAffiliatePayouts > 0,
      to: "/admin/affiliate-payouts",
      icon: UserCheck,
      title: "Approve affiliate earnings",
      detail: `${stats.pendingAffiliatePayouts} affiliate ${stats.pendingAffiliatePayouts === 1 ? "payout" : "payouts"} pending`,
      action: "Review",
      color: "#38BDF8",
    },
  ].filter((item) => item.show);

  const operatingBrief = [
    {
      label: "Restaurants",
      value: `${stats.approvedRestaurants}/${stats.totalRestaurants}`,
      helper: "approved network",
      color: "#22C7A1",
    },
    {
      label: "Orders today",
      value: stats.todayOrders.toLocaleString(),
      helper: "active demand",
      color: "#F97316",
    },
    {
      label: "Drivers online",
      value: stats.fleetOnlineDrivers.toLocaleString(),
      helper: "fleet capacity",
      color: "#38BDF8",
    },
    {
      label: "Revenue week",
      value: formatCurrency(stats.weeklyRevenue),
      helper: "scheduled + direct",
      color: "#7C83F6",
    },
  ];

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Platform operations">
      <div className="space-y-5 bg-[#F6F8FB] text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Operating cockpit"
          title="Admin operations workbench"
          icon={Shield}
          accent="#22C7A1"
          description="One workspace for queues, money movement, partner supply, customer activity, and fleet readiness across the Nutrio platform."
          meta={[
            {
              label: "Restaurants",
              value: `${stats.approvedRestaurants}/${stats.totalRestaurants}`,
            },
            {
              label: "Today orders",
              value: stats.todayOrders.toLocaleString(),
            },
            {
              label: "Weekly revenue",
              value: formatCurrency(stats.weeklyRevenue),
            },
          ]}
          actions={
            <Link
              to="/admin/orders"
              className="inline-flex h-11 items-center rounded-[14px] border border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 text-sm font-black text-[#020617] hover:bg-[#22C7A1]/15"
            >
              Open operations
            </Link>
          }
        />

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_420px]">
          <div className="rounded-[20px] border border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <div className="border-b border-[#E5EAF1] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#22C7A1]/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">
                    <Shield className="h-3.5 w-3.5" />
                    Operating cockpit
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-[#020617]">
                    What needs attention now
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm font-semibold text-[#94A3B8]">
                    One workspace for queues, money movement, partner supply,
                    and fleet readiness.
                  </p>
                </div>
                <Link
                  to="/admin/orders"
                  className="hidden h-10 shrink-0 items-center rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] px-4 text-xs font-black text-[#020617] hover:bg-white lg:inline-flex"
                >
                  Open operations
                </Link>
              </div>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-2">
                {priorityActions.length > 0 ? (
                  priorityActions.map((item) => (
                    <Link key={item.title} to={item.to} className="block">
                      <div className="flex items-center justify-between gap-4 rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3 transition hover:border-[#020617]/20 hover:bg-white">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white ring-1 ring-[#E5EAF1]"
                            style={{ color: item.color }}
                          >
                            <item.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#020617]">
                              {item.title}
                            </p>
                            <p className="truncate text-xs font-semibold text-[#94A3B8]">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-[#E5EAF1] bg-white px-3 py-1 text-xs font-black text-[#020617]">
                          {item.action}
                        </span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-[#020617]">
                          No urgent queues
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                          Restaurant approvals, payouts, and affiliate queues
                          are clear.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#22C7A1]/10 px-3 py-1 text-xs font-black text-[#22C7A1]">
                        Clear
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      {[
                        {
                          label: "Check live orders",
                          to: "/admin/orders",
                          color: "#F97316",
                        },
                        {
                          label: "Review finance",
                          to: "/admin/profit",
                          color: "#22C7A1",
                        },
                        {
                          label: "Scan support",
                          to: "/admin/support",
                          color: "#7C83F6",
                        },
                      ].map((item) => (
                        <Link
                          key={item.label}
                          to={item.to}
                          className="rounded-[14px] border border-[#E5EAF1] bg-white p-3 transition hover:bg-[#F6F8FB]"
                        >
                          <span
                            className="mb-2 block h-1.5 w-7 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-xs font-black text-[#020617]">
                            {item.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-[16px] border border-[#E5EAF1] bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Today's operating brief
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {operatingBrief.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] p-3"
                    >
                      <span
                        className="mb-2 block h-1.5 w-8 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <p className="truncate text-lg font-black text-[#020617]">
                        {item.value}
                      </p>
                      <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                        {item.label}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-[#94A3B8]">
                        {item.helper}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <AdminPanel>
            <div className="border-b border-[#E5EAF1] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                Work lanes
              </p>
              <h2 className="mt-1 text-xl font-black text-[#020617]">
                Jump into a workflow
              </h2>
            </div>
            <div className="grid gap-2 p-4">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="group flex items-center justify-between gap-3 rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3 transition hover:bg-white"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white ring-1 ring-[#E5EAF1]"
                      style={{ color: item.color }}
                    >
                      <item.icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-black text-[#020617]">
                      {item.label}
                    </span>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                    {item.count && item.count > 0 ? item.count : "Open"}
                  </span>
                </Link>
              ))}
            </div>
          </AdminPanel>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <AdminMetricTile
              key={metric.label}
              label={metric.label}
              value={metric.value}
              subValue={metric.sub}
              icon={metric.icon}
              accent={
                metric.color as
                  | "#22C7A1"
                  | "#7C83F6"
                  | "#38BDF8"
                  | "#FB6B7A"
                  | "#F97316"
              }
              className="bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(2,6,23,0.075)]"
            />
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-[#020617]">
                <Truck className="h-5 w-5 text-[#7C83F6]" />
                Fleet operations
              </h2>
            </div>
            <div className="p-5 pt-4">
              <div className="grid grid-cols-3 gap-3">
                {fleetCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4"
                  >
                    <div
                      className="mb-3 grid h-10 w-10 place-items-center rounded-2xl bg-white"
                      style={{ color: item.color }}
                    >
                      <item.icon className="h-5 w-5" />
                    </div>
                    <p className="text-2xl font-black text-[#020617]">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs font-bold text-[#94A3B8]">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </AdminPanel>

          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h2 className="text-lg font-black text-[#020617]">
                Platform health
              </h2>
            </div>
            <div className="grid gap-3 p-5 pt-4">
              {[
                {
                  label: "Supply coverage",
                  value: `${stats.approvedRestaurants}/${stats.totalRestaurants}`,
                  helper: "approved restaurants",
                  icon: Store,
                  color: "#22C7A1",
                },
                {
                  label: "Fleet load",
                  value: `${stats.fleetOrdersInProgress}`,
                  helper: "deliveries in progress",
                  icon: Truck,
                  color: "#38BDF8",
                },
                {
                  label: "Money queue",
                  value: formatCurrency(stats.pendingPayoutsAmount),
                  helper: `${stats.pendingPayouts} payout requests`,
                  icon: Wallet,
                  color: "#F97316",
                },
                {
                  label: "Customer base",
                  value: stats.totalUsers.toLocaleString(),
                  helper: "registered profiles",
                  icon: Users,
                  color: "#7C83F6",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-3"
                >
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white ring-1 ring-[#E5EAF1]"
                    style={{ color: item.color }}
                  >
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-black text-[#020617]">
                        {item.label}
                      </p>
                      <p className="shrink-0 text-sm font-black text-[#020617]">
                        {item.value}
                      </p>
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-[#94A3B8]">
                      {item.helper}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AdminPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-black text-[#020617]">
                <TrendingUp className="h-5 w-5 text-[#22C7A1]" />
                Orders this week
              </h2>
            </div>
            <div className="p-5 pt-4">
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid stroke="#E5EAF1" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #E5EAF1",
                        borderRadius: "16px",
                        color: "#020617",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="orders"
                      stroke="#22C7A1"
                      strokeWidth={3}
                      dot={{ fill: "#22C7A1", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black text-[#020617]">
                  <UserCheck className="h-5 w-5 text-[#38BDF8]" />
                  Affiliate commissions
                </h2>
                <Badge className="rounded-full border border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1 font-black text-[#020617] hover:bg-[#F6F8FB]">
                  {formatCurrency(stats.totalCommissionsPaid)} paid
                </Badge>
              </div>
            </div>
            <div className="p-5 pt-4">
              <div className="h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={commissionData}>
                    <CartesianGrid stroke="#E5EAF1" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(value) => `${value}`}
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #E5EAF1",
                        borderRadius: "16px",
                        color: "#020617",
                      }}
                      formatter={(value: number) => [
                        formatCurrency(value),
                        "Commissions",
                      ]}
                    />
                    <defs>
                      <linearGradient
                        id="commissionGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#38BDF8"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#38BDF8"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#38BDF8"
                      strokeWidth={3}
                      fill="url(#commissionGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AdminPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h2 className="text-lg font-black text-[#020617]">
                Recent activity
              </h2>
            </div>
            <div className="space-y-3 p-5 pt-4">
              {recentActivity.length === 0 ? (
                <p className="rounded-[22px] bg-[#F6F8FB] py-6 text-center text-sm font-semibold text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                  No recent activity
                </p>
              ) : (
                recentActivity.map((activity) => {
                  const color =
                    activity.type === "restaurant"
                      ? "#22C7A1"
                      : activity.type === "order"
                        ? "#F97316"
                        : "#7C83F6";

                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-3"
                    >
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white"
                        style={{ color }}
                      >
                        {activity.type === "restaurant" && (
                          <Store className="h-5 w-5" />
                        )}
                        {activity.type === "order" && (
                          <ShoppingBag className="h-5 w-5" />
                        )}
                        {activity.type === "user" && (
                          <Users className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-[#020617]">
                          {activity.title}
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#94A3B8]">
                          {activity.description}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </AdminPanel>

          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h2 className="text-lg font-black text-[#020617]">
                Review cadence
              </h2>
            </div>
            <div className="p-5 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Morning queue",
                    detail: "Approvals, orders, and blocked deliveries",
                    to: "/admin/orders",
                    icon: ShoppingBag,
                    color: "#22C7A1",
                  },
                  {
                    label: "Finance close",
                    detail: "Payouts, wallets, and commissions",
                    to: "/admin/profit",
                    icon: Wallet,
                    color: "#F97316",
                  },
                  {
                    label: "Growth review",
                    detail: "Featured partners, promos, challenges",
                    to: "/admin/featured",
                    icon: TrendingUp,
                    color: "#7C83F6",
                  },
                ].map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="block h-full rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-[#7C83F6]/35"
                  >
                    <div className="relative h-full rounded-[16px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 transition hover:border-[#020617]/20 hover:bg-white hover:shadow-[0_12px_28px_rgba(2,6,23,0.06)]">
                      <div
                        className="mb-4 grid h-10 w-10 place-items-center rounded-[14px] bg-white ring-1 ring-[#E5EAF1]"
                        style={{ color: item.color }}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-black text-[#020617]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-[#94A3B8]">
                        {item.detail}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </AdminPanel>
        </section>

        <AdminPanel>
          <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <h2 className="text-lg font-black text-[#020617]">
              Platform overview
            </h2>
          </div>
          <div className="p-5 pt-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Total restaurants", stats.totalRestaurants],
                ["Total meals", stats.totalMeals],
                ["All-time orders", stats.totalOrders],
                ["Pending approvals", stats.pendingApprovals],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-center"
                >
                  <p className="text-3xl font-black text-[#020617]">{value}</p>
                  <p className="mt-2 text-xs font-bold text-[#94A3B8]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </AdminPanel>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
