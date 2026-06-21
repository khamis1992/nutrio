import { getNavArrows } from "@/lib/rtl";
import { forwardRef, useEffect, useState, useCallback, useRef } from "react";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Apple,
  ArrowRightLeft,
  Bell,
  Bike,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  ConciergeBell,
  Crown,
  Droplets,
  Drumstick,
  Flame,
  Footprints,
  Loader2,
  Lock,
  Medal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Soup,
  Star,
  Store,
  TrendingUp,
  Trophy,
  Truck,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Heart,
  BarChart2,
  Users,
  Wheat,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Custom hand-drawn SVG icons for the Quick Actions cards.
   ═══════════════════════════════════════════════════════════════════ */

const TrackerIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeOpacity="0.45" />
      <circle cx="12" cy="12" r="5.5" strokeOpacity="0.75" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <path d="M20 4L13 11" />
      <path d="M13 11L15 9.5M13 11L11 13" />
      <path d="M20 4L21.6 4.4M20 4L20.4 5.6M20 4L19 5.4" strokeWidth={1.6} />
    </svg>
  )
);
TrackerIcon.displayName = "TrackerIcon";

const FavoriteIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20.5s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 3c0 5.8-7.5 10.2-7.5 10.2Z"
        fill="currentColor" fillOpacity="0.18" />
      <path d="M12 10.4L13 12.2L14.9 12.5L13.5 13.7L13.9 15.6L12 14.6L10.1 15.6L10.5 13.7L9.1 12.5L11 12.2L12 10.4Z"
        fill="currentColor" stroke="none" />
      <path d="M18 7L18.5 8.2L19.7 8.7L18.5 9.2L18 10.4L17.5 9.2L16.3 8.7L17.5 8.2L18 7Z" fill="currentColor" stroke="none" />
    </svg>
  )
);
FavoriteIcon.displayName = "FavoriteIcon";

const ProgressIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20.5H21" strokeOpacity="0.4" />
      <rect x="5" y="14" width="3.5" height="6" rx="0.8" fill="currentColor" fillOpacity="0.3" />
      <rect x="10.25" y="10" width="3.5" height="10" rx="0.8" fill="currentColor" fillOpacity="0.55" />
      <rect x="15.5" y="6" width="3.5" height="14" rx="0.8" fill="currentColor" fillOpacity="0.85" />
      <path d="M5 9L10 7L15 4L19 3" strokeWidth={1.8} />
      <path d="M19 3L17 3.2M19 3L18.8 5" strokeWidth={1.8} />
    </svg>
  )
);
ProgressIcon.displayName = "ProgressIcon";

const CommunityIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="9" r="3" fill="currentColor" fillOpacity="0.25" />
      <path d="M6.5 19.5C6.5 16.5 9 14.5 12 14.5C15 14.5 17.5 16.5 17.5 19.5" />
      <circle cx="5.5" cy="10.5" r="2.4" strokeOpacity="0.6" />
      <path d="M2 19.5C2 17.2 3.6 15.7 5.5 15.5" strokeOpacity="0.6" />
      <circle cx="18.5" cy="10.5" r="2.4" strokeOpacity="0.6" />
      <path d="M22 19.5C22 17.2 20.4 15.7 18.5 15.5" strokeOpacity="0.6" />
    </svg>
  )
);
CommunityIcon.displayName = "CommunityIcon";

const FatIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={className} stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5C8.4 3.5 5.5 6.4 5.5 10.2C5.5 14.5 8 19.5 12 20.5C16 19.5 18.5 14.5 18.5 10.2C18.5 6.4 15.6 3.5 12 3.5Z"
        fill="currentColor" fillOpacity="0.18" />
      <path d="M11.2 3.7C11.2 2.8 11.6 2.3 12 2.3C12.4 2.3 12.8 2.8 12.8 3.7" strokeWidth={1.5} />
      <circle cx="12" cy="11.2" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  )
);
FatIcon.displayName = "FatIcon";

import LogMealModal from "@/components/LogMealModal";
import { LogActivitySheet } from "@/components/LogActivitySheet";
import { ModifyOrderModal } from "@/components/ModifyOrderModal";
import { BodyCorrelationWidget } from "@/components/dashboard/BodyCorrelationWidget";
import { StepTrackerCard } from "@/components/dashboard/StepTrackerCard";
import { SubscriptionNudge } from "@/components/SubscriptionNudge";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import { useStreak } from "@/hooks/useStreak";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { getQatarNow, getQatarDay, formatLocaleDate } from "@/lib/dateUtils";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useBadgeChecker } from "@/hooks/useBadgeChecker";
import {
  progressRingVariants,
  staggerContainer,
  staggerItem,
  ambientGlow,
} from "@/lib/animations";

interface ActiveOrder {
  id: string;
  scheduled_date: string;
  order_status: "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery";
  meal_id: string;
  delivery_type: string | null;
  delivery_time_slot: string | null;
  meal_type: string | null;
  updated_at: string;
  meal_name?: string;
  restaurant_name?: string;
  meal_count?: number;
}

interface RestaurantSummary {
  id: string;
  name: string | null;
}

interface ActiveScheduleRow {
  id: string;
  scheduled_date: string;
  order_status: ActiveOrder["order_status"];
  meal_id: string;
  meal_type: string | null;
  delivery_type: string | null;
  delivery_time_slot: string | null;
  updated_at: string;
  meals: {
    id: string;
    name: string | null;
    restaurant_id: string | null;
    restaurants: RestaurantSummary | null;
  } | null;
}

interface TodayScheduleRow {
  id: string;
  meal_type: string | null;
  meal_id: string;
  scheduled_date: string;
  delivery_time_slot: string | null;
  meals: {
    id: string;
    name: string | null;
    image_url: string | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  } | null;
  restaurants: RestaurantSummary | null;
}

interface TodayMeal {
  type: string;
  schedule_id?: string;
  meal_type?: string;
  meal?: TodayScheduleRow["meals"];
  restaurant?: RestaurantSummary | null;
  delivery_time_slot?: string | null;
}

interface TopRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  meal_count: number;
}

interface GamificationBadge {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  rarity: string;
  xp_reward: number;
}

interface RecentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  created_at: string;
}

interface MealSchedule {
  id: string;
  scheduled_date: string;
  order_status: string;
  meal_id: string;
  delivery_type: string | null;
  updated_at: string;
  meal_name?: string;
  restaurant_name?: string;
  meal_count?: number;
}

/* ═══════════════════════════════════════════════════════════════════
   BENTO DASHBOARD — Level 6 Redesign
   New layout paradigm: bento grid canvas with tabbed sections,
   horizontal carousels, floating action button, and compact stat pills.
   Light mode. Emerald brand. Plus Jakarta Sans.
   ═══════════════════════════════════════════════════════════════════ */

type TabKey = "today" | "nutrition" | "activity" | "progress";

const Dashboard = () => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { subscription, remainingMeals, totalMeals, isUnlimited } = useSubscription();
  const { rolloverCredits } = useDashboardRolloverCredits(user?.id);
  const { t, language, isRTL } = useLanguage();
  useEffect(() => { document.title = `${t("dashboard_title")} — Nutrio`; }, [t]);
  const { PrevIcon, NextIcon } = getNavArrows(isRTL);
  const { unreadCount } = useNotifications(user?.id);
  const { summary: weeklySummary, loading: weeklyLoading } = useWeeklySummary(user?.id);
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [progressKey, setProgressKey] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [totalActiveOrders, setTotalActiveOrders] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [topRestaurantsLoading, setTopRestaurantsLoading] = useState(true);
  const [topRestaurantsError, setTopRestaurantsError] = useState(false);
  const [todayMeals, setTodayMeals] = useState<TodayMeal[]>([]);
  const [todayMealsLoading, setTodayMealsLoading] = useState(true);
  const [todayMealsError, setTodayMealsError] = useState(false);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [gamification, setGamification] = useState({ xp: 0, level: 1, xpToNextLevel: 100, earnedBadges: 0, totalBadges: 0, badges: [] as GamificationBadge[], earnedIds: new Set<string>() });
  const [waterToday, setWaterToday] = useState(0);
  const [waterGoal, setWaterGoal] = useState(2500);
  const [stepsToday, setStepsToday] = useState(0);
  const [stepsGoal, setStepsGoal] = useState(6000);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<MealSchedule | null>(null);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, progressKey);
  const { streaks } = useStreak(user?.id);
  const dailyStreak = streaks?.logging?.currentStreak ?? 0;
  useBadgeChecker(user?.id);
  const todayStr = selectedDate.toISOString().split("T")[0];

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("water_entries")
      .select("amount_ml")
      .eq("user_id", user.id)
      .eq("log_date", todayStr)
      .then(({ data, error }) => {
        if (!error && data) {
          setWaterToday(data.reduce((sum, e) => sum + (e.amount_ml || 0), 0));
        }
      });
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("water_goal_ml");
      if (stored) setWaterGoal(parseInt(stored, 10));
    }
  }, [user?.id, todayStr]);

  useEffect(() => {
    if (!user?.id) return;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`tracker_step_goal_${user.id}`);
      if (stored) setStepsGoal(parseInt(stored, 10));
      const stepsRaw = localStorage.getItem(`tracker_steps_${user.id}_${todayStr}`);
      if (stepsRaw) setStepsToday(parseInt(stepsRaw, 10));
    }
  }, [user?.id, todayStr]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);
  const { measurements: weightHistory } = useBodyMeasurements(user?.id);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetchGamification = async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles").select("level").eq("user_id", user.id).single();
        if (cancelled) return;
        const userXp = profile?.xp || 0;
        const userLevel = profile?.level || 1;
        const [{ data: allBadges }, { data: earned }] = await Promise.all([
          supabase.from("badges").select("id, name, description, icon, rarity, xp_reward"),
          supabase.from("user_badges").select("badge_id, unlocked_at").eq("user_id", user.id),
        ]);
        if (cancelled) return;
        const earnedIds = new Set((earned as { badge_id: string }[] || []).map((b) => b.badge_id));
        setGamification({
          xp: userXp, level: userLevel, xpToNextLevel: 100,
          earnedBadges: earnedIds.size, totalBadges: (allBadges || []).length,
          badges: (allBadges || []), earnedIds,
        });
      } catch { /* silent */ }
    };
    fetchGamification();
    return () => { cancelled = true; };
  }, [user?.id]);

  const fetchActiveOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [{ data: schedules, error: schedulesError }, { count: totalCount, error: countError }] = await Promise.all([
        supabase
          .from("meal_schedules")
          .select(`id, scheduled_date, order_status, meal_id, meal_type, delivery_type, delivery_time_slot, updated_at, meals:meal_id (id, name, restaurant_id, restaurants:restaurant_id (id, name))`)
          .eq("user_id", user.id)
          .in("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery"])
          .order("scheduled_date", { ascending: true })
          .limit(3),
        supabase
          .from("meal_schedules")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery"]),
      ] as const);
      if (schedulesError) throw schedulesError;
      if (!countError) setTotalActiveOrders(totalCount ?? 0);
      if (!schedules || schedules.length === 0) {
        setActiveOrders([]); setOrdersLoading(false); return;
      }
      const activeSchedules = (schedules ?? []) as unknown as ActiveScheduleRow[];
      const orders: ActiveOrder[] = activeSchedules
        .filter((schedule) => schedule.meals !== null)
        .map((schedule) => ({
          id: schedule.id, order_status: schedule.order_status,
          scheduled_date: schedule.scheduled_date, meal_id: schedule.meal_id,
          meal_type: schedule.meal_type || null,
          meal_name: schedule.meals?.name || "Meal",
          restaurant_name: schedule.meals?.restaurants?.name || "Restaurant",
          delivery_type: schedule.delivery_type || "pickup",
          delivery_time_slot: schedule.delivery_time_slot || null,
          updated_at: schedule.updated_at,
        }));
      setActiveOrders(orders);
    } catch (err) {
      console.error("Error fetching active orders:", err);
      setActiveOrders([]); setOrdersError(true);
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchActiveOrders(); }, [fetchActiveOrders]);

  const handleCancelOrder = async (scheduleId: string) => {
    if (!window.confirm("Cancel this order? You can reorder anytime.")) return;
    setCancellingId(scheduleId);
    try {
      const { error } = await supabase.rpc("cancel_meal_schedule", { p_schedule_id: scheduleId, p_reason: null });
      if (error) throw error;
      setActiveOrders((prev) => prev.filter((o) => o.id !== scheduleId));
    } catch (err) {
      console.error("Error cancelling order:", err);
    } finally {
      setCancellingId(null);
    }
  };

  const fetchTopRestaurants = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data: featured, error: featuredError } = await supabase
        .from("featured_listings")
        .select(`restaurant_id, restaurants:restaurant_id (id, name, logo_url, rating, total_orders, description, cuisine_types)`)
        .eq("status", "active")
        .lte("starts_at", now)
        .gte("ends_at", now)
        .order("price_paid", { ascending: false })
        .limit(5);
      if (featuredError) throw featuredError;
      const restaurants = (featured || []).map((f: { restaurants: TopRestaurant[] }) => f.restaurants).filter(Boolean);
      setTopRestaurants(restaurants);
    } catch (err) {
      console.error("Error fetching featured restaurants:", err);
      setTopRestaurants([]); setTopRestaurantsError(true);
    } finally {
      setTopRestaurantsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTopRestaurants(); }, [fetchTopRestaurants]);

  const fetchTodayMeals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const today = getQatarDay();
      const { data: schedules, error } = await supabase
        .from("meal_schedules")
        .select(`id, meal_type, meal_id, scheduled_date, delivery_time_slot, meals:meal_id (id, name, image_url, calories, protein_g, carbs_g, fat_g), restaurants:restaurant_id (id, name)`)
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .order("meal_type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const slots: Record<string, TodayMeal[]> = { breakfast: [], lunch: [], dinner: [] };
      const todaySchedules = (schedules ?? []) as unknown as TodayScheduleRow[];
      todaySchedules.forEach((s) => {
        const type = s.meal_type || "other";
        const group = ["breakfast", "lunch", "dinner"].includes(type) ? type : "other";
        if (group === "other") return;
        if (slots[group].length === 0) {
          slots[group].push({
            schedule_id: s.id, meal_type: group, meal: s.meals || null,
            restaurant: s.restaurants || null, delivery_time_slot: s.delivery_time_slot || null,
          });
        }
      });
      setTodayMeals(Object.entries(slots).map(([type, items]) => ({ type, ...(items[0] || {}) })));
    } catch (err) {
      console.error("Error fetching today's meals:", err);
      setTodayMealsError(true);
    } finally {
      setTodayMealsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchTodayMeals(); }, [fetchTodayMeals]);

  const animatedCalories = useAnimatedCounter(Math.round(todayProgress.calories), 800);
  const animatedBurned = useAnimatedCounter(totalBurned, 800);
  const animatedBalance = useAnimatedCounter(
    isUnlimited ? 0 : Number.isFinite(remainingMeals + rolloverCredits) ? Number(remainingMeals + rolloverCredits) : 40,
    600
  );

  useEffect(() => {
    if (sessionStorage.getItem("nutrio_onboarding_done") === "true") return;
    if (profileLoading) return;
    if (profile && profile.onboarding_completed === false && !profile.goal) {
      navigate("/onboarding");
    }
  }, [profile, profileLoading, navigate]);

  useEffect(() => {
    const handler = () => setProgressKey((key) => key + 1);
    window.addEventListener("nutrio:meal-progress-changed", handler);
    return () => window.removeEventListener("nutrio:meal-progress-changed", handler);
  }, []);

  const todayStart = getQatarNow();
  todayStart.setHours(0, 0, 0, 0);
  const isToday = selectedDate.toDateString() === todayStart.toDateString();

  useEffect(() => {
    if (!user) return;
    const loadWorkoutSummary = async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("calories_burned")
        .eq("user_id", user.id)
        .eq("session_date", todayStr);
      if (error) { console.error("Failed to load workout summary", error); return; }
      setTotalBurned(data.reduce((sum, session) => sum + (session.calories_burned ?? 0), 0));
      setWorkoutCount(data.length);
    };
    loadWorkoutSummary();
  }, [user, todayStr]);

  const fetchRecentNotifications = useCallback(async () => {
    if (!user?.id) return;
    setNotifsLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, message, type, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      setRecentNotifications((data || []) as RecentNotification[]);
    } catch {
      /* silent */
    } finally {
      setNotifsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (showNotificationsDropdown) fetchRecentNotifications();
  }, [showNotificationsDropdown, fetchRecentNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Loading state ──────────────────────────────────────────────────
  if (profileLoading && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F7F4] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-sm font-semibold text-slate-500">{t("loading")}</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (profileError && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F7F4] gap-4 px-6 py-9">
        <div className="w-full max-w-[360px] text-center space-y-4 rounded-[28px] bg-white p-7 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{t("dashboard_something_went_wrong")}</h2>
          <p className="text-sm text-slate-500">{t("profile_load_error")}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.3)]"
          >
            {t("retry_button")}
          </button>
        </div>
      </div>
    );
  }

  // ── Computed values ────────────────────────────────────────────────
  const effectiveMealsLeft = isUnlimited ? Infinity : remainingMeals + (rolloverCredits || 0);
  const balanceDisplay = isUnlimited ? "∞" : Number.isFinite(effectiveMealsLeft) ? Number(effectiveMealsLeft) : "…";
  const totalMealsDisplay = isUnlimited ? "∞" : Number.isFinite(totalMeals) ? Number(totalMeals) : "…";
  const rawUserName = profile?.full_name?.trim()
    ? (profile.full_name.includes(" ") ? profile.full_name.split(" ")[0] : profile.full_name)
    : t("guest_greeting") || "Guest";
  const userName = rawUserName.charAt(0).toUpperCase() + rawUserName.slice(1).toLowerCase();
  const qatarNow = getQatarNow();
  const hourNow = qatarNow.getHours();
  const timeGreeting = hourNow < 12 ? t("good_morning") : hourNow < 18 ? t("good_afternoon") : t("good_evening");
  const dateLabel = formatLocaleDate(selectedDate, language, { weekday: "short", month: "short", day: "numeric" });
  const dailyCalories = profile?.daily_calorie_target || 2066;
  const calConsumed = Math.round(todayProgress.calories);
  const calBurned = totalBurned;
  const netCalories = Math.max(0, calConsumed - calBurned);
  const calRemaining = Math.max(0, dailyCalories - netCalories);
  const consumedPct = Math.min((netCalories / (dailyCalories || 1)) * 100, 100);
  const overBudget = netCalories > dailyCalories;
  const ringColor = overBudget ? "#EF4444" : "#059669";
  const ringRadius = 62;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (Math.min(consumedPct, 100) / 100) * ringCirc;
  const balanceRadius = 40;
  const balanceCirc = 2 * Math.PI * balanceRadius;
  const balancePct = isUnlimited ? 100 : Math.min((Number(balanceDisplay) / (Number(totalMealsDisplay) || 1)) * 100, 100);
  const balanceOffset = balanceCirc - (balancePct / 100) * balanceCirc;
  const completedThisWeek = dailyStreak;
  const waterPct = waterGoal > 0 ? Math.min((waterToday / waterGoal) * 100, 100) : 0;
  const stepsPct = stepsGoal > 0 ? Math.min((stepsToday / stepsGoal) * 100, 100) : 0;
  const dailyScore = Math.round((Math.min(consumedPct, 100) + waterPct + stepsPct + Math.min(balancePct, 100)) / 4);

  const rarityConfig: Record<string, { bg: string; border: string; gradient: string }> = {
    common: { bg: "bg-gray-50", border: "border-gray-200", gradient: "from-gray-400 to-gray-500" },
    rare: { bg: "bg-blue-50", border: "border-blue-200", gradient: "from-blue-400 to-blue-600" },
    epic: { bg: "bg-indigo-50", border: "border-[#C7D2FE]", gradient: "from-[#818CF8] to-[#3730A3]" },
    legendary: { bg: "bg-amber-50", border: "border-[#FDE68A]", gradient: "from-[#FBBF24] to-[#D97706]" },
  };
  const displayedUnreadCount = unreadCount > 99 ? 99 : unreadCount;

  const planName = subscription?.plan || "Free Plan";
  const joinedDate = subscription?.start_date ? new Date(subscription.start_date) : null;
  const joinedLabel = joinedDate
    ? `Joined ${joinedDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : "Joined recently";

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };
  const goToNextDay = () => {
    if (isToday) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const carbsTarget = profile?.carbs_target_g || activeGoal?.carbs_target_g || 250;
  const proteinTarget = profile?.protein_target_g || activeGoal?.protein_target_g || 150;
  const fatTarget = profile?.fat_target_g || activeGoal?.fat_target_g || 65;

  const macroCards = [
    { label: t("carbs"), value: Math.round(todayProgress.carbs), target: carbsTarget, Icon: Wheat,
      iconClass: "from-[#A7F3D0] to-[#34D399] text-emerald-600", dotClass: "bg-emerald-500", pillClass: "bg-emerald-50 text-emerald-600" },
    { label: t("protein_label"), value: Math.round(todayProgress.protein), target: proteinTarget, Icon: Drumstick,
      iconClass: "from-[#FDBA74] to-[#F97316] text-white", dotClass: "bg-[#F97316]", pillClass: "bg-orange-50 text-orange-600" },
    { label: t("fat_label"), value: Math.round(todayProgress.fat), target: fatTarget, Icon: FatIcon,
      iconClass: "from-[#818CF8] to-[#4F46E5] text-white", dotClass: "bg-[#6366F1]", pillClass: "bg-indigo-50 text-indigo-600" },
  ];

  const plannedMeals = todayMeals.filter((item) => item.meal);
  const nextMeal = plannedMeals[0];
  const proteinGap = Math.max(0, proteinTarget - todayProgress.protein);
  const carbsGap = Math.max(0, carbsTarget - todayProgress.carbs);
  const fatGap = Math.max(0, fatTarget - todayProgress.fat);
  const weeklyConsistency = weeklySummary?.consistency?.percentage ?? 0;
  const latestWeight = weightHistory?.findLast?.((entry) => entry.weight_kg != null)?.weight_kg;

  const focusItems = [
    nextMeal
      ? { label: "Next meal", title: nextMeal.meal?.name || "Meal ready",
          detail: nextMeal.delivery_time_slot || nextMeal.restaurant?.name || "Review today's meal",
          Icon: UtensilsCrossed, tone: "bg-orange-50 text-orange-600 ring-orange-100",
          action: () => navigate(nextMeal.meal?.id ? `/meals/${nextMeal.meal.id}` : "/meals") }
      : { label: "Meals", title: "Plan today's meals", detail: "Breakfast, lunch, and dinner are open",
          Icon: ConciergeBell, tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
          action: () => navigate("/meals") },
    waterPct < 80
      ? { label: "Hydration", title: `${Math.max(0, waterGoal - waterToday)} ml left`, detail: "Close the water ring",
          Icon: Droplets, tone: "bg-blue-50 text-blue-600 ring-blue-100",
          action: () => navigate("/water-tracker") }
      : { label: "Hydration", title: "Water on track", detail: `${waterToday} ml logged today`,
          Icon: Droplets, tone: "bg-blue-50 text-blue-600 ring-blue-100",
          action: () => navigate("/water-tracker") },
    proteinGap > 25
      ? { label: "Protein", title: `${Math.round(proteinGap)}g protein gap`, detail: "Pick a high-protein meal",
          Icon: Drumstick, tone: "bg-rose-50 text-rose-600 ring-rose-200",
          action: () => navigate("/meals") }
      : { label: "Movement", title: workoutCount > 0 ? `${workoutCount} sessions logged` : "Log a workout",
          detail: workoutCount > 0 ? `${totalBurned} cal burned` : "Keep your activity streak alive",
          Icon: Activity, tone: "bg-emerald-50 text-emerald-600 ring-emerald-100",
          action: () => setSheetOpen(true) },
  ];

  const coachInsights = [
    { label: "AI read",
      title: dailyScore >= 80 ? "Strong day building" : "One smart action changes today",
      detail: dailyScore >= 80 ? "Keep the rhythm. Protect hydration and protein." : "Prioritize the first focus card before anything else.",
      Icon: Apple, tone: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
    { label: "Macro risk",
      title: proteinGap > carbsGap && proteinGap > fatGap ? `${Math.round(proteinGap)}g protein short` : `${calRemaining} cal remaining`,
      detail: proteinGap > 25 ? "Your next meal should be protein-led." : "Your macro balance is steady enough for a flexible meal.",
      Icon: Drumstick, tone: "bg-orange-50 text-orange-700 ring-orange-100" },
    { label: "Habit signal",
      title: `${dailyStreak} day streak`,
      detail: weeklyConsistency ? `${weeklyConsistency}% weekly consistency` : "Log one action to strengthen the loop.",
      Icon: Flame, tone: "bg-indigo-50 text-indigo-800 ring-indigo-100" },
  ];

  const shortcutActions = [
    { icon: BarChart2, label: t("progress_label"), detail: "Goals and trends", circleBg: "#EA580C", to: "/progress" },
    { icon: Users, label: t("community_label"), detail: "People and coaches", circleBg: "#3B4CCA", to: "/community" },
  ] as { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; detail: string; circleBg: string; to: string }[];

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: "today", label: "Today", icon: ConciergeBell },
    { key: "nutrition", label: "Nutrition", icon: Apple },
    { key: "activity", label: "Activity", icon: Activity },
    { key: "progress", label: "Progress", icon: TrendingUp },
  ];

  // ════════════════════════════════════════════════════════════════════
  //  RENDER — Bento Grid Dashboard
  // ════════════════════════════════════════════════════════════════════
  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      className="relative min-h-screen bg-[#F6F7F4] text-slate-900"
      style={{ overflowX: "clip" }}
    >
      {/* Ambient gradient background */}
      <div className="absolute inset-0 pointer-events-none bg-[#F6F7F4]" />

      {/* ── Floating Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-white/70 bg-[#F6F7F4]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[480px] px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex h-[68px] items-center justify-between">
            <Link to="/profile" className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-slate-100/60 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={userName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[14px] font-bold text-emerald-600">{userName.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">{timeGreeting}</p>
                <h1 className="text-[17px] font-black leading-none tracking-[-0.03em] text-slate-950">{userName}</h1>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {/* Favorites */}
              <button
                type="button"
                onClick={() => navigate("/favorites")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-rose-500 shadow-sm ring-1 ring-slate-200/80 transition active:scale-95"
                aria-label={t("favorites_label")}
              >
                <Heart className="h-5 w-5" strokeWidth={2.2} />
              </button>

              {/* Notifications */}
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200/80"
                  aria-label={t("Notifications")}
                >
                  <Bell className="h-4.5 w-4.5" strokeWidth={2.1} />
                  {displayedUnreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#FF1D25] px-1 text-[9px] font-extrabold leading-none text-white ring-2 ring-white">
                      {displayedUnreadCount > 9 ? "9+" : displayedUnreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotificationsDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 360, damping: 28 }}
                      className="absolute right-0 top-[42px] z-50 w-[340px] max-w-[calc(100vw-40px)] rounded-[22px] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.14)] ring-1 ring-slate-200/80 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <h3 className="text-[14px] font-extrabold tracking-[-0.01em] text-slate-950">{t("dashboard_notifications_title")}</h3>
                        {displayedUnreadCount > 0 && (
                          <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">{displayedUnreadCount} new</span>
                        )}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {notifsLoading ? (
                          <div className="space-y-3 p-4">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="flex items-center gap-3">
                                <div className="h-[36px] w-[36px] animate-pulse rounded-xl bg-slate-100" />
                                <div className="flex-1 space-y-1.5">
                                  <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                                  <div className="h-2.5 w-full animate-pulse rounded bg-slate-50" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : recentNotifications.length === 0 ? (
                          <div className="flex flex-col items-center justify-center px-4 py-8">
                            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-slate-100">
                              <Bell className="h-[20px] w-[20px] text-slate-400" strokeWidth={1.5} />
                            </div>
                            <p className="mt-3 text-[13px] font-semibold text-slate-700">{t("dashboard_all_caught_up")}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{t("dashboard_no_new_notifications")}</p>
                          </div>
                        ) : (
                          recentNotifications.map((notif) => {
                            const cfg = (({
                              order_update: { icon: Truck, bg: "bg-[#E6FFF5]", iconColor: "text-emerald-600" },
                              meal_reminder: { icon: Utensils, bg: "bg-[#FFF4E6]", iconColor: "text-orange-500" },
                              subscription_alert: { icon: Crown, bg: "bg-orange-50", iconColor: "text-orange-600" },
                              general: { icon: TrendingUp, bg: "bg-[#EFF6FF]", iconColor: "text-[#3B82F6]" },
                              announcement: { icon: Bell, bg: "bg-amber-100", iconColor: "text-[#F59E0B]" },
                            } as Record<string, { icon: React.ElementType; bg: string; iconColor: string }>)[notif.type]) || { icon: Bell, bg: "bg-slate-100", iconColor: "text-slate-500" };
                            const IconComponent = cfg.icon;
                            const isUnread = notif.status === "unread";
                            return (
                              <button
                                key={notif.id}
                                type="button"
                                onClick={() => { setShowNotificationsDropdown(false); navigate("/notifications"); }}
                                className={`flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-slate-50 ${isUnread ? "bg-indigo-50/30" : ""}`}
                              >
                                <div className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl ${cfg.bg} ${isUnread ? "ring-2 ring-indigo-200" : ""}`}>
                                  <IconComponent className={`h-[18px] w-[18px] ${cfg.iconColor}`} strokeWidth={1.75} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className={`truncate text-[13px] font-semibold ${isUnread ? "text-slate-950" : "text-slate-700"}`}>{notif.title}</p>
                                    {isUnread && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-emerald-600" />}
                                  </div>
                                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500">{notif.message}</p>
                                  <span className="mt-1 inline-block text-[10px] font-medium text-slate-400">
                                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                  </span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                      <Link
                        to="/notifications"
                        onClick={() => setShowNotificationsDropdown(false)}
                        className="flex items-center justify-center gap-1.5 border-t border-slate-100/60 px-4 py-3 text-[13px] font-semibold text-emerald-600 transition hover:bg-emerald-50"
                      >
                        View all notifications
                        <NextIcon className="h-[14px] w-[14px]" strokeWidth={2} />
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Tab Bar ────────────────────────────────────────────── */}
          <div className="flex gap-1 pb-2">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition-all ${
                  activeTab === key
                    ? "bg-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                    : "bg-white/60 text-slate-500 ring-1 ring-slate-200/80"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────── */}
      <main className="relative mx-auto max-w-[480px] px-4 pb-28 pt-3">

        {/* ══════════════════════════════════════════════════════════════
            TAB: TODAY — Bento grid with score, focus, meals, orders
            ══════════════════════════════════════════════════════════════ */}
        {activeTab === "today" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* ── Bento Row 1: Score (2/3) + Balance (1/3) ──────────── */}
            <div className="grid grid-cols-3 gap-3">
              {/* Score tile — spans 2 */}
              <motion.button
                type="button"
                onClick={() => navigate("/tracker")}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                className="col-span-2 flex flex-col justify-between rounded-[24px] bg-white p-4 text-left shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">{dateLabel}</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Daily score</p>
                    <p className="mt-0.5 text-[28px] font-black leading-none tracking-[-0.05em] text-slate-950">
                      {dailyScore}<span className="text-[14px] font-bold text-slate-400">/100</span>
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-slate-500">{calRemaining} {t("cal_short")} {t("dashboard_remaining")}</p>
                  </div>
                  <div className="relative flex h-[72px] w-[72px] items-center justify-center">
                    <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#E8EDE9" strokeWidth="7" />
                      <motion.circle
                        cx="40" cy="40" r="34" fill="none" stroke={ringColor}
                        strokeWidth="7" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 34}
                        initial={prefersReducedMotion ? undefined : { strokeDashoffset: 2 * Math.PI * 34 }}
                        animate={{ strokeDashoffset: (2 * Math.PI * 34) - (Math.min(dailyScore, 100) / 100) * (2 * Math.PI * 34) }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </svg>
                    <span className="text-[20px] font-black text-slate-950">{dailyScore}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {[
                    { label: "CAL", value: `${animatedCalories}`, Icon: Flame, color: "text-emerald-600" },
                    { label: "MEALS", value: `${animatedBalance}`, Icon: Crown, color: "text-orange-600" },
                    { label: "WATER", value: `${Math.round(waterPct)}%`, Icon: Droplets, color: "text-blue-600" },
                    { label: "STEPS", value: `${stepsToday}`, Icon: Footprints, color: "text-rose-600" },
                  ].map(({ label, value, Icon, color }) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-1.5 py-2 text-center ring-1 ring-slate-200/60">
                      <Icon className={`mx-auto h-3.5 w-3.5 ${color}`} strokeWidth={2} />
                      <p className="mt-1 text-[11px] font-black leading-none text-slate-950">{value}</p>
                      <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              </motion.button>

              {/* Subscription tile — spans 1 */}
              <motion.button
                type="button"
                onClick={() => navigate("/subscription")}
                initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                className="col-span-1 flex min-h-[176px] flex-col items-stretch justify-between rounded-[24px] bg-white p-3 text-left shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 transition active:scale-[0.99]"
                aria-label="Open subscription"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-600">Subscription</p>
                    <p className="mt-0.5 text-[13px] font-black leading-tight text-slate-950">Meal balance</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                    <Crown className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                </div>

                <div className="flex justify-center py-1">
                  <div className="relative flex h-[68px] w-[68px] items-center justify-center">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                      <circle cx="40" cy="40" r={balanceRadius} fill="none" stroke="#E2E8F0" strokeWidth="7" />
                      <motion.circle
                        cx="40" cy="40" r={balanceRadius} fill="none" stroke="#059669"
                        strokeLinecap="round" strokeWidth="7"
                        strokeDasharray={balanceCirc} strokeDashoffset={balanceOffset}
                        variants={progressRingVariants} initial="hidden" animate="visible"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[18px] font-black leading-none text-emerald-600">{balanceDisplay}</span>
                      <span className="text-[7px] font-bold uppercase tracking-wide text-slate-400">left</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-[16px] bg-slate-50 px-2.5 py-2 ring-1 ring-slate-200/80">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black text-slate-950">{planName}</p>
                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">Manage plan</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2.4} />
                </div>
              </motion.button>
            </div>

            {/* ── Quick Action Row ──────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Order", Icon: ConciergeBell, action: () => navigate("/meals"), bg: "bg-emerald-600 text-white" },
                { label: "Log", Icon: Plus, action: () => setLogMealOpen(true), bg: "bg-white text-slate-950 ring-1 ring-slate-200/80" },
                { label: "Water", Icon: Droplets, action: () => navigate("/water-tracker"), bg: "bg-white text-slate-950 ring-1 ring-slate-200/80" },
                { label: "Steps", Icon: Footprints, action: () => navigate("/step-counter"), bg: "bg-white text-slate-950 ring-1 ring-slate-200/80" },
              ].map(({ label, Icon, action, bg }) => (
                <motion.button
                  key={label}
                  type="button"
                  onClick={action}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-[18px] py-3 ${bg} shadow-[0_12px_35px_rgba(15,23,42,0.06)]`}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                  <span className="text-[11px] font-bold">{label}</span>
                </motion.button>
              ))}
            </div>

            {/* ── Daily Focus ───────────────────────────────────────── */}
            <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Daily focus</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">Do this next</h2>
                </div>
                <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  {dailyScore}/100
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {focusItems.map(({ label, title, detail, Icon, tone, action }, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="flex min-h-[64px] w-full items-center gap-3 rounded-[18px] bg-slate-50 p-3 text-left ring-1 ring-slate-200/80 transition active:scale-[0.99]"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] ring-1 ${tone}`}>
                      <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-slate-400 ring-1 ring-slate-200/80">
                          {index + 1}
                        </span>
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                      </div>
                      <p className="mt-0.5 truncate text-[14px] font-black tracking-[-0.02em] text-slate-950">{title}</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{detail}</p>
                    </div>
                    <NextIcon className="h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2.4} />
                  </button>
                ))}
              </div>
            </div>

            {/* ── Today's Meals ─────────────────────────────────────── */}
            <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-500">Meals</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">{t("dashboard_today_meals")}</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-orange-500 ring-1 ring-orange-100">
                  <UtensilsCrossed className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
              </div>

              <div className="mt-3 space-y-0 divide-y divide-slate-100">
                {(() => {
                  const slots = [
                    { type: "breakfast", label: t("breakfast"), icon: Coffee, color: "from-[#FBBF24] to-[#F97316]", bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200" },
                    { type: "lunch", label: t("lunch"), icon: Soup, color: "from-[#34D399] to-[#059669]", bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200" },
                    { type: "dinner", label: t("dinner"), icon: UtensilsCrossed, color: "from-[#818CF8] to-[#4338CA]", bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
                  ];
                  const hasAnyMeal = slots.some((s) => {
                    const m = todayMeals.find((tm) => tm.type === s.type);
                    return m && m.meal;
                  });

                  if (!hasAnyMeal) {
                    return (
                      <Link to="/meals" className="block bg-[#F6F7F4] transition active:scale-[0.99]">
                        <div className="flex min-h-[72px] items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-emerald-100">
                          <div className="flex -space-x-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FBBF24] to-[#F97316] text-white ring-2 ring-white">
                              <Coffee className="h-[15px] w-[15px]" strokeWidth={1.75} />
                            </div>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#34D399] to-[#059669] text-white ring-2 ring-white">
                              <Soup className="h-[15px] w-[15px]" strokeWidth={1.75} />
                            </div>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#818CF8] to-[#4338CA] text-white ring-2 ring-white">
                              <UtensilsCrossed className="h-[15px] w-[15px]" strokeWidth={1.75} />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[13px] font-extrabold text-slate-900">{t("dashboard_plan_meals_for_today")}</h3>
                            <p className="mt-0.5 text-[11px] text-slate-500">{t("today_meals_desc")}</p>
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                            <Plus className="h-4 w-4" strokeWidth={2.5} />
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  return slots.map((slot) => {
                    const meal = todayMeals.find((m) => m.type === slot.type);
                    const hasMeal = meal && meal.meal;
                    const IconSlot = slot.icon;
                    return (
                      <div key={slot.type}>
                        <motion.div
                          whileTap={prefersReducedMotion ? undefined : { scale: hasMeal ? 0.98 : 1 }}
                          onClick={() => hasMeal && setExpandedMeal(expandedMeal === `${slot.type}-${meal.schedule_id}` ? null : `${slot.type}-${meal.schedule_id}`)}
                          className={`flex min-h-[72px] items-center gap-3 py-3 transition-colors ${hasMeal ? `${slot.bg} cursor-pointer` : "bg-white"}`}
                        >
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br ${slot.color} text-white shadow-[0_4px_12px_rgba(0,0,0,0.08)]`}>
                            <IconSlot className="h-[18px] w-[18px]" strokeWidth={1.75} />
                          </div>
                          {hasMeal ? (
                            <>
                              {meal.meal?.image_url ? (
                                <img src={meal.meal.image_url} alt={meal.meal.name} className="h-[48px] w-[48px] shrink-0 rounded-[16px] object-cover shadow-sm" />
                              ) : (
                                <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[16px] bg-white shadow-sm ring-1 ring-slate-200/80">
                                  <Utensils className="h-[18px] w-[18px] text-slate-400" strokeWidth={1.5} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-black leading-snug text-slate-950">{meal.meal?.name || slot.label}</p>
                                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                  {meal.restaurant?.name && <span className="truncate">{meal.restaurant.name}</span>}
                                  {meal.meal?.calories && <><span className="text-slate-300">·</span><span>{meal.meal.calories} cal</span></>}
                                  {meal.delivery_time_slot && <><span className="text-slate-300">·</span><span>{meal.delivery_time_slot}</span></>}
                                </p>
                              </div>
                              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-transform ${expandedMeal === `${slot.type}-${meal.schedule_id}` ? "rotate-90" : ""}`}>
                                <NextIcon className="h-3 w-3" strokeWidth={2} />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[14px] font-black ${slot.text}`}>{slot.label}</p>
                                <p className="mt-0.5 text-[11px] font-medium text-slate-400">{t("dashboard_no_meal_planned")}</p>
                              </div>
                              <Link to="/meals" className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-600 ring-1 ring-emerald-100 transition active:scale-95">
                                <Plus className="h-3 w-3" strokeWidth={2.5} />Order Now
                              </Link>
                            </>
                          )}
                        </motion.div>
                        <AnimatePresence>
                          {expandedMeal === `${slot.type}-${meal?.schedule_id}` && hasMeal && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 28 }}
                              className="overflow-hidden"
                            >
                              <div className="mx-2 mb-3 rounded-[20px] bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/80">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-400">{t("dashboard_nutrition_facts")}</p>
                                <div className="mt-2 grid grid-cols-4 gap-1.5">
                                  <div className="rounded-xl bg-gradient-to-br from-[#FFFBEB] to-[#FFF7ED] p-2 text-center ring-1 ring-amber-200">
                                    <Flame className="mx-auto h-[16px] w-[16px] text-[#F59E0B]" strokeWidth={1.75} />
                                    <p className="mt-1 text-[14px] font-extrabold leading-none text-slate-950">{meal.meal?.calories || 0}</p>
                                    <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-amber-600">{t("cal_short")}</p>
                                  </div>
                                  <div className="rounded-xl bg-gradient-to-br from-[#FFF1F2] to-[#FFF1F2] p-2 text-center ring-1 ring-rose-200">
                                    <Drumstick className="mx-auto h-[16px] w-[16px] text-rose-500" strokeWidth={1.75} />
                                    <p className="mt-1 text-[14px] font-extrabold leading-none text-slate-950">{meal.meal?.protein_g || 0}g</p>
                                    <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-rose-600">{t("dashboard_protein")}</p>
                                  </div>
                                  <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-2 text-center ring-1 ring-blue-100">
                                    <Wheat className="mx-auto h-[16px] w-[16px] text-blue-500" strokeWidth={1.75} />
                                    <p className="mt-1 text-[14px] font-extrabold leading-none text-slate-950">{meal.meal?.carbs_g || 0}g</p>
                                    <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-blue-600">{t("dashboard_carbs")}</p>
                                  </div>
                                  <div className="rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#EEF2FF] p-2 text-center ring-1 ring-indigo-100">
                                    <FatIcon className="mx-auto h-[16px] w-[16px] text-indigo-600" strokeWidth={1.75} />
                                    <p className="mt-1 text-[14px] font-extrabold leading-none text-slate-950">{meal.meal?.fat_g || 0}g</p>
                                    <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-indigo-700">{t("fat_short")}</p>
                                  </div>
                                </div>
                                <Link to={`/meals/${meal.meal?.id}`} className="mt-2 flex items-center justify-center gap-1 rounded-full bg-emerald-50 py-2 text-[11px] font-semibold text-emerald-600 transition hover:bg-[#D1FAE5]">
                                  View Full Details <NextIcon className="h-3 w-3" strokeWidth={2} />
                                </Link>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  });
                })()}
              </div>

              {todayMealsError && (
                <div className="mt-3 rounded-[18px] bg-amber-50 p-3 ring-1 ring-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-slate-800">{t("dashboard_today_error")}</p>
                      <p className="text-[10px] text-slate-500">{t("dashboard_tap_to_try_again")}</p>
                    </div>
                    <button type="button"
                      onClick={() => { setTodayMealsError(false); setTodayMealsLoading(true); fetchTodayMeals(); }}
                      className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      {t("retry_button")}
                    </button>
                  </div>
                </div>
              )}
              {todayMealsLoading && (
                <div className="mt-3 space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-[60px] animate-pulse rounded-[16px] bg-slate-100" />)}
                </div>
              )}
            </div>

            {/* ── Subscription Nudge ────────────────────────────────── */}
            <SubscriptionNudge />

            {/* ── Active Orders ─────────────────────────────────────── */}
            {ordersError && (
              <div className="rounded-[20px] bg-amber-50 p-4 ring-1 ring-amber-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                    <AlertCircle className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-slate-800">{t("dashboard_orders_error")}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{t("dashboard_orders_error_desc")}</p>
                  </div>
                  <button type="button"
                    onClick={() => { setOrdersError(false); fetchActiveOrders(); }}
                    className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-200">
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />{t("retry_button")}
                  </button>
                </div>
              </div>
            )}
            {activeOrders.length > 0 && (
              <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br from-[#059669] to-[#047857] text-white shadow-[0_4px_12px_rgba(16,185,129,0.15)]">
                      <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Orders</p>
                      <h2 className="mt-0.5 text-[16px] font-black tracking-[-0.03em] text-slate-950">{t("active_orders")}</h2>
                      <p className="text-[11px] font-semibold text-slate-400">{t("orders_in_progress_full", { count: String(totalActiveOrders), plural: totalActiveOrders !== 1 ? "s" : "", show: String(activeOrders.length) })}</p>
                    </div>
                  </div>
                  <Link to="/orders?tab=scheduled" className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-600 ring-1 ring-emerald-100 transition active:scale-95">
                    {t("orders_section_view_all")}<NextIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="mt-3 space-y-0 divide-y divide-slate-100">
                  {activeOrders.map((order) => {
                    const statusConfig: Record<string, { label: string; Icon: React.ElementType; badgeClass: string; iconBg: string; hint: string }> = {
                      pending: { label: t("order_status_pending"), Icon: Clock, badgeClass: "bg-orange-50 text-orange-700", iconBg: "bg-gradient-to-br from-[#FB923C] to-[#F97316]", hint: t("order_awaiting") },
                      confirmed: { label: t("order_status_confirmed"), Icon: CheckCircle2, badgeClass: "bg-[#DBEAFE] text-[#1E40AF]", iconBg: "bg-gradient-to-br from-[#3B82F6] to-[#2563EB]", hint: t("order_accepted") },
                      preparing: { label: t("order_status_preparing"), Icon: Flame, badgeClass: "bg-orange-50 text-orange-700", iconBg: "bg-gradient-to-br from-[#FB923C] to-[#F97316]", hint: t("order_cooking") },
                      ready: { label: t("order_status_ready"), Icon: Package, badgeClass: "bg-[#D1FAE5] text-[#065F46]", iconBg: "bg-gradient-to-br from-[#059669] to-[#047857]", hint: t("order_ready_pickup") },
                      out_for_delivery: { label: t("order_status_on_the_way"), Icon: Bike, badgeClass: "bg-[#E0F2FE] text-[#0369A1]", iconBg: "bg-gradient-to-br from-[#0EA5E9] to-[#0284C7]", hint: t("order_on_the_way_hint") },
                    };
                    const etaMin = order.order_status === "out_for_delivery" && order.updated_at
                      ? Math.max(0, 15 - Math.floor((Date.now() - new Date(order.updated_at).getTime()) / 60000)) : null;
                    const etaProgress = order.order_status === "out_for_delivery" && order.updated_at
                      ? Math.max(0, Math.min(100, ((15 - (etaMin || 15)) / 15) * 100)) : 0;
                    const config = statusConfig[order.order_status] || statusConfig.pending;
                    const IconComponent = config.Icon;
                    return (
                      <motion.div key={order.id} variants={prefersReducedMotion ? undefined : staggerItem} whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }} className="overflow-hidden bg-white transition">
                        <Link to={`/live/${order.id}`} className="block">
                          <div className="flex items-center gap-3 py-3">
                            <div className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] text-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${config.iconBg}`}>
                              <IconComponent className="h-[20px] w-[20px]" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-[15px] font-black tracking-[-0.03em] text-slate-950">{order.restaurant_name}</h3>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${config.badgeClass}`}>{config.label}</span>
                              </div>
                              <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-600">{order.meal_name}</p>
                              {order.order_status === "out_for_delivery" && etaMin !== null ? (
                                <div className="mt-1.5">
                                  <div className="flex items-center gap-2">
                                    <span className="shrink-0 text-[12px] font-extrabold text-sky-600">{etaMin <= 0 ? t("arriving_now") : t("eta_min", { minutes: String(etaMin) })}</span>
                                    <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-sky-100">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${etaProgress}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1 flex items-center gap-1.5">
                                  <p className="text-[11px] font-medium text-slate-400">{config.hint}</p>
                                </div>
                              )}
                            </div>
                            <NextIcon className="h-4.5 w-4.5 shrink-0 text-slate-300" strokeWidth={2} />
                          </div>
                        </Link>
                        {(order.order_status === "pending" || order.order_status === "confirmed") && (
                          <div className="flex items-center gap-2 bg-slate-50 px-3 pb-3 pt-2">
                            <button type="button"
                              onClick={(e) => { e.preventDefault(); setSelectedSchedule(order); setShowModifyModal(true); }}
                              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[11px] font-black text-slate-600 ring-1 ring-slate-200/80">
                              <Pencil className="h-3 w-3" strokeWidth={2} />{t("reschedule_button")}
                            </button>
                            <button type="button"
                              onClick={(e) => { e.preventDefault(); handleCancelOrder(order.id); }}
                              disabled={cancellingId === order.id}
                              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-red-50 py-2 text-[11px] font-black text-red-600 ring-1 ring-red-100 disabled:opacity-50">
                              {cancellingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" strokeWidth={2} />}{t("cancel_button")}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── AI Coach ──────────────────────────────────────────── */}
            <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">AI coach</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">Today's read</h2>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                  <Apple className="h-4.5 w-4.5" strokeWidth={2.1} />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {coachInsights.map(({ label, title, detail, Icon, tone }) => (
                  <div key={label} className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/80">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ring-1 ${tone}`}>
                        <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                        <p className="mt-0.5 text-[13px] font-black leading-tight tracking-[-0.02em] text-slate-950">{title}</p>
                        <p className="mt-1 text-[11px] font-semibold leading-snug text-slate-500">{detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link to="/nutrio/ai-report" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-[12px] font-black text-white shadow-[0_8px_20px_rgba(16,185,129,0.18)] transition active:scale-[0.98]">
                Open AI report <NextIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
              </Link>
            </div>

            {/* ── App Shortcuts ─────────────────────────────────────── */}
            <div className="rounded-[24px] bg-slate-50 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">{t("quick")}</p>
                  <h2 className="mt-0.5 text-[16px] font-black tracking-[-0.03em] text-slate-950">App shortcuts</h2>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200/80">
                  <ArrowRightLeft className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {shortcutActions.map(({ icon: Icon, label, detail, circleBg, to }) => (
                  <motion.button
                    key={label}
                    type="button"
                    onClick={() => navigate(to)}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                    className="flex min-h-[72px] items-center gap-2.5 rounded-[18px] bg-white p-3 text-left shadow-[0_4px_12px_rgba(15,23,42,0.03)] ring-1 ring-slate-200/80"
                    aria-label={label}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] shadow-[0_4px_12px_rgba(15,23,42,0.06)]" style={{ backgroundColor: circleBg }}>
                      <Icon className="h-4.5 w-4.5 text-white" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-black leading-tight text-slate-950">{label}</p>
                      <p className="mt-0.5 line-clamp-2 text-[9px] font-bold leading-tight text-slate-400">{detail}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {user && <BodyCorrelationWidget />}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: NUTRITION — Calorie ring, macros, water, streak
            ══════════════════════════════════════════════════════════════ */}
        {activeTab === "nutrition" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Calorie ring + macros */}
            <div className="rounded-[24px] bg-[#F0FDF4] p-4 ring-1 ring-emerald-100">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Nutrition</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">{calRemaining} {t("cal_short")} left</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-emerald-100">
                  <Apple className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-[28px] bg-white ring-1 ring-emerald-100">
                  <svg className="relative h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
                    <circle cx="70" cy="70" r={ringRadius} fill="none" stroke={overBudget ? "#FEE2E2" : "#DCFCE7"} strokeWidth="8" />
                    <motion.circle
                      cx="70" cy="70" r={ringRadius} fill="none" stroke={ringColor}
                      strokeLinecap="round" strokeWidth="8"
                      strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                      style={{ filter: overBudget ? "drop-shadow(0 4px 8px rgba(239,68,68,0.2))" : "drop-shadow(0 4px 8px rgba(16,185,129,0.15))" }}
                      variants={progressRingVariants} initial="hidden" animate="visible"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[18px] font-extrabold leading-none tracking-[-0.04em]" style={{ color: ringColor }}>{calRemaining}</span>
                    <span className="mt-0.5 text-[8px] font-bold uppercase leading-none" style={{ color: ringColor }}>{t("dashboard_remaining")}</span>
                    <span className="mt-0.5 text-[8px] font-medium text-slate-400">{Math.round(consumedPct)}%</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  {macroCards.map(({ label, value, target, Icon, iconClass, dotClass }) => {
                    const percent = Math.round((value / (target || 1)) * 100);
                    return (
                      <div key={label} className="rounded-[14px] bg-white px-3 py-2 ring-1 ring-slate-200/80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${iconClass}`}>
                              <Icon className="h-3 w-3" strokeWidth={2.25} />
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">{label}</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-800">{value}<span className="text-slate-400 font-medium">/{target}g</span></span>
                        </div>
                        <div className="mt-1.5 h-[4px] w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${dotClass}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="mt-1 flex gap-1.5">
                    <div className="flex flex-1 items-center gap-1.5 rounded-[14px] bg-white px-3 py-2 ring-1 ring-emerald-100">
                      <Utensils className="h-3 w-3 text-emerald-600 shrink-0" strokeWidth={2} />
                      <div>
                        <p className="text-[8px] font-semibold uppercase text-emerald-600 leading-none">{t("consumed")}</p>
                        <p className="text-[12px] font-extrabold leading-tight tracking-[-0.03em] text-slate-900">{animatedCalories}</p>
                      </div>
                    </div>
                    <div className="flex flex-1 items-center gap-1.5 rounded-[14px] bg-white px-3 py-2 ring-1 ring-orange-100">
                      <Flame className="h-3 w-3 text-orange-500 shrink-0" strokeWidth={2} />
                      <div>
                        <p className="text-[8px] font-semibold uppercase text-orange-500 leading-none">{t("burned")}</p>
                        <p className="text-[12px] font-extrabold leading-tight tracking-[-0.03em] text-slate-900">{animatedBurned}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <motion.button
                data-testid="log-meal-button"
                type="button"
                onClick={() => setLogMealOpen(true)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-[20px] bg-emerald-600 px-4 py-3 text-white shadow-[0_8px_20px_rgba(16,185,129,0.18)]"
              >
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Utensils className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-black leading-tight text-white">{t("log_meal")}</p>
                  <p className="text-[10px] font-semibold text-white/75">{t("dashboard_tap_to_add")}</p>
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
              </motion.button>
            </div>

            {/* Tracker: streak + water + steps */}
            <div className="rounded-[24px] bg-white px-4 pb-4 pt-3 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Tracker</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-500" strokeWidth={2} />
                    <span className="text-[16px] font-black tracking-[-0.03em] text-slate-950">{dateLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button type="button" onClick={goToPrevDay}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200/80"
                    aria-label={t("previous_day")}>
                    <PrevIcon className="h-3.5 w-3.5" />
                  </motion.button>
                  <motion.button type="button" onClick={goToNextDay}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }} disabled={isToday}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200/80 disabled:opacity-50"
                    aria-label={t("next_day")}>
                    <NextIcon className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
              </div>

              <div className="mt-3 flex min-h-[52px] items-center rounded-[18px] bg-emerald-50 px-3 ring-1 ring-emerald-100">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="whitespace-nowrap text-[11px] font-bold text-emerald-700">{t("daily_streak")}</span>
                </div>
                <div className="mx-3 flex flex-1 items-center justify-between gap-1">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const isComplete = index < completedThisWeek;
                    const isTodayIdx = index === completedThisWeek;
                    return (
                      <div key={index}
                        className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                          isComplete ? "bg-emerald-500" : isTodayIdx ? "bg-emerald-200 ring-2 ring-emerald-300" : "bg-slate-200"
                        }`}
                      />
                    );
                  })}
                </div>
                <span className="text-[12px] font-extrabold tabular-nums text-slate-900">{completedThisWeek}/7</span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <motion.div
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  className="cursor-pointer rounded-[20px] bg-blue-50 p-3 ring-1 ring-blue-100"
                  onClick={() => navigate("/water-tracker")}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Droplets className="h-4 w-4 text-[#3B82F6]" strokeWidth={2} />
                    <p className="text-[10px] font-semibold text-slate-400">{t("water")}</p>
                  </div>
                  <p className="text-[20px] font-extrabold leading-none tracking-[-0.03em] text-slate-800">
                    {Math.round(waterToday / 240 * 10) / 10}<span className="ml-1 text-[12px] font-semibold text-slate-400">{t("cups")}</span>
                  </p>
                  <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((waterToday / waterGoal) * 100, 100)}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="h-full rounded-full bg-[#3B82F6]" />
                  </div>
                </motion.div>
                <motion.div
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  className="cursor-pointer rounded-[20px] bg-orange-50 p-3 ring-1 ring-orange-100"
                  onClick={() => navigate("/step-counter")}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Footprints className="h-4 w-4 text-orange-500" strokeWidth={2} />
                    <p className="text-[10px] font-semibold text-slate-400">{t("steps")}</p>
                  </div>
                  <p className="text-[20px] font-extrabold leading-none tracking-[-0.03em] text-slate-800">
                    {stepsToday.toLocaleString()}<span className="ml-1 text-[12px] font-semibold text-slate-400">{t("steps")}</span>
                  </p>
                  <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full bg-[#FEE2E2]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((stepsToday / stepsGoal) * 100, 100)}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="h-full rounded-full bg-[#F97316]" />
                  </div>
                </motion.div>
              </div>

              {(() => {
                const badges: Array<{ emoji: string; label: string; color: string }> = [];
                if (dailyStreak >= 7) badges.push({ emoji: "🔥", label: `${dailyStreak}-day streak!`, color: "from-[#FBBF24] to-[#F97316]" });
                else if (dailyStreak >= 5) badges.push({ emoji: "⚡", label: `${dailyStreak}-day streak`, color: "from-[#FCD34D] to-[#F59E0B]" });
                if (weeklySummary && weeklySummary.consistency.percentage >= 85) badges.push({ emoji: "🎯", label: `${weeklySummary.consistency.percentage}% consistent this week`, color: "from-[#34D399] to-[#059669]" });
                if (streaks?.logging?.bestStreak && streaks.logging.bestStreak >= 14) badges.push({ emoji: "🏆", label: `Best streak: ${streaks.logging.bestStreak} days`, color: "from-[#818CF8] to-[#4338CA]" });
                if (badges.length === 0) return null;
                return (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {badges.map((badge, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 260, damping: 18 }}
                        className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${badge.color} px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)]`}>
                        <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }} className="text-xs">{badge.emoji}</motion.span>
                        <span className="text-[11px] font-extrabold text-white">{badge.label}</span>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Macro gap suggestion */}
            {(() => {
              const protRemaining = Math.max(0, proteinTarget - todayProgress.protein);
              const carbsRemaining = Math.max(0, carbsTarget - todayProgress.carbs);
              const fatRemaining = Math.max(0, fatTarget - todayProgress.fat);
              const protPct = proteinTarget > 0 ? protRemaining / proteinTarget : 0;
              const carbsPct = carbsTarget > 0 ? carbsRemaining / carbsTarget : 0;
              const fatPct = fatTarget > 0 ? fatRemaining / fatTarget : 0;
              const gaps = [
                { label: "protein", pct: protPct, remaining: protRemaining, unit: "g", color: "text-orange-600", bg: "bg-orange-50", icon: Drumstick, ring: "ring-[#FDBA74]" },
                { label: "carbs", pct: carbsPct, remaining: carbsRemaining, unit: "g", color: "text-emerald-600", bg: "bg-emerald-50", icon: Wheat, ring: "ring-emerald-200" },
                { label: "fat", pct: fatPct, remaining: fatRemaining, unit: "g", color: "text-indigo-700", bg: "bg-indigo-50", icon: FatIcon, ring: "ring-indigo-200" },
              ].filter(g => g.remaining > 0 && g.pct >= 0.2);
              if (gaps.length === 0 || !isUnlimited) return null;
              gaps.sort((a, b) => b.pct - a.pct);
              const top = gaps[0];
              let suggestion = "";
              let suggestionIcon = top.icon;
              if (top.label === "protein" && calRemaining >= 300) suggestion = `You have ${top.remaining}g protein and ${calRemaining} cal remaining — a Protein Power Bowl would fit your macros perfectly.`;
              else if (top.label === "carbs" && calRemaining >= 300) suggestion = `With ${top.remaining}g carbs left and ${calRemaining} cal, a balanced Grain Bowl would round out your day.`;
              else if (top.label === "fat" && calRemaining >= 300) suggestion = `You have ${top.remaining}g fat to fill — try a Mediterranean meal to satisfy your targets.`;
              else if (calRemaining < 300 && calRemaining > 0) { suggestion = `Only ${calRemaining} cal left today — a light salad or wrap would be perfect.`; suggestionIcon = Soup; }
              else return null;
              return (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 26 }}>
                  <Link to="/meals" className={`block rounded-[20px] p-3 ring-1 transition-all active:scale-[0.99] ${top.bg} ${top.ring}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
                        <suggestionIcon className={`h-4 w-4 ${top.color}`} strokeWidth={2} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-800">{t("dashboard_what_to_eat")}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{suggestion}</p>
                      </div>
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-[0_2px_4px_rgba(0,0,0,0.05)]">
                        <NextIcon className="h-3 w-3" strokeWidth={2} />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })()}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: ACTIVITY — Burned, sessions, log activity
            ══════════════════════════════════════════════════════════════ */}
        {activeTab === "activity" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Activity</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">{t("activity_details")}</h2>
                </div>
                <Activity className="h-5 w-5 text-emerald-600" strokeWidth={2.1} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div className="flex min-h-[60px] items-center gap-2.5 rounded-[18px] bg-orange-50 px-3 ring-1 ring-orange-100">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FB923C] to-[#F97316] text-white shadow-[0_4px_10px_rgba(249,115,22,0.18)]">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium leading-tight text-slate-500">{t("total_burned_label")}</p>
                    <p className="text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-slate-950">{totalBurned} {t("cal_short")}</p>
                  </div>
                </div>
                <div className="flex min-h-[60px] items-center gap-2.5 rounded-[18px] bg-emerald-50 px-3 ring-1 ring-emerald-100">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#19C878] to-[#059669] text-white shadow-[0_4px_10px_rgba(16,185,129,0.15)]">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium leading-tight text-slate-500">{t("sessions")}</p>
                    <p className="text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-slate-950">{workoutCount}</p>
                  </div>
                </div>
              </div>
              <motion.button
                type="button"
                data-testid="log-activity-button"
                onClick={() => setSheetOpen(true)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                className="mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[20px] bg-emerald-600 text-white shadow-[0_8px_20px_rgba(16,185,129,0.2)]">
                <Plus className="h-5 w-5" strokeWidth={2} />{t("log_activity")}
              </motion.button>
            </div>

            {user && <BodyCorrelationWidget />}
            {user && <StepTrackerCard />}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: PROGRESS — Weight, consistency, level, streak, badges
            ══════════════════════════════════════════════════════════════ */}
        {activeTab === "progress" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* Goal momentum grid */}
            <div className="rounded-[24px] bg-slate-50 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600">Progress</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">Goal momentum</h2>
                </div>
                <button type="button" onClick={() => navigate("/progress")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-700 ring-1 ring-emerald-100"
                  aria-label={t("progress_label")}>
                  <TrendingUp className="h-4.5 w-4.5" strokeWidth={2.2} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => navigate("/progress")} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Weight</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-slate-950">{latestWeight ? latestWeight.toFixed(1) : "--"}<span className="ml-1 text-[11px] font-bold text-slate-400">kg</span></p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Latest body log</p>
                </button>
                <button type="button" onClick={() => navigate("/progress")} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Consistency</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-emerald-700">{weeklyLoading ? "--" : `${weeklyConsistency}%`}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">This week</p>
                </button>
                <button type="button" onClick={() => setShowAchievements(!showAchievements)} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Level</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-indigo-800">{gamification.level}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{gamification.earnedBadges}/{gamification.totalBadges} badges</p>
                </button>
                <button type="button" onClick={() => navigate("/tracker")} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Streak</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-orange-600">{dailyStreak}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">Logging days</p>
                </button>
              </div>
            </div>

            {/* Weight trend sparkline */}
            {(() => {
              const weights = (weightHistory || [])
                .filter(m => m.weight_kg != null)
                .map(m => ({ date: m.log_date, kg: m.weight_kg! }))
                .sort((a, b) => a.date.localeCompare(b.date))
                .slice(-7);
              if (weights.length < 2) return null;
              const first = weights[0].kg;
              const last = weights[weights.length - 1].kg;
              const delta = last - first;
              const deltaAbs = Math.abs(delta).toFixed(1);
              const trend = delta < 0 ? "↓" : delta > 0 ? "↑" : "→";
              const trendColor = delta < 0 ? "text-emerald-600" : delta > 0 ? "text-red-500" : "text-slate-400";
              const trendHex = delta < 0 ? "#059669" : delta > 0 ? "#EF4444" : "#94A3B8";
              const width = 160;
              const height = 28;
              const pad = 2;
              const vals = weights.map(w => w.kg);
              const vMin = Math.min(...vals);
              const vMax = Math.max(...vals);
              const range = vMax - vMin || 1;
              const toX = (i: number) => pad + (i / Math.max(weights.length - 1, 1)) * (width - pad * 2);
              const toY = (v: number) => height - pad - ((v - vMin) / range) * (height - pad * 2);
              const pointsLine = weights.map((w, i) => `${toX(i)},${toY(w.kg)}`).join(" ");
              const areaPath = `${toX(0)},${height} ${pointsLine} ${toX(weights.length - 1)},${height}`;
              return (
                <div className="flex items-center gap-3 rounded-[20px] bg-white px-4 py-3 ring-1 ring-slate-200/80">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[18px]">{trend}</span>
                    <div>
                      <span className={`text-[13px] font-extrabold tracking-[-0.03em] ${trendColor}`}>{deltaAbs} kg</span>
                      <p className="text-[10px] font-medium text-slate-400">{t("day_trend")}</p>
                    </div>
                  </div>
                  <div className="flex-1" />
                  <svg viewBox={`0 0 ${width} ${height}`} className="h-7 shrink-0" style={{ width }}>
                    <polygon points={areaPath} fill={trendHex} fillOpacity={0.1} />
                    <polyline points={pointsLine} fill="none" stroke={trendHex} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={toX(weights.length - 1)} cy={toY(last)} r={3} fill={trendHex} />
                  </svg>
                </div>
              );
            })()}

            {/* Achievement strip */}
            <motion.div initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }} animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }} transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 26 }}>
              <motion.div className="cursor-pointer" onClick={() => setShowAchievements(!showAchievements)} whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}>
                <div className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(99,102,241,0.06)] ring-1 ring-indigo-100">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#3730A3] shadow-[0_4px_12px_rgba(99,102,241,0.2)]">
                    <Trophy className="h-5 w-5 text-white" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold tracking-[-0.01em] text-slate-950">{t("level_format", { level: String(gamification.level) })}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-indigo-600 truncate">
                      {gamification.earnedBadges > 0 ? t("badges_earned", { earned: String(gamification.earnedBadges), total: String(gamification.totalBadges) }) : t("start_earning_badges")}
                    </p>
                    <div className="mt-1.5 h-[4px] w-full overflow-hidden rounded-full bg-indigo-200">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(((gamification.xp % 100) / 100) * 100, 100)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-[#4F46E5] to-[#4338CA]" />
                    </div>
                  </div>
                  <div className="flex shrink-0 -space-x-2">
                    {Array.from(gamification.earnedIds).slice(0, 3).reverse().map((badgeId: string) => {
                      const badge = gamification.badges.find((b) => b.id === badgeId);
                      const rarityGradient: Record<string, string> = { common: "from-gray-400 to-gray-500", rare: "from-blue-400 to-blue-600", epic: "from-[#818CF8] to-[#3730A3]", legendary: "from-[#FBBF24] to-[#D97706]" };
                      const grad = rarityGradient[badge?.rarity || "common"] || rarityGradient.common;
                      return (
                        <div key={badgeId} className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${grad} shadow-[0_2px_6px_rgba(99,102,241,0.15)] ring-2 ring-white`}>
                          <Medal className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                        </div>
                      );
                    })}
                    {gamification.earnedBadges === 0 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-white">
                        <Trophy className="h-3.5 w-3.5 text-indigo-400" strokeWidth={1.75} />
                      </div>
                    )}
                  </div>
                  <NextIcon className={`h-4 w-4 text-[#B8A9E8] transition-transform ${showAchievements ? "rotate-90" : ""}`} strokeWidth={2} />
                </div>
              </motion.div>

              <AnimatePresence>
                {showAchievements && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 280, damping: 28 }}
                    className="overflow-hidden">
                    <div className="mx-1 mt-2 rounded-[22px] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] ring-1 ring-indigo-100">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400 mb-3">Your Achievements</p>
                      {gamification.earnedBadges > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-2">
                            {gamification.badges.filter((b) => gamification.earnedIds.has(b.id)).map((badge) => {
                              const cfg = rarityConfig[badge.rarity] || rarityConfig.common;
                              return (
                                <div key={badge.id} className={`flex items-center gap-2 rounded-xl border p-2 ${cfg.bg} ${cfg.border}`} title={badge.description}>
                                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${cfg.gradient} shadow-sm`}>
                                    <Medal className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                                  </div>
                                  <div className="pr-1">
                                    <p className="text-[10px] font-bold text-slate-800 leading-none">{badge.name}</p>
                                    <p className="text-[9px] text-slate-500 mt-0.5">+{badge.xp_reward} XP</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {gamification.earnedBadges < gamification.totalBadges && (
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 mb-2">{t("dashboard_next_unlock")}</p>
                          <div className="space-y-1.5">
                            {gamification.badges.filter((b) => !gamification.earnedIds.has(b.id)).slice(0, 3).map((badge) => {
                              const cfg = rarityConfig[badge.rarity] || rarityConfig.common;
                              return (
                                <div key={badge.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200">
                                    <Lock className="h-3 w-3 text-slate-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-slate-700 truncate">{badge.name}</p>
                                    <p className="text-[10px] text-slate-400">+{badge.xp_reward} XP</p>
                                  </div>
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium capitalize ${cfg.bg} ${cfg.border}`}>{badge.rarity}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {user && <BodyCorrelationWidget />}
          </motion.div>
        )}

        {/* ── Top Restaurants Error ────────────────────────────────── */}
        {(topRestaurantsError && !topRestaurantsLoading && topRestaurants.length === 0) && (
          <div className="mt-3 rounded-[20px] ring-1 ring-amber-200 bg-amber-50 p-3 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-800">{t("dashboard_featured_error")}</p>
                <p className="text-[10px] text-slate-500">{t("dashboard_tap_to_try_again")}</p>
              </div>
              <button type="button"
                onClick={() => { setTopRestaurantsError(false); setTopRestaurantsLoading(true); fetchTopRestaurants(); }}
                className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-200">
                <RefreshCw className="h-3 w-3" strokeWidth={2} />{t("retry_button")}
              </button>
            </div>
          </div>
        )}
      </main>


      {/* ── Modals ──────────────────────────────────────────────────── */}
      {user && (
        <LogMealModal
          open={logMealOpen}
          onOpenChange={setLogMealOpen}
          onMealLogged={() => setProgressKey((key) => key + 1)}
        />
      )}
      <LogActivitySheet open={sheetOpen} onOpenChange={setSheetOpen} onBurnedUpdate={setTotalBurned} />
      {selectedSchedule && (
        <ModifyOrderModal
          isOpen={showModifyModal}
          onClose={() => { setShowModifyModal(false); setSelectedSchedule(null); }}
          schedule={selectedSchedule}
          onModified={() => { fetchActiveOrders(); setShowModifyModal(false); setSelectedSchedule(null); }}
        />
      )}
    </motion.div>
  );
};

export default Dashboard;
