import { useState, useEffect, useMemo } from "react";
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
  ArrowUpRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Haptics } from "@/lib/haptics";
import { CustomerNavigation } from "@/components/CustomerNavigation";

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
};

// Spring animation config for natural feel
const springConfig = {
  type: "spring" as const,
  stiffness: 380,
  damping: 25,
};

const bouncyConfig = {
  type: "spring" as const,
  stiffness: 400,
  damping: 17,
};

// ============================================
// ENHANCED SKELETON LOADING STATES
// ============================================
const RestaurantCardSkeleton = ({ viewMode }: { viewMode: "list" | "gallery" }) => {
  if (viewMode === "gallery") {
    return (
      <div className="relative">
        <div className="aspect-[4/5] rounded-3xl bg-gradient-to-br from-emerald-100/50 via-teal-50/50 to-green-100/50 overflow-hidden">
          <motion.div
            className="w-full h-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="mt-3 space-y-2 px-1">
          <div className="h-4 bg-emerald-100/60 rounded-full w-2/3" />
          <div className="h-3 bg-emerald-50/60 rounded-full w-1/2" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-100/60 to-teal-50/60 shrink-0 overflow-hidden">
          <motion.div
            className="w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 bg-emerald-100/60 rounded-full w-3/4" />
          <div className="h-3 bg-emerald-50/60 rounded-full w-full" />
          <div className="flex gap-3 pt-1">
            <div className="h-3 bg-emerald-50/60 rounded-full w-16" />
            <div className="h-3 bg-emerald-50/60 rounded-full w-16" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ENHANCED LIST CARD WITH MICRO-INTERACTIONS
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
  const [isPressed, setIsPressed] = useState(false);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    Haptics.impact({ style: "medium" });
    onToggleFavorite(restaurant.id, restaurant.name);
  };

  const cuisineEmoji = cuisineEmojis[restaurant.cuisine_types?.[0] || ""] || "🍽️";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.06,
        ...springConfig
      }}
      whileTap={{ scale: 0.97 }}
    >
      <Link to={`/restaurant/${restaurant.id}`}>
        <motion.div
          className="group bg-white rounded-2xl shadow-sm overflow-hidden border border-emerald-100/50"
          whileHover={{ scale: 1.01 }}
          transition={springConfig}
          onTapStart={() => setIsPressed(true)}
          onTap={() => setIsPressed(false)}
        >
          <div className="flex p-3 gap-3">
            {/* Image Section with Organic Shape */}
            <div className="relative w-28 h-28 shrink-0">
              <motion.div 
                className="w-full h-full rounded-2xl overflow-hidden"
                animate={{ borderRadius: isPressed ? "24px" : "16px" }}
                transition={springConfig}
              >
                {restaurant.logo_url ? (
                  <img 
                    src={restaurant.logo_url} 
                    alt={restaurant.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl bg-gradient-to-br from-emerald-50 via-teal-50 to-green-50">
                    {cuisineEmoji}
                  </div>
                )}
              </motion.div>
              
              {/* Floating Rating Badge */}
              <motion.div 
                className="absolute -top-2 -right-2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-0.5"
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: index * 0.06 + 0.2, ...bouncyConfig }}
              >
                <Star className="w-3 h-3 fill-white" />
                {restaurant.rating.toFixed(1)}
              </motion.div>

              {/* Favorite Button with Heart Animation */}
              <motion.button
                onClick={handleFavoriteClick}
                className="absolute bottom-2 left-2 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-md"
                whileTap={{ scale: 0.8 }}
                whileHover={{ scale: 1.1 }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isFavorite ? "filled" : "empty"}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={bouncyConfig}
                  >
                    <Heart 
                      className={`w-5 h-5 ${
                        isFavorite 
                          ? "fill-rose-500 text-rose-500" 
                          : "text-gray-400"
                      }`} 
                    />
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </div>

            {/* Content Section */}
            <div className="flex-1 flex flex-col justify-between py-0.5">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-base leading-tight line-clamp-1 flex-1 text-gray-800">
                    {restaurant.name}
                  </h3>
                </div>
                
                {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
                  <motion.p 
                    className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 + 0.1 }}
                  >
                    <Leaf className="w-3 h-3" />
                    {restaurant.cuisine_types[0]}
                  </motion.p>
                )}
                
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                  {restaurant.description || "Healthy & delicious meals"}
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                  <motion.span 
                    className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full"
                    whileHover={{ backgroundColor: "#d1fae5" }}
                  >
                    <Clock className="w-3 h-3" />
                    {restaurant.delivery_time || "25-40 min"}
                  </motion.span>
                  
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                    FREE DELIVERY
                  </span>
                </div>
                
                <motion.div 
                  className="flex items-center gap-1 bg-gradient-to-r from-emerald-50 to-teal-50 px-2 py-1 rounded-full"
                  whileHover={{ scale: 1.05 }}
                >
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-700">{restaurant.meal_count}</span>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
};

// ============================================
// ENHANCED GALLERY CARD WITH ORGANIC AESTHETIC
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        delay: index * 0.05,
        ...springConfig
      }}
      whileTap={{ scale: 0.95 }}
    >
      <Link to={`/restaurant/${restaurant.id}`}>
        <div className="group relative">
          {/* Organic Shape Image Container */}
          <motion.div 
            className="relative aspect-[4/5] overflow-hidden"
            style={{ borderRadius: "24px" }}
            whileHover={{ borderRadius: "32px" }}
            transition={springConfig}
          >
            {/* Background */}
            {restaurant.logo_url ? (
              <motion.img 
                src={restaurant.logo_url} 
                alt={restaurant.name}
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.08 }}
                transition={{ duration: 0.6 }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-emerald-100 via-teal-50 to-green-100">
                {cuisineEmoji}
              </div>
            )}
            
            {/* Organic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-900/30 to-transparent" />
            
            {/* Floating Elements */}
            <motion.div 
              className="absolute top-3 right-3"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.05 + 0.1, ...bouncyConfig }}
            >
              <motion.button
                onClick={handleFavoriteClick}
                className="w-11 h-11 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30"
                whileTap={{ scale: 0.85 }}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.4)" }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isFavorite ? "filled" : "empty"}
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 45 }}
                    transition={bouncyConfig}
                  >
                    <Heart 
                      className={`w-5 h-5 ${
                        isFavorite 
                          ? "fill-rose-500 text-rose-500" 
                          : "text-white"
                      }`} 
                    />
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </motion.div>

            {/* Rating Badge */}
            <motion.div 
              className="absolute top-3 left-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-full shadow-lg"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.15, ...springConfig }}
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-xs font-bold text-gray-800">{restaurant.rating.toFixed(1)}</span>
            </motion.div>

            {/* Meal Count Badge */}
            <motion.div
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 + 0.2, ...springConfig }}
            >
              {restaurant.meal_count} meals
            </motion.div>

            {/* Bottom Content */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <motion.h3 
                className="font-bold text-white text-base leading-tight line-clamp-1 mb-2"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 + 0.1 }}
              >
                {restaurant.name}
              </motion.h3>
              
              <motion.div 
                className="flex items-center justify-between"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 + 0.15 }}
              >
                <div className="flex items-center gap-2 text-white/80 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{restaurant.delivery_time || "25-40 min"}</span>
                </div>
                
                {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
                  <span className="text-xs font-medium text-emerald-200 bg-emerald-800/50 px-2 py-1 rounded-full">
                    {restaurant.cuisine_types[0]}
                  </span>
                )}
              </motion.div>
            </div>

            {/* Hover Arrow Indicator */}
            <motion.div
              className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              initial={{ opacity: 0, scale: 0 }}
              whileHover={{ opacity: 1, scale: 1 }}
              transition={springConfig}
            >
              <ArrowUpRight className="w-4 h-4 text-white" />
            </motion.div>
          </motion.div>
        </div>
      </Link>
    </motion.div>
  );
};

// ============================================
// ORGANIC BOTTOM SHEET FILTER
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
          {/* Backdrop with organic blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-emerald-950/30 backdrop-blur-sm z-50"
          />
          
          {/* Sheet with organic curve */}
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
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-50 overflow-hidden"
            style={{ 
              boxShadow: "0 -10px 40px rgba(0,0,0,0.15)",
              maxHeight: "85vh"
            }}
          >
            {/* Drag Handle */}
            <div className="pt-4 pb-2 flex justify-center">
              <motion.div 
                className="w-12 h-1.5 bg-gray-300 rounded-full"
                whileHover={{ scale: 1.2 }}
              />
            </div>
            
            <div className="px-6 pb-8 overflow-y-auto max-h-[calc(85vh-60px)]">
              {/* Header */}
              <motion.div 
                className="flex items-center justify-between mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Discover</h3>
                  <p className="text-sm text-gray-400">{restaurantCount} restaurants</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                  <SlidersHorizontal className="w-6 h-6 text-emerald-600" />
                </div>
              </motion.div>
              
              {/* Sort Options */}
              <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <label className="text-sm font-semibold text-gray-700 mb-3 block">
                  Sort by
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: "rating", icon: Star, label: "Top Rated", color: "amber" },
                    { id: "fastest", icon: Clock, label: "Fastest", color: "emerald" },
                    { id: "popular", icon: Flame, label: "Popular", color: "orange" },
                  ].map((sort) => (
                    <motion.button
                      key={sort.id}
                      onClick={() => handleSortChange(sort.id as typeof activeSort)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                        activeSort === sort.id
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-gray-100 bg-gray-50 text-gray-600"
                      }`}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <sort.icon className={`w-4 h-4 ${
                        activeSort === sort.id ? "text-emerald-600" : "text-gray-400"
                      }`} />
                      <span className="text-sm font-semibold">{sort.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* View Mode Toggle */}
              <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <label className="text-sm font-semibold text-gray-700 mb-3 block">
                  View Style
                </label>
                <div className="flex gap-3 bg-gray-100 p-1.5 rounded-2xl">
                  <motion.button
                    onClick={() => handleViewModeChange("list")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                      viewMode === "list"
                        ? "bg-white shadow-md text-emerald-600"
                        : "text-gray-500"
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <List className="w-5 h-5" />
                    <span className="text-sm font-semibold">List</span>
                  </motion.button>
                  <motion.button
                    onClick={() => handleViewModeChange("gallery")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                      viewMode === "gallery"
                        ? "bg-white shadow-md text-emerald-600"
                        : "text-gray-500"
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LayoutGrid className="w-5 h-5" />
                    <span className="text-sm font-semibold">Grid</span>
                  </motion.button>
                </div>
              </motion.div>

              {/* Favorites Toggle */}
              <motion.div 
                className="mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <label className="text-sm font-semibold text-gray-700 mb-3 block">
                  Filters
                </label>
                <motion.button
                  onClick={handleFavoritesToggle}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                    showFavoritesOnly
                      ? "border-rose-400 bg-gradient-to-r from-rose-50 to-pink-50"
                      : "border-gray-100 bg-gray-50"
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        showFavoritesOnly ? "bg-rose-100" : "bg-gray-200"
                      }`}
                      animate={{ rotate: showFavoritesOnly ? [0, -10, 10, 0] : 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Heart className={`w-6 h-6 ${showFavoritesOnly ? "fill-rose-500 text-rose-500" : "text-gray-500"}`} />
                    </motion.div>
                    <div className="text-left">
                      <span className="font-bold block text-gray-800">Favorites Only</span>
                      <span className="text-xs text-gray-400">Show only saved restaurants</span>
                    </div>
                  </div>
                  <motion.div 
                    className={`w-14 h-8 rounded-full p-1 transition-colors ${
                      showFavoritesOnly ? "bg-rose-500" : "bg-gray-300"
                    }`}
                    layout
                  >
                    <motion.div 
                      className="w-6 h-6 bg-white rounded-full shadow-md"
                      animate={{ x: showFavoritesOnly ? 24 : 0 }}
                      transition={springConfig}
                    />
                  </motion.div>
                </motion.button>
              </motion.div>

              {/* Apply Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Button 
                  onClick={onClose}
                  className="w-full h-14 rounded-2xl font-bold text-base bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
                >
                  Show {restaurantCount} Restaurants
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ============================================
// ORGANIC CHIP COMPONENT
// ============================================
const FilterChip = ({ 
  active, 
  onClick, 
  icon: Icon, 
  label,
  color = "emerald"
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType; 
  label: string;
  color?: "emerald" | "amber" | "rose" | "blue";
}) => {
  const colorClasses = {
    emerald: {
      active: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30",
      inactive: "bg-white text-gray-600 border border-gray-200"
    },
    amber: {
      active: "bg-amber-500 text-white shadow-lg shadow-amber-500/30",
      inactive: "bg-white text-gray-600 border border-gray-200"
    },
    rose: {
      active: "bg-rose-500 text-white shadow-lg shadow-rose-500/30",
      inactive: "bg-white text-gray-600 border border-gray-200"
    },
    blue: {
      active: "bg-blue-500 text-white shadow-lg shadow-blue-500/30",
      inactive: "bg-white text-gray-600 border border-gray-200"
    }
  };

  return (
    <motion.button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full shrink-0 transition-all ${
        active ? colorClasses[color].active : colorClasses[color].inactive
      }`}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.02 }}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-semibold">{label}</span>
    </motion.button>
  );
};

// ============================================
// MAIN MEALS COMPONENT
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
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();
  const { scrollY } = useScroll();
  
  const headerOpacity = useTransform(scrollY, [0, 100], [0, 1]);
  const headerY = useTransform(scrollY, [0, 100], [0, 0]);

  // Track scroll for header effects
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
            total_orders
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
  }, [restaurants, searchQuery, showFavoritesOnly, favoriteIds, activeSort]);

  const clearFilters = () => {
    setSearchQuery("");
    setShowFavoritesOnly(false);
    setActiveSort("rating");
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      
      {/* Sticky Header with Organic Blur */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-40"
        style={{ y: headerY }}
      >
        <motion.div 
          className="bg-white/80 backdrop-blur-xl border-b border-emerald-100/50"
          initial={{ opacity: 0 }}
          style={{ opacity: headerOpacity }}
        >
          <div className="px-4 h-16 flex items-center gap-3">
            <Link to="/dashboard">
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0 w-11 h-11 rounded-full hover:bg-emerald-100/50"
                >
                  <ChevronLeft className="w-5 h-5 text-emerald-700" />
                </Button>
              </motion.div>
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-800">Restaurants</h1>
              <p className="text-xs text-emerald-600 font-medium">
                {filteredRestaurants.length} healthy choices
              </p>
            </div>
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                className={`shrink-0 w-11 h-11 rounded-full relative ${
                  showFavoritesOnly ? "bg-rose-100 text-rose-500" : "hover:bg-emerald-100/50"
                }`}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Heart className={`w-5 h-5 ${showFavoritesOnly ? "fill-current" : ""}`} />
                {showFavoritesOnly && (
                  <motion.span 
                    className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={bouncyConfig}
                  />
                )}
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.header>

      <main className="px-4 pt-20 pb-28 relative z-10">
        {/* Hero Section */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Leaf className="w-5 h-5 text-emerald-500" />
            </motion.div>
            <span className="text-sm font-semibold text-emerald-600">Discover</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-800 leading-tight">
            Fresh & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">Healthy</span>
            <br />
            <span className="text-gray-500 font-medium text-2xl">Meals Near You</span>
          </h2>
        </motion.div>

        {/* Enhanced Search Bar */}
        <motion.div 
          className="relative mb-5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <Search className="w-5 h-5 text-emerald-600" />
          </div>
          <Input
            placeholder="Search restaurants, cuisines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-16 pr-14 h-14 rounded-2xl border-2 border-emerald-100 bg-white shadow-lg shadow-emerald-500/5 text-base focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 transition-all"
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Quick Filter Chips */}
        <motion.div 
          className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <FilterChip
            active={filterSheetOpen}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setFilterSheetOpen(true);
            }}
            icon={SlidersHorizontal}
            label="Filters"
            color="emerald"
          />
          
          <FilterChip
            active={activeSort === "rating"}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setActiveSort(activeSort === "rating" ? "rating" : "rating");
            }}
            icon={Star}
            label="Top Rated"
            color="amber"
          />
          
          <FilterChip
            active={activeSort === "fastest"}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setActiveSort(activeSort === "fastest" ? "rating" : "fastest");
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
          className="flex items-center justify-between mb-4 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div>
            <h2 className="font-bold text-lg text-gray-800">
              {showFavoritesOnly ? "Your Favorites" : "All Restaurants"}
            </h2>
            <p className="text-xs text-gray-400">
              {filteredRestaurants.length} {filteredRestaurants.length === 1 ? "place" : "places"} found
            </p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <motion.button
              onClick={() => setViewMode("list")}
              className={`p-2.5 rounded-lg transition-all ${
                viewMode === "list" ? "bg-white shadow-md text-emerald-600" : "text-gray-400"
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <List className="w-4 h-4" />
            </motion.button>
            <motion.button
              onClick={() => setViewMode("gallery")}
              className={`p-2.5 rounded-lg transition-all ${
                viewMode === "gallery" ? "bg-white shadow-md text-emerald-600" : "text-gray-400"
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <LayoutGrid className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>

        {/* Restaurant Grid */}
        <div className={`${viewMode === "gallery" ? "grid grid-cols-2 gap-4" : "space-y-3"}`}>
          {loading ? (
            // Skeleton Loading
            Array.from({ length: 6 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} viewMode={viewMode} />
            ))
          ) : filteredRestaurants.length === 0 ? (
            // Empty State
            <motion.div 
              className="py-16 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring" }}
            >
              <motion.div 
                className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-5"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Store className="w-12 h-12 text-emerald-400" />
              </motion.div>
              <h3 className="font-bold text-xl text-gray-800 mb-2">
                {showFavoritesOnly ? "No favorites yet" : "No restaurants found"}
              </h3>
              <p className="text-sm text-gray-400 mb-5 px-8">
                {showFavoritesOnly 
                  ? "Save your favorite restaurants to find them quickly" 
                  : "Try adjusting your search or filters"}
              </p>
              {(searchQuery || showFavoritesOnly || activeSort !== "rating") && (
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button 
                    onClick={clearFilters}
                    variant="outline"
                    className="rounded-full px-6 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  >
                    Clear all filters
                  </Button>
                </motion.div>
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

      {/* Bottom Navigation - Same as Home page */}
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
