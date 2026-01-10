import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Heart,
  Star,
  Flame,
  Beef,
  Clock,
  Utensils,
  Loader2,
  Trash2,
  Home,
  UtensilsCrossed,
  CalendarDays,
  TrendingUp,
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useToast } from "@/hooks/use-toast";

interface FavoriteRestaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
}

interface FavoriteMeal {
  id: string;
  name: string;
  image_url: string | null;
  calories: number;
  protein_g: number;
  rating: number;
  prep_time_minutes: number;
  restaurant_name: string;
  diet_tags: string[];
}

const Favorites = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { favoriteIds, toggleFavorite } = useFavoriteRestaurants();
  
  const [restaurants, setRestaurants] = useState<FavoriteRestaurant[]>([]);
  const [meals, setMeals] = useState<FavoriteMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("restaurants");

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchFavorites();
  }, [user, favoriteIds]);

  const fetchFavorites = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Fetch favorite restaurants
      const { data: favData, error: favError } = await supabase
        .from("user_favorite_restaurants")
        .select(`
          restaurant:restaurants (
            id,
            name,
            description,
            logo_url,
            rating,
            total_orders,
            meals (id)
          )
        `)
        .eq("user_id", user.id);

      if (favError) throw favError;

      const transformedRestaurants: FavoriteRestaurant[] = (favData || [])
        .filter((f: any) => f.restaurant)
        .map((f: any) => ({
          id: f.restaurant.id,
          name: f.restaurant.name,
          description: f.restaurant.description,
          logo_url: f.restaurant.logo_url,
          rating: parseFloat(f.restaurant.rating) || 0,
          total_orders: f.restaurant.total_orders || 0,
          meal_count: f.restaurant.meals?.length || 0,
        }));

      setRestaurants(transformedRestaurants);

      // For now, we'll show meals from favorite restaurants
      // In a full implementation, you might have a separate meal favorites table
      const restaurantIds = transformedRestaurants.map(r => r.id);
      
      if (restaurantIds.length > 0) {
        const { data: mealsData, error: mealsError } = await supabase
          .from("meals")
          .select(`
            id,
            name,
            image_url,
            calories,
            protein_g,
            rating,
            prep_time_minutes,
            restaurants (name),
            meal_diet_tags (
              diet_tags (name)
            )
          `)
          .in("restaurant_id", restaurantIds)
          .eq("is_available", true)
          .order("rating", { ascending: false })
          .limit(10);

        if (mealsError) throw mealsError;

        const transformedMeals: FavoriteMeal[] = (mealsData || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          image_url: m.image_url,
          calories: m.calories,
          protein_g: parseFloat(m.protein_g),
          rating: parseFloat(m.rating) || 0,
          prep_time_minutes: m.prep_time_minutes || 15,
          restaurant_name: m.restaurants?.name || "Unknown",
          diet_tags: m.meal_diet_tags?.map((mdt: any) => mdt.diet_tags?.name).filter(Boolean) || [],
        }));

        setMeals(transformedMeals);
      } else {
        setMeals([]);
      }
    } catch (err) {
      console.error("Error fetching favorites:", err);
      toast({
        title: "Error",
        description: "Failed to load favorites",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (restaurantId: string, restaurantName: string) => {
    await toggleFavorite(restaurantId, restaurantName);
    setRestaurants(prev => prev.filter(r => r.id !== restaurantId));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">My Favorites</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="restaurants" className="flex-1">
              <Utensils className="w-4 h-4 mr-2" />
              Restaurants ({restaurants.length})
            </TabsTrigger>
            <TabsTrigger value="meals" className="flex-1">
              <UtensilsCrossed className="w-4 h-4 mr-2" />
              Top Meals ({meals.length})
            </TabsTrigger>
          </TabsList>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="restaurants" className="space-y-4">
                {restaurants.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Heart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">No favorite restaurants yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Start exploring and save your favorite restaurants!
                      </p>
                      <Button onClick={() => navigate("/meals")}>
                        Browse Restaurants
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  restaurants.map((restaurant) => (
                    <Card key={restaurant.id} className="overflow-hidden">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex gap-3 sm:gap-4">
                          <Link to={`/restaurants/${restaurant.id}`} className="shrink-0">
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
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link to={`/restaurants/${restaurant.id}`}>
                              <h3 className="font-semibold truncate hover:text-primary transition-colors">
                                {restaurant.name}
                              </h3>
                            </Link>
                            {restaurant.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                {restaurant.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Star className="w-4 h-4 fill-warning text-warning" />
                                {restaurant.rating.toFixed(1)}
                              </span>
                              <span>{restaurant.meal_count} meals</span>
                              <span>{restaurant.total_orders} orders</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveFavorite(restaurant.id, restaurant.name)}
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="meals" className="space-y-4">
                {meals.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">No meals to show</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add favorite restaurants to see their top meals here!
                      </p>
                      <Button onClick={() => navigate("/meals")}>
                        Browse Restaurants
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  meals.map((meal) => (
                    <Link key={meal.id} to={`/meals/${meal.id}`}>
                      <Card className="overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex gap-4">
                            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-4xl overflow-hidden shrink-0">
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
                              <h3 className="font-semibold truncate">{meal.name}</h3>
                              <p className="text-xs text-muted-foreground">{meal.restaurant_name}</p>
                              
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Flame className="w-3 h-3" />
                                  {meal.calories} kcal
                                </span>
                                <span className="flex items-center gap-1">
                                  <Beef className="w-3 h-3" />
                                  {meal.protein_g}g
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
                                  {meal.diet_tags.slice(0, 2).map((tag) => (
                                    <Badge key={tag} variant="diet" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary text-xs">
                              Included
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="flex items-center justify-around py-2">
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/dashboard")}
          >
            <Home className="h-5 w-5" />
            <span className="text-xs">Home</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/meals")}
          >
            <UtensilsCrossed className="h-5 w-5" />
            <span className="text-xs">Meals</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/schedule")}
          >
            <CalendarDays className="h-5 w-5" />
            <span className="text-xs">Schedule</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/progress")}
          >
            <TrendingUp className="h-5 w-5" />
            <span className="text-xs">Progress</span>
          </Button>
          <Button 
            variant="ghost" 
            className="flex flex-col items-center gap-1 h-auto py-2"
            onClick={() => navigate("/profile")}
          >
            <User className="h-5 w-5" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Favorites;
