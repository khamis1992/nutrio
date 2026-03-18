import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
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
  LayoutGrid,
  ArrowLeft,
  Sprout,
  Dumbbell,
  Scale,
  Coffee,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { motion, AnimatePresence } from "framer-motion";
import { getRestaurantImage } from "@/lib/meal-images";
import { Haptics } from "@/lib/haptics";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";

import { useLanguage } from "@/contexts/LanguageContext";
import { NavChevronRight } from "@/components/ui/nav-chevron";

// Cuisine name to translation key mapping
const getCuisineTranslationKey = (cuisine: string): string => {
  const keyMap: Record<string, string> = {
    "Healthy": "cuisine_healthy",
    "Vegetarian": "cuisine_vegetarian",
    "Vegan": "cuisine_vegan",
    "Keto": "cuisine_keto",
    "Protein": "cuisine_protein",
    "Low Carb": "cuisine_low_carb",
    "Breakfast": "cuisine_breakfast",
  };
  return keyMap[cuisine] || cuisine;
};

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

interface MealResult {
  id: string;
  name: string;
  calories: number | null;
  image_url: string | null;
  restaurant_id: string | null;
  is_available: boolean | null;
  restaurant_name: string;
  restaurant_logo_url: string | null;
  restaurant_rating: number;
  restaurant_total_orders: number;
}

type CalorieRange = "all" | "under300" | "300-500" | "500-700" | "700plus";

const cuisineEmojis: Record<string, string> = {
  "Healthy": "🥗",
  "Vegetarian": "🥬",
  "Vegan": "🌱",
  "Keto": "🥑",
  "Protein": "💪",
  "Low Carb": "🥗",
  "Breakfast": "🍳",
};

// Cuisine icon map — used by CuisineScroller
const cuisineIconMap: Record<string, React.ElementType> = {
  "Healthy": Heart,
  "Vegetarian": Leaf,
  "Vegan": Sprout,
  "Keto": Flame,
  "Protein": Dumbbell,
  "Low Carb": Scale,
  "Breakfast": Coffee,
};

// Cuisine icon color map
const cuisineIconColor: Record<string, string> = {
  "Healthy": "text-rose-500",
  "Vegetarian": "text-green-500",
  "Vegan": "text-emerald-500",
  "Keto": "text-orange-500",
  "Protein": "text-blue-500",
  "Low Carb": "text-purple-500",
  "Breakfast": "text-amber-500",
};

// Cuisine icon background map
const cuisineIconBg: Record<string, string> = {
  "Healthy": "bg-rose-500/10",
  "Vegetarian": "bg-green-500/10",
  "Vegan": "bg-emerald-500/10",
  "Keto": "bg-orange-500/10",
  "Protein": "bg-blue-500/10",
  "Low Carb": "bg-purple-500/10",
  "Breakfast": "bg-amber-500/10",
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
  const { t } = useLanguage();

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
                  {restaurant.description || t("healthy_and_delicious")}
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
                    {(restaurant.delivery_time && restaurant.delivery_time !== "0" && restaurant.delivery_time !== "0m") ? restaurant.delivery_time : "25-40 min"}
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
              <NavChevronRight className="w-4 h-4" />
            </div>
          </div>
          
        </div>
      </Link>
    </motion.div>
  );
};

const MealListCard = ({
  meal,
  isFavoriteRestaurant,
  onToggleFavorite,
  index,
}: {
  meal: MealResult;
  isFavoriteRestaurant: boolean;
  onToggleFavorite: (id: string, name: string) => void;
  index: number;
}) => {
  const { t } = useLanguage();
  const handleFavoriteClick = (e: React.MouseEvent) => {
    if (!meal.restaurant_id) return;
    e.preventDefault();
    e.stopPropagation();
    Haptics.impact({ style: "medium" });
    onToggleFavorite(meal.restaurant_id, meal.restaurant_name);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, ...springConfig }}
      whileTap={{ scale: 0.98 }}
    >
      <Link to={`/meals/${meal.id}`}>
        <div className="group bg-card/95 rounded-3xl overflow-hidden border border-border/70 shadow-md hover:shadow-lg transition-all backdrop-blur-sm">
          <div className="flex p-3 gap-3">
            <div className="relative w-24 h-24 shrink-0">
              <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/10">
                <img
                  src={meal.image_url || getRestaurantImage(meal.restaurant_logo_url, meal.restaurant_id || meal.id)}
                  alt={meal.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>

              {meal.restaurant_id && (
                <motion.button
                  onClick={handleFavoriteClick}
                  className="absolute top-1 right-1 w-8 h-8 rounded-full bg-background/95 shadow-md flex items-center justify-center border border-border/70 backdrop-blur-sm"
                  whileTap={{ scale: 0.85 }}
                >
                  <Heart
                    className={`w-4 h-4 transition-colors ${
                      isFavoriteRestaurant
                        ? "fill-rose-500 text-rose-500"
                        : "text-muted-foreground"
                    }`}
                  />
                </motion.button>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="font-semibold text-base leading-tight line-clamp-1 text-foreground">
                  {meal.name}
                </h3>
                <p className="text-xs font-semibold text-primary mt-1 line-clamp-1">
                  {meal.restaurant_name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {meal.is_available === false ? t("currently_unavailable") : t("available_now")}
                </p>
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                    <Flame className="w-3 h-3 text-orange-600" />
                    <span className="text-xs font-semibold">{meal.calories ?? 0} cal</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span className="text-xs font-semibold">{meal.restaurant_rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="self-center pr-1 text-muted-foreground/60 group-hover:text-primary transition-colors">
                  <NavChevronRight className="w-4 h-4" />
                </div>
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
  resultCount,
  resultLabel,
  activeSort,
  onChangeSort,
  calorieRange,
  onChangeCalorieRange,
  t
}: {
  isOpen: boolean;
  onClose: () => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  resultCount: number;
  resultLabel: "restaurants" | "meals";
  activeSort: "rating" | "fastest" | "popular";
  onChangeSort: (sort: "rating" | "fastest" | "popular") => void;
  calorieRange: CalorieRange;
  onChangeCalorieRange: (range: CalorieRange) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) => {
  const handleSortChange = (sort: "rating" | "fastest" | "popular") => {
    Haptics.impact({ style: "light" });
    onChangeSort(sort);
  };

  const handleFavoritesToggle = () => {
    Haptics.impact({ style: "medium" });
    onToggleFavorites();
  };

  const handleCalorieRangeChange = (range: CalorieRange) => {
    Haptics.impact({ style: "light" });
    onChangeCalorieRange(range);
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
            className="fixed left-0 right-0 bg-card rounded-t-3xl z-50 overflow-hidden flex flex-col"
            style={{ bottom: '64px', maxHeight: "calc(85vh - 64px)" }}
          >
            {/* Drag Handle */}
            <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
              <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
            </div>
            
            {/* Scrollable Content */}
            <div className="px-5 overflow-y-auto flex-1">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{t("filters")}</h3>
                  <p className="text-sm text-muted-foreground">{resultCount} {resultLabel}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <SlidersHorizontal className="w-6 h-6 text-primary" />
                </div>
              </div>
              
              {/* Sort Options */}
              <div className="mb-6">
              <label className="text-sm font-semibold text-foreground mb-3 block">
                  {t("sort_by")}
                </label>
                <div className="flex gap-2 flex-wrap">
{[
                    { id: "rating", icon: Star, label: t("top_rated_filter") },
                    { id: "fastest", icon: Clock, label: t("fastest_filter") },
                    { id: "popular", icon: Flame, label: t("popular") },
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

              {/* Calorie Range Filter */}
              <div className="mb-6">
<label className="text-sm font-semibold text-foreground mb-3 block">
                  {t("filter_by_calories")}
                </label>
                <div className="flex gap-2 flex-wrap">
{[
                    { id: "all", label: t("all_cuisine") },
                    { id: "under300", label: t("under_300") },
                    { id: "300-500", label: t("range_300_500") },
                    { id: "500-700", label: t("range_500_700") },
                    { id: "700plus", label: t("over_700") },
                  ].map((range) => (
                    <motion.button
                      key={range.id}
                      onClick={() => handleCalorieRangeChange(range.id as CalorieRange)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all ${
                        calorieRange === range.id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Flame className={`w-4 h-4 ${
                        calorieRange === range.id ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className="text-sm font-medium">{range.label}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Favorites Toggle */}
              <div className="mb-6">
<label className="text-sm font-semibold text-foreground mb-3 block">
                  {t("other_filters")}
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
                      <span className="font-semibold block text-foreground">{t("favorites_only")}</span>
                      <span className="text-xs text-muted-foreground">{t("favorites_only_desc")}</span>
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
            </div>

            {/* Fixed Button at Bottom */}
            <div className="px-5 pt-4 pb-6 border-t border-border bg-card flex-shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <Button 
                onClick={onClose}
                className="w-full h-12 rounded-xl font-semibold text-base bg-primary hover:bg-primary/90"
              >
                {t("show_results")} {resultCount} {resultLabel === "restaurants" ? t("restaurants") : t("meals")}
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
// CUISINE HORIZONTAL SCROLL - CIRCULAR NATIVE STYLE
// ============================================
const CuisineScroller = ({ 
  selectedCuisine, 
  onSelectCuisine,
  t,
  loading = false,
}: { 
  selectedCuisine: string | null;
  onSelectCuisine: (cuisine: string | null) => void;
  t: ReturnType<typeof useLanguage>["t"];
  loading?: boolean;
}) => {
  const cuisines = Object.keys(cuisineEmojis);
  const isAllActive = selectedCuisine === null;

  return (
    <div className="-mx-4 px-4">
      <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
        {/* All */}
        <motion.button
          onClick={() => !loading && onSelectCuisine(null)}
          whileTap={{ scale: loading ? 1 : 0.92 }}
          className={`flex-shrink-0 flex flex-col items-center gap-1.5 ${loading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${
            isAllActive
              ? "border-primary bg-primary/10 shadow-md shadow-primary/20"
              : "border-border/40 bg-card/90"
          }`}>
            <LayoutGrid className={`w-6 h-6 ${isAllActive ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <span className={`text-[11px] font-semibold whitespace-nowrap leading-tight ${
            isAllActive ? "text-primary" : "text-muted-foreground"
          }`}>
            {t("all_cuisine")}
          </span>
        </motion.button>

        {cuisines.map((cuisine) => {
          const isActive = selectedCuisine === cuisine;
          const Icon = cuisineIconMap[cuisine];
          const iconColor = cuisineIconColor[cuisine] ?? "text-muted-foreground";
          const iconBg = cuisineIconBg[cuisine] ?? "bg-muted";
          return (
            <motion.button
              key={cuisine}
              onClick={() => !loading && onSelectCuisine(cuisine)}
              whileTap={{ scale: loading ? 1 : 0.92 }}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 ${loading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all ${
                isActive
                  ? `border-primary ${iconBg} shadow-md shadow-primary/20`
                  : `border-border/40 ${iconBg}`
              }`}>
                {Icon ? (
                  <Icon className={`w-6 h-6 ${isActive ? "text-primary" : iconColor}`} />
                ) : (
                  <span className="text-2xl">{cuisineEmojis[cuisine]}</span>
                )}
              </div>
              <span className={`text-[11px] font-semibold whitespace-nowrap leading-tight ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}>
                {t(getCuisineTranslationKey(cuisine) as any)}
              </span>
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
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [meals, setMeals] = useState<MealResult[]>([]);
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
  const [calorieRange, setCalorieRange] = useState<CalorieRange>("all");
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();

  // Handle favorite toggle with login check
  const handleToggleFavorite = useCallback((restaurantId: string, restaurantName: string) => {
    if (!user) {
      promptLogin({
        title: t("save_your_favorites"),
        description: t("save_favorites_desc"),
        actionLabel: t("sign_in"),
        signUpLabel: t("create_free_account")
      });
      return;
    }
    toggleFavorite(restaurantId, restaurantName);
  }, [user, toggleFavorite, promptLogin]);

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
        let transformedMeals: MealResult[] = [];
        
        if (restaurantIds.length > 0) {
          const { data: mealsData } = await supabase
            .from("meals")
            .select("id, name, calories, image_url, restaurant_id, is_available")
            .in("restaurant_id", restaurantIds);
          
          const typedMealsData = (mealsData || []) as Array<{
            id: string;
            name: string;
            calories: number | null;
            image_url: string | null;
            restaurant_id: string | null;
            is_available: boolean | null;
          }>;

          mealCounts = typedMealsData.reduce((acc: Record<string, number>, meal) => {
            if (!meal.restaurant_id) return acc;
            const restaurantId = meal.restaurant_id;
            acc[restaurantId] = (acc[restaurantId] || 0) + 1;
            return acc;
          }, {});

          const restaurantsById = new Map(typedRestaurantsData.map((r) => [r.id, r]));
          transformedMeals = typedMealsData.map((meal) => {
            const parentRestaurant = meal.restaurant_id ? restaurantsById.get(meal.restaurant_id) : null;
            return {
              id: meal.id,
              name: meal.name,
              calories: meal.calories,
              image_url: meal.image_url,
              restaurant_id: meal.restaurant_id,
              is_available: meal.is_available,
              restaurant_name: parentRestaurant?.name || "Restaurant",
              restaurant_logo_url: parentRestaurant?.logo_url || null,
              restaurant_rating: parseFloat(String(parentRestaurant?.rating || 0)) || 0,
              restaurant_total_orders: parentRestaurant?.total_orders || 0,
            };
          });
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
        setMeals(transformedMeals);
      } catch (err) {
        console.error("Error fetching restaurants:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurants();
  }, []);

  const isCalorieFilterActive = calorieRange !== "all";

  const filteredMeals = useMemo(() => {
    let result = [...meals];

    if (showFavoritesOnly) {
      result = result.filter((m) => (m.restaurant_id ? favoriteIds.has(m.restaurant_id) : false));
    }

    if (selectedCuisine) {
      const selected = selectedCuisine.toLowerCase();
      result = result.filter((meal) => {
        const restaurant = restaurants.find((r) => r.id === meal.restaurant_id);
        return !!restaurant?.cuisine_types?.some((c) => c.toLowerCase() === selected);
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (meal) =>
          meal.name.toLowerCase().includes(query) ||
          meal.restaurant_name.toLowerCase().includes(query)
      );
    }

    if (calorieRange !== "all") {
      result = result.filter((meal) => {
        const calories = meal.calories ?? 0;
        switch (calorieRange) {
          case "under300":
            return calories < 300;
          case "300-500":
            return calories >= 300 && calories <= 500;
          case "500-700":
            return calories > 500 && calories <= 700;
          case "700plus":
            return calories > 700;
          default:
            return true;
        }
      });
    }

    switch (activeSort) {
      case "rating":
        result.sort((a, b) => b.restaurant_rating - a.restaurant_rating);
        break;
      case "popular":
        result.sort((a, b) => b.restaurant_total_orders - a.restaurant_total_orders);
        break;
      case "fastest":
        result.sort((a, b) => (a.calories ?? 0) - (b.calories ?? 0));
        break;
    }

    return result;
  }, [meals, showFavoritesOnly, favoriteIds, selectedCuisine, searchQuery, calorieRange, activeSort, restaurants]);

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
    setCalorieRange("all");
  }, []);

  const hasActiveFilters = searchQuery || showFavoritesOnly || selectedCuisine || activeSort !== "rating" || calorieRange !== "all";
  const displayedCount = isCalorieFilterActive ? filteredMeals.length : filteredRestaurants.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Native Header — title row + sticky search */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-border/30 pt-safe">
        {/* Title row */}
        <div className="px-4 pt-[env(safe-area-inset-top)] h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 rtl:flex-row-reverse">
            <Link to="/dashboard">
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-9 h-9 rounded-full hover:bg-muted"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </motion.div>
            </Link>
            <h1 className="text-base font-bold tracking-tight">{t("meals")}</h1>
          </div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className={`w-9 h-9 rounded-full relative ${
                activeChip === "favorites" ? "bg-rose-100 text-rose-500" : "hover:bg-muted"
              }`}
              onClick={() => selectChip(activeChip === "favorites" ? "rating" : "favorites")}
            >
              <Heart className={`w-5 h-5 ${activeChip === "favorites" ? "fill-current" : ""}`} />
            </Button>
          </motion.div>
        </div>

        {/* Search row — always visible */}
        <div className="px-4 pb-3">
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
            <Input
              placeholder={t("search_restaurants_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-10 rounded-xl bg-muted/60 border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-none"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/25 flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 pb-28">
        {/* Cuisine Circular Scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4"
        >
          <CuisineScroller
            selectedCuisine={selectedCuisine}
            onSelectCuisine={setSelectedCuisine}
            t={t}
            loading={loading}
          />
        </motion.div>

        {/* Quick Filter Chips */}
        <motion.div 
          className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide mb-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
        >
          <FilterChip
            active={filterSheetOpen}
            onClick={() => {
              Haptics.impact({ style: "light" });
              setFilterSheetOpen(true);
            }}
            icon={SlidersHorizontal}
            label={t("filters")}
            color="primary"
          />
          <FilterChip
            active={activeChip === "rating"}
            onClick={() => selectChip("rating")}
            icon={Star}
            label={t("top_rated_filter")}
            color="amber"
          />
          <FilterChip
            active={activeChip === "fastest"}
            onClick={() => selectChip("fastest")}
            icon={Clock}
            label={t("fastest_filter")}
            color="blue"
          />
          <FilterChip
            active={activeChip === "favorites"}
            onClick={() => selectChip("favorites")}
            icon={Heart}
            label={t("favorites_filter")}
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
              {isCalorieFilterActive
                ? (showFavoritesOnly ? t("favorite_meals") : t("filtered_meals"))
                : (showFavoritesOnly ? t("your_favorites") : t("all_restaurants"))}
            </h2>
            <span className="text-xs text-muted-foreground bg-card/90 border border-border/70 px-2 py-0.5 rounded-full">
              {displayedCount}
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
            <span className="text-xs text-muted-foreground">{t("active_filters")}</span>
            <button
              onClick={clearFilters}
className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
            >
              {t("clear_all_filters")}
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}

        {/* Results List */}
        <div className="space-y-3">
          {loading ? (
            // Skeleton Loading
            Array.from({ length: 6 }).map((_, i) => (
              <RestaurantCardSkeleton key={i} />
            ))
          ) : displayedCount === 0 ? (
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
                {isCalorieFilterActive
                  ? (showFavoritesOnly ? t("no_favorite_meals") : t("no_meals_found"))
                  : (showFavoritesOnly ? t("no_favorites_yet") : t("no_restaurants_found"))}
              </h3>
<p className="text-sm text-muted-foreground mb-4 px-8">
                {isCalorieFilterActive
                  ? t("try_adjust_search")
                  : showFavoritesOnly
                    ? t("favorites_empty_hint")
                    : t("try_adjust_search")}
              </p>
              {hasActiveFilters && (
                <Button 
                  onClick={clearFilters}
                  variant="outline"
                  className="rounded-full"
>
                  {t("clear_all_filters")}
                </Button>
              )}
            </motion.div>
          ) : isCalorieFilterActive ? (
            filteredMeals.map((meal, index) => (
              <MealListCard
                key={meal.id}
                meal={meal}
                isFavoriteRestaurant={meal.restaurant_id ? isFavorite(meal.restaurant_id) : false}
                onToggleFavorite={handleToggleFavorite}
                index={index}
              />
            ))
          ) : (
            filteredRestaurants.map((restaurant, index) => (
              <RestaurantListCard
                key={restaurant.id}
                restaurant={restaurant}
                isFavorite={isFavorite(restaurant.id)}
                onToggleFavorite={handleToggleFavorite}
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
        resultCount={displayedCount}
        resultLabel={isCalorieFilterActive ? "meals" : "restaurants"}
        activeSort={activeSort}
        onChangeSort={(sort) => { 
          if (sort !== "popular") {
            setActiveSort(sort as "rating" | "fastest"); 
            setActiveChip(sort as "rating" | "fastest" | "favorites"); 
          }
          setShowFavoritesOnly(false); 
        }}
        calorieRange={calorieRange}
        onChangeCalorieRange={setCalorieRange}
        t={t}
      />

      {/* Guest Login Prompt */}
      <GuestLoginPrompt
        open={showLoginPrompt}
        onOpenChange={setShowLoginPrompt}
        title={loginPromptConfig.title}
        description={loginPromptConfig.description}
        actionLabel={loginPromptConfig.actionLabel}
        signUpLabel={loginPromptConfig.signUpLabel}
      />
    </div>
  );
};

export default Meals;
