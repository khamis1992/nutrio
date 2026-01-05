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
  Receipt
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Meal {
  id: string;
  name: string;
  restaurant_name: string;
  image_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  price: number;
  rating: number;
  prep_time_minutes: number;
  diet_tags: string[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealsLoading, setMealsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("All");

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, profileLoading, navigate]);

  // Fetch meals
  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const { data, error } = await supabase
          .from("meals")
          .select(`
            id,
            name,
            image_url,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            price,
            rating,
            prep_time_minutes,
            restaurants (name)
          `)
          .eq("is_available", true)
          .limit(10);

        if (error) throw error;

        // Transform data
        const transformedMeals: Meal[] = (data || []).map((meal: any) => ({
          id: meal.id,
          name: meal.name,
          restaurant_name: meal.restaurants?.name || "Unknown",
          image_url: meal.image_url,
          calories: meal.calories,
          protein_g: meal.protein_g,
          carbs_g: meal.carbs_g,
          fat_g: meal.fat_g,
          price: parseFloat(meal.price),
          rating: parseFloat(meal.rating) || 0,
          prep_time_minutes: meal.prep_time_minutes || 15,
          diet_tags: [], // TODO: Fetch from meal_diet_tags
        }));

        setMeals(transformedMeals);
      } catch (err) {
        console.error("Error fetching meals:", err);
      } finally {
        setMealsLoading(false);
      }
    };

    fetchMeals();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/");
  };

  const filters = ["All", "High Protein", "Low Carb", "Keto", "Vegan"];

  // Calculate consumed values (placeholder - would come from progress_logs)
  const userStats = {
    dailyCalories: profile?.daily_calorie_target || 2000,
    consumedCalories: 0, // Would be calculated from today's logged meals
    protein: { target: profile?.protein_target_g || 150, consumed: 0 },
    carbs: { target: profile?.carbs_target_g || 200, consumed: 0 },
    fat: { target: profile?.fat_target_g || 65, consumed: 0 },
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

        {/* Browse Meals Section */}
        <section className="space-y-4 animate-fade-in stagger-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Browse Meals</h2>
            <Link to="/meals">
              <Button variant="ghost" size="sm" className="text-primary">
                View All <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {filters.map((filter) => (
              <Button
                key={filter}
                variant={selectedFilter === filter ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedFilter(filter)}
                className="whitespace-nowrap"
              >
                {filter}
              </Button>
            ))}
          </div>

          {/* Meal Cards */}
          <div className="grid gap-4">
            {mealsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : meals.length === 0 ? (
              <Card variant="default">
                <CardContent className="p-8 text-center">
                  <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No meals available yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Partner restaurants will add meals soon. Check back later!
                  </p>
                </CardContent>
              </Card>
            ) : (
              meals.map((meal) => (
                <Card key={meal.id} variant="interactive">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-4xl overflow-hidden">
                        {meal.image_url ? (
                          <img 
                            src={meal.image_url} 
                            alt={meal.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          "🍽️"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold truncate">{meal.name}</h3>
                            <p className="text-sm text-muted-foreground">{meal.restaurant_name}</p>
                          </div>
                          <p className="font-bold text-primary">${meal.price.toFixed(2)}</p>
                        </div>
                        
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            {meal.calories} kcal
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {meal.prep_time_minutes} min
                          </span>
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-warning text-warning" />
                            {meal.rating.toFixed(1)}
                          </span>
                        </div>

                        <div className="flex gap-1.5 mt-2">
                          {meal.diet_tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="diet" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
              { icon: Utensils, label: "Meals", active: false, to: "/meals" },
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
    </div>
  );
};

export default Dashboard;
