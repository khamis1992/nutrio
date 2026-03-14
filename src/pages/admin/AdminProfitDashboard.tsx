import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { 
  TrendingUp, 
  Calculator,
  Percent,
  Users,
  Wallet,
  Loader2,
  TrendingDown
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

  useEffect(() => {
    fetchGlobalCommissionRate();
    fetchProfitData();
  }, [period]);

  const fetchGlobalCommissionRate = async () => {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "commission_rates")
      .single();
    if (data?.value) {
      const rates = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      setGlobalCommissionRate(rates?.restaurant ?? 18);
    }
  };

  const fetchProfitData = async () => {
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
        (sum: number, s: any) => sum + (s.price || 0),
        0
      );

      // 2. Fetch orders with commission data
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          id,
          total_amount,
          commission_rate,
          commission_amount,
          restaurant_payout,
          created_at,
          restaurant_id,
          restaurants:restaurants(name)
        `)
        .gte("created_at", startDate.toISOString());

      // 3. Calculate commission (18% of each order)
      const commissionRevenue = (orders || []).reduce(
        (sum: number, o: any) => sum + (Number(o.commission_amount) || 0),
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
      const expectedMeals = (subscriptions || []).reduce((sum: number, sub: any) => {
        const plan = subscriptionPlans?.find((p: any) => p.tier === sub.plan_type);
        return sum + (plan?.meals_per_month || 0);
      }, 0);

      // Estimate unused meals profit
      const unusedMeals = Math.max(0, expectedMeals - totalOrderedMeals);
      const unusedMealsProfit = unusedMeals * avgMealPrice;

      // 5. Fetch expenses
      
      // a) Driver costs - from deliveries table
      const { data: deliveries } = await supabase
        .from("deliveries")
        .select("delivery_fee, tip_amount, created_at");
      
      const driverCosts = (deliveries || []).reduce(
        (sum: number, d: any) => sum + (Number(d.delivery_fee) || 0) + (Number(d.tip_amount) || 0),
        0
      );

      // b) Refund costs - from order_cancellations table
      const { data: cancellations } = await supabase
        .from("order_cancellations")
        .select("refund_amount, created_at");
      
      const refundCosts = (cancellations || []).reduce(
        (sum: number, c: any) => sum + (Number(c.refund_amount) || 0),
        0
      );

      // c) Affiliate costs - from affiliate_commissions
      const { data: affiliateCommissions } = await supabase
        .from("affiliate_commissions")
        .select("commission_amount, created_at")
        .gte("created_at", startDate.toISOString())
        .eq("status", "paid");
      
      const affiliateCosts = (affiliateCommissions || []).reduce(
        (sum: number, c: any) => sum + (Number(c.commission_amount) || 0),
        0
      );

      // Total expenses
      const totalExpenses = driverCosts + refundCosts + affiliateCosts;

      // Total revenue and net profit
      const totalRevenue = subscriptionRevenue + commissionRevenue + unusedMealsProfit;
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
        driverCosts,
        refundCosts,
        affiliateCosts,
        totalOrders: totalOrderedMeals,
        totalRestaurants: new Set((orders || []).map((o: any) => o.restaurant_id)).size,
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
      (subscriptions || []).forEach((s: any) => {
        const dateStr = s.created_at?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          dailyMap[dateStr].revenue += s.price || 0;
          dailyMap[dateStr].profit += s.price || 0;
        }
      });

      // Add commission by day
      (orders || []).forEach((o: any) => {
        const dateStr = o.created_at?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          const comm = Number(o.commission_amount) || 0;
          dailyMap[dateStr].revenue += comm;
          dailyMap[dateStr].profit += comm;
        }
      });

      // Add driver costs as expenses
      (deliveries || []).forEach((d: any) => {
        const dateStr = d.created_at?.split("T")[0];
        if (dateStr && dailyMap[dateStr]) {
          const cost = (Number(d.delivery_fee) || 0) + (Number(d.tip_amount) || 0);
          dailyMap[dateStr].expenses += cost;
          dailyMap[dateStr].profit -= cost;
        }
      });

      setDailyData(Object.values(dailyMap));

      // 6. Restaurant breakdown
      const restaurantMap: Record<string, RestaurantProfit> = {};
      (orders || []).forEach((o: any) => {
        const rid = o.restaurant_id;
        const rname = o.restaurants?.name || "Unknown";
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
        restaurantMap[rid].totalOrders += 1;
        restaurantMap[rid].grossRevenue += Number(o.total_amount) || 0;
        restaurantMap[rid].commission += Number(o.commission_amount) || 0;
        restaurantMap[rid].payout += Number(o.restaurant_payout) || 0;
      });
      setRestaurantData(Object.values(restaurantMap).sort((a, b) => b.commission - a.commission));

    } catch (error) {
      console.error("Error fetching profit data:", error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOCAxOC04LjA1OSAxOC0xOC04LjA1OS0xOC0xOHptMCAzMmMtNy43MzIgMC0xNC02LjI2OC0xNC0xNHM2LjI2OC0xNCAxNC0xNCAxNCA2LjI2OCAxNCAxNC02LjI2OCAxNC0xNHoiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ii8+PC9nPjwvc3ZnPg==')] opacity-30"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-500/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-green-500/20 to-transparent rounded-full blur-3xl"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                  <Wallet className="h-6 w-6" />
                </div>
                Profit Dashboard
              </h1>
              <p className="text-slate-300 mt-2 text-lg">Track your platform financial performance</p>
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg backdrop-blur-sm">
                  <div className={`w-2 h-2 rounded-full ${(stats?.netProfit || 0) >= 0 ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                  <span className="text-sm font-medium">{(stats?.netProfit || 0) >= 0 ? 'Profitable' : 'At Loss'}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {stats?.totalOrders || 0} orders • {stats?.totalSubscribers || 0} subscribers
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-slate-400">Net Profit</p>
                <p className={`text-3xl font-bold ${(stats?.netProfit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(stats?.netProfit || 0)}
                </p>
              </div>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-36 bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm">
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
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Net Profit Card */}
          <Card className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 opacity-50 group-hover:opacity-70 transition-opacity"></div>
            <CardContent className="relative pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Net Profit</p>
                  <p className={`text-3xl font-bold mt-2 ${(stats?.netProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(stats?.netProfit || 0)}
                  </p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className={`text-sm font-medium ${(stats?.profitMargin || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(stats?.profitMargin || 0) >= 0 ? '+' : ''}{(stats?.profitMargin || 0).toFixed(1)}%
                    </span>
                    <span className="text-sm text-slate-400">margin</span>
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Card */}
          <Card className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 opacity-50 group-hover:opacity-70 transition-opacity"></div>
            <CardContent className="relative pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Revenue</p>
                  <p className="text-3xl font-bold mt-2 text-blue-600">
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">All income sources</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expenses Card */}
          <Card className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-orange-50 opacity-50 group-hover:opacity-70 transition-opacity"></div>
            <CardContent className="relative pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Expenses</p>
                  <p className="text-3xl font-bold mt-2 text-red-600">
                    {formatCurrency(stats?.totalExpenses || 0)}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">Driver + Refunds + Affiliates</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 text-white shadow-lg shadow-red-500/25">
                  <TrendingDown className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscribers Card */}
          <Card className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-violet-50 opacity-50 group-hover:opacity-70 transition-opacity"></div>
            <CardContent className="relative pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Active Subscribers</p>
                  <p className="text-3xl font-bold mt-2 text-purple-600">
                    {stats?.totalSubscribers || 0}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">{formatCurrency(stats?.subscriptionRevenue || 0)} revenue</p>
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/25">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Section */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px] bg-slate-100 p-1 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
              Overview
            </TabsTrigger>
            <TabsTrigger value="revenue" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
              Revenue
            </TabsTrigger>
            <TabsTrigger value="expenses" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
              Expenses
            </TabsTrigger>
            <TabsTrigger value="restaurants" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium">
              Restaurants
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Revenue vs Expenses Chart */}
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">Revenue vs Expenses Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fill="url(#revenueGradient)" name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} fill="url(#expenseGradient)" name="Expenses" />
                    <Line type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }} name="Net Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
                <p className="text-sm text-green-600 font-medium">Commission ({globalCommissionRate}%)</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(stats?.commissionRevenue || 0)}</p>
                <p className="text-xs text-green-500 mt-1">{stats?.totalOrders || 0} orders</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
                <p className="text-sm text-orange-600 font-medium">Unused Meals</p>
                <p className="text-2xl font-bold text-orange-700 mt-1">{formatCurrency(stats?.unusedMealsProfit || 0)}</p>
                <p className="text-xs text-orange-500 mt-1">Pure profit</p>
              </div>
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-2xl p-4 border border-indigo-100">
                <p className="text-sm text-indigo-600 font-medium">Driver Costs</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{formatCurrency(stats?.driverCosts || 0)}</p>
                <p className="text-xs text-indigo-500 mt-1">Delivery fees</p>
              </div>
              <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-4 border border-rose-100">
                <p className="text-sm text-rose-600 font-medium">Refunds</p>
                <p className="text-2xl font-bold text-rose-700 mt-1">{formatCurrency(stats?.refundCosts || 0)}</p>
                <p className="text-xs text-rose-500 mt-1">Cancelled orders</p>
              </div>
            </div>
          </TabsContent>

          {/* REVENUE TAB */}
          <TabsContent value="revenue" className="space-y-6">
            {/* Revenue Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Subscription Revenue</p>
                      <p className="text-2xl font-bold mt-1 text-indigo-600">
                        {formatCurrency(stats?.subscriptionRevenue || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.totalSubscribers || 0} subscribers
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-indigo-100">
                      <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Commission ({globalCommissionRate}%)</p>
                      <p className="text-2xl font-bold mt-1 text-purple-600">
                        {formatCurrency(stats?.commissionRevenue || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.totalOrders || 0} orders
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-purple-100">
                      <Percent className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Unused Meals Profit</p>
                      <p className="text-2xl font-bold mt-1 text-orange-600">
                        {formatCurrency(stats?.unusedMealsProfit || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Meals not ordered
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-orange-100">
                      <Calculator className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Subscriptions', value: stats?.subscriptionRevenue || 0 },
                        { name: 'Commission', value: stats?.commissionRevenue || 0 },
                        { name: 'Unused Meals', value: stats?.unusedMealsProfit || 0 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      <Cell fill="#6366f1" />
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* EXPENSES TAB */}
          <TabsContent value="expenses" className="space-y-6">
            {/* Expense Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Driver Costs</p>
                      <p className="text-2xl font-bold mt-1 text-red-600">
                        {formatCurrency(stats?.driverCosts || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Delivery fees + tips
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-red-100">
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Refund Costs</p>
                      <p className="text-2xl font-bold mt-1 text-red-600">
                        {formatCurrency(stats?.refundCosts || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cancelled orders
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-red-100">
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Affiliate Costs</p>
                      <p className="text-2xl font-bold mt-1 text-red-600">
                        {formatCurrency(stats?.affiliateCosts || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Referral commissions
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-red-100">
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Expense Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Driver Costs', value: stats?.driverCosts || 0 },
                        { name: 'Refunds', value: stats?.refundCosts || 0 },
                        { name: 'Affiliate', value: stats?.affiliateCosts || 0 },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#f97316" />
                      <Cell fill="#dc2626" />
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RESTAURANTS TAB */}
          <TabsContent value="restaurants" className="space-y-6">
            {/* Restaurant Profit Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profit by Restaurant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">Restaurant</th>
                        <th className="text-right py-3 px-4 font-medium">Orders</th>
                        <th className="text-right py-3 px-4 font-medium">Gross Revenue</th>
                        <th className="text-right py-3 px-4 font-medium">Commission ({globalCommissionRate}%)</th>
                        <th className="text-right py-3 px-4 font-medium">Payout ({100 - globalCommissionRate}%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restaurantData.map((restaurant, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className="font-medium">{restaurant.restaurantName}</span>
                          </td>
                          <td className="text-right py-3 px-4">{restaurant.totalOrders}</td>
                          <td className="text-right py-3 px-4">{formatCurrency(restaurant.grossRevenue)}</td>
                          <td className="text-right py-3 px-4 text-purple-600 font-medium">
                            {formatCurrency(restaurant.commission)}
                          </td>
                          <td className="text-right py-3 px-4 text-green-600">
                            {formatCurrency(restaurant.payout)}
                          </td>
                        </tr>
                      ))}
                      {restaurantData.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">
                            No restaurant data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {restaurantData.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-medium">
                          <td className="py-3 px-4">Total</td>
                          <td className="text-right py-3 px-4">
                            {restaurantData.reduce((s, r) => s + r.totalOrders, 0)}
                          </td>
                          <td className="text-right py-3 px-4">
                            {formatCurrency(restaurantData.reduce((s, r) => s + r.grossRevenue, 0))}
                          </td>
                          <td className="text-right py-3 px-4 text-purple-600">
                            {formatCurrency(restaurantData.reduce((s, r) => s + r.commission, 0))}
                          </td>
                          <td className="text-right py-3 px-4 text-green-600">
                            {formatCurrency(restaurantData.reduce((s, r) => s + r.payout, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* How Profit is Calculated */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              How Profit is Calculated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-indigo-500" />
                  <span className="font-medium">Revenue Sources</span>
                </div>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Subscriptions: {formatCurrency(stats?.subscriptionRevenue || 0)}</li>
                  <li>• Commission ({globalCommissionRate}%): {formatCurrency(stats?.commissionRevenue || 0)}</li>
                  <li>• Unused Meals: {formatCurrency(stats?.unusedMealsProfit || 0)}</li>
                </ul>
                <p className="font-medium mt-2 text-green-600">
                  Total: {formatCurrency(stats?.totalRevenue || 0)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="font-medium">Expenses</span>
                </div>
                <ul className="text-muted-foreground space-y-1">
                  <li>• Driver Costs: {formatCurrency(stats?.driverCosts || 0)}</li>
                  <li>• Refunds: {formatCurrency(stats?.refundCosts || 0)}</li>
                  <li>• Affiliate: {formatCurrency(stats?.affiliateCosts || 0)}</li>
                </ul>
                <p className="font-medium mt-2 text-red-600">
                  Total: {formatCurrency(stats?.totalExpenses || 0)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Net Profit</span>
                </div>
                <p className="text-muted-foreground">
                  Revenue - Expenses = Net Profit
                </p>
                <p className="text-2xl font-bold mt-2 text-green-600">
                  {formatCurrency(stats?.netProfit || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats?.profitMargin?.toFixed(1) || 0}% margin
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
