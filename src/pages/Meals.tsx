import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coffee, Heart, Search, SlidersHorizontal, Store, Soup, Utensils, UtensilsCrossed, type LucideIcon } from "lucide-react";
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

const categoryTabs: Array<{ id: MealCategory; labelKey: string; icon: LucideIcon }> = [
  { id: "all", labelKey: "all_cuisine", icon: Utensils },
  { id: "breakfast", labelKey: "breakfast", icon: Coffee },
  { id: "lunch", labelKey: "lunch", icon: Soup },
  { id: "dinner", labelKey: "dinner", icon: Soup },
  { id: "snacks", labelKey: "snacks_tab", icon: UtensilsCrossed },
];

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
    return ms && (!showFavoritesOnly || Boolean(r.liveRestaurantId && isFavorite(r.liveRestaurantId)));
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="mx-auto w-full max-w-[430px] px-4 pt-6">

        {/* Header */}
        <header className="flex items-start justify-between">
          <div className="flex items-start gap-6">
            <Link to="/dashboard" className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100" aria-label="Back"><ArrowLeft className="h-[22px] w-[22px]" strokeWidth={2} /></Link>
            <div className="pt-0.5"><h1 className="text-[34px] font-extrabold text-slate-900 tracking-[-0.03em]">{t("meals")}</h1><p className="mt-2 text-[16px] font-medium text-slate-500">{t("meals_page_subtitle")}</p></div>
          </div>
        </header>

        {/* Search */}
        <div className="relative mt-7">
          <Search className="pointer-events-none absolute left-6 top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-slate-400" strokeWidth={2} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("search_meals_placeholder")} className="h-[60px] w-full rounded-full bg-white pl-[68px] pr-[16px] text-[16px] font-semibold text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-400 transition-shadow" />
        </div>

        {/* Category tabs */}
        <div className="mt-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {categoryTabs.map((cat) => { const Icon = cat.icon; const active = selectedCategory === cat.id; return (
            <button key={cat.id} onClick={() => { Haptics.impact({ style: "light" }); setSelectedCategory(cat.id); }} className={cn("flex h-[46px] shrink-0 items-center gap-2.5 rounded-full px-5 text-[14px] font-extrabold transition-all", active ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]" : "bg-white text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-200")}>
              <Icon className={cn("h-[18px] w-[18px]", active ? "text-white" : "text-slate-400")} strokeWidth={2.25} />{t(cat.labelKey)}
            </button>
          );})}
        </div>

        {/* Content */}
        <main>
          {visibleRestaurants.length > 0 ? (
            <>
              {/* Favorites toggle */}
              <div className="mt-6 mb-4 flex items-center justify-end">
                <button onClick={() => setShowFavoritesOnly((v) => !v)} className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-bold transition", showFavoritesOnly ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500")}>
                  <Heart className={cn("h-4 w-4", showFavoritesOnly && "fill-emerald-500 text-emerald-500")} strokeWidth={2} />
                  {t("favorites_only")}
                </button>
              </div>

              {/* Restaurant section */}
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-emerald-500"><Store className="h-6 w-6" strokeWidth={2.4} /></span>
                    <div><h2 className="text-[20px] font-extrabold text-slate-900">{t("restaurants")}</h2><p className="mt-0.5 text-[15px] font-medium text-slate-500">{t("restaurants_count_label", { count: String(restaurants.length) })}</p></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {visibleRestaurants.map((r) => <RestaurantCard key={r.name} restaurant={r} isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />)}
                </div>
              </section>
            </>
          ) : (
            <div className="mt-10 rounded-2xl bg-white px-8 py-14 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"><Utensils className="mx-auto mb-4 h-10 w-10 text-emerald-500" /><h2 className="text-[20px] font-extrabold text-slate-900">{t("no_matches_found")}</h2><p className="mx-auto mt-2 max-w-[360px] text-[14px] font-medium text-slate-500">{t("no_matches_hint")}</p></div>
          )}
        </main>
      </div>

      <GuestLoginPrompt open={showLoginPrompt} onOpenChange={setShowLoginPrompt} title={loginPromptConfig.title} description={loginPromptConfig.description} actionLabel={loginPromptConfig.actionLabel} signUpLabel={loginPromptConfig.signUpLabel} />
    </div>
  );
};

export default Meals;
