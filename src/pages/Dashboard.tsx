import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
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
import { useAdaptiveGoals } from "@/hooks/useAdaptiveGoals";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogMealDialog } from "@/components/LogMealDialog";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useFeaturedRestaurants } from "@/hooks/useFeaturedRestaurants";
import { RoleIndicator } from "@/components/RoleIndicator";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { AnnouncementsBanner } from "@/components/AnnouncementsBanner";
import { AffiliateEarningsWidget } from "@/components/AffiliateEarningsWidget";
import { AdaptiveGoalCard } from "@/components/AdaptiveGoalCard";
import { WeightPredictionChart } from "@/components/WeightPredictionChart";
import { SideDrawer } from "@/components/SideDrawer";

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
  const { hasActiveSubscription, remainingMeals, isUnlimited, isVip } = useSubscription();
  const { settings: platformSettings } = usePlatformSettings();
  const { 
    recommendation, 
    predictions, 
    hasUnviewedAdjustment, 
    loading: adaptiveLoading, 
    applyAdjustment, 
    dismissAdjustment
  } = useAdaptiveGoals();
  const { toast } = useToast();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { isFeatured } = useFeaturedRestaurants();
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = format(today, "yyyy-MM-dd");

      try {
        const { data, error } = await supabase
          .from("progress_logs")
          .select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
          .eq("user_id", user.id)
          .eq("log_date", todayStr)
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
        // Fetch restaurants
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("restaurants")
          .select(`
            id,
            name,
            description,
            logo_url,
            rating,
            total_orders
          `)
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .limit(5);

        if (restaurantsError) throw restaurantsError;

        // Get meal counts separately
        const restaurantIds = (restaurantsData || []).map((r: any) => r.id);
        let mealCounts: Record<string, number> = {};
        
        if (restaurantIds.length > 0) {
          const { data: mealsData } = await supabase
            .from("meals")
            .select("restaurant_id")
            .in("restaurant_id", restaurantIds);
          
          mealCounts = (mealsData || []).reduce((acc: Record<string, number>, meal: any) => {
            acc[meal.restaurant_id] = (acc[meal.restaurant_id] || 0) + 1;
            return acc;
          }, {});
        }

        // Transform data with meal counts
        const transformedRestaurants: Restaurant[] = (restaurantsData || []).map((restaurant: any) => ({
          id: restaurant.id,
          name: restaurant.name,
          description: restaurant.description,
          logo_url: restaurant.logo_url,
          rating: parseFloat(restaurant.rating) || 0,
          total_orders: restaurant.total_orders || 0,
          meal_count: mealCounts[restaurant.id] || 0,
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

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Enhanced Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SideDrawer
              open={drawerOpen}
              onOpenChange={setDrawerOpen}
              trigger={
                <Button variant="ghost" size="icon" aria-label="Open menu" className="hover:bg-primary/10">
                  <MenuIcon className="w-6 h-6" />
                </Button>
              }
            />
            {/* User Avatar with Greeting */}
            <div className="flex items-center gap-3">
              <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 ${
                isVip ? "border-violet-500" : "border-primary/30"
              }`}>
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-sm font-bold ${
                    isVip ? "bg-violet-100 text-violet-600" : "bg-primary/10 text-primary"
                  }`}>
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                {isVip && (
                  <div className="absolute -bottom-1 -right-1 bg-violet-500 rounded-full p-0.5">
                    <Crown className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {new Date().getHours() < 12 ? "Good morning ☀️" : 
                   new Date().getHours() < 18 ? "Good afternoon 🌤️" : "Good evening 🌙"}
                </p>
                <p className="font-semibold text-sm">{userName}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasRestaurant && <RoleIndicator role="customer" />}
            <Link to="/notifications">
              <Button variant="ghost" size="icon" className="relative hover:bg-primary/10">
                <Bell className="w-5 h-5" />
                {/* Notification Badge */}
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Platform Announcements */}
        <AnnouncementsBanner />

        {/* AI Adaptive Goal Suggestion */}
        {hasUnviewedAdjustment && recommendation && (
          <AdaptiveGoalCard
            recommendation={recommendation}
            currentCalories={profile?.daily_calorie_target || 2000}
            currentProtein={profile?.protein_target_g || 150}
            currentCarbs={profile?.carbs_target_g || 200}
            currentFat={profile?.fat_target_g || 65}
            onApply={applyAdjustment}
            onDismiss={dismissAdjustment}
            loading={adaptiveLoading}
          />
        )}

        {/* Weight Predictions */}
        {predictions.length > 0 && (
          <WeightPredictionChart
            predictions={predictions}
            currentWeight={profile?.current_weight_kg || 0}
            targetWeight={profile?.target_weight_kg || 0}
          />
        )}

        {/* PREMIUM GLASSMORPHIC PROGRESS CARD */}
        <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-2xl">
          <CardContent className="p-0">
            {/* Frosted Glass Header */}
            <div className="px-5 py-4 bg-white/10 backdrop-blur-xl border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isVip ? "bg-violet-500/20" : "bg-primary/20"
                  }`}>
                    <Flame className={`w-5 h-5 ${
                      isVip ? "text-violet-300" : "text-primary"
                    }`} />
                  </div>
                  <div>
                    <h2 className="font-bold text-lg text-foreground">Today's Progress</h2>
                    <p className="text-xs text-foreground/70">
                      {userStats.dailyCalories - userStats.consumedCalories > 0 
                        ? `${Math.round(userStats.dailyCalories - userStats.consumedCalories)} cal remaining` 
                        : "Daily goal reached! 🎉"}
                    </p>
                  </div>
                </div>
                
                {hasActiveSubscription && (
                  <Badge className={`${
                    isVip 
                      ? "bg-violet-500/20 text-violet-100 border-violet-400/30" 
                      : "bg-primary/20 text-primary-foreground border-primary/30"
                  } backdrop-blur-sm`}>
                    {isUnlimited ? "∞ Unlimited" : `${remainingMeals} meals left`}
                  </Badge>
                )}
              </div>
            </div>

            {/* Interactive Progress Visualization */}
            <div className="p-5">
              {/* Premium Circular Progress Dashboard */}
              <div className="flex justify-center mb-6 group">
                <div className="relative">
                  {/* Outer Glow Ring */}
                  <div className={`absolute inset-0 rounded-full ${
                    isVip ? "bg-violet-500/10" : "bg-primary/10"
                  } blur-xl scale-110 transition-all duration-500 group-hover:scale-125`}></div>
                  
                  {/* Main Progress Ring */}
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                      {/* Background Ring */}
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="8"
                        className="transition-all duration-1000"
                      />
                      {/* Progress Ring with Gradient */}
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke={isVip ? "url(#vipProgress)" : "url(#primaryProgress)"}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray="314.16"
                        strokeDashoffset={314.16 - (314.16 * Math.min(caloriePercent, 100)) / 100}
                        className="transition-all duration-1000 ease-out"
                      />
                      {/* Gradient Definitions */}
                      <defs>
                        <linearGradient id="primaryProgress" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" />
                          <stop offset="100%" stopColor="hsl(var(--accent))" />
                        </linearGradient>
                        <linearGradient id="vipProgress" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    
                    {/* Center Content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-3xl font-bold tabular-nums text-foreground">
                          {Math.round(userStats.consumedCalories)}
                        </span>
                        <span className="text-sm text-foreground/60">cal</span>
                      </div>
                      <span className="text-xs font-medium text-foreground/80">
                        {Math.round(caloriePercent)}% of {userStats.dailyCalories}
                      </span>
                      <div className={`mt-2 px-2 py-1 rounded-full text-xs font-medium ${
                        caloriePercent >= 100 
                          ? "bg-success/20 text-success" 
                          : caloriePercent >= 75 
                            ? "bg-warning/20 text-warning" 
                            : isVip 
                              ? "bg-violet-500/20 text-violet-200" 
                              : "bg-primary/20 text-primary"
                      }`}>
                        {caloriePercent >= 100 ? "Goal Reached!" : 
                         caloriePercent >= 75 ? "Almost There!" : 
                         caloriePercent >= 50 ? "Halfway!" : "Keep Going!"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Macro Visualization */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {/* Protein - Click to expand */}
                <div 
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 flex flex-col items-center cursor-pointer hover:bg-white/20 transition-all duration-300 group"
                  onClick={() => toast({ title: "Protein Details", description: `Target: ${userStats.protein.target}g • Consumed: ${userStats.protein.consumed}g • ${Math.round(proteinPercent)}%` })}
                >
                  <div className="relative w-14 h-14 mb-2">
                    <div className="absolute inset-0 rounded-full bg-red-500/10"></div>
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle 
                        cx="28" 
                        cy="28" 
                        r="24" 
                        fill="none" 
                        stroke="#fca5a5" 
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(Math.min(proteinPercent, 100) / 100) * 150.8} 150.8`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Beef className="w-5 h-5 text-red-300" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground">{userStats.protein.consumed}g</p>
                  <p className="text-xs text-foreground/60">Protein</p>
                </div>

                {/* Carbs - Click to expand */}
                <div 
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 flex flex-col items-center cursor-pointer hover:bg-white/20 transition-all duration-300 group"
                  onClick={() => toast({ title: "Carbohydrates Details", description: `Target: ${userStats.carbs.target}g • Consumed: ${userStats.carbs.consumed}g • ${Math.round(carbsPercent)}%` })}
                >
                  <div className="relative w-14 h-14 mb-2">
                    <div className="absolute inset-0 rounded-full bg-amber-500/10"></div>
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle 
                        cx="28" 
                        cy="28" 
                        r="24" 
                        fill="none" 
                        stroke="#fcd34d" 
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(Math.min(carbsPercent, 100) / 100) * 150.8} 150.8`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Wheat className="w-5 h-5 text-amber-300" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground">{userStats.carbs.consumed}g</p>
                  <p className="text-xs text-foreground/60">Carbs</p>
                </div>

                {/* Fat - Click to expand */}
                <div 
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-3 flex flex-col items-center cursor-pointer hover:bg-white/20 transition-all duration-300 group"
                  onClick={() => toast({ title: "Fats Details", description: `Target: ${userStats.fat.target}g • Consumed: ${userStats.fat.consumed}g • ${Math.round(fatPercent)}%` })}
                >
                  <div className="relative w-14 h-14 mb-2">
                    <div className="absolute inset-0 rounded-full bg-blue-500/10"></div>
                    <svg className="w-full h-full -rotate-90">
                      <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                      <circle 
                        cx="28" 
                        cy="28" 
                        r="24" 
                        fill="none" 
                        stroke="#93c5fd" 
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(Math.min(fatPercent, 100) / 100) * 150.8} 150.8`}
                        className="transition-all duration-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Droplets className="w-5 h-5 text-blue-300" />
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground">{userStats.fat.consumed}g</p>
                  <p className="text-xs text-foreground/60">Fat</p>
                </div>
              </div>

              {/* Premium Action Button */}
              <Button
                onClick={() => setLogMealOpen(true)}
                className={`w-full ${
                  isVip 
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white" 
                    : "bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground"
                } shadow-lg font-semibold h-12 text-base backdrop-blur-sm border-0`}
              >
                <Plus className="w-5 h-5 mr-2" />
                Log a Meal
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ENHANCED QUICK ACTIONS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/schedule" className="group">
            <Card className="h-full hover:shadow-lg transition-all cursor-pointer border-primary/10 hover:border-primary/30 hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <p className="font-semibold text-sm">Schedule</p>
                <p className="text-xs text-muted-foreground mt-1">Plan meals</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/meals" className="group">
            <Card className="h-full hover:shadow-lg transition-all cursor-pointer border-primary/10 hover:border-primary/30 hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 group-hover:scale-110 transition-all">
                  <Utensils className="w-6 h-6 text-amber-600" />
                </div>
                <p className="font-semibold text-sm">Order</p>
                <p className="text-xs text-muted-foreground mt-1">Browse food</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/favorites" className="group">
            <Card className="h-full hover:shadow-lg transition-all cursor-pointer border-primary/10 hover:border-primary/30 hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center mb-3 group-hover:bg-rose-200 group-hover:scale-110 transition-all">
                  <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-sm">Favorites</p>
                <p className="text-xs text-muted-foreground mt-1">Saved items</p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/progress" className="group">
            <Card className="h-full hover:shadow-lg transition-all cursor-pointer border-primary/10 hover:border-primary/30 hover:-translate-y-0.5">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mb-3 group-hover:bg-emerald-200 group-hover:scale-110 transition-all">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="font-semibold text-sm">Progress</p>
                <p className="text-xs text-muted-foreground mt-1">Track stats</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Affiliate Earnings Widget */}
        {platformSettings.features.referral_program && <AffiliateEarningsWidget />}

        {/* STREAK & MOTIVATION SECTION */}
        <Card className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                    <Flame className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {profile?.streak_days || 0}
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg">{profile?.streak_days || 0} Day Streak!</h3>
                  <p className="text-sm text-muted-foreground">You're on fire! Keep logging your meals.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="bg-white/50 text-amber-700 border-amber-300">
                      🔥 {7 - (profile?.streak_days || 0) % 7} days to next milestone
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm text-muted-foreground">Weekly Goal</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-24 bg-muted rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-amber-400 to-orange-500 h-full rounded-full" 
                      style={{ 
                        width: `${hasActiveSubscription 
                          ? Math.min(((profile?.streak_days || 0) % 7) * (100 / 7), 100) 
                          : Math.min(((profile?.streak_days || 0) % 5) * (100 / 5), 100)
                        }%` 
                      }} 
                    />
                  </div>
                  <span className="text-sm font-semibold">
                    {hasActiveSubscription 
                      ? Math.min(Math.round(((profile?.streak_days || 0) % 7) * (100 / 7)), 100)
                      : Math.min(Math.round(((profile?.streak_days || 0) % 5) * (100 / 5)), 100)
                    }%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(profile?.streak_days || 0) % (hasActiveSubscription ? 7 : 5)} of {hasActiveSubscription ? 7 : 5} days this week
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ENHANCED RESTAURANTS SECTION */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Featured Restaurants</h2>
              <p className="text-sm text-muted-foreground">Top-rated places near you</p>
            </div>
            <Link to="/meals">
              <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          {/* Horizontal Scrolling Restaurant Cards */}
          <div className="relative -mx-4 px-4">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
              {restaurantsLoading ? (
                <div className="flex items-center justify-center py-12 w-full">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : restaurants.length === 0 ? (
                <Card className="w-full min-w-[300px]">
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
                  <div 
                    key={restaurant.id} 
                    className="flex-shrink-0 w-[280px] snap-start"
                  >
                    <Link to={`/restaurant/${restaurant.id}`} className="block group">
                      <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md">
                        {/* Restaurant Image */}
                        <div className="relative h-32 bg-muted">
                          {restaurant.logo_url ? (
                            <img 
                              src={restaurant.logo_url} 
                              alt={restaurant.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                              <Utensils className="w-12 h-12 text-primary/40" />
                            </div>
                          )}
                          {/* Favorite Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 bg-white/90 hover:bg-white shadow-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleFavorite(restaurant.id, restaurant.name);
                            }}
                          >
                            <svg 
                              className={`w-5 h-5 ${isFavorite(restaurant.id) ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground'}`}
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                            </svg>
                          </Button>
                          {/* Featured Badge */}
                          {isFeatured(restaurant.id) && (
                            <Badge className="absolute top-2 left-2 bg-amber-500 text-white border-0">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Featured
                            </Badge>
                          )}
                        </div>
                        
                        {/* Restaurant Info */}
                        <CardContent className="p-4">
                          <h3 className="font-bold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
                            {restaurant.name}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {restaurant.description || "Delicious healthy meals"}
                          </p>
                          
                          {/* Stats Row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-amber-500 fill-amber-500" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              <span className="text-sm font-medium">{restaurant.rating.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span>{restaurant.meal_count} meals</span>
                              <span>•</span>
                              <span>{restaurant.total_orders} orders</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                ))
              )}
            </div>
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
