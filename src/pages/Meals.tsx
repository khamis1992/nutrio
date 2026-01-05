import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Salad, 
  Utensils,
  Calendar,
  TrendingUp,
  Search,
  Loader2,
  ChevronLeft,
  User,
  Store,
  Heart
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RestaurantCard } from "@/components/RestaurantCard";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
}

const Meals = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();

  // Fetch restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        // Fetch approved restaurants with meal counts
        const { data: restaurantsData, error: restaurantsError } = await supabase
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
          .eq("is_active", true);

        if (restaurantsError) throw restaurantsError;

        // Transform data with meal counts
        const transformedRestaurants: Restaurant[] = (restaurantsData || []).map((restaurant: any) => ({
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
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Filter restaurants based on search and favorites
  const filteredRestaurants = useMemo(() => {
    let result = restaurants;
    
    // Filter by favorites if enabled
    if (showFavoritesOnly) {
      result = result.filter(r => favoriteIds.has(r.id));
    }
    
    // Filter by search
    if (searchQuery) {
      result = result.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        restaurant.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return result;
  }, [restaurants, searchQuery, showFavoritesOnly, favoriteIds]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Browse Restaurants</h1>
            <p className="text-xs text-muted-foreground">{filteredRestaurants.length} restaurants available</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Search and Filter Bar */}
        <div className="flex gap-2 animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="icon"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="shrink-0"
          >
            <Heart className={`w-4 h-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
          </Button>
        </div>

        {/* Favorites Filter Indicator */}
        {showFavoritesOnly && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
            <Heart className="w-4 h-4 fill-destructive text-destructive" />
            <span>Showing favorites only</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-primary"
              onClick={() => setShowFavoritesOnly(false)}
            >
              Show all
            </Button>
          </div>
        )}

        {/* Restaurant Grid */}
        <div className="grid gap-4 animate-fade-in stagger-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <Card variant="default">
              <CardContent className="p-12 text-center">
                <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  {showFavoritesOnly ? "No favorite restaurants yet" : "No restaurants found"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {showFavoritesOnly 
                    ? "Tap the heart icon on restaurants to add them to your favorites" 
                    : searchQuery 
                      ? "Try a different search term" 
                      : "Check back later for new restaurants"
                  }
                </p>
                {(searchQuery || showFavoritesOnly) && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSearchQuery("");
                      setShowFavoritesOnly(false);
                    }}
                  >
                    Clear filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                isFavorite={isFavorite(restaurant.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))
          )}
        </div>
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

export default Meals;
