import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Store,
  Users,
  ShoppingBag,
  TrendingUp,
  Clock,
  DollarSign,
  BarChart3,
  Wallet,
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
} from "recharts";

interface Stats {
  totalRestaurants: number;
  approvedRestaurants: number;
  pendingApprovals: number;
  totalUsers: number;
  totalOrders: number;
  totalMeals: number;
  todayOrders: number;
  weeklyRevenue: number;
  pendingPayouts: number;
  pendingPayoutsAmount: number;
}

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface RecentActivity {
  id: string;
  type: "restaurant" | "order" | "user";
  title: string;
  description: string;
  time: string;
}

const AdminDashboard = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<Stats>({
    totalRestaurants: 0,
    approvedRestaurants: 0,
    pendingApprovals: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalMeals: 0,
    todayOrders: 0,
    weeklyRevenue: 0,
    pendingPayouts: 0,
    pendingPayoutsAmount: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    const today = new Date().toISOString().split("T")[0];
    
    const [
      restaurantsRes,
      approvedRes,
      pendingRes,
      profilesRes,
      schedulesRes,
      mealsRes,
      todaySchedulesRes,
      pendingPayoutsRes,
    ] = await Promise.all([
      supabase.from("restaurants").select("*", { count: "exact", head: true }),
      supabase.from("restaurants").select("*", { count: "exact", head: true }).eq("approval_status", "approved"),
      supabase.from("restaurants").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("meal_schedules").select("*", { count: "exact", head: true }),
      supabase.from("meals").select("*", { count: "exact", head: true }),
      supabase.from("meal_schedules").select("*", { count: "exact", head: true }).eq("scheduled_date", today),
      supabase.from("payouts").select("amount").eq("status", "pending"),
    ]);

    // Calculate pending payouts amount
    const pendingPayoutsAmount = (pendingPayoutsRes.data || []).reduce(
      (sum, p) => sum + Number(p.amount), 0
    );

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { data: weeklySchedules } = await supabase
      .from("meal_schedules")
      .select("scheduled_date, meal_id")
      .gte("scheduled_date", weekAgo.toISOString().split("T")[0]);

    const { data: allMeals } = await supabase
      .from("meals")
      .select("id, price");

    const mealPrices = (allMeals || []).reduce((acc, m) => {
      acc[m.id] = m.price;
      return acc;
    }, {} as Record<string, number>);

    const dailyMap: Record<string, { orders: number; revenue: number }> = {};
    let weeklyRevenue = 0;

    (weeklySchedules || []).forEach((s) => {
      if (!dailyMap[s.scheduled_date]) {
        dailyMap[s.scheduled_date] = { orders: 0, revenue: 0 };
      }
      dailyMap[s.scheduled_date].orders++;
      const price = mealPrices[s.meal_id] || 0;
      dailyMap[s.scheduled_date].revenue += price;
      weeklyRevenue += price;
    });

    const last7Days: DailyData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      last7Days.push({
        date: date.toLocaleDateString("en-US", { weekday: "short" }),
        orders: dailyMap[dateStr]?.orders || 0,
        revenue: dailyMap[dateStr]?.revenue || 0,
      });
    }
    setDailyData(last7Days);

    const { data: recentRestaurants } = await supabase
      .from("restaurants")
      .select("id, name, created_at, approval_status")
      .order("created_at", { ascending: false })
      .limit(3);

    const { data: recentSchedules } = await supabase
      .from("meal_schedules")
      .select("id, created_at, meals:meal_id(name)")
      .order("created_at", { ascending: false })
      .limit(3);

    const activities: RecentActivity[] = [];

    (recentRestaurants || []).forEach((r) => {
      activities.push({
        id: r.id,
        type: "restaurant",
        title: r.name,
        description: r.approval_status === "pending" ? "New registration" : `Status: ${r.approval_status}`,
        time: new Date(r.created_at).toLocaleString(),
      });
    });

    (recentSchedules || []).forEach((s: any) => {
      activities.push({
        id: s.id,
        type: "order",
        title: s.meals?.name || "Meal Order",
        description: "New meal scheduled",
        time: new Date(s.created_at).toLocaleString(),
      });
    });

    setRecentActivity(activities.sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    ).slice(0, 5));

    setStats({
      totalRestaurants: restaurantsRes.count || 0,
      approvedRestaurants: approvedRes.count || 0,
      pendingApprovals: pendingRes.count || 0,
      totalUsers: profilesRes.count || 0,
      totalOrders: schedulesRes.count || 0,
      totalMeals: mealsRes.count || 0,
      todayOrders: todaySchedulesRes.count || 0,
      weeklyRevenue,
      pendingPayouts: pendingPayoutsRes.data?.length || 0,
      pendingPayoutsAmount,
    });
  };

  const navItems = [
    { icon: Store, label: "Restaurants", to: "/admin/restaurants", count: stats.pendingApprovals, color: "text-primary" },
    { icon: Users, label: "Users", to: "/admin/users", color: "text-blue-500" },
    { icon: ShoppingBag, label: "Orders", to: "/admin/orders", color: "text-green-500" },
    { icon: Wallet, label: "Payouts", to: "/admin/payouts", count: stats.pendingPayouts, color: "text-amber-500" },
    { icon: BarChart3, label: "Analytics", to: "/admin/analytics", color: "text-purple-500" },
  ];

  return (
    <AdminLayout title="Admin Dashboard" subtitle="Platform Management">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approvedRestaurants}</p>
                  <p className="text-xs text-muted-foreground">Active Restaurants</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.todayOrders}</p>
                  <p className="text-xs text-muted-foreground">Today's Orders</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${stats.weeklyRevenue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Weekly Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Approvals Alert */}
        {stats.pendingApprovals > 0 && (
          <Link to="/admin/restaurants">
            <Card className="border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition-colors cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">Pending Restaurant Approvals</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.pendingApprovals} restaurant{stats.pendingApprovals > 1 ? "s" : ""} waiting for review
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    Review Now
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Pending Payouts Alert */}
        {stats.pendingPayouts > 0 && (
          <Link to="/admin/payouts">
            <Card className="border-green-500/30 bg-green-500/5 hover:border-green-500/50 transition-colors cursor-pointer">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Pending Partner Payouts</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.pendingPayouts} payout{stats.pendingPayouts > 1 ? "s" : ""} worth ${stats.pendingPayoutsAmount.toFixed(2)} awaiting processing
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    Process Now
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Charts and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Orders Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Orders This Week
              </CardTitle>
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
                      dataKey="orders"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      activity.type === "restaurant" 
                        ? "bg-primary/10" 
                        : activity.type === "order" 
                        ? "bg-green-500/10" 
                        : "bg-blue-500/10"
                    }`}>
                      {activity.type === "restaurant" && <Store className="h-4 w-4 text-primary" />}
                      {activity.type === "order" && <ShoppingBag className="h-4 w-4 text-green-500" />}
                      {activity.type === "user" && <Users className="h-4 w-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-6 text-center">
                  <div className="relative inline-block">
                    <item.icon className={`h-8 w-8 mx-auto mb-2 ${item.color}`} />
                    {item.count && item.count > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {item.count}
                      </Badge>
                    )}
                  </div>
                  <p className="font-medium">{item.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Platform Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Platform Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{stats.totalRestaurants}</p>
                <p className="text-sm text-muted-foreground">Total Restaurants</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{stats.totalMeals}</p>
                <p className="text-sm text-muted-foreground">Total Meals</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{stats.totalOrders}</p>
                <p className="text-sm text-muted-foreground">All-Time Orders</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{stats.pendingApprovals}</p>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
