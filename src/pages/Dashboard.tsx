import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Salad, 
  Flame, 
  Beef, 
  Wheat, 
  Droplets,
  Calendar,
  TrendingUp,
  ChevronRight,
  Star,
  Clock,
  Utensils,
  User,
  Bell,
  LogOut,
  Loader2,
  Receipt,
  Plus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogMealDialog } from "@/components/LogMealDialog";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [todayProgress, setTodayProgress] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [progressKey, setProgressKey] = useState(0);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, profileLoading, navigate]);

  // Fetch today's progress
  useEffect(() => {
    const fetchTodayProgress = async () => {
      if (!user) return;
      
      const today = new Date().toISOString().split('T')[0];
      
      try {
        const { data, error } = await supabase
          .from("progress_logs")
          .select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
          .eq("user_id", user.id)
          .eq("log_date", today)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setTodayProgress({
            calories: data.calories_consumed || 0,
            protein: data.protein_consumed_g || 0,
            carbs: data.carbs_consumed_g || 0,
            fat: data.fat_consumed_g || 0,
          });
        }
      } catch (err) {
        console.error("Error fetching today's progress:", err);
      }
    };

    fetchTodayProgress();
  }, [user, progressKey]);

  // Fetch restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select(`
            id,
            name,
            description,
            logo_url,
            rating,
            total_orders,
            meals!inner (id)
          `)
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .limit(5);

        if (error) throw error;

        // Transform data with meal counts
        const transformedRestaurants: Restaurant[] = (data || []).map((restaurant: any) => ({
          id: restaurant.id,
          name: restaurant.name,
          description: restaurant.description,
          logo_url: restaurant.logo_url,
          rating: parseFloat(restaurant.rating) || 0,
          total_orders: restaurant.total_orders || 0,
          meal_count: restaurant.meals?.length || 0,
        }));

        // Sort by rating
        transformedRestaurants.sort((a, b) => b.rating - a.rating);

        setRestaurants(transformedRestaurants);
      } catch (err) {
        console.error("Error fetching restaurants:", err);
      } finally {
        setRestaurantsLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/");
  };

  const userStats = {
    dailyCalories: profile?.daily_calorie_target || 2000,
    consumedCalories: todayProgress.calories,
    protein: { target: profile?.protein_target_g || 150, consumed: todayProgress.protein },
    carbs: { target: profile?.carbs_target_g || 200, consumed: todayProgress.carbs },
    fat: { target: profile?.fat_target_g || 65, consumed: todayProgress.fat },
  };

  const userName = profile?.full_name?.split(" ")[0] || "there";

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
              <Salad className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Good morning,</p>
              <p className="font-semibold">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="icon" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="icon" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Daily Summary Card */}
        <Card variant="stat" className="animate-fade-in">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Today's Progress</p>
                <p className="text-2xl font-bold">
                  {userStats.consumedCalories} 
                  <span className="text-base font-normal text-muted-foreground">
                    /{userStats.dailyCalories} kcal
                  </span>
                </p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(userStats.consumedCalories / userStats.dailyCalories) * 175.9} 175.9`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Beef className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Protein</span>
                </div>
                <Progress 
                  value={(userStats.protein.consumed / userStats.protein.target) * 100} 
                  className="h-1.5"
                />
                <p className="text-xs font-medium">{userStats.protein.consumed}g / {userStats.protein.target}g</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Wheat className="w-4 h-4 text-warning" />
                  <span className="text-xs text-muted-foreground">Carbs</span>
                </div>
                <Progress 
                  value={(userStats.carbs.consumed / userStats.carbs.target) * 100} 
                  variant="warning"
                  className="h-1.5"
                />
                <p className="text-xs font-medium">{userStats.carbs.consumed}g / {userStats.carbs.target}g</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-accent" />
                  <span className="text-xs text-muted-foreground">Fat</span>
                </div>
                <Progress 
                  value={(userStats.fat.consumed / userStats.fat.target) * 100} 
                  variant="accent"
                  className="h-1.5"
                />
                <p className="text-xs font-medium">{userStats.fat.consumed}g / {userStats.fat.target}g</p>
              </div>
            </div>

            {/* Log Meal Button */}
            <Button 
              onClick={() => setLogMealOpen(true)} 
              className="w-full mt-4"
            >
              <Plus className="w-4 h-4 mr-2" />
              Log Meal
            </Button>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3 animate-fade-in stagger-1">
          <Link to="/schedule">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Schedule</p>
                  <p className="text-xs text-muted-foreground">Plan week</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/progress">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Progress</p>
                  <p className="text-xs text-muted-foreground">Analytics</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/orders">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Receipt className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Orders</p>
                  <p className="text-xs text-muted-foreground">History</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Browse Restaurants Section */}
        <section className="space-y-4 animate-fade-in stagger-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Browse Restaurants</h2>
            <Link to="/meals">
              <Button variant="ghost" size="sm" className="text-primary">
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Restaurant Cards */}
          <div className="grid gap-4">
            {restaurantsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : restaurants.length === 0 ? (
              <Card variant="default">
                <CardContent className="p-8 text-center">
                  <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No restaurants available yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Partner restaurants will be added soon. Check back later!
                  </p>
                </CardContent>
              </Card>
            ) : (
              restaurants.map((restaurant) => (
                <Link key={restaurant.id} to={`/restaurants/${restaurant.id}`}>
                  <Card variant="interactive">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-4xl overflow-hidden">
                          {restaurant.logo_url ? (
                            <img 
                              src={restaurant.logo_url} 
                              alt={restaurant.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            "🍽️"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold truncate">{restaurant.name}</h3>
                              {restaurant.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {restaurant.description}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-warning text-warning" />
                              {restaurant.rating.toFixed(1)}
                            </span>
                            <span className="text-muted-foreground">
                              {restaurant.total_orders} orders
                            </span>
                            <span className="text-muted-foreground">
                              {restaurant.meal_count} meals
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            {[
              { icon: Salad, label: "Home", active: true, to: "/dashboard" },
              { icon: Utensils, label: "Restaurants", active: false, to: "/meals" },
              { icon: Calendar, label: "Schedule", active: false, to: "/schedule" },
              { icon: TrendingUp, label: "Progress", active: false, to: "/progress" },
              { icon: User, label: "Profile", active: false, to: "/profile" },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors ${
                  item.active 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${item.active ? "fill-primary/20" : ""}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Log Meal Dialog */}
      {user && (
        <LogMealDialog
          open={logMealOpen}
          onOpenChange={setLogMealOpen}
          userId={user.id}
          onMealLogged={() => setProgressKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default Dashboard;
