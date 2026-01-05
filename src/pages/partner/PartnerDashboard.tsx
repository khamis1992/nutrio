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
  Settings,
  Bell,
  LogOut,
  Star,
  Package,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RoleIndicator } from "@/components/RoleIndicator";
import { PartnerNavigation } from "@/components/PartnerNavigation";

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
}

const PartnerDashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [recentSchedules, setRecentSchedules] = useState<ScheduledMeal[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalMeals: 0,
    activeOrders: 0,
    todayOrders: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPartnerData();
    }
  }, [user]);

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
      const today = new Date().toISOString().split("T")[0];
      const activeOrders = allSchedules?.filter(
        (s) => !s.is_completed && s.scheduled_date >= today
      ).length || 0;
      const todayOrders = allSchedules?.filter(
        (s) => s.scheduled_date === today
      ).length || 0;
      const totalRevenue = allSchedules?.reduce(
        (sum, s) => sum + (mealPrices[s.meal_id] || 0),
        0
      ) || 0;

      setStats({
        totalMeals: mealsCount || 0,
        activeOrders,
        todayOrders,
        totalRevenue,
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
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
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-4">
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

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">No Restaurant Found</h2>
            <p className="text-muted-foreground mb-6">
              You don't have a restaurant registered yet. Contact admin to get your restaurant approved.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Customer Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              {restaurant.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <Store className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <p className="font-semibold">{restaurant.name}</p>
              <div className="flex items-center gap-2">
                <Badge
                  variant={restaurant.is_active ? "default" : "secondary"}
                  className="text-xs"
                >
                  {restaurant.is_active ? "Active" : "Inactive"}
                </Badge>
                {restaurant.rating > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {restaurant.rating.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoleIndicator role="partner" />
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
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

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Link to="/partner/menu">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <UtensilsCrossed className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="font-medium text-sm">Manage Menu</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/partner/orders">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <Package className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                <p className="font-medium text-sm">View Orders</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/partner/settings">
            <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="pt-4 text-center">
                <Settings className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="font-medium text-sm">Settings</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Recent Orders</CardTitle>
              <Link to="/partner/orders">
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSchedules.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No orders yet</p>
              </div>
            ) : (
              recentSchedules.slice(0, 5).map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {schedule.meal?.name || "Unknown Meal"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(schedule.scheduled_date).toLocaleDateString()} •{" "}
                        {schedule.meal_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={getStatusColor(schedule.is_completed, schedule.scheduled_date)}>
                      {getStatusLabel(schedule.is_completed, schedule.scheduled_date)}
                    </Badge>
                    <p className="text-sm font-medium mt-1">
                      ${parseFloat(schedule.meal?.price?.toString() || "0").toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <PartnerNavigation />
    </div>
  );
};

export default PartnerDashboard;
