import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Loader2,
  ChevronLeft,
  Store,
  Heart,
  LayoutGrid,
  List,
  Star
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RestaurantCard } from "@/components/RestaurantCard";
import { RestaurantSearch } from "@/components/RestaurantSearch";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useFeaturedRestaurants } from "@/hooks/useFeaturedRestaurants";
import { CustomerNavigation } from "@/components/CustomerNavigation";

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
  const [searchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(searchParams.get('favorites') === 'true');
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();
  const { isFeatured } = useFeaturedRestaurants();

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
          <RestaurantSearch
            restaurants={restaurants}
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search restaurants..."
          />
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

        {/* View Toggle and Restaurant Grid */}
        <div className="flex items-center justify-between animate-fade-in">
          <h3 className="font-semibold text-sm text-muted-foreground">
            {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''}
          </h3>
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

        <div className={`animate-fade-in stagger-1 ${viewMode === "gallery" ? "grid grid-cols-2 gap-4" : "grid gap-4"}`}>
          {loading ? (
            <div className={`flex items-center justify-center py-20 ${viewMode === "gallery" ? "col-span-2" : ""}`}>
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <Card variant="default" className={viewMode === "gallery" ? "col-span-2" : ""}>
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
          ) : viewMode === "gallery" ? (
            /* Gallery View */
            filteredRestaurants.map((restaurant) => (
              <Link key={restaurant.id} to={`/restaurants/${restaurant.id}`}>
                <Card variant="interactive" className="overflow-hidden h-full">
                  <div className="aspect-square relative bg-muted">
                    {restaurant.logo_url ? (
                      <img 
                        src={restaurant.logo_url} 
                        alt={restaurant.name}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-muted to-muted-foreground/10">
                        🍽️
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(restaurant.id, restaurant.name);
                      }}
                    >
                      <Heart 
                        className={`w-4 h-4 ${
                          isFavorite(restaurant.id) 
                            ? "fill-destructive text-destructive" 
                            : "text-muted-foreground"
                        }`} 
                      />
                    </Button>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h4 className="font-semibold text-sm line-clamp-1 mb-1">{restaurant.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-warning text-warning" />
                          {restaurant.rating.toFixed(1)}
                        </span>
                        <span>{restaurant.meal_count} meals</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          ) : (
            /* List View */
            filteredRestaurants.map((restaurant) => (
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
      </main>

      <CustomerNavigation />
    </div>
  );
};

export default Meals;
