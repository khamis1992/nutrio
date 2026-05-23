import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Heart,
  Star,
  Flame,
  Beef,
  Clock,
  Utensils,
  UtensilsCrossed,
  Loader2,
  Trash2,
  RotateCcw,
  TrendingUp,
  Calendar,
  ShoppingBag,
  ClipboardList,
  ForkKnife,
  ChefHat
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useToast } from "@/hooks/use-toast";
import { useTopMeals } from "@/hooks/useTopMeals";
import { EmptyState } from "@/components/EmptyState";
import { formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface FavoriteRestaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
}

const Favorites = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { toggleFavorite } = useFavoriteRestaurants();
  const { topMeals, loading: topMealsLoading, removeFromTopMeals, fetchTopMeals } = useTopMeals();
  
  const [restaurants, setRestaurants] = useState<FavoriteRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("restaurants");

  useEffect(() => {
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRestaurants = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      const { data: favData, error: favError } = await supabase
        .from("user_favorite_restaurants")
        .select("restaurant_id")
        .eq("user_id", user.id);

      if (favError) throw favError;

      const restaurantIds = (favData || []).map((f: { restaurant_id: string }) => f.restaurant_id);
      
      if (restaurantIds.length > 0) {
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("restaurants")
          .select("id, name, description, logo_url, rating, total_orders")
          .in("id", restaurantIds);

        if (restaurantsError) throw restaurantsError;

        const { data: mealsCountData } = await supabase
          .from("meals")
          .select("restaurant_id")
          .in("restaurant_id", restaurantIds);

        const mealCounts: Record<string, number> = {};
        (mealsCountData || []).forEach((meal: { restaurant_id: string }) => {
          mealCounts[meal.restaurant_id] = (mealCounts[meal.restaurant_id] || 0) + 1;
        });

        const transformedRestaurants: FavoriteRestaurant[] = (restaurantsData || [])
          .map((r: { id: string; name: string; description: string | null; logo_url: string | null; rating: number | string; total_orders: number }) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            logo_url: r.logo_url,
            rating: parseFloat(String(r.rating)) || 0,
            total_orders: r.total_orders || 0,
            meal_count: mealCounts[r.id] || 0,
          }));

        setRestaurants(transformedRestaurants);
      } else {
        setRestaurants([]);
      }
    } catch (err) {
      console.error("Error fetching favorites:", err);
      toast({
        title: t("error"),
        description: t("failed_to_load_favorites"),
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

  const handleRemoveTopMeal = async (topMealId: string, mealName: string) => {
    const success = await removeFromTopMeals(topMealId);
    if (success) {
      toast({
        title: t("removed_from_top_meals"),
        description: `${mealName} ${t("removed")}.`,
      });
    }
  };

  const handleRefreshTopMeals = async () => {
    await fetchTopMeals();
    toast({
      title: t("refreshed_toast_short"),
      description: t("top_meals_refreshed_desc"),
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      {/* Header */}
      <div className="bg-white px-4 pt-safe pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-100">
            <Heart className="h-5 w-5 text-emerald-600 fill-emerald-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">My Favorites</h1>
            <p className="text-sm text-gray-500">All your saved favorites</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto p-1 bg-gray-100 rounded-2xl mb-4">
            <TabsTrigger 
              value="restaurants" 
              className="flex-1 rounded-xl py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm text-gray-500 transition-all"
            >
              <Utensils className="w-4 h-4 mr-2" />
              Restaurants ({restaurants.length})
            </TabsTrigger>
            <TabsTrigger 
              value="meals" 
              className="flex-1 rounded-xl py-2.5 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm text-gray-500 transition-all"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Top Meals ({topMeals.length})
            </TabsTrigger>
          </TabsList>

          {loading || topMealsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : (
            <>
              <TabsContent value="restaurants" className="space-y-4 mt-0">
                {restaurants.length === 0 ? (
                  <EmptyState
                    icon={<Heart className="w-8 h-8" />}
                    title={t("no_favorite_restaurants_title")}
                    description={t("no_favorite_restaurants_desc")}
                    actionLabel={t("browse_restaurants_btn")}
                    actionHref="/meals"
                  />
                ) : (
                  restaurants.map((restaurant) => (
                    <Card key={restaurant.id} className="overflow-hidden rounded-2xl border-0 shadow-sm bg-white">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <Link to={`/restaurant/${restaurant.id}`} className="shrink-0">
                            <div className="w-[72px] h-[72px] rounded-xl bg-violet-100 flex items-center justify-center overflow-hidden">
                              {restaurant.logo_url ? (
                                <img
                                  src={restaurant.logo_url}
                                  alt={restaurant.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center">
                                  <ChefHat className="w-8 h-8 text-violet-300" />
                                </div>
                              )}
                            </div>
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <Link to={`/restaurant/${restaurant.id}`} className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate hover:text-emerald-600 transition-colors">
                                  {restaurant.name}
                                </h3>
                              </Link>
                              <button
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 transition-colors shrink-0"
                                onClick={() => handleRemoveFavorite(restaurant.id, restaurant.name)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                            {restaurant.description && (
                              <p className="text-sm text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                                {restaurant.description}
                              </p>
                            )}
                            
                            {/* Stats Row */}
                            <div className="flex items-center gap-3 mt-3">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50">
                                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                                </div>
                                <div className="flex flex-col leading-none">
                                  <span className="text-sm font-semibold text-gray-900">{restaurant.rating.toFixed(1)}</span>
                                  <span className="text-xs text-gray-500">Rating</span>
                                </div>
                              </div>
                              
                              <div className="w-px h-8 bg-gray-200" />
                              
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50">
                                  <ShoppingBag className="w-4 h-4 text-emerald-500" />
                                </div>
                                <div className="flex flex-col leading-none">
                                  <span className="text-sm font-semibold text-gray-900">{restaurant.meal_count}</span>
                                  <span className="text-xs text-gray-500">Meals</span>
                                </div>
                              </div>
                              
                              <div className="w-px h-8 bg-gray-200" />
                              
                              <div className="flex items-center gap-2">
                                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
                                  <ClipboardList className="w-4 h-4 text-blue-500" />
                                </div>
                                <div className="flex flex-col leading-none">
                                  <span className="text-sm font-semibold text-gray-900">{restaurant.total_orders}</span>
                                  <span className="text-xs text-gray-500">Orders</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="meals" className="space-y-4 mt-0">
                {/* Info Card */}
                <Card className="bg-emerald-50/50 border-emerald-100 rounded-2xl border-0">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-emerald-600 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-medium text-sm text-gray-900">{t("how_top_meals_work")}</h3>
                        <ul className="text-xs text-gray-500 mt-1 space-y-1">
                          <li>• {t("top_meals_rule_1")}</li>
                          <li>• {t("top_meals_rule_2")}</li>
                          <li>• {t("top_meals_rule_3")}</li>
                        </ul>
                      </div>
                      <button 
                        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-emerald-100 transition-colors shrink-0"
                        onClick={handleRefreshTopMeals}
                      >
                        <RotateCcw className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {topMeals.length === 0 ? (
                  <EmptyState
                    icon={<UtensilsCrossed className="w-8 h-8" />}
                    title={t("no_top_meals_title")}
                    description={t("no_top_meals_desc")}
                    actionLabel={t("browse_meals_btn")}
                    actionHref="/meals"
                  />
                ) : (
                  topMeals.map((meal) => (
                    <Card key={meal.id} className="overflow-hidden rounded-2xl border-0 shadow-sm bg-white">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <Link to={`/meals/${meal.meal_id}`} className="shrink-0">
                            <div className="w-[72px] h-[72px] rounded-xl bg-violet-100 flex items-center justify-center overflow-hidden">
                              {meal.image_url ? (
                                <img 
                                  src={meal.image_url} 
                                  alt={meal.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center">
                                  <ChefHat className="w-8 h-8 text-violet-300" />
                                </div>
                              )}
                            </div>
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <Link to={`/meals/${meal.meal_id}`} className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate hover:text-emerald-600 transition-colors">
                                  {meal.name}
                                </h3>
                              </Link>
                              <button
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 transition-colors shrink-0"
                                onClick={() => handleRemoveTopMeal(meal.id, meal.name)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                            <p className="text-xs text-gray-500">{meal.restaurant_name}</p>
                            
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-500" />
                                {meal.calories} {t("cal")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Beef className="w-3 h-3 text-rose-500" />
                                {meal.protein_g}g {t("protein")}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-blue-500" />
                                {meal.prep_time_minutes} {t("min_label")}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                                <TrendingUp className="w-3 h-3" />
                                {meal.order_count} {t("orders_count_label")}
                              </span>
                              {meal.last_ordered_at && (
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {t("last_ordered")} {formatDistanceToNow(new Date(meal.last_ordered_at), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default Favorites;
