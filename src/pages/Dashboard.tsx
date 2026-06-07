import { forwardRef, useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertCircle,
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
  Wheat,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Custom hand-drawn SVG icons for the Quick Actions cards.
   Each icon is a forwardRef component (matching Lucide's contract) so
   it can be passed to QuickActionCard the same way Lucide icons were.
   ═══════════════════════════════════════════════════════════════════ */

const TrackerIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="12" cy="12" r="9" strokeOpacity="0.45" />
      {/* Middle ring */}
      <circle cx="12" cy="12" r="5.5" strokeOpacity="0.75" />
      {/* Bullseye dot */}
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
      {/* Arrow shaft */}
      <path d="M20 4L13 11" />
      {/* Arrow head pointing into bullseye */}
      <path d="M13 11L15 9.5M13 11L11 13" />
      {/* Fletching */}
      <path d="M20 4L21.6 4.4M20 4L20.4 5.6M20 4L19 5.4" strokeWidth={1.6} />
    </svg>
  )
);
TrackerIcon.displayName = "TrackerIcon";

const FavoriteIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Heart shape */}
      <path
        d="M12 20.5s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 3c0 5.8-7.5 10.2-7.5 10.2Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      {/* Star inside the heart */}
      <path
        d="M12 10.4L13 12.2L14.9 12.5L13.5 13.7L13.9 15.6L12 14.6L10.1 15.6L10.5 13.7L9.1 12.5L11 12.2L12 10.4Z"
        fill="currentColor"
        stroke="none"
      />
      {/* Tiny sparkle */}
      <path d="M18 7L18.5 8.2L19.7 8.7L18.5 9.2L18 10.4L17.5 9.2L16.3 8.7L17.5 8.2L18 7Z" fill="currentColor" stroke="none" />
    </svg>
  )
);
FavoriteIcon.displayName = "FavoriteIcon";

const ProgressIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Baseline */}
      <path d="M3 20.5H21" strokeOpacity="0.4" />
      {/* Three bars — ascending */}
      <rect x="5" y="14" width="3.5" height="6" rx="0.8" fill="currentColor" fillOpacity="0.3" />
      <rect x="10.25" y="10" width="3.5" height="10" rx="0.8" fill="currentColor" fillOpacity="0.55" />
      <rect x="15.5" y="6" width="3.5" height="14" rx="0.8" fill="currentColor" fillOpacity="0.85" />
      {/* Trend arrow over the bars */}
      <path d="M5 9L10 7L15 4L19 3" strokeWidth={1.8} />
      <path d="M19 3L17 3.2M19 3L18.8 5" strokeWidth={1.8} />
    </svg>
  )
);
ProgressIcon.displayName = "ProgressIcon";

const CommunityIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Center person (front) */}
      <circle cx="12" cy="9" r="3" fill="currentColor" fillOpacity="0.25" />
      <path d="M6.5 19.5C6.5 16.5 9 14.5 12 14.5C15 14.5 17.5 16.5 17.5 19.5" />
      {/* Left person (back) */}
      <circle cx="5.5" cy="10.5" r="2.4" strokeOpacity="0.6" />
      <path d="M2 19.5C2 17.2 3.6 15.7 5.5 15.5" strokeOpacity="0.6" />
      {/* Right person (back) */}
      <circle cx="18.5" cy="10.5" r="2.4" strokeOpacity="0.6" />
      <path d="M22 19.5C22 17.2 20.4 15.7 18.5 15.5" strokeOpacity="0.6" />
    </svg>
  )
);
CommunityIcon.displayName = "CommunityIcon";

/* Fat icon — avocado silhouette with pit, the universal "healthy fat"
   metaphor used across nutrition apps. More semantically correct than
   a water droplet. */
const FatIcon = forwardRef<SVGSVGElement, { className?: string }>(
  ({ className }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Avocado body — pear shape */}
      <path
        d="M12 3.5C8.4 3.5 5.5 6.4 5.5 10.2C5.5 14.5 8 19.5 12 20.5C16 19.5 18.5 14.5 18.5 10.2C18.5 6.4 15.6 3.5 12 3.5Z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      {/* Stem dimple at top */}
      <path d="M11.2 3.7C11.2 2.8 11.6 2.3 12 2.3C12.4 2.3 12.8 2.8 12.8 3.7" strokeWidth={1.5} />
      {/* Pit */}
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

interface TodayMeal {
  meal_id: string;
  meal_name: string;
  restaurant_name: string;
  restaurant_id: string;
  delivery_type: string;
  order_status: string;
  scheduled_date: string;
  meal_count: number;
}

interface TopRestaurant {
  restaurant_id: string;
  restaurant_name: string;
  restaurant_image: string;
  meal_count: number;
}

interface MonthlyStats {
  total: number;
  completed: number;
  cancelled: number;
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

const Dashboard = () => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { activeGoal } = useNutritionGoals(user?.id);
  const { subscription, remainingMeals, totalMeals, isUnlimited } = useSubscription();
  const { rolloverCredits } = useDashboardRolloverCredits(user?.id);
  const { t, language } = useLanguage();
  const { unreadCount } = useNotifications(user?.id);
  const { summary: weeklySummary, loading: weeklyLoading } = useWeeklySummary(user?.id);
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
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({ total: 0, completed: 0, cancelled: 0 });
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

  // ─── Fetch gamification data ───────────────────────────────────
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
          xp: userXp,
          level: userLevel,
          xpToNextLevel: 100,
          earnedBadges: earnedIds.size,
          totalBadges: (allBadges || []).length,
          badges: (allBadges || []),
          earnedIds,
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
          .select(`
            id,
            scheduled_date,
            order_status,
            meal_id,
            meal_type,
            delivery_type,
            delivery_time_slot,
            updated_at,
            meals:meal_id (
              id, name, restaurant_id,
              restaurants:restaurant_id (
                id, name
              )
            )
          `)
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
      if (!countError) {
        setTotalActiveOrders(totalCount ?? 0);
      }
      if (!schedules || schedules.length === 0) {
        setActiveOrders([]);
        setOrdersLoading(false);
        return;
      }

      const orders: ActiveOrder[] = schedules
        .filter((schedule: any) => schedule.meals !== null)
        .map((schedule: any) => ({
          id: schedule.id,
          order_status: schedule.order_status,
          scheduled_date: schedule.scheduled_date,
          meal_id: schedule.meal_id,
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
      setActiveOrders([]);
      setOrdersError(true);
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActiveOrders();
  }, [fetchActiveOrders]);

  const fetchMonthlyStats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data, error } = await supabase
        .from("meal_schedules")
        .select("order_status")
        .eq("user_id", user.id)
        .gte("scheduled_date", startOfMonth.split("T")[0])
        .lte("scheduled_date", now.toISOString().split("T")[0]);

      if (error) throw error;
      const stats = { total: data?.length || 0, completed: 0, cancelled: 0 };
      (data || []).forEach((s: { order_status: string }) => {
        if (s.order_status === "delivered" || s.order_status === "completed") stats.completed++;
        else if (s.order_status === "cancelled") stats.cancelled++;
      });
      setMonthlyStats(stats);
    } catch { /* silent */ }
  }, [user?.id]);

  useEffect(() => {
    fetchMonthlyStats();
  }, [fetchMonthlyStats]);

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
        .select(`
          restaurant_id,
          restaurants:restaurant_id (
            id, name, logo_url, rating, total_orders, description, cuisine_types
          )
        `)
        .eq("status", "active")
        .lte("starts_at", now)
        .gte("ends_at", now)
        .order("price_paid", { ascending: false })
        .limit(5);

      if (featuredError) throw featuredError;

      const restaurants = (featured || [])
        .map((f: { restaurants: TopRestaurant[] }) => f.restaurants)
        .filter(Boolean);
      setTopRestaurants(restaurants);
    } catch (err) {
      console.error("Error fetching featured restaurants:", err);
      setTopRestaurants([]);
      setTopRestaurantsError(true);
    } finally {
      setTopRestaurantsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopRestaurants();
  }, [fetchTopRestaurants]);

  const fetchTodayMeals = useCallback(async () => {
    if (!user?.id) return;
    try {
      const today = getQatarDay();
      const { data: schedules, error } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          meal_type,
          meal_id,
          scheduled_date,
          delivery_time_slot,
          meals:meal_id (
            id, name, image_url, calories, protein_g, carbs_g, fat_g
          ),
          restaurants:restaurant_id (
            id, name
          )
        `)
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .order("meal_type")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by meal_type, deduplicate by meal_id
      const slots: Record<string, any[]> = {
        breakfast: [],
        lunch: [],
        dinner: [],
      };

      (schedules || []).forEach((s: any) => {
        const type = s.meal_type || "other";
        const group = ["breakfast", "lunch", "dinner"].includes(type) ? type : "other";
        if (group === "other") return;
        // Only keep first occurrence per meal_type (most recent first since sorted desc)
        if (slots[group].length === 0) {
          slots[group].push({
            schedule_id: s.id,
            meal_type: group,
            meal: s.meals || null,
            restaurant: s.restaurants || null,
            delivery_time_slot: s.delivery_time_slot || null,
          });
        }
      });

      setTodayMeals(Object.entries(slots).map(([type, items]) => ({
        type,
        ...(items[0] || {}),
      })));
    } catch (err) {
      console.error("Error fetching today's meals:", err);
      setTodayMealsError(true);
    } finally {
      setTodayMealsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTodayMeals();
  }, [fetchTodayMeals]);

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

      if (error) {
        console.error("Failed to load workout summary", error);
        return;
      }

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
        .select("id, type, title, message, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentNotifications(data || []);
    } catch (err) {
      console.error("Error fetching recent notifications:", err);
    } finally {
      setNotifsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (showNotificationsDropdown) {
      fetchRecentNotifications();
    }
  }, [showNotificationsDropdown, fetchRecentNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    };
    if (showNotificationsDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotificationsDropdown]);

  if (profileLoading) {
    return (
      <div className="overflow-x-hidden text-slate-900 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, #FEFFFE 0%, #F8FDF9 50%, #F5FAF7 100%)" }} />
        <main className="relative mx-auto max-w-[430px] px-4 sm:px-6 pb-4 pt-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-[44px] w-[44px] rounded-full bg-emerald-100/60 animate-pulse" />
              <div className="space-y-1.5">
                <div className="h-2.5 w-24 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-3 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
            </div>
            <div className="h-[27px] w-[27px] rounded-full bg-emerald-100/60 animate-pulse" />
          </div>

          {/* Balance card skeleton */}
          <div className="mt-5 rounded-[24px] bg-white px-[14px] py-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-[96px] w-[96px] rounded-full bg-emerald-100/60 animate-pulse" />
              <div className="mx-3 h-[80px] w-px bg-slate-100" />
              <div className="flex-1 space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="h-[26px] w-[26px] rounded-full bg-emerald-100/60 animate-pulse" />
                    <div className="flex-1 h-2.5 rounded-full bg-emerald-100/60 animate-pulse" />
                    <div className="h-2.5 w-12 rounded-full bg-emerald-100/60 animate-pulse" />
                  </div>
                ))}
                <div className="h-px bg-slate-100" />
                <div className="flex items-center gap-2.5">
                  <div className="h-[26px] w-[26px] rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="flex-1 h-2.5 rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="h-2.5 w-8 rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
              </div>
              <div className="mx-3 h-[80px] w-px bg-slate-100" />
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="h-[34px] w-[34px] rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-2 w-14 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-3 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Today's Meals skeleton */}
          <div className="mt-5 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3 w-28 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-2 w-36 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
              <div className="h-[30px] w-[84px] rounded-full bg-emerald-100/60 animate-pulse" />
            </div>
            <div className="mt-3 space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 h-[54px]">
                  <div className="h-8 w-8 rounded-xl bg-emerald-100/60 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-2.5 w-20 rounded-full bg-emerald-100/60 animate-pulse" />
                  </div>
                  <div className="h-3 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Calorie tracking skeleton */}
          <div className="mt-4 rounded-[24px] bg-white px-4 pb-5 pt-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-3 w-28 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
              <div className="flex gap-2.5">
                <div className="h-[34px] w-[34px] rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-[34px] w-[34px] rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
            </div>
            <div className="mt-4 flex h-[32px] items-center rounded-full border-slate-100 bg-slate-50 px-3">
              <div className="h-2.5 w-20 rounded-full bg-emerald-100/60 animate-pulse" />
              <div className="mx-3 flex flex-1 gap-2">
                {[1,2,3,4,5,6].map(i => <div key={i} className="h-[4px] flex-1 rounded-full bg-emerald-100/60 animate-pulse" />)}
              </div>
              <div className="h-2.5 w-8 rounded-full bg-emerald-100/60 animate-pulse" />
            </div>
            <div className="mt-3 rounded-[20px] border border-slate-100 bg-white px-4 py-3">
              <div className="flex items-stretch justify-between gap-2 min-h-[100px]">
                <div className="flex flex-1 items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-20 rounded-full bg-emerald-100/60 animate-pulse" />
                    <div className="h-6 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
                    <div className="h-3 w-8 rounded-full bg-emerald-100/60 animate-pulse" />
                  </div>
                </div>
                <div className="h-[120px] w-[120px] rounded-full shrink-0 bg-emerald-100/60 animate-pulse" />
                <div className="flex flex-1 items-center gap-3 justify-end">
                  <div className="flex flex-col gap-1">
                    <div className="h-3 w-20 rounded-full bg-emerald-100/60 animate-pulse" />
                    <div className="h-6 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
                    <div className="h-3 w-8 rounded-full bg-emerald-100/60 animate-pulse" />
                  </div>
                  <div className="h-11 w-11 rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl bg-slate-50/60 p-2.5 h-[72px] border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-emerald-100/60 animate-pulse" />
                    <div className="h-2.5 w-12 rounded-full bg-emerald-100/60 animate-pulse" />
                  </div>
                  <div className="mt-2 h-4 w-full rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Activity section skeleton */}
          <div className="mt-5 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-5 rounded-full bg-emerald-100/60 animate-pulse" />
              <div className="h-3 w-28 rounded-full bg-emerald-100/60 animate-pulse" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-3 h-[60px] flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="space-y-1">
                  <div className="h-2 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="h-3 w-10 rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 h-[60px] flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="space-y-1">
                  <div className="h-2 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="h-3 w-10 rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Order meal button skeleton */}
          <div className="mt-5">
            <div className="h-[56px] w-full rounded-2xl bg-emerald-100/60 animate-pulse" />
          </div>

          {/* Active orders skeleton */}
          <div className="mt-5 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-3 w-24 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
              <div className="h-2.5 w-12 rounded-full bg-emerald-100/60 animate-pulse" />
            </div>
            {[1, 2].map(i => (
              <div key={i} className="mb-2 rounded-2xl border-slate-100 bg-slate-50 p-3 h-[56px] flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 w-32 rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="h-2 w-48 rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
                <div className="h-2.5 w-12 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Top restaurants skeleton */}
          <div className="mt-5 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-emerald-100/60 animate-pulse" />
                <div className="h-3 w-32 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
              <div className="h-2.5 w-14 rounded-full bg-emerald-100/60 animate-pulse" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-2xl bg-slate-50 p-3 h-[100px] flex flex-col items-center gap-2">
                  <div className="h-[40px] w-[40px] rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="h-2 w-16 rounded-full bg-emerald-100/60 animate-pulse" />
                  <div className="h-1.5 w-10 rounded-full bg-emerald-100/60 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar skeleton */}
          <div className="mt-6 h-16 rounded-t-[28px] bg-white shadow-[0_-8px_24px_rgba(15,23,42,0.04)] flex items-center justify-around px-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-6 w-6 rounded-lg bg-emerald-100/60 animate-pulse" />
                <div className="h-1.5 w-10 rounded-full bg-emerald-100/60 animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="flex flex-col items-center justify-center bg-[#F8FFFB] gap-4 px-6 py-9">
        <div className="w-full max-w-[360px] text-center space-y-4 rounded-[28px] bg-white p-7 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
          <p className="text-sm text-slate-500">We couldn&#39;t load your profile. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#10B981] px-7 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.3)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const effectiveMealsLeft = isUnlimited ? Infinity : remainingMeals + (rolloverCredits || 0);
  const balanceDisplay = isUnlimited ? "∞" : Number.isFinite(effectiveMealsLeft) ? Number(effectiveMealsLeft) : "…";
  const totalMealsDisplay = isUnlimited ? "∞" : Number.isFinite(totalMeals) ? Number(totalMeals) : "…";
  const rawUserName = profile?.full_name?.trim() 
    ? (profile.full_name.includes(" ") ? profile.full_name.split(" ")[0] : profile.full_name)
    : t("guest_greeting") || "Guest";
  const userName = rawUserName.charAt(0).toUpperCase() + rawUserName.slice(1).toLowerCase();
  const qatarNow = getQatarNow();
  const hourNow = qatarNow.getHours();
  const timeGreeting = hourNow < 12 ? "Good morning ☀️" : hourNow < 18 ? "Good afternoon ☀️" : "Good evening 🌙";
  const dateLabel = formatLocaleDate(selectedDate, language, { weekday: "short", month: "short", day: "numeric" });
  const dailyCalories = profile?.daily_calorie_target || 2066;
  const calConsumed = Math.round(todayProgress.calories);
  const calBurned = totalBurned;
  const netCalories = Math.max(0, calConsumed - calBurned);
  const calRemaining = Math.max(0, dailyCalories - netCalories);
  const consumedPct = Math.min((netCalories / (dailyCalories || 1)) * 100, 100);
  const overBudget = netCalories > dailyCalories;
  const ringColor = overBudget ? "#EF4444" : "#10B981";
  const ringRadius = 62;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (Math.min(consumedPct, 100) / 100) * ringCirc;
  const balanceRadius = 40;
  const balanceCirc = 2 * Math.PI * balanceRadius;
  const balancePct = isUnlimited ? 100 : Math.min((Number(balanceDisplay) / (Number(totalMealsDisplay) || 1)) * 100, 100);
  const balanceOffset = balanceCirc - (balancePct / 100) * balanceCirc;
  const completedThisWeek = dailyStreak;

  const rarityConfig: Record<string, { bg: string; border: string; gradient: string }> = {
    common: { bg: "bg-gray-50", border: "border-gray-200", gradient: "from-gray-400 to-gray-500" },
    rare: { bg: "bg-blue-50", border: "border-blue-200", gradient: "from-blue-400 to-blue-600" },
    epic: { bg: "bg-purple-50", border: "border-purple-200", gradient: "from-purple-400 to-purple-600" },
    legendary: { bg: "bg-amber-50", border: "border-amber-200", gradient: "from-amber-400 to-amber-600" },
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
    {
      label: "Carbs",
      value: Math.round(todayProgress.carbs),
      target: carbsTarget,
      Icon: Wheat,
      iconClass: "from-[#BDF6C6] to-[#79DB88] text-[#13A853]",
      dotClass: "bg-[#19B965]",
      pillClass: "bg-[#DDF8E7] text-[#11A85A]",
    },
    {
      label: "Protein",
      value: Math.round(todayProgress.protein),
      target: proteinTarget,
      Icon: Drumstick,
      iconClass: "from-[#FFD6A7] to-[#FF914D] text-white",
      dotClass: "bg-[#FF820F]",
      pillClass: "bg-[#FFF0DA] text-[#E06E00]",
    },
    {
      label: "Fat",
      value: Math.round(todayProgress.fat),
      target: fatTarget,
      Icon: FatIcon,
      iconClass: "from-[#B08CFF] to-[#7548F7] text-white",
      dotClass: "bg-[#7C4DFF]",
      pillClass: "bg-[#EEE5FF] text-[#744AE8]",
    },
  ];



  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      className="overflow-x-hidden text-slate-900 relative"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "linear-gradient(135deg, #FEFFFE 0%, #F8FDF9 50%, #F5FAF7 100%)",
            "radial-gradient(ellipse 120% 80% at -20% -10%, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0) 60%)",
            "radial-gradient(ellipse 100% 120% at 110% 105%, rgba(52, 211, 153, 0.04) 0%, rgba(52, 211, 153, 0) 50%)",
            "radial-gradient(ellipse 80% 100% at 105% -5%, rgba(251, 191, 36, 0.03) 0%, rgba(251, 191, 36, 0) 50%)",
            "radial-gradient(ellipse 140% 60% at 50% 95%, rgba(16, 185, 129, 0.02) 0%, rgba(16, 185, 129, 0) 40%)",
            "radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 30%)",
          ].join(", "),
        }}
      />
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0.06 }}
        animate={prefersReducedMotion ? undefined : ambientGlow.animate}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 100% 100% at 50% 30%, rgba(16, 185, 129, 0.03) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.3]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
          backgroundRepeat: "repeat",
          mixBlendMode: "overlay",
        }}
      />
      <main className="relative mx-auto max-w-[430px] px-4 sm:px-6 pt-safe-offset-4 pb-4 pt-6">
        <header className="flex items-center justify-between">
          <Link to="/profile" className="flex items-center gap-3">
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white bg-white shadow-[0_8px_16px_rgba(15,23,42,0.1)] overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[15px] font-bold text-[#10B981]">{userName.charAt(0)}</span>
              )}
            </div>
            <div>
              <p className="text-[12px] font-medium leading-tight text-slate-700">{timeGreeting}</p>
              <h1 className="mt-0.5 text-[15px] font-extrabold leading-none tracking-[-0.03em] text-slate-950">{userName}</h1>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div ref={notificationRef} className="relative">
              <button
                type="button"
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                className="relative flex h-[36px] w-[36px] items-center justify-center text-slate-950"
                aria-label="Notifications"
              >
                <Bell className="h-[27px] w-[27px]" strokeWidth={2.15} />
                {displayedUnreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF1D25] px-1 text-[10px] font-extrabold leading-none text-white shadow-[0_4px_10px_rgba(255,29,37,0.22)] ring-2 ring-white">
                    {displayedUnreadCount > 9 ? "9+" : displayedUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {showNotificationsDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 360, damping: 28 }}
                    className="absolute right-0 top-[44px] z-50 w-[340px] max-w-[calc(100vw-40px)] rounded-[22px] bg-white shadow-[0_16px_40px_rgba(0,0,0,0.14)] ring-1 ring-slate-200/80 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <h3 className="text-[14px] font-extrabold tracking-[-0.01em] text-slate-950">Notifications</h3>
                      {displayedUnreadCount > 0 && (
                        <span className="rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
                          {displayedUnreadCount} new
                        </span>
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
                          <p className="mt-3 text-[13px] font-semibold text-slate-700">All caught up</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">No new notifications</p>
                        </div>
                      ) : (
                        recentNotifications.map((notif) => {
                          const cfg = (({
                            order_update: { icon: Truck, bg: "bg-[#E6FFF5]", iconColor: "text-[#10B981]" },
                            meal_reminder: { icon: Utensils, bg: "bg-[#FFF4E6]", iconColor: "text-[#F97316]" },
                            subscription_alert: { icon: Crown, bg: "bg-[#FFF7ED]", iconColor: "text-[#EA580C]" },
                            general: { icon: TrendingUp, bg: "bg-[#EFF6FF]", iconColor: "text-[#3B82F6]" },
                            announcement: { icon: Bell, bg: "bg-[#FEF3C7]", iconColor: "text-[#F59E0B]" },
                          } as Record<string, { icon: React.ElementType; bg: string; iconColor: string }>)[notif.type]) || { icon: Bell, bg: "bg-slate-100", iconColor: "text-slate-500" };
                          const IconComponent = cfg.icon;
                          const isUnread = notif.status === "unread";
                          return (
                            <button
                              key={notif.id}
                              type="button"
                              onClick={() => { setShowNotificationsDropdown(false); navigate("/notifications"); }}
                              className={`flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-slate-50 ${isUnread ? "bg-violet-50/30" : ""}`}
                            >
                              <div className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl ${cfg.bg} ${isUnread ? "ring-2 ring-violet-200" : ""}`}>
                                <IconComponent className={`h-[18px] w-[18px] ${cfg.iconColor}`} strokeWidth={1.75} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className={`truncate text-[13px] font-semibold ${isUnread ? "text-slate-950" : "text-slate-700"}`}>
                                    {notif.title}
                                  </p>
                                  {isUnread && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#10B981]" />}
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
                                  {notif.message}
                                </p>
                                <span className="mt-1 inline-block text-[10px] font-medium text-slate-400">
                                  {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* View All Footer */}
                    <Link
                      to="/notifications"
                      onClick={() => setShowNotificationsDropdown(false)}
                      className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-3 text-[13px] font-semibold text-[#10B981] transition hover:bg-[#F0FDF6]"
                    >
                      View all notifications
                      <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2} />
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Today's Meals Section */}
        <motion.section
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.35, ease: "easeOut", delay: 0.05 }}
          className="mt-5 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Today's Meals</h2>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">What's on your plate today</p>
            </div>
            <Link
              to="/schedule"
              className="flex h-[30px] items-center gap-1 rounded-full bg-[#F0FDF6] px-2.5 text-[11px] font-semibold text-[#10B981]"
            >
              Schedule
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="mt-3 space-y-2">
            {(() => {
              const slots = [
                { type: "breakfast", label: "Breakfast", icon: Coffee, color: "from-amber-400 to-orange-500", bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-200" },
                { type: "lunch", label: "Lunch", icon: Soup, color: "from-emerald-400 to-teal-500", bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-200" },
                { type: "dinner", label: "Dinner", icon: UtensilsCrossed, color: "from-violet-400 to-purple-500", bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200" },
              ];
              const hasAnyMeal = slots.some((s) => {
                const m = todayMeals.find((tm) => tm.type === s.type);
                return m && m.meal;
              });

              if (!hasAnyMeal) {
                return (
                  <Link
                    to="/meals"
                    className="block rounded-2xl bg-gradient-to-br from-[#F0FDF6] via-[#F6FFF9] to-[#F0F7FF] p-5 ring-1 ring-emerald-100/60 transition active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_6px_14px_rgba(251,146,60,0.3)] ring-2 ring-white">
                          <Coffee className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_6px_14px_rgba(16,185,129,0.3)] ring-2 ring-white">
                          <Soup className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white shadow-[0_6px_14px_rgba(139,92,246,0.3)] ring-2 ring-white">
                          <UtensilsCrossed className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[14px] font-extrabold text-slate-900">Plan your meals for today</h3>
                        <p className="mt-0.5 text-[12px] text-slate-500 leading-relaxed">
                          Fresh, nutritious meals delivered to your door — curated by local restaurants.
                        </p>
                      </div>
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_6px_14px_rgba(16,185,129,0.3)]">
                        <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} />
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
                  className={`flex items-center gap-3 rounded-[16px] p-3 transition-colors ${
                    hasMeal ? `${slot.bg} ring-1 ${slot.ring} cursor-pointer` : "bg-slate-50 border border-dashed border-slate-200"
                  }`}
                >
                  {/* Slot Icon */}
                  <div className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${slot.color} text-white shadow-[0_6px_14px_rgba(0,0,0,0.12)]`}>
                    <IconSlot className="h-[20px] w-[20px]" strokeWidth={1.75} />
                  </div>

                  {hasMeal ? (
                    <>
                      {/* Meal Image */}
                      {meal.meal?.image_url ? (
                        <img
                          src={meal.meal.image_url}
                          alt={meal.meal.name}
                          className="h-[48px] w-[48px] shrink-0 rounded-xl object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                          <Utensils className="h-[20px] w-[20px] text-slate-400" strokeWidth={1.5} />
                        </div>
                      )}

                      {/* Meal Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold leading-snug text-slate-950">
                          {meal.meal?.name || slot.label}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          {meal.restaurant?.name && (
                            <span className="truncate">{meal.restaurant.name}</span>
                          )}
                          {meal.meal?.calories && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{meal.meal.calories} cal</span>
                            </>
                          )}
                          {meal.delivery_time_slot && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span>{meal.delivery_time_slot}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-[0_2px_6px_rgba(0,0,0,0.06)] transition-transform ${expandedMeal === `${slot.type}-${meal.schedule_id}` ? "rotate-90" : ""}`}>
                        <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2} />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Empty Slot */}
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-semibold ${slot.text}`}>{slot.label}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">No meal planned</p>
                      </div>

                      {/* Order Now CTA */}
                      <Link
                        to="/meals"
                        className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#10B981] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition hover:bg-[#F0FDF6]"
                      >
                        <Plus className="h-[13px] w-[13px]" strokeWidth={2.5} />
                        Order Now
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
                      <div className="mx-3 mb-2 mt-1 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400">Nutrition Facts</p>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-2.5 text-center ring-1 ring-amber-100">
                            <Flame className="mx-auto h-[18px] w-[18px] text-amber-500" strokeWidth={1.75} />
                            <p className="mt-1 text-[16px] font-extrabold leading-none text-slate-950">{meal.meal?.calories || 0}</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600">Cal</p>
                          </div>
                          <div className="rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 p-2.5 text-center ring-1 ring-rose-100">
                            <Drumstick className="mx-auto h-[18px] w-[18px] text-rose-500" strokeWidth={1.75} />
                            <p className="mt-1 text-[16px] font-extrabold leading-none text-slate-950">{meal.meal?.protein_g || 0}g</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-rose-600">Protein</p>
                          </div>
                          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 p-2.5 text-center ring-1 ring-blue-100">
                            <Wheat className="mx-auto h-[18px] w-[18px] text-blue-500" strokeWidth={1.75} />
                            <p className="mt-1 text-[16px] font-extrabold leading-none text-slate-950">{meal.meal?.carbs_g || 0}g</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-600">Carbs</p>
                          </div>
                          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 p-2.5 text-center ring-1 ring-purple-100">
                            <FatIcon className="mx-auto h-[18px] w-[18px] text-purple-500" strokeWidth={1.75} />
                            <p className="mt-1 text-[16px] font-extrabold leading-none text-slate-950">{meal.meal?.fat_g || 0}g</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-purple-600">Fat</p>
                          </div>
                        </div>
                        <Link
                          to={`/meals/${meal.meal?.id}`}
                          className="mt-3 flex items-center justify-center gap-1 rounded-full bg-[#F0FDF6] py-2 text-[12px] font-semibold text-[#10B981] transition hover:bg-[#E0F9EE]"
                        >
                          View Full Details
                          <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
            })})()}
          </div>

          {todayMealsError && (
            <div className="mt-3 rounded-2xl ring-1 ring-amber-100 bg-amber-50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertCircle className="h-[16px] w-[16px]" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-slate-800">Couldn&apos;t load today&apos;s meals</p>
                  <p className="text-[10px] text-slate-500">Tap to try again</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setTodayMealsError(false); setTodayMealsLoading(true); fetchTodayMeals(); }}
                  className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          {todayMealsLoading && (
            <div className="mt-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-[70px] animate-pulse rounded-[16px] bg-slate-100" />
              ))}
            </div>
          )}
        </motion.section>

        <motion.section 
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.4, ease: "easeOut" }}
          className="mt-6 rounded-[24px] bg-white px-[14px] py-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
        >
          <div className="flex items-center">
            <div className="relative flex h-[96px] w-[96px] shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 108 108" aria-hidden="true">
                <circle cx="54" cy="54" r={balanceRadius} fill="none" stroke="#CBEFD9" strokeWidth="9" />
                <motion.circle
                  cx="54"
                  cy="54"
                  r={balanceRadius}
                  fill="none"
                  stroke="#10A95F"
                  strokeLinecap="round"
                  strokeWidth="9"
                  strokeDasharray={balanceCirc}
                  strokeDashoffset={balanceOffset}
                  variants={progressRingVariants}
                  initial="hidden"
                  animate="visible"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[20px] font-extrabold leading-none tracking-[-0.04em] text-[#10A95F]">{isUnlimited ? "∞" : animatedBalance}</span>
                <span className="mt-1.5 text-[9px] font-medium leading-[1.28] text-slate-500">Avail.<br />Balance</span>
              </div>
            </div>

            <div className="mx-3 h-[80px] w-px shrink-0 bg-slate-200" />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#EFFAF4] text-[#10A95F]">
                  <Calendar className="h-[13px] w-[13px]" />
                </div>
                <span className="flex-1 text-[11px] font-medium text-slate-500">Mo. Balance</span>
                <span className="text-[12px] font-extrabold tracking-[-0.02em] text-slate-950">{balanceDisplay} / {totalMealsDisplay}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#EFFAF4] text-[#10A95F]">
                  <ArrowRightLeft className="h-[13px] w-[13px]" />
                </div>
                <span className="flex-1 text-[11px] font-medium text-slate-500">Transfer Bal.</span>
                <span className="text-[12px] font-extrabold tracking-[-0.02em] text-[#10A95F]">+0</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center gap-2.5">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#EFFAF4] text-[#10A95F]">
                  <Wallet className="h-[13px] w-[13px]" />
                </div>
                <span className="flex-1 text-[11px] font-medium text-slate-500">Total Avail.</span>
                <span className="text-[12px] font-extrabold tracking-[-0.02em] text-slate-950">{balanceDisplay}</span>
              </div>
            </div>

            <div className="mx-3 h-[80px] w-px shrink-0 bg-slate-200" />

            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className="flex shrink-0 flex-col items-center justify-center gap-1.5 text-center rounded-2xl p-1.5 transition active:scale-95 hover:bg-slate-50"
              aria-label="View subscription"
            >
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-[#FF8A2A] to-[#F97316] text-white shadow-[0_7px_14px_rgba(249,115,22,0.2)]">
                <Crown className="h-[18px] w-[18px]" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Subscription</span>
              <span className="rounded-full bg-[#D8F5E0] px-2 py-0.5 text-[10px] font-extrabold text-[#0E9F59]">{planName}</span>
              <span className="text-[10px] font-medium text-slate-500">{joinedLabel}</span>
              <div className="mt-1 h-[2px] w-[42px] rounded-full overflow-hidden bg-slate-200">
                <div className="h-full w-full rounded-full bg-gradient-to-r from-transparent via-slate-400 to-transparent" style={{ backgroundSize: '200% 100%', animation: 'shimmer 2.5s ease-in-out infinite' }} />
              </div>
            </button>
          </div>
        </motion.section>

        {/* ── Subscription Upgrade Nudge (conditional) ── */}
        <div className="mt-4">
          <SubscriptionNudge />
        </div>

        <section className="mt-4 rounded-[24px] bg-white px-4 pb-5 pt-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-slate-500" strokeWidth={2} />
              <span className="text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <motion.button
                type="button"
                onClick={goToPrevDay}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_3px_8px_rgba(15,23,42,0.03)]"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.button>
              <motion.button
                type="button"
                onClick={goToNextDay}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                disabled={isToday}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_3px_8px_rgba(15,23,42,0.03)] disabled:opacity-50"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </div>
          </div>

          <div className="mt-4 flex h-[32px] items-center rounded-full border border-[#F8DDB5] bg-[#FFF9F1] px-3">
            <div className="flex items-center gap-2 text-[#7A4A18]">
              <Flame className="h-[15px] w-[15px] text-[#E98A05]" />
              <span className="whitespace-nowrap text-[12px] font-semibold">Daily Streak</span>
            </div>
            <div className="mx-3 flex flex-1 items-center justify-between gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[4px] flex-1 rounded-full bg-[#F59E0B]" />
              ))}
            </div>
            <span className="text-[13px] font-extrabold text-slate-900">{completedThisWeek}/7</span>
          </div>

          {!weeklyLoading && weeklySummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 280, damping: 26 }}
              className="mt-3"
            >
              <div className="flex items-center gap-3 rounded-[16px] bg-gradient-to-r from-emerald-50 to-teal-50 p-3 ring-1 ring-emerald-100/60">
                <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-[0_4px_8px_rgba(16,185,129,0.15)]">
                  <Calendar className="h-[14px] w-[14px]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-slate-800">This Week</p>
                  <p className="text-[10px] font-medium text-slate-500">
                    {weeklySummary.calories.thisWeekAvg.toLocaleString()} / {(profile?.daily_calorie_target || 2066) * 7} cal
                    {weeklySummary.calories.trend === "up" && " · ↑ on track"}
                    {weeklySummary.calories.trend === "down" && " · ↓ below target"}
                    {weeklySummary.calories.trend === "stable" && " · holding steady"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-[#10B981] shadow-[0_2px_6px_rgba(16,185,129,0.1)]">
                  {weeklySummary.consistency.percentage}%
                </span>
              </div>
            </motion.div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? undefined : { delay: 0.08, type: "spring", stiffness: 280, damping: 26 }}
              className="flex cursor-pointer items-center gap-2.5 rounded-[16px] bg-gradient-to-br from-blue-50 to-cyan-50 p-3 ring-1 ring-blue-100/60"
              onClick={() => navigate("/water-tracker")}
            >
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] shadow-[0_4px_8px_rgba(59,130,246,0.15)]">
                <Droplets className="h-[16px] w-[16px] text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-blue-600">Water</p>
                <p className="text-[13px] font-extrabold leading-none tracking-[-0.02em] text-slate-900">
                  {Math.round(waterToday / 240 * 10) / 10} cups
                </p>
                <div className="mt-1.5 h-[4px] w-full overflow-hidden rounded-full bg-blue-200">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((waterToday / waterGoal) * 100, 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
                  />
                </div>
              </div>
              <ChevronRight className="h-[14px] w-[14px] shrink-0 text-blue-400" strokeWidth={2} />
            </motion.div>

            <motion.div
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? undefined : { delay: 0.1, type: "spring", stiffness: 280, damping: 26 }}
              className="flex cursor-pointer items-center gap-2.5 rounded-[16px] bg-gradient-to-br from-orange-50 to-amber-50 p-3 ring-1 ring-orange-100/60"
              onClick={() => navigate("/step-counter")}
            >
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F97316] to-[#EA580C] shadow-[0_4px_8px_rgba(249,115,22,0.15)]">
                <Footprints className="h-[16px] w-[16px] text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-orange-600">Steps</p>
                <p className="text-[13px] font-extrabold leading-none tracking-[-0.02em] text-slate-900">
                  {stepsToday.toLocaleString()}
                </p>
                <div className="mt-1.5 h-[4px] w-full overflow-hidden rounded-full bg-orange-200">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((stepsToday / stepsGoal) * 100, 100)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
                  />
                </div>
              </div>
              <ChevronRight className="h-[14px] w-[14px] shrink-0 text-orange-400" strokeWidth={2} />
            </motion.div>
          </div>

          {(() => {
            const badges: Array<{ emoji: string; label: string; color: string }> = [];

            if (dailyStreak >= 7) {
              badges.push({ emoji: "🔥", label: `${dailyStreak}-day streak!`, color: "from-amber-400 to-orange-500" });
            } else if (dailyStreak >= 5) {
              badges.push({ emoji: "⚡", label: `${dailyStreak}-day streak`, color: "from-amber-300 to-amber-500" });
            }

            if (weeklySummary && weeklySummary.consistency.percentage >= 85) {
              badges.push({ emoji: "🎯", label: `${weeklySummary.consistency.percentage}% consistent this week`, color: "from-emerald-400 to-teal-500" });
            }

            if (streaks?.logging?.bestStreak && streaks.logging.bestStreak >= 14) {
              badges.push({ emoji: "🏆", label: `Best streak: ${streaks.logging.bestStreak} days`, color: "from-violet-400 to-purple-500" });
            }

            if (badges.length === 0) return null;

            return (
              <div className="mt-2 flex flex-wrap gap-2">
                {badges.map((badge, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.15 + i * 0.1,
                      type: "spring",
                      stiffness: 260,
                      damping: 18,
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${badge.color} px-3 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)]`}
                  >
                    <motion.span
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
                      className="text-xs"
                    >
                      {badge.emoji}
                    </motion.span>
                    <span className="text-[11px] font-extrabold text-white">{badge.label}</span>
                  </motion.div>
                ))}
              </div>
            );
          })()}

          <motion.div 
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="mt-3 rounded-[20px] border border-slate-100 bg-white px-3 py-4 shadow-[inset_0_0_20px_rgba(15,23,42,0.012)]"
          >
            <div className="flex items-center justify-between">
              {/* Consumed */}
              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] shadow-[0_4px_8px_rgba(16,185,129,0.08)]">
                  <Utensils className="h-5 w-5 text-[#10B981]" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-400">Consumed</span>
                <span className="text-[26px] font-bold leading-none tracking-[-0.03em] text-[#111827]">{animatedCalories}</span>
                <span className="text-[11px] font-medium text-slate-400">Cal</span>
              </div>

              {/* Calorie Ring */}
              <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center">
                <svg className="relative h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
                  <circle cx="70" cy="70" r={ringRadius} fill="none" stroke={overBudget ? "#FEE2E2" : "#DCFCE7"} strokeWidth="9" />
                  <motion.circle
                    cx="70"
                    cy="70"
                    r={ringRadius}
                    fill="none"
                    stroke={ringColor}
                    strokeLinecap="round"
                    strokeWidth="9"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringOffset}
                    style={{ filter: overBudget ? "drop-shadow(0 6px 10px rgba(239,68,68,0.25))" : "drop-shadow(0 6px 10px rgba(16,185,129,0.2))" }}
                    variants={progressRingVariants}
                    initial="hidden"
                    animate="visible"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-[18px] font-extrabold leading-none tracking-[-0.04em]" style={{ color: ringColor }}>{calRemaining}</span>
                  <span className="mt-1 text-[10px] font-bold uppercase leading-none" style={{ color: ringColor }}>Remaining</span>
                  <span className="mt-0.5 text-[9px] font-medium text-slate-400">{Math.round(consumedPct)}%</span>
                </div>
              </div>

              {/* Burned */}
              <div className="flex flex-col items-center text-center gap-1.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] shadow-[0_4px_8px_rgba(249,115,22,0.08)]">
                  <Flame className="h-5 w-5 text-[#F97316]" strokeWidth={2} />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.03em] text-slate-400">Burned</span>
                <span className="text-[26px] font-bold leading-none tracking-[-0.03em] text-[#111827]">{animatedBurned}</span>
                <span className="text-[11px] font-medium text-slate-400">Cal</span>
              </div>
            </div>
          </motion.div>

          <div className="mt-5">
            <motion.div 
              initial={prefersReducedMotion ? undefined : "hidden"}
              animate={prefersReducedMotion ? undefined : "visible"}
              variants={prefersReducedMotion ? undefined : staggerContainer}
              className="grid grid-cols-3 gap-2.5"
            >
              {macroCards.map(({ label, value, target, Icon, iconClass, dotClass, pillClass }) => {
                const percent = Math.round((value / (target || 1)) * 100);
                
                return (
                  <motion.div 
                    key={label}
                    variants={prefersReducedMotion ? undefined : staggerItem}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                    className="overflow-hidden rounded-[18px] border border-slate-100 bg-white p-2.5 shadow-[0_9px_22px_rgba(15,23,42,0.055)]"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_4px_8px_rgba(15,23,42,0.08)] ${iconClass}`}>
                        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                      </div>
                      <div className="w-full min-w-0 text-center">
                        <p className="truncate text-[10px] font-bold leading-tight text-slate-500">{label}</p>
                        <p className="mt-0.5 text-[16px] font-extrabold leading-none tracking-[-0.04em] text-slate-950">{value}g</p>
                      </div>
                    </div>

                    <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div className={`h-full rounded-full ${dotClass}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold tracking-[-0.02em] text-slate-400">/{target}g</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold leading-none ${pillClass}`}>{percent}%</span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

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
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50/60 px-4 py-3">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[20px]">{trend}</span>
                  <div>
                    <span className={`text-[14px] font-extrabold tracking-[-0.03em] ${trendColor}`}>{deltaAbs} kg</span>
                    <p className="text-[10px] font-medium text-slate-400">7-day trend</p>
                  </div>
                </div>
                <div className="flex-1" />
                <svg viewBox={`0 0 ${width} ${height}`} className="h-7 shrink-0" style={{ width }}>
                  <polygon points={areaPath} fill={trendColor.replace("text-", "").replace("emerald-600", "#059669").replace("red-500", "#EF4444").replace("slate-400", "#94A3B8")} fillOpacity={0.1} />
                  <polyline
                    points={pointsLine}
                    fill="none"
                    stroke={trendColor.replace("text-", "").replace("emerald-600", "#059669").replace("red-500", "#EF4444").replace("slate-400", "#94A3B8")}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx={toX(weights.length - 1)} cy={toY(last)} r={3} fill={trendColor.replace("text-", "").replace("emerald-600", "#059669").replace("red-500", "#EF4444").replace("slate-400", "#94A3B8")} />
                </svg>
              </div>
            );
          })()}

          {(() => {
            const protRemaining = Math.max(0, proteinTarget - todayProgress.protein);
            const carbsRemaining = Math.max(0, carbsTarget - todayProgress.carbs);
            const fatRemaining = Math.max(0, fatTarget - todayProgress.fat);

            const protPct = proteinTarget > 0 ? protRemaining / proteinTarget : 0;
            const carbsPct = carbsTarget > 0 ? carbsRemaining / carbsTarget : 0;
            const fatPct = fatTarget > 0 ? fatRemaining / fatTarget : 0;

            const gaps = [
              { label: "protein", pct: protPct, remaining: protRemaining, unit: "g", color: "text-orange-600", bg: "bg-[#FFF0DA]", icon: Drumstick, ring: "ring-orange-200" },
              { label: "carbs", pct: carbsPct, remaining: carbsRemaining, unit: "g", color: "text-emerald-600", bg: "bg-[#DDF8E7]", icon: Wheat, ring: "ring-emerald-200" },
              { label: "fat", pct: fatPct, remaining: fatRemaining, unit: "g", color: "text-violet-600", bg: "bg-[#EEE5FF]", icon: FatIcon, ring: "ring-violet-200" },
            ].filter(g => g.remaining > 0 && g.pct >= 0.2);

            if (gaps.length === 0 || !isUnlimited) return null;

            gaps.sort((a, b) => b.pct - a.pct);
            const top = gaps[0];

            let suggestion = "";
            let suggestionIcon = top.icon;
            if (top.label === "protein" && calRemaining >= 300) {
              suggestion = `You have ${top.remaining}g protein and ${calRemaining} cal remaining — a Protein Power Bowl would fit your macros perfectly.`;
            } else if (top.label === "carbs" && calRemaining >= 300) {
              suggestion = `With ${top.remaining}g carbs left and ${calRemaining} cal, a balanced Grain Bowl would round out your day.`;
            } else if (top.label === "fat" && calRemaining >= 300) {
              suggestion = `You have ${top.remaining}g fat to fill — try a Mediterranean meal to satisfy your targets.`;
            } else if (calRemaining < 300 && calRemaining > 0) {
              suggestion = `Only ${calRemaining} cal left today — a light salad or wrap would be perfect.`;
              suggestionIcon = Soup;
            } else {
              return null;
            }

            return (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 26 }}
                className="mt-4"
              >
                <Link
                  to="/meals"
                  className={`block rounded-2xl border p-3.5 shadow-sm transition-all hover:shadow-md hover:scale-[1.01] ${top.bg} ring-1 ${top.ring}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.06)]`}>
                      <suggestionIcon className={`h-[18px] w-[18px] ${top.color}`} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-800">What to Eat</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600">{suggestion}</p>
                    </div>
                    <div className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-white text-slate-400 shadow-[0_2px_5px_rgba(0,0,0,0.05)]">
                      <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })()}

          <div className="mt-5">
            <div className="flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-[#10A95F]" strokeWidth={2.1} />
              <h2 className="text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">Activity Details</h2>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex h-[48px] flex-1 items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 shadow-[0_6px_14px_rgba(15,23,42,0.03)]">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8A2A] to-[#F97316] text-white shadow-[0_7px_14px_rgba(249,115,22,0.2)]">
                  <Flame className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-[11px] font-medium leading-tight text-slate-500">Total Burned</p>
                  <p className="text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-slate-950">{totalBurned} Cal</p>
                </div>
              </div>
              <div className="flex h-[48px] flex-1 items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 shadow-[0_6px_14px_rgba(15,23,42,0.03)]">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#19C878] to-[#079A59] text-white shadow-[0_7px_14px_rgba(16,185,129,0.18)]">
                  <Activity className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-[11px] font-medium leading-tight text-slate-500">Sessions</p>
                  <p className="text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-slate-950">{workoutCount}</p>
                </div>
              </div>
              <motion.button
                type="button"
                data-testid="log-activity-button"
                onClick={() => setSheetOpen(true)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#20C978] to-[#059A5A] text-white shadow-[0_10px_20px_rgba(5,150,90,0.28)]"
                aria-label="Log activity"
              >
                <Plus className="h-[22px] w-[22px]" strokeWidth={2} />
              </motion.button>
            </div>
          </div>

          {/* Achievement Strip */}
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { delay: 0.25, type: "spring", stiffness: 280, damping: 26 }}
            className="mt-4"
          >
            <motion.div
              className="cursor-pointer"
              onClick={() => setShowAchievements(!showAchievements)}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            >
              <div className="flex items-center gap-3 rounded-[20px] bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-3.5 ring-1 ring-violet-100/60 shadow-[0_6px_18px_rgba(139,92,246,0.06)]">
                {/* Level Badge */}
                <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_8px_16px_rgba(139,92,246,0.25)]">
                  <Trophy className="h-[22px] w-[22px] text-white" strokeWidth={1.75} />
                </div>

                {/* Stats */}
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold tracking-[-0.01em] text-slate-950">
                    Level {gamification.level}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-violet-500 truncate">
                    {gamification.earnedBadges > 0
                      ? `${gamification.earnedBadges} of ${gamification.totalBadges} badges earned`
                      : "Start earning badges today"}
                  </p>
                  <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full bg-violet-200">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((gamification.xp % 100) / 100) * 100, 100)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                    />
                  </div>
                </div>

                {/* Badge Preview */}
                <div className="flex shrink-0 -space-x-2">
                  {Array.from(gamification.earnedIds).slice(0, 3).reverse().map((badgeId: string) => {
                    const badge = gamification.badges.find((b) => b.id === badgeId);
                    const rarityGradient: Record<string, string> = {
                      common: "from-gray-400 to-gray-500",
                      rare: "from-blue-400 to-blue-600",
                      epic: "from-purple-400 to-purple-600",
                      legendary: "from-amber-400 to-amber-600",
                    };
                    const grad = rarityGradient[badge?.rarity || "common"] || rarityGradient.common;
                    return (
                      <div
                        key={badgeId}
                        className={`flex h-[32px] w-[32px] items-center justify-center rounded-full bg-gradient-to-br ${grad} shadow-[0_4px_8px_rgba(139,92,246,0.2)] ring-2 ring-white`}
                      >
                        <Medal className="h-[15px] w-[15px] text-white" strokeWidth={2} />
                      </div>
                    );
                  })}
                  {gamification.earnedBadges === 0 && (
                    <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-white ring-2 ring-white">
                      <Trophy className="h-[14px] w-[14px] text-violet-400" strokeWidth={1.75} />
                    </div>
                  )}
                </div>

                {/* Expand Chevron */}
                <ChevronRight className={`h-[16px] w-[16px] text-violet-300 transition-transform ${showAchievements ? "rotate-90" : ""}`} strokeWidth={2} />
              </div>
            </motion.div>

            {/* Expanded Badge Wall */}
            <AnimatePresence>
              {showAchievements && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 28 }}
                  className="overflow-hidden"
                >
                  <div className="mx-1 mt-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400 mb-3">
                      Your Achievements
                    </p>

                    {/* Earned Badges */}
                    {gamification.earnedBadges > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-2">
                          {gamification.badges
                            .filter((b) => gamification.earnedIds.has(b.id))
                            .map((badge) => {
                              const cfg = rarityConfig[badge.rarity] || rarityConfig.common;
                              return (
                                <div
                                  key={badge.id}
                                  className={`flex items-center gap-2 rounded-xl border p-2 ${cfg.bg} ${cfg.border}`}
                                  title={badge.description}
                                >
                                  <div className={`flex h-[28px] w-[28px] items-center justify-center rounded-lg bg-gradient-to-br ${cfg.gradient} shadow-sm`}>
                                    <Medal className="h-[14px] w-[14px] text-white" strokeWidth={2} />
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

                    {/* Next Unlocks */}
                    {gamification.earnedBadges < gamification.totalBadges && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 mb-2">Next to unlock</p>
                        <div className="space-y-1.5">
                          {gamification.badges
                            .filter((b) => !gamification.earnedIds.has(b.id))
                            .slice(0, 3)
                            .map((badge) => {
                              const cfg = rarityConfig[badge.rarity] || rarityConfig.common;
                              return (
                                <div key={badge.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
                                  <div className="flex h-[24px] w-[24px] items-center justify-center rounded-lg bg-slate-200">
                                    <Lock className="h-[12px] w-[12px] text-slate-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-slate-700 truncate">{badge.name}</p>
                                    <p className="text-[10px] text-slate-400">+{badge.xp_reward} XP</p>
                                  </div>
                                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-medium capitalize ${cfg.bg} ${cfg.border}`}>
                                    {badge.rarity}
                                  </span>
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

          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between pl-0.5">
              <h3 className="text-[17px] font-black tracking-[-0.04em] text-slate-950">Quick Actions</h3>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              <QuickActionCard
                icon={TrackerIcon}
                label="Tracker"
                iconBg="bg-emerald-500"
                iconShadow="shadow-[0_6px_16px_rgba(16,185,129,0.35)]"
                onClick={() => navigate("/tracker")}
                prefersReducedMotion={prefersReducedMotion}
              />
              <QuickActionCard
                icon={FavoriteIcon}
                label="Favorites"
                iconBg="bg-rose-500"
                iconShadow="shadow-[0_6px_16px_rgba(244,63,94,0.35)]"
                onClick={() => navigate("/favorites")}
                prefersReducedMotion={prefersReducedMotion}
              />
              <QuickActionCard
                icon={ProgressIcon}
                label="Progress"
                iconBg="bg-blue-500"
                iconShadow="shadow-[0_6px_16px_rgba(59,130,246,0.35)]"
                onClick={() => navigate("/progress")}
                prefersReducedMotion={prefersReducedMotion}
              />
              <QuickActionCard
                icon={CommunityIcon}
                label="Community"
                iconBg="bg-violet-500"
                iconShadow="shadow-[0_6px_16px_rgba(139,92,246,0.35)]"
                onClick={() => navigate("/community")}
                prefersReducedMotion={prefersReducedMotion}
              />
            </div>
          </div>

          <motion.button
            data-testid="log-meal-button"
            type="button"
            onClick={() => setLogMealOpen(true)}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-3 rounded-[20px] bg-gradient-to-r from-[#12B969] to-[#079B5A] text-[15px] font-extrabold tracking-[-0.02em] text-white shadow-[0_12px_24px_rgba(6,150,88,0.24)]"
          >
            <ConciergeBell className="h-[24px] w-[24px]" strokeWidth={2.1} />
            Log Meal
          </motion.button>

          {/* Active Orders section */}
          {ordersError && (
            <div className="mt-4 rounded-2xl ring-1 ring-amber-100 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800">Couldn&apos;t load orders</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">Check your connection and try again</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setOrdersError(false); fetchActiveOrders(); }}
                  className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-200"
                >
                  <RefreshCw className="h-[13px] w-[13px]" strokeWidth={2} />
                  Retry
                </button>
              </div>
            </div>
          )}
          {activeOrders.length > 0 && (
            <section className="mt-5 rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-[0_6px_12px_rgba(16,185,129,0.18)]">
                    <ShoppingBag className="h-[17px] w-[17px]" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Active Orders</h2>
                    <p className="text-[11px] font-medium text-slate-500">{totalActiveOrders} order{totalActiveOrders !== 1 ? "s" : ""} in progress{totalActiveOrders > 3 ? ` · Showing first ${activeOrders.length}` : ""}</p>
                  </div>
                </div>
                <Link to="/orders" className="flex items-center gap-1 rounded-full bg-[#F0FDF6] px-3 py-1.5 text-[12px] font-semibold text-[#10B981] transition hover:bg-[#E0F9EE]">
                  View All
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {activeOrders.map((order) => {
                  const statusConfig: Record<string, { label: string; Icon: React.ElementType; badgeClass: string; iconBg: string; hint: string }> = {
                    pending: { label: "Pending", Icon: Clock, badgeClass: "bg-[#FFF3D6] text-[#B45309]", iconBg: "bg-gradient-to-br from-[#F59E0B] to-[#D97706]", hint: "Awaiting confirmation · ~5 min" },
                    confirmed: { label: "Confirmed", Icon: CheckCircle2, badgeClass: "bg-[#DBEAFE] text-[#1E40AF]", iconBg: "bg-gradient-to-br from-[#3B82F6] to-[#2563EB]", hint: "Order accepted · ~10 min" },
                    preparing: { label: "Preparing", Icon: Flame, badgeClass: "bg-[#FFF3D6] text-[#B45309]", iconBg: "bg-gradient-to-br from-[#F59E0B] to-[#D97706]", hint: "Cooking your meal · ~20 min" },
                    ready: { label: "Ready", Icon: Package, badgeClass: "bg-[#D1FAE5] text-[#065F46]", iconBg: "bg-gradient-to-br from-[#10B981] to-[#059669]", hint: "Ready for pickup" },
                    out_for_delivery: { label: "On The Way", Icon: Bike, badgeClass: "bg-[#E0F2FE] text-[#0369A1]", iconBg: "bg-gradient-to-br from-[#0EA5E9] to-[#0284C7]", hint: "On the way · ~15 min" },
                  };

                  const etaMin = order.order_status === "out_for_delivery" && order.updated_at
                    ? Math.max(0, 15 - Math.floor((Date.now() - new Date(order.updated_at).getTime()) / 60000))
                    : null;
                  const etaProgress = order.order_status === "out_for_delivery" && order.updated_at
                    ? Math.max(0, Math.min(100, ((15 - (etaMin || 15)) / 15) * 100))
                    : 0;

                  const config = statusConfig[order.order_status] || statusConfig.pending;
                  const IconComponent = config.Icon;

                  return (
                    <motion.div
                      key={order.id}
                      variants={prefersReducedMotion ? undefined : staggerItem}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
                      className="overflow-hidden rounded-[18px] border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]"
                    >
                      <Link to={`/live/${order.id}`} className="block">
                        <div className="flex items-center gap-4 p-4">
                          {/* Status icon */}
                          <div className={`flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_6px_14px_rgba(0,0,0,0.1)] ${config.iconBg}`}>
                            <IconComponent className="h-[22px] w-[22px]" strokeWidth={1.75} />
                          </div>

                          {/* Order info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-[15px] font-extrabold tracking-[-0.01em] text-slate-950">{order.restaurant_name}</h3>
                              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${config.badgeClass}`}>{config.label}</span>
                            </div>
                            <p className="mt-1 truncate text-[13px] font-semibold text-slate-600">{order.meal_name}</p>

                            {order.order_status === "out_for_delivery" && etaMin !== null ? (
                              <div className="mt-2">
                                <div className="flex items-center gap-2">
                                  <span className="shrink-0 text-[13px] font-extrabold text-sky-600">
                                    {etaMin <= 0 ? "Arriving now" : `~${etaMin} min`}
                                  </span>
                                  <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-sky-100">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${etaProgress}%` }}
                                      transition={{ duration: 0.5, ease: "easeOut" }}
                                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <div className={`h-[4px] w-[4px] rounded-full ${config.badgeClass.replace("bg-", "").split(" ")[0]}`.replace(/\[([^\]]+)\]/g, "$1")} />
                                <p className="text-[12px] font-medium text-slate-400">{config.hint}</p>
                              </div>
                            )}
                          </div>

                          <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" strokeWidth={2} />
                        </div>
                      </Link>

                      {/* Action buttons */}
                      {(order.order_status === "pending" || order.order_status === "confirmed") && (
                        <div className="flex items-center gap-2 border-t border-slate-50 px-4 pb-3 pt-2">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setSelectedSchedule(order); setShowModifyModal(true); }}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-slate-100 py-2 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-200"
                          >
                            <Pencil className="h-[13px] w-[13px]" strokeWidth={2} />
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleCancelOrder(order.id); }}
                            disabled={cancellingId === order.id}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-red-50 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            {cancellingId === order.id ? (
                              <Loader2 className="h-[13px] w-[13px] animate-spin" />
                            ) : (
                              <XCircle className="h-[13px] w-[13px]" strokeWidth={2} />
                            )}
                            Cancel
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Monthly Order Stats */}
          {monthlyStats.total > 0 && (
            <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-white px-4 py-3 ring-1 ring-slate-100 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] text-white shadow-[0_4px_10px_rgba(16,185,129,0.2)]">
                <ShoppingBag className="h-[16px] w-[16px]" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-slate-900">This Month</p>
                <p className="text-[10px] font-medium text-slate-500">
                  {monthlyStats.total} orders · {monthlyStats.completed} completed
                  {monthlyStats.cancelled > 0 && ` · ${monthlyStats.cancelled} cancelled`}
                </p>
              </div>
              {monthlyStats.total > 0 && (
                <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-extrabold text-[#10B981]">
                  {Math.round((monthlyStats.completed / monthlyStats.total) * 100)}%
                </span>
              )}
            </div>
          )}

          {(topRestaurantsError && !topRestaurantsLoading && topRestaurants.length === 0) && (
            <div className="mt-5 rounded-3xl ring-1 ring-amber-100 bg-amber-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-800">Couldn&apos;t load featured restaurants</p>
                  <p className="text-[10px] text-slate-500">Tap to try again</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setTopRestaurantsError(false); setTopRestaurantsLoading(true); fetchTopRestaurants(); }}
                  className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-200"
                >
                  <RefreshCw className="h-[13px] w-[13px]" strokeWidth={2} />
                  Retry
                </button>
              </div>
            </div>
          )}
          {(topRestaurantsLoading || topRestaurants.length > 0) && (
            <>
              {/* Section Wrapper Card */}
              <section className="mt-5 overflow-hidden rounded-[32px] bg-white p-4 pb-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
                {/* Header */}
                <div className="flex items-center justify-between px-1">
                  <div>
                    <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-slate-950">Top Rated</h2>
                    <p className="mt-0.5 text-[12px] font-medium text-slate-500">Popular restaurants near you</p>
                  </div>
                  <Link
                    to="/meals"
                    className="flex h-[32px] items-center gap-1 rounded-full bg-[#F0FDF6] px-3 text-[12px] font-semibold text-[#10B981] transition hover:bg-[#E0F9EE]"
                  >
                    View All
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {topRestaurantsLoading ? (
                  <div className="mt-4 flex gap-[14px] overflow-x-auto scrollbar-none">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-[200px] shrink-0">
                        <div className="h-[130px] w-full animate-pulse rounded-[22px] bg-slate-100" />
                        <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                        <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="mt-4 flex gap-[14px] overflow-x-auto scrollbar-none scroll-smooth px-1"
                    style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
                  >
                    {topRestaurants.map((restaurant, index) => (
                      <motion.div
                        key={restaurant.id}
                        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
                        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.08, type: "spring", stiffness: 260, damping: 28 }}
                        className="w-[200px] shrink-0"
                        style={{ scrollSnapAlign: "start" }}
                      >
                        <Link to={`/restaurant/${restaurant.id}`} className="group block">
                          <div
                            className="rounded-[26px] bg-white p-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)] transition-all duration-300 ease-out group-hover:shadow-[0_16px_40px_rgba(0,0,0,0.10)] group-hover:-translate-y-[2px]"
                            style={{ transform: "scale(1)" }}
                          >
                            {/* Cover Image */}
                            <div className="relative h-[130px] w-full overflow-hidden rounded-[18px]">
                              {restaurant.logo_url ? (
                                <>
                                  <img
                                    src={restaurant.logo_url}
                                    alt={restaurant.name}
                                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                                  />
                                  {/* Bottom gradient overlay */}
                                  <div className="absolute inset-x-0 bottom-0 h-[60px] bg-gradient-to-t from-black/40 to-transparent" />
                                </>
                              ) : (
                                <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700">
                                  {/* Decorative circles */}
                                  <div className="absolute -right-6 -top-6 h-[80px] w-[80px] rounded-full bg-white/10" />
                                  <div className="absolute -bottom-4 -left-4 h-[60px] w-[60px] rounded-full bg-white/10" />
                                  <div className="absolute right-8 bottom-6 h-[30px] w-[30px] rounded-full bg-white/5" />
                                  <div className="relative z-10 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/20 shadow-[0_0_30px_rgba(255,255,255,0.08)] backdrop-blur-sm">
                                    <Store className="h-[28px] w-[28px] text-white" strokeWidth={1.5} />
                                  </div>
                                  {/* Bottom gradient overlay */}
                                  <div className="absolute inset-x-0 bottom-0 h-[60px] bg-gradient-to-t from-black/40 to-transparent" />
                                </div>
                              )}

                              {/* Rating Badge */}
                              <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-[10px] bg-black/55 px-2 py-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.2)] backdrop-blur-md">
                                <Star className="h-[11px] w-[11px] fill-amber-400 text-amber-400" />
                                <span className="text-[11px] font-bold leading-none text-white">
                                  {restaurant.rating?.toFixed(1) || "0.0"}
                                </span>
                              </div>
                            </div>

                            {/* Content */}
                            <div className="mt-3 px-1">
                              <h3 className="truncate text-[14px] font-extrabold leading-snug tracking-[-0.01em] text-slate-950">
                                {restaurant.name}
                              </h3>
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                {restaurant.cuisine_types && restaurant.cuisine_types.length > 0 ? (
                                  <span className="truncate">
                                    {restaurant.cuisine_types.slice(0, 2).join(" · ")}
                                  </span>
                                ) : null}
                                {restaurant.total_orders ? (
                                  <span className={restaurant.cuisine_types?.length ? "" : ""}>
                                    {restaurant.cuisine_types?.length ? "·" : ""} {restaurant.total_orders}+ orders
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            {/* CTA Button */}
                            <div className="mt-3 flex items-center justify-end pr-1">
                              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-[#F0FDF6] shadow-[0_4px_10px_rgba(16,185,129,0.12)] transition-colors group-hover:bg-[#D1FAE5]">
                                <ChevronRight className="h-[16px] w-[16px] text-[#10B981]" strokeWidth={2.5} />
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </main>

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

const QuickActionCard = ({
  icon: Icon,
  label,
  iconBg,
  iconShadow,
  onClick,
  prefersReducedMotion,
}: {
  icon: LucideIcon;
  label: string;
  iconBg: string;
  iconShadow: string;
  onClick: () => void;
  prefersReducedMotion: boolean;
}) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
    className="flex flex-col items-center gap-2.5"
    aria-label={label}
  >
    {/* Icon container */}
    <span
      className={`flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[18px] ${iconBg} ${iconShadow} text-white`}
    >
      <Icon className="h-[26px] w-[26px]" strokeWidth={2} />
    </span>
    {/* Label */}
    <p className="w-full truncate text-center text-[11px] font-bold leading-tight tracking-[-0.01em] text-slate-700">
      {label}
    </p>
  </motion.button>
);

export default Dashboard;
