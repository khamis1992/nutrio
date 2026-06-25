import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Bike,
  ChevronRight,
  Clock,
  Coffee,
  Flame,
  Heart,
  Leaf,
  RefreshCw,
  Search,
  ShieldCheck,
  Soup,
  Sparkles,
  Star,
  Store,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { SmartMealPicks } from "@/components/SmartRecommendations";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type MealCategory = "all" | "breakfast" | "lunch" | "dinner" | "snacks";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  image_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
  cuisine_types?: string[];
}

interface RestaurantTemplate {
  name: string;
  description: string;
  meals: number;
  image: string;
  accent: string;
}

interface ShowcaseRestaurant extends RestaurantTemplate {
  liveRestaurantId?: string;
}

const categoryTabs: Array<{ id: MealCategory; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All", icon: Utensils },
  { id: "breakfast", label: "Breakfast", icon: Coffee },
  { id: "lunch", label: "Lunch", icon: Soup },
  { id: "dinner", label: "Dinner", icon: UtensilsCrossed },
  { id: "snacks", label: "Snacks", icon: Leaf },
];

const CATEGORY_KEYWORDS: Record<MealCategory, string[]> = {
  all: [],
  breakfast: ["breakfast", "morning", "brunch", "cafe"],
  lunch: ["lunch", "midday", "arabic", "lebanese", "mediterranean", "salad"],
  dinner: ["dinner", "evening", "grill", "grilled", "bbq", "steak", "seafood"],
  snacks: ["snack", "snacks", "light", "dessert", "sweet", "vegan", "healthy", "protein", "fitness"],
};

const isMealCategory = (value: string | null): value is MealCategory =>
  value === "all" || value === "breakfast" || value === "lunch" || value === "dinner" || value === "snacks";

const restaurantTemplates: RestaurantTemplate[] = [
  {
    name: "Lebanese Kitchen",
    description: "Traditional Lebanese cuisine with fresh herbs and bright mezze plates",
    meals: 4,
    image: "/meals/beef-shawarma-bowl.jpg",
    accent: "from-amber-500 to-rose-500",
  },
  {
    name: "Mediterranean Delights",
    description: "Authentic Mediterranean bowls, wraps, and clean coastal flavors",
    meals: 16,
    image: "/meals/grilled-chicken-salad.jpg",
    accent: "from-sky-500 to-emerald-500",
  },
  {
    name: "Fitness Fuel Station",
    description: "High-protein meals designed for active lifestyles and lean goals",
    meals: 4,
    image: "/meals/grilled-chicken-salad.jpg",
    accent: "from-lime-500 to-cyan-500",
  },
  {
    name: "Green Garden Vegan",
    description: "Plant-based restaurant with seasonal ingredients and bold sauces",
    meals: 4,
    image: "/meals/falafel-wrap.jpg",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    name: "Organic Harvest",
    description: "Farm-to-table meals sourced from local Qatar produce partners",
    meals: 4,
    image: "/meals/grilled-chicken-salad.jpg",
    accent: "from-orange-500 to-emerald-500",
  },
  {
    name: "Healthy Bites Cafe",
    description: "Casual dining with balanced nutrition options for busy days",
    meals: 4,
    image: "/meals/falafel-wrap.jpg",
    accent: "from-fuchsia-500 to-orange-500",
  },
  {
    name: "Protein Hub",
    description: "High protein, great taste, built for recovery and strength",
    meals: 4,
    image: "/meals/beef-shawarma-bowl.jpg",
    accent: "from-indigo-500 to-emerald-500",
  },
  {
    name: "Wellness Kitchen",
    description: "Balanced meals for everyday wellness, energy, and focus",
    meals: 4,
    image: "/meals/grilled-chicken-salad.jpg",
    accent: "from-rose-500 to-teal-500",
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

const seedRating = (name: string): string => {
  const seed = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  return (4.2 + ((seed % 7) / 10)).toFixed(1);
};

const truncateDescription = (value: string | null | undefined, fallback: string) => {
  const text = value?.trim() || fallback;
  return text.length <= 86 ? text : `${text.slice(0, 83).trim()}...`;
};

const getRestaurantImage = (restaurant: ShowcaseRestaurant) =>
  restaurant.image && restaurant.image !== "/meals-header-illustration.png"
    ? restaurant.image
    : "/meals/grilled-chicken-salad.jpg";

const getGoalFitLabel = (goalType: string | null | undefined, restaurant: ShowcaseRestaurant) => {
  const copy = `${restaurant.name} ${restaurant.description}`.toLowerCase();
  if (goalType === "muscle_gain" && /protein|fitness|fuel|chicken|grill/.test(copy)) return "goal_high_protein_pick";
  if (goalType === "weight_loss" && /salad|green|vegan|healthy|light|wellness/.test(copy)) return "goal_light_pick";
  if (goalType === "maintenance" && /balanced|wellness|mediterranean|organic/.test(copy)) return "goal_fits_you";
  return /healthy|protein|fitness|wellness|organic|green/.test(copy) ? "goal_fits_you" : null;
};

const FeatureCard = ({ restaurant, goalType, t }: { restaurant: ShowcaseRestaurant; goalType?: string | null; t: (key: string) => string }) => {
  const fitLabel = getGoalFitLabel(goalType, restaurant);
  const card = (
    <motion.article
      whileHover={{ y: -4 }}
      className="group relative h-[240px] min-w-[280px] overflow-hidden rounded-[24px] bg-slate-900 shadow-[0_20px_45px_rgba(15,23,42,0.18)] ring-1 ring-white/70 sm:min-w-[360px]"
    >
      <img
        src={getRestaurantImage(restaurant)}
        alt={restaurant.name}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        loading="lazy"
      />
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-35", restaurant.accent)} />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
      <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/92 px-3 text-[12px] font-extrabold text-slate-900 shadow-sm backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" strokeWidth={2.5} />
          Featured
        </span>
        {fitLabel && (
          <span className="inline-flex h-8 items-center rounded-full bg-[#020617] px-3 text-[11px] font-black text-white shadow-sm">
            {t(fitLabel)}
          </span>
        )}
        <span className="inline-flex h-8 items-center gap-1 rounded-full bg-black/35 px-3 text-[12px] font-bold text-white backdrop-blur">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={0} />
          {seedRating(restaurant.name)}
        </span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
        <h3 className="text-[22px] font-extrabold leading-tight tracking-normal">{restaurant.name}</h3>
        <p className="mt-1.5 line-clamp-2 max-w-[280px] text-[13px] font-medium leading-relaxed text-white/82">
          {restaurant.description}
        </p>
        <div className="mt-4 flex items-center gap-2 text-[12px] font-bold text-white/85">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
            <Clock className="h-3.5 w-3.5" />
            20-30 min
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
            <Utensils className="h-3.5 w-3.5" />
            {restaurant.meals} meals
          </span>
        </div>
      </div>
    </motion.article>
  );

  if (!restaurant.liveRestaurantId) return card;

  return (
    <Link to={`/restaurant/${restaurant.liveRestaurantId}`} className="block">
      {card}
    </Link>
  );
};

const RestaurantCard = ({
  restaurant,
  isFavorite,
  onToggleFavorite,
  goalType,
  t,
}: {
  restaurant: ShowcaseRestaurant;
  isFavorite: (restaurantId: string) => boolean;
  onToggleFavorite: (restaurantId: string | undefined, restaurantName: string) => void;
  goalType?: string | null;
  t: (key: string) => string;
}) => {
  const favorite = restaurant.liveRestaurantId ? isFavorite(restaurant.liveRestaurantId) : false;
  const reduceMotion = useReducedMotion();
  const fitLabel = getGoalFitLabel(goalType, restaurant);

  const card = (
    <motion.article
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      className="group overflow-hidden rounded-[22px] bg-white shadow-[0_12px_35px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_rgba(15,23,42,0.12)]"
    >
      <div className="relative h-[154px] overflow-hidden bg-slate-100 sm:h-[172px]">
        <img
          src={getRestaurantImage(restaurant)}
          alt={restaurant.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-white/92 px-2.5 text-[12px] font-extrabold text-slate-800 shadow-sm backdrop-blur">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={0} />
            {seedRating(restaurant.name)}
          </span>
          <button
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full bg-white/92 shadow-sm backdrop-blur transition active:scale-95",
              favorite ? "text-rose-500" : "text-slate-500 hover:text-rose-500",
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite(restaurant.liveRestaurantId, restaurant.name);
            }}
            aria-label={`Favorite ${restaurant.name}`}
          >
            <Heart className={cn("h-[18px] w-[18px]", favorite && "fill-current")} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-extrabold tracking-normal text-slate-950">{restaurant.name}</h3>
            <p className="mt-1 line-clamp-2 min-h-[40px] text-[13px] font-medium leading-relaxed text-slate-500">
              {restaurant.description}
            </p>
            {fitLabel && (
              <span className="mt-2 inline-flex h-7 items-center rounded-full bg-[#F3F4FF] px-2.5 text-[11px] font-black text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                {t(fitLabel)}
              </span>
            )}
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { Icon: Bike, value: "20-30", label: "min", tone: "text-sky-700" },
            { Icon: Utensils, value: restaurant.meals, label: "meals", tone: "text-[#020617]" },
            { Icon: ShieldCheck, value: "Macro", label: "checked", tone: "text-orange-700" },
          ].map(({ Icon, value, label, tone }) => (
            <div key={`${value}-${label}`} className="rounded-[16px] bg-white/75 px-2.5 py-2.5 ring-1 ring-slate-200/80 backdrop-blur">
              <div className={`flex items-center gap-1.5 ${tone}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                <span className="truncate text-[13px] font-black leading-none">{value}</span>
              </div>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.article>
  );

  if (!restaurant.liveRestaurantId) return card;

  return (
    <Link to={`/restaurant/${restaurant.liveRestaurantId}`} className="block">
      {card}
    </Link>
  );
};

const Meals = () => {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category");
  const initialQuery = searchParams.get("q") || "";
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [featuredRestaurantIds, setFeaturedRestaurantIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>(isMealCategory(initialCategory) ? initialCategory : "all");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const category = searchParams.get("category");
    const query = searchParams.get("q") || "";
    setSelectedCategory(isMealCategory(category) ? category : "all");
    setSearchQuery(query);
  }, [searchParams]);

  const handleToggleFavorite = useCallback(
    (restaurantId: string | undefined, restaurantName: string) => {
      if (!restaurantId) return;
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

        if (restaurantsError) {
          console.error("Error fetching restaurants:", restaurantsError);
          setFetchError(restaurantsError.message);
          return;
        }

        const ids = (restaurantsData ?? []).map((restaurant) => restaurant.id);
        let mealCounts: Record<string, number> = {};

        if (ids.length > 0) {
          const { data: mealsData, error: mealsError } = await supabase
            .from("meals")
            .select("restaurant_id")
            .in("restaurant_id", ids)
            .eq("approval_status", "approved")
            .eq("is_available", true);

          if (mealsError) {
            console.error("Error fetching meal counts:", mealsError);
          }

          if (mealsData) {
            mealCounts = mealsData.reduce<Record<string, number>>((acc, meal) => {
              if (meal.restaurant_id) acc[meal.restaurant_id] = (acc[meal.restaurant_id] || 0) + 1;
              return acc;
            }, {});
          }
        }

        setRestaurants(
          (restaurantsData ?? []).map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            description: restaurant.description,
            logo_url: restaurant.logo_url,
            image_url: restaurant.image_url,
            rating: Number(restaurant.rating || 0),
            total_orders: restaurant.total_orders || 0,
            meal_count: mealCounts[restaurant.id] || 0,
            cuisine_types: restaurant.cuisine_types || [],
          })),
        );

        const { data: featuredData, error: featuredError } = await supabase
          .from("featured_listings")
          .select("restaurant_id, status, starts_at, ends_at")
          .eq("status", "active")
          .lte("starts_at", new Date().toISOString())
          .gte("ends_at", new Date().toISOString());

        if (featuredError) {
          console.error("Error fetching featured listings:", featuredError);
        }

        if (featuredData) {
          setFeaturedRestaurantIds(featuredData.map((featured) => featured.restaurant_id));
        }
      } catch (error) {
        console.error("Error loading restaurants:", error);
        setFetchError(error instanceof Error ? error.message : "Failed to load restaurants");
      }
    })();
  }, []);

  useEffect(() => {
    document.title = "Discover Meals - Nutrio";
  }, []);

  const hydratedRestaurants = useMemo(
    () =>
      restaurantTemplates.map((template): ShowcaseRestaurant => {
        const liveRestaurant = restaurants.find((restaurant) => normalize(restaurant.name) === normalize(template.name));
        return {
          ...template,
          description: truncateDescription(liveRestaurant?.description, template.description),
          meals: liveRestaurant?.meal_count || template.meals,
          liveRestaurantId: liveRestaurant?.id,
          image: liveRestaurant?.image_url || liveRestaurant?.logo_url || template.image,
        };
      }),
    [restaurants],
  );

  const visibleRestaurants = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return hydratedRestaurants.filter((restaurant) => {
      const matchesSearch =
        !search || `${restaurant.name} ${restaurant.description}`.toLowerCase().includes(search);

      if (!matchesSearch) return false;
      if (showFavoritesOnly && !(restaurant.liveRestaurantId && isFavorite(restaurant.liveRestaurantId))) return false;

      if (selectedCategory !== "all") {
        const keywords = CATEGORY_KEYWORDS[selectedCategory];
        const liveData = restaurants.find((liveRestaurant) => liveRestaurant.id === restaurant.liveRestaurantId);
        const cuisineTypes = liveData?.cuisine_types ?? [];
        const matchesCuisine = cuisineTypes.some((cuisine) =>
          keywords.some((keyword) => cuisine.toLowerCase().includes(keyword)),
        );
        const matchesCopy = keywords.some((keyword) =>
          `${restaurant.name} ${restaurant.description}`.toLowerCase().includes(keyword),
        );

        if (!matchesCuisine && !matchesCopy) return false;
      }

      return true;
    });
  }, [hydratedRestaurants, isFavorite, restaurants, searchQuery, selectedCategory, showFavoritesOnly]);

  const featuredRestaurants = useMemo(() => {
    const matchesLiveFeatured = visibleRestaurants.filter(
      (restaurant) => restaurant.liveRestaurantId && featuredRestaurantIds.includes(restaurant.liveRestaurantId),
    );
    return matchesLiveFeatured.length > 0 ? matchesLiveFeatured : visibleRestaurants.slice(0, 4);
  }, [featuredRestaurantIds, visibleRestaurants]);

  const hasNoResults = visibleRestaurants.length === 0 && !fetchError;
  const mealBalancePercent = isUnlimited || totalMeals <= 0
    ? 100
    : Math.min(100, Math.round((remainingMeals / totalMeals) * 100));
  const remainingMealsLabel = subscriptionLoading
    ? "--"
    : isUnlimited
      ? "∞"
      : Math.max(0, remainingMeals).toLocaleString();

  return (
    <div className="min-h-full bg-[#F6F7F4]" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-30 border-b border-white/70 bg-[#F6F7F4]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[480px] items-center justify-between px-4 py-3">
          <Link
            to="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </Link>
          <div className="text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">{t("nutrio_meals")}</p>
            <p className="text-[14px] font-bold text-slate-900">{t("discover_restaurants")}</p>
          </div>
          <button
            onClick={() => setShowFavoritesOnly((value) => !value)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-1 transition active:scale-95",
              showFavoritesOnly
                ? "bg-rose-50 text-rose-500 ring-rose-100"
                : "bg-white text-slate-600 ring-slate-200",
            )}
            aria-label={t("toggle_favorites_aria")}
          >
            <Heart className={cn("h-5 w-5", showFavoritesOnly && "fill-current")} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[480px] px-4 pb-10 pt-5">
        {fetchError && (
          <div className="mb-5 flex items-start gap-3 rounded-[18px] bg-red-50 p-4 text-red-700 ring-1 ring-red-100">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2} />
            <div className="flex-1">
              <p className="font-bold">{t("meals_could_not_load")}</p>
              <p className="mt-1 text-[13px] text-red-600">{fetchError}</p>
              <button
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-white px-3 text-[13px] font-bold text-red-600 ring-1 ring-red-200"
                onClick={() => {
                  setFetchError(null);
                  window.location.reload();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                {t("retry")}
              </button>
            </div>
          </div>
        )}

        <section className="mb-4 overflow-hidden rounded-[24px] bg-[#F6F8FB] p-4 text-[#020617] shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">
                {t("your_subscription")}
              </p>
              <h1 className="mt-1 text-[24px] font-black leading-none tracking-normal">
                {remainingMealsLabel}
                <span className="ml-2 text-[13px] font-bold text-[#94A3B8]">
                  {isUnlimited
                    ? t("unlimited_meals")
                    : t("meals_left")}
                </span>
              </h1>
              <p className="mt-2 text-[12px] font-semibold text-[#94A3B8]">
                {subscriptionLoading
                  ? t("loading_meal_balance")
                  : hasActiveSubscription
                    ? isUnlimited
                      ? t("order_without_monthly_cap")
                      : isRTL
                        ? t("used_meals_this_cycle", { used: mealsUsed, total: totalMeals })
                        : t("used_meals_this_cycle", { used: mealsUsed, total: totalMeals })
                    : t("no_active_subscription_yet")}
              </p>
            </div>

            <Link
              to="/subscription"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#020617] text-white shadow-sm active:scale-95"
              aria-label={t("manage_subscription")}
            >
              <ShieldCheck className="h-5 w-5" strokeWidth={2.3} />
            </Link>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${mealBalancePercent}%` }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                !hasActiveSubscription && !subscriptionLoading
                  ? "bg-[#FB6B7A]"
                  : mealBalancePercent <= 20 && !isUnlimited
                    ? "bg-[#F97316]"
                    : "bg-[#22C7A1]",
              )}
            />
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-3 shadow-[0_14px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
          <div className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" strokeWidth={2.25} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("search_meals_placeholder") || "Search restaurants, cuisines, meals"}
                className="h-12 w-full rounded-[18px] bg-slate-50 pl-12 pr-4 text-[15px] font-bold text-slate-950 outline-none ring-1 ring-transparent transition placeholder:text-slate-400 focus:bg-white focus:ring-emerald-200"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {categoryTabs.map((category) => {
                const Icon = category.icon;
                const active = selectedCategory === category.id;

                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      Haptics.impact({ style: "light" });
                      setSelectedCategory(category.id);
                    }}
                    className={cn(
                      "relative flex h-12 shrink-0 items-center gap-2 rounded-[16px] px-4 text-[13px] font-extrabold transition",
                      active ? "text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="active-meal-category"
                        className="absolute inset-0 rounded-[16px] bg-slate-950"
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4" strokeWidth={2.4} />
                    <span className="relative z-10">{t(`meal_category_${category.id}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {hasNoResults ? (
          <section className="mt-8 flex min-h-[360px] flex-col items-center justify-center rounded-[28px] bg-white p-8 text-center ring-1 ring-slate-200">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Search className="h-8 w-8" strokeWidth={1.8} />
            </div>
            <h2 className="mt-5 text-[24px] font-black tracking-normal text-slate-950">{t("no_matches_found")}</h2>
            <p className="mt-2 max-w-[320px] text-[14px] font-medium leading-relaxed text-slate-500">{t("no_matches_hint")}</p>
            <button
              className="mt-5 h-11 rounded-full bg-slate-950 px-5 text-[14px] font-extrabold text-white transition active:scale-95"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
                setShowFavoritesOnly(false);
              }}
            >
              {t("clear_filters")}
            </button>
          </section>
        ) : (
          <>
            <section className="mt-5">
              <SmartMealPicks />
            </section>

            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">{t("curated_lineup")}</p>
                  <h2 className="mt-1 text-[24px] font-black tracking-normal text-slate-950">{t("featured_this_week")}</h2>
                </div>
                <span className="hidden rounded-full bg-white px-3 py-2 text-[12px] font-extrabold text-slate-500 ring-1 ring-slate-200 sm:inline-flex">
                  {t("picks_count", { count: featuredRestaurants.length })}
                </span>
              </div>
              <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide">
                {featuredRestaurants.map((restaurant) => (
                  <div key={`featured-${restaurant.name}`} className="snap-start">
                    <FeatureCard restaurant={restaurant} goalType={activeGoal?.goal_type} t={t} />
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                    {showFavoritesOnly ? "Saved places" : "All restaurants"}
                  </p>
                  <h2 className="mt-1 text-[24px] font-black tracking-normal text-slate-950">
                    {showFavoritesOnly ? "Your favorites" : "Explore restaurants"}
                  </h2>
                </div>
                <span className="rounded-full bg-white px-3 py-2 text-[12px] font-extrabold tabular-nums text-slate-500 ring-1 ring-slate-200">
                  {visibleRestaurants.length} {visibleRestaurants.length === 1 ? "place" : "places"}
                </span>
              </div>

              <div className="grid gap-4">
                {visibleRestaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.name}
                    restaurant={restaurant}
                    isFavorite={isFavorite}
                    onToggleFavorite={handleToggleFavorite}
                    goalType={activeGoal?.goal_type}
                    t={t}
                  />
                ))}
              </div>
            </section>
          </>
        )}
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
