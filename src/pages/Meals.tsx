import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ChevronLeft,
  Store,
  Heart,
  LayoutGrid,
  List,
  Star,
  Search,
  X,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Leaf,
  Flame,
  Utensils
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { motion, AnimatePresence } from "framer-motion";
import { Haptics } from "@/lib/haptics";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { Badge } from "@/components/ui/badge";

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
  is_featured?: boolean;
  discount?: string | null;
}

const cuisineEmojis: Record<string, string> = {
  "Healthy": "🥗",
  "Mediterranean": "🫒",
  "Asian": "🍜",
  "Italian": "🍝",
  "Mexican": "🌮",
  "Indian": "🍛",
  "American": "🍔",
  "Breakfast": "🍳",
  "Seafood": "🦐",
  "Vegetarian": "🥬",
  "Vegan": "🌱",
  "Keto": "🥑",
  "Protein": "💪",
  "Low Carb": "🥗",
};

const cuisineColors: Record<string, string> = {
  "Healthy": "from-emerald-400 to-green-500",
  "Mediterranean": "from-blue-400 to-cyan-500",
  "Asian": "from-red-400 to-rose-500",
  "Italian": "from-green-400 to-emerald-500",
  "Mexican": "from-orange-400 to-amber-500",
  "Indian": "from-orange-500 to-red-500",
  "American": "from-yellow-400 to-orange-500",
  "Breakfast": "from-amber-300 to-yellow-400",
  "Seafood": "from-cyan-400 to-blue-500",
  "Vegetarian": "from-green-400 to-lime-500",
  "Vegan": "from-emerald-400 to-teal-500",
  "Keto": "from-violet-400 to-purple-500",
  "Protein": "from-blue-500 to-indigo-500",
  "Low Carb": "from-teal-400 to-cyan-500",
};

// Animation configurations
const springConfig = { type: "spring" as const, stiffness: 380, damping: 25 };

// ============================================
// NATIVE MOBILE SKELETON LOADING
// ============================================
const RestaurantCardSkeleton = ({ viewMode }: { viewMode: "list" | "gallery" }) => {
  if (viewMode === "gallery") {
    return (
      <div className="relative">
        <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 overflow-hidden">
          <motion.div
            className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="mt-3 space-y-2 px-1">
          <div className="h-4 bg-primary/10 rounded-full w-2/3" />
          <div className="h-3 bg-muted rounded-full w-1/2" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 shrink-0 overflow-hidden">
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

  const cuisineEmoji = cuisineEmojis[restaurant.cuisine_types?.[0] || ""] || "🍽️";
  const hasDiscount = restaurant.discount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, ...springConfig }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={`/restaurant/${restaurant.id}`}>
        <div className="group bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow">
          <div className="flex p-3 gap-3">
            {/* Restaurant Image with Native Feel */}
            <div className="relative w-24 h-24 shrink-0">
              <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
                {restaurant.logo_url ? (
                  <img 
                    src={restaurant.logo_url} 
                    alt={restaurant.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">
                    {cuisineEmoji}
                  </div>
                )}
              </div>
              
              {/* Featured Badge */}
              {restaurant.is_featured && (
                <div className="absolute -top-1 -left-1">
                  <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] px-1.5 py-0.5 border-0">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    Featured
                  </Badge>
                </div>
              )}

              {/* Favorite Button */}
              <motion.button
                onClick={handleFavoriteClick}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background shadow-md flex items-center justify-center border border-border"
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
                  <p className="text-xs font-medium text-primary mt-0.5 flex items-center gap-1">
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
          </div>
          
          {/* Discount Banner if exists */}
          {hasDiscount && (
            <div className="mx-3 mb-3">
              <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <span className="text-xs font-medium text-primary">{restaurant.discount}</span>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

// ============================================
// NATIVE GALLERY CARD - iOS STYLE
// ============================================
const RestaurantGalleryCard = ({ 
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

  const cuisineEmoji = cuisineEmojis[restaurant.cuisine_types?.[0] || ""] || "🍽️";
  const cuisineGradient = cuisineColors[restaurant.cuisine_types?.[0] || ""] || "from-primary to-accent";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04, ...springConfig }}
      whileTap={{ scale: 0.97 }}
    >
      <Link to={`/restaurant/${restaurant.id}`}>
        <div className="group relative">
          {/* Image Container with Native iOS Feel */}
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-gradient-to-br from-muted to-muted/50">
            {restaurant.logo_url ? (
              <img 
                src={restaurant.logo_url} 
                alt={restaurant.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br ${cuisineGradient}`}>
                <span className="drop-shadow-lg">{cuisineEmoji}</span>
              </div>
            )}
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
            
            {/* Top Badges */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
              {/* Rating */}
              <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">{restaurant.rating.toFixed(1)}</span>
              </div>
              
              {/* Favorite */}
              <motion.button
                onClick={handleFavoriteClick}
                className="w-8 h-8 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-sm"
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

            {/* Featured Badge */}
            {restaurant.is_featured && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-lg">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Featured
                </Badge>
              </div>
            )}

            {/* Discount Badge */}
            {restaurant.discount && (
              <div className="absolute top-12 left-3">
                <Badge className="bg-primary text-primary-foreground border-0 shadow-lg">
                  {restaurant.discount}
                </Badge>
              </div>
            )}

            {/* Bottom Content */}
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2 mb-1">
                {restaurant.name}
              </h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{restaurant.delivery_time || "25-40 min"}</span>
                </div>
                
                {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                    {restaurant.cuisine_types[0]}
                  </Badge>
                )}
              </div>
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
  viewMode,
  onChangeViewMode,
  restaurantCount,
  activeSort,
  onChangeSort
}: {
  isOpen: boolean;
  onClose: () => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  viewMode: "list" | "gallery";
  onChangeViewMode: (mode: "list" | "gallery") => void;
  restaurantCount: number;
  activeSort: "rating" | "fastest" | "popular";
  onChangeSort: (sort: "rating" | "fastest" | "popular") => void;
}) => {
  const handleViewModeChange = (mode: "list" | "gallery") => {
    Haptics.impact({ style: "light" });
    onChangeViewMode(mode);
  };

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

              {/* View Mode Toggle */}
              <div className="mb-6">
                <label className="text-sm font-semibold text-foreground mb-3 block">
                  View Style
                </label>
                <div className="flex gap-2 bg-muted p-1.5 rounded-xl">
                  <motion.button
                    onClick={() => handleViewModeChange("list")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                      viewMode === "list"
                        ? "bg-card shadow-sm text-primary"
                        : "text-muted-foreground"
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <List className="w-4 h-4" />
                    <span className="text-sm font-medium">List</span>
                  </motion.button>
                  <motion.button
                    onClick={() => handleViewModeChange("gallery")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                      viewMode === "gallery"
                        ? "bg-card shadow-sm text-primary"
                        : "text-muted-foreground"
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="text-sm font-medium">Grid</span>
                  </motion.button>
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
      inactive: "bg-card text-muted-foreground border border-border"
    },
    amber: {
      active: "bg-amber-500 text-white shadow-md shadow-amber-500/25",
      inactive: "bg-card text-muted-foreground border border-border"
    },
    rose: {
      active: "bg-rose-500 text-white shadow-md shadow-rose-500/25",
      inactive: "bg-card text-muted-foreground border border-border"
    },
    blue: {
      active: "bg-blue-500 text-white shadow-md shadow-blue-500/25",
      inactive: "bg-card text-muted-foreground border border-border"
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

  return (
    <div className="-mx-4 px-4">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <motion.button
          onClick={() => onSelectCuisine(null)}
          className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
            selectedCuisine === null 
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
              : "bg-card text-muted-foreground border border-border"
          }`}
          whileTap={{ scale: 0.95 }}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
            selectedCuisine === null ? "bg-white/20" : "bg-muted"
          }`}>
            🍽️
          </div>
          <span className="text-xs font-medium whitespace-nowrap">All</span>
        </motion.button>

        {cuisines.map((cuisine) => (
          <motion.button
            key={cuisine}
            onClick={() => onSelectCuisine(cuisine)}
            className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
              selectedCuisine === cuisine 
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" 
                : "bg-card text-muted-foreground border border-border"
            }`}
            whileTap={{ scale: 0.95 }}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
              selectedCuisine === cuisine ? "bg-white/20" : "bg-muted"
            }`}>
              {cuisineEmojis[cuisine]}
            </div>
            <span className="text-xs font-medium whitespace-nowrap">{cuisine}</span>
          </motion.button>
        ))}
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
  const [viewMode, setViewMode] = useState<"list" | "gallery">("list");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<"rating" | "fastest" | "popular">("rating");
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

        // Add some mock discounts for demo (remove in production)
        const discounts = ["20% OFF", "Free Delivery", "BOGO", null, null, "15% OFF"];

        const transformedRestaurants: Restaurant[] = typedRestaurantsData
          .map((restaurant, index) => ({
            id: restaurant.id,
            name: restaurant.name,
            description: restaurant.description,
            logo_url: restaurant.logo_url,
            rating: parseFloat(String(restaurant.rating)) || 0,
            total_orders: restaurant.total_orders || 0,
            meal_count: mealCounts[restaurant.id] || 0,
            cuisine_types: restaurant.cuisine_types || [],
            is_featured: index % 5 === 0, // Mock featured status based on index
            delivery_time: `${20 + Math.floor(Math.random() * 25)}-${45 + Math.floor(Math.random() * 15)} min`,
            discount: discounts[index % discounts.length],
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
  }, []);

  const hasActiveFilters = searchQuery || showFavoritesOnly || selectedCuisine || activeSort !== "rating";

  return (
    <div className="min-h-screen bg-background">
      {/* Native Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="px-4 h-14 flex items-center justify-between">
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
            <h1 className="text-lg font-bold">Restaurants</h1>
          </div>
          <div className="flex items-center gap-1">
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                className={`w-10 h-10 rounded-full relative ${
                  showFavoritesOnly ? "bg-rose-100 text-rose-500" : "hover:bg-muted"
                }`}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Heart className={`w-5 h-5 ${showFavoritesOnly ? "fill-current" : ""}`} />
              </Button>
            </motion.div>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 pb-28">
        {/* Greeting */}
        <motion.div 
          className="mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Leaf className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Discover</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            Healthy Meals
            <span className="text-muted-foreground font-normal"> Near You</span>
          </h2>
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
            className="pl-12 pr-10 h-12 rounded-xl bg-muted border-0 text-base focus-visible:ring-2 focus-visible:ring-primary"
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
            active={activeSort === "rating"}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setActiveSort("rating");
            }}
            icon={Star}
            label="Top Rated"
            color="amber"
          />
          
          <FilterChip
            active={activeSort === "fastest"}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setActiveSort("fastest");
            }}
            icon={Clock}
            label="Fastest"
            color="blue"
          />
          
          <FilterChip
            active={showFavoritesOnly}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setShowFavoritesOnly(!showFavoritesOnly);
            }}
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
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredRestaurants.length}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <motion.button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "list" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <List className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={() => setViewMode("gallery")}
              className={`p-2 rounded-md transition-all ${
                viewMode === "gallery" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <LayoutGrid className="w-4 h-4" />
            </motion.button>
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
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              Clear all
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}

        {/* Restaurant Grid */}
        <div className={`${viewMode === "gallery" ? "grid grid-cols-2 gap-3" : "space-y-3"}`}>
          {loading ? (
            // Skeleton Loading
            Array.from({ length: 6 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} viewMode={viewMode} />
            ))
          ) : filteredRestaurants.length === 0 ? (
            // Empty State
            <motion.div 
              className="py-16 text-center col-span-full"
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
          ) : viewMode === "gallery" ? (
            // Gallery View
            filteredRestaurants.map((restaurant, index) => (
              <RestaurantGalleryCard
                key={restaurant.id}
                restaurant={restaurant}
                isFavorite={isFavorite(restaurant.id)}
                onToggleFavorite={toggleFavorite}
                index={index}
              />
            ))
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
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        restaurantCount={filteredRestaurants.length}
        activeSort={activeSort}
        onChangeSort={setActiveSort}
      />
    </div>
  );
};

export default Meals;
