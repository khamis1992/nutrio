import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft,
  Star,
  Flame,
  Beef,
  Clock,
  Search,
  Utensils,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  User,
  Salad,
  Crown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  rating: number;
  total_orders: number;
}

interface Meal {
  id: string;
  name: string;
  image_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  rating: number;
  prep_time_minutes: number;
  diet_tags: string[];
}

const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { hasActiveSubscription, subscription, remainingMeals, isUnlimited } = useSubscription();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        // Fetch restaurant details
        const { data: restaurantData, error: restaurantError } = await supabase
          .from("restaurants")
          .select("*")
          .eq("id", id)
          .single();

        if (restaurantError) throw restaurantError;

        setRestaurant({
          id: restaurantData.id,
          name: restaurantData.name,
          description: restaurantData.description,
          logo_url: restaurantData.logo_url,
          address: restaurantData.address,
          phone: restaurantData.phone,
          email: restaurantData.email,
          rating: parseFloat(String(restaurantData.rating)) || 0,
          total_orders: restaurantData.total_orders || 0,
        });

        // Fetch meals for this restaurant
        const { data: mealsData, error: mealsError } = await supabase
          .from("meals")
          .select(`
            id,
            name,
            image_url,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            rating,
            prep_time_minutes,
            meal_diet_tags (
              diet_tags (id, name)
            )
          `)
          .eq("restaurant_id", id)
          .eq("is_available", true);

        if (mealsError) throw mealsError;

        const transformedMeals: Meal[] = (mealsData || []).map((meal: any) => ({
          id: meal.id,
          name: meal.name,
          image_url: meal.image_url,
          calories: meal.calories,
          protein_g: parseFloat(meal.protein_g),
          carbs_g: parseFloat(meal.carbs_g),
          fat_g: parseFloat(meal.fat_g),
          rating: parseFloat(meal.rating) || 0,
          prep_time_minutes: meal.prep_time_minutes || 15,
          diet_tags: meal.meal_diet_tags?.map((mdt: any) => mdt.diet_tags?.name).filter(Boolean) || [],
        }));

        setMeals(transformedMeals);
      } catch (err) {
        console.error("Error fetching restaurant data:", err);
        navigate("/meals");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const filteredMeals = useMemo(() => {
    if (!searchQuery) return meals;
    return meals.filter(meal => 
      meal.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [meals, searchQuery]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/meals")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold truncate">{restaurant.name}</h1>
            <p className="text-xs text-muted-foreground">{meals.length} meals available</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-6 pb-24">
        {/* Restaurant Info Card */}
        <Card variant="stat" className="animate-fade-in">
          <CardContent className="p-5">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-4xl overflow-hidden shrink-0 shadow-md border border-border/50">
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
                <h2 className="font-bold text-xl">{restaurant.name}</h2>
                {restaurant.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {restaurant.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-warning text-warning" />
                    {restaurant.rating.toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">
                    {restaurant.total_orders} orders
                  </span>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            {(restaurant.address || restaurant.phone || restaurant.email) && (
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                {restaurant.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{restaurant.address}</span>
                  </div>
                )}
                {restaurant.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{restaurant.phone}</span>
                  </div>
                )}
                {restaurant.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{restaurant.email}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Status Banner */}
        {hasActiveSubscription ? (
          <Card className="animate-fade-in border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{subscription?.plan} Plan</p>
                    <p className="text-sm text-muted-foreground">
                      {isUnlimited 
                        ? "Unlimited meals included" 
                        : `${remainingMeals} meals remaining this week`
                      }
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-fade-in border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Subscribe to order meals</p>
                  <p className="text-sm text-muted-foreground">All meals are included in your subscription</p>
                </div>
                <Button size="sm" onClick={() => navigate("/subscription")}>
                  Subscribe
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="relative animate-fade-in stagger-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search meals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Meals Section */}
        <section className="space-y-4 animate-fade-in stagger-2">
          <h3 className="font-semibold">Menu ({filteredMeals.length})</h3>
          
          <div className="grid gap-4">
            {filteredMeals.length === 0 ? (
              <Card variant="default">
                <CardContent className="p-8 text-center">
                  <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">No meals found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "Try a different search term" : "This restaurant hasn't added any meals yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredMeals.map((meal) => (
                <Link key={meal.id} to={`/meals/${meal.id}`}>
                  <Card variant="interactive">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                      <div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center text-5xl overflow-hidden shrink-0 shadow-md border border-border/50">
                        {meal.image_url ? (
                          <img 
                            src={meal.image_url} 
                            alt={meal.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          "🍽️"
                        )}
                      </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold truncate">{meal.name}</h4>
                            <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0 text-xs">
                              Included
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" />
                              {meal.calories} kcal
                            </span>
                            <span className="flex items-center gap-1">
                              <Beef className="w-3 h-3" />
                              {meal.protein_g}g protein
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

                          {meal.diet_tags.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {meal.diet_tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="diet" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {meal.diet_tags.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{meal.diet_tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
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
              { icon: Salad, label: "Home", active: false, to: "/dashboard" },
              { icon: Utensils, label: "Restaurants", active: true, to: "/meals" },
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

export default RestaurantDetail;
