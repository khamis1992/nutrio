import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronRight, Clock3, Coffee, Dumbbell, Flame, Heart, Search, SlidersHorizontal, Star, Store, Soup, Utensils, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { GuestLoginPrompt, useGuestLoginPrompt } from "@/components/GuestLoginPrompt";
import { SmartRecommendations } from "@/components/SmartRecommendations";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { supabase } from "@/integrations/supabase/client";
import { Haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════
   DESIGN SYSTEM — Single accent (emerald), surface ladder
   Cards: rounded-2xl, subtle shadow + ring, pill geometry
   ═══════════════════════════════════════════════ */

type MealCategory = "all" | "breakfast" | "lunch" | "dinner" | "snacks";
type CalorieRange = "all" | "under300" | "300-500" | "500-700" | "700plus";
type ActiveSort = "rating" | "fastest" | "popular";

interface Restaurant { id: string; name: string; description: string | null; logo_url: string | null; rating: number; total_orders: number; meal_count: number; cuisine_types?: string[]; }
interface MealResult { id: string; name: string; calories: number | null; image_url: string | null; restaurant_id: string | null; is_available: boolean | null; restaurant_name: string; restaurant_logo_url: string | null; restaurant_rating: number; restaurant_total_orders: number; price: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; meal_type: string | null; }
interface ShowcaseMealTemplate { name: string; restaurant: string; calories: number; protein: number; note: string; image: string; category: Exclude<MealCategory, "all">; badge?: string; proteinBadge?: string; }
interface ShowcaseMeal extends ShowcaseMealTemplate { liveMealId?: string; restaurantId?: string; }
interface RestaurantTemplate { name: string; description: string; meals: number; image: string; }
interface ShowcaseRestaurant extends RestaurantTemplate { liveRestaurantId?: string; }

const categoryTabs: Array<{ id: MealCategory; labelKey: string; icon: LucideIcon }> = [
  { id: "all", labelKey: "all_cuisine", icon: Utensils },
  { id: "breakfast", labelKey: "breakfast", icon: Coffee },
  { id: "lunch", labelKey: "lunch", icon: Soup },
  { id: "dinner", labelKey: "dinner", icon: Soup },
  { id: "snacks", labelKey: "snacks_tab", icon: UtensilsCrossed },
];

const topPicks: ShowcaseMealTemplate[] = [
  { name: "Lean Beef Stir-Fry", restaurant: "Mediterranean Delights", calories: 580, protein: 35, note: "High in protein", badge: "Top", category: "lunch", image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=90" },
  { name: "Chicken Tawook Plate", restaurant: "Lebanese Kitchen", calories: 520, protein: 38, note: "Rich in protein & flavor", category: "dinner", image: "https://images.unsplash.com/photo-1604908176997-431c8c7527a2?auto=format&fit=crop&w=900&q=90" },
  { name: "Organic Acai Bowl", restaurant: "Organic Harvest", calories: 380, protein: 32, note: "Antioxidant rich", category: "breakfast", image: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=900&q=90" },
];

const quickLight: ShowcaseMealTemplate[] = [
  { name: "Turkey Wrap", restaurant: "Mediterranean Delights", calories: 450, protein: 28, note: "Quick & filling", category: "lunch", image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=90" },
  { name: "Tabbouleh Salad", restaurant: "Lebanese Kitchen", calories: 180, protein: 4, note: "Quick & light", category: "lunch", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=90" },
  { name: "Egg White Scramble", restaurant: "Mediterranean Delights", calories: 280, protein: 18, note: "Quick & light", category: "breakfast", image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=90" },
];

const highProtein: ShowcaseMealTemplate[] = [
  { name: "Grilled Chicken Salad", restaurant: "Mediterranean Delights", calories: 420, protein: 38, note: "High in protein", proteinBadge: "38g Protein", category: "lunch", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=90" },
  { name: "High-Protein Breakfast", restaurant: "Fitness Fuel Station", calories: 380, protein: 42, note: "High in protein", proteinBadge: "42g Protein", category: "breakfast", image: "https://images.unsplash.com/photo-1495214783159-3503fd1b572d?auto=format&fit=crop&w=900&q=90" },
  { name: "Lean Turkey Meat", restaurant: "Fitness Fuel Station", calories: 380, protein: 36, note: "High in protein", proteinBadge: "36g Protein", category: "dinner", image: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=90" },
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
const inCalorieRange = (c: number, r: CalorieRange) => r === "under300" ? c < 300 : r === "300-500" ? c >= 300 && c <= 500 : r === "500-700" ? c > 500 && c <= 700 : r === "700plus" ? c > 700 : true;
const sortMeals = (items: ShowcaseMeal[], s: ActiveSort) => { const sorted = [...items]; if (s === "fastest") sorted.sort((a, b) => a.calories - b.calories); if (s === "popular") sorted.sort((a, b) => b.protein - a.protein); return sorted; };
const truncDesc = (v: string | null | undefined, fb: string) => { const t = v?.trim() || fb; return t.length <= 26 ? t : `${t.slice(0, 23).trim()}...`; };

/* ═══════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════ */

const FilterSheet = ({ isOpen, onClose, showFavoritesOnly, onToggleFavorites, activeSort, onChangeSort, calorieRange, onChangeCalorieRange }: { isOpen: boolean; onClose: () => void; showFavoritesOnly: boolean; onToggleFavorites: () => void; activeSort: ActiveSort; onChangeSort: (s: ActiveSort) => void; calorieRange: CalorieRange; onChangeCalorieRange: (r: CalorieRange) => void; }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/35" onClick={onClose}>
      <div className="mx-auto w-full max-w-[560px] rounded-t-[34px] bg-white px-7 pb-9 pt-4 shadow-[0_-24px_60px_rgba(15,23,42,0.15)]" onClick={(e) => e.stopPropagation()}>
        <button className="mx-auto mb-7 block h-1.5 w-12 rounded-full bg-slate-200" onClick={onClose} aria-label="Close" />
        <div className="mb-7 flex items-center justify-between"><h2 className="text-[24px] font-extrabold text-slate-900">{t("filters")}</h2><button className="rounded-full bg-emerald-50 px-4 py-2 text-[14px] font-bold text-emerald-600" onClick={onClose}>{t("apply")}</button></div>
        <FilterGroup title={t("sort_by")}>
          {[[t("sort_recommended"),"rating"],[t("sort_lightest"),"fastest"],[t("sort_protein"),"popular"]].map(([label,id])=>(<FilterPill key={id} active={activeSort===id} onClick={()=>onChangeSort(id as ActiveSort)}>{label}</FilterPill>))}
        </FilterGroup>
        <FilterGroup title={t("filter_calories")}>
          {[[t("all"),"all"],[t("under_300"),"under300"],[t("range_300_500"),"300-500"],[t("range_500_700"),"500-700"]].map(([label,id])=>(<FilterPill key={id} active={calorieRange===id} onClick={()=>onChangeCalorieRange(id as CalorieRange)}>{label}</FilterPill>))}
        </FilterGroup>
        <button className="mt-2 flex w-full items-center justify-between rounded-2xl bg-slate-50 px-5 py-4" onClick={onToggleFavorites}>
          <span className="text-[15px] font-bold text-slate-800">{t("favorites_only")}</span>
          <span className={cn("relative h-8 w-14 rounded-full transition", showFavoritesOnly ? "bg-emerald-500" : "bg-slate-200")}><span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition", showFavoritesOnly ? "left-7" : "left-1")} /></span>
        </button>
      </div>
    </div>
  );
};

const FilterGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="mb-7"><p className="mb-3 text-[15px] font-extrabold text-slate-800">{title}</p><div className="flex flex-wrap gap-2.5">{children}</div></div>
);

const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button className={cn("rounded-full px-5 py-2.5 text-[14px] font-bold transition", active ? "bg-emerald-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]" : "bg-slate-100 text-slate-500")} onClick={onClick}>{children}</button>
);

const SectionHeading = ({ icon: Icon, iconClassName, title, subtitle, showViewAll = true, viewAllHref }: { icon: LucideIcon; iconClassName: string; title: string; subtitle?: string; showViewAll?: boolean; viewAllHref?: string; }) => {
  const { t } = useLanguage();
  return (
  <div className="mb-4 mt-7 flex items-end justify-between">
    <div className="flex items-start gap-3">
      <span className={cn("mt-0.5 flex h-8 w-8 items-center justify-center rounded-full", iconClassName)}><Icon className="h-5 w-5" strokeWidth={2.5} /></span>
      <div><h2 className="text-[20px] font-extrabold leading-tight text-slate-900">{title}</h2>{subtitle && <p className="mt-0.5 text-[15px] font-medium text-slate-500">{subtitle}</p>}</div>
    </div>
    {showViewAll && (viewAllHref ? <Link to={viewAllHref} className="mb-0.5 flex items-center gap-2 text-[15px] font-extrabold text-emerald-600">{t("view_all")} <ChevronRight className="h-5 w-5" strokeWidth={3} /></Link> : <button className="mb-0.5 flex items-center gap-2 text-[15px] font-extrabold text-emerald-600">{t("view_all")} <ChevronRight className="h-5 w-5" strokeWidth={3} /></button>)}
  </div>
  );
};

const MealSection = ({ icon, iconClassName, title, subtitle, meals, onToggleFavorite, isFavorite }: { icon: LucideIcon; iconClassName: string; title: string; subtitle?: string; meals: ShowcaseMeal[]; onToggleFavorite: (rid: string | undefined, rn: string) => void; isFavorite: (rid: string) => boolean; }) => (
  <section><SectionHeading icon={icon} iconClassName={iconClassName} title={title} subtitle={subtitle} /><div className="grid grid-cols-2 gap-5 md:grid-cols-3">{meals.map((m) => (<MealCard key={`${title}-${m.name}`} meal={m} onToggleFavorite={onToggleFavorite} isFavorite={isFavorite} />))}</div></section>
);

const MealCard = ({ meal, onToggleFavorite, isFavorite }: { meal: ShowcaseMeal; onToggleFavorite: (rid: string | undefined, rn: string) => void; isFavorite: (rid: string) => boolean; }) => {
  const { t } = useLanguage();
  const fav = meal.restaurantId ? isFavorite(meal.restaurantId) : false;
  const card = (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)]">
      <div className="relative h-[154px] overflow-hidden bg-slate-100">
        <img src={meal.image} alt={meal.name} className="h-full w-full object-cover" loading="lazy" />
        <button className="absolute right-3 top-3 flex h-[40px] w-[40px] items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(meal.restaurantId, meal.restaurant); }} aria-label={`Favorite ${meal.name}`}><Heart className={cn("h-5 w-5", fav && "fill-white")} strokeWidth={2.5} /></button>
        {meal.badge && <span className="absolute left-4 top-4 rounded-full bg-orange-500 px-3 py-1 text-[13px] font-extrabold text-white shadow-sm">{meal.badge}</span>}
        {meal.proteinBadge && <span className="absolute right-[54px] top-3 rounded-full bg-emerald-500 px-3 py-1 text-[12px] font-extrabold text-white shadow-[0_4px_10px_rgba(16,185,129,0.25)]">{meal.proteinBadge}</span>}
      </div>
      <div className="px-4 pb-4 pt-3.5">
        <h3 className="truncate text-[17px] font-extrabold leading-tight text-slate-900">{meal.name}</h3>
        <p className="mt-1 truncate text-[14px] font-semibold text-slate-500">{meal.restaurant}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[13px] font-extrabold text-emerald-600"><Flame className="h-4 w-4" strokeWidth={2.4} />{meal.calories}</span>
          <span className="text-[14px] font-extrabold text-emerald-600">{t("protein_g_label", { protein: String(meal.protein) })}</span>
        </div>
        <p className="mt-3 flex items-center gap-2 truncate text-[13px] font-semibold text-slate-500"><span className="text-amber-400">✹</span>{meal.note}</p>
      </div>
    </div>
  );
  if (meal.liveMealId) return <Link to={`/meals/${meal.liveMealId}`}>{card}</Link>;
  return card;
};

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
  const { t } = useLanguage();

  const handleToggleFavorite = useCallback((rid: string | undefined, rn: string) => {
    if (!rid) return; Haptics.impact({ style: "medium" });
    if (!user) { promptLogin({ title: "Save your favorites", description: "Sign in to keep your favorite restaurants and meals synced.", actionLabel: "Sign in", signUpLabel: "Create free account" }); return; }
    toggleFavorite(rid, rn);
  }, [promptLogin, toggleFavorite, user]);

  useEffect(() => { (async () => { try { const { data: rd } = await supabase.from("restaurants").select("id, name, description, logo_url, rating, total_orders, cuisine_types").eq("approval_status","approved").eq("is_active",true).neq("name","test").not("name","ilike","%test%").not("description","ilike","%test%"); if (!rd) return; const ids = rd.map((r) => r.id); let mc: Record<string, number> = {}; let tm: MealResult[] = []; if (ids.length > 0) { const { data: md } = await supabase.from("meals").select("id, name, calories, image_url, restaurant_id, is_available, price, protein_g, carbs_g, fat_g, meal_type").in("restaurant_id", ids); if (md) { mc = md.reduce<Record<string, number>>((a, m) => { if (m.restaurant_id) a[m.restaurant_id] = (a[m.restaurant_id] || 0) + 1; return a; }, {}); const byId = new Map(rd.map((r) => [r.id, r])); tm = md.map((m) => { const r = m.restaurant_id ? byId.get(m.restaurant_id) : undefined; return { id: m.id, name: m.name, calories: m.calories, image_url: m.image_url, restaurant_id: m.restaurant_id, is_available: m.is_available, restaurant_name: r?.name || "Restaurant", restaurant_logo_url: r?.logo_url || null, restaurant_rating: Number(r?.rating || 0), restaurant_total_orders: r?.total_orders || 0, price: m.price, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g, meal_type: m.meal_type }; }); } } setRestaurants(rd.map((r) => ({ id: r.id, name: r.name, description: r.description, logo_url: r.logo_url, rating: Number(r.rating || 0), total_orders: r.total_orders || 0, meal_count: mc[r.id] || 0, cuisine_types: r.cuisine_types || [] }))); setMeals(tm); } catch (e) { console.error(e); } })(); }, []);

  const hydrateMeal = useCallback((t: ShowcaseMealTemplate): ShowcaseMeal => { const mm = meals.find((m) => normalize(m.name) === normalize(t.name)); const rm = restaurants.find((r) => normalize(r.name) === normalize(t.restaurant)); return { ...t, liveMealId: mm?.id, restaurantId: mm?.restaurant_id || rm?.id }; }, [meals, restaurants]);
  const hydrateRestaurant = useCallback((t: RestaurantTemplate): ShowcaseRestaurant => { const rm = restaurants.find((r) => normalize(r.name) === normalize(t.name)); return { ...t, description: truncDesc(rm?.description, t.description), meals: rm?.meal_count || t.meals, liveRestaurantId: rm?.id }; }, [restaurants]);
  const search = searchQuery.trim().toLowerCase();

  const filterMeals = useCallback((items: ShowcaseMealTemplate[]) => {
    const hydrated = items.map(hydrateMeal).filter((item) => {
      const ms = !search || `${item.name} ${item.restaurant} ${item.note}`.toLowerCase().includes(search);
      return ms && (selectedCategory === "all" || item.category === selectedCategory) && inCalorieRange(item.calories, calorieRange) && (!showFavoritesOnly || Boolean(item.restaurantId && isFavorite(item.restaurantId)));
    });
    return sortMeals(hydrated, activeSort);
  }, [activeSort, calorieRange, hydrateMeal, isFavorite, search, selectedCategory, showFavoritesOnly]);

  const visibleTopPicks = useMemo(() => filterMeals(topPicks), [filterMeals]);
  const visibleQuickLight = useMemo(() => filterMeals(quickLight), [filterMeals]);
  const visibleHighProtein = useMemo(() => filterMeals(highProtein), [filterMeals]);
  const visibleRestaurants = useMemo(() => restaurantTemplates.map(hydrateRestaurant).filter((r) => { const ms = !search || `${r.name} ${r.description}`.toLowerCase().includes(search); return ms && (!showFavoritesOnly || Boolean(r.liveRestaurantId && isFavorite(r.liveRestaurantId))); }), [hydrateRestaurant, isFavorite, search, showFavoritesOnly]);
  const allVisible = [...visibleTopPicks, ...visibleQuickLight, ...visibleHighProtein];
  const hasResults = allVisible.length > 0 || visibleRestaurants.length > 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-[164px]">
      <div className="mx-auto w-full max-w-[1008px] px-5 pt-8 sm:px-8 md:px-12">

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
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("search_meals_placeholder")} className="h-[60px] w-full rounded-full bg-white pl-[68px] pr-[72px] text-[16px] font-semibold text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-400 transition-shadow" />
          <button className="absolute right-2 top-1/2 flex h-[50px] w-[50px] -translate-y-1/2 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" onClick={() => setFilterSheetOpen(true)} aria-label="Filters"><SlidersHorizontal className="h-[22px] w-[22px]" strokeWidth={2.4} /></button>
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
          <SectionHeading icon={Star} iconClassName="bg-transparent text-emerald-500" title={t("recommended_for_you")} showViewAll viewAllHref="/recommendations" />
          <SmartRecommendations />

          {hasResults ? (<>
            {visibleTopPicks.length > 0 && <MealSection icon={Flame} iconClassName="bg-transparent text-orange-500" title={t("top_picks")} meals={visibleTopPicks} onToggleFavorite={handleToggleFavorite} isFavorite={isFavorite} />}
            {visibleQuickLight.length > 0 && <MealSection icon={Clock3} iconClassName="bg-orange-50 text-orange-500" subtitle={t("quick_light_subtitle")} title={t("quick_and_light")} meals={visibleQuickLight} onToggleFavorite={handleToggleFavorite} isFavorite={isFavorite} />}
            {visibleHighProtein.length > 0 && <MealSection icon={Dumbbell} iconClassName="bg-emerald-50 text-emerald-500" subtitle={t("high_protein_goals_subtitle")} title={t("high_protein_goals")} meals={visibleHighProtein} onToggleFavorite={handleToggleFavorite} isFavorite={isFavorite} />}

            {/* Restaurant section */}
            <section className="mt-8"><div className="mb-5 flex items-center justify-between"><div className="flex items-start gap-3"><span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-emerald-500"><Store className="h-6 w-6" strokeWidth={2.4} /></span><div><h2 className="text-[20px] font-extrabold text-slate-900">{t("restaurants")}</h2><p className="mt-0.5 text-[15px] font-medium text-slate-500">{t("restaurants_count_label", { count: String(restaurants.length) })}</p></div></div>
            <div className="flex h-[44px] items-center rounded-full bg-slate-100 p-1 text-[14px] font-extrabold">
              <button className={cn("h-full flex-1 rounded-full transition", !showMealsView && "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]")} onClick={() => onChangeView(false)}>{t("restaurants")}</button>
              <button className={cn("h-full flex-1 rounded-full transition", showMealsView && "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]")} onClick={() => onChangeView(true)}>{t("meals")}</button>
            </div></div>
            {showMealsView ? <div className="grid grid-cols-2 gap-5 md:grid-cols-3">{allVisible.map((m) => <MealCard key={`rest-meal-${m.name}`} meal={m} onToggleFavorite={handleToggleFavorite} isFavorite={isFavorite} />)}</div> : <div className="grid grid-cols-2 gap-5 md:grid-cols-4">{visibleRestaurants.map((r) => <RestaurantCard key={r.name} restaurant={r} isFavorite={isFavorite} onToggleFavorite={handleToggleFavorite} />)}</div>}</section>
          </>) : (
            <div className="mt-10 rounded-2xl bg-white px-8 py-14 text-center shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"><Utensils className="mx-auto mb-4 h-10 w-10 text-emerald-500" /><h2 className="text-[20px] font-extrabold text-slate-900">{t("no_matches_found")}</h2><p className="mx-auto mt-2 max-w-[360px] text-[14px] font-medium text-slate-500">{t("no_matches_hint")}</p></div>
          )}</main></div>

      <FilterSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} showFavoritesOnly={showFavoritesOnly} onToggleFavorites={() => setShowFavoritesOnly((v) => !v)} activeSort={activeSort} onChangeSort={setActiveSort} calorieRange={calorieRange} onChangeCalorieRange={setCalorieRange} />
      <GuestLoginPrompt open={showLoginPrompt} onOpenChange={setShowLoginPrompt} title={loginPromptConfig.title} description={loginPromptConfig.description} actionLabel={loginPromptConfig.actionLabel} signUpLabel={loginPromptConfig.signUpLabel} />
    </div>
  );
};

export default Meals;
