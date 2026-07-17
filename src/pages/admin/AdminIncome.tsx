import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminKpiStrip,
  AdminPanel,
  AdminPanelHeader,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Users,
  Loader2,
  CalendarDays,
  Percent,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

interface IncomeStats {
  totalRevenue: number;
  subscriptionRevenue: number;
  commissionRevenue: number;
  totalOrders: number;
  activeSubscribers: number;
  avgOrderValue: number;
}

interface DailyIncome {
  date: string;
  subscription: number;
  commission: number;
  orders: number;
}

const AdminIncome = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [globalCommissionRate, setGlobalCommissionRate] = useState<number>(18);
  const [stats, setStats] = useState<IncomeStats>({
    totalRevenue: 0,
    subscriptionRevenue: 0,
    commissionRevenue: 0,
    totalOrders: 0,
    activeSubscribers: 0,
    avgOrderValue: 0,
  });
  const [dailyData, setDailyData] = useState<DailyIncome[]>([]);

  const fetchGlobalCommissionRate = useCallback(async () => {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_rates")
      .single();
    if (error) {
      console.error("Error fetching commission rate:", error);
      return;
    }
    if (data?.value) {
      const rates =
        typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (rates && typeof rates === "object" && !Array.isArray(rates)) {
        const restaurantRate = (rates as Record<string, unknown>).restaurant;
        if (typeof restaurantRate === "number")
          setGlobalCommissionRate(restaurantRate);
      }
    }
  }, []);

  useEffect(() => {
    fetchGlobalCommissionRate();
  }, [fetchGlobalCommissionRate]);

  const fetchIncomeData = useCallback(async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const startDateStr = startDate.toISOString().split("T")[0];

      const { count: activeSubscribers, error: subscribersError } =
        await supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active");
      if (subscribersError) throw subscribersError;

      const { data: subscriptionPayments, error: paymentsError } =
        await supabase
          .from("payments")
          .select("amount, completed_at")
          .eq("payment_type", "subscription")
          .eq("status", "completed")
          .eq("fulfillment_status", "completed")
          .gte("completed_at", startDate.toISOString());
      if (paymentsError) throw paymentsError;

      const subscriptionRevenue = (subscriptionPayments || []).reduce(
        (sum, payment) => sum + (payment.amount || 0),
        0,
      );

      const [schedulesResult, directOrdersResult] = await Promise.all([
        supabase
          .from("meal_schedules")
          .select(
            "id, scheduled_date, meal_id, meals:meals!meal_schedules_meal_id_fkey(price, restaurant_id)",
          )
          .gte("scheduled_date", startDateStr)
          .in("order_status", ["delivered", "completed"]),
        supabase
          .from("orders")
          .select("id, created_at, total_amount, restaurant_id")
          .gte("created_at", startDate.toISOString())
          .in("status", ["delivered", "completed"]),
      ]);
      if (schedulesResult.error) throw schedulesResult.error;
      if (directOrdersResult.error) throw directOrdersResult.error;

      const schedules = schedulesResult.data || [];
      const directOrders = directOrdersResult.data || [];
      const restaurantIds = [
        ...new Set([
          ...schedules
            .map((order) => order.meals?.restaurant_id)
            .filter(Boolean),
          ...directOrders.map((order) => order.restaurant_id).filter(Boolean),
        ] as string[]),
      ];
      const { data: restaurants, error: restaurantsError } =
        restaurantIds.length
          ? await supabase
              .from("restaurants")
              .select("id, commission_rate")
              .in("id", restaurantIds)
          : { data: [], error: null };
      if (restaurantsError) throw restaurantsError;
      const commissionRates = new Map(
        (restaurants || []).map((restaurant) => [
          restaurant.id,
          restaurant.commission_rate ?? globalCommissionRate,
        ]),
      );

      const incomeOrders = [
        ...schedules.map((order) => ({
          date: order.scheduled_date,
          amount: order.meals?.price || 0,
          commissionRate: order.meals?.restaurant_id
            ? (commissionRates.get(order.meals.restaurant_id) ??
              globalCommissionRate)
            : globalCommissionRate,
        })),
        ...directOrders.map((order) => ({
          date: order.created_at.split("T")[0],
          amount: order.total_amount || 0,
          commissionRate: order.restaurant_id
            ? (commissionRates.get(order.restaurant_id) ?? globalCommissionRate)
            : globalCommissionRate,
        })),
      ];

      const totalOrders = incomeOrders.length;

      const deliveredMealValue = incomeOrders.reduce(
        (sum, order) => sum + order.amount,
        0,
      );
      const commissionRevenue = incomeOrders.reduce(
        (sum, order) => sum + order.amount * (order.commissionRate / 100),
        0,
      );
      const totalRevenue = subscriptionRevenue + commissionRevenue;

      setStats({
        totalRevenue,
        subscriptionRevenue,
        commissionRevenue,
        totalOrders,
        activeSubscribers: activeSubscribers || 0,
        avgOrderValue: totalOrders ? deliveredMealValue / totalOrders : 0,
      });

      // Build daily data
      const dailyMap: Record<
        string,
        { subscription: number; commission: number; orders: number }
      > = {};
      for (let i = daysAgo - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        dailyMap[dateStr] = { subscription: 0, commission: 0, orders: 0 };
      }

      // Add subscription revenue by day
      (subscriptionPayments || []).forEach((payment) => {
        const dateStr = payment.completed_at?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          dailyMap[dateStr].subscription += payment.amount || 0;
        }
      });

      // Add orders by day
      incomeOrders.forEach((order) => {
        const dateStr = order.date;
        if (dateStr && dailyMap[dateStr]) {
          dailyMap[dateStr].orders += 1;
          dailyMap[dateStr].commission +=
            order.amount * (order.commissionRate / 100);
        }
      });

      setDailyData(
        Object.entries(dailyMap).map(([date, data]) => ({
          date: date.slice(5), // MM-DD
          ...data,
        })),
      );
    } catch (err) {
      console.error("Error fetching income data:", err);
    } finally {
      setLoading(false);
    }
  }, [period, globalCommissionRate]);

  useEffect(() => {
    fetchIncomeData();
  }, [fetchIncomeData, period, globalCommissionRate]);

  const statCards = [
    {
      title: "Total Revenue",
      label: "platform income",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "#22C7A1",
    },
    {
      title: "Subscription Revenue",
      label: "recurring",
      value: formatCurrency(stats.subscriptionRevenue),
      icon: TrendingUp,
      color: "#7C83F6",
    },
    {
      title: "Order Commissions",
      label: `${globalCommissionRate}% default`,
      value: formatCurrency(stats.commissionRevenue),
      icon: ShoppingBag,
      color: "#F97316",
    },
    {
      title: "Active Subscribers",
      label: "customers",
      value: stats.activeSubscribers.toString(),
      icon: Users,
      color: "#38BDF8",
    },
    {
      title: "Average Order Value",
      label: `${stats.totalOrders} delivered orders`,
      value: formatCurrency(stats.avgOrderValue),
      icon: Percent,
      color: "#FB6B7A",
    },
  ];

  return (
    <AdminLayout
      title="Income Overview"
      subtitle="Track subscription revenue, commissions, and order value"
    >
      <div className="space-y-5">
        <AdminWorkbenchHeader
          eyebrow="Income"
          title="Revenue overview workbench"
          icon={DollarSign}
          accent="#22C7A1"
          description="Track subscription revenue, partner commissions, delivered orders, and revenue mix in one operational view."
          meta={[
            {
              label: "Total revenue",
              value: formatCurrency(stats.totalRevenue),
            },
            { label: "Orders", value: stats.totalOrders },
            { label: "Subscribers", value: stats.activeSubscribers },
          ]}
          actions={
            <div className="flex min-w-[260px] flex-col gap-2 rounded-[16px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                <CalendarDays className="h-4 w-4 text-[#7C83F6]" />
                Reporting range
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-12 rounded-[16px] border-[#E5EAF1] bg-white text-sm font-black text-[#020617] shadow-none focus:ring-[#020617]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)]">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#22C7A1]" />
              <p className="mt-3 text-sm font-black text-[#020617]">
                Loading income data
              </p>
              <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                Building the latest revenue snapshot.
              </p>
            </div>
          </div>
        ) : (
          <>
            <AdminKpiStrip
              className="xl:grid-cols-5 2xl:grid-cols-5"
              items={statCards.map((card) => ({
                label: card.label,
                value: card.value,
                helper: card.title,
                icon: card.icon,
                accent: card.color as
                  | "#22C7A1"
                  | "#7C83F6"
                  | "#38BDF8"
                  | "#FB6B7A"
                  | "#F97316",
              }))}
            />

            <AdminPanel>
              <AdminPanelHeader
                title="Revenue Trend"
                eyebrow="Revenue mix"
                actions={
                  <div className="hidden items-center gap-3 text-xs font-black text-[#94A3B8] sm:flex">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#7C83F6]" />
                      Subscription
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                      Commission
                    </span>
                  </div>
                }
              />
              <div className="p-3 sm:p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF1" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      tickFormatter={(v) => `${v}`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatCurrency(value),
                        "Revenue",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="subscription"
                      stroke="#7C83F6"
                      strokeWidth={3}
                      dot={false}
                      name="Subscription"
                    />
                    <Line
                      type="monotone"
                      dataKey="commission"
                      stroke="#F97316"
                      strokeWidth={3}
                      dot={false}
                      name="Commission"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AdminPanel>

            <AdminPanel>
              <AdminPanelHeader title="Daily Orders" eyebrow="Operations" />
              <div className="p-3 sm:p-5">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF1" />
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
                    <Tooltip />
                    <Bar
                      dataKey="orders"
                      fill="#22C7A1"
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AdminPanel>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminIncome;
