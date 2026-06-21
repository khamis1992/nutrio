import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
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
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
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

const FeatureCard = ({ restaurant }: { restaurant: ShowcaseRestaurant }) => {
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
}: {
  restaurant: ShowcaseRestaurant;
  isFavorite: (restaurantId: string) => boolean;
  onToggleFavorite: (restaurantId: string | undefined, restaurantName: string) => void;
}) => {
  const favorite = restaurant.liveRestaurantId ? isFavorite(restaurant.liveRestaurantId) : false;
  const reduceMotion = useReducedMotion();

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
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] font-bold">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-emerald-700">
            <Bike className="h-3.5 w-3.5" />
            20-30 min
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-slate-100 px-2.5 text-slate-600">
            <Utensils className="h-3.5 w-3.5" />
            {restaurant.meals} meals
          </span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 text-amber-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Macro checked
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

const Meals = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [featuredRestaurantIds, setFeaturedRestaurantIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>("all");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  const { t, isRTL } = useLanguage();
  const reduceMotion = useReducedMotion();

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
            .in("restaurant_id", ids);

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

  return (
    <div className="min-h-full bg-[#F6F7F4]" dir={isRTL ? "rtl" : "ltr"}>
      <div className="sticky top-0 z-30 border-b border-white/70 bg-[#F6F7F4]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/dashboard"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
          </Link>
          <div className="text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">Nutrio meals</p>
            <p className="text-[14px] font-bold text-slate-900">Discover restaurants</p>
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

      <main className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 lg:px-8">
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

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-stretch">
          <div className="relative overflow-hidden rounded-[30px] bg-white p-5 text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 sm:p-7 lg:bg-slate-950 lg:text-white lg:shadow-[0_24px_70px_rgba(15,23,42,0.22)] lg:ring-0">
            <img
              src="/meals-header-illustration.png"
              alt=""
              className="absolute inset-y-0 right-0 hidden h-full w-[48%] object-cover opacity-60 mix-blend-screen lg:block"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(245,158,11,0.16),transparent_28%)] lg:bg-[radial-gradient(circle_at_12%_10%,rgba(16,185,129,0.45),transparent_32%),radial-gradient(circle_at_82%_20%,rgba(245,158,11,0.35),transparent_28%)]" />
            <div className="relative max-w-2xl">
              <span className="inline-flex h-9 items-center gap-2 rounded-full bg-emerald-50 px-3 text-[12px] font-extrabold uppercase tracking-[0.08em] text-emerald-700 ring-1 ring-emerald-100 backdrop-blur lg:bg-white/10 lg:text-emerald-100 lg:ring-white/15">
                <Flame className="h-4 w-4 text-amber-300" />
                Fresh in Doha
              </span>
              <h1 className="mt-5 max-w-[620px] text-[36px] font-black leading-[0.98] tracking-normal sm:text-[50px]">
                Choose meals that match your day.
              </h1>
              <p className="mt-4 max-w-[540px] text-[15px] font-medium leading-relaxed text-slate-600 sm:text-[16px] lg:text-white/72">
                Browse chef-made meals, compare nutrition signals, and schedule healthy delivery without leaving your plan.
              </p>

              <div className="mt-6 grid max-w-[520px] grid-cols-3 gap-2">
                {[
                  ["20-30", "min delivery"],
                  ["fresh", "daily prep"],
                  ["4.8", "avg rating"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/80 backdrop-blur lg:bg-white/10 lg:ring-white/12">
                    <p className="text-[22px] font-black tabular-nums">{value}</p>
                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 lg:text-white/55">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </section>

        <section className="mt-5 rounded-[24px] bg-white p-3 shadow-[0_14px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
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

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:pb-0">
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
                    <span className="relative z-10">{category.label}</span>
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
            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">Curated lineup</p>
                  <h2 className="mt-1 text-[24px] font-black tracking-normal text-slate-950">Featured this week</h2>
                </div>
                <span className="hidden rounded-full bg-white px-3 py-2 text-[12px] font-extrabold text-slate-500 ring-1 ring-slate-200 sm:inline-flex">
                  {featuredRestaurants.length} picks
                </span>
              </div>
              <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                {featuredRestaurants.map((restaurant) => (
                  <div key={`featured-${restaurant.name}`} className="snap-start">
                    <FeatureCard restaurant={restaurant} />
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

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleRestaurants.map((restaurant) => (
                  <RestaurantCard
                    key={restaurant.name}
                    restaurant={restaurant}
                    isFavorite={isFavorite}
                    onToggleFavorite={handleToggleFavorite}
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
