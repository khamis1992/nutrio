import { useState, useEffect } from "react";
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
import { DollarSign, TrendingUp, ShoppingBag, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

interface IncomeStats {
  totalRevenue: number;
  subscriptionRevenue: number;
  orderRevenue: number;
  totalOrders: number;
  activeSubscribers: number;
  avgOrderValue: number;
}

interface DailyIncome {
  date: string;
  revenue: number;
  orders: number;
}

const AdminIncome = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [stats, setStats] = useState<IncomeStats>({
    totalRevenue: 0,
    subscriptionRevenue: 0,
    orderRevenue: 0,
    totalOrders: 0,
    activeSubscribers: 0,
    avgOrderValue: 0,
  });
  const [dailyData, setDailyData] = useState<DailyIncome[]>([]);

  useEffect(() => {
    fetchIncomeData();
  }, [period]);

  const fetchIncomeData = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const startDateStr = startDate.toISOString().split("T")[0];

      // Fetch subscription revenue
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("plan_type, amount, created_at")
        .gte("created_at", startDate.toISOString())
        .eq("status", "active");

      const subscriptionRevenue = (subscriptions || []).reduce(
        (sum, s) => sum + (s.amount || 0),
        0
      );
      const activeSubscribers = (subscriptions || []).length;

      // Fetch order/schedule data for revenue
      const { data: schedules } = await supabase
        .from("meal_schedules")
        .select("scheduled_date, meal_id, user_id")
        .gte("scheduled_date", startDateStr)
        .eq("status", "delivered");

      const totalOrders = (schedules || []).length;

      // Build daily data
      const dailyMap: Record<string, { revenue: number; orders: number }> = {};
      for (let i = daysAgo - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        dailyMap[dateStr] = { revenue: 0, orders: 0 };
      }

      (schedules || []).forEach((s) => {
        const dateStr = s.scheduled_date;
        if (dailyMap[dateStr]) {
          dailyMap[dateStr].orders += 1;
          dailyMap[dateStr].revenue += 35; // Estimated average meal price
        }
      });

      const orderRevenue = totalOrders * 35;
      const totalRevenue = subscriptionRevenue + orderRevenue;

      setStats({
        totalRevenue,
        subscriptionRevenue,
        orderRevenue,
        totalOrders,
        activeSubscribers,
        avgOrderValue: totalOrders ? orderRevenue / totalOrders : 0,
      });

      setDailyData(
        Object.entries(dailyMap).map(([date, data]) => ({
          date: date.slice(5), // MM-DD
          ...data,
        }))
      );
    } catch (err) {
      console.error("Error fetching income data:", err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      title: "Subscription Revenue",
      value: formatCurrency(stats.subscriptionRevenue),
      icon: TrendingUp,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      title: "Order Revenue",
      value: formatCurrency(stats.orderRevenue),
      icon: ShoppingBag,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      title: "Active Subscribers",
      value: stats.activeSubscribers.toString(),
      icon: Users,
      color: "text-orange-500",
      bg: "bg-orange-50",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Income Overview</h1>
            <p className="text-muted-foreground">Track revenue and financial performance</p>
          </div>
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

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <Card key={card.title}>
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-6 h-6 ${card.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{card.value}</p>
                        <p className="text-xs text-muted-foreground">{card.title}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}`} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Orders Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Orders</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminIncome;
