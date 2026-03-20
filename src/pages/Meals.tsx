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
  ChevronRight,
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

const cuisineIconMap: Record<string, React.ElementType> = {
  "Healthy": Heart,
  "Vegetarian": Leaf,
  "Vegan": Sprout,
  "Keto": Flame,
  "Protein": Dumbbell,
  "Low Carb": Scale,
  "Breakfast": Coffee,
};

const cuisineGradients: Record<string, string> = {
  "Healthy":    "from-rose-400 to-pink-500",
  "Vegetarian": "from-green-400 to-emerald-500",
  "Vegan":      "from-emerald-400 to-teal-500",
  "Keto":       "from-orange-400 to-amber-500",
  "Protein":    "from-blue-400 to-indigo-500",
  "Low Carb":   "from-purple-400 to-violet-500",
  "Breakfast":  "from-amber-400 to-yellow-500",
};

const springConfig = { type: "spring" as const, stiffness: 380, damping: 25 };

// ── Skeleton ──────────────────────────────────────────────────────────────────
const CardSkeleton = () => (
  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
    <div className="flex p-3 gap-3">
      <div className="w-24 h-24 rounded-xl bg-gray-100 shrink-0 overflow-hidden relative">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 bg-gray-100 rounded-full w-3/4" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-16 bg-gray-100 rounded-full" />
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
        </div>
      </div>
    </div>
  </div>
);

// ── Restaurant Card — native card with image on top ────────────────────────
const RestaurantCard = ({
  restaurant,
  isFavorite,
  onToggleFavorite,
  index,
}: {
  restaurant: Restaurant;
  isFavorite: boolean;
  onToggleFavorite: (id: string, name: string) => void;
  index: number;
}) => {
  const { t } = useLanguage();
  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    Haptics.impact({ style: "medium" });
    onToggleFavorite(restaurant.id, restaurant.name);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, ...springConfig }}
      whileTap={{ scale: 0.97 }}
    >
      <Link to={`/restaurant/${restaurant.id}`}>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex p-3 gap-3">
            {/* Image */}
            <div className="relative w-24 h-24 shrink-0">
              <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/10">
                <img
                  src={getRestaurantImage(restaurant.logo_url, restaurant.id)}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <motion.button
                onClick={handleFav}
                whileTap={{ scale: 0.8 }}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md"
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
              </motion.button>
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="font-bold text-gray-900 text-[15px] leading-tight line-clamp-1">
                  {restaurant.name}
                </h3>
                {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
                  <p className="text-xs font-semibold text-primary mt-0.5">{restaurant.cuisine_types[0]}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                  {restaurant.description || t("healthy_and_delicious")}
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                {restaurant.rating && restaurant.rating > 0 ? (
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span className="text-xs font-semibold">{restaurant.rating.toFixed(1)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                    <span className="text-xs font-semibold">New</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  <span>{restaurant.delivery_time && restaurant.delivery_time !== "0" && restaurant.delivery_time !== "0m" ? restaurant.delivery_time : "25-40 min"}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 ml-auto">
                  <Utensils className="w-3 h-3" />
                  <span>{restaurant.meal_count}</span>
                </div>
              </div>
            </div>

            <div className="self-center text-gray-300">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// ── Meal Card ────────────────────────────────────────────────────────────────
const MealCard = ({
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
  const handleFav = (e: React.MouseEvent) => {
    if (!meal.restaurant_id) return;
    e.preventDefault();
    e.stopPropagation();
    Haptics.impact({ style: "medium" });
    onToggleFavorite(meal.restaurant_id, meal.restaurant_name);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, ...springConfig }}
      whileTap={{ scale: 0.97 }}
    >
      <Link to={`/meals/${meal.id}`}>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex p-3 gap-3">
            {/* Image */}
            <div className="relative w-24 h-24 shrink-0">
              <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-accent/10">
                <img
                  src={meal.image_url || getRestaurantImage(meal.restaurant_logo_url, meal.restaurant_id || meal.id)}
                  alt={meal.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              {meal.restaurant_id && (
                <motion.button
                  onClick={handleFav}
                  whileTap={{ scale: 0.8 }}
                  className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-md"
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavoriteRestaurant ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
                </motion.button>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
              <div>
                <h3 className="font-bold text-gray-900 text-[15px] leading-tight line-clamp-1">
                  {meal.name}
                </h3>
                <p className="text-xs font-semibold text-primary mt-0.5">{meal.restaurant_name}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                  meal.is_available === false ? "bg-gray-100 text-gray-400" : "bg-green-50 text-green-600"
                }`}>
                  {meal.is_available === false ? t("currently_unavailable") : t("available_now")}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3 text-orange-500" />
                  <span className="text-xs font-semibold">{meal.calories ?? 0} cal</span>
                </div>
                <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-semibold">{meal.restaurant_rating.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="self-center text-gray-300">
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// ── Cuisine Scroller ─────────────────────────────────────────────────────────
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

  return (
    <div className="-mx-4 px-4">
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {/* All */}
        <motion.button
          onClick={() => !loading && onSelectCuisine(null)}
          whileTap={{ scale: 0.9 }}
          className={`flex-shrink-0 flex flex-col items-center gap-1.5 ${loading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
            selectedCuisine === null
              ? "bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/30"
              : "bg-gray-100"
          }`}>
            <LayoutGrid className={`w-6 h-6 ${selectedCuisine === null ? "text-white" : "text-gray-400"}`} />
          </div>
          <span className={`text-[11px] font-semibold whitespace-nowrap ${
            selectedCuisine === null ? "text-primary" : "text-gray-400"
          }`}>
            {t("all_cuisine")}
          </span>
        </motion.button>

        {cuisines.map((cuisine) => {
          const isActive = selectedCuisine === cuisine;
          const Icon = cuisineIconMap[cuisine];
          const gradient = cuisineGradients[cuisine] || "from-gray-400 to-gray-500";

          return (
            <motion.button
              key={cuisine}
              onClick={() => !loading && onSelectCuisine(isActive ? null : cuisine)}
              whileTap={{ scale: 0.9 }}
              className={`flex-shrink-0 flex flex-col items-center gap-1.5 ${loading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                isActive
                  ? `bg-gradient-to-br ${gradient} shadow-lg`
                  : "bg-gray-100"
              }`}>
                {Icon ? (
                  <Icon className={`w-6 h-6 ${isActive ? "text-white" : "text-gray-400"}`} />
                ) : (
                  <span className="text-2xl">{cuisineEmojis[cuisine]}</span>
                )}
              </div>
              <span className={`text-[11px] font-semibold whitespace-nowrap ${
                isActive ? "text-primary" : "text-gray-400"
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

// ── Filter Chip ───────────────────────────────────────────────────────────────
const FilterChip = ({
  active,
  onClick,
  icon: Icon,
  label,
  color = "primary",
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  color?: "primary" | "amber" | "rose" | "blue";
}) => {
  const colorMap = {
    primary: "bg-primary text-white shadow-primary/25",
    amber:   "bg-amber-500 text-white shadow-amber-500/25",
    rose:    "bg-rose-500 text-white shadow-rose-500/25",
    blue:    "bg-blue-500 text-white shadow-blue-500/25",
  };

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full shrink-0 text-sm font-semibold transition-all ${
        active
          ? `${colorMap[color]} shadow-md`
          : "bg-white text-gray-500 border border-gray-200"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </motion.button>
  );
};

// ── Filter Bottom Sheet ───────────────────────────────────────────────────────
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
  t,
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
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="fixed left-0 right-0 bg-white rounded-t-3xl z-50 overflow-hidden flex flex-col"
          style={{ bottom: "64px", maxHeight: "calc(85vh - 64px)" }}
        >
          <div className="pt-3 pb-2 flex justify-center flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="px-5 overflow-y-auto flex-1">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{t("filters")}</h3>
                <p className="text-sm text-gray-400">{resultCount} {resultLabel}</p>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Sort */}
            <div className="mb-5">
              <p className="text-sm font-bold text-gray-800 mb-3">{t("sort_by")}</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "rating", icon: Star, label: t("top_rated_filter") },
                  { id: "fastest", icon: Clock, label: t("fastest_filter") },
                  { id: "popular", icon: Flame, label: t("popular") },
                ].map((s) => (
                  <motion.button
                    key={s.id}
                    onClick={() => { Haptics.impact({ style: "light" }); onChangeSort(s.id as typeof activeSort); }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      activeSort === s.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    <s.icon className="w-4 h-4" />
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Calorie Range */}
            <div className="mb-5">
              <p className="text-sm font-bold text-gray-800 mb-3">{t("filter_by_calories")}</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "all", label: t("all_cuisine") },
                  { id: "under300", label: t("under_300") },
                  { id: "300-500", label: t("range_300_500") },
                  { id: "500-700", label: t("range_500_700") },
                  { id: "700plus", label: t("over_700") },
                ].map((r) => (
                  <motion.button
                    key={r.id}
                    onClick={() => { Haptics.impact({ style: "light" }); onChangeCalorieRange(r.id as CalorieRange); }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                      calorieRange === r.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    {r.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Favorites toggle */}
            <div className="mb-5">
              <p className="text-sm font-bold text-gray-800 mb-3">{t("other_filters")}</p>
              <motion.button
                onClick={() => { Haptics.impact({ style: "medium" }); onToggleFavorites(); }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                  showFavoritesOnly ? "border-rose-400 bg-rose-50" : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${showFavoritesOnly ? "bg-rose-100" : "bg-gray-100"}`}>
                    <Heart className={`w-5 h-5 ${showFavoritesOnly ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold block text-gray-900">{t("favorites_only")}</span>
                    <span className="text-xs text-gray-400">{t("favorites_only_desc")}</span>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full p-1 transition-colors ${showFavoritesOnly ? "bg-rose-500" : "bg-gray-200"}`}>
                  <motion.div
                    className="w-4 h-4 bg-white rounded-full shadow"
                    animate={{ x: showFavoritesOnly ? 20 : 0 }}
                    transition={springConfig}
                  />
                </div>
              </motion.button>
            </div>
          </div>

          <div className="px-5 pt-4 pb-6 border-t border-gray-100 flex-shrink-0" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            <Button onClick={onClose} className="w-full h-12 rounded-2xl font-bold text-base">
              {t("show_results")} ({resultCount} {resultLabel === "restaurants" ? t("restaurants") : t("meals")})
            </Button>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── Main Component ────────────────────────────────────────────────────────────
const Meals = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [meals, setMeals] = useState<MealResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(searchParams.get("favorites") === "true");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<"rating" | "fastest" | "popular">("rating");
  const [activeChip, setActiveChip] = useState<"rating" | "fastest" | "favorites">(
    searchParams.get("favorites") === "true" ? "favorites" : "rating"
  );
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [calorieRange, setCalorieRange] = useState<CalorieRange>("all");
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();

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

  const handleToggleFavorite = useCallback((restaurantId: string, restaurantName: string) => {
    if (!user) {
      promptLogin({
        title: t("save_your_favorites"),
        description: t("save_favorites_desc"),
        actionLabel: t("sign_in"),
        signUpLabel: t("create_free_account"),
      });
      return;
    }
    toggleFavorite(restaurantId, restaurantName);
  }, [user, toggleFavorite, promptLogin, t]);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("restaurants")
          .select("id, name, description, logo_url, rating, total_orders, cuisine_types")
          .eq("approval_status", "approved")
          .eq("is_active", true)
          // Exclude test/placeholder restaurants
          .neq("name", "test")
          .not("name", "ilike", "%test%")
          .not("description", "ilike", "%test%");

        if (restaurantsError) throw restaurantsError;

        const typedData = (restaurantsData || []) as Array<{
          id: string; name: string; description: string | null;
          logo_url: string | null; rating: number | string;
          total_orders: number; cuisine_types: string[] | null;
        }>;

        const restaurantIds = typedData.map((r) => r.id);
        let mealCounts: Record<string, number> = {};
        let transformedMeals: MealResult[] = [];

        if (restaurantIds.length > 0) {
          const { data: mealsData } = await supabase
            .from("meals")
            .select("id, name, calories, image_url, restaurant_id, is_available")
            .in("restaurant_id", restaurantIds);

          const typedMeals = (mealsData || []) as Array<{
            id: string; name: string; calories: number | null;
            image_url: string | null; restaurant_id: string | null; is_available: boolean | null;
          }>;

          mealCounts = typedMeals.reduce((acc: Record<string, number>, m) => {
            if (m.restaurant_id) acc[m.restaurant_id] = (acc[m.restaurant_id] || 0) + 1;
            return acc;
          }, {});

          const byId = new Map(typedData.map((r) => [r.id, r]));
          transformedMeals = typedMeals.map((m) => {
            const r = m.restaurant_id ? byId.get(m.restaurant_id) : null;
            return {
              id: m.id, name: m.name, calories: m.calories,
              image_url: m.image_url, restaurant_id: m.restaurant_id,
              is_available: m.is_available,
              restaurant_name: r?.name || "Restaurant",
              restaurant_logo_url: r?.logo_url || null,
              restaurant_rating: parseFloat(String(r?.rating || 0)) || 0,
              restaurant_total_orders: r?.total_orders || 0,
            };
          });
        }

        setRestaurants(
          typedData.map((r) => ({
            id: r.id, name: r.name, description: r.description,
            logo_url: r.logo_url,
            rating: parseFloat(String(r.rating)) || 0,
            total_orders: r.total_orders || 0,
            meal_count: mealCounts[r.id] || 0,
            cuisine_types: r.cuisine_types || [],
            delivery_time: `${20 + Math.floor(Math.random() * 25)}-${45 + Math.floor(Math.random() * 15)} min`,
          }))
        );
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
    if (showFavoritesOnly) result = result.filter((m) => m.restaurant_id ? favoriteIds.has(m.restaurant_id) : false);
    if (selectedCuisine) {
      const sel = selectedCuisine.toLowerCase();
      result = result.filter((m) => restaurants.find((r) => r.id === m.restaurant_id)?.cuisine_types?.some((c) => c.toLowerCase() === sel));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => m.name.toLowerCase().includes(q) || m.restaurant_name.toLowerCase().includes(q));
    }
    if (calorieRange !== "all") {
      result = result.filter((m) => {
        const cal = m.calories ?? 0;
        if (calorieRange === "under300") return cal < 300;
        if (calorieRange === "300-500") return cal >= 300 && cal <= 500;
        if (calorieRange === "500-700") return cal > 500 && cal <= 700;
        if (calorieRange === "700plus") return cal > 700;
        return true;
      });
    }
    switch (activeSort) {
      case "rating": result.sort((a, b) => b.restaurant_rating - a.restaurant_rating); break;
      case "popular": result.sort((a, b) => b.restaurant_total_orders - a.restaurant_total_orders); break;
      case "fastest": result.sort((a, b) => (a.calories ?? 0) - (b.calories ?? 0)); break;
    }
    return result;
  }, [meals, showFavoritesOnly, favoriteIds, selectedCuisine, searchQuery, calorieRange, activeSort, restaurants]);

  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];
    if (showFavoritesOnly) result = result.filter((r) => favoriteIds.has(r.id));
    if (selectedCuisine) result = result.filter((r) => r.cuisine_types?.some((c) => c.toLowerCase() === selectedCuisine.toLowerCase()));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.cuisine_types?.some((c) => c.toLowerCase().includes(q)));
    }
    switch (activeSort) {
      case "rating": result.sort((a, b) => b.rating - a.rating); break;
      case "fastest": result.sort((a, b) => parseInt(a.delivery_time || "30") - parseInt(b.delivery_time || "30")); break;
      case "popular": result.sort((a, b) => b.total_orders - a.total_orders); break;
    }
    return result;
  }, [restaurants, searchQuery, showFavoritesOnly, favoriteIds, activeSort, selectedCuisine]);

  const clearFilters = useCallback(() => {
    setSearchQuery(""); setShowFavoritesOnly(false); setSelectedCuisine(null);
    setActiveSort("rating"); setActiveChip("rating"); setCalorieRange("all");
  }, []);

  const hasActiveFilters = !!(searchQuery || showFavoritesOnly || selectedCuisine || activeSort !== "rating" || calorieRange !== "all");
  const displayedCount = isCalorieFilterActive ? filteredMeals.length : filteredRestaurants.length;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 pt-safe">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/dashboard">
            <motion.div
              whileTap={{ scale: 0.88 }}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </motion.div>
          </Link>

          {/* Search bar — full width */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder={t("search_restaurants_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-9 h-10 rounded-xl bg-gray-100 border-0 text-sm focus-visible:ring-1 focus-visible:ring-primary shadow-none"
            />
            <AnimatePresence>
              {searchQuery && (
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-400/30 flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-gray-600" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Favorites toggle */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => selectChip(activeChip === "favorites" ? "rating" : "favorites")}
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              activeChip === "favorites" ? "bg-rose-100" : "bg-gray-100"
            }`}
          >
            <Heart className={`w-5 h-5 ${activeChip === "favorites" ? "fill-rose-500 text-rose-500" : "text-gray-500"}`} />
          </motion.button>
        </div>
      </header>

      <main className="px-4 pt-5 pb-28 space-y-5">

        {/* ── Category scroll ── */}
        <CuisineScroller
          selectedCuisine={selectedCuisine}
          onSelectCuisine={setSelectedCuisine}
          t={t}
          loading={loading}
        />

        {/* ── Filter chips ── */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <FilterChip
            active={filterSheetOpen}
            onClick={() => { Haptics.impact({ style: "light" }); setFilterSheetOpen(true); }}
            icon={SlidersHorizontal}
            label={t("filters")}
            color="primary"
          />
          <FilterChip active={activeChip === "rating"}   onClick={() => selectChip("rating")}   icon={Star}   label={t("top_rated_filter")} color="amber" />
          <FilterChip active={activeChip === "fastest"}  onClick={() => selectChip("fastest")}  icon={Clock}  label={t("fastest_filter")}   color="blue"  />
          <FilterChip active={activeChip === "favorites"} onClick={() => selectChip("favorites")} icon={Heart} label={t("favorites_filter")} color="rose"  />
        </div>

        {/* ── Section header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-base">
              {isCalorieFilterActive
                ? showFavoritesOnly ? t("favorite_meals") : t("filtered_meals")
                : showFavoritesOnly ? t("your_favorites") : t("all_restaurants")}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{displayedCount} {isCalorieFilterActive ? t("meals") : t("restaurants")}</p>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full"
            >
              <X className="w-3 h-3" />
              {t("clear_all_filters")}
            </button>
          )}
        </div>

        {/* ── Results grid ── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : displayedCount === 0 ? (
          <motion.div
            className="py-16 text-center bg-white rounded-2xl border border-gray-100"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Store className="w-10 h-10 text-gray-300" />
            </motion.div>
            <h3 className="font-bold text-lg text-gray-800 mb-1">
              {isCalorieFilterActive
                ? showFavoritesOnly ? t("no_favorite_meals") : t("no_meals_found")
                : showFavoritesOnly ? t("no_favorites_yet") : t("no_restaurants_found")}
            </h3>
            <p className="text-sm text-gray-400 mb-5 px-8">
              {showFavoritesOnly ? t("favorites_empty_hint") : t("try_adjust_search")}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" className="rounded-full px-6">
                {t("clear_all_filters")}
              </Button>
            )}
          </motion.div>
        ) : isCalorieFilterActive ? (
          <div className="space-y-3">
            {filteredMeals.map((meal, i) => (
              <MealCard
                key={meal.id}
                meal={meal}
                isFavoriteRestaurant={meal.restaurant_id ? isFavorite(meal.restaurant_id) : false}
                onToggleFavorite={handleToggleFavorite}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRestaurants.map((r, i) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                isFavorite={isFavorite(r.id)}
                onToggleFavorite={handleToggleFavorite}
                index={i}
              />
            ))}
          </div>
        )}
      </main>

      <CustomerNavigation />

      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => selectChip(activeChip === "favorites" ? "rating" : "favorites")}
        resultCount={displayedCount}
        resultLabel={isCalorieFilterActive ? "meals" : "restaurants"}
        activeSort={activeSort}
        onChangeSort={(sort) => {
          if (sort !== "popular") { setActiveSort(sort); setActiveChip(sort); }
          else setActiveSort(sort);
          setShowFavoritesOnly(false);
        }}
        calorieRange={calorieRange}
        onChangeCalorieRange={setCalorieRange}
        t={t}
      />

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
