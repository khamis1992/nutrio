import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

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

    const mealPrices = (meals || []).reduce((acc, m) => {
      acc[m.id] = m.price;
      return acc;
    }, {} as Record<string, number>);

    const mealRestaurants = (meals || []).reduce((acc, m) => {
      acc[m.id] = m.restaurant_id;
      return acc;
    }, {} as Record<string, string>);

    const { data: restaurants, count: restaurantCount } = await supabase
      .from("restaurants")
      .select("id, name", { count: "exact" })
      .eq("approval_status", "approved");

    const restaurantNames = (restaurants || []).reduce((acc, r) => {
      acc[r.id] = r.name;
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

    (schedules || []).forEach((s) => {
      if (!dailyMap[s.scheduled_date]) {
        dailyMap[s.scheduled_date] = { orders: 0, revenue: 0, users: new Set() };
      }
      dailyMap[s.scheduled_date].orders++;
      dailyMap[s.scheduled_date].revenue += mealPrices[s.meal_id] || 0;
      dailyMap[s.scheduled_date].users.add(s.user_id);
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
      (sum, s) => sum + (mealPrices[s.meal_id] || 0),
      0
    );

    const restaurantStats: Record<string, { orders: number; revenue: number }> = {};
    (schedules || []).forEach((s) => {
      const restaurantId = mealRestaurants[s.meal_id];
      if (!restaurantId) return;
      if (!restaurantStats[restaurantId]) {
        restaurantStats[restaurantId] = { orders: 0, revenue: 0 };
      }
      restaurantStats[restaurantId].orders++;
      restaurantStats[restaurantId].revenue += mealPrices[s.meal_id] || 0;
    });

    const topRestaurantsList = Object.entries(restaurantStats)
      .map(([id, stats]) => ({
        name: restaurantNames[id] || "Unknown",
        ...stats,
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
    setTopRestaurants(topRestaurantsList);

    const mealTypeCounts: Record<string, number> = {};
    (schedules || []).forEach((s) => {
      mealTypeCounts[s.meal_type] = (mealTypeCounts[s.meal_type] || 0) + 1;
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
      (s) => new Date(s.created_at) >= thisWeekStart
    ).length;
    const lastWeekOrders = (schedules || []).filter(
      (s) => new Date(s.created_at) >= lastWeekStart && new Date(s.created_at) < thisWeekStart
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

  return (
    <AdminLayout title="Platform Analytics" subtitle="Last 30 days overview">
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.avgOrderValue)}</p>
                  <p className="text-xs text-muted-foreground">Avg. Order Value</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={`${stats.growthRate >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className={`h-6 w-6 ${stats.growthRate >= 0 ? 'text-green-500' : 'text-red-500 rotate-180'}`} />
                <div>
                  <p className="font-medium">Weekly Growth</p>
                  <p className="text-sm text-muted-foreground">Compared to last week</p>
                </div>
              </div>
              <p className={`text-2xl font-bold ${stats.growthRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {stats.growthRate >= 0 ? '+' : ''}{stats.growthRate.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 sm:h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Daily Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 sm:h-56 md:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5" />
                Top Restaurants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topRestaurants.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data yet</p>
              ) : (
                topRestaurants.map((restaurant, index) => (
                  <div key={restaurant.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      <span className="font-medium truncate max-w-[150px]">{restaurant.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{restaurant.orders} orders</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(restaurant.revenue)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Meal Type Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mealTypeData.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data yet</p>
              ) : (
                <div className="h-40 sm:h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mealTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={30}
                        outerRadius={50}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => window.innerWidth >= 640 ? `${name} ${(percent * 100).toFixed(0)}%` : `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        fontSize={window.innerWidth < 640 ? 10 : 12}
                      >
                        {mealTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
