import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Percent,
  Users,
  Wallet,
  Loader2,
  TrendingDown,
  Star,
  BarChart3,
  Utensils,
  Truck,
  RotateCcw,
  Share2,
  Printer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

interface ProfitStats {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  subscriptionRevenue: number;
  commissionRevenue: number;
  unusedMealsProfit: number;
  featuredListingsRevenue: number;
  premiumAnalyticsRevenue: number;
  driverCosts: number;
  refundCosts: number;
  affiliateCosts: number;
  totalOrders: number;
  totalRestaurants: number;
  totalSubscribers: number;
}

interface DailyProfit {
  date: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface RestaurantProfit {
  restaurantId: string;
  restaurantName: string;
  totalOrders: number;
  grossRevenue: number;
  commission: number;
  payout: number;
}

export default function AdminProfitDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState<ProfitStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyProfit[]>([]);
  const [restaurantData, setRestaurantData] = useState<RestaurantProfit[]>([]);
  const [globalCommissionRate, setGlobalCommissionRate] = useState<number>(18);

  const fetchGlobalCommissionRate = useCallback(async (): Promise<number> => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_rates")
      .single();
    if (data?.value) {
      const rates = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      const rate = rates?.restaurant ?? 18;
      setGlobalCommissionRate(rate);
      return rate;
    }
    return 18;
  }, []);

  const fetchProfitData = useCallback(async (commissionRate: number = globalCommissionRate) => {
    setLoading(true);
    try {
      const daysAgo = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // 1. Fetch subscription revenue
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("plan_type, price, created_at")
        .gte("created_at", startDate.toISOString())
        .eq("status", "active");

      const subscriptionRevenue = (subscriptions || []).reduce(
        (sum: number, s: { price?: number; plan_type?: string; created_at?: string }) => sum + (s.price || 0),
        0
      );

      // 2. Fetch orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total_amount, created_at, restaurant_id")
        .gte("created_at", startDate.toISOString());

      // 2b. Fetch restaurant names separately (no FK relationship on orders)
      const restaurantIds = [...new Set((orders || []).map((o: { restaurant_id?: string }) => o.restaurant_id).filter(Boolean))];
      const { data: restaurantsList } = restaurantIds.length > 0
        ? await supabase.from("restaurants").select("id, name").in("id", restaurantIds)
        : { data: [] };
      const restaurantNameMap: Record<string, string> = {};
      (restaurantsList || []).forEach((r: { id: string; name: string }) => { restaurantNameMap[r.id] = r.name; });

      // 3. Calculate commission from total_amount using platform commission rate
      const commissionRevenue = (orders || []).reduce(
        (sum: number, o: { total_amount?: unknown; created_at?: string; restaurant_id?: string; id?: string }) => sum + (Number(o.total_amount) || 0) * (commissionRate / 100),
        0
      );

      // 4. Calculate unused meals profit
      const avgMealPrice = 50;
      const totalOrderedMeals = (orders || []).length;
      
      // Get subscription meal counts
      const { data: subscriptionPlans } = await supabase
        .from("subscription_plans")
        .select("tier, meals_per_month")
        .eq("is_active", true);

      // Calculate expected meals vs ordered
      const expectedMeals = (subscriptions || []).reduce((sum: number, sub: { plan_type?: string; price?: number; created_at?: string }) => {
        const plan = subscriptionPlans?.find((p: { tier: string; meals_per_month?: number }) => p.tier === sub.plan_type);
        return sum + (plan?.meals_per_month || 0);
      }, 0);

      // Estimate unused meals profit
      const unusedMeals = Math.max(0, expectedMeals - totalOrderedMeals);
      const unusedMealsProfit = unusedMeals * avgMealPrice;

      // 5. Fetch featured listings revenue
      const { data: featuredListings } = await supabase
        .from("featured_listings")
        .select("price_paid, created_at")
        .gte("created_at", startDate.toISOString());

      const featuredListingsRevenue = (featuredListings || []).reduce(
        (sum: number, f: { price_paid?: unknown; created_at?: string }) => sum + (Number(f.price_paid) || 0),
        0
      );

      // 6. Fetch premium analytics purchases revenue
      const { data: analyticsPurchases } = await supabase
        .from("premium_analytics_purchases")
        .select("price_paid, created_at")
        .gte("created_at", startDate.toISOString());

      const premiumAnalyticsRevenue = (analyticsPurchases || []).reduce(
        (sum: number, p: { price_paid?: unknown; created_at?: string }) => sum + (Number(p.price_paid) || 0),
        0
      );

      // 7. Fetch expenses
      
      // a) Driver costs - from deliveries table
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("delivery_fee, tip_amount, created_at");
      
      const driverCosts = (deliveries || []).reduce(
        (sum: number, d: Record<string, unknown>) => sum + (Number(d.delivery_fee) || 0) + (Number(d.tip_amount) || 0),
        0
      );

      // b) Refund costs - from order_cancellations table
      const { data: cancellations } = await supabase
        .from("order_cancellations")
        .select("refund_amount, created_at");
      
      const refundCosts = (cancellations || []).reduce(
        (sum: number, c: Record<string, unknown>) => sum + (Number(c.refund_amount) || 0),
        0
      );

      // c) Affiliate costs - from affiliate_commissions
      const { data: affiliateCommissions } = await supabase
        .from("affiliate_commissions")
        .select("commission_amount, created_at")
        .gte("created_at", startDate.toISOString())
        .eq("status", "paid");
      
      const affiliateCosts = (affiliateCommissions || []).reduce(
        (sum: number, c: Record<string, unknown>) => sum + (Number(c.commission_amount) || 0),
        0
      );

      // Total expenses
      const totalExpenses = driverCosts + refundCosts + affiliateCosts;

      // Total revenue and net profit
      const totalRevenue = subscriptionRevenue + commissionRevenue + unusedMealsProfit + featuredListingsRevenue + premiumAnalyticsRevenue;
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      setStats({
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin,
        subscriptionRevenue,
        commissionRevenue,
        unusedMealsProfit,
        featuredListingsRevenue,
        premiumAnalyticsRevenue,
        driverCosts,
        refundCosts,
        affiliateCosts,
        totalOrders: totalOrderedMeals,
        totalRestaurants: new Set((orders || []).map((o: Record<string, unknown>) => o.restaurant_id)).size,
        totalSubscribers: (subscriptions || []).length,
      });

      // 5. Build daily data with revenue and expenses
      const dailyMap: Record<string, DailyProfit> = {};
      for (let i = daysAgo - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        dailyMap[dateStr] = { 
          date: dateStr.slice(5), 
          revenue: 0, 
          expenses: 0, 
          profit: 0
        };
      }

      // Add subscription revenue by day
      (subscriptions || []).forEach((s: Record<string, unknown>) => {
        const dateStr = (s.created_at as string)?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          dailyMap[dateStr].revenue += (s.price as number) || 0;
          dailyMap[dateStr].profit += (s.price as number) || 0;
        }
      });

      (orders || []).forEach((o: Record<string, unknown>) => {
        const dateStr = (o.created_at as string)?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          const comm = (Number(o.total_amount) || 0) * (commissionRate / 100);
          dailyMap[dateStr].revenue += comm;
          dailyMap[dateStr].profit += comm;
        }
      });

      (featuredListings || []).forEach((f: Record<string, unknown>) => {
        const dateStr = (f.created_at as string)?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          const amount = Number(f.price_paid) || 0;
          dailyMap[dateStr].revenue += amount;
          dailyMap[dateStr].profit += amount;
        }
      });

      (analyticsPurchases || []).forEach((p: Record<string, unknown>) => {
        const dateStr = (p.created_at as string)?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          const amount = Number(p.price_paid) || 0;
          dailyMap[dateStr].revenue += amount;
          dailyMap[dateStr].profit += amount;
        }
      });

      (deliveries || []).forEach((d: Record<string, unknown>) => {
        const dateStr = (d.created_at as string)?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          const cost = (Number(d.delivery_fee) || 0) + (Number(d.tip_amount) || 0);
          dailyMap[dateStr].expenses += cost;
          dailyMap[dateStr].profit -= cost;
        }
      });

      setDailyData(Object.values(dailyMap));

      // 6. Restaurant breakdown
      const restaurantMap: Record<string, RestaurantProfit> = {};
      (orders || []).forEach((o: Record<string, unknown>) => {
        const rid = o.restaurant_id as string;
        const rname = restaurantNameMap[rid] || "Unknown";
        if (!restaurantMap[rid]) {
          restaurantMap[rid] = {
            restaurantId: rid,
            restaurantName: rname,
            totalOrders: 0,
            grossRevenue: 0,
            commission: 0,
            payout: 0,
          };
        }
        const orderTotal = Number(o.total_amount) || 0;
        const orderCommission = orderTotal * (commissionRate / 100);
        restaurantMap[rid].totalOrders += 1;
        restaurantMap[rid].grossRevenue += orderTotal;
        restaurantMap[rid].commission += orderCommission;
        restaurantMap[rid].payout += orderTotal - orderCommission;
      });
      setRestaurantData(Object.values(restaurantMap).sort((a, b) => b.commission - a.commission));

    } catch (error) {
      console.error("Error fetching profit data:", error);
    } finally {
      setLoading(false);
    }
  }, [globalCommissionRate, period]);

  useEffect(() => {
    const init = async () => {
      const rate = await fetchGlobalCommissionRate();
      fetchProfitData(rate);
    };
    init();
  }, [period, fetchGlobalCommissionRate, fetchProfitData]);

  const periodLabel = period === "7" ? "Last 7 Days" : period === "30" ? "Last 30 Days" : "Last 90 Days";

  const handleExportReport = () => {
    const today = new Date().toLocaleDateString("en-QA", { year: "numeric", month: "long", day: "numeric" });

    const revenueRows = [
      { label: "Subscriptions", value: stats?.subscriptionRevenue || 0, detail: `${stats?.totalSubscribers || 0} subscribers` },
      { label: `Commission (${globalCommissionRate}%)`, value: stats?.commissionRevenue || 0, detail: `${stats?.totalOrders || 0} orders` },
      { label: "Unused Meals", value: stats?.unusedMealsProfit || 0, detail: "Unordered meal credits" },
      { label: "Featured Listings", value: stats?.featuredListingsRevenue || 0, detail: "Partner boosts" },
      { label: "Premium Analytics", value: stats?.premiumAnalyticsRevenue || 0, detail: "Analytics upgrades" },
    ];

    const expenseRows = [
      { label: "Driver Costs", value: stats?.driverCosts || 0, detail: "Delivery fees + tips" },
      { label: "Refunds", value: stats?.refundCosts || 0, detail: "Cancelled orders" },
      { label: "Affiliate Payouts", value: stats?.affiliateCosts || 0, detail: "Referral commissions" },
    ];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Nutrio Fuel – Profit Report</title>
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; padding: 20mm 15mm; }
  @media screen { body { max-width: 210mm; margin: 0 auto; background: #f5f5f5; padding: 24px; } }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; font-weight: 700; }
  .header p { font-size: 12px; color: #666; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 12px; color: #666; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .kpi { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; }
  .kpi .value { font-size: 20px; font-weight: 700; }
  .kpi .label { font-size: 11px; color: #666; margin-top: 2px; }
  .kpi.green .value { color: #16a34a; }
  .kpi.red .value { color: #dc2626; }
  .kpi.blue .value { color: #2563eb; }
  .kpi.purple .value { color: #7c3aed; }
  .section-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; margin-top: 24px; }
  .breakdown-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; margin-bottom: 24px; }
  .breakdown-card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 14px; }
  .breakdown-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 10px; display: flex; justify-content: space-between; }
  .breakdown-card h3 .total { font-size: 13px; }
  .breakdown-card h3 .total.green { color: #16a34a; }
  .breakdown-card h3 .total.red { color: #dc2626; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  .row:last-child { border-bottom: none; }
  .row .name { font-size: 12px; }
  .row .detail { font-size: 10px; color: #999; }
  .row .amount { font-size: 12px; font-weight: 600; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px 10px; font-weight: 600; border-bottom: 2px solid #e0e0e0; background: #fafafa; }
  th.right { text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
  td.right { text-align: right; }
  td.purple { color: #7c3aed; font-weight: 600; }
  td.green { color: #16a34a; }
  tfoot td { font-weight: 700; background: #fafafa; border-top: 2px solid #e0e0e0; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 10px; color: #999; }
  @media print { body { padding: 0; background: white; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>Nutrio Fuel</h1>
    <p>Platform Profit Report &middot; ${periodLabel}</p>
  </div>
  <div class="meta">
    <div>Generated: ${today}</div>
    <div>${stats?.totalOrders || 0} orders &middot; ${stats?.totalSubscribers || 0} subscribers &middot; ${stats?.totalRestaurants || 0} restaurants</div>
  </div>
</div>

<div class="kpi-grid">
  <div class="kpi ${(stats?.netProfit || 0) >= 0 ? 'green' : 'red'}">
    <div class="value">${formatCurrency(stats?.netProfit || 0)}</div>
    <div class="label">Net Profit &middot; ${(stats?.profitMargin || 0).toFixed(1)}% margin</div>
  </div>
  <div class="kpi blue">
    <div class="value">${formatCurrency(stats?.totalRevenue || 0)}</div>
    <div class="label">Total Revenue</div>
  </div>
  <div class="kpi red">
    <div class="value">${formatCurrency(stats?.totalExpenses || 0)}</div>
    <div class="label">Total Expenses</div>
  </div>
  <div class="kpi purple">
    <div class="value">${stats?.totalSubscribers || 0}</div>
    <div class="label">Active Subscribers &middot; ${formatCurrency(stats?.subscriptionRevenue || 0)}</div>
  </div>
</div>

<div class="breakdown-grid">
  <div class="breakdown-card">
    <h3>Revenue Sources <span class="total green">${formatCurrency(stats?.totalRevenue || 0)}</span></h3>
    ${revenueRows.map(r => `<div class="row"><div><div class="name">${r.label}</div><div class="detail">${r.detail}</div></div><div class="amount">${formatCurrency(r.value)}</div></div>`).join("")}
  </div>
  <div class="breakdown-card">
    <h3>Expenses <span class="total red">${formatCurrency(stats?.totalExpenses || 0)}</span></h3>
    ${expenseRows.map(r => `<div class="row"><div><div class="name">${r.label}</div><div class="detail">${r.detail}</div></div><div class="amount">${formatCurrency(r.value)}</div></div>`).join("")}
  </div>
</div>

<div class="section-title">Profit by Restaurant</div>
<table>
  <thead>
    <tr>
      <th>Restaurant</th>
      <th class="right">Orders</th>
      <th class="right">Gross Revenue</th>
      <th class="right">Commission (${globalCommissionRate}%)</th>
      <th class="right">Payout (${100 - globalCommissionRate}%)</th>
    </tr>
  </thead>
  <tbody>
    ${restaurantData.length === 0
      ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">No restaurant data</td></tr>`
      : restaurantData.map(r => `<tr>
        <td>${r.restaurantName}</td>
        <td class="right">${r.totalOrders}</td>
        <td class="right">${formatCurrency(r.grossRevenue)}</td>
        <td class="right purple">${formatCurrency(r.commission)}</td>
        <td class="right green">${formatCurrency(r.payout)}</td>
      </tr>`).join("")}
  </tbody>
  ${restaurantData.length > 0 ? `<tfoot><tr>
    <td>Total</td>
    <td class="right">${restaurantData.reduce((s, r) => s + r.totalOrders, 0)}</td>
    <td class="right">${formatCurrency(restaurantData.reduce((s, r) => s + r.grossRevenue, 0))}</td>
    <td class="right purple">${formatCurrency(restaurantData.reduce((s, r) => s + r.commission, 0))}</td>
    <td class="right green">${formatCurrency(restaurantData.reduce((s, r) => s + r.payout, 0))}</td>
  </tr></tfoot>` : ""}
</table>

<div class="footer">
  Nutrio Fuel &middot; Profit Report &middot; Generated ${today} &middot; ${periodLabel}
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const revenueItems = [
    { label: "Subscriptions", value: stats?.subscriptionRevenue || 0, icon: Users, color: "indigo", detail: `${stats?.totalSubscribers || 0} subscribers` },
    { label: `Commission (${globalCommissionRate}%)`, value: stats?.commissionRevenue || 0, icon: Percent, color: "purple", detail: `${stats?.totalOrders || 0} orders` },
    { label: "Unused Meals", value: stats?.unusedMealsProfit || 0, icon: Utensils, color: "amber", detail: "Unordered meal credits" },
    { label: "Featured Listings", value: stats?.featuredListingsRevenue || 0, icon: Star, color: "pink", detail: "Partner boosts" },
    { label: "Premium Analytics", value: stats?.premiumAnalyticsRevenue || 0, icon: BarChart3, color: "teal", detail: "Analytics upgrades" },
  ];

  const expenseItems = [
    { label: "Driver Costs", value: stats?.driverCosts || 0, icon: Truck, color: "red", detail: "Delivery fees + tips" },
    { label: "Refunds", value: stats?.refundCosts || 0, icon: RotateCcw, color: "orange", detail: "Cancelled orders" },
    { label: "Affiliate Payouts", value: stats?.affiliateCosts || 0, icon: Share2, color: "rose", detail: "Referral commissions" },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profit Dashboard</h1>
            <p className="text-muted-foreground">
              {stats?.totalOrders || 0} orders &middot; {stats?.totalSubscribers || 0} subscribers &middot; {stats?.totalRestaurants || 0} restaurants
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportReport}>
              <Printer className="h-4 w-4" />
              Export Report
            </Button>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(stats?.netProfit || 0) >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  <Wallet className={`h-5 w-5 ${(stats?.netProfit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${(stats?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(stats?.netProfit || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Net Profit &middot; {(stats?.profitMargin || 0) >= 0 ? '+' : ''}{(stats?.profitMargin || 0).toFixed(1)}% margin
                  </p>
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
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalExpenses || 0)}</p>
                  <p className="text-xs text-muted-foreground">Total Expenses</p>
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
                  <p className="text-2xl font-bold">{stats?.totalSubscribers || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    Subscribers &middot; {formatCurrency(stats?.subscriptionRevenue || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue vs Expenses chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGradient)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGradient)" name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2.5} dot={false} name="Net Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue & Expenses breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Revenue sources */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Revenue Sources</CardTitle>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(stats?.totalRevenue || 0)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {revenueItems.map((item) => {
                const pct = (stats?.totalRevenue || 0) > 0 ? (item.value / (stats?.totalRevenue || 1)) * 100 : 0;
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-${item.color}-500/10 flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 text-${item.color}-500`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{item.label}</span>
                        <span className="text-sm font-semibold ml-2">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${item.color}-500 rounded-full transition-all`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Expense sources */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Expenses</CardTitle>
                <span className="text-sm font-semibold text-red-600">{formatCurrency(stats?.totalExpenses || 0)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenseItems.map((item) => {
                const pct = (stats?.totalExpenses || 0) > 0 ? (item.value / (stats?.totalExpenses || 1)) * 100 : 0;
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg bg-${item.color}-500/10 flex items-center justify-center shrink-0`}>
                      <Icon className={`h-4 w-4 text-${item.color}-500`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{item.label}</span>
                        <span className="text-sm font-semibold ml-2">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full bg-${item.color}-500 rounded-full transition-all`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Restaurant profit table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profit by Restaurant</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Gross Revenue</TableHead>
                  <TableHead className="text-right">Commission ({globalCommissionRate}%)</TableHead>
                  <TableHead className="text-right">Payout ({100 - globalCommissionRate}%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurantData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No restaurant data available
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {restaurantData.map((restaurant, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{restaurant.restaurantName}</TableCell>
                        <TableCell className="text-right">{restaurant.totalOrders}</TableCell>
                        <TableCell className="text-right">{formatCurrency(restaurant.grossRevenue)}</TableCell>
                        <TableCell className="text-right text-purple-600 font-medium">{formatCurrency(restaurant.commission)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(restaurant.payout)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{restaurantData.reduce((s, r) => s + r.totalOrders, 0)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(restaurantData.reduce((s, r) => s + r.grossRevenue, 0))}</TableCell>
                      <TableCell className="text-right text-purple-600">{formatCurrency(restaurantData.reduce((s, r) => s + r.commission, 0))}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(restaurantData.reduce((s, r) => s + r.payout, 0))}</TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
