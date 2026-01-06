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
  Crown,
  LayoutGrid,
  List,
  Percent
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useVipDiscount } from "@/hooks/useVipDiscount";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { MealFilters, MealFiltersState, defaultFilters } from "@/components/MealFilters";
import { VipDiscountIndicator } from "@/components/VipPriceBadge";
import { formatCurrency } from "@/lib/currency";

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
  is_vip_exclusive: boolean;
  price: number;
}

const RestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [filters, setFilters] = useState<MealFiltersState>(defaultFilters);
  const { hasActiveSubscription, subscription, remainingMeals, isUnlimited } = useSubscription();
  const { isVip, discountPercent, calculateDiscountedPrice } = useVipDiscount();

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
            is_vip_exclusive,
            price,
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
          is_vip_exclusive: meal.is_vip_exclusive || false,
          price: parseFloat(meal.price) || 0,
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

  // Get all unique diet tags from meals
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    meals.forEach(meal => {
      meal.diet_tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [meals]);

  // Calculate max values for filters
  const maxValues = useMemo(() => ({
    calories: Math.max(...meals.map(m => m.calories), 500),
    protein: Math.max(...meals.map(m => m.protein_g), 50),
    carbs: Math.max(...meals.map(m => m.carbs_g), 100),
    fat: Math.max(...meals.map(m => m.fat_g), 50),
  }), [meals]);

  // Initialize filters with max values when meals load
  useEffect(() => {
    if (meals.length > 0) {
      setFilters(prev => ({
        ...prev,
        caloriesRange: [0, maxValues.calories],
        proteinRange: [0, maxValues.protein],
        carbsRange: [0, maxValues.carbs],
        fatRange: [0, maxValues.fat],
      }));
    }
  }, [maxValues]);

  const filteredMeals = useMemo(() => {
    return meals.filter(meal => {
      // Search filter
      if (searchQuery && !meal.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Diet tags filter
      if (filters.dietTags.length > 0) {
        const hasMatchingTag = filters.dietTags.some(tag => meal.diet_tags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // Calories filter
      if (meal.calories < filters.caloriesRange[0] || meal.calories > filters.caloriesRange[1]) {
        return false;
      }

      // Protein filter
      if (meal.protein_g < filters.proteinRange[0] || meal.protein_g > filters.proteinRange[1]) {
        return false;
      }

      // Carbs filter
      if (meal.carbs_g < filters.carbsRange[0] || meal.carbs_g > filters.carbsRange[1]) {
        return false;
      }

      // Fat filter
      if (meal.fat_g < filters.fatRange[0] || meal.fat_g > filters.fatRange[1]) {
        return false;
      }

      return true;
    });
  }, [meals, searchQuery, filters]);

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

        {/* Search and Filters */}
        <div className="flex gap-3 animate-fade-in stagger-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <MealFilters
            availableTags={availableTags}
            filters={filters}
            onFiltersChange={setFilters}
            maxCalories={maxValues.calories}
            maxProtein={maxValues.protein}
            maxCarbs={maxValues.carbs}
            maxFat={maxValues.fat}
          />
        </div>

        {/* Meals Section */}
        <section className="space-y-4 animate-fade-in stagger-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold">Menu ({filteredMeals.length})</h3>
              {isVip && discountPercent > 0 && (
                <VipDiscountIndicator discountPercent={discountPercent} />
              )}
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "gallery" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("gallery")}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
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
          ) : viewMode === "gallery" ? (
            /* Gallery View */
            <div className="grid grid-cols-2 gap-4">
              {filteredMeals.map((meal) => {
                const priceInfo = calculateDiscountedPrice(meal.price);
                return (
                  <Link key={meal.id} to={`/meals/${meal.id}`}>
                    <Card variant="interactive" className="overflow-hidden h-full">
                      <div className="aspect-square relative bg-muted">
                        {meal.image_url ? (
                          <img 
                            src={meal.image_url} 
                            alt={meal.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-muted to-muted-foreground/10">
                            🍽️
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                        {meal.is_vip_exclusive ? (
                          <Badge variant="outline" className="absolute top-2 right-2 bg-gradient-to-r from-amber-500 to-yellow-500 border-0 text-white text-xs">
                            <Crown className="w-3 h-3 mr-1" />
                            VIP Only
                          </Badge>
                        ) : priceInfo.hasDiscount ? (
                          <Badge variant="outline" className="absolute top-2 right-2 bg-gradient-to-r from-violet-500 to-purple-500 border-0 text-white text-xs">
                            <Percent className="w-3 h-3 mr-1" />
                            -{priceInfo.discountPercent}%
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-xs">
                            Included
                          </Badge>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <h4 className="font-semibold text-sm line-clamp-2 mb-1">{meal.name}</h4>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Flame className="w-3 h-3" />
                                {meal.calories}
                              </span>
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-warning text-warning" />
                                {meal.rating.toFixed(1)}
                              </span>
                            </div>
                            {priceInfo.hasDiscount && (
                              <span className="font-semibold text-violet-500">
                                {formatCurrency(priceInfo.discountedPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="grid gap-4">
              {filteredMeals.map((meal) => {
                const priceInfo = calculateDiscountedPrice(meal.price);
                return (
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
                              {meal.is_vip_exclusive ? (
                                <Badge variant="outline" className="bg-gradient-to-r from-amber-500 to-yellow-500 border-0 text-white shrink-0 text-xs">
                                  <Crown className="w-3 h-3 mr-1" />
                                  VIP Only
                                </Badge>
                              ) : priceInfo.hasDiscount ? (
                                <Badge variant="outline" className="bg-gradient-to-r from-violet-500 to-purple-500 border-0 text-white shrink-0 text-xs">
                                  <Percent className="w-3 h-3 mr-1" />
                                  -{priceInfo.discountPercent}%
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0 text-xs">
                                  Included
                                </Badge>
                              )}
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

                            {/* VIP Price Display */}
                            {priceInfo.hasDiscount && (
                              <div className="flex items-center gap-2 mt-2">
                                <span className="line-through text-xs text-muted-foreground">
                                  {formatCurrency(priceInfo.originalPrice)}
                                </span>
                                <span className="font-semibold text-sm text-violet-500">
                                  {formatCurrency(priceInfo.discountedPrice)}
                                </span>
                              </div>
                            )}

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
                );
              })}
            </div>
          )}
        </section>
      </main>

      <CustomerNavigation />
    </div>
  );
};

export default RestaurantDetail;
