import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Dumbbell,
  Flame,
  Heart,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Soup,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { supabase } from "@/integrations/supabase/client";
import { Haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type MealCategory = "all" | "breakfast" | "lunch" | "dinner" | "snacks";
type CalorieRange = "all" | "under300" | "300-500" | "500-700" | "700plus";
type ActiveSort = "rating" | "fastest" | "popular";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
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

interface ShowcaseMealTemplate {
  name: string;
  restaurant: string;
  calories: number;
  protein: number;
  note: string;
  image: string;
  category: Exclude<MealCategory, "all">;
  badge?: string;
  proteinBadge?: string;
}

interface ShowcaseMeal extends ShowcaseMealTemplate {
  liveMealId?: string;
  restaurantId?: string;
}

interface RestaurantTemplate {
  name: string;
  description: string;
  meals: number;
  image: string;
}

interface ShowcaseRestaurant extends RestaurantTemplate {
  liveRestaurantId?: string;
}

const green = "#009F63";

const categoryTabs: Array<{ id: MealCategory; label: string; icon: LucideIcon }> = [
  { id: "all", label: "All Cuisine", icon: Utensils },
  { id: "breakfast", label: "Breakfast", icon: Coffee },
  { id: "lunch", label: "Lunch", icon: Soup },
  { id: "dinner", label: "Dinner", icon: Soup },
  { id: "snacks", label: "Snacks", icon: UtensilsCrossed },
];

const topPicks: ShowcaseMealTemplate[] = [
  {
    name: "Lean Beef Stir-Fry",
    restaurant: "Mediterranean Delights",
    calories: 580,
    protein: 35,
    note: "High in protein",
    badge: "Top",
    category: "lunch",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=90",
  },
  {
    name: "Chicken Tawook Plate",
    restaurant: "Lebanese Kitchen",
    calories: 520,
    protein: 38,
    note: "Rich in protein & flavor",
    category: "dinner",
    image: "https://images.unsplash.com/photo-1604908176997-431c8c7527a2?auto=format&fit=crop&w=900&q=90",
  },
  {
    name: "Organic Acai Bowl",
    restaurant: "Organic Harvest",
    calories: 380,
    protein: 32,
    note: "Antioxidant rich",
    category: "breakfast",
    image: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=900&q=90",
  },
];

const quickLight: ShowcaseMealTemplate[] = [
  {
    name: "Turkey Wrap",
    restaurant: "Mediterranean Delights",
    calories: 450,
    protein: 28,
    note: "Quick & filling",
    category: "lunch",
    image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=90",
  },
  {
    name: "Tabbouleh Salad",
    restaurant: "Lebanese Kitchen",
    calories: 180,
    protein: 4,
    note: "Quick & light",
    category: "lunch",
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=90",
  },
  {
    name: "Egg White Scramble",
    restaurant: "Mediterranean Delights",
    calories: 280,
    protein: 18,
    note: "Quick & light",
    category: "breakfast",
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=90",
  },
];

const highProtein: ShowcaseMealTemplate[] = [
  {
    name: "Grilled Chicken Salad",
    restaurant: "Mediterranean Delights",
    calories: 420,
    protein: 38,
    note: "High in protein",
    proteinBadge: "38g Protein",
    category: "lunch",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=90",
  },
  {
    name: "High-Protein Breakfast",
    restaurant: "Fitness Fuel Station",
    calories: 380,
    protein: 42,
    note: "High in protein",
    proteinBadge: "42g Protein",
    category: "breakfast",
    image: "https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=900&q=90",
  },
  {
    name: "Lean Turkey Meat",
    restaurant: "Fitness Fuel Station",
    calories: 380,
    protein: 36,
    note: "High in protein",
    proteinBadge: "36g Protein",
    category: "dinner",
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=90",
  },
];

const restaurantTemplates: RestaurantTemplate[] = [
  {
    name: "Lebanese Kitchen",
    description: "Traditional Lebanese...",
    meals: 4,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=90",
  },
  {
    name: "Mediterranean Delights",
    description: "Authentic Mediterranean...",
    meals: 16,
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=700&q=90",
  },
  {
    name: "Fitness Fuel Station",
    description: "High-protein meals...",
    meals: 4,
    image: "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=700&q=90",
  },
  {
    name: "Green Garden Vegan",
    description: "Plant-based restaurant...",
    meals: 4,
    image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=700&q=90",
  },
  {
    name: "Organic Harvest",
    description: "Farm-to-table...",
    meals: 4,
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=90",
  },
  {
    name: "Healthy Bites Cafe",
    description: "Casual dining with...",
    meals: 4,
    image: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=700&q=90",
  },
  {
    name: "Protein Hub",
    description: "High protein, great taste",
    meals: 4,
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=700&q=90",
  },
  {
    name: "Wellness Kitchen",
    description: "Balanced meals for...",
    meals: 4,
    image: "https://images.unsplash.com/photo-1550966871-3ed3c47e2ce2?auto=format&fit=crop&w=700&q=90",
  },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

const inCalorieRange = (calories: number, calorieRange: CalorieRange) => {
  if (calorieRange === "under300") return calories < 300;
  if (calorieRange === "300-500") return calories >= 300 && calories <= 500;
  if (calorieRange === "500-700") return calories > 500 && calories <= 700;
  if (calorieRange === "700plus") return calories > 700;
  return true;
};

const sortMeals = (items: ShowcaseMeal[], activeSort: ActiveSort) => {
  const sorted = [...items];
  if (activeSort === "fastest") sorted.sort((a, b) => a.calories - b.calories);
  if (activeSort === "popular") sorted.sort((a, b) => b.protein - a.protein);
  return sorted;
};

const truncateDescription = (value: string | null | undefined, fallback: string) => {
  const text = value?.trim() || fallback;
  if (text.length <= 26) return text;
  return `${text.slice(0, 23).trim()}...`;
};

const FilterSheet = ({
  isOpen,
  onClose,
  showFavoritesOnly,
  onToggleFavorites,
  activeSort,
  onChangeSort,
  calorieRange,
  onChangeCalorieRange,
}: {
  isOpen: boolean;
  onClose: () => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  activeSort: ActiveSort;
  onChangeSort: (sort: ActiveSort) => void;
  calorieRange: CalorieRange;
  onChangeCalorieRange: (range: CalorieRange) => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-slate-950/35" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-[560px] rounded-t-[34px] bg-white px-7 pb-9 pt-4 shadow-[0_-24px_60px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="mx-auto mb-7 block h-1.5 w-12 rounded-full bg-slate-200" onClick={onClose} aria-label="Close filters" />
        <div className="mb-7 flex items-center justify-between">
          <h2 className="text-[24px] font-extrabold text-[#151D2B]">Filters</h2>
          <button className="rounded-full bg-[#E8F7EE] px-4 py-2 text-[14px] font-bold text-[#009F63]" onClick={onClose}>
            Apply
          </button>
        </div>

        <FilterGroup title="Sort by">
          {[
            ["rating", "Recommended"],
            ["fastest", "Lightest"],
            ["popular", "Protein"],
          ].map(([id, label]) => (
            <FilterPill key={id} active={activeSort === id} onClick={() => onChangeSort(id as ActiveSort)}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>

        <FilterGroup title="Calories">
          {[
            ["all", "All"],
            ["under300", "Under 300"],
            ["300-500", "300-500"],
            ["500-700", "500-700"],
          ].map(([id, label]) => (
            <FilterPill key={id} active={calorieRange === id} onClick={() => onChangeCalorieRange(id as CalorieRange)}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>

        <button className="mt-2 flex w-full items-center justify-between rounded-2xl bg-slate-50 px-5 py-4" onClick={onToggleFavorites}>
          <span className="text-[15px] font-bold text-[#151D2B]">Favorites only</span>
          <span className={cn("relative h-8 w-14 rounded-full transition", showFavoritesOnly ? "bg-[#009F63]" : "bg-slate-200")}>
            <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition", showFavoritesOnly ? "left-7" : "left-1")} />
          </span>
        </button>
      </div>
    </div>
  );
};

const FilterGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mb-7">
    <p className="mb-3 text-[15px] font-extrabold text-[#151D2B]">{title}</p>
    <div className="flex flex-wrap gap-2.5">{children}</div>
  </div>
);

const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    className={cn(
      "rounded-full px-5 py-2.5 text-[14px] font-bold transition",
      active ? "bg-[#009F63] text-white shadow-[0_10px_20px_rgba(0,159,99,0.22)]" : "bg-slate-100 text-slate-500",
    )}
    onClick={onClick}
  >
    {children}
  </button>
);

const SectionHeading = ({
  icon: Icon,
  iconClassName,
  title,
  subtitle,
  showViewAll = true,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle?: string;
  showViewAll?: boolean;
}) => (
  <div className="mb-4 mt-7 flex items-end justify-between">
    <div className="flex items-start gap-3">
      <span className={cn("mt-0.5 flex h-8 w-8 items-center justify-center rounded-full", iconClassName)}>
        <Icon className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <div>
        <h2 className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-[#151D2B]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[15px] font-medium leading-tight text-[#748096]">{subtitle}</p>}
      </div>
    </div>
    {showViewAll && (
      <button className="mb-0.5 flex items-center gap-2 text-[15px] font-extrabold text-[#009F63]">
        View all
        <ChevronRight className="h-5 w-5" strokeWidth={3} />
      </button>
    )}
  </div>
);

const Meals = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [meals, setMeals] = useState<MealResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<ActiveSort>("rating");
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>("all");
  const [calorieRange, setCalorieRange] = useState<CalorieRange>("all");
  const [showMealsView, setShowMealsView] = useState(false);
  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();

  const handleToggleFavorite = useCallback(
    (restaurantId: string | undefined, restaurantName: string) => {
      if (!restaurantId) return;

      Haptics.impact({ style: "medium" });
      if (!user) {
        promptLogin({
          title: "Save your favorites",
          description: "Sign in to keep your favorite restaurants and meals synced.",
          actionLabel: "Sign in",
          signUpLabel: "Create free account",
        });
        return;
      }

      toggleFavorite(restaurantId, restaurantName);
    },
    [promptLogin, toggleFavorite, user],
  );

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

        const restaurantRows = restaurantsData ?? [];
        const restaurantIds = restaurantRows.map((restaurant) => restaurant.id);
        let mealCounts: Record<string, number> = {};
        let transformedMeals: MealResult[] = [];

        if (restaurantIds.length > 0) {
          const { data: mealsData, error: mealsError } = await supabase
            .from("meals")
            .select("id, name, calories, image_url, restaurant_id, is_available, price, protein_g, carbs_g, fat_g, meal_type")
            .in("restaurant_id", restaurantIds);

          if (mealsError) throw mealsError;

          const mealRows = mealsData ?? [];
          mealCounts = mealRows.reduce<Record<string, number>>((acc, meal) => {
            if (meal.restaurant_id) acc[meal.restaurant_id] = (acc[meal.restaurant_id] || 0) + 1;
            return acc;
          }, {});

          const restaurantsById = new Map(restaurantRows.map((restaurant) => [restaurant.id, restaurant]));
          transformedMeals = mealRows.map((meal) => {
            const restaurant = meal.restaurant_id ? restaurantsById.get(meal.restaurant_id) : undefined;
            return {
              id: meal.id,
              name: meal.name,
              calories: meal.calories,
              image_url: meal.image_url,
              restaurant_id: meal.restaurant_id,
              is_available: meal.is_available,
              restaurant_name: restaurant?.name || "Restaurant",
              restaurant_logo_url: restaurant?.logo_url || null,
              restaurant_rating: Number(restaurant?.rating || 0),
              restaurant_total_orders: restaurant?.total_orders || 0,
              price: meal.price,
              protein_g: meal.protein_g,
              carbs_g: meal.carbs_g,
              fat_g: meal.fat_g,
              meal_type: meal.meal_type,
            };
          });
        }

        setRestaurants(
          restaurantRows.map((restaurant) => ({
            id: restaurant.id,
            name: restaurant.name,
            description: restaurant.description,
            logo_url: restaurant.logo_url,
            rating: Number(restaurant.rating || 0),
            total_orders: restaurant.total_orders || 0,
            meal_count: mealCounts[restaurant.id] || 0,
            cuisine_types: restaurant.cuisine_types || [],
          })),
        );
        setMeals(transformedMeals);
      } catch (error) {
        console.error("Error fetching meals page data:", error);
      }
    };

    fetchData();
  }, []);

  const hydrateMeal = useCallback(
    (template: ShowcaseMealTemplate): ShowcaseMeal => {
      const mealMatch = meals.find((meal) => normalize(meal.name) === normalize(template.name));
      const restaurantMatch = restaurants.find((restaurant) => normalize(restaurant.name) === normalize(template.restaurant));

      return {
        ...template,
        liveMealId: mealMatch?.id,
        restaurantId: mealMatch?.restaurant_id || restaurantMatch?.id,
      };
    },
    [meals, restaurants],
  );

  const hydrateRestaurant = useCallback(
    (template: RestaurantTemplate): ShowcaseRestaurant => {
      const restaurantMatch = restaurants.find((restaurant) => normalize(restaurant.name) === normalize(template.name));

      return {
        ...template,
        description: truncateDescription(restaurantMatch?.description, template.description),
        meals: restaurantMatch?.meal_count || template.meals,
        liveRestaurantId: restaurantMatch?.id,
      };
    },
    [restaurants],
  );

  const search = searchQuery.trim().toLowerCase();

  const filterMeals = useCallback(
    (items: ShowcaseMealTemplate[]) => {
      const hydrated = items.map(hydrateMeal).filter((item) => {
        const matchesSearch = !search || `${item.name} ${item.restaurant} ${item.note}`.toLowerCase().includes(search);
        const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
        const matchesCalories = inCalorieRange(item.calories, calorieRange);
        const matchesFavorite = !showFavoritesOnly || Boolean(item.restaurantId && isFavorite(item.restaurantId));
        return matchesSearch && matchesCategory && matchesCalories && matchesFavorite;
      });

      return sortMeals(hydrated, activeSort);
    },
    [activeSort, calorieRange, hydrateMeal, isFavorite, search, selectedCategory, showFavoritesOnly],
  );

  const visibleTopPicks = useMemo(() => filterMeals(topPicks), [filterMeals]);
  const visibleQuickLight = useMemo(() => filterMeals(quickLight), [filterMeals]);
  const visibleHighProtein = useMemo(() => filterMeals(highProtein), [filterMeals]);
  const visibleRestaurants = useMemo(
    () =>
      restaurantTemplates.map(hydrateRestaurant).filter((restaurant) => {
        const matchesSearch = !search || `${restaurant.name} ${restaurant.description}`.toLowerCase().includes(search);
        const matchesFavorite = !showFavoritesOnly || Boolean(restaurant.liveRestaurantId && isFavorite(restaurant.liveRestaurantId));
        return matchesSearch && matchesFavorite;
      }),
    [hydrateRestaurant, isFavorite, search, showFavoritesOnly],
  );

  const allVisibleMeals = [...visibleTopPicks, ...visibleQuickLight, ...visibleHighProtein];
  const hasResults = allVisibleMeals.length > 0 || visibleRestaurants.length > 0;

  return (
    <div
      className="min-h-screen bg-[#FBFCFC] pb-[164px] text-[#151D2B]"
      style={{ background: "radial-gradient(circle at 14% 0%, rgba(0,159,99,0.08), transparent 31%), #FBFCFC" }}
    >
      <div className="mx-auto w-full max-w-[1008px] px-5 pt-8 sm:px-8 md:px-12">
        <header className="flex items-start justify-between">
          <div className="flex items-start gap-7">
            <Link
              to="/dashboard"
              className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full bg-white text-[#151D2B] shadow-[0_12px_28px_rgba(15,23,42,0.09)] ring-1 ring-slate-100"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-[25px] w-[25px]" strokeWidth={2.5} />
            </Link>
            <div className="pt-1">
              <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.04em]">Meals</h1>
              <p className="mt-3 text-[17px] font-medium leading-none text-[#748096]">Discover healthy meals and great restaurants</p>
            </div>
          </div>
        </header>

        <div className="relative mt-8">
          <Search className="pointer-events-none absolute left-7 top-1/2 h-[28px] w-[28px] -translate-y-1/2 text-[#5E6A80]" strokeWidth={2.4} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search meals, restaurants..."
            className="h-[70px] w-full rounded-full border border-[#DCE3EA] bg-white pl-[76px] pr-[86px] text-[18px] font-semibold text-[#151D2B] shadow-[0_16px_40px_rgba(15,23,42,0.06)] outline-none placeholder:text-[#7C879A]"
          />
          <button
            className="absolute right-2 top-1/2 flex h-[58px] w-[58px] -translate-y-1/2 items-center justify-center rounded-full bg-[#DDF8E5] text-[#009F63]"
            onClick={() => setFilterSheetOpen(true)}
            aria-label="Open filters"
          >
            <SlidersHorizontal className="h-[24px] w-[24px]" strokeWidth={2.7} />
          </button>
        </div>

        <div className="mt-8 flex gap-5 overflow-x-auto pb-2 scrollbar-hide">
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
                  "flex h-[58px] shrink-0 items-center gap-3 rounded-full px-7 text-[16px] font-extrabold shadow-[0_10px_24px_rgba(15,23,42,0.07)] transition",
                  active ? "bg-[#009F63] text-white" : "bg-white text-[#151D2B] ring-1 ring-slate-100",
                )}
              >
                <Icon className={cn("h-[24px] w-[24px]", active ? "text-white" : "text-[#5E6A80]")} strokeWidth={2.25} />
                {category.label}
              </button>
            );
          })}
        </div>

        <main>
          <SectionHeading icon={Star} iconClassName="bg-transparent text-[#009F63]" title="Recommended for you" showViewAll={false} />
          <button className="flex h-[82px] w-full items-center justify-between rounded-[29px] border border-[#F5DCAE] bg-[#FFF9ED] px-5 shadow-[inset_0_0_38px_rgba(255,202,90,0.13)]">
            <div className="flex items-center gap-5">
              <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-[#FFE497] text-[#C47A00]">
                <Sparkles className="h-7 w-7" strokeWidth={2.4} />
              </span>
              <span className="text-left">
                <span className="block text-[17px] font-extrabold leading-tight text-[#151D2B]">Suggested for you</span>
                <span className="mt-1 block text-[15px] font-medium leading-tight text-[#515A6C]">Based on your past orders</span>
              </span>
            </div>
            <ChevronRight className="h-7 w-7 text-[#151D2B]" strokeWidth={3} />
          </button>

          {hasResults ? (
            <>
              {visibleTopPicks.length > 0 && (
                <MealSection icon={Flame} iconClassName="bg-transparent text-[#FF6B2B]" title="Top Picks" meals={visibleTopPicks} onToggleFavorite={handleToggleFavorite} isFavorite={isFavorite} />
              )}

              {visibleQuickLight.length > 0 && (
                <MealSection icon={Clock3} iconClassName="bg-[#FFE7DC] text-[#FF5D2A]" subtitle="Light meals, big satisfaction" title="Quick & Light" meals={visibleQuickLight} onToggleFavorite={handleToggleFavorite} isFavorite={isFavorite} />
              )}

              {visibleHighProtein.length > 0 && (
                <MealSection icon={Dumbbell} iconClassName="bg-[#DDF8E5] text-[#009F63]" subtitle="Fuel your body, reach your goals" title="High Protein Goals" meals={visibleHighProtein} onToggleFavorite={handleToggleFavorite} isFavorite={isFavorite} />
              )}

              <RestaurantSection
                restaurants={visibleRestaurants}
                showMealsView={showMealsView}
                onChangeView={setShowMealsView}
                isFavorite={isFavorite}
                onToggleFavorite={handleToggleFavorite}
                meals={allVisibleMeals}
              />
            </>
          ) : (
            <div className="mt-10 rounded-[28px] bg-white px-8 py-14 text-center shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
              <Utensils className="mx-auto mb-4 h-12 w-12 text-[#009F63]" />
              <h2 className="text-[22px] font-extrabold text-[#151D2B]">No matches found</h2>
              <p className="mx-auto mt-2 max-w-[360px] text-[15px] font-medium text-[#748096]">Try a different search or clear filters to see all meals and restaurants.</p>
            </div>
          )}
        </main>
      </div>

      <FilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavorites={() => setShowFavoritesOnly((value) => !value)}
        activeSort={activeSort}
        onChangeSort={setActiveSort}
        calorieRange={calorieRange}
        onChangeCalorieRange={setCalorieRange}
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

const MealSection = ({
  icon,
  iconClassName,
  title,
  subtitle,
  meals,
  onToggleFavorite,
  isFavorite,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle?: string;
  meals: ShowcaseMeal[];
  onToggleFavorite: (restaurantId: string | undefined, restaurantName: string) => void;
  isFavorite: (restaurantId: string) => boolean;
}) => (
  <section>
    <SectionHeading icon={icon} iconClassName={iconClassName} title={title} subtitle={subtitle} />
    <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
      {meals.map((meal) => (
        <MealCard key={`${title}-${meal.name}`} meal={meal} onToggleFavorite={onToggleFavorite} isFavorite={isFavorite} />
      ))}
    </div>
  </section>
);

const MealCard = ({
  meal,
  onToggleFavorite,
  isFavorite,
}: {
  meal: ShowcaseMeal;
  onToggleFavorite: (restaurantId: string | undefined, restaurantName: string) => void;
  isFavorite: (restaurantId: string) => boolean;
}) => {
  const favorite = meal.restaurantId ? isFavorite(meal.restaurantId) : false;
  const card = (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.09)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.12)]">
      <div className="relative h-[154px] overflow-hidden bg-slate-100">
        <img src={meal.image} alt={meal.name} className="h-full w-full object-cover" loading="lazy" />
        <button
          className="absolute right-3 top-3 flex h-[45px] w-[45px] items-center justify-center rounded-full bg-slate-950/38 text-white backdrop-blur-sm transition hover:bg-slate-950/48"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite(meal.restaurantId, meal.restaurant);
          }}
          aria-label={`Favorite ${meal.name}`}
        >
          <Heart className={cn("h-7 w-7", favorite && "fill-white")} strokeWidth={2.6} />
        </button>

        {meal.badge && <span className="absolute left-4 top-4 rounded-full bg-[#FF7A1A] px-3.5 py-1.5 text-[14px] font-extrabold leading-none text-white">{meal.badge}</span>}
        {meal.proteinBadge && <span className="absolute right-[54px] top-3 rounded-full bg-[#009F63] px-3.5 py-1.5 text-[13px] font-extrabold leading-none text-white shadow-[0_8px_16px_rgba(0,159,99,0.25)]">{meal.proteinBadge}</span>}
      </div>

      <div className="px-4 pb-4 pt-3.5">
        <h3 className="truncate text-[18px] font-extrabold leading-tight tracking-[-0.02em] text-[#151D2B]">{meal.name}</h3>
        <p className="mt-1 truncate text-[15px] font-semibold leading-tight text-[#748096]">{meal.restaurant}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[#E2F8EA] px-2.5 text-[14px] font-extrabold text-[#009F63]">
            <Flame className="h-4 w-4" strokeWidth={2.4} />
            {meal.calories}
          </span>
          <span className="text-[15px] font-extrabold text-[#009F63]">P {meal.protein}g</span>
        </div>
        <p className="mt-3 flex items-center gap-2 truncate text-[14px] font-semibold text-[#748096]">
          <span className="text-[#F5B52E]">✹</span>
          {meal.note}
        </p>
      </div>
    </div>
  );

  if (meal.liveMealId) return <Link to={`/meals/${meal.liveMealId}`}>{card}</Link>;
  return card;
};

const RestaurantSection = ({
  restaurants,
  showMealsView,
  onChangeView,
  isFavorite,
  onToggleFavorite,
  meals,
}: {
  restaurants: ShowcaseRestaurant[];
  showMealsView: boolean;
  onChangeView: (value: boolean) => void;
  isFavorite: (restaurantId: string) => boolean;
  onToggleFavorite: (restaurantId: string | undefined, restaurantName: string) => void;
  meals: ShowcaseMeal[];
}) => (
  <section className="mt-8">
    <div className="mb-5 flex items-center justify-between">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[#009F63]">
          <Store className="h-6 w-6" strokeWidth={2.4} />
        </span>
        <div>
          <h2 className="text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-[#151D2B]">Restaurants</h2>
          <p className="mt-0.5 text-[15px] font-medium leading-tight text-[#748096]">42 Restaurants</p>
        </div>
      </div>

      <div className="flex h-[52px] w-[226px] items-center rounded-full bg-[#F1F3F5] p-1.5 text-[15px] font-extrabold text-[#8A95A6]">
        <button
          className={cn("h-full flex-1 rounded-full transition", !showMealsView && "bg-[#DDF8E5] text-[#009F63] shadow-[0_8px_16px_rgba(15,23,42,0.04)]")}
          onClick={() => onChangeView(false)}
        >
          Restaurants
        </button>
        <button
          className={cn("h-full flex-1 rounded-full transition", showMealsView && "bg-[#DDF8E5] text-[#009F63] shadow-[0_8px_16px_rgba(15,23,42,0.04)]")}
          onClick={() => onChangeView(true)}
        >
          Meals
        </button>
      </div>
    </div>

    {showMealsView ? (
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
        {meals.map((meal) => (
          <MealCard key={`restaurant-meal-${meal.name}`} meal={meal} onToggleFavorite={onToggleFavorite} isFavorite={isFavorite} />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {restaurants.map((restaurant) => (
          <RestaurantCard key={restaurant.name} restaurant={restaurant} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>
    )}
  </section>
);

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
  const card = (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_8px_20px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
      <div className="relative h-[126px] overflow-hidden bg-slate-100">
        <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover" loading="lazy" />
        <button
          className="absolute right-3 top-3 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-white text-[#151D2B] shadow-[0_8px_18px_rgba(15,23,42,0.12)] transition hover:scale-105"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleFavorite(restaurant.liveRestaurantId, restaurant.name);
          }}
          aria-label={`Favorite ${restaurant.name}`}
        >
          <Heart className={cn("h-6 w-6", favorite && "fill-[#009F63] text-[#009F63]")} strokeWidth={2.4} />
        </button>
      </div>
      <div className="px-3.5 pb-4 pt-3">
        <h3 className="truncate text-[16px] font-extrabold leading-tight tracking-[-0.02em] text-[#151D2B]">{restaurant.name}</h3>
        <p className="mt-1 truncate text-[14px] font-semibold leading-tight text-[#748096]">{restaurant.description}</p>
        <p className="mt-2 text-[14px] font-bold leading-tight text-[#748096]">{restaurant.meals} Meals</p>
      </div>
    </div>
  );

  if (restaurant.liveRestaurantId) return <Link to={`/restaurant/${restaurant.liveRestaurantId}`}>{card}</Link>;
  return card;
};

export default Meals;
