import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

import { ModifyOrderModal } from "@/components/ModifyOrderModal";
import { toast as sonnerToast } from "sonner";
import {
  ChevronLeft,
  RotateCw,
  Loader2,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
  Truck,
  CheckCircle2,
  XCircle,
  ChefHat,
  CircleDot,
  Pencil,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Types ────────────────────────────────────────────────────────────────────
interface Restaurant { id: string; name: string; logo_url: string | null; }
interface Meal { id: string; name: string; image_url: string | null; calories: number; restaurant_id: string; }
interface OrderItem { id: string; quantity: number; meal_id: string; meal?: Meal; }

interface Order {
  id: string;
  created_at: string;
  estimated_delivery_time?: string;
  status: string;
  total_amount: number;
  meal_id: string | null;
  notes: string | null;
  restaurant_id: string | null;
  restaurant?: Restaurant;
  order_items: OrderItem[];
}

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  order_status: string;
  created_at: string;
  meal_id: string;
  meal?: Meal & { restaurant?: Restaurant };
}

const ACTIVE_STATUSES = ["pending", "confirmed", "preparing", "ready", "out_for_delivery"];
const COMPLETED_STATUSES = ["delivered", "completed"];

function normalizeCustomerOrderStatus(status: string | null): string {
  if (status === "ready_for_pickup") return "ready";
  if (["picked_up", "on_the_way", "in_transit"].includes(status || "")) {
    return "out_for_delivery";
  }
  return status || "pending";
}

const getStatusConfig = (t: (key: string) => string): Record<string, { label: string; icon: React.ElementType; color: string; badgeColor: string }> => ({
  pending:          { label: t("order_status_pending"),       icon: CircleDot,    color: "text-orange-600",  badgeColor: "bg-orange-50 text-orange-700 border-orange-100" },
  confirmed:        { label: t("order_status_confirmed"),     icon: CheckCircle2, color: "text-emerald-700", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  preparing:        { label: t("order_status_preparing"),     icon: ChefHat,      color: "text-orange-700",  badgeColor: "bg-orange-50 text-orange-700 border-orange-100" },
  ready:            { label: t("order_status_ready"),         icon: CheckCircle2, color: "text-emerald-700", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  out_for_delivery: { label: "In Delivery",                   icon: Truck,        color: "text-blue-600",    badgeColor: "bg-blue-50 text-blue-700 border-blue-100" },
  delivered:        { label: t("order_status_delivered"),     icon: CheckCircle2, color: "text-emerald-700", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  completed:        { label: t("order_status_delivered"),     icon: CheckCircle2, color: "text-emerald-700", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  cancelled:        { label: t("order_status_cancelled"),     icon: XCircle,      color: "text-red-600",     badgeColor: "bg-red-50 text-red-600 border-red-100" },
});

const TABS = ["All", "Active", "Completed", "Cancelled"] as const;
type TabType = typeof TABS[number];

// ── Helpers ──────────────────────────────────────────────────────────────────
function shortId(id: string) {
  return `#NUT-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function getOrderTabType(status: string): TabType {
  if (ACTIVE_STATUSES.includes(status)) return "Active";
  if (COMPLETED_STATUSES.includes(status)) return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Active";
}

// ── Unified card shape ───────────────────────────────────────────────────────
interface UnifiedOrder {
  id: string;
  shortId: string;
  status: string;
  restaurantName: string;
  images: (string | null)[];
  price: number;
  date: string;
  tab: TabType;
  canCancel: boolean;
  canModify: boolean;
  canReorder: boolean;
  canTrack: boolean;
  // original refs for actions
  sourceType: "order" | "scheduled";
  originalOrder?: Order;
  originalSchedule?: ScheduledMeal;
}

export default function DeliveryTracking() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>("Active");
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [modifyingSchedule, setModifyingSchedule] = useState<ScheduledMeal | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [scheduledMeals, setScheduledMeals] = useState<ScheduledMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersHasMore, setOrdersHasMore] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Pull-to-refresh
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const minPullDistance = 80;

  // ── Fetch orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async (page: number, append = false) => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const pageSize = 20;
      const from = page * pageSize;

      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("id, created_at, estimated_delivery_time, status, total_amount, notes, restaurant_id, meal_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!ordersData || ordersData.length === 0) { setOrdersHasMore(false); return; }

      const restaurantIds = [...new Set(ordersData.map(o => o.restaurant_id).filter(Boolean) as string[])];
      const orderIds = ordersData.map(o => o.id);

      const [{ data: restaurants }, { data: orderItemsData }] = await Promise.all([
        restaurantIds.length > 0
          ? supabase.from("public_restaurant_catalog" as "restaurants").select("id, name, logo_url").in("id", restaurantIds)
          : { data: [] },
        supabase.from("order_items").select("id, order_id, quantity, meal_id").in("order_id", orderIds),
      ]);

      const mealIds = [...new Set((orderItemsData || []).map(oi => oi.meal_id).filter(Boolean) as string[])];
      const { data: rawMealsData } = mealIds.length > 0
        ? await supabase.from("public_meal_catalog" as "meals").select("id, name, image_url, calories, restaurant_id").in("id", mealIds)
        : { data: [] };
      const mealsData: Meal[] = (rawMealsData || []).map((meal) => ({
        ...meal,
        calories: meal.calories ?? 0,
        restaurant_id: meal.restaurant_id ?? "",
      }));

      const transformed: Order[] = ordersData.map(o => ({
        id: o.id,
        created_at: o.created_at,
        estimated_delivery_time: o.estimated_delivery_time || undefined,
        status: normalizeCustomerOrderStatus(o.status),
        total_amount: (o as { total_amount?: number }).total_amount || 0,
        meal_id: o.meal_id,
        notes: o.notes,
        restaurant_id: o.restaurant_id,
        restaurant: (restaurants || []).find(r => r.id === o.restaurant_id),
        order_items: (orderItemsData || [])
          .filter(oi => oi.order_id === o.id)
          .map(oi => ({
            id: oi.id,
            quantity: oi.quantity,
            meal_id: oi.meal_id || "",
            meal: mealsData.find(m => m.id === oi.meal_id),
          })),
      }));

      setOrders(prev => append ? [...prev, ...transformed] : transformed);
      setOrdersPage(page);
      setOrdersHasMore(ordersData.length === pageSize);
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }, [user]);

  // ── Fetch scheduled meals ───────────────────────────────────────────────────
  const fetchScheduledMeals = useCallback(async () => {
    if (!user) return;
    try {
      const { data: schedulesData, error } = await supabase
        .from("meal_schedules")
        .select("id, scheduled_date, meal_type, is_completed, order_status, created_at, meal_id")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!schedulesData || schedulesData.length === 0) { setScheduledMeals([]); return; }

      const mealIds = [...new Set(schedulesData.map(s => s.meal_id).filter(Boolean) as string[])];
      let mealsData: (Meal & { restaurant?: Restaurant })[] = [];

      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("public_meal_catalog" as "meals").select("id, name, image_url, calories, restaurant_id").in("id", mealIds);

        if (meals) {
          const restaurantIds = [...new Set(meals.map(m => m.restaurant_id).filter(Boolean) as string[])];
          const { data: restaurants } = restaurantIds.length > 0
            ? await supabase.from("public_restaurant_catalog" as "restaurants").select("id, name, logo_url").in("id", restaurantIds)
            : { data: [] };
          mealsData = meals.map((meal) => ({
            ...meal,
            calories: meal.calories ?? 0,
            restaurant_id: meal.restaurant_id ?? "",
            restaurant: (restaurants || []).find((restaurant) => restaurant.id === meal.restaurant_id),
          }));
        }
      }

      setScheduledMeals(schedulesData.map(s => ({
        id: s.id,
        scheduled_date: s.scheduled_date,
        meal_type: s.meal_type,
        is_completed: s.is_completed || false,
        order_status: s.order_status || "pending",
        created_at: s.created_at || new Date(0).toISOString(),
        meal_id: s.meal_id,
        meal: mealsData.find(m => m.id === s.meal_id),
      })));
    } catch (err) {
      console.error("Error fetching scheduled meals:", err);
    }
  }, [user]);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchOrders(0), fetchScheduledMeals()]).finally(() => setLoading(false));
  }, [user, fetchOrders, fetchScheduledMeals]);

  // ── Onboarding redirect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStorage.getItem("nutrio_onboarding_done") === "true") return;
    if (profile && !profile.onboarding_completed && !profile.health_goal) navigate("/onboarding");
  }, [profile, navigate]);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const scheduleChannel = supabase
      .channel("customer-meal-schedules-tracking")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meal_schedules", filter: `user_id=eq.${user.id}` },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newStatus = (payload.new as { order_status: string }).order_status;
          const oldStatus = (payload.old as { order_status?: string }).order_status;
          const msgs: Record<string, string> = {
            confirmed: "Order confirmed!", preparing: "Your meal is being prepared!",
            ready: "Your meal is ready!", out_for_delivery: "Your order is on the way!",
            delivered: "Order delivered!", cancelled: "Order cancelled.",
          };
          if (newStatus !== oldStatus && msgs[newStatus]) sonnerToast(msgs[newStatus]);
          fetchScheduledMeals();
        })
      .subscribe();

    const orderChannel = supabase
      .channel("customer-direct-orders-tracking")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const newStatus = normalizeCustomerOrderStatus(
            typeof payload.new.status === "string" ? payload.new.status : null,
          );
          const oldStatus = normalizeCustomerOrderStatus(
            typeof payload.old.status === "string" ? payload.old.status : null,
          );
          const messages: Record<string, string> = {
            confirmed: "Order confirmed!",
            preparing: "Your meal is being prepared!",
            ready: "Your meal is ready!",
            out_for_delivery: "Your order is on the way!",
            delivered: "Order delivered!",
            cancelled: "Order cancelled.",
          };
          if (newStatus !== oldStatus && messages[newStatus]) sonnerToast(messages[newStatus]);
          fetchOrders(0);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
      supabase.removeChannel(orderChannel);
    };
  }, [user, fetchOrders, fetchScheduledMeals]);

  // ── Pull-to-refresh ─────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const dist = e.targetTouches[0].clientY - touchStart;
    if (window.scrollY === 0 && dist > 0) setPullDistance(Math.min(dist, 150));
  };
  const handleTouchEnd = () => {
    if (pullDistance > minPullDistance) handleRefresh();
    setPullDistance(0); setTouchStart(null);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(0), fetchScheduledMeals()]);
    setRefreshing(false);
    toast({ title: "Refreshed", description: "Your orders have been updated." });
  };

  // ── Cancel ──────────────────────────────────────────────────────────────────
  const handleCancel = async (id: string, type: "order" | "scheduled") => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setCancelling(id);
    try {
      if (type === "scheduled") {
        const { data, error } = await supabase.rpc("cancel_meal_schedule", { p_schedule_id: id, p_reason: undefined });
        if (error) throw error;
        if (!(data as { success?: boolean })?.success) throw new Error("Cancellation failed.");
        setScheduledMeals(prev => prev.map(m => m.id === id ? { ...m, order_status: "cancelled" } : m));
      } else {
        const { data, error } = await supabase.rpc(
          "cancel_customer_order" as never,
          { p_order_id: id, p_reason: "Customer cancellation" } as never,
        );
        if (error) throw error;
        if (!(data as { success?: boolean } | null)?.success) {
          throw new Error("Cancellation failed.");
        }
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "cancelled" } : o));
      }
      toast({ title: "Order cancelled", description: "Your order has been cancelled." });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to cancel.", variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  };

  const handleConfirmReceived = async (item: UnifiedOrder) => {
    setConfirming(item.id);
    try {
      const source = item.sourceType === "scheduled" ? "meal_schedule" : "order";
      const { data, error } = await supabase.rpc("customer_confirm_order_received", {
        p_source: source,
        p_order_id: item.id,
      });
      if (error) throw error;
      if (!(data as { success?: boolean } | null)?.success) {
        throw new Error("Receipt confirmation failed.");
      }

      if (item.sourceType === "scheduled") {
        setScheduledMeals((previous) => previous.map((meal) =>
          meal.id === item.id
            ? { ...meal, order_status: "completed", is_completed: true }
            : meal,
        ));
      } else {
        setOrders((previous) => previous.map((order) =>
          order.id === item.id ? { ...order, status: "completed" } : order,
        ));
      }
      toast({ title: "Delivery confirmed", description: "Thank you for confirming receipt." });
    } catch (error) {
      toast({
        title: "Unable to confirm delivery",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirming(null);
    }
  };

  // ── Build unified list ──────────────────────────────────────────────────────
  const unified: UnifiedOrder[] = [
    ...orders.map((o): UnifiedOrder => ({
      id: o.id,
      shortId: shortId(o.id),
      status: o.status,
      restaurantName: o.restaurant?.name || "Restaurant",
      images: [o.restaurant?.logo_url || null, ...o.order_items.slice(0, 2).map(i => i.meal?.image_url || null)],
      price: o.total_amount,
      date: format(new Date(o.estimated_delivery_time || o.created_at), "MMM d, h:mm a"),
      tab: getOrderTabType(o.status),
      canCancel: ["pending", "confirmed"].includes(o.status),
      canModify: false,
      canReorder: o.status === "completed",
      canTrack: ACTIVE_STATUSES.includes(o.status),
      sourceType: "order",
      originalOrder: o,
    })),
    ...scheduledMeals.map((s): UnifiedOrder => ({
      id: s.id,
      shortId: shortId(s.id),
      status: s.order_status,
      restaurantName: s.meal?.restaurant?.name || "Restaurant",
      images: [s.meal?.image_url || null],
      price: 0,
      date: format(new Date(s.scheduled_date), "MMM d"),
      tab: s.order_status === "cancelled"
        ? "Cancelled"
        : s.is_completed ? "Completed" : getOrderTabType(s.order_status),
      canCancel: ["pending", "confirmed"].includes(s.order_status),
      canModify: ["pending", "confirmed"].includes(s.order_status),
      canReorder: false,
      canTrack: ACTIVE_STATUSES.includes(s.order_status) && !s.is_completed,
      sourceType: "scheduled",
      originalSchedule: s,
    })),
  ].sort((a, b) => b.id.localeCompare(a.id));

  const filtered = activeTab === "All" ? unified : unified.filter(o => o.tab === activeTab);
  const counts = {
    All: unified.length,
    Active: unified.filter(o => o.tab === "Active").length,
    Completed: unified.filter(o => o.tab === "Completed").length,
    Cancelled: unified.filter(o => o.tab === "Cancelled").length,
  };
  const statusConfig = getStatusConfig(t);

  // ── Render card ─────────────────────────────────────────────────────────────
  const renderCard = (item: UnifiedOrder) => {
    const cfg = statusConfig[item.status] || statusConfig.pending;
    const StatusIcon = cfg.icon;
    const validImages = item.images.filter(Boolean) as string[];
    const extraCount = item.images.length - 2;

    return (
      <div
        key={item.id}
        className="rounded-[24px] bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80"
      >
        {/* Top row */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-bold text-emerald-700">{item.shortId}</span>
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.badgeColor}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {cfg.label}
          </span>
        </div>

        {/* Middle row */}
        <div className="flex gap-3 mb-4">
          {/* Overlapping images */}
          <div className="flex -space-x-4 relative shrink-0">
            {validImages.slice(0, 2).map((img, i) => (
              <img
                key={i}
                src={img}
                alt="meal"
                className="w-[68px] h-[68px] rounded-full object-cover border-2 border-white shadow-sm"
                style={{ zIndex: 10 - i }}
              />
            ))}
            {validImages.length === 0 && (
              <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-white bg-emerald-50">
                <UtensilsCrossed className="h-6 w-6 text-emerald-600" />
              </div>
            )}
            {extraCount > 0 && (
              <div className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-white bg-orange-50 text-xs font-bold text-orange-600" style={{ zIndex: 8 }}>
                +{extraCount}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center flex-1 min-w-0">
            <h3 className="mb-1 truncate pr-1 text-sm font-bold leading-snug text-slate-950">
              {item.restaurantName}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              {item.price > 0 && <span className="font-bold text-slate-950">{item.price} QAR</span>}
              {item.price === 0 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">Included</span>}
              <span className="text-slate-400">{item.date}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">

          {item.canModify && item.originalSchedule && (
            <button
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-50 px-4 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100 transition-all active:scale-95"
              onClick={() => setModifyingSchedule(item.originalSchedule!)}
            >
              <Pencil className="w-3.5 h-3.5" /> Modify
            </button>
          )}

          {item.canCancel && (
            <button
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-red-50 px-4 text-sm font-bold text-red-600 ring-1 ring-red-100 transition-all active:scale-95 disabled:opacity-50"
              onClick={() => handleCancel(item.id, item.sourceType)}
              disabled={cancelling === item.id}
            >
              {cancelling === item.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Trash2 className="w-3.5 h-3.5" />}
              Cancel
            </button>
          )}

          {item.status === "delivered" && (
            <button
              type="button"
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              onClick={() => handleConfirmReceived(item)}
              disabled={confirming === item.id}
            >
              {confirming === item.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <CheckCircle2 className="h-3.5 w-3.5" />}
              Confirm received
            </button>
          )}

          {item.canReorder && item.originalOrder && (
            <button
              type="button"
              onClick={() => {
                const mealId = item.originalOrder?.order_items[0]?.meal_id;
                navigate(mealId ? `/meals/${mealId}` : "/meals");
              }}
              className="ml-auto flex h-10 items-center gap-1.5 rounded-full border-emerald-200 bg-white px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
            >
              Choose again <RotateCw className="h-3.5 w-3.5" />
            </button>
          )}

          {/* If completed scheduled meal with no reorder */}
          {item.tab === "Completed" && !item.canReorder && item.sourceType === "scheduled" && (
            <button
              className="ml-auto flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100 transition-all active:scale-95"
              onClick={() => navigate("/meals")}
            >
              Order Again <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
        <ShoppingBag className="h-9 w-9" />
      </div>
      <h3 className="mb-1 text-lg font-bold text-slate-950">No orders yet</h3>
      <p className="mb-6 max-w-xs text-sm text-slate-500">
        {activeTab === "Active" ? "You have no active orders right now." : `No ${activeTab.toLowerCase()} orders found.`}
      </p>
      <Button onClick={() => navigate("/meals")} className="rounded-full bg-emerald-600 px-6 text-white shadow-[0_10px_24px_rgba(16,185,129,0.24)] hover:bg-emerald-700">
        Browse Meals
      </Button>
    </div>
  );

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#F6F7F4] pb-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div className="flex items-center justify-center transition-all" style={{ height: pullDistance, opacity: Math.min(pullDistance / minPullDistance, 1) }}>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
            <RotateCcw className="w-4 h-4" style={{ transform: `rotate(${pullDistance * 2}deg)` }} />
            {pullDistance > minPullDistance ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/70 bg-[#F6F7F4]/85 px-5 pb-3 pt-[env(safe-area-inset-top,20px)] backdrop-blur-xl">
        <button data-testid="delivery-back-btn" onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80 transition active:scale-95">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-slate-950">My Orders</h1>
        <button
          data-testid="delivery-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100 transition-all active:scale-95 disabled:opacity-40"
        >
          <RefreshCw className={`w-4.5 h-4.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="mx-5 my-4 flex items-center gap-2 overflow-x-auto rounded-[24px] bg-white p-2 shadow-[0_14px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab}
            data-testid={`delivery-tab-${tab.toLowerCase()}`}
            onClick={() => setActiveTab(tab)}
            className={`relative rounded-[16px] px-4 py-2 text-sm font-extrabold whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-emerald-600 text-white shadow-[0_10px_24px_rgba(16,185,129,0.20)]"
                : "bg-[#F6F7F4] text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
            }`}
          >
            {tab}
            {counts[tab] > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab ? "bg-white/20 text-white" : "bg-white text-emerald-700 ring-1 ring-emerald-100"
              }`}>
                {counts[tab]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-5 flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 ring-1 ring-emerald-100">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
            </div>
            <p className="text-sm text-slate-500">Loading your orders...</p>
          </div>
        ) : filtered.length === 0 ? renderEmpty() : (
          <>
            {filtered.map(renderCard)}
            {activeTab === "All" && ordersHasMore && (
              <button
                data-testid="delivery-load-more-btn"
                className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-bold text-emerald-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ring-1 ring-emerald-100 transition-all active:scale-95 disabled:opacity-40"
                onClick={() => fetchOrders(ordersPage + 1, true)}
                disabled={ordersLoading}
              >
                {ordersLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Modify Order Modal */}
      <ModifyOrderModal
        isOpen={!!modifyingSchedule}
        onClose={() => setModifyingSchedule(null)}
        schedule={modifyingSchedule}
        onModified={() => { fetchScheduledMeals(); setModifyingSchedule(null); }}
      />

    </div>
  );
}
