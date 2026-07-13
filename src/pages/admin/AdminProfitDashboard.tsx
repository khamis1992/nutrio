import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
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

const C = {
  text: "#020617",
  muted: "#94A3B8",
  surface: "#F6F8FB",
  water: "#38BDF8",
  danger: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

function ProfitMetricCard({
  label,
  value,
  detail,
  color,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
  icon: ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: C.muted }}>
              {label}
            </p>
            <p className="mt-3 text-3xl font-black leading-none tracking-tight" style={{ color }}>
              {value}
            </p>
            <p className="mt-2 text-sm font-medium" style={{ color: C.muted }}>
              {detail}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
            {icon}
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: C.surface }}>
          <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({
  label,
  value,
  detail,
  icon,
  color,
  pct,
}: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  color: string;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F6F8FB] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="truncate text-sm font-black text-[#020617]">{label}</span>
          <span className="ml-2 shrink-0 text-sm font-black text-[#020617]">{formatCurrency(value)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
          </div>
          <span className="w-10 text-right text-xs font-bold text-[#94A3B8]">{pct.toFixed(0)}%</span>
        </div>
        <p className="mt-1 text-xs font-medium text-[#94A3B8]">{detail}</p>
      </div>
    </div>
  );
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

      // Active subscriptions are an operational count. Revenue comes only
      // from completed, fulfilled payment records.
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("id, created_at")
        .eq("status", "active");

      const { data: subscriptionPayments } = await supabase
        .from("payments")
        .select("amount, completed_at")
        .eq("payment_type", "subscription")
        .eq("status", "completed")
        .eq("fulfillment_status", "completed")
        .gte("completed_at", startDate.toISOString());

      const subscriptionRevenue = (subscriptionPayments || []).reduce(
        (sum, payment) => sum + (payment.amount ?? 0),
        0
      );

      // 2. Fetch orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total_amount, created_at, restaurant_id")
        .gte("created_at", startDate.toISOString())
        .in("status", ["completed", "delivered"]);

      // 2b. Fetch restaurant names separately (no FK relationship on orders)
      const restaurantIds = [...new Set(
        (orders || [])
          .map((order) => order.restaurant_id)
          .filter((restaurantId): restaurantId is string => restaurantId !== null)
      )];
      const { data: restaurantsList } = restaurantIds.length > 0
        ? await supabase.from("restaurants").select("id, name, commission_rate").in("id", restaurantIds)
        : { data: [] };
      const restaurantNameMap: Record<string, string> = {};
      const restaurantCommissionMap: Record<string, number> = {};
      (restaurantsList || []).forEach((restaurant) => {
        restaurantNameMap[restaurant.id] = restaurant.name;
        restaurantCommissionMap[restaurant.id] = restaurant.commission_rate ?? commissionRate;
      });

      // 3. Calculate commission from total_amount using platform commission rate
      const commissionRevenue = (orders || []).reduce(
        (sum, order) =>
          sum +
          (order.total_amount ?? 0) *
            ((order.restaurant_id
              ? restaurantCommissionMap[order.restaurant_id]
              : commissionRate) /
              100),
        0
      );

      const totalOrderedMeals = (orders || []).length;
      const unusedMealsProfit = 0;

      // 5. Fetch featured listings revenue
      const { data: featuredListings } = await supabase
        .from("featured_listings")
        .select("price_paid, created_at, payment_reference, status")
        .gte("created_at", startDate.toISOString())
        .in("status", ["active", "expired"])
        .not("payment_reference", "is", null);

      const featuredListingsRevenue = (featuredListings || []).reduce(
        (sum, listing) => sum + (listing.price_paid ?? 0),
        0
      );

      // 6. Fetch premium analytics purchases revenue
      const { data: analyticsPurchases } = await supabase
        .from("premium_analytics_purchases")
        .select("price_paid, created_at, payment_reference, status")
        .gte("created_at", startDate.toISOString())
        .eq("status", "active")
        .not("payment_reference", "is", null);

      const premiumAnalyticsRevenue = (analyticsPurchases || []).reduce(
        (sum, purchase) => sum + (purchase.price_paid ?? 0),
        0
      );

      // 7. Fetch expenses
      
      // Driver costs are recognized only for completed delivery jobs.
      const { data: deliveries } = await supabase
        .from("delivery_jobs")
        .select("delivery_fee, tip_amount, delivered_at")
        .in("status", ["delivered", "completed"])
        .gte("delivered_at", startDate.toISOString());
      
      const driverCosts = (deliveries || []).reduce(
        (sum, delivery) => sum + (delivery.delivery_fee ?? 0) + (delivery.tip_amount ?? 0),
        0
      );

      // b) Refund costs - from order_cancellations table
      const { data: cancellations } = await supabase
        .from("order_cancellations")
        .select("refund_amount, created_at")
        .gte("created_at", startDate.toISOString());
      
      const refundCosts = (cancellations || []).reduce(
        (sum, cancellation) => sum + (cancellation.refund_amount ?? 0),
        0
      );

      // c) Affiliate costs - from affiliate_commissions
      const { data: affiliateCommissions } = await supabase
        .from("affiliate_commissions")
        .select("commission_amount, created_at")
        .gte("created_at", startDate.toISOString())
        .eq("status", "paid");
      
      const affiliateCosts = (affiliateCommissions || []).reduce(
        (sum, commission) => sum + (commission.commission_amount ?? 0),
        0
      );

      // Total expenses
      const totalExpenses = driverCosts + refundCosts + affiliateCosts;

      // Total revenue and net profit
      const totalRevenue = subscriptionRevenue + commissionRevenue + featuredListingsRevenue + premiumAnalyticsRevenue;
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
        totalRestaurants: new Set((orders || []).map((order) => order.restaurant_id).filter(Boolean)).size,
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
      (subscriptionPayments || []).forEach((payment: Record<string, unknown>) => {
        const dateStr = (payment.completed_at as string)?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          dailyMap[dateStr].revenue += (payment.amount as number) || 0;
          dailyMap[dateStr].profit += (payment.amount as number) || 0;
        }
      });

      (orders || []).forEach((o: Record<string, unknown>) => {
        const dateStr = (o.created_at as string)?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          const restaurantId = o.restaurant_id as string | undefined;
          const rate = restaurantId ? restaurantCommissionMap[restaurantId] ?? commissionRate : commissionRate;
          const comm = (Number(o.total_amount) || 0) * (rate / 100);
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
        const dateStr = (d.delivered_at as string)?.split("T")[0];
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
        const restaurantRate = restaurantCommissionMap[rid] ?? commissionRate;
        const orderCommission = orderTotal * (restaurantRate / 100);
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
      { label: "Order commissions", value: stats?.commissionRevenue || 0, detail: `${stats?.totalOrders || 0} completed orders` },
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
      <th class="right">Commission</th>
      <th class="right">Payout</th>
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
    { label: "Subscriptions", value: stats?.subscriptionRevenue || 0, icon: Users, color: C.protein, detail: `${stats?.totalSubscribers || 0} subscribers` },
    { label: "Order commissions", value: stats?.commissionRevenue || 0, icon: Percent, color: C.progress, detail: `${stats?.totalOrders || 0} completed orders` },
    { label: "Featured Listings", value: stats?.featuredListingsRevenue || 0, icon: Star, color: C.danger, detail: "Partner boosts" },
    { label: "Premium Analytics", value: stats?.premiumAnalyticsRevenue || 0, icon: BarChart3, color: C.protein, detail: "Analytics upgrades" },
  ];

  const expenseItems = [
    { label: "Driver Costs", value: stats?.driverCosts || 0, icon: Truck, color: C.danger, detail: "Delivery fees + tips" },
    { label: "Refunds", value: stats?.refundCosts || 0, icon: RotateCcw, color: C.water, detail: "Cancelled orders" },
    { label: "Affiliate Payouts", value: stats?.affiliateCosts || 0, icon: Share2, color: C.protein, detail: "Referral commissions" },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-96 items-center justify-center bg-[#F6F8FB]">
          <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        {/* Page header */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_28px_rgba(34,199,161,0.22)]" style={{ backgroundColor: C.progress }}>
                <Wallet className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: C.progress }}>
                  Profit intelligence
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight" style={{ color: C.text }}>
                  Profit Dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6" style={{ color: C.muted }}>
                  Revenue, expense, margin, restaurant commission, and platform profitability for {periodLabel.toLowerCase()}.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-slate-200 bg-white px-4 font-bold text-[#020617] shadow-sm hover:bg-[#F6F8FB]"
                onClick={handleExportReport}
              >
                <Printer className="mr-2 h-4 w-4 text-[#38BDF8]" />
                Export Report
              </Button>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-11 w-40 rounded-xl border-slate-200 bg-white font-bold text-[#020617] shadow-sm">
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
          <div className="grid border-t border-slate-100 bg-[#F6F8FB]/70 px-6 py-4 text-sm font-semibold sm:grid-cols-3">
            <span style={{ color: C.muted }}>Orders: <strong className="text-[#020617]">{stats?.totalOrders || 0}</strong></span>
            <span style={{ color: C.muted }}>Subscribers: <strong className="text-[#020617]">{stats?.totalSubscribers || 0}</strong></span>
            <span style={{ color: C.muted }}>Restaurants: <strong className="text-[#020617]">{stats?.totalRestaurants || 0}</strong></span>
          </div>
        </div>

        {/* KPI stat cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ProfitMetricCard
            label="Net profit"
            value={formatCurrency(stats?.netProfit || 0)}
            detail={`${(stats?.profitMargin || 0) >= 0 ? "+" : ""}${(stats?.profitMargin || 0).toFixed(1)}% margin`}
            color={(stats?.netProfit || 0) >= 0 ? C.progress : C.danger}
            icon={<Wallet className="h-6 w-6" />}
          />
          <ProfitMetricCard
            label="Total revenue"
            value={formatCurrency(stats?.totalRevenue || 0)}
            detail="Gross platform revenue"
            color={C.water}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <ProfitMetricCard
            label="Total expenses"
            value={formatCurrency(stats?.totalExpenses || 0)}
            detail="Driver, refund, affiliate cost"
            color={C.danger}
            icon={<TrendingDown className="h-6 w-6" />}
          />
          <ProfitMetricCard
            label="Subscribers"
            value={`${stats?.totalSubscribers || 0}`}
            detail={formatCurrency(stats?.subscriptionRevenue || 0)}
            color={C.protein}
            icon={<Users className="h-6 w-6" />}
          />
        </div>

        {/* Revenue vs Expenses chart */}
        <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <CardHeader className="border-b border-slate-100 px-6 py-5">
            <CardTitle className="text-xl font-black text-[#020617]">Revenue vs Expenses</CardTitle>
            <p className="text-sm font-medium text-[#94A3B8]">Daily revenue, expenses, and net profit trend.</p>
          </CardHeader>
          <CardContent className="p-6">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.22}/>
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FB6B7A" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#FB6B7A" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: C.muted, fontWeight: 700 }} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{ fill: C.muted }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 12px 30px rgba(2,6,23,0.08)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#38BDF8" strokeWidth={2.5} fill="url(#revenueGradient)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#FB6B7A" strokeWidth={2.5} fill="url(#expenseGradient)" name="Expenses" />
                <Line type="monotone" dataKey="profit" stroke="#22C7A1" strokeWidth={3} dot={false} name="Net Profit" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue & Expenses breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Revenue sources */}
          <Card className="rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100 lg:col-span-3">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-black text-[#020617]">Revenue Sources</CardTitle>
                <span className="text-sm font-black text-[#22C7A1]">{formatCurrency(stats?.totalRevenue || 0)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {revenueItems.map((item) => {
                const pct = (stats?.totalRevenue || 0) > 0 ? (item.value / (stats?.totalRevenue || 1)) * 100 : 0;
                const Icon = item.icon;
                return (
                  <BreakdownRow
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    detail={item.detail}
                    icon={<Icon className="h-4 w-4" />}
                    color={item.color}
                    pct={pct}
                  />
                );
              })}
            </CardContent>
          </Card>

          {/* Expense sources */}
          <Card className="rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100 lg:col-span-2">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-black text-[#020617]">Expenses</CardTitle>
                <span className="text-sm font-black text-[#FB6B7A]">{formatCurrency(stats?.totalExpenses || 0)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {expenseItems.map((item) => {
                const pct = (stats?.totalExpenses || 0) > 0 ? (item.value / (stats?.totalExpenses || 1)) * 100 : 0;
                const Icon = item.icon;
                return (
                  <BreakdownRow
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    detail={item.detail}
                    icon={<Icon className="h-4 w-4" />}
                    color={item.color}
                    pct={pct}
                  />
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Restaurant profit table */}
        <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <CardHeader className="border-b border-slate-100 px-6 py-5">
            <CardTitle className="text-xl font-black text-[#020617]">Profit by Restaurant</CardTitle>
            <p className="text-sm font-medium text-[#94A3B8]">Commission and payout split by partner restaurant.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader className="bg-[#F6F8FB]">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Restaurant</TableHead>
                  <TableHead className="text-right text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Orders</TableHead>
                  <TableHead className="text-right text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Gross Revenue</TableHead>
                  <TableHead className="text-right text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Commission</TableHead>
                  <TableHead className="text-right text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurantData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                          <BarChart3 className="h-6 w-6 text-[#94A3B8]" />
                        </div>
                        <p className="font-bold text-[#020617]">No restaurant data available</p>
                        <p className="text-sm font-medium text-[#94A3B8]">Restaurant profit appears after orders are created.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {restaurantData.map((restaurant, i) => (
                      <TableRow key={i} className="border-slate-100 transition-colors hover:bg-[#F6F8FB]/70">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                              <Utensils className="h-5 w-5" />
                            </div>
                            <span className="font-black text-[#020617]">{restaurant.restaurantName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-[#020617]">{restaurant.totalOrders}</TableCell>
                        <TableCell className="text-right font-bold text-[#020617]">{formatCurrency(restaurant.grossRevenue)}</TableCell>
                        <TableCell className="text-right font-black text-[#7C83F6]">{formatCurrency(restaurant.commission)}</TableCell>
                        <TableCell className="text-right font-bold text-[#22C7A1]">{formatCurrency(restaurant.payout)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-[#F6F8FB] font-black">
                      <TableCell className="text-[#020617]">Total</TableCell>
                      <TableCell className="text-right text-[#020617]">{restaurantData.reduce((s, r) => s + r.totalOrders, 0)}</TableCell>
                      <TableCell className="text-right text-[#020617]">{formatCurrency(restaurantData.reduce((s, r) => s + r.grossRevenue, 0))}</TableCell>
                      <TableCell className="text-right text-[#7C83F6]">{formatCurrency(restaurantData.reduce((s, r) => s + r.commission, 0))}</TableCell>
                      <TableCell className="text-right text-[#22C7A1]">{formatCurrency(restaurantData.reduce((s, r) => s + r.payout, 0))}</TableCell>
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
