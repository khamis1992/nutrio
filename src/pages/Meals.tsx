import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Store,
  Heart,
  Star,
  Search,
  X,
  SlidersHorizontal,
  Clock,
  Leaf,
  Flame,
  Utensils,
  LayoutGrid
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { motion, AnimatePresence } from "framer-motion";
import { getRestaurantImage } from "@/lib/meal-images";
import { Haptics } from "@/lib/haptics";
import { CustomerNavigation } from "@/components/CustomerNavigation";

// Import filter images
import allFilterImage from "@/assets/all.png";
import dietFilterImage from "@/assets/diet.png";
import vegetarianFilterImage from "@/assets/healthy.png"; // Using healthy as fallback for vegetarian
import veganFilterImage from "@/assets/vegan.png";
import ketoFilterImage from "@/assets/keto.png";
import proteinFilterImage from "@/assets/protein.png";
import lowCarbFilterImage from "@/assets/low carb.png";
import breakfastFilterImage from "@/assets/breakfast.png";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
  delivery_time?: string;
  delivery_fee?: number;
  cuisine_types?: string[];
}

const cuisineEmojis: Record<string, string> = {
  "Healthy": "🥗",
  "Vegetarian": "🥬",
  "Vegan": "🌱",
  "Keto": "🥑",
  "Protein": "💪",
  "Low Carb": "🥗",
  "Breakfast": "🍳",
};

// Cuisine filter images mapping
const cuisineImages: Record<string, string> = {
  "All": allFilterImage,
  "Healthy": dietFilterImage,
  "Vegetarian": vegetarianFilterImage,
  "Vegan": veganFilterImage,
  "Keto": ketoFilterImage,
  "Protein": proteinFilterImage,
  "Low Carb": lowCarbFilterImage,
  "Mediterranean": ketoFilterImage, // Fallback
  "Breakfast": breakfastFilterImage,
};

// Animation configurations
const springConfig = { type: "spring" as const, stiffness: 380, damping: 25 };

// ============================================
// NATIVE MOBILE SKELETON LOADING
// ============================================
const RestaurantCardSkeleton = () => {
  return (
    <div className="bg-card/95 rounded-3xl p-4 shadow-md border border-border/70 backdrop-blur-sm">
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/15 shrink-0 overflow-hidden">
          <motion.div
            className="w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 bg-primary/10 rounded-full w-3/4" />
          <div className="h-3 bg-muted rounded-full w-full" />
          <div className="flex gap-3 pt-1">
            <div className="h-3 bg-muted rounded-full w-16" />
            <div className="h-3 bg-muted rounded-full w-16" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// NATIVE LIST CARD - iOS STYLE
// ============================================
const RestaurantListCard = ({ 
  restaurant, 
  isFavorite, 
  onToggleFavorite,
  index 
}: { 
  restaurant: Restaurant; 
  isFavorite: boolean; 
  onToggleFavorite: (id: string, name: string) => void;
  index: number;
}) => {
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    Haptics.impact({ style: "medium" });
    onToggleFavorite(restaurant.id, restaurant.name);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ...springConfig }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={`/restaurant/${restaurant.id}`}>
        <div className="group bg-card/95 rounded-3xl overflow-hidden border border-border/70 shadow-md hover:shadow-lg transition-all backdrop-blur-sm">
          <div className="flex p-3 gap-3">
            {/* Restaurant Image with Native Feel */}
            <div className="relative w-24 h-24 shrink-0">
              <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/10">
                <img
                  src={getRestaurantImage(restaurant.logo_url, restaurant.id)}
                  alt={restaurant.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {/* Favorite Button */}
              <motion.button
                onClick={handleFavoriteClick}
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-background/95 shadow-md flex items-center justify-center border border-border/70 backdrop-blur-sm"
                whileTap={{ scale: 0.85 }}
              >
                <Heart 
                  className={`w-4 h-4 transition-colors ${
                    isFavorite 
                      ? "fill-rose-500 text-rose-500" 
                      : "text-muted-foreground"
                  }`} 
                />
              </motion.button>
            </div>

            {/* Content Section */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base leading-tight line-clamp-1 text-foreground">
                    {restaurant.name}
                  </h3>
                </div>
                
                {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
                  <p className="text-xs font-semibold text-primary mt-1 flex items-center gap-1">
                    <Leaf className="w-3 h-3" />
                    {restaurant.cuisine_types[0]}
                  </p>
                )}
                
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {restaurant.description || "Healthy & delicious meals"}
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  {/* Rating Badge */}
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span className="text-xs font-semibold">{restaurant.rating.toFixed(1)}</span>
                  </div>
                  
                  {/* Delivery Time */}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {restaurant.delivery_time || "25-40 min"}
                  </span>
                </div>
                
                {/* Meal Count */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Utensils className="w-3 h-3" />
                  <span>{restaurant.meal_count}</span>
                </div>
              </div>
            </div>
            <div className="self-center pr-1 text-muted-foreground/60 group-hover:text-primary transition-colors">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
          
        </div>
      </Link>
    </motion.div>
  );
};

// ============================================
// NATIVE BOTTOM SHEET FILTER - iOS STYLE
// ============================================
const FilterSheet = ({
  isOpen,
  onClose,
  showFavoritesOnly,
  onToggleFavorites,
  restaurantCount,
  activeSort,
  onChangeSort
}: {
  isOpen: boolean;
  onClose: () => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  restaurantCount: number;
  activeSort: "rating" | "fastest" | "popular";
  onChangeSort: (sort: "rating" | "fastest" | "popular") => void;
}) => {
  const handleSortChange = (sort: "rating" | "fastest" | "popular") => {
    Haptics.impact({ style: "light" });
    onChangeSort(sort);
  };

  const handleFavoritesToggle = () => {
    Haptics.impact({ style: "medium" });
    onToggleFavorites();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, { offset, velocity }) => {
              if (offset.y > 100 || velocity.y > 500) {
                onClose();
              }
            }}
            className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 overflow-hidden"
            style={{ maxHeight: "85vh" }}
          >
            {/* Drag Handle */}
            <div className="pt-3 pb-2 flex justify-center">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
            </div>
            
            <div className="px-5 pb-8 overflow-y-auto max-h-[calc(85vh-60px)]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">Filters</h3>
                  <p className="text-sm text-muted-foreground">{restaurantCount} restaurants</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <SlidersHorizontal className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              {/* Sort Options */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-foreground mb-3 block">
                  Sort by
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: "rating", icon: Star, label: "Top Rated" },
                    { id: "fastest", icon: Clock, label: "Fastest" },
                    { id: "popular", icon: Flame, label: "Popular" },
                  ].map((sort) => (
                    <motion.button
                      key={sort.id}
                      onClick={() => handleSortChange(sort.id as typeof activeSort)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                        activeSort === sort.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      <sort.icon className={`w-4 h-4 ${
                        activeSort === sort.id ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className="text-sm font-medium">{sort.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Favorites Toggle */}
              <div className="mb-8">
                <label className="text-sm font-semibold text-foreground mb-3 block">
                  Filters
                </label>
                <motion.button
                  onClick={handleFavoritesToggle}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    showFavoritesOnly
                      ? "border-rose-400 bg-rose-50/50"
                      : "border-border bg-muted"
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      showFavoritesOnly ? "bg-rose-100" : "bg-muted-foreground/10"
                    }`}>
                      <Heart className={`w-5 h-5 ${showFavoritesOnly ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
                    </div>
                    <div className="text-left">
                      <span className="font-semibold block text-foreground">Favorites Only</span>
                      <span className="text-xs text-muted-foreground">Show only saved restaurants</span>
                    </div>
                  </div>
                  <div className={`w-11 h-6 rounded-full p-1 transition-colors ${
                    showFavoritesOnly ? "bg-rose-500" : "bg-muted-foreground/20"
                  }`}>
                    <motion.div 
                      className="w-4 h-4 bg-white rounded-full shadow"
                      animate={{ x: showFavoritesOnly ? 20 : 0 }}
                      transition={springConfig}
                    />
                  </div>
                </motion.button>
              </div>

              {/* Apply Button */}
              <Button 
                onClick={onClose}
                className="w-full h-12 rounded-xl font-semibold text-base bg-primary hover:bg-primary/90"
              >
                Show {restaurantCount} Restaurants
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ============================================
// NATIVE CHIP COMPONENT
// ============================================
const FilterChip = ({ 
  active, 
  onClick, 
  icon: Icon, 
  label,
  color = "primary"
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType; 
  label: string;
  color?: "primary" | "amber" | "rose" | "blue";
}) => {
  const colorClasses = {
    primary: {
      active: "bg-primary text-primary-foreground shadow-md shadow-primary/25",
      inactive: "bg-card/90 text-muted-foreground border border-border/70"
    },
    amber: {
      active: "bg-amber-500 text-white shadow-md shadow-amber-500/25",
      inactive: "bg-card/90 text-muted-foreground border border-border/70"
    },
    rose: {
      active: "bg-rose-500 text-white shadow-md shadow-rose-500/25",
      inactive: "bg-card/90 text-muted-foreground border border-border/70"
    },
    blue: {
      active: "bg-blue-500 text-white shadow-md shadow-blue-500/25",
      inactive: "bg-card/90 text-muted-foreground border border-border/70"
    }
  };

  return (
    <motion.button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 transition-all ${
        active ? colorClasses[color].active : colorClasses[color].inactive
      }`}
      whileTap={{ scale: 0.92 }}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </motion.button>
  );
};

// ============================================
// CUISINE HORIZONTAL SCROLL
// ============================================
const CuisineScroller = ({ 
  selectedCuisine, 
  onSelectCuisine 
}: { 
  selectedCuisine: string | null;
  onSelectCuisine: (cuisine: string | null) => void;
}) => {
  const cuisines = Object.keys(cuisineEmojis);

  const isAllActive = selectedCuisine === null;

  return (
    <div className="-mx-4 px-4">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* All */}
        <motion.button
          onClick={() => onSelectCuisine(null)}
          whileTap={{ scale: 0.95 }}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
            isAllActive
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 border-primary"
              : "bg-card/90 text-muted-foreground border-border/70 hover:bg-muted/80"
          }`}
        >
          <LayoutGrid className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold whitespace-nowrap">All</span>
        </motion.button>

        {cuisines.map((cuisine) => {
          const isActive = selectedCuisine === cuisine;
          const cuisineImage = cuisineImages[cuisine];
          return (
            <motion.button
              key={cuisine}
              onClick={() => onSelectCuisine(cuisine)}
              whileTap={{ scale: 0.95 }}
              className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 border-primary"
                  : "bg-card/90 text-muted-foreground border-border/70 hover:bg-muted/80"
              }`}
            >
              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-background">
                {cuisineImage ? (
                  <img src={cuisineImage} alt={cuisine} className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-base">
                    {cuisineEmojis[cuisine]}
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold whitespace-nowrap">{cuisine}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// MAIN MEALS COMPONENT - NATIVE MOBILE DESIGN
// ============================================
const Meals = () => {
  const [searchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(searchParams.get('favorites') === 'true');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<"rating" | "fastest" | "popular">("rating");
  // Single-select chip: "rating" | "fastest" | "favorites" — only one active at a time
  const [activeChip, setActiveChip] = useState<"rating" | "fastest" | "favorites">(
    searchParams.get('favorites') === 'true' ? "favorites" : "rating"
  );

  const selectChip = (chip: "rating" | "fastest" | "favorites") => {
    Haptics.impact({ style: "light" });
    setActiveChip(chip);
    if (chip === "favorites") {
      setShowFavoritesOnly(true);
      setActiveSort("rating");
    } else {
      setShowFavoritesOnly(false);
      setActiveSort(chip);
    }
  };
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();

  // Fetch restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("restaurants")
          .select(`
            id,
            name,
            description,
            logo_url,
            rating,
            total_orders,
            cuisine_types
          `)
          .eq("approval_status", "approved")
          .eq("is_active", true);

        if (restaurantsError) throw restaurantsError;

        const typedRestaurantsData = (restaurantsData || []) as Array<{
          id: string;
          name: string;
          description: string | null;
          logo_url: string | null;
          rating: number | string;
          total_orders: number;
          cuisine_types: string[] | null;
        }>;

        const restaurantIds = typedRestaurantsData.map((r) => r.id);
        let mealCounts: Record<string, number> = {};
        
        if (restaurantIds.length > 0) {
          const { data: mealsData } = await supabase
            .from("meals")
            .select("restaurant_id")
            .in("restaurant_id", restaurantIds);
          
          mealCounts = (mealsData || []).reduce((acc: Record<string, number>, meal) => {
            const restaurantId = (meal as { restaurant_id: string }).restaurant_id;
            acc[restaurantId] = (acc[restaurantId] || 0) + 1;
            return acc;
          }, {});
        }

        const transformedRestaurants: Restaurant[] = typedRestaurantsData
          .map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            description: restaurant.description,
            logo_url: restaurant.logo_url,
            rating: parseFloat(String(restaurant.rating)) || 0,
            total_orders: restaurant.total_orders || 0,
            meal_count: mealCounts[restaurant.id] || 0,
            cuisine_types: restaurant.cuisine_types || [],
            delivery_time: `${20 + Math.floor(Math.random() * 25)}-${45 + Math.floor(Math.random() * 15)} min`,
          }));

        setRestaurants(transformedRestaurants);
      } catch (err) {
        console.error("Error fetching restaurants:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  // Filter and sort restaurants
  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];
    
    if (showFavoritesOnly) {
      result = result.filter(r => favoriteIds.has(r.id));
    }
    
    if (selectedCuisine) {
      result = result.filter(r => 
        r.cuisine_types?.some(c => c.toLowerCase() === selectedCuisine.toLowerCase())
      );
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((restaurant) =>
        restaurant.name.toLowerCase().includes(query) ||
        restaurant.description?.toLowerCase().includes(query) ||
        restaurant.cuisine_types?.some(c => c.toLowerCase().includes(query))
      );
    }

    // Sort based on activeSort
    switch (activeSort) {
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "fastest":
        result.sort((a, b) => {
          const aTime = parseInt(a.delivery_time || "30");
          const bTime = parseInt(b.delivery_time || "30");
          return aTime - bTime;
        });
        break;
      case "popular":
        result.sort((a, b) => b.total_orders - a.total_orders);
        break;
    }
    
    return result;
  }, [restaurants, searchQuery, showFavoritesOnly, favoriteIds, activeSort, selectedCuisine]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setShowFavoritesOnly(false);
    setSelectedCuisine(null);
    setActiveSort("rating");
    setActiveChip("rating");
  }, []);

  const hasActiveFilters = searchQuery || showFavoritesOnly || selectedCuisine || activeSort !== "rating";

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f5' }}>
      {/* Native Header */}
      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur-xl border-b border-border/70">
        <div className="px-4 pt-[env(safe-area-inset-top)] h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-10 h-10 rounded-full hover:bg-muted"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </motion.div>
            </Link>
            <h1 className="text-lg font-bold tracking-tight">Restaurants</h1>
          </div>
          <div className="flex items-center gap-1">
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                className={`w-10 h-10 rounded-full relative ${
                  activeChip === "favorites" ? "bg-rose-100 text-rose-500" : "hover:bg-muted"
                }`}
                onClick={() => selectChip(activeChip === "favorites" ? "rating" : "favorites")}
              >
                <Heart className={`w-5 h-5 ${activeChip === "favorites" ? "fill-current" : ""}`} />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 pb-28">
        {/* Greeting */}
        <motion.div 
          className="mb-4 rounded-3xl bg-card/90 border border-border/70 shadow-sm px-4 py-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Leaf className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">Discover</span>
          </div>
          <h2 className="text-xl font-bold text-foreground leading-tight">
            Choose your next healthy meal
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Top-rated restaurants near you</p>
        </motion.div>

        {/* Search Bar - Native Style */}
        <motion.div 
          className="relative mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search className="w-5 h-5" />
          </div>
          <Input
            placeholder="Search restaurants, cuisines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-10 h-12 rounded-2xl bg-card/95 border border-border/70 text-base shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Cuisine Horizontal Scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-5"
        >
          <CuisineScroller 
            selectedCuisine={selectedCuisine}
            onSelectCuisine={setSelectedCuisine}
          />
        </motion.div>

        {/* Quick Filter Chips */}
        <motion.div 
          className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <FilterChip
            active={filterSheetOpen}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setFilterSheetOpen(true);
            }}
            icon={SlidersHorizontal}
            label="Filters"
            color="primary"
          />
          
          <FilterChip
            active={activeChip === "rating"}
            onClick={() => selectChip("rating")}
            icon={Star}
            label="Top Rated"
            color="amber"
          />
          
          <FilterChip
            active={activeChip === "fastest"}
            onClick={() => selectChip("fastest")}
            icon={Clock}
            label="Fastest"
            color="blue"
          />
          
          <FilterChip
            active={activeChip === "favorites"}
            onClick={() => selectChip("favorites")}
            icon={Heart}
            label="Favorites"
            color="rose"
          />
        </motion.div>

        {/* Results Header */}
        <motion.div
          className="flex items-center justify-between mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">
              {showFavoritesOnly ? "Your Favorites" : "All Restaurants"}
            </h2>
            <span className="text-xs text-muted-foreground bg-card/90 border border-border/70 px-2 py-0.5 rounded-full">
              {filteredRestaurants.length}
            </span>
          </div>
        </motion.div>

        {/* Active Filters */}
        {hasActiveFilters && (
          <motion.div 
            className="flex items-center gap-2 mb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="text-xs text-muted-foreground">Active:</span>
            <button
              onClick={clearFilters}
              className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
            >
              Clear all
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}

        {/* Restaurant List */}
        <div className="space-y-3">
          {loading ? (
            // Skeleton Loading
            Array.from({ length: 6 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} />
            ))
          ) : filteredRestaurants.length === 0 ? (
            // Empty State
            <motion.div 
              className="py-16 text-center col-span-full rounded-3xl bg-card/90 border border-border/70"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring" }}
            >
              <motion.div 
                className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Store className="w-10 h-10 text-muted-foreground/50" />
              </motion.div>
              <h3 className="font-semibold text-lg text-foreground mb-1">
                {showFavoritesOnly ? "No favorites yet" : "No restaurants found"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4 px-8">
                {showFavoritesOnly 
                  ? "Save your favorite restaurants to find them quickly" 
                  : "Try adjusting your search or filters"}
              </p>
              {hasActiveFilters && (
                <Button 
                  onClick={clearFilters}
                  variant="outline"
                  className="rounded-full"
                >
                  Clear all filters
                </Button>
              )}
            </motion.div>
          ) : (
            // List View
            filteredRestaurants.map((restaurant, index) => (
              <RestaurantListCard
                key={restaurant.id}
                restaurant={restaurant}
                isFavorite={isFavorite(restaurant.id)}
                onToggleFavorite={toggleFavorite}
                index={index}
              />
            ))
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <CustomerNavigation />

      {/* Filter Sheet */}
      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => selectChip(activeChip === "favorites" ? "rating" : "favorites")}
        restaurantCount={filteredRestaurants.length}
        activeSort={activeSort}
        onChangeSort={(sort) => { setActiveSort(sort); setActiveChip(sort); setShowFavoritesOnly(false); }}
      />
    </div>
  );
};

export default Meals;
