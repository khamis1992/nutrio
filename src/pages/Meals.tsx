import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coffee, Heart, Search, Store, Soup, Utensils, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
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

const categoryTabs: Array<{ id: MealCategory; labelKey: string; icon: LucideIcon; activeClass: string; shadowClass: string }> = [
  { id: "all",       labelKey: "all_cuisine",  icon: Utensils,       activeClass: "bg-emerald-500 text-white",  shadowClass: "shadow-[0_4px_12px_rgba(16,185,129,0.30)]" },
  { id: "breakfast", labelKey: "breakfast",    icon: Coffee,         activeClass: "bg-amber-400 text-white",    shadowClass: "shadow-[0_4px_12px_rgba(245,158,11,0.35)]" },
  { id: "lunch",     labelKey: "lunch",        icon: Soup,           activeClass: "bg-orange-500 text-white",   shadowClass: "shadow-[0_4px_12px_rgba(249,115,22,0.35)]" },
  { id: "dinner",    labelKey: "dinner",       icon: Soup,           activeClass: "bg-indigo-500 text-white",   shadowClass: "shadow-[0_4px_12px_rgba(99,102,241,0.35)]" },
  { id: "snacks",    labelKey: "snacks_tab",   icon: UtensilsCrossed, activeClass: "bg-pink-500 text-white",    shadowClass: "shadow-[0_4px_12px_rgba(236,72,153,0.35)]" },
];

// Map each category to cuisine_type keywords used in the database
const CATEGORY_KEYWORDS: Record<MealCategory, string[]> = {
  all:       [],
  breakfast: ["breakfast", "morning", "brunch", "cafe"],
  lunch:     ["lunch", "midday", "arabic", "lebanese", "mediterranean", "salad"],
  dinner:    ["dinner", "evening", "grill", "grilled", "bbq", "steak", "seafood"],
  snacks:    ["snack", "snacks", "light", "dessert", "sweet", "vegan", "healthy", "protein", "fitness"],
};

const restaurantTemplates: RestaurantTemplate[] = [
  { name: "Lebanese Kitchen", description: "Traditional Lebanese...", meals: 4, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=90" },
  { name: "Mediterranean Delights", description: "Authentic Mediterranean...", meals: 16, image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=700&q=90" },
  { name: "Fitness Fuel Station", description: "High-protein meals...", meals: 4, image: "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=700&q=90" },
  { name: "Green Garden Vegan", description: "Plant-based restaurant...", meals: 4, image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=700&q=90" },
  { name: "Organic Harvest", description: "Farm-to-table...", meals: 4, image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=700&q=90" },
  { name: "Healthy Bites Cafe", description: "Casual dining with...", meals: 4, image: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=700&q=90" },
  { name: "Protein Hub", description: "High protein, great taste", meals: 4, image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=700&q=90" },
  { name: "Wellness Kitchen", description: "Balanced meals for...", meals: 4, image: "https://images.unsplash.com/photo-1550966871-3ed3c47e2ce2?auto=format&fit=crop&w=700&q=90" },
];

const normalize = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
const truncDesc = (v: string | null | undefined, fb: string) => { const t = v?.trim() || fb; return t.length <= 26 ? t : `${t.slice(0, 23).trim()}...`; };

/* ═══════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════ */

const RestaurantCard = ({ restaurant, isFavorite, onToggleFavorite }: { restaurant: ShowcaseRestaurant; isFavorite: (rid: string) => boolean; onToggleFavorite: (rid: string | undefined, rn: string) => void; }) => {
  const { t } = useLanguage();
  const fav = restaurant.liveRestaurantId ? isFavorite(restaurant.liveRestaurantId) : false;
  const card = (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
      <div className="relative h-[126px] overflow-hidden bg-slate-100">
        <img src={restaurant.image} alt={restaurant.name} className="h-full w-full object-cover" loading="lazy" />
        <button className="absolute right-3 top-3 flex h-[40px] w-[40px] items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_4px_12px_rgba(15,23,42,0.1)] hover:scale-105 transition" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(restaurant.liveRestaurantId, restaurant.name); }} aria-label={`Favorite ${restaurant.name}`}><Heart className={cn("h-5 w-5", fav && "fill-emerald-500 text-emerald-500")} strokeWidth={2.4} /></button>
      </div>
      <div className="px-3.5 pb-4 pt-3">
        <h3 className="truncate text-[16px] font-extrabold text-slate-900">{restaurant.name}</h3>
        <p className="mt-1 truncate text-[13px] font-semibold text-slate-500">{restaurant.description}</p>
        <p className="mt-2 text-[13px] font-bold text-slate-500">{t("meals_count", { count: String(restaurant.meals) })}</p>
      </div>
    </div>
  );
  if (restaurant.liveRestaurantId) return <Link to={`/restaurant/${restaurant.liveRestaurantId}`}>{card}</Link>;
  return card;
};

/* ═══════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════ */

const Meals = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MealCategory>("all");
  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { user } = useAuth();
  const { showLoginPrompt, setShowLoginPrompt, promptLogin, loginPromptConfig } = useGuestLoginPrompt();
  const { t } = useLanguage();

  const handleToggleFavorite = useCallback((rid: string | undefined, rn: string) => {
    if (!rid) return; Haptics.impact({ style: "medium" });
    if (!user) { promptLogin({ title: "Save your favorites", description: "Sign in to keep your favorite restaurants and meals synced.", actionLabel: "Sign in", signUpLabel: "Create free account" }); return; }
    toggleFavorite(rid, rn);
  }, [promptLogin, toggleFavorite, user]);

  useEffect(() => { (async () => { try { const { data: rd } = await supabase.from("restaurants").select("id, name, description, logo_url, rating, total_orders, cuisine_types").eq("approval_status","approved").eq("is_active",true).neq("name","test").not("name","ilike","%test%").not("description","ilike","%test%"); if (!rd) return; const ids = rd.map((r) => r.id); let mc: Record<string, number> = {}; if (ids.length > 0) { const { data: md } = await supabase.from("meals").select("restaurant_id").in("restaurant_id", ids); if (md) { mc = md.reduce<Record<string, number>>((a, m) => { if (m.restaurant_id) a[m.restaurant_id] = (a[m.restaurant_id] || 0) + 1; return a; }, {}); } } setRestaurants(rd.map((r) => ({ id: r.id, name: r.name, description: r.description, logo_url: r.logo_url, rating: Number(r.rating || 0), total_orders: r.total_orders || 0, meal_count: mc[r.id] || 0, cuisine_types: r.cuisine_types || [] }))); } catch (e) { console.error(e); } })(); }, []);

  const hydrateRestaurant = useCallback((t: RestaurantTemplate): ShowcaseRestaurant => { const rm = restaurants.find((r) => normalize(r.name) === normalize(t.name)); return { ...t, description: truncDesc(rm?.description, t.description), meals: rm?.meal_count || t.meals, liveRestaurantId: rm?.id }; }, [restaurants]);
  const search = searchQuery.trim().toLowerCase();

  const visibleRestaurants = restaurantTemplates.map(hydrateRestaurant).filter((r) => {
    const ms = !search || `${r.name} ${r.description}`.toLowerCase().includes(search);
    if (!ms) return false;
    if (showFavoritesOnly && !(r.liveRestaurantId && isFavorite(r.liveRestaurantId))) return false;
    if (selectedCategory !== "all") {
      const keywords = CATEGORY_KEYWORDS[selectedCategory];
      const liveData = restaurants.find((lr) => lr.id === r.liveRestaurantId);
      const cuisineTypes = liveData?.cuisine_types ?? [];
      // Check cuisine_types from DB first, then fall back to name/description keyword match
      const matchesCuisine = cuisineTypes.some((ct) =>
        keywords.some((kw) => ct.toLowerCase().includes(kw))
      );
      const matchesName = keywords.some((kw) =>
        `${r.name} ${r.description}`.toLowerCase().includes(kw)
      );
      if (!matchesCuisine && !matchesName) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Hero Header: Illustration on Gradient ── */}
      <div className="sticky top-0 z-20">
        <div className="mx-auto w-full max-w-[430px] overflow-hidden">

          {/* Gradient banner with illustration */}
          <div
            className="relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #059669 100%)",
              paddingTop: "env(safe-area-inset-top, 0px)",
            }}
          >
            {/* Illustration background */}
            <img
              src="/meals-header-illustration.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
              style={{ opacity: 0.18, mixBlendMode: "luminosity" }}
            />

            {/* Ambient glow circles */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-[180px] w-[180px] rounded-full" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 70%)" }} />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-[140px] w-[140px] rounded-full" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.18) 0%, transparent 70%)" }} />

            <div className="relative z-10 px-5 pt-5 pb-0">
              {/* Top row: back + actions */}
              <div className="flex items-center justify-between mb-4">
                <Link
                  to="/dashboard"
                  className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white backdrop-blur-sm transition active:scale-95"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-[20px] w-[20px]" strokeWidth={2.5} />
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFavoritesOnly((v) => !v)}
                    className={cn(
                      "flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full border backdrop-blur-sm transition active:scale-95",
                      showFavoritesOnly
                        ? "border-rose-300/60 bg-rose-500/80 text-white"
                        : "border-white/20 bg-white/15 text-white"
                    )}
                    aria-label="Toggle favorites"
                  >
                    <Heart className={cn("h-[18px] w-[18px]", showFavoritesOnly && "fill-white")} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Title block */}
              <div className="mb-5">
                <h1 className="text-[30px] font-black leading-[1.1] tracking-[-0.03em] text-white">
                  Discover{" "}
                  <em className="not-italic text-emerald-300">{t("meals")}</em>
                  <br />You&apos;ll Love
                </h1>
                <p className="mt-1.5 text-[13px] font-medium text-white/65">
                  {t("meals_page_subtitle")}
                </p>
              </div>

              {/* Search bar — floats on gradient */}
              <div
                className="-mx-5 rounded-t-[20px] bg-white px-4 pt-4 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
              >
                <div className="relative mb-3">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" strokeWidth={2} />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("search_meals_placeholder")}
                    className="h-[48px] w-full rounded-[14px] border border-slate-200 bg-slate-50 pl-[42px] pr-[16px] text-[14px] font-semibold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 transition-all"
                  />
                </div>

                {/* Category tabs */}
                <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
                  {categoryTabs.map((cat) => {
                    const Icon = cat.icon;
                    const active = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { Haptics.impact({ style: "light" }); setSelectedCategory(cat.id); }}
                        className={cn(
                          "flex h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold transition-all",
                          active
                            ? `${cat.activeClass} ${cat.shadowClass}`
                            : "border border-slate-200 bg-slate-50 text-slate-600"
                        )}
                      >
                        <Icon className={cn("h-[13px] w-[13px]", active ? "text-white" : "text-slate-400")} strokeWidth={2.25} />
                        {t(cat.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* thin separator */}
        <div className="h-px bg-slate-100" />
      </div>

      {/* ── Scrollable content ── */}
      <div className="mx-auto w-full max-w-[430px] px-4 pb-20 pt-4">
        <main>
          {visibleRestaurants.length > 0 ? (
            <>
              {/* Favorites toggle */}
              <div className="mb-4 flex items-center justify-end">
                <button
                  onClick={() => setShowFavoritesOnly((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-bold transition",
                    showFavoritesOnly ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"
                  )}
                >
                  <Heart className={cn("h-4 w-4", showFavoritesOnly && "fill-emerald-500 text-emerald-500")} strokeWidth={2} />
                  {t("favorites_only")}
                </button>
              </div>

              {/* Restaurant section */}
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-emerald-500">
                      <Store className="h-6 w-6" strokeWidth={2.4} />
                    </span>
                    <div>
                      <h2 className="text-[20px] font-extrabold text-slate-900">{t("restaurants")}</h2>
                      <p className="mt-0.5 text-[15px] font-medium text-slate-500">{t("restaurants_count_label", { count: String(restaurants.length) })}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {visibleRestaurants.map((r) => (
                    <RestaurantCard key={r.name} restaurant={r} isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="mt-10 rounded-2xl bg-white px-8 py-14 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <Utensils className="mx-auto mb-4 h-10 w-10 text-emerald-500" />
              <h2 className="text-[20px] font-extrabold text-slate-900">{t("no_matches_found")}</h2>
              <p className="mx-auto mt-2 max-w-[360px] text-[14px] font-medium text-slate-500">{t("no_matches_hint")}</p>
            </div>
          )}
        </main>
      </div>

      <GuestLoginPrompt open={showLoginPrompt} onOpenChange={setShowLoginPrompt} title={loginPromptConfig.title} description={loginPromptConfig.description} actionLabel={loginPromptConfig.actionLabel} signUpLabel={loginPromptConfig.signUpLabel} />
    </div>
  );
};

export default Meals;
