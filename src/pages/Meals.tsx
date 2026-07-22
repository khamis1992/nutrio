import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Heart,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Utensils,
  WheatOff,
  type LucideIcon,
} from "lucide-react";

import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useMealRecommendations } from "@/hooks/useMealRecommendations";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { Haptics } from "@/lib/haptics";
import type { MealExplanationCode } from "@/lib/mealRanking";
import { cn } from "@/lib/utils";

type RestaurantCategory = "all" | "under_500" | "protein" | "low_carb" | "balanced";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  image_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
  cuisine_types: string[];
  meal_search_text: string;
}

interface MealRecommendation {
  id: string;
  restaurant_id: string;
  name: string;
  image_url: string | null;
  meal_type: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  rating: number;
  order_count: number;
}

interface RemainingMacroFit {
  meal: MealRecommendation;
  score: number;
  reason: string;
  restaurant?: Restaurant;
}

const categoryTabs: Array<{ id: RestaurantCategory; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All", icon: Utensils },
  { id: "under_500", label: "Under 500 kcal", icon: Flame },
  { id: "protein", label: "High protein", icon: Dumbbell },
  { id: "low_carb", label: "Low carb", icon: WheatOff },
  { id: "balanced", label: "Balanced", icon: Scale },
];

const isRestaurantCategory = (value: string | null): value is RestaurantCategory =>
  value === "all" || value === "under_500" || value === "protein" || value === "low_carb" || value === "balanced";

const mealMatchesCategory = (meal: MealRecommendation, category: RestaurantCategory) => {
  if (category === "all") return true;
  if (category === "under_500") return meal.calories > 0 && meal.calories <= 500;
  if (category === "protein") return meal.protein_g >= 30;
  if (category === "low_carb") return meal.carbs_g > 0 && meal.carbs_g <= 35;
  return meal.calories >= 350 && meal.calories <= 650 && meal.protein_g >= 20 && meal.carbs_g >= 25 && meal.carbs_g <= 75;
};

const seedRating = (name: string): string => {
  const seed = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return (4.2 + ((seed % 7) / 10)).toFixed(1);
};

const getRestaurantImage = (restaurant: Restaurant) =>
  restaurant.image_url || restaurant.logo_url || "/meals/grilled-chicken-salad.jpg";

const getCuisineLabel = (restaurant: Restaurant) => {
  const firstCuisine = restaurant.cuisine_types.find(Boolean);
  return firstCuisine || "Healthy dining";
};

const getGoalFitLabel = (goalType: string | null | undefined, restaurant: Restaurant) => {
  const copy = `${restaurant.name} ${restaurant.description ?? ""} ${restaurant.cuisine_types.join(" ")} ${restaurant.meal_search_text}`.toLowerCase();
  if (goalType === "muscle_gain" && /protein|fitness|fuel|chicken|grill/.test(copy)) return "High-protein match";
  if (goalType === "weight_loss" && /salad|green|vegan|healthy|light|wellness/.test(copy)) return "Light meal match";
  if (goalType === "maintenance" && /balanced|wellness|mediterranean|organic/.test(copy)) return "Fits your goal";
  return /healthy|protein|fitness|wellness|organic|green/.test(copy) ? "Fits your goal" : null;
};

const explanationLabel: Record<"en" | "ar", Partial<Record<MealExplanationCode, string>>> = {
  en: {
    calorie_fit: "Fits today's calories",
    protein_gap: "Helps close your protein gap",
    macro_balance: "Balanced for the rest of your day",
    preference_match: "Matches your meal history",
    variety: "Adds variety to recent meals",
    high_rating: "From a highly rated kitchen",
    delivery_fit: "Fits your delivery window",
    good_value: "Good value for your plan",
    micronutrient_fit: "Supports your micronutrient needs",
    health_context_fit: "Fits your recent health check-in",
    stale_activity: "Activity data may be old",
    missing_safety_data: "Review ingredients before ordering",
  },
  ar: {
    calorie_fit: "مناسبة لسعرات اليوم",
    protein_gap: "تساعد في إكمال احتياج البروتين",
    macro_balance: "متوازنة لبقية يومك",
    preference_match: "تناسب اختياراتك السابقة",
    variety: "تضيف تنوعاً لوجباتك",
    high_rating: "من مطبخ عالي التقييم",
    delivery_fit: "تناسب وقت التوصيل",
    good_value: "قيمة جيدة لخطتك",
    micronutrient_fit: "تدعم احتياج المغذيات الدقيقة",
    health_context_fit: "تناسب تسجيلك الصحي الأخير",
    stale_activity: "بيانات النشاط قديمة",
    missing_safety_data: "راجع المكونات قبل الطلب",
  },
};

const RestaurantCard = ({
  restaurant,
  isFavorite,
  onToggleFavorite,
  goalType,
  isRTL,
}: {
  restaurant: Restaurant;
  isFavorite: (restaurantId: string) => boolean;
  onToggleFavorite: (restaurantId: string, restaurantName: string) => void;
  goalType?: string | null;
  isRTL: boolean;
}) => {
  const favorite = isFavorite(restaurant.id);
  const fitLabel = getGoalFitLabel(goalType, restaurant);
  const reduceMotion = useReducedMotion();
  const rating = restaurant.rating > 0 ? restaurant.rating.toFixed(1) : seedRating(restaurant.name);

  return (
    <motion.article
      whileTap={reduceMotion ? undefined : { scale: 0.988 }}
      className="relative overflow-hidden rounded-[20px] bg-white shadow-[0_8px_24px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]"
    >
      <Link
        to={`/restaurant/${restaurant.id}`}
        data-testid={`meals-card-${restaurant.id}`}
        className="flex min-h-[142px] gap-3 p-3"
      >
        <div className="relative h-[118px] w-[112px] shrink-0 overflow-hidden rounded-[16px] bg-[#F6F8FB]">
          <img
            src={getRestaurantImage(restaurant)}
            alt={restaurant.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <span className="absolute bottom-2 left-2 inline-flex h-7 items-center gap-1 rounded-full bg-white/95 px-2 text-[11px] font-black text-[#020617] shadow-sm backdrop-blur">
            <Star className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" strokeWidth={0} />
            {rating}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col py-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-extrabold uppercase text-[#94A3B8]">{getCuisineLabel(restaurant)}</p>
              <h3 className="mt-0.5 line-clamp-2 text-[16px] font-black leading-tight text-[#020617]">{restaurant.name}</h3>
            </div>
            <ChevronRight className={cn("mt-1 h-5 w-5 shrink-0 text-[#94A3B8]", isRTL && "rotate-180")} />
          </div>

          {fitLabel ? (
            <span className="mt-2 inline-flex w-fit rounded-full bg-[#F3F4FF] px-2 py-1 text-[10px] font-extrabold text-[#7C83F6]">
              {fitLabel}
            </span>
          ) : null}

          <div className="mt-auto flex items-center gap-3 pt-2 text-[11px] font-bold text-[#64748B]">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5 text-[#38BDF8]" />
              20-30 min
            </span>
            <span className="inline-flex items-center gap-1">
              <Utensils className="h-3.5 w-3.5 text-[#22C7A1]" />
              {restaurant.meal_count} meals
            </span>
          </div>
        </div>
      </Link>

      <button
        type="button"
        data-testid="meals-fav-btn"
        onClick={() => onToggleFavorite(restaurant.id, restaurant.name)}
        className={cn(
          "absolute left-[86px] top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm ring-1 ring-black/5 backdrop-blur active:scale-95",
          favorite ? "text-[#FB6B7A]" : "text-[#64748B]",
          isRTL && "left-auto right-[86px]",
        )}
        aria-label={`Favorite ${restaurant.name}`}
      >
        <Heart className={cn("h-[17px] w-[17px]", favorite && "fill-current")} strokeWidth={2.2} />
      </button>
    </motion.article>
  );
};

const Meals = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category");
  const initialQuery = searchParams.get("q") || "";
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [availableMeals, setAvailableMeals] = useState<MealRecommendation[]>([]);
  const [featuredRestaurantIds, setFeaturedRestaurantIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<RestaurantCategory>(
    isRestaurantCategory(initialCategory) ? initialCategory : "all",
  );
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { ranking, loading: rankingLoading } = useMealRecommendations();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  const { t, language, isRTL } = useLanguage();
  const {
    loading: subscriptionLoading,
    hasActiveSubscription,
    remainingMeals,
    totalMeals,
    mealsUsed,
    isUnlimited,
  } = useSubscription();

  useEffect(() => {
    const category = searchParams.get("category");
    setSelectedCategory(isRestaurantCategory(category) ? category : "all");
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const handleToggleFavorite = useCallback(
    (restaurantId: string, restaurantName: string) => {
      Haptics.impact({ style: "medium" });
      if (!user) {
        promptLogin({
          title: t("save_your_favorites"),
          description: t("sign_in_to_save_favorites_desc"),
          actionLabel: t("sign_in"),
          signUpLabel: t("create_free_account"),
        });
        return;
      }
      toggleFavorite(restaurantId, restaurantName);
    },
    [promptLogin, t, toggleFavorite, user],
  );

  useEffect(() => {
    (async () => {
      try {
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from("public_restaurant_catalog" as "restaurants")
          .select("id, name, description, logo_url, image_url, rating, total_orders, cuisine_types")
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .neq("name", "test")
          .not("name", "ilike", "%test%")
          .not("description", "ilike", "%test%");

        if (restaurantsError) throw restaurantsError;

        const ids = (restaurantsData ?? []).map((restaurant) => restaurant.id);
        const mealCounts: Record<string, number> = {};
        const mealSearchTerms: Record<string, string[]> = {};

        if (ids.length > 0) {
          const { data: mealsData, error: mealsError } = await supabase
            .from("public_meal_catalog" as "meals")
            .select("id, restaurant_id, name, image_url, meal_type, calories, protein_g, protein, carbs_g, carbs, fat_g, rating, avg_rating, order_count")
            .in("restaurant_id", ids)
            .eq("approval_status", "approved")
            .eq("is_available", true);

          if (mealsError) throw mealsError;

          (mealsData ?? []).forEach((meal) => {
            if (!meal.restaurant_id) return;
            mealCounts[meal.restaurant_id] = (mealCounts[meal.restaurant_id] || 0) + 1;
            mealSearchTerms[meal.restaurant_id] = [
              ...(mealSearchTerms[meal.restaurant_id] || []),
              meal.name,
              meal.meal_type || "",
            ];
          });

          setAvailableMeals(
            (mealsData ?? [])
              .filter((meal) => Boolean(meal.restaurant_id))
              .map((meal) => ({
                id: meal.id,
                restaurant_id: meal.restaurant_id as string,
                name: meal.name,
                image_url: meal.image_url,
                meal_type: meal.meal_type,
                calories: Number(meal.calories || 0),
                protein_g: Number(meal.protein_g || meal.protein || 0),
                carbs_g: Number(meal.carbs_g || meal.carbs || 0),
                fat_g: Number(meal.fat_g || 0),
                rating: Number(meal.avg_rating || meal.rating || 0),
                order_count: Number(meal.order_count || 0),
              })),
          );
        }

        setRestaurants(
          (restaurantsData ?? [])
            .map((restaurant) => ({
              id: restaurant.id,
              name: restaurant.name,
              description: restaurant.description,
              logo_url: restaurant.logo_url,
              image_url: restaurant.image_url,
              rating: Number(restaurant.rating || 0),
              total_orders: restaurant.total_orders || 0,
              meal_count: mealCounts[restaurant.id] || 0,
              cuisine_types: restaurant.cuisine_types || [],
              meal_search_text: (mealSearchTerms[restaurant.id] || []).join(" "),
            }))
            .filter((restaurant) => restaurant.meal_count > 0),
        );

        const now = new Date().toISOString();
        const { data: featuredData, error: featuredError } = await supabase
          .from("featured_listings")
          .select("restaurant_id")
          .eq("status", "active")
          .lte("starts_at", now)
          .gte("ends_at", now);

        if (featuredError) console.error("Error fetching featured listings:", featuredError);
        setFeaturedRestaurantIds((featuredData ?? []).map((featured) => featured.restaurant_id));
      } catch (error) {
        console.error("Error loading restaurants:", error);
        setFetchError(error instanceof Error ? error.message : "Failed to load restaurants");
      }
    })();
  }, []);

  useEffect(() => {
    document.title = "Discover Restaurants - Nutrio";
  }, []);

  const visibleRestaurants = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return restaurants
      .filter((restaurant) => {
        const searchable = `${restaurant.name} ${restaurant.description ?? ""} ${restaurant.cuisine_types.join(" ")} ${restaurant.meal_search_text}`.toLowerCase();
        if (search && !searchable.includes(search)) return false;
        if (showFavoritesOnly && !isFavorite(restaurant.id)) return false;
        if (selectedCategory !== "all") {
          const restaurantMeals = availableMeals.filter((meal) => meal.restaurant_id === restaurant.id);
          const hasMatchingMeal = restaurantMeals.some((meal) => mealMatchesCategory(meal, selectedCategory));
          if (!hasMatchingMeal) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const featuredDifference = Number(featuredRestaurantIds.includes(b.id)) - Number(featuredRestaurantIds.includes(a.id));
        if (featuredDifference !== 0) return featuredDifference;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.total_orders - a.total_orders;
      });
  }, [availableMeals, featuredRestaurantIds, isFavorite, restaurants, searchQuery, selectedCategory, showFavoritesOnly]);

  const remainingMacros = ranking?.remainingNutrition ?? null;

  const macroFitMeals = useMemo<RemainingMacroFit[]>(() => {
    if (!ranking || rankingLoading) return [];
    const visibleRestaurantIds = new Set(visibleRestaurants.map((restaurant) => restaurant.id));
    return ranking.ranked
      .filter(
        (meal) =>
          Boolean(meal.restaurant_id) &&
          visibleRestaurantIds.has(meal.restaurant_id as string) &&
          mealMatchesCategory({
            id: meal.id,
            restaurant_id: meal.restaurant_id as string,
            name: meal.name,
            image_url: meal.image_url,
            meal_type: meal.meal_type,
            calories: Number(meal.calories ?? 0),
            protein_g: Number(meal.protein_g ?? 0),
            carbs_g: Number(meal.carbs_g ?? 0),
            fat_g: Number(meal.fat_g ?? 0),
            rating: meal.restaurant_rating,
            order_count: meal.restaurant_total_orders,
          }, selectedCategory),
      )
      .map((meal) => ({
        meal: {
          id: meal.id,
          restaurant_id: meal.restaurant_id as string,
          name: meal.name,
          image_url: meal.image_url,
          meal_type: meal.meal_type,
          calories: Number(meal.calories ?? 0),
          protein_g: Number(meal.protein_g ?? 0),
          carbs_g: Number(meal.carbs_g ?? 0),
          fat_g: Number(meal.fat_g ?? 0),
          rating: meal.restaurant_rating,
          order_count: meal.restaurant_total_orders,
        },
        score: meal.finalScore,
        reason: explanationLabel[language][meal.explanationCodes[0]]
          ?? (language === "ar" ? "متوازنة لبقية يومك" : "Balanced for the rest of your day"),
        restaurant: restaurants.find((restaurant) => restaurant.id === meal.restaurant_id),
      }))
      .slice(0, 3);
  }, [language, ranking, rankingLoading, restaurants, selectedCategory, visibleRestaurants]);

  const topMacroFit = macroFitMeals[0];
  const mealBalancePercent = isUnlimited || totalMeals <= 0
    ? 100
    : Math.min(100, Math.round((remainingMeals / totalMeals) * 100));
  const remainingMealsLabel = subscriptionLoading ? "--" : isUnlimited ? "∞" : Math.max(0, remainingMeals).toLocaleString();
  const hasNoResults = visibleRestaurants.length === 0 && !fetchError;

  return (
    <div className="min-h-full bg-[#F6F8FB] text-[#020617]" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-30 border-b border-[#E5EAF1]/80 bg-[#F6F8FB]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <Link
            to="/dashboard"
            data-testid="meals-back-btn"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.4} />
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Nutrio meals</p>
            <h1 className="mt-0.5 text-[17px] font-black">Restaurants</h1>
          </div>
          <button
            type="button"
            data-testid="meals-favorites-filter-btn"
            onClick={() => setShowFavoritesOnly((value) => !value)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-1 active:scale-95",
              showFavoritesOnly
                ? "bg-[#FFF1F3] text-[#FB6B7A] ring-[#FB6B7A]/20"
                : "bg-white text-[#64748B] ring-[#E5EAF1]",
            )}
            aria-label="Show saved restaurants"
          >
            <Heart className={cn("h-5 w-5", showFavoritesOnly && "fill-current")} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[480px] px-4 pb-12 pt-4">
        {fetchError ? (
          <div className="mb-4 flex items-start gap-3 rounded-[18px] bg-[#FFF1F3] p-4 text-[#B4233A] ring-1 ring-[#FB6B7A]/20">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Restaurants could not load</p>
              <button
                type="button"
                data-testid="meals-retry-btn"
                className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold ring-1 ring-[#FB6B7A]/20"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4" />
                {t("retry")}
              </button>
            </div>
          </div>
        ) : null}

        <Link
          to="/subscription"
          data-testid="meals-subscription-link"
          className="group mb-4 block overflow-hidden rounded-2xl bg-[#0F172A] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-800 transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800/80 text-emerald-400 ring-1 ring-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]">
              <ShieldCheck className="h-6 w-6" strokeWidth={2} />
            </span>

            <div className="min-w-0 flex-1 text-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{t("meal_plan_balance")}</p>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span className="text-[24px] font-black leading-none tabular-nums text-white" dir="ltr">{remainingMealsLabel}</span>
                <span className="truncate text-[13px] font-bold text-slate-400">
                  {isUnlimited ? t("unlimited_meals") : t("meals_remaining")}
                </span>
              </div>
            </div>

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800/50 text-slate-400 ring-1 ring-white/10 transition-all group-hover:bg-slate-800 group-hover:text-white group-active:bg-emerald-500/20 group-active:text-emerald-400 group-active:ring-emerald-500/30">
              <ChevronRight className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.5} />
            </span>
          </div>

          <div className="mt-5">
            <div className="mb-2.5 flex items-center justify-between gap-3 text-[11px] font-bold">
              <span className="text-slate-400">
                {subscriptionLoading
                  ? t("checking_your_plan")
                  : hasActiveSubscription
                    ? isUnlimited
                      ? t("unlimited_plan_active")
                      : t("meals_used_of_total", { used: mealsUsed, total: totalMeals })
                    : t("no_active_meal_plan")}
              </span>
              <span className={cn("tabular-nums tracking-tight", mealBalancePercent <= 20 && !isUnlimited ? "text-macro-fat" : "text-emerald-400")} dir="ltr">
                {isUnlimited ? t("status_active") : t("pct_left", { pct: mealBalancePercent })}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] ring-1 ring-white/5">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${mealBalancePercent}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={cn("relative block h-full rounded-full overflow-hidden", mealBalancePercent <= 20 && !isUnlimited ? "bg-macro-fat" : "bg-emerald-500")}
              >
                <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.2),transparent)] bg-[length:200%_100%] animate-[shimmer_2s_infinite]" />
              </motion.span>
            </div>
          </div>
        </Link>

        <section className="sticky top-[69px] z-20 -mx-4 bg-[#F6F8FB]/95 px-4 pb-3 pt-1 backdrop-blur-xl">
          <div className="relative">
            <Search className={cn("pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 text-[#94A3B8]", isRTL ? "right-4" : "left-4")} />
            <input
              data-testid="meals-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search restaurants, cuisines or meals"
              className={cn(
                "h-12 w-full rounded-[16px] bg-white text-[14px] font-bold outline-none ring-1 ring-[#E5EAF1] placeholder:text-[#94A3B8] focus:ring-[#22C7A1]/40",
                isRTL ? "pr-12 pl-4" : "pl-12 pr-4",
              )}
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categoryTabs.map((category) => {
              const Icon = category.icon;
              const active = selectedCategory === category.id;
              return (
                <button
                  type="button"
                  key={category.id}
                  data-testid={`meals-category-${category.id}`}
                  onClick={() => {
                    Haptics.impact({ style: "light" });
                    setSelectedCategory(category.id);
                  }}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[12px] font-extrabold ring-1 transition active:scale-95",
                    active
                      ? "bg-[#020617] text-white ring-[#020617]"
                      : "bg-white text-[#64748B] ring-[#E5EAF1]",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                  {category.label}
                </button>
              );
            })}
          </div>
        </section>

        {hasNoResults ? (
          <section className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#38BDF8] ring-1 ring-[#E5EAF1]">
              <Search className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-[21px] font-black">No restaurants found</h2>
            <p className="mt-2 max-w-[280px] text-[13px] font-medium leading-relaxed text-[#64748B]">Try another cuisine or clear your search.</p>
            <button
              type="button"
              data-testid="meals-clear-filters-btn"
              className="mt-5 h-11 rounded-full bg-[#020617] px-5 text-[13px] font-extrabold text-white active:scale-95"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setShowFavoritesOnly(false);
              }}
            >
              Clear filters
            </button>
          </section>
        ) : visibleRestaurants.length > 0 ? (
          <>
            {remainingMacros && topMacroFit ? (
              <section className="mt-3">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">What should I eat?</p>
                    <h2 className="mt-0.5 text-[21px] font-black">Fit your remaining macros</h2>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold text-[#64748B] ring-1 ring-[#E5EAF1]">
                    {ranking?.offline ? "Saved result" : "Live today"}
                  </span>
                </div>

                {ranking?.offline || ranking?.inputFreshness.safety !== "fresh" ? (
                  <div className="mb-3 flex items-start gap-2 rounded-[16px] bg-[#FFF7ED] p-3 text-[10px] font-bold leading-4 text-[#9A3412] ring-1 ring-[#FED7AA]">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {language === "ar"
                        ? ranking?.offline
                          ? "نعرض آخر ترتيب محفوظ؛ تأكد من توفر الوجبة."
                          : "بعض بيانات السلامة غير مكتملة؛ راجع المكونات قبل الطلب."
                        : ranking?.offline
                          ? "Showing your last saved ranking; confirm meal availability."
                          : "Some safety data is incomplete; review ingredients before ordering."}
                    </span>
                  </div>
                ) : null}

                <Link
                  to={`/meals/${topMacroFit.meal.id}`}
                  data-testid={`macro-fit-meal-${topMacroFit.meal.id}`}
                  onClick={() => trackEvent("meal_ranking_result_opened", {
                    engine_version: ranking?.engineVersion ?? "unknown",
                    meal_id: topMacroFit.meal.id,
                    rank: 1,
                    score: topMacroFit.score,
                    surface: "meals_hero",
                  })}
                  className="group block overflow-hidden rounded-[24px] bg-[#020617] text-white shadow-[0_14px_34px_rgba(2,6,23,0.16)] active:scale-[0.99]"
                >
                  <div className="relative h-[170px] overflow-hidden bg-[#111827]">
                    <img
                      src={topMacroFit.meal.image_url || "/meals/grilled-chicken-salad.jpg"}
                      alt={topMacroFit.meal.name}
                      className="h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-[#020617]/35 to-transparent" />
                    <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase text-[#020617] shadow-sm backdrop-blur">
                        <Sparkles className="h-3.5 w-3.5 text-[#22C7A1]" />
                        {topMacroFit.score}% match
                      </span>
                      <span className="rounded-full bg-[#22C7A1] px-3 py-1.5 text-[10px] font-black text-[#020617]">
                        Eat next
                      </span>
                    </div>
                    <div className="absolute bottom-4 left-4 right-4">
                      <p className="truncate text-[11px] font-extrabold uppercase text-white/70">{topMacroFit.restaurant?.name || "Nutrio meal"}</p>
                      <h3 className="mt-1 line-clamp-2 text-[22px] font-black leading-tight">{topMacroFit.meal.name}</h3>
                      <p className="mt-1 text-[12px] font-bold text-[#BFEFE4]">{topMacroFit.reason}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {[
                      { label: "left", value: Math.round(remainingMacros.calories), unit: "kcal", tone: "bg-white/10 text-white" },
                      { label: "meal", value: Math.round(topMacroFit.meal.calories), unit: "kcal", tone: "bg-[#FFF7ED] text-[#F97316]" },
                      { label: "protein", value: Math.round(topMacroFit.meal.protein_g), unit: "g", tone: "bg-[#F3F4FF] text-[#7C83F6]" },
                      { label: "carbs", value: Math.round(topMacroFit.meal.carbs_g), unit: "g", tone: "bg-[#EFFFFA] text-[#12866F]" },
                    ].map((item) => (
                      <div key={item.label} className={cn("rounded-[16px] px-2 py-2.5 text-center", item.tone)}>
                        <p className="text-[15px] font-black leading-none tabular-nums">
                          {item.value}
                          <span className="text-[9px] font-extrabold"> {item.unit}</span>
                        </p>
                        <p className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] opacity-70">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </Link>

                {macroFitMeals.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {macroFitMeals.slice(1).map((item, index) => (
                      <Link
                        key={item.meal.id}
                        to={`/meals/${item.meal.id}`}
                        onClick={() => trackEvent("meal_ranking_result_opened", {
                          engine_version: ranking?.engineVersion ?? "unknown",
                          meal_id: item.meal.id,
                          rank: index + 2,
                          score: item.score,
                          surface: "meals_alternatives",
                        })}
                        className="min-w-[210px] rounded-[18px] bg-white p-3 ring-1 ring-[#E5EAF1] active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={item.meal.image_url || "/meals/grilled-chicken-salad.jpg"}
                            alt={item.meal.name}
                            className="h-14 w-14 rounded-[14px] object-cover"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-black text-[#020617]">{item.meal.name}</p>
                            <p className="mt-1 text-[10px] font-bold text-[#64748B]">{Math.round(item.meal.calories)} kcal · {Math.round(item.meal.protein_g)}g protein</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            <section className="mt-7">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Browse restaurants</p>
                    <h2 className="mt-0.5 text-[21px] font-black">All restaurants</h2>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#64748B] ring-1 ring-[#E5EAF1]">
                    {visibleRestaurants.length} places
                  </span>
                </div>
                <div className="grid gap-3">
                  {visibleRestaurants.map((restaurant) => (
                    <RestaurantCard
                      key={restaurant.id}
                      restaurant={restaurant}
                      isFavorite={isFavorite}
                      onToggleFavorite={handleToggleFavorite}
                      goalType={activeGoal?.goal_type}
                      isRTL={isRTL}
                    />
                  ))}
                </div>
              </section>
          </>
        ) : null}
      </main>

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
