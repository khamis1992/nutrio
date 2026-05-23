import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { RotateCcw, Utensils, ChevronRight, Heart, Plus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fadeInUp, spring } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { TOUCH, CARD } from "@/constants/sizes";

import type { Database } from "@/integrations/supabase/types";

type MealRow = Database["public"]["Tables"]["meals"]["Row"];
type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];

interface QuickMeal {
  id: string;
  meal_id: string;
  meal_name: string;
  restaurant_name: string;
  restaurant_id: string;
  image_url: string | null;
  price: number | null;
  order_count: number;
}

const STORAGE_KEY = "nutrio_quick_reorder_favorites";
const MAX_ITEMS = 5;

// ── Helpers ────────────────────────────────────────────────────────────────

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === "string"));
    }
  } catch {
    // Corrupt or missing – start fresh
  }
  return new Set();
}

function saveFavorites(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage quota exceeded – silently ignore
  }
}

function announceToSr(message: string): void {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.className = "sr-only";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

async function addMealToCart(
  userId: string,
  meal: QuickMeal,
  onSuccess: (name: string) => void,
  onError: () => void,
): Promise<void> {
  try {
    const { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("id, items")
      .eq("user_id", userId)
      .maybeSingle();

    if (cartError) throw cartError;

    const cartItem = {
      meal_id: meal.meal_id,
      meal_name: meal.meal_name,
      quantity: 1,
      price: meal.price || 0,
      image_url: meal.image_url,
      restaurant_id: meal.restaurant_id,
      restaurant_name: meal.restaurant_name,
      added_at: new Date().toISOString(),
    };

    if (cart) {
      const existing = (cart.items || []) as Array<Record<string, unknown>>;
      const idx = existing.findIndex((item) => item.meal_id === meal.meal_id);
      const merged =
        idx >= 0
          ? existing.map((item, i) =>
              i === idx ? { ...item, quantity: (item.quantity as number) + 1, added_at: cartItem.added_at } : item,
            )
          : [...existing, cartItem];

      const { error: updateError } = await supabase
        .from("carts")
        .update({ items: merged, updated_at: new Date().toISOString() })
        .eq("id", cart.id);

      if (updateError) throw updateError;
    } else {
      const { error: createError } = await supabase
        .from("carts")
        .insert({ user_id: userId, items: [cartItem] });
      if (createError) throw createError;
    }

    onSuccess(meal.meal_name);
  } catch (err) {
    console.error("Error adding to cart:", err);
    onError();
  }
}

// ── Query fn ───────────────────────────────────────────────────────────────

async function fetchPastOrders(userId: string): Promise<QuickMeal[]> {
  const { data: orderItems, error } = await supabase
    .from("order_items")
    .select("id, meal_id, quantity, order_id, meals(id, name, image_url, restaurant_id, price)")
    .eq("order_items.order_id", "")
    .limit(0);

  // The above is a placeholder – the real query uses `orders!inner` which
  // generates a complex type that varies across Supabase versions.
  // We use a two-step approach: fetch order ids first, then items.

  const { data: schedules } = await supabase
    .from("meal_schedules")
    .select("id, meal_id, scheduled_date")
    .eq("user_id", userId)
    .in("order_status", ["delivered", "completed"])
    .order("scheduled_date", { ascending: false })
    .limit(20);

  if (!schedules || schedules.length === 0) return [];

  const mealIds = [...new Set(schedules.map((s) => s.meal_id).filter(Boolean))];
  if (mealIds.length === 0) return [];

  const { data: meals } = await supabase
    .from("meals")
    .select("id, name, image_url, restaurant_id, price")
    .in("id", mealIds);

  if (!meals) return [];

  const restIds = [...new Set(meals.map((m) => m.restaurant_id).filter(Boolean))];
  const { data: restaurants } = restIds.length > 0
    ? await supabase.from("restaurants").select("id, name").in("id", restIds)
    : { data: null };

  const restMap = new Map<string, string>();
  if (restaurants) {
    for (const r of restaurants as Pick<RestaurantRow, "id" | "name">[]) {
      restMap.set(r.id, r.name);
    }
  }

  const seen = new Set<string>();
  const result: QuickMeal[] = [];

  for (const s of schedules) {
    const meal = meals.find((m) => m.id === s.meal_id);
    if (!meal || seen.has(meal.id)) continue;
    seen.add(meal.id);

    result.push({
      id: s.id,
      meal_id: meal.id,
      meal_name: meal.name,
      restaurant_name: restMap.get(meal.restaurant_id ?? "") ?? "Restaurant",
      restaurant_id: meal.restaurant_id ?? "",
      image_url: meal.image_url,
      price: meal.price,
      order_count: 1,
    });

    if (result.length >= MAX_ITEMS) break;
  }

  return result;
}

// ── Component ──────────────────────────────────────────────────────────────

export function QuickReorder() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const { data: meals = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quickReorder", user?.id],
    queryFn: () => fetchPastOrders(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [isReordering, setIsReordering] = useState<string | null>(null);

  const persistAndSetFavorites = useCallback((next: Set<string>) => {
    saveFavorites(next);
    setFavorites(next);
  }, []);

  const toggleFavorite = useCallback(
    (mealId: string, mealName: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(mealId)) {
          next.delete(mealId);
          toast.success(t("removed_from_favorites") || "Removed from favorites");
        } else {
          next.add(mealId);
          toast.success(t("added_to_favorites") || "Added to favorites");
        }
        saveFavorites(next);
        const wasAdded = next.has(mealId);
        announceToSr(
          wasAdded
            ? `${mealName} added to favorites`
            : `${mealName} removed from favorites`,
        );
        return next;
      });
    },
    [t],
  );

  const handleReorder = async (meal: QuickMeal) => {
    if (!user) {
      toast.error(t("sign_in_to_order") || "Please sign in to order");
      return;
    }

    setIsReordering(meal.meal_id);

    await addMealToCart(
      user.id,
      meal,
      (name) => {
        announceToSr(`${name} added to cart`);
        toast.success(t("added_to_cart") || "Added to cart", {
          description: name,
          action: {
            label: t("checkout") || "Checkout",
            onClick: () => navigate("/checkout"),
          },
        });
      },
      () => toast.error(t("failed_to_add") || "Failed to add to cart"),
    );

    setIsReordering(null);
  };

  // ── Render states ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-36 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-14 rounded-md bg-muted animate-pulse" />
        </div>
        <div
          className="flex gap-3 overflow-hidden -mx-5 px-5 py-1"
          style={{ scrollPaddingLeft: "1.25rem", scrollPaddingRight: "1.25rem" }}
        >
          {Array.from({ length: MAX_ITEMS }).map((_, i) => (
            <div
              key={i}
              className="w-40 h-[172px] rounded-2xl bg-gradient-to-b from-muted via-muted/60 to-muted animate-[shimmer_1.5s_infinite] shrink-0"
              style={{ backgroundSize: "200% 100%" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 rounded-2xl shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-semibold text-destructive">
                {t("error_loading_orders") || "Could not load orders"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {error instanceof Error ? error.message : t("try_again_later") || "Something went wrong"}
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              {t("retry") || "Retry"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (meals.length === 0) return null;

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
          <RotateCcw className="w-5 h-5 text-primary" />
          {t("order_again") || "Order Again"}
        </h3>
        <Link to="/orders">
          <span className="text-xs font-semibold text-primary hover:underline">
            {t("view_all") || "View all"}
          </span>
        </Link>
      </div>

      <div
        className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-2 snap-x snap-mandatory"
        style={{ scrollPaddingLeft: "1.25rem", scrollPaddingRight: "1.25rem" }}
        role="list"
        aria-label={t("past_orders_to_reorder") || "Past orders to reorder"}
      >
        {meals.map((meal, index) => (
          <motion.div
            key={meal.meal_id}
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.06, ...spring }}
            className="shrink-0 snap-start"
            role="listitem"
          >
            <div
              className="rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow group"
              style={{ width: CARD.quickReorder }}
            >
              <div className="relative h-20 bg-muted">
                {meal.image_url ? (
                  <img
                    src={meal.image_url}
                    alt={meal.meal_name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                    <Utensils className="w-6 h-6 text-primary/30" />
                  </div>
                )}

                <motion.button
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.85 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(meal.meal_id, meal.meal_name);
                  }}
                  className={cn(
                    "absolute top-1.5 right-1.5 rounded-full flex items-center justify-center transition-colors",
                    favorites.has(meal.meal_id)
                      ? "bg-destructive text-destructive-foreground shadow-md"
                      : "bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm",
                  )}
                  style={{ width: TOUCH.minimum, height: TOUCH.minimum }}
                  role="switch"
                  aria-checked={favorites.has(meal.meal_id)}
                  aria-label={
                    favorites.has(meal.meal_id)
                      ? `${t("remove") || "Remove"} ${meal.meal_name} ${t("from_favorites") || "from favorites"}`
                      : `${t("add") || "Add"} ${meal.meal_name} ${t("to_favorites") || "to favorites"}`
                  }
                >
                  <Heart
                    className={cn(
                      "w-5 h-5 transition-all",
                      favorites.has(meal.meal_id) && "fill-current scale-110",
                    )}
                  />
                </motion.button>

                <motion.button
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                  onClick={() => handleReorder(meal)}
                  disabled={isReordering === meal.meal_id}
                  className={cn(
                    "absolute bottom-1.5 right-1.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg",
                    "hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  )}
                  style={{ width: TOUCH.minimum, height: TOUCH.minimum }}
                  aria-label={`${t("add_to_cart") || "Add to cart"}: ${meal.meal_name}`}
                >
                  {isReordering === meal.meal_id ? (
                    <div
                      className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"
                      role="status"
                      aria-label={t("adding_to_cart") || "Adding to cart"}
                    />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </motion.button>
              </div>

              <div className="p-3">
                <Link
                  to={`/restaurant/${meal.restaurant_id}`}
                  className="block"
                  aria-label={`${meal.meal_name} - ${t("view_details") || "View details"}`}
                >
                  <p className="text-xs font-semibold text-foreground line-clamp-2 leading-tight hover:text-primary transition-colors">
                    {meal.meal_name}
                  </p>
                </Link>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {meal.restaurant_name}
                </p>

                <div className="flex items-center justify-between mt-2">
                  {meal.price ? (
                    <span className="text-xs font-bold text-foreground">
                      {meal.price.toFixed(2)} {t("currency_qar") || "QAR"}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">
                      {t("price_varies") || "Price varies"}
                    </span>
                  )}

                  <Link
                    to={`/restaurant/${meal.restaurant_id}`}
                    className="flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline touch-manipulation"
                    style={{ minHeight: TOUCH.minimum }}
                    aria-label={`${t("reorder") || "Reorder"} ${meal.meal_name}`}
                  >
                    {t("reorder") || "Reorder"}
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
