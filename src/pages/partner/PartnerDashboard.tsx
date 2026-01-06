import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Store,
  UtensilsCrossed,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  Clock,
  ChevronRight,
  Plus,
  Star,
  Package,
  BarChart3,
  MessageSquare,
  Wallet,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";

interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  is_active: boolean;
}

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  created_at: string;
  meal: {
    name: string;
    price: number;
  };
}

interface Stats {
  totalMeals: number;
  activeOrders: number;
  todayOrders: number;
  totalRevenue: number;
  weeklyRevenue: number;
  lastWeekRevenue: number;
  weeklyOrders: number;
}

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [recentSchedules, setRecentSchedules] = useState<ScheduledMeal[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalMeals: 0,
    activeOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
    weeklyRevenue: 0,
    lastWeekRevenue: 0,
    weeklyOrders: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPartnerData();
    }
  }, [user]);

  // Subscribe to real-time updates for meal schedules
  useEffect(() => {
    if (!restaurant) return;

    const channel = supabase
      .channel("partner-dashboard-schedules")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meal_schedules",
        },
        () => {
          // Refetch data when schedules change
          fetchPartnerData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant]);

  const fetchPartnerData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch partner's restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;

      if (!restaurantData) {
        // No restaurant found, partner needs to create one
        setLoading(false);
        return;
      }

      setRestaurant(restaurantData);

      // Fetch meals count
      const { data: mealsData, count: mealsCount } = await supabase
        .from("meals")
        .select("id, price", { count: "exact" })
        .eq("restaurant_id", restaurantData.id);

      const mealIds = mealsData?.map((m) => m.id) || [];
      const mealPrices = mealsData?.reduce((acc, m) => {
        acc[m.id] = m.price;
        return acc;
      }, {} as Record<string, number>) || {};

      if (mealIds.length === 0) {
        setStats({
          totalMeals: 0,
          activeOrders: 0,
          todayOrders: 0,
          totalRevenue: 0,
          weeklyRevenue: 0,
          lastWeekRevenue: 0,
          weeklyOrders: 0,
        });
        setRecentSchedules([]);
        setLoading(false);
        return;
      }

      // Fetch scheduled meals for this restaurant's meals
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          meal_type,
          is_completed,
          created_at,
          meals:meal_id (
            name,
            price
          )
        `)
        .in("meal_id", mealIds)
        .order("created_at", { ascending: false })
        .limit(10);

      if (schedulesError) throw schedulesError;

      const transformedSchedules: ScheduledMeal[] = (schedulesData || []).map((s: any) => ({
        id: s.id,
        scheduled_date: s.scheduled_date,
        meal_type: s.meal_type,
        is_completed: s.is_completed || false,
        created_at: s.created_at,
        meal: s.meals,
      }));

      setRecentSchedules(transformedSchedules);

      // Fetch all schedules for stats (not limited)
      const { data: allSchedules } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, is_completed, meal_id")
        .in("meal_id", mealIds);

      // Calculate stats
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      
      // Calculate week boundaries (Monday to Sunday)
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + mondayOffset);
      const thisMondayStr = thisMonday.toISOString().split("T")[0];
      
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastMondayStr = lastMonday.toISOString().split("T")[0];
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      const lastSundayStr = lastSunday.toISOString().split("T")[0];

      const activeOrders = allSchedules?.filter(
        (s) => !s.is_completed && s.scheduled_date >= todayStr
      ).length || 0;
      const todayOrders = allSchedules?.filter(
        (s) => s.scheduled_date === todayStr
      ).length || 0;
      const totalRevenue = allSchedules?.reduce(
        (sum, s) => sum + (mealPrices[s.meal_id] || 0),
        0
      ) || 0;

      // This week's revenue and orders
      const thisWeekSchedules = allSchedules?.filter(
        (s) => s.scheduled_date >= thisMondayStr && s.scheduled_date <= todayStr
      ) || [];
      const weeklyRevenue = thisWeekSchedules.reduce(
        (sum, s) => sum + (mealPrices[s.meal_id] || 0),
        0
      );
      const weeklyOrders = thisWeekSchedules.length;

      // Last week's revenue
      const lastWeekSchedules = allSchedules?.filter(
        (s) => s.scheduled_date >= lastMondayStr && s.scheduled_date <= lastSundayStr
      ) || [];
      const lastWeekRevenue = lastWeekSchedules.reduce(
        (sum, s) => sum + (mealPrices[s.meal_id] || 0),
        0
      );

      setStats({
        totalMeals: mealsCount || 0,
        activeOrders,
        todayOrders,
        totalRevenue,
        weeklyRevenue,
        lastWeekRevenue,
        weeklyOrders,
      });
    } catch (error) {
      console.error("Error fetching partner data:", error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (isCompleted: boolean, scheduledDate: string) => {
    const today = new Date().toISOString().split("T")[0];
    if (isCompleted) {
      return "bg-green-500/10 text-green-600 border-green-500/20";
    } else if (scheduledDate < today) {
      return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    }
    return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  };

  const getStatusLabel = (isCompleted: boolean, scheduledDate: string) => {
    const today = new Date().toISOString().split("T")[0];
    if (isCompleted) return "Completed";
    if (scheduledDate < today) return "Overdue";
    return "Pending";
  };

  if (loading) {
    return (
      <PartnerLayout title="Dashboard">
        <div className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </PartnerLayout>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <Store className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Welcome, Partner!</h2>
            <p className="text-muted-foreground mb-6">
              You don't have a restaurant registered yet. Let's get you set up!
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate("/partner/onboarding")} className="w-full">
                Register Your Restaurant
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
                Go to Customer Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PartnerLayout title="Dashboard">
      <div className="space-y-6">
        {/* Restaurant Info Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="w-full h-full object-cover rounded-xl"
              />
            ) : (
              <Store className="w-6 h-6 text-primary" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-lg">{restaurant.name}</h2>
            <div className="flex items-center gap-2">
              <Badge
                variant={restaurant.is_active ? "default" : "secondary"}
                className="text-xs"
              >
                {restaurant.is_active ? "Active" : "Inactive"}
              </Badge>
              {restaurant.rating > 0 && (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {restaurant.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Platform Announcements */}
        <AnnouncementsBanner audience="partners" />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalMeals}</p>
                  <p className="text-xs text-muted-foreground">Menu Items</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeOrders}</p>
                  <p className="text-xs text-muted-foreground">Active Orders</p>
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
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Revenue Summary */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Week's Revenue</p>
                  <p className="text-3xl font-bold">${stats.weeklyRevenue.toFixed(2)}</p>
                </div>
              </div>
              {stats.lastWeekRevenue > 0 && (
                <div className="text-right">
                  {(() => {
                    const change = stats.lastWeekRevenue > 0 
                      ? ((stats.weeklyRevenue - stats.lastWeekRevenue) / stats.lastWeekRevenue) * 100
                      : 0;
                    const isPositive = change >= 0;
                    return (
                      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        <TrendingUp className={`h-4 w-4 ${!isPositive && 'rotate-180'}`} />
                        <span className="text-sm font-medium">
                          {isPositive ? '+' : ''}{change.toFixed(1)}%
                        </span>
                      </div>
                    );
                  })()}
                  <p className="text-xs text-muted-foreground">vs last week</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary/10">
              <div>
                <p className="text-2xl font-semibold">{stats.weeklyOrders}</p>
                <p className="text-xs text-muted-foreground">Orders this week</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  ${stats.weeklyOrders > 0 ? (stats.weeklyRevenue / stats.weeklyOrders).toFixed(2) : '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">Avg. order value</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <Link to="/partner/menu">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <UtensilsCrossed className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="font-medium text-sm">Menu</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/partner/orders">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <Package className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                <p className="font-medium text-sm">Orders</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/partner/analytics">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <BarChart3 className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <p className="font-medium text-sm">Analytics</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/partner/reviews">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                <p className="font-medium text-sm">Reviews</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/partner/payouts">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <Wallet className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <p className="font-medium text-sm">Payouts</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/partner/profile">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <User className="h-6 w-6 mx-auto mb-2 text-gray-500" />
                <p className="font-medium text-sm">Profile</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/partner/orders" className="flex items-center gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentSchedules.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No orders yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Orders will appear here when customers schedule your meals
                </p>
              </div>
            ) : (
              recentSchedules.slice(0, 5).map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-xl">
                      🍽️
                    </div>
                    <div>
                      <p className="font-medium">{schedule.meal?.name || "Unknown Meal"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(schedule.scheduled_date).toLocaleDateString()} • {schedule.meal_type}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(schedule.is_completed, schedule.scheduled_date)}>
                    {getStatusLabel(schedule.is_completed, schedule.scheduled_date)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </PartnerLayout>
  );
};

export default PartnerDashboard;
