import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock3,
  Beef,
  Dumbbell,
  Flame,
  Heart,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Utensils,
  WheatOff,
  type LucideIcon,
} from "lucide-react";

import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Haptics } from "@/lib/haptics";
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
  rating: number;
  order_count: number;
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

const scoreMealForGoal = (
  meal: MealRecommendation,
  goalType: string | null | undefined,
  dailyCalorieTarget?: number,
) => {
  const ratingScore = meal.rating * 12;
  const popularityScore = Math.min(meal.order_count, 100) * 0.08;
  const proteinScore = meal.protein_g * (goalType === "muscle_gain" ? 2.4 : 1.25);
  const targetMealCalories = Math.max(350, Math.min(700, (dailyCalorieTarget || 1800) / 3));
  const calorieFit = Math.max(0, 35 - Math.abs(meal.calories - targetMealCalories) / 12);

  if (goalType === "weight_loss") {
    const lightMealBonus = meal.calories > 0 && meal.calories <= targetMealCalories ? 22 : 0;
    return ratingScore + popularityScore + proteinScore + calorieFit + lightMealBonus;
  }

  if (goalType === "muscle_gain") {
    return ratingScore + popularityScore + proteinScore + calorieFit;
  }

  return ratingScore + popularityScore + proteinScore + calorieFit;
};

const getMealMatchReason = (meal: MealRecommendation, goalType: string | null | undefined) => {
  if (goalType === "muscle_gain") return `${Math.round(meal.protein_g)}g protein for your goal`;
  if (goalType === "weight_loss") return `${Math.round(meal.calories)} kcal with ${Math.round(meal.protein_g)}g protein`;
  return "Strong nutrition and customer rating";
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
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  const { t, isRTL } = useLanguage();
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
          .from("restaurants")
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
            .from("meals")
            .select("id, restaurant_id, name, image_url, meal_type, calories, protein_g, protein, carbs_g, carbs, rating, avg_rating, order_count")
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

  const bestMeal = useMemo(() => {
    const visibleRestaurantIds = new Set(visibleRestaurants.map((restaurant) => restaurant.id));
    return availableMeals
      .filter(
        (meal) =>
          visibleRestaurantIds.has(meal.restaurant_id) &&
          meal.calories > 0 &&
          mealMatchesCategory(meal, selectedCategory),
      )
      .sort(
        (a, b) =>
          scoreMealForGoal(b, activeGoal?.goal_type, activeGoal?.daily_calorie_target) -
          scoreMealForGoal(a, activeGoal?.goal_type, activeGoal?.daily_calorie_target),
      )[0];
  }, [activeGoal?.daily_calorie_target, activeGoal?.goal_type, availableMeals, selectedCategory, visibleRestaurants]);

  const bestMealRestaurant = bestMeal
    ? restaurants.find((restaurant) => restaurant.id === bestMeal.restaurant_id)
    : undefined;
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
          className="group mb-4 block overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#E9FBF6] text-[#22C7A1] ring-1 ring-[#22C7A1]/10">
              <ShieldCheck className="h-6 w-6" strokeWidth={2.2} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Meal plan balance</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[24px] font-black leading-none tabular-nums text-[#020617]">{remainingMealsLabel}</span>
                <span className="truncate text-[13px] font-bold text-[#64748B]">
                  {isUnlimited ? "unlimited meals" : "meals remaining"}
                </span>
              </div>
            </div>

            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1] transition group-active:bg-[#E9FBF6] group-active:text-[#22C7A1]">
              <ChevronRight className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.3} />
            </span>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-extrabold">
              <span className="text-[#64748B]">
                {subscriptionLoading
                  ? "Checking your plan"
                  : hasActiveSubscription
                    ? isUnlimited
                      ? "Unlimited plan active"
                      : `${mealsUsed} of ${totalMeals} meals used`
                    : "No active meal plan"}
              </span>
              <span className={cn("tabular-nums", mealBalancePercent <= 20 && !isUnlimited ? "text-[#FB6B7A]" : "text-[#22C7A1]") }>
                {isUnlimited ? "Active" : `${mealBalancePercent}% left`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#EDF1F5]">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${mealBalancePercent}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className={cn("block h-full rounded-full", mealBalancePercent <= 20 && !isUnlimited ? "bg-[#FB6B7A]" : "bg-[#22C7A1]")}
              />
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
            {bestMeal && bestMealRestaurant ? (
            <section className="mt-3">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Recommended for you</p>
                  <h2 className="mt-0.5 text-[21px] font-black">Best meal</h2>
                </div>
                <span className="rounded-full bg-[#E9FBF6] px-3 py-1.5 text-[10px] font-extrabold text-[#12866F]">For your goal</span>
              </div>
              <Link
                to={`/meals/${bestMeal.id}`}
                data-testid={`best-meal-${bestMeal.id}`}
                className="group block overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1] active:scale-[0.99]"
              >
                <div className="relative h-[164px] overflow-hidden bg-[#F6F8FB]">
                  <img
                    src={bestMeal.image_url || "/meals/grilled-chicken-salad.jpg"}
                    alt={bestMeal.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617]/55 via-transparent to-transparent" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-black uppercase text-[#020617] shadow-sm backdrop-blur">
                    {bestMeal.meal_type || "Meal"}
                  </span>
                </div>
                <div className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-extrabold uppercase text-[#94A3B8]">{bestMealRestaurant.name}</p>
                    <h3 className="mt-1 truncate text-[18px] font-black text-[#020617]">{bestMeal.name}</h3>
                    <p className="mt-1 text-[11px] font-bold text-[#7C83F6]">
                      {getMealMatchReason(bestMeal, activeGoal?.goal_type)}
                    </p>
                    <div className="mt-3 flex items-center gap-4 text-[12px] font-extrabold text-[#64748B]">
                      <span className="inline-flex items-center gap-1.5">
                        <Flame className="h-4 w-4 text-[#FB6B7A]" />
                        {Math.round(bestMeal.calories)} kcal
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Beef className="h-4 w-4 text-[#7C83F6]" />
                        {Math.round(bestMeal.protein_g)}g protein
                      </span>
                    </div>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white">
                    <ChevronRight className={cn("h-5 w-5", isRTL && "rotate-180")} />
                  </span>
                </div>
              </Link>
            </section>
            ) : null}

            <section className={cn("mt-7", !bestMeal && "mt-3")}>
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
