import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Zap,
  Link2,
  UserCheck,
  Printer,
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
  label: "Top Seller" | "High Value" | "Growing" | "Needs Attention";
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

interface WeeklyDigest {
  thisRevenue: number;
  lastRevenue: number;
  thisOrders: number;
  lastOrders: number;
  newCustomers: number;
  returningCustomers: number;
  revenueDelta: number;
  orderDelta: number;
}

interface MealCombo {
  meal1: string;
  meal2: string;
  count: number;
  pct: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyMeal(orders: number, netRevenue: number, medianOrders: number, medianRevenue: number): MealPerf["label"] {
  const highOrders = orders >= medianOrders;
  const highRevenue = netRevenue >= medianRevenue;
  if (highOrders && highRevenue) return "Top Seller";
  if (!highOrders && highRevenue) return "High Value";
  if (highOrders && !highRevenue) return "Growing";
  return "Needs Attention";
}

const mealLabelConfig: Record<MealPerf["label"], { color: string; icon: typeof Star; description: string }> = {
  "Top Seller":      { color: "bg-emerald-500/10 text-emerald-700 border-emerald-200", icon: Star,     description: "Popular & profitable — promote it" },
  "High Value":      { color: "bg-blue-500/10 text-blue-700 border-blue-200",          icon: DollarSign, description: "High profit per order — keep it" },
  "Growing":         { color: "bg-amber-500/10 text-amber-700 border-amber-200",        icon: ArrowUp,  description: "Getting popular — feature it more" },
  "Needs Attention": { color: "bg-red-500/10 text-red-700 border-red-200",              icon: ArrowDown, description: "Low orders & profit — consider removing" },
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
  const [weeklyDigest, setWeeklyDigest] = useState<WeeklyDigest | null>(null);
  const [returnRate, setReturnRate] = useState<{ rate: number; returned: number; total: number } | null>(null);
  const [mealCombos, setMealCombos] = useState<MealCombo[]>([]);
  const [restaurantName, setRestaurantName] = useState("");

  useEffect(() => {
    fetchPremiumAnalytics();
  }, [restaurantId]);

  const fetchPremiumAnalytics = async () => {
    try {
      setLoading(true);

      const { data: restData } = await supabase
        .from("restaurants")
        .select("name")
        .eq("id", restaurantId)
        .maybeSingle();
      if (restData?.name) setRestaurantName(restData.name);

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

      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];
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
      // Use date strings (YYYY-MM-DD) for comparisons to avoid UTC/local timezone shifts
      const recentSchedules = schedules.filter((s) => s.scheduled_date >= thirtyDaysAgoStr);
      const previousSchedules = schedules.filter(
        (s) => s.scheduled_date >= sixtyDaysAgoStr && s.scheduled_date < thirtyDaysAgoStr
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
      // Only customers with 2+ total orders qualify as "churned" to avoid
      // flagging one-time or casual customers as lost.
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];
      const prev60Customers = new Set(
        schedules.filter((s) => s.scheduled_date >= sixtyDaysAgoStr).map((s) => s.user_id)
      );

      let atRisk = 0, likelyLost = 0, lost = 0;
      prev60Customers.forEach((uid) => {
        const cust = customerOrders[uid];
        if (!cust || cust.count < 2) return; // require at least 2 orders to be "churnable"
        const daysSince = Math.floor((now.getTime() - new Date(cust.lastDate + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24));
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
      const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000);
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];
      // Count schedules per DOW per week to get accurate averages
      const dowWeeklyCount: Record<number, Record<string, number>> = { 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} };
      schedules
        .filter((s) => s.scheduled_date >= fourWeeksAgoStr)
        .forEach((s) => {
          const date = new Date(s.scheduled_date + "T12:00:00");
          const dow = date.getDay();
          // Get ISO week key (year-week) for this date
          const weekStart = new Date(date.getTime() - date.getDay() * 86400000);
          const weekKey = weekStart.toISOString().split("T")[0];
          dowWeeklyCount[dow][weekKey] = (dowWeeklyCount[dow][weekKey] || 0) + 1;
        });
      const dowAvg: Record<number, number> = {};
      [0, 1, 2, 3, 4, 5, 6].forEach((d) => {
        const weeks = Object.values(dowWeeklyCount[d]);
        const totalWeeks = Math.max(weeks.length, 1); // actual weeks that had data for this DOW
        dowAvg[d] = weeks.reduce((a, b) => a + b, 0) / Math.max(totalWeeks, 1);
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

      // ── Gap 2: Weekly Performance Digest ──────────────────────────────────
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);
      const sevenDaysAgoStr2 = sevenDaysAgo.toISOString().split("T")[0];
      const fourteenDaysAgoStr2 = fourteenDaysAgo.toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];

      const thisWeek = schedules.filter((s) => s.scheduled_date >= sevenDaysAgoStr2 && s.scheduled_date <= todayStr);
      const lastWeek = schedules.filter((s) => s.scheduled_date >= fourteenDaysAgoStr2 && s.scheduled_date < sevenDaysAgoStr2);

      const thisRevenue = thisWeek.reduce((sum, s) => sum + (mealMap[s.meal_id]?.price || 0) * (1 - PLATFORM_FEE), 0);
      const lastRevenue = lastWeek.reduce((sum, s) => sum + (mealMap[s.meal_id]?.price || 0) * (1 - PLATFORM_FEE), 0);

      const thisWeekCustomers = new Set(thisWeek.map((s) => s.user_id));
      const lastWeekCustomers = new Set(lastWeek.map((s) => s.user_id));
      // "New" = never ordered before this week (check against all prior 90-day history)
      const priorCustomers = new Set(
        schedules.filter((s) => s.scheduled_date < sevenDaysAgoStr2).map((s) => s.user_id)
      );
      const newCustomers = [...thisWeekCustomers].filter((uid) => !priorCustomers.has(uid)).length;
      const returningCustomers = [...thisWeekCustomers].filter((uid) => lastWeekCustomers.has(uid)).length;

      setWeeklyDigest({
        thisRevenue,
        lastRevenue,
        thisOrders: thisWeek.length,
        lastOrders: lastWeek.length,
        newCustomers,
        returningCustomers,
        revenueDelta: lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : 0,
        orderDelta: lastWeek.length > 0 ? ((thisWeek.length - lastWeek.length) / lastWeek.length) * 100 : 0,
      });

      // ── Gap 3: Customer Return Rate ────────────────────────────────────────
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

      const thisMonthCustomers = new Set(schedules.filter((s) => s.scheduled_date >= thisMonthStart).map((s) => s.user_id));
      const lastMonthCustomers = new Set(schedules.filter((s) => s.scheduled_date >= lastMonthStart && s.scheduled_date <= lastMonthEnd).map((s) => s.user_id));
      const returned = [...lastMonthCustomers].filter((uid) => thisMonthCustomers.has(uid)).length;
      const returnRateVal = lastMonthCustomers.size > 0 ? (returned / lastMonthCustomers.size) * 100 : 0;
      setReturnRate({ rate: returnRateVal, returned, total: lastMonthCustomers.size });

      // ── Gap 4: Meal Combo Patterns ─────────────────────────────────────────
      // Group orders by (user_id + date), find pairs ordered together
      const dayUserMeals: Record<string, string[]> = {};
      schedules.forEach((s) => {
        const key = `${s.user_id}::${s.scheduled_date}`;
        if (!dayUserMeals[key]) dayUserMeals[key] = [];
        dayUserMeals[key].push(s.meal_id);
      });

      const comboCounts: Record<string, number> = {};
      let totalPairEvents = 0;
      Object.values(dayUserMeals).forEach((mealList) => {
        const unique = [...new Set(mealList)];
        if (unique.length < 2) return;
        for (let i = 0; i < unique.length; i++) {
          for (let j = i + 1; j < unique.length; j++) {
            const pair = [unique[i], unique[j]].sort().join("||");
            comboCounts[pair] = (comboCounts[pair] || 0) + 1;
            totalPairEvents++;
          }
        }
      });

      const topCombos: MealCombo[] = Object.entries(comboCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([pair, count]) => {
          const [id1, id2] = pair.split("||");
          return {
            meal1: mealMap[id1]?.name || "Unknown",
            meal2: mealMap[id2]?.name || "Unknown",
            count,
            pct: totalPairEvents > 0 ? Math.round((count / totalPairEvents) * 100) : 0,
          };
        });
      setMealCombos(topCombos);

    } catch (error) {
      console.error("Error fetching premium analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = () => {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const totalChurnCount = churnData.atRisk + churnData.likelyLost + churnData.lost;
    const totalMealOrders = menuPerf.reduce((s, m) => s + m.orders, 0);
    const totalMealRevenue = menuPerf.reduce((s, m) => s + m.netRevenue, 0);
    const topSellers = menuPerf.filter((m) => m.label === "Top Seller");
    const needsAttention = menuPerf.filter((m) => m.label === "Needs Attention");
    const retentionLabel = returnRate && returnRate.rate >= 50 ? "strong" : returnRate && returnRate.rate >= 30 ? "moderate" : "low";
    const highDemandDays = demandCalendar.filter((d) => d.level === "High");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Premium Insights Report — ${restaurantName || "Restaurant"}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', -apple-system, Roboto, sans-serif; font-size: 10.5px; color: #1a1a1a; line-height: 1.6; }
  .page { max-width: 210mm; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
  h2 { font-size: 14px; font-weight: 700; margin: 22px 0 6px; padding-bottom: 5px; border-bottom: 2px solid #16a34a; color: #111; }
  h3 { font-size: 12px; font-weight: 600; margin: 14px 0 4px; color: #374151; }
  p, .explanation { font-size: 10.5px; color: #374151; line-height: 1.65; margin: 4px 0 10px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #16a34a; padding-bottom: 12px; margin-bottom: 6px; }
  .header-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
  .badge { display: inline-block; background: #16a34a; color: #fff; font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 10px; letter-spacing: 0.5px; }
  .exec-summary { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px; margin: 10px 0 16px; }
  .exec-summary strong { color: #166534; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
  .grid-7 { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .stat-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #fff; }
  .stat-card .label { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
  .stat-card .value { font-size: 20px; font-weight: 700; margin: 2px 0; }
  .stat-card .delta { font-size: 10px; font-weight: 500; }
  .delta-up { color: #16a34a; }
  .delta-down { color: #dc2626; }
  .insight-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; margin: 8px 0; font-size: 10.5px; color: #1e40af; }
  .insight-box.warning { background: #fef2f2; border-color: #fca5a5; color: #991b1b; }
  .insight-box.success { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
  .alert-card { border: 1px solid #fca5a5; background: #fef2f2; border-radius: 8px; padding: 12px 14px; }
  .alert-card .count { font-size: 22px; font-weight: 700; color: #dc2626; }
  .churn-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 8px; }
  .churn-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; text-align: center; background: #fff; }
  .churn-item .num { font-size: 20px; font-weight: 700; }
  .churn-item .lbl { font-size: 9.5px; font-weight: 600; }
  .churn-item .sub { font-size: 9px; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 6px; }
  th { text-align: left; font-size: 9.5px; color: #6b7280; font-weight: 600; padding: 7px 5px; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 7px 5px; border-bottom: 1px solid #f3f4f6; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
  .text-green { color: #16a34a; }
  .text-red { color: #dc2626; }
  .text-amber { color: #d97706; }
  .text-muted { color: #6b7280; }
  .badge-sm { display: inline-block; font-size: 9px; font-weight: 600; padding: 2px 7px; border-radius: 8px; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .return-bar { height: 8px; background: #e5e7eb; border-radius: 4px; margin-top: 6px; }
  .return-fill { height: 100%; border-radius: 4px; }
  .combo-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #f3f4f6; }
  .combo-row .rank { color: #6b7280; font-size: 10px; width: 18px; }
  .combo-row .meals { flex: 1; font-weight: 500; font-size: 11px; }
  .combo-row .freq { font-weight: 600; color: #16a34a; text-align: right; font-size: 11px; }
  .demand-cell { border: 1px solid #e5e7eb; border-radius: 5px; padding: 5px; text-align: center; font-size: 9.5px; }
  .demand-high { background: #fee2e2; border-color: #fca5a5; }
  .demand-medium { background: #fef3c7; border-color: #fcd34d; }
  .demand-low { background: #dcfce7; border-color: #86efac; }
  .profit-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .profit-bar { flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px; }
  .profit-fill { height: 100%; background: #16a34a; border-radius: 3px; }
  .footer { margin-top: 28px; border-top: 2px solid #e5e7eb; padding-top: 10px; font-size: 9px; color: #9ca3af; text-align: center; }
  .page-break { page-break-before: always; }
  .toc { margin: 10px 0 16px; }
  .toc-item { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #d1d5db; font-size: 11px; }
  .toc-item span:last-child { color: #6b7280; }
  .legend { display: flex; gap: 12px; flex-wrap: wrap; margin: 6px 0; }
  .legend-item { display: flex; align-items: center; gap: 4px; font-size: 9.5px; }
  .legend-dot { width: 8px; height: 8px; border-radius: 2px; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="page">

  <!-- ═══ COVER / HEADER ═══ -->
  <div class="header">
    <div>
      <h1>${restaurantName || "Restaurant"}</h1>
      <div class="header-sub">Premium Insights Report</div>
      <div class="header-sub">${today}</div>
    </div>
    <div style="text-align:right;">
      <div class="badge">PREMIUM INSIGHTS</div>
      <div class="header-sub" style="margin-top:6px;">Powered by Nutrio Fuel</div>
    </div>
  </div>

  <!-- Executive Summary -->
  <div class="exec-summary">
    <strong>Executive Summary</strong>
    <p style="margin:6px 0 0;">
      This report provides a comprehensive analysis of your restaurant's performance over the last 90 days, covering revenue trends, customer behavior, menu performance, and operational forecasts.
      ${weeklyDigest ? `This week, your restaurant generated <strong>${formatCurrency(weeklyDigest.thisRevenue)}</strong> in net revenue from <strong>${weeklyDigest.thisOrders}</strong> orders, which is <strong>${weeklyDigest.revenueDelta >= 0 ? "up" : "down"} ${Math.abs(weeklyDigest.revenueDelta).toFixed(1)}%</strong> compared to last week.` : ""}
      ${totalChurnCount > 0 ? ` <strong style="color:#dc2626">${totalChurnCount} customers</strong> are showing signs of churn and require immediate attention.` : " No significant churn risk was detected this period."}
      Your projected revenue for the next 30 days is <strong>${formatCurrency(revenueForecast)}</strong> based on current daily averages.
    </p>
  </div>

  <!-- Table of Contents -->
  <h3>Report Contents</h3>
  <div class="toc">
    <div class="toc-item"><span>1. Weekly Performance Snapshot</span><span>This week vs last week</span></div>
    <div class="toc-item"><span>2. 30-Day Growth Analysis</span><span>Revenue, orders, customer trends</span></div>
    <div class="toc-item"><span>3. Revenue Forecast</span><span>30-day projection</span></div>
    <div class="toc-item"><span>4. Customer Retention &amp; Churn Analysis</span><span>Return rate, segments, churn alerts</span></div>
    <div class="toc-item"><span>5. Menu Performance Matrix</span><span>Classification &amp; recommendations</span></div>
    <div class="toc-item"><span>6. Profitability Report</span><span>Net earnings per meal after fees</span></div>
    <div class="toc-item"><span>7. Meal Combo Patterns</span><span>Cross-sell opportunities</span></div>
    <div class="toc-item"><span>8. 14-Day Demand Forecast</span><span>Predicted order volume</span></div>
  </div>

  <!-- ═══ 1. WEEKLY PERFORMANCE ═══ -->
  ${weeklyDigest ? `
  <h2>1. Weekly Performance Snapshot</h2>
  <p class="explanation">
    This section compares your restaurant's performance during the current 7-day period against the previous 7 days. It helps you spot immediate momentum changes before they compound into larger trends. Focus on whether your revenue and orders are moving in the same direction — if revenue grows but orders drop, your average order value is increasing (good), but your reach is narrowing (investigate).
  </p>
  <div class="grid-4">
    <div class="stat-card">
      <div class="label">Net Revenue</div>
      <div class="value">${formatCurrency(weeklyDigest.thisRevenue)}</div>
      <div class="delta ${weeklyDigest.revenueDelta >= 0 ? "delta-up" : "delta-down"}">${weeklyDigest.revenueDelta >= 0 ? "+" : ""}${weeklyDigest.revenueDelta.toFixed(1)}% vs last week</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Orders</div>
      <div class="value">${weeklyDigest.thisOrders}</div>
      <div class="delta ${weeklyDigest.orderDelta >= 0 ? "delta-up" : "delta-down"}">${weeklyDigest.orderDelta >= 0 ? "+" : ""}${weeklyDigest.orderDelta.toFixed(1)}% vs last week</div>
    </div>
    <div class="stat-card">
      <div class="label">New Customers</div>
      <div class="value">${weeklyDigest.newCustomers}</div>
      <div class="delta text-muted">Ordered for the first time</div>
    </div>
    <div class="stat-card">
      <div class="label">Returning Customers</div>
      <div class="value">${weeklyDigest.returningCustomers}</div>
      <div class="delta text-muted">Also ordered last week</div>
    </div>
  </div>
  ${weeklyDigest.revenueDelta >= 10 ? `<div class="insight-box success">Your revenue grew by ${weeklyDigest.revenueDelta.toFixed(1)}% this week — excellent momentum. Consider whether this is driven by new customers or higher order values, and reinforce what's working.</div>` : weeklyDigest.revenueDelta <= -10 ? `<div class="insight-box warning">Revenue declined ${Math.abs(weeklyDigest.revenueDelta).toFixed(1)}% this week. Check if fewer orders or lower order values caused the drop. Review if any popular meals were out of stock or if a competitor ran a promotion.</div>` : `<div class="insight-box">Performance is stable week-over-week. Consistent performance is healthy — look for opportunities to push growth through promotions or new menu items.</div>`}
  ` : ""}

  <!-- ═══ 2. 30-DAY GROWTH ═══ -->
  <h2>2. 30-Day Growth Analysis</h2>
  <p class="explanation">
    These metrics compare the most recent 30 days against the preceding 30 days (days 31–60). This gives you a month-over-month view that smooths out weekly noise. Revenue growth shows whether your top line is expanding. Order growth indicates demand. Customer growth reveals whether you're reaching new people or relying on existing ones.
  </p>
  <div class="grid-3">
    <div class="stat-card">
      <div class="label">Revenue Growth</div>
      <div class="value ${growthMetrics.revenueGrowth >= 0 ? "text-green" : "text-red"}">${growthMetrics.revenueGrowth >= 0 ? "+" : ""}${growthMetrics.revenueGrowth.toFixed(1)}%</div>
      <div class="delta text-muted">Net revenue vs previous 30 days</div>
    </div>
    <div class="stat-card">
      <div class="label">Order Growth</div>
      <div class="value ${growthMetrics.orderGrowth >= 0 ? "text-green" : "text-red"}">${growthMetrics.orderGrowth >= 0 ? "+" : ""}${growthMetrics.orderGrowth.toFixed(1)}%</div>
      <div class="delta text-muted">Total orders vs previous 30 days</div>
    </div>
    <div class="stat-card">
      <div class="label">Customer Growth</div>
      <div class="value ${growthMetrics.customerGrowth >= 0 ? "text-green" : "text-red"}">${growthMetrics.customerGrowth >= 0 ? "+" : ""}${growthMetrics.customerGrowth.toFixed(1)}%</div>
      <div class="delta text-muted">Unique customers vs previous 30 days</div>
    </div>
  </div>

  <!-- ═══ 3. REVENUE FORECAST ═══ -->
  <h2>3. Revenue Forecast</h2>
  <p class="explanation">
    This projection uses your daily average net revenue (after the 18% platform fee) over the last 30 days and extends it forward. It is not a guarantee — it reflects what you'll earn if current order patterns continue unchanged. Use it as a planning anchor for expenses, staffing, and ingredient purchasing.
  </p>
  <div class="stat-card">
    <div class="label">Projected Net Revenue — Next 30 Days</div>
    <div class="value text-green" style="font-size: 26px;">${formatCurrency(revenueForecast)}</div>
    <div class="delta text-muted">Based on a daily average of ${formatCurrency(revenueForecast / 30)}</div>
  </div>
  <div class="insight-box">This forecast assumes consistent order volume. Seasonal changes, promotions, or menu updates can significantly shift the actual outcome. Revisit this number weekly.</div>

  <!-- ═══ 4. CUSTOMER RETENTION & CHURN ═══ -->
  <h2 ${totalChurnCount > 0 ? 'class="page-break"' : ""}>4. Customer Retention &amp; Churn Analysis</h2>
  <p class="explanation">
    Customer retention is the single most important metric for long-term restaurant profitability. Acquiring a new customer costs 5–7× more than retaining an existing one. This section measures how many customers from last month returned this month, segments your customers by engagement level, and flags those at risk of churning.
  </p>

  ${returnRate && returnRate.total > 0 ? `
  <h3>4.1 — Customer Return Rate</h3>
  <div class="grid-2">
    <div class="stat-card">
      <div class="label">Monthly Return Rate</div>
      <div class="value" style="font-size: 28px;">${returnRate.rate.toFixed(0)}%</div>
      <div class="delta text-muted">${returnRate.returned} of ${returnRate.total} customers from last month ordered again this month</div>
      <div class="return-bar"><div class="return-fill" style="width: ${Math.min(returnRate.rate, 100)}%; background: ${returnRate.rate >= 50 ? "#16a34a" : returnRate.rate >= 30 ? "#d97706" : "#dc2626"};"></div></div>
    </div>
    <div class="stat-card">
      <div class="label">Customer Overview</div>
      <div style="margin-top: 6px;">
        <div style="display:flex; justify-content:space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;"><span>Total Unique Customers</span><strong>${customerMetrics.totalCustomers}</strong></div>
        <div style="display:flex; justify-content:space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;"><span>Repeat Customers (2+ orders)</span><strong>${customerMetrics.repeatCustomers}</strong></div>
        <div style="display:flex; justify-content:space-between; padding: 3px 0; border-bottom: 1px solid #f3f4f6;"><span>Repeat Rate</span><strong>${customerMetrics.repeatRate.toFixed(1)}%</strong></div>
        <div style="display:flex; justify-content:space-between; padding: 3px 0;"><span>Avg Orders per Customer</span><strong>${customerMetrics.avgOrdersPerCustomer.toFixed(1)}</strong></div>
      </div>
    </div>
  </div>
  <div class="insight-box ${retentionLabel === "strong" ? "success" : retentionLabel === "low" ? "warning" : ""}">
    ${retentionLabel === "strong" ? `Your return rate of ${returnRate.rate.toFixed(0)}% is above the food delivery industry average of ~35%. This indicates strong food quality and customer satisfaction. Continue what you're doing and consider a loyalty program to lock in these customers.` : retentionLabel === "moderate" ? `Your return rate of ${returnRate.rate.toFixed(0)}% is near the industry average of ~35%. There is room to improve. Consider adding variety to your menu, improving portion sizes, or introducing a "welcome back" discount for lapsed customers.` : `Your return rate of ${returnRate.rate.toFixed(0)}% is below the industry average of ~35%. This is a critical area to address. Common causes include inconsistent food quality, slow delivery, or limited menu variety. Survey your recent customers to identify the root cause.`}
  </div>
  ` : ""}

  ${totalChurnCount > 0 ? `
  <h3>4.2 — Churn Alert</h3>
  <p class="explanation">
    Churn measures customers who used to order regularly but have gone silent. We identify customers who placed 3+ orders in the previous 60 days but haven't ordered recently. They are grouped by how long they've been inactive: <strong>At Risk</strong> (14–21 days — still recoverable), <strong>Likely Lost</strong> (21–45 days — needs a direct incentive), and <strong>Lost</strong> (45+ days — very unlikely to return without intervention).
  </p>
  <div class="alert-card">
    <strong>⚠ Churn Alert:</strong> <span class="count">${totalChurnCount}</span> previously regular customers have stopped ordering.
    <div class="churn-grid">
      <div class="churn-item"><div class="num text-amber">${churnData.atRisk}</div><div class="lbl">At Risk</div><div class="sub">14–21 days silent</div></div>
      <div class="churn-item"><div class="num" style="color:#ea580c">${churnData.likelyLost}</div><div class="lbl">Likely Lost</div><div class="sub">21–45 days silent</div></div>
      <div class="churn-item"><div class="num text-red">${churnData.lost}</div><div class="lbl">Lost</div><div class="sub">45+ days silent</div></div>
    </div>
  </div>
  <div class="insight-box warning">
    ${churnData.atRisk > 0 ? `${churnData.atRisk} "At Risk" customer${churnData.atRisk > 1 ? "s" : ""} can likely be recovered with a timely push notification or a small discount code. ` : ""}
    ${churnData.likelyLost > 0 ? `The ${churnData.likelyLost} "Likely Lost" customer${churnData.likelyLost > 1 ? "s" : ""} may need a stronger incentive — consider a "We miss you" offer with a meaningful discount. ` : ""}
    ${churnData.lost > 0 ? `${churnData.lost} customer${churnData.lost > 1 ? "s have" : " has"} been inactive for 45+ days and ${churnData.lost > 1 ? "are" : "is"} unlikely to return without direct outreach.` : ""}
  </div>
  ` : `<div class="insight-box success">No significant churn detected. Your customer retention is healthy.</div>`}

  <h3>4.3 — Customer Segments</h3>
  <p class="explanation">
    Customers are grouped based on order frequency and recency. <strong>Champions</strong> are your VIPs — they order frequently and recently. <strong>Loyal</strong> customers order regularly. <strong>At Risk</strong> were once active but have gone quiet. <strong>Inactive</strong> have not ordered in over 60 days.
  </p>
  <div class="grid-4">
    <div class="stat-card" style="border-left: 3px solid #16a34a;"><div class="label">Champions</div><div class="value">${customerSegments.champions}</div><div class="delta text-muted">5+ orders, active this week</div></div>
    <div class="stat-card" style="border-left: 3px solid #3b82f6;"><div class="label">Loyal</div><div class="value">${customerSegments.loyal}</div><div class="delta text-muted">3–4 orders, recent activity</div></div>
    <div class="stat-card" style="border-left: 3px solid #f59e0b;"><div class="label">At Risk</div><div class="value">${customerSegments.atRisk}</div><div class="delta text-muted">Quiet for 21+ days</div></div>
    <div class="stat-card" style="border-left: 3px solid #9ca3af;"><div class="label">Inactive</div><div class="value">${customerSegments.inactive}</div><div class="delta text-muted">No orders in 60+ days</div></div>
  </div>

  <!-- ═══ 5. MENU PERFORMANCE ═══ -->
  <h2 class="page-break">5. Menu Performance Matrix</h2>
  <p class="explanation">
    Every meal is classified into one of four categories based on its order count and net revenue over the last 90 days, compared to the median across all your meals. This framework (adapted from the BCG growth-share matrix) helps you make data-driven decisions about what to promote, keep, grow, or remove.
  </p>
  <div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:#dcfce7;border:1px solid #16a34a;"></div> <strong>Top Seller</strong> — High orders + high revenue. Promote it.</div>
    <div class="legend-item"><div class="legend-dot" style="background:#dbeafe;border:1px solid #3b82f6;"></div> <strong>High Value</strong> — Fewer orders but high revenue per sale. Keep it.</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fef3c7;border:1px solid #f59e0b;"></div> <strong>Growing</strong> — Order volume rising. Feature it more.</div>
    <div class="legend-item"><div class="legend-dot" style="background:#fee2e2;border:1px solid #dc2626;"></div> <strong>Needs Attention</strong> — Low on both axes. Consider removing.</div>
  </div>
  <table>
    <thead><tr><th>Meal</th><th class="text-center">Classification</th><th class="text-right">Orders (90d)</th><th class="text-right">Net per Order</th><th class="text-right">Total Net Revenue</th></tr></thead>
    <tbody>
      ${menuPerf.map((m) => {
        const badgeClass = m.label === "Top Seller" ? "badge-green" : m.label === "High Value" ? "badge-blue" : m.label === "Growing" ? "badge-amber" : "badge-red";
        return `<tr><td style="font-weight:500;">${m.name}</td><td class="text-center"><span class="badge-sm ${badgeClass}">${m.label}</span></td><td class="text-right">${m.orders}</td><td class="text-right">${formatCurrency(m.netPerOrder)}</td><td class="text-right font-bold text-green">${formatCurrency(m.netRevenue)}</td></tr>`;
      }).join("")}
      <tr style="border-top:2px solid #e5e7eb;font-weight:700;"><td>Total (${menuPerf.length} meals)</td><td></td><td class="text-right">${totalMealOrders}</td><td></td><td class="text-right text-green">${formatCurrency(totalMealRevenue)}</td></tr>
    </tbody>
  </table>
  ${needsAttention.length > 0 ? `<div class="insight-box warning"><strong>Recommendation:</strong> ${needsAttention.length === 1 ? `"${needsAttention[0].name}" has only ${needsAttention[0].orders} orders in 90 days and generates minimal revenue. Consider removing it to simplify your menu and reduce prep costs.` : `${needsAttention.length} meals (${needsAttention.map((m) => '"' + m.name + '"').join(", ")}) are underperforming on both orders and revenue. Evaluate whether they justify the prep time and ingredient cost, or replace them with new options.`}</div>` : ""}
  ${topSellers.length > 0 ? `<div class="insight-box success"><strong>Strength:</strong> ${topSellers.length === 1 ? `"${topSellers[0].name}" is your clear top performer` : `Your top sellers are ${topSellers.map((m) => '"' + m.name + '"').join(" and ")}`}. Consider promoting ${topSellers.length === 1 ? "it" : "them"} on your storefront and in marketing materials to maximize reach.</div>` : ""}

  <!-- ═══ 6. PROFITABILITY ═══ -->
  ${profitabilityData.length > 0 ? `
  <h2>6. Profitability Report</h2>
  <p class="explanation">
    This ranks your meals by total net revenue after the 18% Nutrio Fuel platform fee over the last 90 days. "Net per order" shows exactly how much you earn each time a customer orders that meal. Focus on meals that deliver the highest net revenue — they are the true drivers of your bottom line, not necessarily the ones with the most orders.
  </p>
  ${profitabilityData.map((m, i) => {
    const pct = profitabilityData[0].netRevenue > 0 ? (m.netRevenue / profitabilityData[0].netRevenue) * 100 : 0;
    return `<div class="profit-row"><span class="text-muted" style="width:18px;">#${i + 1}</span><span style="width:140px;font-weight:500;">${m.name}</span><div class="profit-bar"><div class="profit-fill" style="width:${pct}%"></div></div><span class="font-bold text-green" style="width:85px;text-align:right;">${formatCurrency(m.netRevenue)}</span><span class="text-muted" style="width:70px;text-align:right;">${formatCurrency(m.netPerOrder)}/ea</span><span class="text-muted" style="width:55px;text-align:right;">${m.orders} orders</span></div>`;
  }).join("")}
  <div class="insight-box success">Your most profitable meal, "${profitabilityData[0].name}", earns ${formatCurrency(profitabilityData[0].netPerOrder)} per order after platform fees. Over the last 90 days it generated ${formatCurrency(profitabilityData[0].netRevenue)} in net revenue from ${profitabilityData[0].orders} orders.</div>
  ` : ""}

  <!-- ═══ 7. MEAL COMBOS ═══ -->
  ${mealCombos.length > 0 ? `
  <h2>7. Meal Combo Patterns</h2>
  <p class="explanation">
    This analysis identifies which meals are most frequently ordered together by the same customer on the same day. These natural pairings reveal cross-sell opportunities. By creating a "combo deal" from your most popular pair, you can increase average order value while giving customers a perceived discount — a win-win.
  </p>
  ${mealCombos.map((c, i) => `<div class="combo-row"><span class="rank">#${i + 1}</span><span class="meals">${c.meal1} &nbsp;+&nbsp; ${c.meal2}</span><span class="freq">${c.count} times (${c.pct}% of all combos)</span></div>`).join("")}
  <div class="insight-box">
    <strong>Bundle Opportunity:</strong> "${mealCombos[0].meal1}" and "${mealCombos[0].meal2}" are ordered together ${mealCombos[0].count} times — more than any other pair. Offering them as a discounted bundle could increase your average order value by 15–25% based on industry benchmarks.
  </div>
  ` : ""}

  <!-- ═══ 8. DEMAND FORECAST ═══ -->
  ${demandCalendar.length > 0 ? `
  <h2 class="page-break">8. 14-Day Demand Forecast</h2>
  <p class="explanation">
    This forecast predicts your expected order volume for each of the next 14 days based on your day-of-week averages over the last 4 weeks. Days are classified as <strong style="color:#dc2626;">High</strong> (≥70% of your peak day), <strong style="color:#d97706;">Medium</strong> (40–70%), or <strong style="color:#16a34a;">Low</strong> (&lt;40%). Use this for kitchen staffing, ingredient purchasing, and delivery planning.
  </p>
  <div class="grid-7">
    ${demandCalendar.map((d) => {
      const cls = d.level === "High" ? "demand-high" : d.level === "Medium" ? "demand-medium" : "demand-low";
      return `<div class="demand-cell ${cls}"><div style="font-weight:700;">${d.dayLabel}</div><div style="font-size:9px;">${d.dateLabel}</div><div style="font-weight:700;font-size:13px;margin-top:3px;">~${d.predictedOrders}</div><div style="font-size:9px;">${d.level}</div></div>`;
    }).join("")}
  </div>
  ${highDemandDays.length > 0 ? `<div class="insight-box"><strong>Prep Tip:</strong> ${highDemandDays.length} of the next 14 days are forecasted as "High" demand (${highDemandDays.map((d) => d.dayLabel + " " + d.dateLabel).join(", ")}). Ensure you have sufficient ingredients and staff scheduled for these days to avoid stockouts and slow service.</div>` : `<div class="insight-box">No exceptionally high-demand days are forecasted in the next 2 weeks. This is a good opportunity to run a promotion to boost volume on slower days.</div>`}
  ` : ""}

  <!-- ═══ FOOTER ═══ -->
  <div class="footer">
    <strong>Nutrio Fuel — Premium Insights Report</strong><br>
    Generated on ${today} · Data covers the last 90 days · All revenue figures are net after the 18% platform fee<br>
    This report is confidential and intended for restaurant management use only.
  </div>

</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
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
    <div className="space-y-6">

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
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExportReport} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                Export Report
              </Button>
              <Badge className="bg-primary">Premium</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Gap 2: Weekly Performance Digest ──────────────────────────────── */}
      {weeklyDigest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              This Week vs Last Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: "Revenue",
                  current: formatCurrency(weeklyDigest.thisRevenue),
                  delta: weeklyDigest.revenueDelta,
                },
                {
                  label: "Orders",
                  current: weeklyDigest.thisOrders.toString(),
                  delta: weeklyDigest.orderDelta,
                },
                {
                  label: "New Customers",
                  current: weeklyDigest.newCustomers.toString(),
                  delta: null,
                  sub: "First time this week",
                },
                {
                  label: "Returning Customers",
                  current: weeklyDigest.returningCustomers.toString(),
                  delta: null,
                  sub: "Ordered last week too",
                },
              ].map(({ label, current, delta, sub }) => (
                <div key={label} className="rounded-lg bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className="text-xl font-bold">{current}</p>
                  {delta !== null && delta !== undefined ? (
                    <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {Math.abs(delta).toFixed(1)}% vs last week
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">{sub}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {/* ── Feature 2: Revenue Forecast ────────────────────────────────────── */}
              <Card className="h-full">
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
            </div>

            <div className="space-y-4">
              {/* ── Growth Metrics (existing) ──────────────────────────────────────── */}
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
          </div>

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
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Gap 3: Customer Return Rate ────────────────────────────────────── */}
            {returnRate !== null && returnRate.total > 0 && (
              <Card className="h-full">
                <CardContent className="pt-6 pb-6 h-full flex flex-col justify-center">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${returnRate.rate >= 50 ? "bg-emerald-100" : returnRate.rate >= 30 ? "bg-amber-100" : "bg-red-100"}`}>
                        <UserCheck className={`h-6 w-6 ${returnRate.rate >= 50 ? "text-emerald-600" : returnRate.rate >= 30 ? "text-amber-600" : "text-red-500"}`} />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Customer Return Rate</p>
                        <p className="text-3xl font-bold">{returnRate.rate.toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {returnRate.returned} of {returnRate.total} customers returned this month
                        </p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block shrink-0">
                      {returnRate.rate >= 50 ? (
                        <div className="text-emerald-600 text-sm font-medium">Strong loyalty ✓</div>
                      ) : returnRate.rate >= 30 ? (
                        <div className="text-amber-600 text-sm font-medium">Room to improve</div>
                      ) : (
                        <div className="text-red-500 text-sm font-medium">Focus on retention</div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Industry avg: ~35%</p>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-5 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${returnRate.rate >= 50 ? "bg-emerald-500" : returnRate.rate >= 30 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ width: `${Math.min(returnRate.rate, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Feature 1: Churn Alert ──────────────────────────────────────────── */}
            {totalChurn > 0 && (
              <Card className="border-red-200 bg-red-50/50 h-full">
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
                      { label: "At Risk", count: churnData.atRisk, sub: "14–21 days", color: "border-amber-300 bg-amber-50 text-amber-800" },
                      { label: "Likely Lost", count: churnData.likelyLost, sub: "21–45 days", color: "border-orange-300 bg-orange-50 text-orange-800" },
                      { label: "Lost", count: churnData.lost, sub: "45+ days", color: "border-red-300 bg-red-50 text-red-800" },
                    ].map(({ label, count, sub, color }) => (
                      <div key={label} className={`rounded-lg border p-3 text-center ${color}`}>
                        <p className="text-2xl font-bold">{count}</p>
                        <p className="text-xs font-medium">{label}</p>
                        <p className="text-[10px] opacity-70 mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
        </TabsContent>

        <TabsContent value="menu" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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
                                <div className="flex flex-col items-center gap-0.5">
                                  <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                                    {meal.label}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">{cfg.description}</span>
                                </div>
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
            </div>

            <div className="space-y-6">
              {/* ── Gap 4: Meal Combo Patterns ─────────────────────────────────────── */}
              {mealCombos.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      Meal Combo Patterns
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Meals most often ordered together by the same customer on the same day. Use this to create bundle deals.
                    </p>
                    <div className="space-y-2">
                      {mealCombos.map((combo, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-1">
                              <span className="text-sm font-medium truncate max-w-[140px]">{combo.meal1}</span>
                              <span className="text-xs text-muted-foreground">+</span>
                              <span className="text-sm font-medium truncate max-w-[140px]">{combo.meal2}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary/70 rounded-full"
                                style={{ width: `${Math.min(combo.pct * 3, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-sm font-semibold text-primary">{combo.count}×</span>
                            <p className="text-xs text-muted-foreground">{combo.pct}% of combos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-primary">
                      💡 <span className="font-medium">Bundle tip:</span> Offer your top combo as a discounted meal deal to increase average order value.
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
