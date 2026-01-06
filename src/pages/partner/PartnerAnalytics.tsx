import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
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

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface MealStats {
  name: string;
  orders: number;
  revenue: number;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const PartnerAnalytics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [topMeals, setTopMeals] = useState<MealStats[]>([]);
  const [mealTypeDistribution, setMealTypeDistribution] = useState<{ name: string; value: number }[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
    uniqueCustomers: 0,
  });

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get partner's restaurant
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!restaurant) {
        navigate("/partner");
        return;
      }

      // Get meals for this restaurant
      const { data: meals } = await supabase
        .from("meals")
        .select("id, name, price")
        .eq("restaurant_id", restaurant.id);

      const mealIds = meals?.map((m) => m.id) || [];
      const mealMap = meals?.reduce((acc, m) => {
        acc[m.id] = { name: m.name, price: m.price };
        return acc;
      }, {} as Record<string, { name: string; price: number }>) || {};

      if (mealIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get all scheduled meals
      const { data: schedules } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, meal_type, meal_id, user_id")
        .in("meal_id", mealIds);

      if (!schedules || schedules.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate daily data for last 7 days
      const last7Days: DailyData[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const daySchedules = schedules.filter((s) => s.scheduled_date === dateStr);
        const revenue = daySchedules.reduce((sum, s) => sum + (mealMap[s.meal_id]?.price || 0), 0);
        last7Days.push({
          date: date.toLocaleDateString("en-US", { weekday: "short" }),
          orders: daySchedules.length,
          revenue,
        });
      }
      setDailyData(last7Days);

      // Calculate top meals
      const mealCounts: Record<string, { orders: number; revenue: number }> = {};
      schedules.forEach((s) => {
        if (!mealCounts[s.meal_id]) {
          mealCounts[s.meal_id] = { orders: 0, revenue: 0 };
        }
        mealCounts[s.meal_id].orders++;
        mealCounts[s.meal_id].revenue += mealMap[s.meal_id]?.price || 0;
      });

      const topMealsList = Object.entries(mealCounts)
        .map(([id, stats]) => ({
          name: mealMap[id]?.name || "Unknown",
          ...stats,
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);
      setTopMeals(topMealsList);

      // Calculate meal type distribution
      const mealTypeCounts: Record<string, number> = {};
      schedules.forEach((s) => {
        mealTypeCounts[s.meal_type] = (mealTypeCounts[s.meal_type] || 0) + 1;
      });
      setMealTypeDistribution(
        Object.entries(mealTypeCounts).map(([name, value]) => ({ name, value }))
      );

      // Calculate total stats
      const uniqueCustomers = new Set(schedules.map((s) => s.user_id)).size;
      const totalRevenue = schedules.reduce((sum, s) => sum + (mealMap[s.meal_id]?.price || 0), 0);
      setTotalStats({
        totalOrders: schedules.length,
        totalRevenue,
        avgOrderValue: schedules.length > 0 ? totalRevenue / schedules.length : 0,
        uniqueCustomers,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <PartnerLayout title="Analytics">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout title="Analytics" subtitle="Track your performance">
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStats.totalOrders}</p>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${totalStats.totalRevenue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
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
                  <p className="text-2xl font-bold">${totalStats.avgOrderValue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Avg Order Value</p>
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
                  <p className="text-2xl font-bold">{totalStats.uniqueCustomers}</p>
                  <p className="text-xs text-muted-foreground">Unique Customers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
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
                    dot={{ fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Orders Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Orders (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
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

        {/* Top Meals & Meal Type Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Utensils className="h-5 w-5" />
                Top Meals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topMeals.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data yet</p>
              ) : (
                topMeals.map((meal, index) => (
                  <div key={meal.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                      <span className="font-medium truncate max-w-[150px]">{meal.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{meal.orders} orders</p>
                      <p className="text-xs text-muted-foreground">${meal.revenue.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Meal Type Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {mealTypeDistribution.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No data yet</p>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mealTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {mealTypeDistribution.map((entry, index) => (
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
    </PartnerLayout>
  );
};

export default PartnerAnalytics;
