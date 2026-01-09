import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Salad,
  Beef,
  Wheat,
  Droplets,
  ChevronRight,
  Utensils,
  Bell,
  LogOut,
  Loader2,
  Plus,
  Sparkles,
  Crown,
  Menu as MenuIcon,
  Flame,
  Target,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogMealDialog } from "@/components/LogMealDialog";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useFeaturedRestaurants } from "@/hooks/useFeaturedRestaurants";
import { RoleIndicator } from "@/components/RoleIndicator";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { AffiliateEarningsWidget } from "@/components/AffiliateEarningsWidget";
import { SideDrawer } from "@/components/SideDrawer";
import CalorieProgressRing from "@/components/CalorieProgressRing";

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
  const { subscription, hasActiveSubscription, isPaused, remainingMeals, isUnlimited, isVip, loading: subscriptionLoading } = useSubscription();
  const { settings: platformSettings, loading: settingsLoading } = usePlatformSettings();
  const { toast } = useToast();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();
  const { featuredRestaurants, isFeatured } = useFeaturedRestaurants();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [todayProgress, setTodayProgress] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [progressKey, setProgressKey] = useState(0);
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Check if user has a restaurant (for role switcher)
  useEffect(() => {
    const checkRestaurant = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      setHasRestaurant(!!data);
    };
    checkRestaurant();
  }, [user]);

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
  const caloriePercent = Math.min((userStats.consumedCalories / userStats.dailyCalories) * 100, 100);
  const proteinPercent = Math.min((userStats.protein.consumed / userStats.protein.target) * 100, 100);
  const carbsPercent = Math.min((userStats.carbs.consumed / userStats.carbs.target) * 100, 100);
  const fatPercent = Math.min((userStats.fat.consumed / userStats.fat.target) * 100, 100);

  if (profileLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SideDrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <MenuIcon className="w-6 h-6" />
                </Button>
              }
            />
            <div>
              <p className="text-sm text-muted-foreground">Good morning,</p>
              <p className="font-semibold">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasRestaurant && <RoleIndicator role="customer" />}
            <Link to="/notifications">
              <Button variant="icon" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
            </Link>
            <Button variant="icon" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Platform Announcements */}
        <AnnouncementsBanner />

        {/* PRIMARY METRICS CARD - The hero of the dashboard */}
        <Card className={`overflow-hidden ${
          isVip
            ? "border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5"
            : "border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5"
        }`}>
          <CardContent className="p-6">
            {/* Header row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  isVip
                    ? "bg-gradient-to-br from-violet-500 to-purple-600"
                    : "bg-gradient-to-br from-primary to-accent"
                }`}>
                  {isVip ? (
                    <Sparkles className="w-6 h-6 text-white" />
                  ) : (
                    <Flame className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-bold">Today's Progress</h2>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveSubscription
                      ? isUnlimited
                        ? "Unlimited meals this week"
                        : `${remainingMeals} meals remaining`
                      : "No active subscription"
                  }
                  </p>
                </div>
              </div>

              {/* Calorie large display */}
              <div className="text-right">
                <div className="text-4xl font-bold tabular-nums">
                  {Math.round(userStats.consumedCalories)}
                </div>
                <div className="text-sm text-muted-foreground">
                  of {userStats.dailyCalories} kcal
                </div>
              </div>
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-4 gap-3">
              {/* Calories */}
              <div className="text-center p-3 rounded-xl bg-background/50">
                <div className="relative w-16 h-16 mx-auto mb-2">
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
                      stroke={isVip ? "hsl(262, 83%, 58%)" : "hsl(var(--primary))"}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(caloriePercent / 100) * 175.9} 175.9`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Flame className={`w-5 h-5 ${
                      caloriePercent >= 100 ? "text-success" :
                      caloriePercent >= 75 ? "text-warning" :
                      "text-muted-foreground"
                    }`} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Calories</p>
                <p className="text-sm font-semibold tabular-nums">{Math.round(caloriePercent)}%</p>
              </div>

              {/* Protein */}
              <div className="text-center p-3 rounded-xl bg-background/50">
                <div className="w-12 h-12 mx-auto mb-2 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="5"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="hsl(var(--destructive))"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${(proteinPercent / 100) * 125.6} 125.6`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Beef className="w-4 h-4 text-destructive" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Protein</p>
                <p className="text-sm font-semibold tabular-nums">{userStats.protein.consumed}g</p>
              </div>

              {/* Carbs */}
              <div className="text-center p-3 rounded-xl bg-background/50">
                <div className="w-12 h-12 mx-auto mb-2 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="5"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="hsl(var(--warning))"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${(carbsPercent / 100) * 125.6} 125.6`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Wheat className="w-4 h-4 text-warning" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Carbs</p>
                <p className="text-sm font-semibold tabular-nums">{userStats.carbs.consumed}g</p>
              </div>

              {/* Fat */}
              <div className="text-center p-3 rounded-xl bg-background/50">
                <div className="w-12 h-12 mx-auto mb-2 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="hsl(var(--muted))"
                      strokeWidth="5"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      fill="none"
                      stroke="hsl(var(--accent))"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${(fatPercent / 100) * 125.6} 125.6`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Droplets className="w-4 h-4 text-accent" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Fat</p>
                <p className="text-sm font-semibold tabular-nums">{userStats.fat.consumed}g</p>
              </div>
            </div>

            {/* Quick action button */}
            <Button
              onClick={() => setLogMealOpen(true)}
              className="w-full mt-4"
              size="lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Log Meal
            </Button>
          </CardContent>
        </Card>

        {/* QUICK ACTIONS ROW */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/schedule" className="group">
            <Card className="hover:shadow-md transition-all cursor-pointer border-primary/20 hover:border-primary/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Schedule</p>
                    <p className="text-xs text-muted-foreground">Plan your meals</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/meals" className="group">
            <Card className="hover:shadow-md transition-all cursor-pointer border-primary/20 hover:border-primary/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Utensils className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Order Food</p>
                    <p className="text-xs text-muted-foreground">Browse restaurants</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Affiliate Earnings Widget */}
        {platformSettings.features.referral_program && <AffiliateEarningsWidget />}

        {/* RESTAURANTS SECTION */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Featured Restaurants</h2>
              <p className="text-sm text-muted-foreground">Top-rated places near you</p>
            </div>
            <Link to="/meals">
              <Button variant="ghost" size="sm" className="text-primary">
                View All <ChevronRight className="w-4 h-4 ml-1" />
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
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  isFavorite={isFavorite(restaurant.id)}
                  onToggleFavorite={toggleFavorite}
                  isFeatured={isFeatured(restaurant.id)}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <CustomerNavigation />

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
