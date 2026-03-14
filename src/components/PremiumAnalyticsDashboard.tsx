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
  AlertTriangle,
  DollarSign,
  Utensils,
  Star,
  ArrowUp,
  ArrowDown,
  Minus,
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
  ReferenceLine,
} from "recharts";

const PLATFORM_FEE = 0.18;

interface PremiumAnalyticsDashboardProps {
  restaurantId: string;
  premiumUntil: Date | null;
}

interface TrendData {
  date: string;
  revenue: number;
  orders: number;
  projected?: boolean;
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

interface MealPerf {
  id: string;
  name: string;
  orders: number;
  netRevenue: number;
  netPerOrder: number;
  label: "Star" | "Cash Cow" | "Rising" | "Underperformer";
}

interface ChurnSegment {
  atRisk: number;   // 14-21 days silent
  likelyLost: number; // 21-45 days silent
  lost: number;     // 45+ days silent
}

interface CustomerSegment {
  champions: number;
  loyal: number;
  atRisk: number;
  inactive: number;
  championRevenue: number;
  loyalRevenue: number;
}

interface DemandDay {
  date: string;
  dayLabel: string;
  dateLabel: string;
  predictedOrders: number;
  level: "Low" | "Medium" | "High";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyMeal(orders: number, netRevenue: number, medianOrders: number, medianRevenue: number): MealPerf["label"] {
  const highOrders = orders >= medianOrders;
  const highRevenue = netRevenue >= medianRevenue;
  if (highOrders && highRevenue) return "Star";
  if (!highOrders && highRevenue) return "Cash Cow";
  if (highOrders && !highRevenue) return "Rising";
  return "Underperformer";
}

const mealLabelConfig = {
  Star: { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: Star },
  "Cash Cow": { color: "bg-blue-500/10 text-blue-700 border-blue-200", icon: DollarSign },
  Rising: { color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: ArrowUp },
  Underperformer: { color: "bg-red-500/10 text-red-700 border-red-200", icon: ArrowDown },
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PremiumAnalyticsDashboard({
  restaurantId,
  premiumUntil,
}: PremiumAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
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

  // New feature state
  const [revenueForecast, setRevenueForecast] = useState<number>(0);
  const [churnData, setChurnData] = useState<ChurnSegment>({ atRisk: 0, likelyLost: 0, lost: 0 });
  const [menuPerf, setMenuPerf] = useState<MealPerf[]>([]);
  const [customerSegments, setCustomerSegments] = useState<CustomerSegment>({
    champions: 0, loyal: 0, atRisk: 0, inactive: 0, championRevenue: 0, loyalRevenue: 0,
  });
  const [demandCalendar, setDemandCalendar] = useState<DemandDay[]>([]);
  const [profitabilityData, setProfitabilityData] = useState<MealPerf[]>([]);

  useEffect(() => {
    fetchPremiumAnalytics();
  }, [restaurantId]);

  const fetchPremiumAnalytics = async () => {
    try {
      setLoading(true);

      const { data: meals } = await supabase
        .from("meals")
        .select("id, name, price")
        .eq("restaurant_id", restaurantId);

      const mealIds = meals?.map((m) => m.id) || [];
      const mealMap = meals?.reduce((acc, m) => {
        acc[m.id] = { name: m.name, price: m.price };
        return acc;
      }, {} as Record<string, { name: string; price: number }>) || {};

      if (mealIds.length === 0) {
        setLoading(false);
        return;
      }

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data: schedules } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, meal_type, meal_id, user_id, created_at")
        .in("meal_id", mealIds)
        .gte("scheduled_date", ninetyDaysAgo.toISOString().split("T")[0]);

      if (!schedules || schedules.length === 0) {
        setLoading(false);
        return;
      }

      const now = new Date();

      // ── Existing: 30-day trend ──────────────────────────────────────────────
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const historicalData: TrendData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const daySchedules = schedules.filter((s) => s.scheduled_date === dateStr);
        const revenue = daySchedules.reduce((sum, s) => sum + (mealMap[s.meal_id]?.price || 0) * (1 - PLATFORM_FEE), 0);
        historicalData.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          orders: daySchedules.length,
          revenue,
        });
      }

      // ── Feature 2: Revenue Forecast ────────────────────────────────────────
      const avgDailyRevenue = historicalData.reduce((sum, d) => sum + d.revenue, 0) / 30;
      const forecastedMonthlyRevenue = avgDailyRevenue * 30;
      setRevenueForecast(forecastedMonthlyRevenue);

      // Extend chart with 14-day projection
      const projectedData: TrendData[] = [];
      for (let i = 1; i <= 14; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        projectedData.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          revenue: 0,
          orders: 0,
          projected: true,
        });
        // We'll draw forecast as a separate series using avgDailyRevenue
        projectedData[i - 1].revenue = avgDailyRevenue;
      }
      setTrendData([...historicalData, ...projectedData]);

      // ── Existing: hourly distribution ──────────────────────────────────────
      const hourCounts: Record<string, number> = {};
      for (let i = 6; i <= 22; i++) hourCounts[`${i}:00`] = 0;
      schedules.forEach((s) => {
        const hour = new Date(s.created_at).getHours();
        const key = `${hour}:00`;
        if (hourCounts[key] !== undefined) hourCounts[key]++;
      });
      setHourlyData(Object.entries(hourCounts).map(([hour, orders]) => ({ hour, orders })));

      // ── Existing: day-of-week distribution ─────────────────────────────────
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayCounts: Record<string, { orders: number; revenue: number }> = {};
      dayNames.forEach((day) => (dayCounts[day] = { orders: 0, revenue: 0 }));
      schedules.forEach((s) => {
        const day = dayNames[new Date(s.scheduled_date).getDay()];
        dayCounts[day].orders++;
        dayCounts[day].revenue += (mealMap[s.meal_id]?.price || 0) * (1 - PLATFORM_FEE);
      });
      setDayOfWeekData(dayNames.map((day) => ({ day, orders: dayCounts[day].orders, revenue: dayCounts[day].revenue })));

      // ── Existing: customer metrics ──────────────────────────────────────────
      const customerOrders: Record<string, { count: number; lastDate: string }> = {};
      schedules.forEach((s) => {
        if (!customerOrders[s.user_id]) {
          customerOrders[s.user_id] = { count: 0, lastDate: s.scheduled_date };
        }
        customerOrders[s.user_id].count++;
        if (s.scheduled_date > customerOrders[s.user_id].lastDate) {
          customerOrders[s.user_id].lastDate = s.scheduled_date;
        }
      });
      const totalCustomers = Object.keys(customerOrders).length;
      const repeatCustomers = Object.values(customerOrders).filter((c) => c.count > 1).length;
      const totalOrders = Object.values(customerOrders).reduce((a, b) => a + b.count, 0);
      setCustomerMetrics({
        totalCustomers,
        repeatCustomers,
        repeatRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
        avgOrdersPerCustomer: totalCustomers > 0 ? totalOrders / totalCustomers : 0,
      });

      // ── Existing: growth metrics ────────────────────────────────────────────
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const recentSchedules = schedules.filter((s) => new Date(s.scheduled_date) >= thirtyDaysAgo);
      const previousSchedules = schedules.filter(
        (s) => new Date(s.scheduled_date) >= sixtyDaysAgo && new Date(s.scheduled_date) < thirtyDaysAgo
      );
      const recentRevenue = recentSchedules.reduce((sum, s) => sum + (mealMap[s.meal_id]?.price || 0) * (1 - PLATFORM_FEE), 0);
      const previousRevenue = previousSchedules.reduce((sum, s) => sum + (mealMap[s.meal_id]?.price || 0) * (1 - PLATFORM_FEE), 0);
      const recentCustomers = new Set(recentSchedules.map((s) => s.user_id)).size;
      const previousCustomers = new Set(previousSchedules.map((s) => s.user_id)).size;
      setGrowthMetrics({
        revenueGrowth: previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
        orderGrowth: previousSchedules.length > 0 ? ((recentSchedules.length - previousSchedules.length) / previousSchedules.length) * 100 : 0,
        customerGrowth: previousCustomers > 0 ? ((recentCustomers - previousCustomers) / previousCustomers) * 100 : 0,
      });

      // ── Feature 1: Churn Alert ─────────────────────────────────────────────
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];
      const prev60Customers = new Set(
        schedules.filter((s) => s.scheduled_date >= sixtyDaysAgoStr).map((s) => s.user_id)
      );

      const cutoff14 = new Date(now); cutoff14.setDate(cutoff14.getDate() - 14);
      const cutoff21 = new Date(now); cutoff21.setDate(cutoff21.getDate() - 21);
      const cutoff45 = new Date(now); cutoff45.setDate(cutoff45.getDate() - 45);

      let atRisk = 0, likelyLost = 0, lost = 0;
      prev60Customers.forEach((uid) => {
        const lastDate = customerOrders[uid]?.lastDate;
        if (!lastDate) return;
        const daysSince = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince >= 45) lost++;
        else if (daysSince >= 21) likelyLost++;
        else if (daysSince >= 14) atRisk++;
      });
      setChurnData({ atRisk, likelyLost, lost });

      // ── Feature 3: Menu Performance Matrix ────────────────────────────────
      const mealStats: Record<string, { orders: number; netRevenue: number }> = {};
      mealIds.forEach((id) => { mealStats[id] = { orders: 0, netRevenue: 0 }; });
      schedules.forEach((s) => {
        if (mealStats[s.meal_id]) {
          mealStats[s.meal_id].orders++;
          mealStats[s.meal_id].netRevenue += (mealMap[s.meal_id]?.price || 0) * (1 - PLATFORM_FEE);
        }
      });
      const allOrders = Object.values(mealStats).map((m) => m.orders);
      const allRevenues = Object.values(mealStats).map((m) => m.netRevenue);
      const medOrders = median(allOrders);
      const medRevenue = median(allRevenues);

      const perfList: MealPerf[] = Object.entries(mealStats).map(([id, stats]) => ({
        id,
        name: mealMap[id]?.name || "Unknown",
        orders: stats.orders,
        netRevenue: stats.netRevenue,
        netPerOrder: stats.orders > 0 ? stats.netRevenue / stats.orders : 0,
        label: classifyMeal(stats.orders, stats.netRevenue, medOrders, medRevenue),
      }));
      setMenuPerf(perfList.sort((a, b) => b.netRevenue - a.netRevenue));

      // ── Feature 4: Customer Segments ──────────────────────────────────────
      const sevenDaysAgoStr = new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0];
      const fourteenDaysAgoStr = new Date(now.getTime() - 14 * 86400000).toISOString().split("T")[0];
      const twentyOneDaysAgoStr = new Date(now.getTime() - 21 * 86400000).toISOString().split("T")[0];

      let champions = 0, loyal = 0, csAtRisk = 0, inactive = 0;
      let championRevenue = 0, loyalRevenue = 0;

      Object.entries(customerOrders).forEach(([, stats]) => {
        const { count, lastDate } = stats;
        const revenueContrib = count * avgDailyRevenue / (totalCustomers || 1);
        if (count >= 5 && lastDate >= sevenDaysAgoStr) {
          champions++;
          championRevenue += revenueContrib;
        } else if (count >= 3 && lastDate >= fourteenDaysAgoStr) {
          loyal++;
          loyalRevenue += revenueContrib;
        } else if (lastDate < twentyOneDaysAgoStr && lastDate >= sixtyDaysAgoStr) {
          csAtRisk++;
        } else if (lastDate < sixtyDaysAgoStr) {
          inactive++;
        }
      });
      setCustomerSegments({ champions, loyal, atRisk: csAtRisk, inactive, championRevenue, loyalRevenue });

      // ── Feature 5: Demand Forecast Calendar ───────────────────────────────
      const dayAvgs: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
      const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000);
      schedules
        .filter((s) => new Date(s.scheduled_date) >= fourWeeksAgo)
        .forEach((s) => {
          const dow = new Date(s.scheduled_date).getDay();
          dayAvgs[dow].push(1);
        });
      const dowAvg: Record<number, number> = {};
      [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
        dowAvg[d] = dayAvgs[d].length / 4;
      });
      const allAvgs = Object.values(dowAvg);
      const maxAvg = Math.max(...allAvgs, 1);
      const calendarDays: DemandDay[] = [];
      for (let i = 1; i <= 14; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        const dow = date.getDay();
        const predicted = Math.round(dowAvg[dow]);
        const ratio = dowAvg[dow] / maxAvg;
        const level: DemandDay["level"] = ratio >= 0.7 ? "High" : ratio >= 0.4 ? "Medium" : "Low";
        calendarDays.push({
          date: date.toISOString().split("T")[0],
          dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
          dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          predictedOrders: predicted,
          level,
        });
      }
      setDemandCalendar(calendarDays);

      // ── Feature 6: Profitability Report ───────────────────────────────────
      setProfitabilityData(perfList.slice(0, 8));
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
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalChurn = churnData.atRisk + churnData.likelyLost + churnData.lost;
  const underperformer = menuPerf.find((m) => m.label === "Underperformer");
  const topEarner = profitabilityData[0];

  const demandColors = {
    High: "bg-red-100 border-red-200 text-red-700",
    Medium: "bg-amber-100 border-amber-200 text-amber-700",
    Low: "bg-emerald-100 border-emerald-200 text-emerald-700",
  };

  return (
    <div className="space-y-8">

      {/* Premium Status Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="pt-4 pb-4">
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

      {/* ── Feature 1: Churn Alert ──────────────────────────────────────────── */}
      {totalChurn > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Customer Churn Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 mb-4">
              <span className="font-bold text-xl text-red-700">{totalChurn}</span> customers who previously ordered regularly are showing signs of churn.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "At Risk", count: churnData.atRisk, sub: "14–21 days silent", color: "border-amber-300 bg-amber-50 text-amber-800" },
                { label: "Likely Lost", count: churnData.likelyLost, sub: "21–45 days silent", color: "border-orange-300 bg-orange-50 text-orange-800" },
                { label: "Lost", count: churnData.lost, sub: "45+ days silent", color: "border-red-300 bg-red-50 text-red-800" },
              ].map(({ label, count, sub, color }) => (
                <div key={label} className={`rounded-lg border p-3 text-center ${color}`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Feature 2: Revenue Forecast ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              30-Day Revenue Trend + Forecast
            </CardTitle>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Projected next month</p>
              <p className="font-bold text-emerald-600">{formatCurrency(revenueForecast)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                  interval={Math.floor(trendData.length / 8)} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={55}
                  tickFormatter={(v) => `${v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  formatter={(value: number, _: string, props: any) => [
                    formatCurrency(value),
                    props?.payload?.projected ? "Projected" : "Net Revenue",
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#colorRevenue)"
                  strokeWidth={2} dot={false}
                  strokeDasharray={(d: any) => d?.projected ? "4 4" : "0"}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Dashed section shows 14-day projection based on your 30-day daily average
          </p>
        </CardContent>
      </Card>

      {/* ── Growth Metrics (existing) ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Revenue Growth", value: growthMetrics.revenueGrowth },
          { label: "Order Growth", value: growthMetrics.orderGrowth },
          { label: "Customer Growth", value: growthMetrics.customerGrowth },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">
                    {value >= 0 ? "+" : ""}{value.toFixed(1)}%
                  </p>
                </div>
                {value >= 0
                  ? <TrendingUp className="h-8 w-8 text-green-500" />
                  : <TrendingDown className="h-8 w-8 text-red-500" />}
              </div>
              <p className="text-xs text-muted-foreground mt-1">vs previous 30 days</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Feature 4: Customer Segments ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Customer Segments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Champions",
                count: customerSegments.champions,
                sub: "5+ orders, active this week",
                color: "border-emerald-200 bg-emerald-50 text-emerald-800",
                dotColor: "bg-emerald-500",
              },
              {
                label: "Loyal",
                count: customerSegments.loyal,
                sub: "3–4 orders, active recently",
                color: "border-blue-200 bg-blue-50 text-blue-800",
                dotColor: "bg-blue-500",
              },
              {
                label: "At Risk",
                count: customerSegments.atRisk,
                sub: "Quiet for 21+ days",
                color: "border-amber-200 bg-amber-50 text-amber-800",
                dotColor: "bg-amber-500",
              },
              {
                label: "Inactive",
                count: customerSegments.inactive,
                sub: "No orders in 60+ days",
                color: "border-gray-200 bg-gray-50 text-gray-700",
                dotColor: "bg-gray-400",
              },
            ].map(({ label, count, sub, color, dotColor }) => (
              <div key={label} className={`rounded-lg border p-4 ${color}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <span className="text-xs font-medium">{label}</span>
                </div>
                <p className="text-3xl font-bold">{count}</p>
                <p className="text-xs opacity-60 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Existing customer metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { icon: Users, label: "Total Customers", value: customerMetrics.totalCustomers, color: "text-primary" },
              { icon: Repeat, label: "Repeat Customers", value: customerMetrics.repeatCustomers, color: "text-green-500" },
              { icon: Target, label: "Repeat Rate", value: `${customerMetrics.repeatRate.toFixed(1)}%`, color: "text-blue-500" },
              { icon: Calendar, label: "Avg Orders/Customer", value: customerMetrics.avgOrdersPerCustomer.toFixed(1), color: "text-purple-500" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-lg bg-muted/50 p-3 flex items-center gap-3">
                <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                <div>
                  <p className="text-lg font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Feature 3: Menu Performance Matrix ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="h-4 w-4 text-primary" />
            Menu Performance Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {underperformer && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">
                <span className="font-semibold">Quick Action:</span> "{underperformer.name}" has only {underperformer.orders} orders in 90 days — consider removing it.
              </p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Meal</th>
                  <th className="pb-2 font-medium text-center">Status</th>
                  <th className="pb-2 font-medium text-right">Orders</th>
                  <th className="pb-2 font-medium text-right">Net/Order</th>
                  <th className="pb-2 font-medium text-right">Total Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {menuPerf.map((meal) => {
                  const cfg = mealLabelConfig[meal.label];
                  return (
                    <tr key={meal.id} className="py-2">
                      <td className="py-2.5 pr-4 font-medium max-w-[140px] truncate">{meal.name}</td>
                      <td className="py-2.5 text-center">
                        <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                          {meal.label}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">{meal.orders}</td>
                      <td className="py-2.5 text-right">{formatCurrency(meal.netPerOrder)}</td>
                      <td className="py-2.5 text-right font-semibold text-emerald-600">{formatCurrency(meal.netRevenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Feature 6: Profitability Report ───────────────────────────────── */}
      {topEarner && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Profitability Report
              <span className="text-xs font-normal text-muted-foreground">(net after 18% platform fee)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 mb-4 flex items-center gap-3">
              <Star className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">
                Top earner: <span className="font-semibold">{topEarner.name}</span> — {formatCurrency(topEarner.netPerOrder)} net per order, {formatCurrency(topEarner.netRevenue)} total (90 days)
              </p>
            </div>
            <div className="space-y-2">
              {profitabilityData.map((meal, i) => {
                const pct = topEarner.netRevenue > 0 ? (meal.netRevenue / topEarner.netRevenue) * 100 : 0;
                return (
                  <div key={meal.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium truncate max-w-[160px]">{meal.name}</span>
                        <span className="text-sm font-semibold text-emerald-600 ml-2">{formatCurrency(meal.netRevenue)}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                      {meal.orders} orders
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Feature 5: Demand Forecast Calendar ───────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            14-Day Demand Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1.5">
            {demandCalendar.map((day) => (
              <div key={day.date} className={`rounded-lg border p-2 text-center ${demandColors[day.level]}`}>
                <p className="text-xs font-semibold">{day.dayLabel}</p>
                <p className="text-xs opacity-70">{day.dateLabel}</p>
                <p className="text-sm font-bold mt-1">~{day.predictedOrders}</p>
                <p className="text-xs opacity-60">{day.level}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Predicted orders based on your day-of-week patterns (last 4 weeks)
          </p>
        </CardContent>
      </Card>

      {/* ── Peak Hours + Day of Week (existing) ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Peak Ordering Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Orders by Day of Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? formatCurrency(value) : value,
                      name === "revenue" ? "Net Revenue" : "Orders",
                    ]}
                  />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
