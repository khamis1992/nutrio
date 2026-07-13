import { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Store,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/currency";

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
  users: number;
}

interface TopRestaurant {
  name: string;
  orders: number;
  revenue: number;
}

interface MealTypeData {
  name: string;
  value: number;
}

const CHART_COLORS = ["#22C7A1", "#7C83F6", "#38BDF8", "#FB6B7A"];

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;
  soft: string;
};

function MetricCard({ label, value, icon: Icon, accent, soft }: MetricCardProps) {
  return (
    <div className="rounded-[20px] bg-white p-4 shadow-sm ring-1 ring-[#E5EAF1]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-3xl font-black leading-none text-[#020617]">{value}</p>
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]" style={{ backgroundColor: soft, color: accent }}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children, icon: Icon, accent }: { title: string; children: React.ReactNode; icon?: React.ElementType; accent?: string }) {
  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
        <h2 className="text-lg font-black text-[#020617]">{title}</h2>
        {Icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-white ring-1 ring-[#E5EAF1]" style={{ color: accent || "#020617" }}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

const AdminAnalytics = () => {
  const { user } = useAuth();

  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [mealTypeData, setMealTypeData] = useState<MealTypeData[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    activeRestaurants: 0,
    totalMeals: 0,
    totalUsers: 0,
    growthRate: 0,
  });

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("admin-analytics-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_schedules" },
        () => { fetchAnalytics(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meals" },
        () => { fetchAnalytics(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAnalytics = async () => {
    const { data: meals } = await supabase
      .from("meals")
      .select("id, price, restaurant_id");

    const mealPrices = (meals || []).reduce((acc, meal) => {
      acc[meal.id] = meal.price ?? 0;
      return acc;
    }, {} as Record<string, number>);

    const mealRestaurants = (meals || []).reduce((acc, meal) => {
      if (meal.restaurant_id) acc[meal.id] = meal.restaurant_id;
      return acc;
    }, {} as Record<string, string>);

    const { data: restaurants, count: restaurantCount } = await supabase
      .from("restaurants")
      .select("id, name", { count: "exact" })
      .eq("approval_status", "approved");

    const restaurantNames = (restaurants || []).reduce((acc, restaurant) => {
      acc[restaurant.id] = restaurant.name;
      return acc;
    }, {} as Record<string, string>);

    const { data: schedules, count: totalOrders } = await supabase
      .from("meal_schedules")
      .select("*", { count: "exact" })
      .neq("order_status", "cancelled");

    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const last30Days: DailyData[] = [];
    const dailyMap: Record<string, { orders: number; revenue: number; users: Set<string> }> = {};

    (schedules || []).forEach((schedule) => {
      if (!dailyMap[schedule.scheduled_date]) {
        dailyMap[schedule.scheduled_date] = { orders: 0, revenue: 0, users: new Set() };
      }
      dailyMap[schedule.scheduled_date].orders++;
      dailyMap[schedule.scheduled_date].revenue += mealPrices[schedule.meal_id] || 0;
      dailyMap[schedule.scheduled_date].users.add(schedule.user_id);
    });

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      last30Days.push({
        date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        orders: dailyMap[dateStr]?.orders || 0,
        revenue: dailyMap[dateStr]?.revenue || 0,
        users: dailyMap[dateStr]?.users.size || 0,
      });
    }
    setDailyData(last30Days);

    const totalRevenue = (schedules || []).reduce(
      (sum, schedule) => sum + (mealPrices[schedule.meal_id] || 0),
      0
    );

    const restaurantStats: Record<string, { orders: number; revenue: number }> = {};
    (schedules || []).forEach((schedule) => {
      const restaurantId = mealRestaurants[schedule.meal_id];
      if (!restaurantId) return;
      if (!restaurantStats[restaurantId]) {
        restaurantStats[restaurantId] = { orders: 0, revenue: 0 };
      }
      restaurantStats[restaurantId].orders++;
      restaurantStats[restaurantId].revenue += mealPrices[schedule.meal_id] || 0;
    });

    const topRestaurantsList = Object.entries(restaurantStats)
      .map(([id, restaurantStatsItem]) => ({
        name: restaurantNames[id] || "Unknown",
        ...restaurantStatsItem,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
    setTopRestaurants(topRestaurantsList);

    const mealTypeCounts: Record<string, number> = {};
    (schedules || []).forEach((schedule) => {
      mealTypeCounts[schedule.meal_type] = (mealTypeCounts[schedule.meal_type] || 0) + 1;
    });
    setMealTypeData(
      Object.entries(mealTypeCounts).map(([name, value]) => ({ name, value }))
    );

    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);

    const thisWeekOrders = (schedules || []).filter(
      (schedule) => schedule.created_at !== null && new Date(schedule.created_at) >= thisWeekStart
    ).length;
    const lastWeekOrders = (schedules || []).filter(
      (schedule) => schedule.created_at !== null && new Date(schedule.created_at) >= lastWeekStart && new Date(schedule.created_at) < thisWeekStart
    ).length;

    const growthRate = lastWeekOrders > 0
      ? ((thisWeekOrders - lastWeekOrders) / lastWeekOrders) * 100
      : 0;

    setStats({
      totalRevenue,
      totalOrders: totalOrders || 0,
      avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
      activeRestaurants: restaurantCount || 0,
      totalMeals: meals?.length || 0,
      totalUsers: totalUsers || 0,
      growthRate,
    });
  };

  const tooltipStyle = {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E5EAF1",
    borderRadius: "14px",
    color: "#020617",
    fontWeight: 700,
  };

  return (
    <AdminLayout title="Platform Analytics" subtitle="Last 30 days overview">
      <div className="space-y-5 text-[#020617]">
        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Platform Performance</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">Analytics</h1>
              <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Revenue, orders, restaurants, users, and meal demand for the last 30 days.</p>
            </div>
            <div className={`rounded-[18px] px-4 py-3 ring-1 ${stats.growthRate >= 0 ? "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20" : "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FB6B7A]/20"}`}>
              <div className="flex items-center gap-3">
                <TrendingUp className={`h-5 w-5 ${stats.growthRate < 0 ? "rotate-180" : ""}`} />
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.12em]">Weekly Growth</p>
                  <p className="text-xl font-black">{stats.growthRate >= 0 ? "+" : ""}{stats.growthRate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} accent="#22C7A1" soft="#EFFFFA" />
            <MetricCard label="Total Orders" value={stats.totalOrders} icon={ShoppingBag} accent="#020617" soft="#F6F8FB" />
            <MetricCard label="Avg. Order Value" value={formatCurrency(stats.avgOrderValue)} icon={TrendingUp} accent="#38BDF8" soft="#EFF9FF" />
            <MetricCard label="Total Users" value={stats.totalUsers} icon={Users} accent="#7C83F6" soft="#F3F4FF" />
          </div>

          <div className="grid grid-cols-2 border-t border-[#E5EAF1] sm:grid-cols-4">
            {[
              { label: "Approved Restaurants", value: stats.activeRestaurants },
              { label: "Meals Listed", value: stats.totalMeals },
              { label: "Chart Window", value: "30d" },
              { label: "Live Sync", value: "On" },
            ].map((item, index) => (
              <div key={item.label} className={`p-4 ${index > 0 ? "border-l border-[#E5EAF1]" : ""}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{item.label}</p>
                <p className="mt-1 text-lg font-black text-[#020617]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Revenue Trend" icon={DollarSign} accent="#22C7A1">
            <div className="h-56 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF1" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 700 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 700 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="revenue" stroke="#22C7A1" strokeWidth={3} dot={{ r: 3, fill: "#22C7A1", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Daily Orders" icon={ShoppingBag} accent="#38BDF8">
            <div className="h-56 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF1" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 700 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8", fontWeight: 700 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="orders" fill="#38BDF8" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Top Restaurants" icon={Store} accent="#7C83F6">
            {topRestaurants.length === 0 ? (
              <div className="rounded-[20px] bg-[#F6F8FB] py-8 text-center ring-1 ring-[#E5EAF1]">
                <p className="text-sm font-black text-[#020617]">No data yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topRestaurants.map((restaurant, index) => (
                  <div key={restaurant.name} className="flex items-center justify-between gap-3 rounded-[18px] border border-[#E5EAF1] bg-white p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[#F3F4FF] text-sm font-black text-[#7C83F6]">{index + 1}</span>
                      <span className="truncate font-black text-[#020617]">{restaurant.name}</span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-black text-[#020617]">{restaurant.orders} orders</p>
                      <p className="text-xs font-semibold text-[#94A3B8]">{formatCurrency(restaurant.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Meal Type Distribution" icon={Utensils} accent="#FB6B7A">
            {mealTypeData.length === 0 ? (
              <div className="rounded-[20px] bg-[#F6F8FB] py-8 text-center ring-1 ring-[#E5EAF1]">
                <p className="text-sm font-black text-[#020617]">No data yet</p>
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={mealTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={34}
                      outerRadius={56}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      fontSize={11}
                    >
                      {mealTypeData.map((entry, index) => (
                        <Cell key={`cell-${entry.name}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
