import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  Store,
  Users,
  ShoppingBag,
  TrendingUp,
  Clock,
  LogOut,
  ChevronRight,
  DollarSign,
  BarChart3,
  Settings,
  Utensils,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalRestaurants: 0,
    approvedRestaurants: 0,
    pendingApprovals: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalMeals: 0,
    todayOrders: 0,
    weeklyRevenue: 0,
  });
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    if (user) {
      checkAdminAndFetchData();
    }
  }, [user]);

  const checkAdminAndFetchData = async () => {
    if (!user) return;

    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);

      // Fetch all stats in parallel
      const today = new Date().toISOString().split("T")[0];
      
      const [
        restaurantsRes,
        approvedRes,
        pendingRes,
        profilesRes,
        schedulesRes,
        mealsRes,
        todaySchedulesRes,
      ] = await Promise.all([
        supabase.from("restaurants").select("*", { count: "exact", head: true }),
        supabase.from("restaurants").select("*", { count: "exact", head: true }).eq("approval_status", "approved"),
        supabase.from("restaurants").select("*", { count: "exact", head: true }).eq("approval_status", "pending"),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("meal_schedules").select("*", { count: "exact", head: true }),
        supabase.from("meals").select("*", { count: "exact", head: true }),
        supabase.from("meal_schedules").select("*", { count: "exact", head: true }).eq("scheduled_date", today),
      ]);

      // Fetch weekly data for chart
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

      // Calculate daily data
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

      // Fetch recent activity
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
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const navItems = [
    { icon: Store, label: "Restaurants", to: "/admin/restaurants", count: stats.pendingApprovals, color: "text-primary" },
    { icon: Users, label: "Users", to: "/admin/users", color: "text-blue-500" },
    { icon: ShoppingBag, label: "Orders", to: "/admin/orders", color: "text-green-500" },
    { icon: BarChart3, label: "Analytics", to: "/admin/analytics", color: "text-purple-500" },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="font-semibold">Admin Dashboard</p>
              <p className="text-xs text-muted-foreground">Platform Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
              View as Customer
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto px-4 py-6 space-y-6">
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
                <p className="text-sm text-muted-foreground">All-time Orders</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Registered Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <Link to="/admin" className="flex flex-col items-center py-2 text-primary">
              <Shield className="h-5 w-5" />
              <span className="text-xs mt-1">Dashboard</span>
            </Link>
            <Link to="/admin/restaurants" className="flex flex-col items-center py-2 text-muted-foreground hover:text-foreground relative">
              <Store className="h-5 w-5" />
              <span className="text-xs mt-1">Restaurants</span>
              {stats.pendingApprovals > 0 && (
                <Badge className="absolute -top-1 right-0 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {stats.pendingApprovals}
                </Badge>
              )}
            </Link>
            <Link to="/admin/users" className="flex flex-col items-center py-2 text-muted-foreground hover:text-foreground">
              <Users className="h-5 w-5" />
              <span className="text-xs mt-1">Users</span>
            </Link>
            <Link to="/admin/orders" className="flex flex-col items-center py-2 text-muted-foreground hover:text-foreground">
              <ShoppingBag className="h-5 w-5" />
              <span className="text-xs mt-1">Orders</span>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default AdminDashboard;