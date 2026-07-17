import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Beef,
  ChefHat,
  Clock,
  ClipboardList,
  Flame,
  Heart,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Star,
  Trash2,
  TrendingUp,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useTopMeals } from "@/hooks/useTopMeals";
import { cn } from "@/lib/utils";

interface FavoriteRestaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
}

type StatTone = "amber" | "sky" | "orange" | "rose";

const StatPill = ({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: string;
  label?: string;
  tone: StatTone;
}) => (
  <div
    className={cn(
      "flex min-h-9 items-center justify-center gap-1 rounded-full px-2 text-[11px] font-black",
      tone === "amber" && "bg-amber-50 text-amber-700",
      tone === "sky" && "bg-sky-50 text-sky-700",
      tone === "orange" && "bg-orange-50 text-orange-700",
      tone === "rose" && "bg-rose-50 text-rose-700"
    )}
  >
    {icon}
    <span className="truncate">{value}</span>
    {label && <span className="hidden text-[10px] font-extrabold opacity-70 xs:inline">{label}</span>}
  </div>
);

const Favorites = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { toggleFavorite } = useFavoriteRestaurants();
  const { topMeals, loading: topMealsLoading, removeFromTopMeals, fetchTopMeals } = useTopMeals();

  const [restaurants, setRestaurants] = useState<FavoriteRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("restaurants");

  useEffect(() => {
    document.title = `${t("favorites_title")} - Nutrio`;
  }, [t]);

  useEffect(() => {
    if (sessionStorage.getItem("nutrio_onboarding_done") === "true") return;
    if (profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, navigate]);

  useEffect(() => {
    fetchRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchRestaurants = async () => {
    if (!user) {
      setRestaurants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(null);

    try {
      const { data: favData, error: favError } = await supabase
        .from("user_favorite_restaurants")
        .select("restaurant_id")
        .eq("user_id", user.id);

      if (favError) throw favError;

      const restaurantIds = (favData ?? [])
        .map((favorite) => favorite.restaurant_id)
        .filter((restaurantId): restaurantId is string => Boolean(restaurantId));

      if (restaurantIds.length === 0) {
        setRestaurants([]);
        return;
      }

      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from("public_restaurant_catalog" as "restaurants")
        .select("id, name, description, logo_url, rating, total_orders")
        .in("id", restaurantIds);

      if (restaurantsError) throw restaurantsError;

      const { data: mealsCountData } = await supabase
        .from("public_meal_catalog" as "meals")
        .select("restaurant_id")
        .in("restaurant_id", restaurantIds);

      const mealCounts: Record<string, number> = {};
      (mealsCountData ?? []).forEach((meal) => {
        if (!meal.restaurant_id) return;
        mealCounts[meal.restaurant_id] = (mealCounts[meal.restaurant_id] || 0) + 1;
      });

      const transformedRestaurants: FavoriteRestaurant[] = (restaurantsData || []).map(
        (restaurant) => ({
          id: restaurant.id,
          name: restaurant.name,
          description: restaurant.description,
          logo_url: restaurant.logo_url,
          rating: parseFloat(String(restaurant.rating)) || 0,
          total_orders: restaurant.total_orders || 0,
          meal_count: mealCounts[restaurant.id] || 0,
        })
      );

      setRestaurants(transformedRestaurants);
    } catch (err) {
      console.error("Error fetching favorites:", err);
      setFetchError(err instanceof Error ? err.message : String(err));
      toast({
        title: t("error"),
        description: t("failed_to_load_favorites"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (restaurantId: string, restaurantName: string) => {
    await toggleFavorite(restaurantId, restaurantName);
    setRestaurants((prev) => prev.filter((restaurant) => restaurant.id !== restaurantId));
  };

  const handleRemoveTopMeal = async (topMealId: string, mealName: string) => {
    const success = await removeFromTopMeals(topMealId);
    if (success) {
      toast({
        title: t("removed_from_top_meals"),
        description: `${mealName} ${t("removed")}.`,
      });
    }
  };

  const handleRefreshTopMeals = async () => {
    await fetchTopMeals();
    toast({
      title: t("refreshed_toast_short"),
      description: t("top_meals_refreshed_desc"),
    });
  };

  const isLoading = activeTab === "restaurants" ? loading : topMealsLoading;
  const savedCount = restaurants.length + topMeals.length;

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24 pt-safe text-[#020617]">
      <header className="sticky top-0 z-40 border-b border-rose-950/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <button
            type="button"
            data-testid="favorites-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-[0_8px_22px_rgba(15,23,42,0.07)] transition active:scale-95"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">Nutrio</p>
            <h1 className="truncate text-[18px] font-black">{t("favorites_title")}</h1>
          </div>

          <button
            type="button"
            data-testid="favorites-refresh-btn"
            onClick={activeTab === "meals" ? handleRefreshTopMeals : fetchRestaurants}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 shadow-[0_8px_22px_rgba(15,23,42,0.07)] transition active:scale-95"
            aria-label={t("refresh")}
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        <section className="overflow-hidden rounded-[30px] border border-white/60 bg-white/70 p-5 text-slate-950 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-rose-600">
                <Heart className="h-3.5 w-3.5 fill-current" />
                Saved picks
              </div>
              <h2 className="mt-4 text-[28px] font-black leading-none">{savedCount}</h2>
              <p className="mt-2 max-w-[15rem] text-sm font-semibold leading-relaxed text-slate-500">
                {t("favorites_subtitle")}
              </p>
            </div>

            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-rose-500/10 text-rose-600 shadow-sm">
              <Heart className="h-8 w-8 fill-current" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-rose-50/80 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">
                {t("favorites_restaurants_tab")}
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">{restaurants.length}</p>
            </div>
            <div className="rounded-2xl bg-rose-50/80 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-rose-700">
                {t("favorites_meals_tab")}
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">{topMeals.length}</p>
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="my-4 grid h-12 w-full grid-cols-2 rounded-[18px] bg-white p-1 shadow-sm">
            <TabsTrigger
              value="restaurants"
              className="rounded-[14px] text-xs font-black text-slate-500 transition-all data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <Utensils className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
              {t("favorites_restaurants_tab")} ({restaurants.length})
            </TabsTrigger>
            <TabsTrigger
              value="meals"
              className="rounded-[14px] text-xs font-black text-slate-500 transition-all data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              <TrendingUp className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
              {t("favorites_meals_tab")} ({topMeals.length})
            </TabsTrigger>
          </TabsList>

          {fetchError && !loading ? (
            <div className="rounded-[24px] border border-red-100 bg-white p-5 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                <AlertCircle className="h-7 w-7 text-red-500" />
              </div>
              <p className="mx-auto mb-4 max-w-xs text-sm font-semibold text-slate-500">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={fetchRestaurants} className="rounded-full">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 rtl:ml-1.5 rtl:mr-0" />
                {t("retry")}
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-sm">
                  <Skeleton className="h-16 w-16 rounded-2xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-8 w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="restaurants" className="mt-0 space-y-3">
                {restaurants.length === 0 ? (
                  <div className="rounded-[28px] bg-white p-5 shadow-sm">
                    <EmptyState
                      icon={<Heart className="h-8 w-8" />}
                      title={t("no_favorite_restaurants_title")}
                      description={t("no_favorite_restaurants_desc")}
                      actionLabel={t("browse_restaurants_btn")}
                      actionHref="/meals"
                    />
                  </div>
                ) : (
                  restaurants.map((restaurant) => (
                    <article
                      key={restaurant.id}
                      className="overflow-hidden rounded-[26px] border border-white/60 bg-white/70 p-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
                    >
                      <div className="flex gap-3">
                        <Link to={`/restaurant/${restaurant.id}`} className="shrink-0">
                          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-rose-50">
                            {restaurant.logo_url ? (
                              <img
                                src={restaurant.logo_url}
                                alt={restaurant.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ChefHat className="h-9 w-9 text-rose-300" />
                            )}
                          </div>
                        </Link>

                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex items-start gap-2">
                            <Link to={`/restaurant/${restaurant.id}`} className="min-w-0 flex-1">
                              <h3 className="truncate text-[15px] font-black text-slate-950">{restaurant.name}</h3>
                              {restaurant.description && (
                                <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">
                                  {restaurant.description}
                                </p>
                              )}
                            </Link>

                            <button
                              type="button"
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 transition active:scale-95"
                              onClick={() => handleRemoveFavorite(restaurant.id, restaurant.name)}
                              aria-label={t("remove")}
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-1.5">
                            <StatPill
                              icon={<Star className="h-3.5 w-3.5 fill-current" />}
                              value={restaurant.rating.toFixed(1)}
                              tone="amber"
                            />
                            <StatPill
                              icon={<ShoppingBag className="h-3.5 w-3.5" />}
                              value={`${restaurant.meal_count}`}
                              label="Meals"
                              tone="rose"
                            />
                            <StatPill
                              icon={<ClipboardList className="h-3.5 w-3.5" />}
                              value={`${restaurant.total_orders}`}
                              label="Orders"
                              tone="sky"
                            />
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </TabsContent>

              <TabsContent value="meals" className="mt-0 space-y-3">
                <section className="rounded-[24px] border border-white/60 bg-white/70 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-slate-950">{t("how_top_meals_work")}</h3>
                      <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">
                        {t("top_meals_rule_1")} {t("top_meals_rule_2")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition active:scale-95"
                      onClick={handleRefreshTopMeals}
                      aria-label={t("refresh")}
                    >
                      <RotateCcw className="h-5 w-5" />
                    </button>
                  </div>
                </section>

                {topMeals.length === 0 ? (
                  <div className="rounded-[28px] bg-white p-5 shadow-sm">
                    <EmptyState
                      icon={<UtensilsCrossed className="h-8 w-8" />}
                      title={t("no_top_meals_title")}
                      description={t("no_top_meals_desc")}
                      actionLabel={t("browse_meals_btn")}
                      actionHref="/meals"
                    />
                  </div>
                ) : (
                  topMeals.map((meal) => (
                    <article
                      key={meal.id}
                      className="overflow-hidden rounded-[26px] border border-white/60 bg-white/70 p-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
                    >
                      <div className="flex gap-3">
                        <Link to={`/meals/${meal.meal_id}`} className="shrink-0">
                          <div className="flex h-24 w-20 items-center justify-center overflow-hidden rounded-[22px] bg-orange-50">
                            {meal.image_url ? (
                              <img src={meal.image_url} alt={meal.name} className="h-full w-full object-cover" />
                            ) : (
                              <ChefHat className="h-9 w-9 text-orange-300" />
                            )}
                          </div>
                        </Link>

                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex items-start gap-2">
                            <Link to={`/meals/${meal.meal_id}`} className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-[15px] font-black leading-tight text-slate-950">
                                {meal.name}
                              </h3>
                              <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                                {meal.restaurant_name}
                              </p>
                            </Link>

                            <button
                              type="button"
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500 transition active:scale-95"
                              onClick={() => handleRemoveTopMeal(meal.id, meal.name)}
                              aria-label={t("remove")}
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-1.5">
                            <StatPill
                              icon={<Flame className="h-3.5 w-3.5" />}
                              value={`${meal.calories}`}
                              label={t("cal")}
                              tone="orange"
                            />
                            <StatPill
                              icon={<Beef className="h-3.5 w-3.5" />}
                              value={`${meal.protein_g}g`}
                              label={t("protein")}
                              tone="rose"
                            />
                            <StatPill
                              icon={<Clock className="h-3.5 w-3.5" />}
                              value={`${meal.prep_time_minutes}`}
                              label={t("min_label")}
                              tone="sky"
                            />
                          </div>

                          <div className="mt-2 flex min-h-8 items-center gap-2 overflow-hidden">
                            <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2.5 text-[11px] font-black text-rose-700">
                              <TrendingUp className="h-3.5 w-3.5" />
                              {meal.order_count} {t("orders_count_label")}
                            </span>
                            {meal.last_ordered_at && (
                              <span className="min-w-0 truncate text-[11px] font-semibold text-slate-500">
                                {t("last_ordered")}{" "}
                                {formatDistanceToNow(new Date(meal.last_ordered_at), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Favorites;
