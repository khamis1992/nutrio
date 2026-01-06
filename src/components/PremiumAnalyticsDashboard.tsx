import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Crown,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Calendar,
  Repeat,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
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
  AreaChart,
  Area,
} from "recharts";

interface PremiumAnalyticsDashboardProps {
  restaurantId: string;
  premiumUntil: Date | null;
}

interface TrendData {
  date: string;
  revenue: number;
  orders: number;
}

interface HourlyData {
  hour: string;
  orders: number;
}

interface DayOfWeekData {
  day: string;
  orders: number;
  revenue: number;
}

export function PremiumAnalyticsDashboard({
  restaurantId,
  premiumUntil,
}: PremiumAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [trendData30, setTrendData30] = useState<TrendData[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [dayOfWeekData, setDayOfWeekData] = useState<DayOfWeekData[]>([]);
  const [customerMetrics, setCustomerMetrics] = useState({
    totalCustomers: 0,
    repeatCustomers: 0,
    repeatRate: 0,
    avgOrdersPerCustomer: 0,
  });
  const [growthMetrics, setGrowthMetrics] = useState({
    revenueGrowth: 0,
    orderGrowth: 0,
    customerGrowth: 0,
  });

  useEffect(() => {
    fetchPremiumAnalytics();
  }, [restaurantId]);

  const fetchPremiumAnalytics = async () => {
    try {
      setLoading(true);

      // Get meals for this restaurant
      const { data: meals } = await supabase
        .from("meals")
        .select("id, price")
        .eq("restaurant_id", restaurantId);

      const mealIds = meals?.map((m) => m.id) || [];
      const mealPriceMap = meals?.reduce((acc, m) => {
        acc[m.id] = m.price;
        return acc;
      }, {} as Record<string, number>) || {};

      if (mealIds.length === 0) {
        setLoading(false);
        return;
      }

      // Get all scheduled meals for last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: schedules } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, meal_id, user_id, created_at")
        .in("meal_id", mealIds)
        .gte("scheduled_date", ninetyDaysAgo.toISOString().split("T")[0]);

      if (!schedules || schedules.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate 30-day trend data
      const thirtyDaysData: TrendData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const daySchedules = schedules.filter((s) => s.scheduled_date === dateStr);
        const revenue = daySchedules.reduce(
          (sum, s) => sum + (mealPriceMap[s.meal_id] || 0),
          0
        );
        thirtyDaysData.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          orders: daySchedules.length,
          revenue,
        });
      }
      setTrendData30(thirtyDaysData);

      // Calculate hourly distribution (simulated based on created_at)
      const hourCounts: Record<string, number> = {};
      for (let i = 6; i <= 22; i++) {
        hourCounts[`${i}:00`] = 0;
      }
      schedules.forEach((s) => {
        const hour = new Date(s.created_at).getHours();
        const hourKey = `${hour}:00`;
        if (hourCounts[hourKey] !== undefined) {
          hourCounts[hourKey]++;
        }
      });
      setHourlyData(
        Object.entries(hourCounts).map(([hour, orders]) => ({ hour, orders }))
      );

      // Calculate day of week distribution
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayCounts: Record<string, { orders: number; revenue: number }> = {};
      dayNames.forEach((day) => (dayCounts[day] = { orders: 0, revenue: 0 }));
      schedules.forEach((s) => {
        const day = dayNames[new Date(s.scheduled_date).getDay()];
        dayCounts[day].orders++;
        dayCounts[day].revenue += mealPriceMap[s.meal_id] || 0;
      });
      setDayOfWeekData(
        dayNames.map((day) => ({
          day,
          orders: dayCounts[day].orders,
          revenue: dayCounts[day].revenue,
        }))
      );

      // Calculate customer metrics
      const customerOrders: Record<string, number> = {};
      schedules.forEach((s) => {
        customerOrders[s.user_id] = (customerOrders[s.user_id] || 0) + 1;
      });
      const totalCustomers = Object.keys(customerOrders).length;
      const repeatCustomers = Object.values(customerOrders).filter((c) => c > 1).length;
      const totalOrders = Object.values(customerOrders).reduce((a, b) => a + b, 0);

      setCustomerMetrics({
        totalCustomers,
        repeatCustomers,
        repeatRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
        avgOrdersPerCustomer: totalCustomers > 0 ? totalOrders / totalCustomers : 0,
      });

      // Calculate growth metrics (compare last 30 days to previous 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const recentSchedules = schedules.filter(
        (s) => new Date(s.scheduled_date) >= thirtyDaysAgo
      );
      const previousSchedules = schedules.filter(
        (s) =>
          new Date(s.scheduled_date) >= sixtyDaysAgo &&
          new Date(s.scheduled_date) < thirtyDaysAgo
      );

      const recentRevenue = recentSchedules.reduce(
        (sum, s) => sum + (mealPriceMap[s.meal_id] || 0),
        0
      );
      const previousRevenue = previousSchedules.reduce(
        (sum, s) => sum + (mealPriceMap[s.meal_id] || 0),
        0
      );

      const recentCustomers = new Set(recentSchedules.map((s) => s.user_id)).size;
      const previousCustomers = new Set(previousSchedules.map((s) => s.user_id)).size;

      setGrowthMetrics({
        revenueGrowth:
          previousRevenue > 0
            ? ((recentRevenue - previousRevenue) / previousRevenue) * 100
            : 0,
        orderGrowth:
          previousSchedules.length > 0
            ? ((recentSchedules.length - previousSchedules.length) /
                previousSchedules.length) *
              100
            : 0,
        customerGrowth:
          previousCustomers > 0
            ? ((recentCustomers - previousCustomers) / previousCustomers) * 100
            : 0,
      });
    } catch (error) {
      console.error("Error fetching premium analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Status Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-primary" />
              <div>
                <h3 className="font-semibold">Premium Analytics Active</h3>
                <p className="text-sm text-muted-foreground">
                  Expires: {premiumUntil?.toLocaleDateString()}
                </p>
              </div>
            </div>
            <Badge className="bg-primary">Premium</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Growth Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue Growth</p>
                <p className="text-2xl font-bold">
                  {growthMetrics.revenueGrowth >= 0 ? "+" : ""}
                  {growthMetrics.revenueGrowth.toFixed(1)}%
                </p>
              </div>
              {growthMetrics.revenueGrowth >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs previous 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Order Growth</p>
                <p className="text-2xl font-bold">
                  {growthMetrics.orderGrowth >= 0 ? "+" : ""}
                  {growthMetrics.orderGrowth.toFixed(1)}%
                </p>
              </div>
              {growthMetrics.orderGrowth >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs previous 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Customer Growth</p>
                <p className="text-2xl font-bold">
                  {growthMetrics.customerGrowth >= 0 ? "+" : ""}
                  {growthMetrics.customerGrowth.toFixed(1)}%
                </p>
              </div>
              {growthMetrics.customerGrowth >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs previous 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer Insights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xl font-bold">{customerMetrics.totalCustomers}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Repeat className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xl font-bold">{customerMetrics.repeatCustomers}</p>
                <p className="text-xs text-muted-foreground">Repeat Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xl font-bold">
                  {customerMetrics.repeatRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">Repeat Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-xl font-bold">
                  {customerMetrics.avgOrdersPerCustomer.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">Avg Orders/Customer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 30-Day Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">30-Day Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData30}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Peak Hours & Day of Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Peak Ordering Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="orders"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Orders by Day of Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? formatCurrency(value) : value,
                      name === "revenue" ? "Revenue" : "Orders",
                    ]}
                  />
                  <Bar
                    dataKey="orders"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
