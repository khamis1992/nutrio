import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Search,
  X,
  SlidersHorizontal,
  Flame,
  ArrowLeft,
  Utensils,
  Coffee,
  Soup,
  utensils,
  UtensilsCrossed,
  Cake,
  Droplet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { getRestaurantImage } from "@/lib/meal-images";
import { Haptics } from "@/lib/haptics";
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { useLanguage } from "@/contexts/LanguageContext";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const spring = { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.8 };

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: spring }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
};

type CalorieRange = "all" | "under300" | "300-500" | "500-700" | "700plus";

type MealCategory = "all" | "breakfast" | "lunch" | "dinner" | "snacks" | "desserts" | "beverages";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
  delivery_time?: string;
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
  price: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  meal_type: string | null;
}

const categoryConfig: Record<MealCategory, { labelKey: string; icon: React.ElementType }> = {
  all: { labelKey: "all_cuisine", icon: Utensils },
  breakfast: { labelKey: "cuisine_breakfast", icon: Coffee },
  lunch: { labelKey: "lunch", icon: Soup },
  dinner: { labelKey: "dinner", icon: Soup },
  snacks: { labelKey: "snacks", icon: UtensilsCrossed },
  desserts: { labelKey: "desserts", icon: Cake },
  beverages: { labelKey: "beverages", icon: Droplet },
};

const formatPrice = (price: number | null): string => {
  if (price === null || price === undefined) return "";
  return `${price.toFixed(2)} QAR`;
};

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
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <Link to={`/meals/${meal.id}`} className="block">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E1F2ED]/50 hover:shadow-md transition-all">
          {/* Image */}
          <div className="relative h-36 bg-gradient-to-br from-primary/5 to-accent/10 overflow-hidden">
            <img
              src={meal.image_url || getRestaurantImage(meal.restaurant_logo_url, meal.restaurant_id || meal.id)}
              alt={meal.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Favorite */}
            {meal.restaurant_id && (
              <motion.button
                onClick={handleFav}
                whileTap={{ scale: 0.85 }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm"
              >
                <Heart
                  className={`w-4 h-4 transition-colors ${
                    isFavoriteRestaurant ? "fill-rose-500 text-rose-500" : "text-gray-400"
                  }`}
                />
              </motion.button>
            )}
            {/* Availability Badge */}
            {meal.is_available === false && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-xs font-semibold text-white bg-gray-800/80 px-3 py-1 rounded-full">
                  {t("currently_unavailable")}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            <h3 className="font-semibold text-sm text-[#0F172A] line-clamp-1 leading-tight">
              {meal.name}
            </h3>
            <p className="text-xs text-[#64748B] line-clamp-1 mt-0.5">
              {meal.restaurant_name}
            </p>

            {/* Bottom Row: Calories + Price */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">
                <Flame className="w-3 h-3 text-orange-500" />
                <span className="text-xs font-semibold">{meal.calories ?? 0}</span>
              </div>
              {meal.price !== null && meal.price !== undefined && (
                <span className="text-sm font-bold text-[#EA580C]">
                  {formatPrice(meal.price)}
                </span>
              )}
            </div>

            {/* Macro Dots Row */}
            {(meal.protein_g !== null || meal.carbs_g !== null || meal.fat_g !== null) && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                {meal.protein_g !== null && (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] text-gray-500">P {meal.protein_g}g</span>
                  </div>
                )}
                {meal.carbs_g !== null && (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    <span className="text-[10px] text-gray-500">C {meal.carbs_g}g</span>
                  </div>
                )}
                {meal.fat_g !== null && (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span className="text-[10px] text-gray-500">F {meal.fat_g}g</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

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
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <Link to={`/restaurant/${restaurant.id}`} className="block">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E1F2ED]/50 hover:shadow-md transition-all">
          {/* Image */}
          <div className="relative h-36 bg-gradient-to-br from-primary/5 to-accent/10 overflow-hidden">
            <img
              src={getRestaurantImage(restaurant.logo_url, restaurant.id)}
              alt={restaurant.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <motion.button
              onClick={handleFav}
              whileTap={{ scale: 0.85 }}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm"
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isFavorite ? "fill-rose-500 text-rose-500" : "text-gray-400"
                }`}
              />
            </motion.button>
          </div>

          {/* Content */}
          <div className="p-3">
            <h3 className="font-semibold text-sm text-[#0F172A] line-clamp-1 leading-tight">
              {restaurant.name}
            </h3>
            {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 && (
              <p className="text-xs text-primary font-medium mt-0.5 line-clamp-1">
                {restaurant.cuisine_types[0]}
              </p>
            )}
            <p className="text-xs text-[#64748B] line-clamp-1 mt-0.5">
              {restaurant.description || t("healthy_and_delicious")}
            </p>

            {/* Stats Row */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                <span className="text-xs font-semibold">{restaurant.rating > 0 ? restaurant.rating.toFixed(1) : "New"}</span>
                {restaurant.rating > 0 && <span className="text-[10px]">★</span>}
              </div>
              <span className="text-xs text-[#64748B]">
                {restaurant.meal_count} {t("meals")}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

const GridSkeleton = () => (
  <div className="grid grid-cols-2 gap-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-[#E1F2ED]/50">
        <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-50 relative overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear", delay: i * 0.1 }}
          />
        </div>
        <div className="p-3 space-y-2">
          <div className="h-4 bg-gray-100 rounded-full w-3/4" />
          <div className="h-3 bg-gray-50 rounded-full w-1/2" />
          <div className="flex gap-2 mt-3">
            <div className="h-6 w-16 bg-gray-100 rounded-full" />
            <div className="h-6 w-12 bg-gray-50 rounded-full ml-auto" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const FilterSheet = ({
  isOpen,
  onClose,
  showFavoritesOnly,
  onToggleFavorites,
  resultCount,
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
  activeSort: "rating" | "fastest" | "popular";
  onChangeSort: (sort: "rating" | "fastest" | "popular") => void;
  calorieRange: CalorieRange;
  onChangeCalorieRange: (range: CalorieRange) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) => {
  const sortOptions = [
    { id: "rating", icon: "⭐", label: t("top_rated_filter") },
    { id: "fastest", icon: "⚡", label: t("fastest_filter") },
    { id: "popular", icon: "🔥", label: t("popular") },
  ];

  const calorieOptions = [
    { id: "all", label: t("all_cuisine") },
    { id: "under300", label: t("under_300") },
    { id: "300-500", label: t("range_300_500") },
    { id: "500-700", label: t("range_500_700") },
    { id: "700plus", label: t("over_700") },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
            aria-hidden="true"
          />
           <motion.div
             initial={{ y: "100%" }}
             animate={{ y: 0 }}
             exit={{ y: "100%" }}
             transition={{ type: "spring", damping: 25, stiffness: 300, mass: 0.8 }}
             className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-b-[24px] shadow-[0_-20px_40px_rgba(0,0,0,0.15)]"
             style={{ 
               maxHeight: "80vh", 
               overflow: "hidden",
               paddingBottom: "max(80px, env(safe-area-inset-bottom, 80px))"
             }}
             aria-modal="true"
             role="dialog"
           >
            <div 
              className="w-[40px] h-[4px] bg-gray-300 rounded-[2px] mx-auto mb-5 cursor-pointer hover:bg-gray-400 transition-colors"
              onClick={onClose}
              role="presentation"
            />

            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[20px] font-bold text-[#1F2937]">{t("filters")}</h2>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
                  {resultCount} {resultCount === 1 ? t("meal") : t("meals")}
                </span>
              </div>

              <div className="mb-8">
                <p className="text-[14px] font-semibold text-[#1F2937] mb-3">{t("sort_by")}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("sort_by")}>
                  {sortOptions.map((option) => (
                    <motion.button
                      key={option.id}
                      onClick={() => {
                        Haptics.impact({ style: "light" });
                        onChangeSort(option.id as typeof activeSort);
                      }}
                      whileTap={{ scale: 1.02 }}
                      role="radio"
                      aria-checked={activeSort === option.id}
                      className={`filter-chip px-4 py-2 rounded-[20px] text-[14px] font-medium transition-all border-none shadow-sm ${
                        activeSort === option.id
                          ? "bg-primary text-white"
                          : "bg-[#F9FAFB] text-gray-600"
                      }`}
                      style={{
                        boxShadow: activeSort === option.id ? "0 4px 6px rgba(16, 185, 129, 0.3)" : "0 1px 2px rgba(0, 0, 0, 0.05)",
                      }}
                    >
                      <span className="mr-1">{option.icon}</span>
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <p className="text-[14px] font-semibold text-[#1F2937] mb-3">{t("filter_by_calories")}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("filter_by_calories")}>
                  {calorieOptions.map((option) => (
                    <motion.button
                      key={option.id}
                      onClick={() => {
                        Haptics.impact({ style: "light" });
                        onChangeCalorieRange(option.id as CalorieRange);
                      }}
                      whileTap={{ scale: 1.02 }}
                      role="radio"
                      aria-checked={calorieRange === option.id}
                      className={`px-4 py-2 rounded-[20px] text-[14px] font-medium transition-all border-none shadow-sm flex flex-col items-center justify-center gap-1 ${
                        calorieRange === option.id
                          ? "bg-[#F59E0B] text-white shadow-[0_4px_6px_rgba(245,158,11,0.3)]"
                          : "bg-[#F9FAFB] text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {option.id === "all" && <span>{option.label}</span>}
                      {option.id !== "all" && (
                        <>
                          <span className="text-[12px] font-medium">
                            {option.id === "under300" ? t("under") : option.id === "700plus" ? t("above") : ""}
                          </span>
                          <span className="text-[16px] font-bold">
                            {option.id === "under300" 
                              ? "300" 
                              : option.id === "700plus" 
                                ? "700+" 
                                : option.label}
                          </span>
                        </>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="mb-8">
                <p className="text-[14px] font-semibold text-[#1F2937] mb-4">{t("favorites_only")}</p>
                <motion.button
                  onClick={() => {
                    Haptics.impact({ style: "medium" });
                    onToggleFavorites();
                  }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center w-full"
                  role="switch"
                  aria-checked={showFavoritesOnly}
                >
                  <div
                    className={`w-[52px] h-[32px] rounded-[16px] relative transition-colors ${
                      showFavoritesOnly ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <motion.div
                      className="absolute top-[4px] left-[4px] w-[24px] h-[24px] bg-white rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                      animate={{ x: showFavoritesOnly ? 20 : 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                    />
                  </div>
                  <span 
                    className={`ml-3 text-[14px] transition-colors ${
                      showFavoritesOnly ? "text-primary" : "text-gray-600"
                    }`}
                  >
                    {showFavoritesOnly ? t("on") : t("off")}
                  </span>
                </motion.button>
              </div>

              <motion.button
                onClick={onClose}
                whileTap={{ scale: 0.98 }}
                className="w-full h-[56px] bg-primary rounded-[14px] text-white font-semibold text-[16px] shadow-[0_4px_6px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                {t("apply_filters")}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const Meals = () => {
  const { t } = useLanguage();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [meals, setMeals] = useState<MealResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<"rating" | "fastest" | "popular">("rating");
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>("all");
  const [calorieRange, setCalorieRange] = useState<CalorieRange>("all");
  const { isFavorite, toggleFavorite, favoriteIds } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();

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
    const fetchData = async () => {
      try {
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("restaurants")
          .select("id, name, description, logo_url, rating, total_orders, cuisine_types")
          .eq("approval_status", "approved")
          .eq("is_active", true)
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
            .select("id, name, calories, image_url, restaurant_id, is_available, price, protein_g, carbs_g, fat_g, meal_type")
            .in("restaurant_id", restaurantIds);

          const typedMeals = (mealsData || []) as Array<{
            id: string; name: string; calories: number | null;
            image_url: string | null; restaurant_id: string | null;
            is_available: boolean | null; price: number | null;
            protein_g: number | null; carbs_g: number | null;
            fat_g: number | null; meal_type: string | null;
          }>;

          mealCounts = typedMeals.reduce((acc: Record<string, number>, m) => {
            if (m.restaurant_id) acc[m.restaurant_id] = (acc[m.restaurant_id] || 0) + 1;
            return acc;
          }, {});

          const byId = new Map(typedData.map((r) => [r.id, r]));
          transformedMeals = typedMeals.map((m) => {
            const r = m.restaurant_id ? byId.get(m.restaurant_id) : null;
            return {
              id: m.id,
              name: m.name,
              calories: m.calories,
              image_url: m.image_url,
              restaurant_id: m.restaurant_id,
              is_available: m.is_available,
              restaurant_name: r?.name || "Restaurant",
              restaurant_logo_url: r?.logo_url || null,
              restaurant_rating: parseFloat(String(r?.rating || 0)) || 0,
              restaurant_total_orders: r?.total_orders || 0,
              price: m.price,
              protein_g: m.protein_g,
              carbs_g: m.carbs_g,
              fat_g: m.fat_g,
              meal_type: m.meal_type,
            };
          });
        }

        setRestaurants(
          typedData.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
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
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredMeals = useMemo(() => {
    let result = [...meals];
    
    if (showFavoritesOnly) {
      result = result.filter((m) => m.restaurant_id ? favoriteIds.has(m.restaurant_id) : false);
    }
    
    if (selectedCategory !== "all") {
      const categoryLower = selectedCategory.toLowerCase();
      result = result.filter((m) => {
        if (!m.meal_type) return false;
        return m.meal_type.toLowerCase() === categoryLower;
      });
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) => 
        m.name.toLowerCase().includes(q) || 
        m.restaurant_name.toLowerCase().includes(q)
      );
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
  }, [meals, showFavoritesOnly, favoriteIds, selectedCategory, searchQuery, calorieRange, activeSort]);

  const filteredRestaurants = useMemo(() => {
    let result = [...restaurants];
    
    if (showFavoritesOnly) {
      result = result.filter((r) => favoriteIds.has(r.id));
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) => 
        r.name.toLowerCase().includes(q) || 
        r.description?.toLowerCase().includes(q) || 
        r.cuisine_types?.some((c) => c.toLowerCase().includes(q))
      );
    }
    
    switch (activeSort) {
      case "rating":
        result.sort((a, b) => b.rating - a.rating);
        break;
      case "fastest":
        result.sort((a, b) => parseInt(a.delivery_time || "30") - parseInt(b.delivery_time || "30"));
        break;
      case "popular":
        result.sort((a, b) => b.total_orders - a.total_orders);
        break;
    }
    
    return result;
  }, [restaurants, searchQuery, showFavoritesOnly, favoriteIds, activeSort]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setShowFavoritesOnly(false);
    setSelectedCategory("all");
    setActiveSort("rating");
    setCalorieRange("all");
  }, []);

  const hasActiveFilters = !!(searchQuery || showFavoritesOnly || selectedCategory !== "all" || activeSort !== "rating" || calorieRange !== "all");
  const displayedCount = filteredMeals.length + filteredRestaurants.length;

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #ECFDF5 0%, #FFFFFF 100%)" }}>
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E1F2ED]/50 pt-safe">
        <div className="px-4 py-3">
          {/* Back button */}
          <div className="flex items-center gap-3 mb-3">
            <Link to="/dashboard">
              <motion.div
                whileTap={{ scale: 0.88 }}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </motion.div>
            </Link>
            <h1 className="font-bold text-lg text-[#0F172A]">{t("meals")}</h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <Input
              placeholder={t("search_meals_placeholder") || "Search meals, cuisines..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 pr-12 h-11 rounded-2xl bg-white border border-[#E1F2ED]/50 text-sm placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-primary/30"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <AnimatePresence>
                {searchQuery && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    onClick={() => setSearchQuery("")}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </motion.button>
                )}
              </AnimatePresence>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { Haptics.impact({ style: "light" }); setFilterSheetOpen(true); }}
                className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 text-primary" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-3 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory outline-none" role="tablist" aria-label={t("meal_types")}>
            {(Object.keys(categoryConfig) as MealCategory[]).map((cat) => {
              const isActive = selectedCategory === cat;
              const config = categoryConfig[cat];
              const Icon = config.icon;
              return (
                <motion.button
                  key={cat}
                  onClick={() => { Haptics.impact({ style: "light" }); setSelectedCategory(cat); }}
                  whileTap={{ scale: 0.95 }}
                  role="tab"
                  aria-selected={isActive}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-[20px] text-sm font-semibold whitespace-nowrap snap-start transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/40"
                      : "bg-white text-[#64748B] border border-[#E1F2ED]/50 hover:border-primary/30"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-primary"}`} />
                  <span className="ml-1.5">{t(config.labelKey)}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 pb-28">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-sm text-[#0F172A] tracking-tight">
              {showFavoritesOnly ? t("your_favorites") : t("all_meals")}
            </h2>
            <p className="text-xs text-[#64748B]">
              {displayedCount} {t("meals")}
            </p>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
            >
              <X className="w-3 h-3" />
              {t("clear_all_filters")}
            </button>
          )}
        </div>

        {/* Results Grid */}
        {loading ? (
          <GridSkeleton />
        ) : displayedCount === 0 ? (
          <motion.div
            className="py-16 text-center bg-white rounded-2xl border border-[#E1F2ED]/50"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <span className="text-4xl">🍽️</span>
            </motion.div>
            <h3 className="font-bold text-lg text-[#0F172A] mb-1">
              {showFavoritesOnly ? t("no_favorites_yet") : t("no_meals_found")}
            </h3>
            <p className="text-sm text-[#64748B] mb-5 px-8">
              {showFavoritesOnly ? t("favorites_empty_hint") : t("try_adjust_search")}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" className="rounded-full px-6">
                {t("clear_all_filters")}
              </Button>
            )}
          </motion.div>
        ) : selectedCategory !== "all" || calorieRange !== "all" ? (
          <motion.div
            className="grid grid-cols-2 gap-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredMeals.map((meal, i) => (
              <MealCard
                key={meal.id}
                meal={meal}
                isFavoriteRestaurant={meal.restaurant_id ? isFavorite(meal.restaurant_id) : false}
                onToggleFavorite={handleToggleFavorite}
                index={i}
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-3"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {filteredRestaurants.map((r, i) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                isFavorite={isFavorite(r.id)}
                onToggleFavorite={handleToggleFavorite}
                index={i}
              />
            ))}
          </motion.div>
        )}
      </main>

      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly(!showFavoritesOnly)}
        resultCount={displayedCount}
        activeSort={activeSort}
        onChangeSort={setActiveSort}
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