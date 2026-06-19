import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle, ArrowLeft, Coffee, Heart, RefreshCw, Search,
  Store, Soup, Utensils, UtensilsCrossed, Star, ChevronRight,
  Clock, Flame, Leaf, type LucideIcon,
} from "lucide-react";
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { supabase } from "@/integrations/supabase/client";
import { Haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type MealCategory = "all" | "breakfast" | "lunch" | "dinner" | "snacks";

interface Restaurant { id: string; name: string; description: string | null; logo_url: string | null; rating: number; total_orders: number; meal_count: number; cuisine_types?: string[]; }
interface RestaurantTemplate { name: string; description: string; meals: number; image: string; }
interface ShowcaseRestaurant extends RestaurantTemplate { liveRestaurantId?: string; }

/* ── Category segments — iOS segmented control style ── */
const categoryTabs: Array<{ id: MealCategory; labelKey: string; icon: LucideIcon }> = [
  { id: "all",       labelKey: "all_cuisine",  icon: Utensils },
  { id: "breakfast", labelKey: "breakfast",    icon: Coffee },
  { id: "lunch",     labelKey: "lunch",        icon: Soup },
  { id: "dinner",    labelKey: "dinner",       icon: UtensilsCrossed },
  { id: "snacks",    labelKey: "snacks_tab",   icon: Leaf },
];

const CATEGORY_KEYWORDS: Record<MealCategory, string[]> = {
  all:       [],
  breakfast: ["breakfast", "morning", "brunch", "cafe"],
  lunch:     ["lunch", "midday", "arabic", "lebanese", "mediterranean", "salad"],
  dinner:    ["dinner", "evening", "grill", "grilled", "bbq", "steak", "seafood"],
  snacks:    ["snack", "snacks", "light", "dessert", "sweet", "vegan", "healthy", "protein", "fitness"],
};

const restaurantTemplates: RestaurantTemplate[] = [
  { name: "Lebanese Kitchen",       description: "Traditional Lebanese cuisine with fresh herbs and spices",    meals: 4,  image: "/meals-header-illustration.png" },
  { name: "Mediterranean Delights",  description: "Authentic Mediterranean bowls and wraps",                     meals: 16, image: "/meals-header-illustration.png" },
  { name: "Fitness Fuel Station",    description: "High-protein meals designed for active lifestyles",           meals: 4,  image: "/meals-header-illustration.png" },
  { name: "Green Garden Vegan",      description: "Plant-based restaurant with seasonal ingredients",            meals: 4,  image: "/meals-header-illustration.png" },
  { name: "Organic Harvest",         description: "Farm-to-table meals from local Qatar farms",                  meals: 4,  image: "/meals-header-illustration.png" },
  { name: "Healthy Bites Cafe",      description: "Casual dining with balanced nutrition options",               meals: 4,  image: "/meals-header-illustration.png" },
  { name: "Protein Hub",             description: "High protein, great taste — built for gains",                 meals: 4,  image: "/meals-header-illustration.png" },
  { name: "Wellness Kitchen",        description: "Balanced meals for everyday wellness",                        meals: 4,  image: "/meals-header-illustration.png" },
];

/* ── Stable random seed per restaurant name (no Math.random in render) ── */
const seedRating = (name: string): string => {
  const seed = name.charCodeAt(0) + name.charCodeAt(name.length - 1);
  const rating = 4 + ((seed % 10) / 10);
  return rating.toFixed(1);
};

const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
const truncDesc = (v: string | null | undefined, fb: string) => { const t = v?.trim() || fb; return t.length <= 60 ? t : `${t.slice(0, 57).trim()}...`; };

/* ════════════════════════════════════════════════════════════════════
   RESTAURANT ROW — native horizontal card (Uber Eats / Talabat style)
   ════════════════════════════════════════════════════════════════════ */
const RestaurantRow = ({ restaurant, isFavorite, onToggleFavorite }: { restaurant: ShowcaseRestaurant; isFavorite: (rid: string) => boolean; onToggleFavorite: (rid: string | undefined, rn: string) => void; }) => {
  const fav = restaurant.liveRestaurantId ? isFavorite(restaurant.liveRestaurantId) : false;
  const reduceMotion = useReducedMotion();

  const row = (
    <motion.div
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={reduceMotion ? undefined : { type: "spring", stiffness: 400, damping: 28 }}
      className="relative flex gap-3.5 overflow-hidden rounded-[18px] bg-white ring-1 ring-black/[0.06] active:ring-emerald-200/60"
    >
      {/* Image — left side, 96x96 rounded square (native app pattern) */}
      <div className="relative h-[96px] w-[96px] shrink-0 overflow-hidden rounded-[14px] m-3 bg-emerald-50/60">
        {restaurant.image && restaurant.image !== "/meals-header-illustration.png" ? (
          <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Store className="h-6 w-6 text-emerald-300" strokeWidth={1.5} />
          </div>
        )}
        {/* Rating badge — bottom-left of image, native overlay style */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 shadow-sm backdrop-blur-sm">
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" strokeWidth={0} />
          <span className="text-[11px] font-semibold tabular-nums text-slate-700">{seedRating(restaurant.name)}</span>
        </div>
      </div>

      {/* Content — right side, fills remaining width */}
      <div className="flex flex-1 flex-col justify-center py-3 pr-3.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-slate-900 truncate">{restaurant.name}</h3>
          {/* Favorite — heart icon, native tap target */}
          <button
            className="-mr-1 -mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition active:scale-90"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(restaurant.liveRestaurantId, restaurant.name); }}
            aria-label={`Favorite ${restaurant.name}`}
          >
            <Heart className={cn("h-[18px] w-[18px] transition-colors", fav ? "fill-emerald-500 text-emerald-500" : "text-slate-300")} strokeWidth={2} />
          </button>
        </div>
        <p className="mt-0.5 text-[13px] font-normal leading-snug text-slate-500 line-clamp-2">{restaurant.description}</p>
        {/* Meta row — delivery time + meal count, native app metadata */}
        <div className="mt-2 flex items-center gap-2.5 text-[12px] font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" strokeWidth={2} />
            <span className="tabular-nums">20-30 min</span>
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-200" />
          <span className="tabular-nums">{restaurant.meals} meals</span>
        </div>
      </div>

      {/* Chevron — right edge, native navigation cue */}
      <ChevronRight className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" strokeWidth={2.5} />
    </motion.div>
  );

  if (restaurant.liveRestaurantId) return <Link to={`/restaurant/${restaurant.liveRestaurantId}`} className="block">{row}</Link>;
  return row;
};

/* ════════════════════════════════════════════════════════════════════
   FEATURED CAROUSEL CARD — horizontal scroll featured restaurants
   ════════════════════════════════════════════════════════════════════ */
const FeaturedCard = ({ restaurant }: { restaurant: ShowcaseRestaurant }) => {
  const reduceMotion = useReducedMotion();
  const card = (
    <motion.div
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      transition={reduceMotion ? undefined : { type: "spring", stiffness: 400, damping: 28 }}
      className="relative h-[180px] w-[260px] shrink-0 overflow-hidden rounded-[20px] bg-white ring-1 ring-black/[0.06]"
    >
      {/* Full-bleed image area */}
      <div className="relative h-full w-full bg-gradient-to-br from-emerald-50 to-emerald-100/40">
        {restaurant.image && restaurant.image !== "/meals-header-illustration.png" ? (
          <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-end p-4">
            <Store className="h-8 w-8 text-emerald-300/60" strokeWidth={1.5} />
          </div>
        )}
        {/* Dark gradient overlay bottom — native app image overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {/* Content overlaid on image bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-white">Featured</span>
            <div className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" strokeWidth={0} />
              <span className="text-[11px] font-semibold tabular-nums text-slate-700">{seedRating(restaurant.name)}</span>
            </div>
          </div>
          <h3 className="mt-2 text-[16px] font-semibold leading-tight tracking-[-0.01em] text-white">{restaurant.name}</h3>
          <p className="mt-0.5 text-[12px] font-normal text-white/80 line-clamp-1">{restaurant.description}</p>
        </div>
      </div>
    </motion.div>
  );

  if (restaurant.liveRestaurantId) return <Link to={`/restaurant/${restaurant.liveRestaurantId}`} className="block">{card}</Link>;
  return card;
};

/* ════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════ */
const Meals = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>("all");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  const handleToggleFavorite = useCallback((rid: string | undefined, rn: string) => {
    if (!rid) return; Haptics.impact({ style: "medium" });
    if (!user) { promptLogin({ title: t("save_your_favorites"), description: t("sign_in_to_save_favorites_desc"), actionLabel: t("sign_in"), signUpLabel: t("create_free_account") }); return; }
    toggleFavorite(rid, rn);
  }, [promptLogin, toggleFavorite, user]);

  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: rd, error: rdError } = await supabase
          .from("restaurants")
          .select("id, name, description, logo_url, rating, total_orders, cuisine_types")
          .eq("approval_status", "approved")
          .eq("is_active", true)
          .neq("name", "test")
          .not("name", "ilike", "%test%")
          .not("description", "ilike", "%test%");

        if (rdError) { console.error("Error fetching restaurants:", rdError); setFetchError(rdError.message); return; }
        if (!rd) return;

        const ids = rd.map((r) => r.id);
        let mc: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: md, error: mdError } = await supabase.from("meals").select("restaurant_id").in("restaurant_id", ids);
          if (mdError) { console.error("Error fetching meal counts:", mdError); }
          if (md) { mc = md.reduce<Record<string, number>>((a, m) => { if (m.restaurant_id) a[m.restaurant_id] = (a[m.restaurant_id] || 0) + 1; return a; }, {}); }
        }

        setRestaurants(rd.map((r) => ({
          id: r.id, name: r.name, description: r.description, logo_url: r.logo_url,
          rating: Number(r.rating || 0), total_orders: r.total_orders || 0,
          meal_count: mc[r.id] || 0, cuisine_types: r.cuisine_types || [],
        })));
      } catch (e) {
        console.error("Error loading restaurants:", e);
        setFetchError(e instanceof Error ? e.message : "Failed to load restaurants");
      }
    })();
  }, []);

  const hydrateRestaurant = useCallback((t: RestaurantTemplate): ShowcaseRestaurant => {
    const rm = restaurants.find((r) => normalize(r.name) === normalize(t.name));
    const image = rm?.logo_url || t.image;
    return { ...t, description: truncDesc(rm?.description, t.description), meals: rm?.meal_count || t.meals, liveRestaurantId: rm?.id, image };
  }, [restaurants]);

  const search = searchQuery.trim().toLowerCase();

  const visibleRestaurants = restaurantTemplates.map(hydrateRestaurant).filter((r) => {
    const ms = !search || `${r.name} ${r.description}`.toLowerCase().includes(search);
    if (!ms) return false;
    if (showFavoritesOnly && !(r.liveRestaurantId && isFavorite(r.liveRestaurantId))) return false;
    if (selectedCategory !== "all") {
      const keywords = CATEGORY_KEYWORDS[selectedCategory];
      const liveData = restaurants.find((lr) => lr.id === r.liveRestaurantId);
      const cuisineTypes = liveData?.cuisine_types ?? [];
      const matchesCuisine = cuisineTypes.some((ct) => keywords.some((kw) => ct.toLowerCase().includes(kw)));
      const matchesName = keywords.some((kw) => `${r.name} ${r.description}`.toLowerCase().includes(kw));
      if (!matchesCuisine && !matchesName) return false;
    }
    return true;
  });

  const featuredRestaurants = visibleRestaurants.slice(0, 4);
  const allRestaurants = visibleRestaurants;
  const hasNoResults = visibleRestaurants.length === 0 && restaurantTemplates.length > 0 && !fetchError;

  useEffect(() => { document.title = `${t("nav_meals")} — Nutrio`; }, [t]);

  /* ── iOS-style large title header that doesn't collapse (simpler for SPA) ── */
  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* ═══ Error State ═══ */}
      {fetchError && (
        <div className="px-5 pt-6 pb-2">
          <div className="flex items-start gap-3 rounded-[16px] bg-red-50 p-4 ring-1 ring-red-100">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" strokeWidth={2} />
            <div className="flex-1">
              <p className="font-semibold text-red-700">{t("meals_could_not_load")}</p>
              <p className="mt-0.5 text-[13px] text-red-500">{fetchError}</p>
              <button
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-red-600 ring-1 ring-red-200 transition active:scale-95"
                onClick={() => { setFetchError(null); window.location.reload(); }}
              >
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
                {t("retry")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Sticky Compact Nav Bar — native iOS pattern ═══ */}
      <div className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/85 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-3">
          <Link
            to="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-90"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </Link>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
            {t("discover")} {t("meals")}
          </span>
          <button
            onClick={() => setShowFavoritesOnly((v) => !v)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90",
              showFavoritesOnly ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
            )}
            aria-label={t("toggle_favorites_aria")}
          >
            <Heart className={cn("h-[18px] w-[18px]", showFavoritesOnly && "fill-emerald-500")} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ═══ Search Bar — native iOS search field ═══ */}
      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder={t("search_meals_placeholder")}
            className="h-11 w-full rounded-[12px] bg-slate-100/80 pl-10 text-[15px] font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-emerald-400/20"
          />
          {isSearchFocused && searchQuery && (
            <button
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition active:scale-90"
              onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ═══ Category Segmented Control — horizontal scroll pills ═══ */}
      <div className="px-5 pt-3">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-hide">
          {categoryTabs.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => { Haptics.impact({ style: "light" }); setSelectedCategory(cat.id); }}
                className={cn(
                  "relative flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                  active ? "text-white" : "text-slate-600"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="category-pill"
                    className="absolute inset-0 rounded-full bg-emerald-600"
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {!active && (
                  <div className="absolute inset-0 rounded-full bg-slate-100" />
                )}
                <Icon className={cn("relative z-10 h-[15px] w-[15px]", active ? "text-white" : "text-slate-400")} strokeWidth={2.25} />
                <span className="relative z-10">{t(cat.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Content Area ═══ */}
      <main className="px-5 pt-5 pb-6">
        {hasNoResults ? (
          /* ── Empty State — native iOS illustration + helpful copy + CTA ── */
          <div className="flex flex-col items-center pt-16 text-center">
            <div className="flex h-[80px] w-[80px] items-center justify-center rounded-full bg-emerald-50">
              <Search className="h-8 w-8 text-emerald-300" strokeWidth={1.5} />
            </div>
            <h2 className="mt-5 text-[19px] font-semibold tracking-[-0.015em] text-slate-900">{t("no_matches_found")}</h2>
            <p className="mt-2 max-w-[260px] text-[14px] font-normal leading-relaxed text-slate-500">{t("no_matches_hint")}</p>
            <button
              className="mt-5 rounded-full bg-emerald-600 px-5 py-2.5 text-[14px] font-semibold text-white transition active:scale-95"
              onClick={() => { setSearchQuery(""); setSelectedCategory("all"); Haptics.impact({ style: "light" }); }}
            >
              {t("clear_filters")}
            </button>
          </div>
        ) : (
          <>
            {/* ── Featured Carousel — horizontal scroll (native app pattern) ── */}
            {featuredRestaurants.length > 0 && selectedCategory === "all" && !search && !showFavoritesOnly && (
              <section className="mb-7">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                    <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">Featured Picks</h2>
                  </div>
                  <span className="text-[13px] font-medium text-slate-400">See all</span>
                </div>
                <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
                  {featuredRestaurants.map((r) => (
                    <FeaturedCard key={`f-${r.name}`} restaurant={r} />
                  ))}
                </div>
              </section>
            )}

            {/* ── All Restaurants — vertical list (native app pattern) ── */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">
                  {showFavoritesOnly ? "Your Favorites" : t("restaurants")}
                </h2>
                <span className="text-[13px] font-medium tabular-nums text-slate-400">
                  {visibleRestaurants.length} {visibleRestaurants.length === 1 ? "place" : "places"}
                </span>
              </div>

              {/* Vertical stack of row cards — native list pattern */}
              <div className="flex flex-col gap-3">
                {allRestaurants.map((r) => (
                  <RestaurantRow key={r.name} restaurant={r} isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <GuestLoginPrompt open={showLoginPrompt} onOpenChange={setShowLoginPrompt} title={loginPromptConfig.title} description={loginPromptConfig.description} actionLabel={loginPromptConfig.actionLabel} signUpLabel={loginPromptConfig.signUpLabel} />
    </div>
  );
};

export default Meals;