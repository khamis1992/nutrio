import { getNavArrows } from "@/lib/rtl";
import { forwardRef, useEffect, useState, useCallback, useRef } from "react";
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  AlertCircle,
  Apple,
  ArrowUpRight,
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
  Dumbbell,
  Flame,
  Footprints,
  Leaf,
  Loader2,
  Lock,
  Medal,
  Moon,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Smartphone,
  Soup,
  Star,
  Store,
  Trash2,
  TrendingUp,
  Trophy,
  Truck,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Heart,
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
import { ModifyOrderModal } from "@/components/ModifyOrderModal";
import { BodyCorrelationWidget } from "@/components/dashboard/BodyCorrelationWidget";
import { SubscriptionNudge } from "@/components/SubscriptionNudge";
import { RewardUnlockSheet } from "@/components/rewards/RewardUnlockSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import { useStreak } from "@/hooks/useStreak";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useHealthKitIntegration } from "@/hooks/useHealthKitIntegration";
import { useHealthDailyMetrics } from "@/hooks/useHealthDailyMetrics";
import { calculateGoalAlignmentScore, getGoalAlignmentLabelKey } from "@/lib/goal-engine";
import { calculateBodyLoad, calculateRecoveryReadiness, buildReadinessFoodTip, type HealthDailyMetrics } from "@/lib/health-readiness";
import { syncWorkoutSessionsToHealthDailyMetrics } from "@/lib/health-daily-metrics";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { calculateNutritionPerformance, findNutritionMatchedMeal } from "@/lib/nutrition-performance";
import { PLATFORM_LABELS, type SyncDataType } from "@/lib/healthKit";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";
import { useMealRecommendations } from "@/hooks/useMealRecommendations";
import { DailyPerformanceSnapshotSync } from "@/hooks/useDailyPerformanceSnapshot";
import ProgressRedesigned from "@/pages/ProgressRedesigned";
import { getQatarNow, getQatarDay, formatLocaleDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
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
  order_status?: string | null;
  restaurant_id?: string | null;
  meals: {
    id: string;
    name: string | null;
    image_url: string | null;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    restaurant_id?: string | null;
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

const normalizeDashboardMealType = (mealType: string | null | undefined) => {
  const type = (mealType || "").toLowerCase().trim();
  if (type === "snack2" || type === "snacks") return "snack";
  if (["breakfast", "lunch", "dinner", "snack"].includes(type)) return type;
  return null;
};

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

interface DashboardWorkoutSession {
  id: string;
  workout_type: string;
  duration_minutes: number;
  calories_burned: number;
}

/* ═══════════════════════════════════════════════════════════════════
   BENTO DASHBOARD — Level 6 Redesign
   New layout paradigm: bento grid canvas with tabbed sections,
   horizontal carousels, floating action button, and compact stat pills.
   Light mode. Emerald brand. Plus Jakarta Sans.
   ═══════════════════════════════════════════════════════════════════ */

type TabKey = "today" | "nutrition" | "activity" | "progress";

const INLINE_ACTIVITIES: Array<{ id: string; name: string; category: string; met: number; Icon: LucideIcon }> = [
  { id: "walking_moderate", name: "Walk", category: "Cardio", met: 3.5, Icon: Footprints },
  { id: "running_5mph", name: "Run", category: "Cardio", met: 8.3, Icon: Activity },
  { id: "cycling_moderate", name: "Cycle", category: "Cardio", met: 8.0, Icon: Bike },
  { id: "swimming", name: "Swim", category: "Cardio", met: 6.0, Icon: Activity },
  { id: "jump_rope", name: "Jump rope", category: "Cardio", met: 10.0, Icon: Activity },
  { id: "weight_training", name: "Weights", category: "Strength", met: 3.5, Icon: Dumbbell },
  { id: "bodyweight", name: "Bodyweight", category: "Strength", met: 3.8, Icon: Dumbbell },
  { id: "hiit", name: "HIIT", category: "Cardio", met: 8.0, Icon: Flame },
  { id: "yoga", name: "Yoga", category: "Mobility", met: 2.5, Icon: Heart },
  { id: "pilates", name: "Pilates", category: "Mobility", met: 3.0, Icon: Heart },
  { id: "basketball", name: "Basketball", category: "Sports", met: 6.5, Icon: Trophy },
  { id: "soccer", name: "Soccer", category: "Sports", met: 7.0, Icon: Trophy },
  { id: "tennis", name: "Tennis", category: "Sports", met: 7.3, Icon: Trophy },
  { id: "dancing", name: "Dancing", category: "Sports", met: 4.5, Icon: Heart },
];

const DURATION_PRESETS = [15, 30, 45, 60];
const ACTIVITY_CATEGORIES = ["All", "Cardio", "Strength", "Mobility", "Sports"];
const DASHBOARD_ACTIVITY_LABEL_KEYS: Record<string, string> = {
  walking_moderate: "activity_name_walk",
  running_5mph: "activity_name_run",
  cycling_moderate: "activity_name_cycle",
  swimming: "activity_name_swim",
  jump_rope: "activity_name_jump_rope",
  weight_training: "activity_name_weights",
  bodyweight: "activity_name_bodyweight",
  hiit: "activity_name_hiit",
  yoga: "activity_name_yoga",
  pilates: "activity_name_pilates",
  basketball: "activity_name_basketball",
  soccer: "activity_name_soccer",
  tennis: "activity_name_tennis",
  dancing: "activity_name_dancing",
};
const DASHBOARD_ACTIVITY_CATEGORY_KEYS: Record<string, string> = {
  All: "activity_category_all",
  Cardio: "activity_category_cardio",
  Strength: "activity_category_strength",
  Mobility: "activity_category_mobility",
  Sports: "activity_category_sports",
};
const DASHBOARD_COLORS = {
  text: "#020617",
  mutedText: "#94A3B8",
  surface: "#F6F8FB",
  track: "#E5EAF1",
  calories: "#22C7A1",
  protein: "#7C83F6",
  fat: "#FB6B7A",
  water: "#38BDF8",
  carbs: "#F97316",
};
const DASHBOARD_MEAL_SLIDE_ORDER = ["breakfast", "lunch", "dinner", "snack"];

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { activeGoal } = useNutritionGoals(user?.id);
  const {
    platform: healthPlatform,
    isAvailable: healthAvailable,
    isConnected: healthConnected,
    enabledTypes: healthEnabledTypes,
    lastSyncTimestamp,
    isSyncing: healthSyncing,
    toggleDataType: toggleHealthDataType,
    syncData: syncHealthData,
    formatLastSync,
  } = useHealthKitIntegration();
  const { metrics: healthDailyMetrics, rangeMetrics: healthRangeMetrics } = useHealthDailyMetrics(user?.id);
  const { subscription, remainingMeals, totalMeals, isUnlimited } = useSubscription();
  const { rolloverCredits } = useDashboardRolloverCredits(user?.id);
  const { t, language, isRTL } = useLanguage();
  useEffect(() => { document.title = `${t("dashboard_title")} — Nutrio`; }, [t]);
  const { PrevIcon, NextIcon } = getNavArrows(isRTL);
  const translateActivityName = (activity: { id: string; name: string }) => t(DASHBOARD_ACTIVITY_LABEL_KEYS[activity.id] || activity.name);
  const translateActivityCategory = (category: string) => t(DASHBOARD_ACTIVITY_CATEGORY_KEYS[category] || category);
  const { unreadCount } = useNotifications(user?.id);
  const { summary: weeklySummary, loading: weeklyLoading } = useWeeklySummary(user?.id);
  const { recommendations: smartRecommendations, loading: smartRecommendationsLoading } = useSmartRecommendations(user?.id);
  const { candidates: mealRecommendationCandidates } = useMealRecommendations();
  const activeTab: TabKey = location.pathname.endsWith("/nutrition")
    ? "nutrition"
    : location.pathname.endsWith("/activity")
      ? "activity"
      : location.pathname.endsWith("/progress")
        ? "progress"
        : "today";
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [progressKey, setProgressKey] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [selectedActivityId, setSelectedActivityId] = useState(INLINE_ACTIVITIES[0].id);
  const [activityDuration, setActivityDuration] = useState("30");
  const [activityCustomCal, setActivityCustomCal] = useState("");
  const [activityCategory, setActivityCategory] = useState("All");
  const [activitySearch, setActivitySearch] = useState("");
  const [activitySaving, setActivitySaving] = useState(false);
  const [workoutSessions, setWorkoutSessions] = useState<DashboardWorkoutSession[]>([]);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [totalActiveOrders, setTotalActiveOrders] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [topRestaurantsLoading, setTopRestaurantsLoading] = useState(true);
  const [topRestaurantsError, setTopRestaurantsError] = useState(false);
  const [todayMeals, setTodayMeals] = useState<TodayMeal[]>([]);
  const [todayMealsLoading, setTodayMealsLoading] = useState(true);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [activeMealSlide, setActiveMealSlide] = useState("breakfast");
  const [gamification, setGamification] = useState({ xp: 0, level: 1, xpToNextLevel: 100, earnedBadges: 0, totalBadges: 0, badges: [] as GamificationBadge[], earnedIds: new Set<string>() });
  const [waterToday, setWaterToday] = useState(0);
  const [waterGoal, setWaterGoal] = useState(2500);
  const [stepsToday, setStepsToday] = useState(0);
  const [stepsGoal, setStepsGoal] = useState(6000);
  const [hasActiveCoach, setHasActiveCoach] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [progressPreloaded, setProgressPreloaded] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<RecentNotification[]>([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const mealCarouselRef = useRef<HTMLDivElement>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<MealSchedule | null>(null);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ActiveOrder | null>(null);
  const [tick, setTick] = useState(0);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, progressKey);
  const { streaks } = useStreak(user?.id);
  const dailyStreak = streaks?.logging?.currentStreak ?? 0;
  const { latestUnlock, dismissLatestUnlock } = useBadgeChecker(user?.id);
  const todayStr = selectedDate.toISOString().split("T")[0];
  const selectedActivity = INLINE_ACTIVITIES.find((activity) => activity.id === selectedActivityId) ?? INLINE_ACTIVITIES[0];
  const activityMinutes = parseInt(activityDuration, 10) || 0;
  const activityWeightKg = profile?.current_weight_kg ?? 70;
  const estimatedActivityCal = Math.max(0, Math.round(selectedActivity.met * activityWeightKg * (activityMinutes / 60)));
  const customActivityCal = parseInt(activityCustomCal, 10) || 0;
  const loggedActivityCal = customActivityCal > 0 ? customActivityCal : estimatedActivityCal;
  const visibleActivities = INLINE_ACTIVITIES.filter((activity) => {
    const matchesCategory = activityCategory === "All" || activity.category === activityCategory;
    const matchesSearch = activity.name.toLowerCase().includes(activitySearch.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    if (!user?.id || progressPreloaded || activeTab === "progress") return;
    const preload = () => setProgressPreloaded(true);
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(preload, { timeout: 1800 })
      : window.setTimeout(preload, 900);

    return () => {
      if (idleWindow.cancelIdleCallback && typeof idleId === "number") {
        idleWindow.cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [activeTab, progressPreloaded, user?.id]);

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
    if (!user?.id) {
      setHasActiveCoach(false);
      return;
    }

    supabase
      .from("coach_client_assignments")
      .select("id")
      .eq("client_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to check active coach assignment:", error);
          setHasActiveCoach(false);
          return;
        }
        setHasActiveCoach(Boolean(data));
      });
  }, [user?.id]);

  const loadWorkoutSummary = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("id, workout_type, duration_minutes, calories_burned")
      .eq("user_id", user.id)
      .eq("session_date", todayStr)
      .order("created_at", { ascending: false });
    if (error) { console.error("Failed to load workout summary", error); return; }
    const sessions = (data ?? []) as DashboardWorkoutSession[];
    setWorkoutSessions(sessions);
    setTotalBurned(sessions.reduce((sum, session) => sum + (session.calories_burned ?? 0), 0));
    setWorkoutCount(sessions.length);
  }, [todayStr, user?.id]);

  const saveInlineActivity = async () => {
    if (!user?.id || !selectedActivity || activityMinutes <= 0 || activitySaving) return;
    setActivitySaving(true);
    try {
      const { error } = await supabase.from("workout_sessions").insert({
        user_id: user.id,
        session_date: todayStr,
        workout_type: selectedActivity.name,
        duration_minutes: activityMinutes,
        calories_burned: loggedActivityCal,
      });
      if (error) throw error;
      await loadWorkoutSummary();
      await syncWorkoutSessionsToHealthDailyMetrics(user.id, todayStr);
      await syncCommunityChallengeProgressQuietly(user.id);
      setActivityCustomCal("");
      toast.success(t("log_activity_success_title") || "Activity logged", {
        description: `${selectedActivity.name} - ${loggedActivityCal} ${t("cal_short")}`,
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
      toast.error(t("log_activity_failed_title") || "Could not log activity");
    } finally {
      setActivitySaving(false);
    }
  };

  const deleteInlineActivity = async (sessionId: string) => {
    if (!user?.id || deletingWorkoutId) return;
    setDeletingWorkoutId(sessionId);
    try {
      const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId).eq("user_id", user.id);
      if (error) throw error;
      await loadWorkoutSummary();
      await syncWorkoutSessionsToHealthDailyMetrics(user.id, todayStr);
      await syncCommunityChallengeProgressQuietly(user.id);
    } catch (error) {
      console.error("Failed to delete activity:", error);
      toast.error(t("log_activity_failed_title") || "Could not update activity");
    } finally {
      setDeletingWorkoutId(null);
    }
  };

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
          .from("profiles").select("xp, level").eq("user_id", user.id).single();
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
          xp: userXp, level: userLevel, xpToNextLevel: Math.max(100, userLevel * 100),
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
          .select("id, scheduled_date, order_status, meal_id, meal_type, delivery_type, delivery_time_slot, updated_at")
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
      const activeSchedules = (schedules ?? []) as unknown as Omit<ActiveScheduleRow, "meals">[];
      const mealIds = Array.from(new Set(activeSchedules.map((schedule) => schedule.meal_id).filter(Boolean)));
      const { data: mealsData, error: mealsError } = mealIds.length
        ? await supabase
          .from("meals")
          .select("id, name, restaurant_id")
          .in("id", mealIds)
        : { data: [], error: null };
      if (mealsError) throw mealsError;

      const mealsMap = new Map(
        ((mealsData ?? []) as NonNullable<ActiveScheduleRow["meals"]>[]).map((meal) => [meal.id, meal])
      );
      const restaurantIds = Array.from(new Set(
        Array.from(mealsMap.values()).map((meal) => meal.restaurant_id).filter(Boolean) as string[]
      ));
      const { data: restaurantsData, error: restaurantsError } = restaurantIds.length
        ? await supabase.from("restaurants").select("id, name").in("id", restaurantIds)
        : { data: [], error: null };
      if (restaurantsError) throw restaurantsError;

      const restaurantsMap = new Map(
        ((restaurantsData ?? []) as RestaurantSummary[]).map((restaurant) => [restaurant.id, restaurant])
      );
      const orders: ActiveOrder[] = activeSchedules
        .map((schedule) => {
          const meal = mealsMap.get(schedule.meal_id);
          const restaurant = restaurantsMap.get(meal?.restaurant_id || "");
          return {
            id: schedule.id, order_status: schedule.order_status,
            scheduled_date: schedule.scheduled_date, meal_id: schedule.meal_id,
            meal_type: schedule.meal_type || null,
            meal_name: meal?.name || "Meal",
            restaurant_name: restaurant?.name || "Restaurant",
            delivery_type: schedule.delivery_type || "pickup",
            delivery_time_slot: schedule.delivery_time_slot || null,
            updated_at: schedule.updated_at,
          };
        });
      setActiveOrders(orders);
    } catch (err) {
      console.error("Error fetching active orders:", err);
      setActiveOrders([]);
      setTotalActiveOrders(0);
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchActiveOrders(); }, [fetchActiveOrders]);

  const handleCancelOrder = async (scheduleId: string) => {
    setCancellingId(scheduleId);
    try {
      const { error } = await supabase.rpc("cancel_meal_schedule", { p_schedule_id: scheduleId, p_reason: null });
      if (error) throw error;
      setActiveOrders((prev) => prev.filter((o) => o.id !== scheduleId));
      setCancelTarget(null);
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
      setTodayMealsLoading(true);
      const today = getQatarDay();
      const { data: schedules, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select("id, meal_type, meal_id, scheduled_date, delivery_time_slot, order_status, restaurant_id")
        .eq("user_id", user.id)
        .eq("scheduled_date", today)
        .neq("order_status", "cancelled")
        .order("meal_type")
        .order("created_at", { ascending: false });
      if (schedulesError) throw schedulesError;

      const todaySchedules = (schedules ?? []) as unknown as Array<
        Pick<TodayScheduleRow, "id" | "meal_type" | "meal_id" | "scheduled_date" | "delivery_time_slot" | "order_status" | "restaurant_id">
      >;
      const mealIds = Array.from(new Set(todaySchedules.map((s) => s.meal_id).filter(Boolean)));
      const { data: mealsData, error: mealsError } = mealIds.length
        ? await supabase
          .from("meals")
          .select("id, name, image_url, calories, protein_g, carbs_g, fat_g, restaurant_id")
          .in("id", mealIds)
        : { data: [], error: null };
      if (mealsError) throw mealsError;

      const mealsMap = new Map(
        ((mealsData ?? []) as NonNullable<TodayScheduleRow["meals"]>[]).map((meal) => [meal.id, meal])
      );
      const restaurantIds = Array.from(new Set([
        ...todaySchedules.map((s) => s.restaurant_id).filter(Boolean),
        ...Array.from(mealsMap.values()).map((meal) => meal.restaurant_id).filter(Boolean),
      ] as string[]));
      const { data: restaurantsData, error: restaurantsError } = restaurantIds.length
        ? await supabase.from("restaurants").select("id, name").in("id", restaurantIds)
        : { data: [], error: null };
      if (restaurantsError) throw restaurantsError;

      const restaurantsMap = new Map(
        ((restaurantsData ?? []) as RestaurantSummary[]).map((restaurant) => [restaurant.id, restaurant])
      );
      const slots: Record<string, TodayMeal[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
      todaySchedules.forEach((s) => {
        const group = normalizeDashboardMealType(s.meal_type);
        if (!group) return;
        if (slots[group].length === 0) {
          const meal = mealsMap.get(s.meal_id) || null;
          slots[group].push({
            schedule_id: s.id,
            meal_type: group,
            meal,
            restaurant: restaurantsMap.get(s.restaurant_id || meal?.restaurant_id || "") || null,
            delivery_time_slot: s.delivery_time_slot || null,
          });
        }
      });
      const mealList = Object.entries(slots).map(([type, items]) => ({ type, ...(items[0] || {}) }));
      setTodayMeals(mealList);
      const firstPlannedMeal = mealList.find((item) => item.meal && item.schedule_id);
      if (firstPlannedMeal) {
        setActiveMealSlide(firstPlannedMeal.type);
        setExpandedMeal(`${firstPlannedMeal.type}-${firstPlannedMeal.schedule_id}`);
      }
    } catch (err) {
      console.error("Error fetching today's meals:", err);
      setTodayMeals([]);
    } finally {
      setTodayMealsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchTodayMeals(); }, [fetchTodayMeals]);

  useEffect(() => {
    const plannedSlides = DASHBOARD_MEAL_SLIDE_ORDER
      .map((type) => todayMeals.find((meal) => meal.type === type && meal.meal && meal.schedule_id))
      .filter((meal): meal is TodayMeal & { schedule_id: string } => Boolean(meal));

    if (todayMealsLoading || plannedSlides.length <= 1) return;

    const intervalId = window.setInterval(() => {
      const currentIndex = Math.max(0, plannedSlides.findIndex((meal) => meal.type === activeMealSlide));
      const nextMeal = plannedSlides[(currentIndex + 1) % plannedSlides.length];
      const nextSlideIndex = DASHBOARD_MEAL_SLIDE_ORDER.indexOf(nextMeal.type);
      const carousel = mealCarouselRef.current;

      setActiveMealSlide(nextMeal.type);
      setExpandedMeal(`${nextMeal.type}-${nextMeal.schedule_id}`);

      if (carousel && nextSlideIndex >= 0) {
        carousel.scrollTo({
          left: carousel.clientWidth * nextSlideIndex,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
      }
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, [activeMealSlide, prefersReducedMotion, todayMeals, todayMealsLoading]);

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
    loadWorkoutSummary();
  }, [loadWorkoutSummary]);

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
  useEffect(() => {
    const alertMetrics: HealthDailyMetrics | null = healthDailyMetrics
      ? {
          ...healthDailyMetrics,
          steps: Math.max(healthDailyMetrics.steps ?? 0, stepsToday),
          workouts_count: Math.max(healthDailyMetrics.workouts_count ?? 0, workoutCount),
          active_calories: Math.max(healthDailyMetrics.active_calories ?? 0, totalBurned),
        }
      : totalBurned > 0 || workoutCount > 0 || stepsToday > 0
        ? {
            metric_date: todayStr,
            steps: stepsToday,
            workouts_count: workoutCount,
            active_calories: totalBurned,
            resting_heart_rate: null,
            average_heart_rate: null,
            hrv: null,
            sleep_minutes: null,
            deep_sleep_minutes: null,
            rem_sleep_minutes: null,
            respiratory_rate: null,
            spo2: null,
            skin_temperature: null,
            source: "nutrio",
            synced_at: new Date().toISOString(),
          }
        : null;
    const alertReadiness = calculateRecoveryReadiness(alertMetrics);
    const alertLoad = calculateBodyLoad(alertMetrics);
    if (!user?.id || !alertReadiness.enoughData) return;
    const key = `nutrio_recovery_alert_${user.id}_${todayStr}`;
    if (localStorage.getItem(key)) return;

    if ((alertReadiness.score ?? 100) < 55 || alertLoad.score >= 17) {
      localStorage.setItem(key, "1");
      toast(t("recovery_alert_title"), {
        description: t((alertReadiness.score ?? 100) < 55 ? "recovery_alert_low_readiness" : "recovery_alert_high_load"),
      });
    }
  }, [healthDailyMetrics, stepsToday, t, todayStr, totalBurned, user?.id, workoutCount]);

  if (profileLoading && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F7F4] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#22C7A1]" />
        <p className="text-sm font-semibold text-slate-500">{t("loading")}</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────
  if (profileError && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F8FB] gap-4 px-6 py-9">
        <div className="w-full max-w-[360px] text-center space-y-4 rounded-[28px] bg-white p-7 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0F2] text-[#FB6B7A]">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">{t("dashboard_something_went_wrong")}</h2>
          <p className="text-sm text-slate-500">{t("profile_load_error")}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#020617] px-7 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(2,6,23,0.22)]"
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
  const dailyCalories = activeGoal?.daily_calorie_target || profile?.daily_calorie_target || 2066;
  const calConsumed = Math.round(todayProgress.calories);
  const calBurned = totalBurned;
  const netCalories = Math.max(0, calConsumed - calBurned);
  const calRemaining = Math.max(0, dailyCalories - netCalories);
  const consumedPct = Math.min((netCalories / (dailyCalories || 1)) * 100, 100);
  const overBudget = netCalories > dailyCalories;
  const ringColor = overBudget ? DASHBOARD_COLORS.fat : DASHBOARD_COLORS.calories;
  const ringRadius = 62;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (Math.min(consumedPct, 100) / 100) * ringCirc;
  const balancePct = isUnlimited ? 100 : Math.min((Number(balanceDisplay) / (Number(totalMealsDisplay) || 1)) * 100, 100);
  const completedThisWeek = dailyStreak;
  const waterPct = waterGoal > 0 ? Math.min((waterToday / waterGoal) * 100, 100) : 0;
  const stepsPct = stepsGoal > 0 ? Math.min((stepsToday / stepsGoal) * 100, 100) : 0;
  const dailyScore = Math.round((Math.min(consumedPct, 100) + waterPct + stepsPct + Math.min(balancePct, 100)) / 4);

  const rarityConfig: Record<string, { bg: string; border: string; gradient: string }> = {
    common: { bg: "bg-gray-50", border: "border-gray-200", gradient: "from-gray-400 to-gray-500" },
    rare: { bg: "bg-sky-50", border: "border-sky-200", gradient: "from-[#7DD3FC] to-[#38BDF8]" },
    epic: { bg: "bg-[#F3F4FF]", border: "border-[#7C83F6]/30", gradient: "from-[#A5B4FC] to-[#7C83F6]" },
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
      iconClass: "from-[#FFE5D0] to-[#F97316] text-white", dotClass: "bg-[#F97316]", pillClass: "bg-orange-50 text-orange-600",
      textClass: "text-orange-600", softClass: "bg-orange-50/70 ring-orange-100/80", trackClass: "bg-orange-100/70" },
    { label: t("protein_label"), value: Math.round(todayProgress.protein), target: proteinTarget, Icon: Drumstick,
      iconClass: "from-[#EEF2FF] to-[#7C83F6] text-white", dotClass: "bg-[#7C83F6]", pillClass: "bg-indigo-50 text-[#7C83F6]",
      textClass: "text-[#7C83F6]", softClass: "bg-indigo-50/70 ring-indigo-100/80", trackClass: "bg-indigo-100/70" },
    { label: t("fat_label"), value: Math.round(todayProgress.fat), target: fatTarget, Icon: FatIcon,
      iconClass: "from-[#FFE4E8] to-[#FB6B7A] text-white", dotClass: "bg-[#FB6B7A]", pillClass: "bg-rose-50 text-[#FB6B7A]",
      textClass: "text-[#FB6B7A]", softClass: "bg-rose-50/70 ring-rose-100/80", trackClass: "bg-rose-100/70" },
  ];

  const plannedMeals = todayMeals.filter((item) => item.meal);
  const nextMeal = plannedMeals[0];
  const proteinGap = Math.max(0, proteinTarget - todayProgress.protein);
  const carbsGap = Math.max(0, carbsTarget - todayProgress.carbs);
  const fatGap = Math.max(0, fatTarget - todayProgress.fat);
  const weeklyConsistency = weeklySummary?.consistency?.percentage ?? 0;
  const latestWeight = weightHistory?.findLast?.((entry) => entry.weight_kg != null)?.weight_kg;
  const dailyPct = dailyCalories > 0 ? Math.min(100, Math.round((calConsumed / dailyCalories) * 100)) : 0;
  const proteinPct = proteinTarget > 0 ? Math.min(100, Math.round((todayProgress.protein / proteinTarget) * 100)) : 0;
  const hydrationPct = Math.min(100, Math.round(waterPct));
  const weeklyLoggedDays = weeklySummary?.consistency?.daysLogged ?? 0;
  const weeklyConsistencyPct = weeklySummary?.consistency?.percentage ?? Math.round((weeklyLoggedDays / 7) * 100);
  const hasFoodLogged = calConsumed > 0 || todayProgress.protein > 0 || todayProgress.carbs > 0 || todayProgress.fat > 0;
  const hasGoalAlignmentData = hasFoodLogged || weeklyLoggedDays >= 3;
  const goalAlignmentScore = calculateGoalAlignmentScore({
    caloriePct: dailyPct,
    proteinPct: proteinTarget > 0 ? Math.round((todayProgress.protein / proteinTarget) * 100) : 0,
    consistencyPct: weeklyConsistencyPct,
  });
  const goalAlignmentLabel = hasGoalAlignmentData ? t(getGoalAlignmentLabelKey(goalAlignmentScore)) : t("goal_alignment_needs_tracking");
  const goalAlignmentDescription = hasGoalAlignmentData ? t("goal_alignment_desc") : t("goal_alignment_tracking_desc");
  const nutritionScore = Math.round((dailyPct * 0.38) + (proteinPct * 0.32) + (hydrationPct * 0.2) + (weeklyConsistencyPct * 0.1));
  const hasHydrationLogged = waterToday > 0 || hydrationPct > 0;
  const hasWeeklyContext = Boolean(weeklySummary) || weeklyLoggedDays > 0;
  const aiConfidence = hasFoodLogged && activeGoal
    ? 100
    : Math.min(100, Math.round(
        (hasFoodLogged ? 45 : 0) +
        (activeGoal ? 25 : 0) +
        (hasHydrationLogged ? 15 : 0) +
        (hasWeeklyContext ? 15 : 0)
      ));
  const missingConfidenceInputs = [
    !hasFoodLogged ? t("ai_need_log_meal") : null,
    !activeGoal ? t("ai_need_set_goal") : null,
    !hasHydrationLogged ? t("ai_need_add_water") : null,
    !hasWeeklyContext ? t("ai_need_track_week") : null,
  ].filter(Boolean);
  const confidenceExplanation = aiConfidence >= 100
    ? t("ai_confidence_high")
    : t("ai_confidence_needs", { items: missingConfidenceInputs.join(isRTL ? "، " : ", ") });
  const aiOverallScore = Math.round((nutritionScore + weeklyConsistencyPct + hydrationPct + Math.min(balancePct, 100)) / 4);
  const aiMealQualityStatus = aiOverallScore >= 80 ? t("ai_status_good") : aiOverallScore >= 60 ? t("ai_status_moderate") : t("ai_status_needs_work");
  const primarySmartRecommendation = smartRecommendations[0];
  const macroTotal = Math.max(1, todayProgress.protein + todayProgress.carbs + todayProgress.fat);
  const macroSplit = [
    { label: t("protein_label"), value: Math.round((todayProgress.protein / macroTotal) * 100), color: DASHBOARD_COLORS.protein, textClass: "text-[#7C83F6]" },
    { label: t("carbs"), value: Math.round((todayProgress.carbs / macroTotal) * 100), color: DASHBOARD_COLORS.carbs, textClass: "text-orange-600" },
    { label: t("fat_label"), value: Math.round((todayProgress.fat / macroTotal) * 100), color: DASHBOARD_COLORS.fat, textClass: "text-[#FB6B7A]" },
  ];
  const proteinSplit = macroSplit[0].value;
  const carbsSplit = macroSplit[1].value;
  const largestMacroGap = [
    { label: t("protein_label"), value: Math.round(proteinGap), color: "#7C83F6", bg: "bg-[#F3F4FF]", Icon: Drumstick },
    { label: t("carbs"), value: Math.round(carbsGap), color: "#38BDF8", bg: "bg-sky-50", Icon: Wheat },
    { label: t("fat_label"), value: Math.round(fatGap), color: "#FB6B7A", bg: "bg-[#FFF0F2]", Icon: FatIcon },
  ].sort((a, b) => b.value - a.value)[0];
  const dailyBalanceState = overBudget
    ? { label: "Over target", detail: `${Math.max(0, netCalories - dailyCalories)} ${t("cal_short")} above your daily target`, color: "#FB6B7A", bg: "bg-[#FFF0F2]" }
    : proteinGap > 20
      ? { label: "Needs protein", detail: `${Math.round(proteinGap)}g protein left to hit your goal`, color: "#7C83F6", bg: "bg-[#F3F4FF]" }
      : nutritionScore >= 80
        ? { label: "On track", detail: "Today's intake is aligned with your goal", color: "#22C7A1", bg: "bg-[#EFFFFA]" }
        : { label: "Needs balance", detail: `${largestMacroGap.value}g ${largestMacroGap.label.toLowerCase()} left`, color: largestMacroGap.color, bg: largestMacroGap.bg };
  const dailyBalanceMetrics = [
    { label: t("cal_short"), value: `${Math.round(consumedPct)}%`, width: Math.min(100, Math.round(consumedPct)), color: "#22C7A1" },
    { label: t("protein_label"), value: `${Math.round(todayProgress.protein)}/${proteinTarget}g`, width: proteinPct, color: "#7C83F6" },
    { label: t("water"), value: `${Math.round(waterPct)}%`, width: Math.round(waterPct), color: "#38BDF8" },
  ];
  const goalCalorieDelta = activeGoal?.goal_type === "muscle_gain" ? 200 : activeGoal?.goal_type === "maintenance" ? 0 : 300;
  const deficitValue = activeGoal?.goal_type === "muscle_gain" ? -goalCalorieDelta : goalCalorieDelta;
  const deficitLabel = deficitValue >= 0 ? t("deficit") : t("surplus");
  const deficitDisplay = `${deficitValue >= 0 ? "-" : "+"}${Math.abs(Math.round(deficitValue))}`;
  const nutrientGaps = [
    { label: t("fiber"), value: Math.min(25, Math.round(todayProgress.carbs * 0.08)), target: 25, textClass: "text-[#22C7A1]", bgClass: "bg-[#EFFFFA] ring-[#22C7A1]/20" },
    { label: t("sodium"), value: Math.min(2.3, Number((Math.max(0.7, animatedCalories / 1200)).toFixed(1))), target: 2.3, textClass: "text-[#38BDF8]", bgClass: "bg-[#EFF9FF] ring-[#38BDF8]/20", unit: "g" },
    { label: t("sugar"), value: Math.min(45, Math.round(todayProgress.carbs * 0.18)), target: 45, textClass: "text-[#FB6B7A]", bgClass: "bg-[#FFF0F2] ring-[#FB6B7A]/20" },
  ];
  const suggestedMealTitle = proteinGap > 20 ? t("grilled_chicken_bowl") : calRemaining < 300 ? t("light_salad_bowl") : t("balanced_power_bowl");
  const suggestedMealReason = t("protein_cal_budget", { protein: Math.round(proteinGap), calories: Math.max(0, calRemaining) });
  const suggestedMealCategory = calRemaining < 300 ? "snacks" : hourNow >= 17 ? "dinner" : hourNow >= 11 ? "lunch" : "breakfast";
  const suggestedMealQuery = proteinGap > 20 ? "protein" : calRemaining < 300 ? "light" : hourNow >= 17 ? "grill" : "healthy";
  const suggestedMealPath = `/meals?category=${suggestedMealCategory}&q=${encodeURIComponent(suggestedMealQuery)}&source=nutrition`;
  const smartMealImage = plannedMeals.find((item) => item.meal?.image_url)?.meal?.image_url || nextMeal?.meal?.image_url || null;
  const smartMealImageAlt = plannedMeals.find((item) => item.meal?.image_url)?.meal?.name || nextMeal?.meal?.name || suggestedMealTitle;
  const weeklyNutritionTrend = [72, 84, 66, 92, 78, 86, Math.max(18, Math.min(100, nutritionScore || dailyPct || 42))];
  const weeklyBest = Math.max(...weeklyNutritionTrend);
  const weeklyWorst = Math.min(...weeklyNutritionTrend);
  const weeklyCalorieTrend = weeklyNutritionTrend.map((value) => Math.round((value / 100) * dailyCalories));
  const weeklyCalorieMax = Math.max(dailyCalories, ...weeklyCalorieTrend, 1);
  const weeklySparklinePoints = weeklyCalorieTrend
    .map((value, index) => `${index * 34},${72 - (value / weeklyCalorieMax) * 56}`)
    .join(" ");
  const weeklyBestIndex = weeklyCalorieTrend.indexOf(Math.max(...weeklyCalorieTrend));
  const weeklyWorstIndex = weeklyCalorieTrend.indexOf(Math.min(...weeklyCalorieTrend));
  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const healthPlatformLabel = PLATFORM_LABELS[healthPlatform] || t("no_health_app_detected");
  const healthIsNativePlatform = healthPlatform !== "none";
  const healthNeedsPlugin = healthIsNativePlatform && !healthAvailable;
  const healthSyncOptions: Array<{ key: SyncDataType; label: string; Icon: LucideIcon }> = [
    { key: "steps", label: t("sync_steps"), Icon: Footprints },
    { key: "workouts", label: t("sync_workouts"), Icon: Dumbbell },
    { key: "heart_rate", label: t("sync_heart_rate"), Icon: Heart },
    { key: "sleep", label: t("sync_sleep"), Icon: Moon },
    { key: "recovery", label: t("sync_recovery"), Icon: Activity },
  ];
  const activityHealthMetrics: HealthDailyMetrics | null = healthDailyMetrics
    ? {
        ...healthDailyMetrics,
        steps: Math.max(healthDailyMetrics.steps ?? 0, stepsToday),
        workouts_count: Math.max(healthDailyMetrics.workouts_count ?? 0, workoutCount),
        active_calories: Math.max(healthDailyMetrics.active_calories ?? 0, totalBurned),
      }
    : totalBurned > 0 || workoutCount > 0 || stepsToday > 0
      ? {
          metric_date: new Date().toISOString().split("T")[0],
          steps: stepsToday,
          workouts_count: workoutCount,
          active_calories: totalBurned,
          resting_heart_rate: null,
          average_heart_rate: null,
          hrv: null,
          sleep_minutes: null,
          deep_sleep_minutes: null,
          rem_sleep_minutes: null,
          respiratory_rate: null,
          spo2: null,
          skin_temperature: null,
          source: "nutrio",
          synced_at: new Date().toISOString(),
        }
      : null;
  const hasMetricSignal = (metrics: HealthDailyMetrics | null | undefined) => Boolean(metrics && [
    metrics.steps,
    metrics.workouts_count,
    metrics.active_calories,
    metrics.resting_heart_rate,
    metrics.average_heart_rate,
    metrics.hrv,
    metrics.sleep_minutes,
    metrics.deep_sleep_minutes,
    metrics.rem_sleep_minutes,
    metrics.respiratory_rate,
    metrics.spo2,
    metrics.skin_temperature,
  ].some((value) => typeof value === "number" && value > 0));
  const hasReadinessData = hasMetricSignal(activityHealthMetrics) || healthRangeMetrics.some((metrics) => hasMetricSignal(metrics));
  const recoveryReadiness = calculateRecoveryReadiness(activityHealthMetrics);
  const bodyLoad = calculateBodyLoad(activityHealthMetrics);
  const nutritionPerformance = calculateNutritionPerformance({
    caloriesConsumed: todayProgress.calories,
    calorieTarget: dailyCalories,
    proteinConsumed: todayProgress.protein,
    proteinTarget: proteinTarget,
    carbsGap,
    carbsTarget,
    fatGap,
    fatTarget,
    waterPercent: waterPct,
    mealsLogged: todayMeals.filter((item) => Boolean(item.meal)).length,
    mealsPlanned: Math.max(3, plannedMeals.length),
    remainingCalories: calRemaining,
    proteinGap,
    bodyLoad,
    readiness: recoveryReadiness,
  });
  const nutritionMatchedMeal = findNutritionMatchedMeal(mealRecommendationCandidates, nutritionPerformance);
  const nutritionFocusVisuals = {
    protein: {
      Icon: Drumstick,
      iconClass: "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/20",
      fallbackClass: "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/20",
    },
    carbs: {
      Icon: Wheat,
      iconClass: "bg-[#FFF7ED] text-[#F97316] ring-[#FDBA74]/35",
      fallbackClass: "bg-[#FFF7ED] text-[#F97316] ring-[#FDBA74]/35",
    },
    hydration: {
      Icon: Droplets,
      iconClass: "bg-[#EFF9FF] text-[#38BDF8] ring-[#38BDF8]/20",
      fallbackClass: "bg-[#EFF9FF] text-[#38BDF8] ring-[#38BDF8]/20",
    },
    calories: {
      Icon: Flame,
      iconClass: "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FB6B7A]/20",
      fallbackClass: "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FB6B7A]/20",
    },
    balanced: {
      Icon: Apple,
      iconClass: "bg-[#ECFEFF] text-[#22C7A1] ring-[#22C7A1]/20",
      fallbackClass: "bg-[#ECFEFF] text-[#22C7A1] ring-[#22C7A1]/20",
    },
  } as const;
  const nutritionFocusVisual = nutritionFocusVisuals[nutritionPerformance.mealNeed.focus];
  const NutritionFocusIcon = nutritionFocusVisual.Icon;
  const readinessFoodTipKey = buildReadinessFoodTip(recoveryReadiness, bodyLoad);
  const readinessScoreDisplay = recoveryReadiness.score === null ? "--" : recoveryReadiness.score;
  const readinessTrend = healthRangeMetrics.map((item) => calculateRecoveryReadiness(item).score ?? 0);
  const readinessAverage = readinessTrend.length
    ? Math.round(readinessTrend.reduce((sum, score) => sum + score, 0) / readinessTrend.length)
    : null;
  const mealsLoggedToday = todayMeals.filter((item) => Boolean(item.meal)).length;

  const focusItems = [
    nextMeal
      ? { label: t("next_meal"), title: nextMeal.meal?.name || t("meal_ready"),
          detail: nextMeal.delivery_time_slot || nextMeal.restaurant?.name || t("review_todays_meal"),
          Icon: UtensilsCrossed, tone: "bg-orange-50 text-orange-600 ring-orange-100",
          action: () => navigate(nextMeal.meal?.id ? `/meals/${nextMeal.meal.id}` : "/meals") }
      : { label: t("meals"), title: t("plan_todays_meals"), detail: t("meal_slots_open"),
          Icon: ConciergeBell, tone: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
          action: () => navigate("/meals") },
    waterPct < 80
      ? { label: t("hydration"), title: t("ml_left", { amount: Math.max(0, waterGoal - waterToday) }), detail: t("close_water_ring"),
          Icon: Droplets, tone: "bg-sky-50 text-[#38BDF8] ring-[#38BDF8]/20",
          action: () => navigate("/tracker") }
      : { label: t("hydration"), title: t("water_on_track"), detail: t("water_logged_today", { amount: waterToday }),
          Icon: Droplets, tone: "bg-sky-50 text-[#38BDF8] ring-[#38BDF8]/20",
          action: () => navigate("/tracker") },
    proteinGap > 25
      ? { label: t("protein_label"), title: t("protein_gap", { amount: Math.round(proteinGap) }), detail: t("pick_high_protein_meal"),
          Icon: Drumstick, tone: "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/20",
          action: () => navigate("/meals") }
      : { label: t("movement"), title: workoutCount > 0 ? t("sessions_logged_count", { count: workoutCount }) : t("log_workout"),
          detail: workoutCount > 0 ? t("cal_burned", { amount: totalBurned }) : t("keep_activity_streak"),
          Icon: Activity, tone: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
          action: () => navigate("/tracker") },
  ];

  const coachInsights = [
    { label: t("ai_summary"),
      title: aiMealQualityStatus,
      detail: smartRecommendationsLoading
        ? t("generating_insight")
        : primarySmartRecommendation?.description || confidenceExplanation,
      Icon: Apple, tone: "bg-orange-50 text-orange-600 ring-orange-100" },
    { label: t("confidence"),
      title: t("confidence_percent", { percent: aiConfidence }),
      detail: confidenceExplanation,
      Icon: CheckCircle2, tone: "bg-slate-50 text-slate-700 ring-slate-200" },
    { label: t("top_action"),
      title: primarySmartRecommendation?.title || (proteinPct >= 80 ? t("protein_on_track") : t("improve_protein")),
      detail: primarySmartRecommendation?.action_text || (hydrationPct >= 60 ? t("keep_hydration_steady") : t("add_water_intake_today")),
      Icon: primarySmartRecommendation?.category === "hydration" ? Droplets : primarySmartRecommendation?.category === "activity" ? Activity : Drumstick,
      tone: primarySmartRecommendation?.priority === "high" ? "bg-orange-50 text-orange-700 ring-orange-100" : "bg-slate-50 text-slate-700 ring-slate-200" },
  ];
  const aiRecommendationItems = smartRecommendations.slice(0, 3);

  const showLegacyNutritionTab = false;
  const showLegacyProgressTab = false;

  const tabs: { key: TabKey; label: string; icon: LucideIcon; path: string }[] = [
    { key: "today", label: t("today"), icon: ConciergeBell, path: "/dashboard" },
    { key: "nutrition", label: t("nutrition"), icon: Apple, path: "/dashboard/nutrition" },
    { key: "activity", label: t("activity"), icon: Activity, path: "/dashboard/activity" },
    { key: "progress", label: t("progress"), icon: TrendingUp, path: "/dashboard/progress" },
  ];

  // ════════════════════════════════════════════════════════════════════
  //  RENDER — Bento Grid Dashboard
  // ════════════════════════════════════════════════════════════════════
  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      className="relative min-h-screen bg-[#F6F8FB] text-[#020617]"
      style={{ overflowX: "clip" }}
    >
      <DailyPerformanceSnapshotSync
        userId={user?.id}
        performance={nutritionPerformance}
        matchedMeal={nutritionMatchedMeal}
        readinessScore={recoveryReadiness.score}
        bodyLoad={bodyLoad.score}
        caloriesConsumed={todayProgress.calories}
        calorieTarget={dailyCalories}
        proteinConsumed={todayProgress.protein}
        proteinTarget={proteinTarget}
        waterPercent={waterPct}
        mealsLogged={mealsLoggedToday}
      />

      {/* Ambient gradient background */}
      <div className="absolute inset-0 pointer-events-none bg-[#F6F8FB]" />

      {/* ── Floating Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-white/70 bg-[#F6F8FB]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[480px] px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex h-[68px] items-center justify-between">
            <Link to="/profile" className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-slate-100/60 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.06)]">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={userName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[14px] font-bold text-[#22C7A1]">{userName.charAt(0)}</span>
                )}
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#22C7A1]">{timeGreeting}</p>
                <h1 className="text-[17px] font-black leading-none tracking-[-0.03em] text-[#020617]">{userName}</h1>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {/* Favorites */}
              <button
                type="button"
                data-testid="dashboard-favorites-btn"
                onClick={() => navigate("/favorites")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#FB6B7A] shadow-sm ring-1 ring-[#E5EAF1] transition active:scale-95"
                aria-label={t("favorites_label")}
              >
                <Heart className="h-5 w-5" strokeWidth={2.2} />
              </button>

              {/* Notifications */}
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  data-testid="dashboard-notifications-btn"
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1]"
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
                          <span className="rounded-full bg-[#FFF0F2] px-2 py-0.5 text-[10px] font-bold text-[#FB6B7A]">{displayedUnreadCount} new</span>
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
                              order_update: { icon: Truck, bg: "bg-[#EFFFFA]", iconColor: "text-[#22C7A1]" },
                              meal_reminder: { icon: Utensils, bg: "bg-[#FFF4E6]", iconColor: "text-orange-500" },
                              subscription_alert: { icon: Crown, bg: "bg-orange-50", iconColor: "text-orange-600" },
                              general: { icon: TrendingUp, bg: "bg-[#F6F8FB]", iconColor: "text-[#020617]" },
                              announcement: { icon: Bell, bg: "bg-amber-100", iconColor: "text-[#F59E0B]" },
                            } as Record<string, { icon: React.ElementType; bg: string; iconColor: string }>)[notif.type]) || { icon: Bell, bg: "bg-slate-100", iconColor: "text-slate-500" };
                            const IconComponent = cfg.icon;
                            const isUnread = notif.status === "unread";
                            return (
                              <button
                                key={notif.id}
                                type="button"
                                onClick={() => { setShowNotificationsDropdown(false); navigate("/notifications"); }}
                                className={`flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-[#F6F8FB] ${isUnread ? "bg-[#F3F4FF]/50" : ""}`}
                              >
                                <div className={`flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-xl ${cfg.bg} ${isUnread ? "ring-2 ring-[#7C83F6]/25" : ""}`}>
                                  <IconComponent className={`h-[18px] w-[18px] ${cfg.iconColor}`} strokeWidth={1.75} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className={`truncate text-[13px] font-semibold ${isUnread ? "text-slate-950" : "text-slate-700"}`}>{notif.title}</p>
                                    {isUnread && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#22C7A1]" />}
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
                        className="flex items-center justify-center gap-1.5 border-t border-slate-100/60 px-4 py-3 text-[13px] font-semibold text-[#22C7A1] transition hover:bg-[#F6F8FB]"
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
            {tabs.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                type="button"
                data-testid={`dashboard-tab-${key}`}
                onClick={() => navigate(path)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold transition-all ${
                  activeTab === key
                    ? "bg-[#020617] text-white shadow-[0_4px_12px_rgba(2,6,23,0.18)]"
                    : "bg-white/70 text-[#94A3B8] ring-1 ring-[#E5EAF1]"
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
      <main className="relative mx-auto max-w-[480px] px-4 pb-[72px] pt-3">

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
            <div>
              {/* Score tile — spans 2 */}
              <motion.div
                className="rounded-[24px] bg-white p-4 text-left shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7C83F6]">{dateLabel}</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">{t("progress_daily_score")}</p>
                    <p className="mt-0.5 text-[28px] font-black leading-none tracking-[-0.05em] text-[#020617]">
                      {dailyScore}<span className="text-[14px] font-bold text-[#94A3B8]">/100</span>
                    </p>
                    <p className="mt-1.5 text-[11px] font-semibold text-[#94A3B8]">{calRemaining} {t("cal_short")} {t("dashboard_remaining")}</p>
                  </div>
                  <div className="relative flex h-[72px] w-[72px] items-center justify-center">
                    <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#E5EAF1" strokeWidth="7" />
                      <motion.circle
                        cx="40" cy="40" r="34" fill="none" stroke={ringColor}
                        strokeWidth="7" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 34}
                        initial={prefersReducedMotion ? undefined : { strokeDashoffset: 2 * Math.PI * 34 }}
                        animate={{ strokeDashoffset: (2 * Math.PI * 34) - (Math.min(dailyScore, 100) / 100) * (2 * Math.PI * 34) }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </svg>
                    <span className="text-[20px] font-black text-[#020617]">{dailyScore}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {[
                    { label: t("cal_label_short"), value: `${animatedCalories}`, Icon: Flame, color: "text-[#22C7A1]" },
                    { label: t("meals_label_short"), value: `${animatedBalance}`, Icon: Crown, color: "text-[#FB6B7A]" },
                    { label: t("water_tracking_label"), value: `${Math.round(waterPct)}%`, Icon: Droplets, color: "text-[#38BDF8]", path: "/water-tracker" },
                    { label: t("steps_label_short"), value: `${stepsToday}`, Icon: Footprints, color: "text-[#7C83F6]" },
                  ].map(({ label, value, Icon, color, path }) => {
                    const content = (
                      <>
                        {path ? (
                          <ArrowUpRight className="absolute end-1.5 top-1.5 h-3 w-3 text-[#38BDF8]" strokeWidth={2.8} />
                        ) : null}
                        <Icon className={`mx-auto h-3.5 w-3.5 ${color}`} strokeWidth={2} />
                        <p className="mt-1 text-[11px] font-black leading-none text-[#020617]">{value}</p>
                        <p className={`mt-0.5 text-[8px] font-bold uppercase tracking-wider ${path ? "text-[#38BDF8]" : "text-[#94A3B8]"}`}>{label}</p>
                      </>
                    );

                    return path ? (
                      <button
                        key={label}
                        type="button"
                        onClick={() => navigate(path)}
                        className="relative rounded-xl bg-[#EFF9FF] px-1.5 py-2 text-center ring-1 ring-[#BAE6FD] transition active:scale-95"
                        aria-label={label}
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={label} className="rounded-xl bg-[#F6F8FB] px-1.5 py-2 text-center ring-1 ring-[#E5EAF1]/80">
                        {content}
                      </div>
                    );
                  })}
                </div>

              {/* Subscription tile — spans 1 */}
                <button
                  type="button"
                  data-testid="dashboard-subscription-card"
                  onClick={() => navigate("/subscription")}
                    className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-[16px] bg-[#F6F8FB] px-3 py-2.5 text-start ring-1 ring-[#E5EAF1] transition active:scale-[0.99]"
                  aria-label={t("open_subscription")}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF0F2] text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                      <Crown className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-black leading-tight text-[#020617]">{planName}</p>
                      <p className="text-[10px] font-bold text-[#94A3B8]">
                        {isUnlimited ? t("unlimited_meals") : t("meals_left_value", { count: balanceDisplay })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                    {t("manage")}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                  </div>
                </button>
              </motion.div>
            </div>

            {/* ── Quick Action Row ──────────────────────────────────── */}
            {activeGoal && (
              <button
                type="button"
                data-testid="dashboard-goal-card"
                onClick={() => navigate("/progress?tab=goals")}
                className="w-full rounded-[22px] border border-[#E5EAF1] bg-white p-4 text-start shadow-[0_10px_24px_rgba(2,6,23,0.05)] transition active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("goal_alignment")}</p>
                    <h2 className="mt-1 text-[17px] font-black leading-tight text-[#020617]">
                      {t(activeGoal.goal_type === "muscle_gain" ? "goal_muscle_gain" : activeGoal.goal_type === "maintenance" ? "goal_maintenance" : activeGoal.goal_type === "general_health" ? "goal_general_health" : "goal_weight_loss")}
                    </h2>
                    <p className="mt-1 text-[11px] font-bold leading-relaxed text-[#64748B]">{goalAlignmentDescription}</p>
                  </div>
                  <div className={cn(
                    "shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] ring-1",
                    hasGoalAlignmentData
                      ? "bg-[#EEF2FF] text-[#7C83F6] ring-[#7C83F6]/20"
                      : "bg-[#F6F8FB] text-[#64748B] ring-[#E5EAF1]"
                  )}>
                    {goalAlignmentLabel}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="flex min-h-[54px] flex-col items-center justify-center rounded-2xl bg-[#F6F8FB] px-2 py-2 text-center ring-1 ring-[#E5EAF1]">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">{t("cal_label_short")}</p>
                    <p className="text-sm font-black text-[#22C7A1]">{activeGoal.daily_calorie_target}</p>
                  </div>
                  <div className="flex min-h-[54px] flex-col items-center justify-center rounded-2xl bg-[#F6F8FB] px-2 py-2 text-center ring-1 ring-[#E5EAF1]">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">{t("protein_label")}</p>
                    <p className="text-sm font-black text-[#7C83F6]">{activeGoal.protein_target_g}g</p>
                  </div>
                  <div className="flex min-h-[54px] flex-col items-center justify-center rounded-2xl bg-[#F6F8FB] px-2 py-2 text-center ring-1 ring-[#E5EAF1]">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#94A3B8]">{t("tracked")}</p>
                    <p className="truncate text-sm font-black text-[#020617]">{weeklyLoggedDays}/7</p>
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              data-testid="dashboard-nutrition-card"
              onClick={() => navigate(nutritionMatchedMeal ? `/meals/${nutritionMatchedMeal.id}` : nutritionPerformance.actionPath)}
              className="w-full overflow-hidden rounded-[24px] border border-[#E5EAF1] bg-white p-4 text-start shadow-[0_10px_24px_rgba(2,6,23,0.05)] transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Fuel readiness</p>
                  <h2 className="mt-1 text-[18px] font-black leading-tight text-[#020617]">{nutritionPerformance.label}</h2>
                  <p className="mt-1 text-[12px] font-bold leading-5 text-[#64748B]">{nutritionPerformance.summary}</p>
                </div>
                <div className={`flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[18px] ring-1 ${nutritionFocusVisual.iconClass}`}>
                  <NutritionFocusIcon className="h-5 w-5" strokeWidth={2.3} />
                </div>
              </div>
              <div className="mt-3 rounded-[18px] bg-[#F6F8FB] px-3 py-2.5 ring-1 ring-[#E5EAF1]">
                <p className="text-[11px] font-bold leading-5 text-[#64748B]">{nutritionPerformance.primaryReason}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {nutritionMatchedMeal?.image_url ? (
                    <img
                      src={nutritionMatchedMeal.image_url}
                      alt={nutritionMatchedMeal.name}
                      className="h-12 w-12 shrink-0 rounded-[16px] object-cover ring-1 ring-[#E5EAF1]"
                    />
                  ) : (
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] ring-1 ${nutritionFocusVisual.fallbackClass}`}>
                      <NutritionFocusIcon className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Smart next meal</p>
                    <p className="mt-0.5 truncate text-[12px] font-black text-[#020617]">
                      {nutritionMatchedMeal?.name || `${nutritionPerformance.mealNeed.protein}g protein / ${nutritionPerformance.mealNeed.calories} kcal budget`}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-bold text-[#64748B]">
                      {nutritionMatchedMeal?.matchReason || nutritionPerformance.primaryReason}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-[#020617] px-3 py-2 text-[11px] font-black text-white">
                  {nutritionMatchedMeal ? "View meal" : nutritionPerformance.actionLabel}
                </span>
              </div>
            </button>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: t("order"), testid: "dashboard-fab-order", Icon: ConciergeBell, action: () => navigate("/meals"), bg: "bg-[#22C7A1] text-white" },
                { label: t("log"), testid: "dashboard-fab-log", Icon: Plus, action: () => setLogMealOpen(true), bg: "bg-white text-slate-950 ring-1 ring-slate-200/80" },
                { label: "Coaches", testid: "dashboard-fab-coaches", Icon: Medal, action: () => navigate(hasActiveCoach ? "/coach-programs" : "/coaches"), bg: "bg-white text-slate-950 ring-1 ring-slate-200/80" },
                { label: t("community"), testid: "dashboard-fab-community", Icon: Users, action: () => navigate("/community"), bg: "bg-white text-slate-950 ring-1 ring-slate-200/80" },
              ].map(({ label, testid, Icon, action, bg }) => (
                <motion.button
                  key={label}
                  type="button"
                  data-testid={testid}
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
            {/* ── Today's Meals ─────────────────────────────────────── */}
            <div className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-600">{t("meals")}</p>
                  <h2 className="mt-0.5 text-[18px] font-black tracking-normal text-slate-950">{t("dashboard_today_meals")}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#EFFFFA] px-3 py-1.5 text-[11px] font-black text-[#22C7A1]">
                    {todayMeals.filter((meal) => meal.meal).length}/4
                  </span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                    <UtensilsCrossed className="h-4.5 w-4.5" strokeWidth={2} />
                  </div>
                </div>
              </div>

              <div className="mx-3 mb-3 rounded-[24px] bg-[#F6F8FB] p-1.5 ring-1 ring-[#E5EAF1]">
                {(() => {
                  const slots = [
                    { type: "breakfast", label: t("breakfast"), icon: Coffee, color: "from-[#FBBF24] to-[#F97316]", bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", accent: "bg-orange-500" },
                    { type: "lunch", label: t("lunch"), icon: Soup, color: "from-[#A7F3E5] to-[#22C7A1]", bg: "bg-[#EFFFFA]", text: "text-[#22C7A1]", ring: "ring-[#22C7A1]/20", accent: "bg-[#22C7A1]" },
                    { type: "dinner", label: t("dinner"), icon: UtensilsCrossed, color: "from-[#A5B4FC] to-[#7C83F6]", bg: "bg-[#F3F4FF]", text: "text-[#7C83F6]", ring: "ring-[#7C83F6]/20", accent: "bg-[#7C83F6]" },
                    { type: "snack", label: t("snack"), icon: Apple, color: "from-[#7DD3FC] to-[#38BDF8]", bg: "bg-sky-50", text: "text-[#38BDF8]", ring: "ring-[#38BDF8]/20", accent: "bg-[#38BDF8]" },
                  ];
                  if (todayMealsLoading) {
                    return (
                      <div className="flex overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="h-[92px] min-w-full max-w-full shrink-0 animate-pulse rounded-[24px] bg-slate-100" />
                        ))}
                      </div>
                    );
                  }
                  const hasAnyMeal = slots.some((s) => {
                    const m = todayMeals.find((tm) => tm.type === s.type);
                    return m && m.meal;
                  });
                  const activeSlideIndex = Math.max(0, slots.findIndex((slot) => slot.type === activeMealSlide));

                  if (!hasAnyMeal) {
                    return (
                      <Link to="/meals" className="block bg-[#F6F7F4] transition active:scale-[0.99]">
                        <div className="flex min-h-[72px] items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-[#E5EAF1]">
                          <div className="flex -space-x-2">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FBBF24] to-[#F97316] text-white ring-2 ring-white">
                              <Coffee className="h-[15px] w-[15px]" strokeWidth={1.75} />
                            </div>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A7F3E5] to-[#22C7A1] text-white ring-2 ring-white">
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
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white">
                            <Plus className="h-4 w-4" strokeWidth={2.5} />
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <>
                      <div
                        ref={mealCarouselRef}
                        className="flex snap-x snap-mandatory overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        onScroll={(event) => {
                          const { clientWidth, scrollLeft } = event.currentTarget;
                          if (!clientWidth) return;
                          const index = Math.min(slots.length - 1, Math.max(0, Math.round(Math.abs(scrollLeft) / clientWidth)));
                          setActiveMealSlide(slots[index]?.type || slots[0].type);
                        }}
                      >
                        {slots.map((slot) => {
                    const meal = todayMeals.find((m) => m.type === slot.type);
                    const hasMeal = meal && meal.meal;
                    const IconSlot = slot.icon;
                    const nutrition = meal?.meal;
                    const calories = nutrition?.calories || 0;
                    const protein = nutrition?.protein_g || 0;
                    const carbs = nutrition?.carbs_g || 0;
                    const fat = nutrition?.fat_g || 0;
                    const macroTotal = Math.max(1, protein + carbs + fat);
                    const proteinPct = Math.round((protein / macroTotal) * 100);
                    const carbsPct = Math.round((carbs / macroTotal) * 100);
                    const fatPct = Math.max(0, 100 - proteinPct - carbsPct);
                    return (
                      <div key={slot.type} className="min-w-full max-w-full shrink-0 snap-start">
                        <motion.div
                          whileTap={prefersReducedMotion ? undefined : { scale: hasMeal ? 0.98 : 1 }}
                          onClick={(event) => {
                            event.currentTarget.scrollIntoView({
                              behavior: prefersReducedMotion ? "auto" : "smooth",
                              block: "nearest",
                              inline: "start",
                            });
                            setActiveMealSlide(slot.type);
                            if (hasMeal) {
                              setExpandedMeal(`${slot.type}-${meal.schedule_id}`);
                            }
                          }}
                          className={`relative flex min-h-[92px] items-center gap-3.5 overflow-hidden rounded-[24px] bg-white p-3 ring-1 ring-white/80 transition active:scale-[0.99] ${hasMeal ? "cursor-pointer shadow-[0_8px_22px_rgba(15,23,42,0.045)]" : ""}`}
                        >
                          {hasMeal ? (
                            <>
                              {meal.meal?.image_url ? (
                                <div className="relative h-[68px] w-[68px] shrink-0">
                                  <img src={meal.meal.image_url} alt={meal.meal.name} className="h-full w-full rounded-[22px] object-cover shadow-sm ring-1 ring-slate-100" />
                                  <span className={`absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${slot.color} text-white ring-2 ring-white`}>
                                    <IconSlot className="h-[14px] w-[14px]" strokeWidth={2} />
                                  </span>
                                </div>
                              ) : (
                                <div className={`flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br ${slot.color} text-white shadow-sm ring-1 ring-white`}>
                                  <IconSlot className="h-[22px] w-[22px]" strokeWidth={1.8} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`h-1.5 w-1.5 rounded-full ${slot.accent}`} />
                                  <p className={`truncate text-[10px] font-black uppercase tracking-[0.1em] ${slot.text}`}>{slot.label}</p>
                                </div>
                                <p className="mt-1 truncate text-[16px] font-black leading-tight text-[#020617]">{meal.meal?.name || slot.label}</p>
                                <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] font-bold text-[#64748B]">
                                  {meal.restaurant?.name && <span className="truncate">{meal.restaurant.name}</span>}
                                  {meal.meal?.calories && <><span className="text-slate-300">·</span><span>{meal.meal.calories} cal</span></>}
                                  {meal.delivery_time_slot && <><span className="text-slate-300">·</span><span>{meal.delivery_time_slot}</span></>}
                                </p>
                              </div>
                              <div className="flex h-9 w-9 shrink-0 rotate-90 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
                                <NextIcon className="h-3 w-3" strokeWidth={2} />
                              </div>
                            </>
                          ) : (
                            <>
                              <div className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[19px] ${slot.bg} ${slot.text} ring-1 ${slot.ring}`}>
                                <IconSlot className="h-[20px] w-[20px]" strokeWidth={1.8} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[13px] font-black ${slot.text}`}>{slot.label}</p>
                                <p className="mt-0.5 text-[11px] font-bold text-[#94A3B8]">{t("dashboard_no_meal_planned")}</p>
                              </div>
                              <Link to="/meals" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[10px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-95">
                                <Plus className="h-3 w-3" strokeWidth={2.5} />Order Now
                              </Link>
                            </>
                          )}
                        </motion.div>
                        {hasMeal && (
                          <div className="overflow-hidden">
                              <div className="mx-1 mb-2 mt-2.5 rounded-[28px] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Nutrition</p>
                                    <h3 className="mt-1 text-[22px] font-black leading-none tracking-[-0.03em] text-[#020617]">Nutrition profile</h3>
                                    <p className="mt-1 text-[12px] font-bold text-[#64748B]">Calories, macros and fiber</p>
                                  </div>
                                  <span className="rounded-full bg-[#F1F5F9] px-3 py-2 text-[11px] font-black text-[#64748B]">per meal</span>
                                </div>

                                <div className="mt-4 flex items-center gap-4">
                                  <div className="relative flex h-[118px] w-[118px] shrink-0 items-center justify-center rounded-full"
                                    style={{
                                      background: `conic-gradient(#7C83F6 0 ${proteinPct}%, #38BDF8 ${proteinPct}% ${proteinPct + carbsPct}%, #FB6B7A ${proteinPct + carbsPct}% 100%)`,
                                    }}
                                  >
                                    <div className="absolute inset-[10px] rounded-full bg-[#E2E8F0]" />
                                    <div className="absolute inset-[20px] rounded-full bg-white" />
                                    <div className="relative text-center">
                                      <Flame className="mx-auto h-4 w-4 text-[#FB6B7A]" strokeWidth={2} />
                                      <p className="mt-1 text-[25px] font-black leading-none tracking-[-0.04em] text-[#020617]">{calories}</p>
                                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#94A3B8]">{t("cal_short")}</p>
                                    </div>
                                  </div>

                                  <div className="min-w-0 flex-1 space-y-3">
                                    <div className="flex items-center gap-2.5">
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/15">
                                        <Drumstick className="h-4 w-4" strokeWidth={1.8} />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-[13px] font-black text-[#020617]">{t("dashboard_protein")}</p>
                                          <p className="text-[12px] font-black text-[#64748B]">{proteinPct}%</p>
                                        </div>
                                        <p className="text-[12px] font-black text-[#94A3B8]">{protein}g of {macroTotal}g</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-50 text-[#38BDF8] ring-1 ring-[#38BDF8]/15">
                                        <Wheat className="h-4 w-4" strokeWidth={1.8} />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-[13px] font-black text-[#020617]">{t("dashboard_carbs")}</p>
                                          <p className="text-[12px] font-black text-[#64748B]">{carbsPct}%</p>
                                        </div>
                                        <p className="text-[12px] font-black text-[#94A3B8]">{carbs}g of {macroTotal}g</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF0F2] text-[#FB6B7A] ring-1 ring-[#FB6B7A]/15">
                                        <FatIcon className="h-4 w-4" strokeWidth={1.8} />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-[13px] font-black text-[#020617]">{t("fat_short")}</p>
                                          <p className="text-[12px] font-black text-[#64748B]">{fatPct}%</p>
                                        </div>
                                        <p className="text-[12px] font-black text-[#94A3B8]">{fat}g of {macroTotal}g</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                                  <div className="h-full bg-[#7C83F6]" style={{ width: `${proteinPct}%` }} />
                                  <div className="h-full bg-[#38BDF8]" style={{ width: `${carbsPct}%` }} />
                                  <div className="h-full bg-[#FB6B7A]" style={{ width: `${fatPct}%` }} />
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  <div className="flex items-center gap-2 rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#7C83F6] ring-1 ring-[#E5EAF1]">
                                      <Drumstick className="h-4 w-4" strokeWidth={1.8} />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Macros</p>
                                      <p className="truncate text-[15px] font-black text-[#020617]">{macroTotal}g total</p>
                                    </div>
                                  </div>
                                  <Link to={`/meals/${meal.meal?.id}`} className="flex items-center gap-2 rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1] transition active:scale-[0.98]">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#22C7A1] ring-1 ring-[#E5EAF1]">
                                      <Leaf className="h-4 w-4" strokeWidth={1.8} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Details</p>
                                      <p className="truncate text-[15px] font-black text-[#020617]">View meal</p>
                                    </div>
                                  </Link>
                                </div>
                              </div>
                          </div>
                        )}
                        </div>
                      );
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-1.5" aria-hidden="true">
                        {slots.map((slot, index) => (
                          <span
                            key={`${slot.type}-swipe-dot`}
                            className={`h-2 w-2 rounded-full transition-all duration-300 ease-out ${
                              index === activeSlideIndex ? "scale-110 bg-[#020617]" : "bg-[#CBD5E1]"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* ── Subscription Nudge ────────────────────────────────── */}
            <SubscriptionNudge />

            {/* ── Active Orders ─────────────────────────────────────── */}
            {activeOrders.length > 0 && (
              <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#020617] text-white shadow-[0_4px_12px_rgba(2,6,23,0.18)]">
                      <ShoppingBag className="h-4.5 w-4.5" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#22C7A1]">{t("orders")}</p>
                      <h2 className="mt-0.5 text-[16px] font-black tracking-[-0.03em] text-slate-950">{t("active_orders")}</h2>
                      <p className="text-[11px] font-semibold text-slate-400">{t("orders_in_progress_full", { count: String(totalActiveOrders), plural: totalActiveOrders !== 1 ? "s" : "", show: String(activeOrders.length) })}</p>
                    </div>
                  </div>
                  <Link to="/orders?tab=scheduled" className="flex items-center gap-1 rounded-full bg-[#020617] px-3 py-2 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(2,6,23,0.14)] transition active:scale-95">
                    {t("orders_section_view_all")}<NextIcon className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="mt-3 space-y-0 divide-y divide-slate-100">
                  {activeOrders.map((order) => {
                    const statusConfig: Record<string, { label: string; Icon: React.ElementType; badgeClass: string; iconBg: string; hint: string }> = {
                      pending: { label: t("order_status_pending"), Icon: Clock, badgeClass: "bg-orange-50 text-orange-700", iconBg: "bg-gradient-to-br from-[#FB923C] to-[#F97316]", hint: t("order_awaiting") },
                      confirmed: { label: t("order_status_confirmed"), Icon: CheckCircle2, badgeClass: "bg-[#EFFFFA] text-[#22C7A1]", iconBg: "bg-gradient-to-br from-[#A7F3E5] to-[#22C7A1]", hint: t("order_accepted") },
                      preparing: { label: t("order_status_preparing"), Icon: Flame, badgeClass: "bg-orange-50 text-orange-700", iconBg: "bg-gradient-to-br from-[#FB923C] to-[#F97316]", hint: t("order_cooking") },
                      ready: { label: t("order_status_ready"), Icon: Package, badgeClass: "bg-[#EFFFFA] text-[#22C7A1]", iconBg: "bg-gradient-to-br from-[#A7F3E5] to-[#22C7A1]", hint: t("order_ready_pickup") },
                      out_for_delivery: { label: t("order_status_on_the_way"), Icon: Bike, badgeClass: "bg-sky-50 text-[#38BDF8]", iconBg: "bg-gradient-to-br from-[#7DD3FC] to-[#38BDF8]", hint: t("order_on_the_way_hint") },
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
                              onClick={(e) => { e.preventDefault(); setCancelTarget(order); }}
                              disabled={cancellingId === order.id}
                              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#FFF0F2] py-2 text-[11px] font-black text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20 disabled:opacity-50">
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
            <div className="rounded-[28px] bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#22C7A1]">{t("daily_focus")}</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">{t("do_this_next")}</h2>
                </div>
                <div className="rounded-full bg-[#EFFFFA] px-2.5 py-1 text-[10px] font-bold text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                  {dailyScore}/100
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {focusItems.map(({ label, title, detail, Icon, tone, action }, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="flex min-h-[64px] w-full items-center gap-3 rounded-[18px] bg-slate-50 p-3 text-start ring-1 ring-slate-200/80 transition active:scale-[0.99]"
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

            <div className="rounded-[24px] bg-white p-3 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600">{t("ai_insight")}</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-normal text-slate-950">{t("todays_read")}</h2>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                  <Apple className="h-4.5 w-4.5" strokeWidth={2.1} />
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {coachInsights.slice(0, 1).map(({ label, title, detail, Icon, tone }) => (
                  <div key={label} className="rounded-[16px] bg-slate-50 p-2.5 ring-1 ring-slate-200/80">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ring-1 ${tone}`}>
                        <Icon className="h-4 w-4" strokeWidth={2.1} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{label}</p>
                        <p className="mt-0.5 text-[13px] font-black leading-tight tracking-[-0.02em] text-slate-950">{title}</p>
                        <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-slate-500">{detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  {coachInsights.slice(1).map(({ label, title, detail, Icon, tone }) => (
                    <div key={label} className="min-w-0 rounded-[16px] bg-slate-50 p-2.5 ring-1 ring-slate-200/80">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ring-1 ${tone}`}>
                          <Icon className="h-4 w-4" strokeWidth={2.1} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[8px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
                          <p className="truncate text-[12px] font-black leading-tight text-slate-950">{title}</p>
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[10px] font-semibold leading-snug text-slate-500">{detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              {(smartRecommendationsLoading || aiRecommendationItems.length > 0) && (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{t("next_best_actions")}</p>
                    <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">
                      {smartRecommendationsLoading ? "..." : aiRecommendationItems.length}
                    </span>
                  </div>
                  {smartRecommendationsLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map((item) => (
                        <div key={item} className="h-[44px] animate-pulse rounded-[14px] bg-slate-50 ring-1 ring-slate-100" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {aiRecommendationItems.map((rec) => {
                        const recIconMap: Record<string, LucideIcon> = {
                          nutrition: Apple,
                          hydration: Droplets,
                          activity: Activity,
                          sleep: Moon,
                          general: Star,
                          blood: AlertCircle,
                        };
                        const recToneMap: Record<string, string> = {
                          nutrition: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
                          hydration: "bg-sky-50 text-[#38BDF8] ring-[#38BDF8]/20",
                          activity: "bg-orange-50 text-[#F97316] ring-orange-100",
                          sleep: "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/20",
                          general: "bg-slate-50 text-slate-600 ring-slate-200",
                          blood: "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FB6B7A]/20",
                        };
                        const priorityTone = rec.priority === "high"
                          ? "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FB6B7A]/20"
                          : rec.priority === "medium"
                            ? "bg-[#FFF7ED] text-[#F97316] ring-[#F97316]/20"
                            : "bg-slate-50 text-slate-500 ring-slate-200";
                        const RecIcon = recIconMap[rec.category] || Star;
                        const progressPct = rec.progress ? Math.min(100, Math.round((rec.progress.value / rec.progress.max) * 100)) : null;
                        const accent = rec.priority === "high" ? "#FB6B7A" : rec.priority === "medium" ? "#F97316" : "#94A3B8";

                        return (
                          <button
                            key={rec.id}
                            type="button"
                            onClick={() => {
                              if (rec.action_link) navigate(rec.action_link);
                            }}
                            className="w-full rounded-[15px] bg-slate-50 p-2 text-start ring-1 ring-slate-200/80 transition active:scale-[0.99]"
                          >
                            <div className="flex items-start gap-2">
                              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ring-1 ${recToneMap[rec.category] || recToneMap.general}`}>
                                <RecIcon className="h-4 w-4" strokeWidth={2.1} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="min-w-0 flex-1 truncate text-[12px] font-black leading-tight text-slate-950">{rec.title}</p>
                                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ring-1 ${priorityTone}`}>
                                    {rec.priority === "high" ? t("priority_high") : rec.priority === "medium" ? t("priority_medium") : t("priority_low")}
                                  </span>
                                </div>
                                <p className="mt-0.5 line-clamp-1 text-[10px] font-semibold leading-snug text-slate-500">{rec.description}</p>
                                {rec.progress && progressPct !== null && (
                                  <div className="mt-1.5">
                                    <div className="mb-1 flex items-center justify-between text-[9px]">
                                      <span className="font-black text-slate-500" dir="ltr">{rec.progress.value}/{rec.progress.max} {rec.progress.unit}</span>
                                      <span className="font-black" style={{ color: accent }}>{progressPct}%</span>
                                    </div>
                                    <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                                      <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: accent }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                              <NextIcon className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2.4} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <Link to="/ai-report" className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#020617] px-4 text-[12px] font-black text-white shadow-[0_8px_20px_rgba(2,6,23,0.16)] transition active:scale-[0.98]">
                {t("open_ai_report")} <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]" dir="ltr">{aiOverallScore}/100</span> <NextIcon className="h-3.5 w-3.5" strokeWidth={2.4} />
              </Link>
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
            <section className="overflow-hidden rounded-[28px] bg-white text-[#020617] shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
              <div className="px-5 pb-5 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("nutrition")}</p>
                    <h2 className="mt-1 text-[20px] font-black leading-tight tracking-[-0.04em] text-slate-900">{t("nutrition_today")}</h2>
                    <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">
                      {t("nutrition_today_subtitle")}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                    <Apple className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-[132px_1fr] gap-4">
                  <div className="relative flex h-[132px] w-[132px] items-center justify-center rounded-[30px] bg-slate-50 ring-1 ring-slate-100">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
                      <circle cx="70" cy="70" r={ringRadius} fill="none" stroke="#E5EAF1" strokeWidth="8" />
                      <motion.circle
                        cx="70"
                        cy="70"
                        r={ringRadius}
                        fill="none"
                        stroke={overBudget ? DASHBOARD_COLORS.fat : DASHBOARD_COLORS.calories}
                        strokeLinecap="round"
                        strokeWidth="8"
                        strokeDasharray={ringCirc}
                        strokeDashoffset={ringOffset}
                        variants={progressRingVariants}
                        initial="hidden"
                        animate="visible"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[26px] font-black leading-none tracking-normal">{Math.max(0, calRemaining)}</span>
                      <span className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("cal_left")}</span>
                      <span className="mt-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">{Math.round(consumedPct)}%</span>
                    </div>
                  </div>

                  <div className="grid content-stretch gap-2">
                    {[
                      { label: t("target"), value: dailyCalories, suffix: t("cal_short"), labelClass: "text-[#22C7A1]", valueClass: "text-[#020617]" },
                      { label: t("eaten"), value: animatedCalories, suffix: t("cal_short"), labelClass: "text-[#F97316]", valueClass: "text-[#020617]" },
                      { label: t("water"), value: Math.round(waterPct), suffix: "%", labelClass: "text-[#38BDF8]", valueClass: "text-[#020617]" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[14px] bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
                        <p className={`text-[9px] font-black uppercase tracking-[0.12em] ${item.labelClass}`}>{item.label}</p>
                        <p className={`mt-1 text-[18px] font-black leading-none ${item.valueClass}`}>
                          {item.value}
                          <span className="ml-1 text-[10px] font-bold text-[#94A3B8]">{item.suffix}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </section>

            <section className="overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Goal forecast</p>
                  <h3 className="mt-0.5 text-[21px] font-black leading-tight text-[#020617]">Daily Balance</h3>
                  <p className="mt-1 text-[12px] font-bold text-[#64748B]">What your day still needs</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black", dailyBalanceState.bg)} style={{ color: dailyBalanceState.color }}>
                  {dailyBalanceState.label}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-[112px_1fr] gap-4">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-[28px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                    <circle cx="60" cy="60" r="48" fill="none" stroke="#E5EAF1" strokeWidth="10" />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r="48"
                      fill="none"
                      stroke={dailyBalanceState.color}
                      strokeLinecap="round"
                      strokeWidth="10"
                      strokeDasharray={301.59}
                      strokeDashoffset={301.59 - (Math.min(nutritionScore, 100) / 100) * 301.59}
                      variants={progressRingVariants}
                      initial="hidden"
                      animate="visible"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[28px] font-black leading-none tracking-[-0.04em] text-[#020617]">{nutritionScore}</span>
                    <span className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">score</span>
                  </div>
                </div>

                <div className="min-w-0 space-y-2.5">
                  <div className={cn("rounded-[20px] p-3 ring-1 ring-[#E5EAF1]", dailyBalanceState.bg)}>
                    <p className="text-[12px] font-black text-[#020617]">{dailyBalanceState.detail}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#64748B]">
                      {calRemaining > 0 ? `${calRemaining} ${t("cal_short")} left today` : overBudget ? "Keep the next meal light" : "Calories are fully used"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Meal coverage</p>
                      <p className="mt-1 text-[18px] font-black text-[#020617]">{plannedMeals.length}/4</p>
                    </div>
                    <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">Top gap</p>
                      <p className="mt-1 truncate text-[18px] font-black" style={{ color: largestMacroGap.color }}>{largestMacroGap.value}g</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {dailyBalanceMetrics.map((metric) => (
                  <div key={metric.label}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#64748B]">{metric.label}</p>
                      <p className="text-[12px] font-black text-[#020617]">{metric.value}</p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#EEF2F7]">
                      <div className="h-full rounded-full" style={{ width: `${metric.width}%`, backgroundColor: metric.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <section className="rounded-[28px] bg-white/70 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-white/80 backdrop-blur-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{t("macro_split")}</p>
                <div className="mt-3 flex justify-center">
                  <div
                    className="relative flex h-[112px] w-[112px] items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(${DASHBOARD_COLORS.protein} 0 ${proteinSplit}%, ${DASHBOARD_COLORS.carbs} ${proteinSplit}% ${proteinSplit + carbsSplit}%, ${DASHBOARD_COLORS.fat} ${proteinSplit + carbsSplit}% 100%)`,
                    }}
                  >
                    <div className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-white/95 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                      <span className="text-[20px] font-black text-slate-950">{nutritionScore}</span>
                      <span className="text-[9px] font-black uppercase text-slate-400">{t("score")}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {macroSplit.map((macro) => (
                    <div key={macro.label} className="flex items-center justify-between">
                      <span className={`text-[11px] font-black ${macro.textClass}`}>{macro.label}</span>
                      <span className="text-[11px] font-black text-slate-500">{macro.value}%</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#EFFFFA] to-transparent" />
                <div className={cn("relative flex items-start justify-between gap-3", isRTL && "flex-row-reverse")}>
                  <div className={cn("min-w-0", isRTL ? "text-right" : "text-left")}>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">
                      {deficitLabel}
                    </p>
                    <p className="mt-1 text-[11px] font-bold leading-4 text-[#64748B]">
                      {activeGoal?.goal_type === "muscle_gain" ? t("above_today_budget") : t("on_track_weight_goal")}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                    <TrendingUp className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                </div>

                <div className={cn("relative mt-4", isRTL ? "text-right" : "text-left")}>
                  <div className={cn("flex items-end gap-1.5", isRTL ? "justify-end" : "justify-start")}>
                    <p className="whitespace-nowrap text-[34px] font-black leading-none text-[#020617]" dir="ltr">{deficitDisplay}</p>
                    <p className="pb-1 text-[12px] font-black text-[#94A3B8]">{t("cal_short")}</p>
                  </div>
                  <div className="mt-4 rounded-full bg-[#EEF2F7] p-1">
                    <div
                      className="h-2 rounded-full bg-[#22C7A1]"
                      style={{ width: `${Math.min(100, Math.max(18, (Math.abs(deficitValue) / Math.max(1, goalCalorieDelta)) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className={cn("relative mt-3 flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                  <p className={cn("text-[10px] font-black leading-4 text-[#64748B]", isRTL ? "text-right" : "text-left")}>
                    {deficitValue >= 0 ? t("on_track_weight_goal") : t("above_today_budget")}
                  </p>
                </div>
              </section>
            </div>

            <section className="rounded-[28px] bg-white/70 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-white/80 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{t("nutrient_gaps")}</p>
                  <h3 className="mt-0.5 text-[18px] font-black leading-tight text-slate-950">{t("micros_to_watch")}</h3>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-500">{t("today")}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {nutrientGaps.map((gap) => (
                  <div key={gap.label} className="rounded-[18px] bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/80 backdrop-blur-xl">
                    <p className={`text-[10px] font-black uppercase tracking-[0.08em] ${gap.textClass}`}>{gap.label}</p>
                    <p className={`mt-2 text-[18px] font-black leading-none ${gap.textClass}`}>
                      {gap.value}<span className="text-[10px] text-slate-400">/{gap.target}{gap.unit || "g"}</span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-current" style={{ width: `${Math.min(100, Number(gap.value) / gap.target * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <motion.button
              type="button"
              onClick={() => navigate(suggestedMealPath)}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
              className="w-full rounded-[28px] bg-white/70 p-4 text-start shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-white/80 backdrop-blur-xl transition active:scale-[0.99]"
              aria-label={`Open matching meals for ${suggestedMealTitle}`}
            >
              <div className="flex items-center gap-3">
                {smartMealImage ? (
                  <img
                    src={smartMealImage}
                    alt={smartMealImageAlt}
                    className="h-16 w-16 shrink-0 rounded-[22px] object-cover shadow-[0_10px_24px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-orange-50 text-orange-700 ring-1 ring-orange-100">
                    <Drumstick className="h-7 w-7" strokeWidth={2.1} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-700">{t("smart_next_meal")}</p>
                  <h3 className="mt-0.5 truncate text-[18px] font-black leading-tight text-slate-950">{suggestedMealTitle}</h3>
                  <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-slate-500">{suggestedMealReason}</p>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white">
                  <NextIcon className="h-4 w-4" strokeWidth={2.4} />
                </div>
              </div>
            </motion.button>

            <section className="rounded-[28px] bg-white/70 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-white/80 backdrop-blur-xl">
              <div className="rounded-[22px] bg-white/72 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-200/80 backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[13px] font-black leading-none text-slate-950">{t("weekly_nutrition")}</h3>
                    <p className="mt-2 text-[9px] font-black text-slate-400">{t("calories")}</p>
                  </div>
                  <div className="space-y-2 text-right">
                    <div>
                      <p className="text-[9px] font-black text-[#22C7A1]">{t("best_day")}</p>
                      <p className="text-[10px] font-black text-slate-950">{weekDayLabels[weeklyBestIndex]}</p>
                      <p className="text-[9px] font-bold text-slate-400">{Math.max(...weeklyCalorieTrend).toLocaleString()} Cal</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-[#FB6B7A]">{t("worst_day")}</p>
                      <p className="text-[10px] font-black text-slate-950">{weekDayLabels[weeklyWorstIndex]}</p>
                      <p className="text-[9px] font-bold text-slate-400">{Math.min(...weeklyCalorieTrend).toLocaleString()} Cal</p>
                    </div>
                  </div>
                </div>

                <div className="mt-1 grid grid-cols-[34px_1fr] gap-2">
                  <div className="flex h-[116px] flex-col justify-between pb-5 pt-1 text-right">
                    {[dailyCalories, Math.round(dailyCalories * 0.67), Math.round(dailyCalories * 0.33), 0].map((label) => (
                      <span key={label} className="text-[8px] font-bold text-slate-400">{label.toLocaleString()}</span>
                    ))}
                  </div>
                  <div>
                    <svg viewBox="0 0 204 86" className="h-[102px] w-full overflow-visible" aria-hidden="true">
                      {[16, 34.5, 53, 72].map((y) => (
                        <line key={y} x1="0" x2="204" y1={y} y2={y} stroke="#CBD5E1" strokeDasharray="4 5" strokeWidth="1" opacity="0.75" />
                      ))}
                      <line
                        x1="0"
                        x2="204"
                        y1={72 - (dailyCalories / weeklyCalorieMax) * 56}
                        y2={72 - (dailyCalories / weeklyCalorieMax) * 56}
                        stroke="#94A3B8"
                        strokeDasharray="5 5"
                        strokeWidth="1.5"
                      />
                      <text x="156" y={Math.max(11, 68 - (dailyCalories / weeklyCalorieMax) * 56)} fill="#94A3B8" fontSize="7" fontWeight="800">
                        Goal {dailyCalories.toLocaleString()}
                      </text>
                      <polyline
                        points={weeklySparklinePoints}
                        fill="none"
                        stroke="#020617"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3.5"
                      />
                      {weeklyCalorieTrend.map((value, index) => (
                        <circle key={`${value}-${index}`} cx={index * 34} cy={72 - (value / weeklyCalorieMax) * 56} r="3" fill="#020617" />
                      ))}
                    </svg>
                    <div className="grid grid-cols-7 text-center">
                      {weekDayLabels.map((day) => (
                        <span key={day} className="text-[8px] font-black text-slate-400">{day}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {showLegacyNutritionTab && (<>
            {/* Calorie ring + macros */}
            <div className="rounded-[24px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#22C7A1]">{t("nutrition")}</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">{calRemaining} {t("cal_short")} left</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                  <Apple className="h-4.5 w-4.5" strokeWidth={2} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-[28px] bg-white ring-1 ring-[#E5EAF1]">
                  <svg className="relative h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
                    <circle cx="70" cy="70" r={ringRadius} fill="none" stroke={DASHBOARD_COLORS.track} strokeWidth="8" />
                    <motion.circle
                      cx="70" cy="70" r={ringRadius} fill="none" stroke={ringColor}
                      strokeLinecap="round" strokeWidth="8"
                      strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
                      style={{ filter: overBudget ? "drop-shadow(0 4px 8px rgba(251,107,122,0.22))" : "drop-shadow(0 4px 8px rgba(34,199,161,0.18))" }}
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
                    <div className="flex flex-1 items-center gap-1.5 rounded-[14px] bg-white px-3 py-2 ring-1 ring-[#22C7A1]/20">
                      <Utensils className="h-3 w-3 text-[#22C7A1] shrink-0" strokeWidth={2} />
                      <div>
                        <p className="text-[8px] font-semibold uppercase text-[#22C7A1] leading-none">{t("consumed")}</p>
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
                className="mt-3 flex min-h-[52px] w-full items-center gap-3 rounded-[20px] bg-[#020617] px-4 py-3 text-white shadow-[0_8px_20px_rgba(2,6,23,0.16)]"
              >
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Utensils className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[14px] font-black leading-tight text-white">{t("log_meal")}</p>
                  <p className="text-[10px] font-semibold text-white/75">{t("dashboard_tap_to_add")}</p>
                </div>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#020617]">
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                </div>
              </motion.button>
            </div>

            {/* Tracker: streak + water + steps */}
            <div className="rounded-[24px] bg-white px-4 pb-4 pt-3 shadow-[0_12px_35px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#22C7A1]">{t("tracker")}</p>
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

              <div className="mt-3 flex min-h-[52px] items-center rounded-[18px] bg-[#EFFFFA] px-3 ring-1 ring-[#22C7A1]/20">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-[#22C7A1]" />
                  <span className="whitespace-nowrap text-[11px] font-bold text-[#22C7A1]">{t("daily_streak")}</span>
                </div>
                <div className="mx-3 flex flex-1 items-center justify-between gap-1">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const isComplete = index < completedThisWeek;
                    const isTodayIdx = index === completedThisWeek;
                    return (
                      <div key={index}
                        className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                          isComplete ? "bg-[#22C7A1]" : isTodayIdx ? "bg-[#A7F3E5] ring-2 ring-[#22C7A1]/30" : "bg-[#E5EAF1]"
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
                  className="cursor-pointer rounded-[20px] bg-[#EFF9FF] p-3 ring-1 ring-[#38BDF8]/20"
                  onClick={() => navigate("/tracker")}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Droplets className="h-4 w-4 text-[#38BDF8]" strokeWidth={2} />
                    <p className="text-[10px] font-semibold text-slate-400">{t("water")}</p>
                  </div>
                  <p className="text-[20px] font-extrabold leading-none tracking-[-0.03em] text-slate-800">
                    {Math.round(waterToday / 240 * 10) / 10}<span className="ml-1 text-[12px] font-semibold text-slate-400">{t("cups")}</span>
                  </p>
                  <div className="mt-2 h-[4px] w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((waterToday / waterGoal) * 100, 100)}%` }} transition={{ duration: 0.5, ease: "easeOut" }} className="h-full rounded-full bg-[#38BDF8]" />
                  </div>
                </motion.div>
                <motion.div
                  initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
                  animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
                  className="cursor-pointer rounded-[20px] bg-orange-50 p-3 ring-1 ring-orange-100"
                  onClick={() => navigate("/tracker")}>
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
                if (weeklySummary && weeklySummary.consistency.percentage >= 85) badges.push({ emoji: "🎯", label: `${weeklySummary.consistency.percentage}% consistent this week`, color: "from-[#A7F3E5] to-[#22C7A1]" });
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
            </>)}

            {/* Macro gap suggestion */}
            {(() => {
              const protRemaining = Math.max(0, proteinTarget - todayProgress.protein);
              const carbsRemaining = Math.max(0, carbsTarget - todayProgress.carbs);
              const fatRemaining = Math.max(0, fatTarget - todayProgress.fat);
              const protPct = proteinTarget > 0 ? protRemaining / proteinTarget : 0;
              const carbsPct = carbsTarget > 0 ? carbsRemaining / carbsTarget : 0;
              const fatPct = fatTarget > 0 ? fatRemaining / fatTarget : 0;
              const gaps = [
                { label: "protein", pct: protPct, remaining: protRemaining, unit: "g", color: "text-[#7C83F6]", bg: "bg-[#F3F4FF]", icon: Drumstick, ring: "ring-[#7C83F6]/20" },
                { label: "carbs", pct: carbsPct, remaining: carbsRemaining, unit: "g", color: "text-orange-600", bg: "bg-orange-50", icon: Wheat, ring: "ring-orange-100" },
                { label: "fat", pct: fatPct, remaining: fatRemaining, unit: "g", color: "text-[#FB6B7A]", bg: "bg-[#FFF0F2]", icon: FatIcon, ring: "ring-[#FB6B7A]/20" },
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
            <section className="overflow-hidden rounded-[28px] bg-white text-[#020617] shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
              <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("activity")}</p>
                  <h2 className="mt-1 text-[20px] font-black leading-tight tracking-[-0.04em] text-slate-900">{t("move_log")}</h2>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">{t("move_log_subtitle")}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                  <Activity className="h-5 w-5" strokeWidth={2.4} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                <div className="bg-white px-5 py-4">
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{t("total_burned_label")}</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#020617]">{totalBurned}<span className="ml-1 text-[11px] font-bold text-[#64748B]">{t("cal_short")}</span></p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${Math.min(100, Math.max(8, totalBurned / 5))}%` }} />
                  </div>
                </div>
                <div className="bg-white px-5 py-4">
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{t("sessions")}</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.05em] text-[#020617]">{workoutCount}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#7C83F6]" style={{ width: `${Math.min(100, Math.max(8, workoutCount * 18))}%` }} />
                  </div>
                </div>
              </div>
            </section>

            {hasReadinessData && (
            <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("body_readiness")}</p>
                  <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-[#020617]">{t(recoveryReadiness.labelKey)}</h3>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">{t(recoveryReadiness.detailKey)}</p>
                </div>
                <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-[#020617] text-white ring-8 ring-[#F6F8FB]">
                  <div className="text-center">
                    <p className="text-[24px] font-black leading-none">{readinessScoreDisplay}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-white/70">{t("score")}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#94A3B8]">{t("body_load")}</span>
                    <Activity className="h-4 w-4 text-[#7C83F6]" strokeWidth={2.4} />
                  </div>
                  <p className="mt-2 text-[26px] font-black leading-none text-[#020617]">{bodyLoad.score}<span className="ml-1 text-[11px] font-black text-[#94A3B8]">/21</span></p>
                  <p className="mt-1 text-[11px] font-bold leading-4 text-[#64748B]">{t(bodyLoad.labelKey)}</p>
                </div>
                <div className="rounded-[22px] bg-[#EFFFFA] p-3 ring-1 ring-[#22C7A1]/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-[#22C7A1]">{t("food_tip")}</span>
                    <Utensils className="h-4 w-4 text-[#22C7A1]" strokeWidth={2.4} />
                  </div>
                  <p className="mt-2 text-[12px] font-black leading-5 text-[#020617]">{t(readinessFoodTipKey)}</p>
                </div>
              </div>

              <div className="mt-3 rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#94A3B8]">{t("readiness_7_day_trend")}</p>
                  <p className="text-[12px] font-black text-[#020617]">
                    {readinessAverage === null ? "--" : readinessAverage}
                    <span className="ml-1 text-[10px] font-black text-[#94A3B8]">{t("avg_readiness")}</span>
                  </p>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const score = readinessTrend[index] ?? 0;
                    const height = Math.max(16, Math.round((score / 100) * 46));
                    return (
                      <div key={`readiness-trend-${index}`} className="flex h-12 items-end justify-center rounded-xl bg-white px-1 ring-1 ring-[#E5EAF1]">
                        <div
                          className={cn("w-full rounded-full", score >= 80 ? "bg-[#22C7A1]" : score >= 60 ? "bg-[#7C83F6]" : score > 0 ? "bg-[#F97316]" : "bg-[#E5EAF1]")}
                          style={{ height }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
                <div
                  className="h-full rounded-full bg-[#22C7A1]"
                  style={{ width: `${Math.max(8, recoveryReadiness.score ?? 12)}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] font-semibold leading-5 text-[#94A3B8]">
                {t("readiness_data_sources")}
              </p>
              <button
                type="button"
                onClick={() => navigate("/recovery-insights")}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#020617] px-4 text-[12px] font-black text-white transition active:scale-[0.98]"
              >
                <Activity className="h-4 w-4" strokeWidth={2.4} />
                {t("open_recovery_insights")}
              </button>
            </section>
            )}

            {!hasReadinessData ? (
            <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("health_apps")}</p>
                  <h3 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[#020617]">{t("connect_activity_apps")}</h3>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">{t("connect_activity_apps_desc")}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                  {healthPlatform === "apple_health" ? <Apple className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                </div>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#94A3B8]">{t("health_app_detected")}</p>
                    <p className="mt-0.5 truncate text-sm font-black text-[#020617]">
                      {healthIsNativePlatform ? healthPlatformLabel : t("no_health_app_detected")}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black",
                    healthConnected
                      ? "bg-[#EFFFFA] text-[#22C7A1]"
                      : healthNeedsPlugin
                        ? "bg-[#FFF7ED] text-[#F97316]"
                        : "bg-white text-[#94A3B8] ring-1 ring-[#E5EAF1]",
                  )}>
                    {healthConnected ? t("connected") : healthNeedsPlugin ? t("coming_soon") : t("not_connected")}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-semibold leading-5 text-[#64748B]">
                  {healthNeedsPlugin ? t("health_plugin_required") : t("health_sync_available_mobile")}
                </p>
              </div>

              <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {healthSyncOptions.map(({ key, label, Icon }) => {
                  const enabled = healthEnabledTypes.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleHealthDataType(key, !enabled)}
                      disabled={!user || !healthIsNativePlatform || healthNeedsPlugin}
                      className={cn(
                        "min-h-[70px] w-[92px] shrink-0 rounded-2xl p-2 text-center transition active:scale-[0.98] disabled:opacity-45",
                        enabled ? "bg-[#020617] text-white" : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]",
                      )}
                    >
                      <Icon className="mx-auto h-4.5 w-4.5" strokeWidth={2.2} />
                      <span className="mt-2 block text-[11px] font-black leading-tight">{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncHealthData()}
                  disabled={!healthConnected || healthSyncing}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#020617] px-3 text-[12px] font-black text-white transition active:scale-[0.98] disabled:opacity-45"
                >
                  <RefreshCw className={cn("h-4 w-4", healthSyncing && "animate-spin")} strokeWidth={2.3} />
                  {t("sync_now")}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#F6F8FB] px-3 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
                >
                  <ChevronRight className="h-4 w-4" strokeWidth={2.3} />
                  {t("open_health_settings")}
                </button>
              </div>
              <p className="mt-3 text-center text-[10px] font-bold text-[#94A3B8]">
                {t("last_synced")}: {lastSyncTimestamp ? formatLastSync() : t("never_synced")}
              </p>
            </section>
            ) : (
            <section className="rounded-[24px] bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                    {healthPlatform === "apple_health" ? <Apple className="h-4.5 w-4.5" /> : <Smartphone className="h-4.5 w-4.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("health_apps")}</p>
                    <p className="truncate text-[13px] font-black text-[#020617]">
                      {healthIsNativePlatform ? healthPlatformLabel : t("using_nutrio_activity_logs")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className="shrink-0 rounded-full bg-[#F6F8FB] px-3 py-2 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
                >
                  {t("manage")}
                </button>
              </div>
            </section>
            )}

            <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("log_activity")}</p>
                  <h3 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[#020617]">{t("choose_activity")}</h3>
                </div>
                <div className="rounded-full bg-[#EFFFFA] px-3 py-1 text-[11px] font-black text-[#22C7A1]">
                  {loggedActivityCal} {t("cal_short")}
                </div>
              </div>

              <div className="mt-4 flex min-h-[50px] items-center gap-3 rounded-[20px] bg-[#F6F8FB] px-4 ring-1 ring-[#E5EAF1] focus-within:ring-2 focus-within:ring-[#020617]">
                <Search className="h-4.5 w-4.5 shrink-0 text-[#94A3B8]" strokeWidth={2.2} />
                <input
                  type="search"
                  value={activitySearch}
                  onChange={(event) => setActivitySearch(event.target.value)}
                  placeholder={t("search_activities")}
                  className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-[#020617] outline-none placeholder:text-[#94A3B8]"
                />
              </div>

              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {ACTIVITY_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActivityCategory(category)}
                    className={`min-h-10 shrink-0 rounded-full px-4 text-[12px] font-black transition active:scale-[0.98] ${
                      activityCategory === category
                        ? "bg-[#020617] text-white shadow-[0_8px_18px_rgba(2,6,23,0.16)]"
                        : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                    }`}
                  >
                    {translateActivityCategory(category)}
                  </button>
                ))}
              </div>

              <div className="mt-4 max-h-[292px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {visibleActivities.map((activity) => {
                  const Icon = activity.Icon;
                  const selected = selectedActivity.id === activity.id;
                  const calPerHour = Math.round(activity.met * activityWeightKg);
                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => setSelectedActivityId(activity.id)}
                      className={`flex min-h-[68px] w-full items-center gap-3 rounded-[22px] px-3 text-start transition active:scale-[0.98] ${
                        selected
                          ? "bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.16)]"
                          : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] ${
                          selected ? "bg-white/12 text-white ring-1 ring-white/15" : "bg-white text-[#020617] ring-1 ring-[#E5EAF1]"
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={2.1} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[14px] font-black leading-tight ${selected ? "text-white" : "text-[#020617]"}`}>
                          {translateActivityName(activity)}
                        </span>
                        <span className={`mt-1 block truncate text-[11px] font-bold ${selected ? "text-white/55" : "text-slate-400"}`}>
                          {t("activity_burn_rate", { category: translateActivityCategory(activity.category), calories: calPerHour })}
                        </span>
                      </span>
                      <span
                        className={`flex h-8 min-w-[58px] items-center justify-center rounded-full px-2 text-[11px] font-black ${
                          selected ? "bg-white text-[#020617]" : "bg-white text-[#94A3B8] ring-1 ring-[#E5EAF1]"
                        }`}
                      >
                        {selected ? t("selected") : `${activity.met} MET`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {visibleActivities.length === 0 && (
                <div className="mt-4 rounded-[20px] bg-slate-50 p-4 text-center ring-1 ring-slate-200/80">
                  <p className="text-[13px] font-black text-[#020617]">{t("no_matching_activity")}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">{t("try_another_search_category")}</p>
                </div>
              )}

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7C83F6]">{t("duration")}</p>
                  <p className="text-[12px] font-extrabold text-[#020617]">{activityMinutes || 0} min</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_PRESETS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setActivityDuration(String(minutes))}
                      className={`min-h-11 rounded-full text-[13px] font-black transition active:scale-[0.98] ${
                        activityMinutes === minutes
                          ? "bg-[#020617] text-white shadow-[0_8px_18px_rgba(2,6,23,0.16)]"
                          : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                      }`}
                    >
                      {minutes}
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex min-h-[54px] items-center gap-3 rounded-[20px] bg-[#F6F8FB] px-4 ring-1 ring-[#E5EAF1] focus-within:ring-2 focus-within:ring-[#020617]">
                  <Clock className="h-5 w-5 shrink-0 text-[#020617]" strokeWidth={2.1} />
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={activityDuration}
                    onChange={(event) => setActivityDuration(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[20px] font-black text-[#020617] outline-none"
                    aria-label={t("activity_duration_aria")}
                  />
                  <span className="text-[12px] font-black uppercase tracking-wide text-slate-400">{t("min")}</span>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">{t("estimated_burn")}</p>
                    <p className="mt-1 text-[28px] font-black tracking-[-0.05em] text-[#020617]">{loggedActivityCal}<span className="ml-1 text-[12px] font-black text-[#94A3B8]">{t("cal_short")}</span></p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{t("based_on_weight_met", { weight: activityWeightKg, met: selectedActivity.met })}</p>
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EFFFFA] text-[#22C7A1]">
                    <Flame className="h-6 w-6" strokeWidth={2.1} />
                  </div>
                </div>
                <div className="mt-3 flex min-h-[46px] items-center gap-3 rounded-[17px] bg-white px-3 ring-1 ring-[#E5EAF1] focus-within:ring-2 focus-within:ring-[#020617]">
                  <Flame className="h-4.5 w-4.5 shrink-0 text-[#020617]" strokeWidth={2.1} />
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={activityCustomCal}
                    onChange={(event) => setActivityCustomCal(event.target.value)}
                    placeholder={`${estimatedActivityCal}`}
                    className="min-w-0 flex-1 bg-transparent text-[15px] font-black text-[#020617] outline-none placeholder:text-[#94A3B8]/60"
                    aria-label="Custom calories burned"
                  />
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t("custom_cal")}</span>
                </div>
              </div>

              <motion.button
                type="button"
                data-testid="log-activity-inline-button"
                onClick={saveInlineActivity}
                disabled={!user || activityMinutes <= 0 || activitySaving}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                className="mt-4 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#020617] text-[14px] font-black text-white shadow-[0_12px_24px_rgba(2,6,23,0.18)] transition disabled:opacity-45"
              >
                {activitySaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" strokeWidth={2.1} />}
                {t("log_activity")}
              </motion.button>
            </section>

            <section className="rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("today")}</p>
                  <h3 className="mt-1 text-[18px] font-black tracking-[-0.03em] text-[#020617]">{t("logged_sessions")}</h3>
                </div>
                <button
                  type="button"
                  onClick={loadWorkoutSummary}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]"
                  aria-label="Refresh sessions"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {workoutSessions.length > 0 ? workoutSessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-3 rounded-[20px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#020617] text-white">
                      <Activity className="h-4.5 w-4.5" strokeWidth={2.1} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black text-[#020617]">{session.workout_type}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                        {session.duration_minutes} min - {session.calories_burned} {t("cal_short")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteInlineActivity(session.id)}
                      disabled={deletingWorkoutId === session.id}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#FB6B7A] ring-1 ring-[#E5EAF1] transition active:scale-95 disabled:opacity-45"
                      aria-label="Delete activity session"
                    >
                      {deletingWorkoutId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={2.1} />}
                    </button>
                  </div>
                )) : (
                  <div className="rounded-[22px] bg-[#F6F8FB] p-5 text-center ring-1 ring-[#E5EAF1]">
                    <p className="text-[13px] font-black text-[#020617]">{t("no_sessions_yet")}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">{t("pick_activity_save_hint")}</p>
                  </div>
                )}
              </div>
            </section>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: PROGRESS — Weight, consistency, level, streak, badges
            ══════════════════════════════════════════════════════════════ */}
        {(activeTab === "progress" || progressPreloaded) && (
          <div className={activeTab === "progress" ? "block" : "hidden"} aria-hidden={activeTab !== "progress"}>
            <ProgressRedesigned embedded />
          </div>
        )}

        {showLegacyProgressTab && activeTab === "progress" && (
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#22C7A1]">{t("progress")}</p>
                  <h2 className="mt-0.5 text-[17px] font-black tracking-[-0.03em] text-slate-950">{t("goal_momentum")}</h2>
                </div>
                <button type="button" onClick={() => navigate("/progress")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#22C7A1] ring-1 ring-[#22C7A1]/20"
                  aria-label={t("progress_label")}>
                  <TrendingUp className="h-4.5 w-4.5" strokeWidth={2.2} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => navigate("/progress")} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("weight")}</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-slate-950">{latestWeight ? latestWeight.toFixed(1) : "--"}<span className="ml-1 text-[11px] font-bold text-slate-400">kg</span></p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{t("latest_body_log")}</p>
                </button>
                <button type="button" onClick={() => navigate("/progress")} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("consistency")}</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-[#22C7A1]">{weeklyLoading ? "--" : `${weeklyConsistency}%`}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{t("this_week")}</p>
                </button>
                <button type="button" onClick={() => setShowAchievements(!showAchievements)} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("level_label")}</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-[#7C83F6]">{gamification.level}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{gamification.earnedBadges}/{gamification.totalBadges} badges</p>
                </button>
                <button type="button" onClick={() => navigate("/tracker")} className="rounded-[18px] bg-white p-3 text-left ring-1 ring-slate-200/80">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">{t("streak")}</p>
                  <p className="mt-1 text-[20px] font-black tracking-[-0.05em] text-orange-600">{dailyStreak}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{t("logging_days")}</p>
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
              const trendColor = delta < 0 ? "text-[#22C7A1]" : delta > 0 ? "text-[#FB6B7A]" : "text-[#94A3B8]";
              const trendHex = delta < 0 ? "#22C7A1" : delta > 0 ? "#FB6B7A" : "#94A3B8";
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
                <div className="flex items-center gap-3 rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(124,131,246,0.08)] ring-1 ring-[#7C83F6]/20">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#A5B4FC] to-[#7C83F6] shadow-[0_4px_12px_rgba(124,131,246,0.18)]">
                    <Trophy className="h-5 w-5 text-white" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-extrabold tracking-[-0.01em] text-slate-950">{t("level_format", { level: String(gamification.level) })}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-[#7C83F6] truncate">
                      {gamification.earnedBadges > 0 ? t("badges_earned", { earned: String(gamification.earnedBadges), total: String(gamification.totalBadges) }) : t("start_earning_badges")}
                    </p>
                    <div className="mt-1.5 h-[4px] w-full overflow-hidden rounded-full bg-[#E5EAF1]">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(((gamification.xp % 100) / 100) * 100, 100)}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-[#A5B4FC] to-[#7C83F6]" />
                    </div>
                  </div>
                  <div className="flex shrink-0 -space-x-2">
                    {Array.from(gamification.earnedIds).slice(0, 3).reverse().map((badgeId: string) => {
                      const badge = gamification.badges.find((b) => b.id === badgeId);
                      const rarityGradient: Record<string, string> = { common: "from-gray-400 to-gray-500", rare: "from-[#7DD3FC] to-[#38BDF8]", epic: "from-[#A5B4FC] to-[#7C83F6]", legendary: "from-[#FBBF24] to-[#D97706]" };
                      const grad = rarityGradient[badge?.rarity || "common"] || rarityGradient.common;
                      return (
                        <div key={badgeId} className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${grad} shadow-[0_2px_6px_rgba(99,102,241,0.15)] ring-2 ring-white`}>
                          <Medal className="h-3.5 w-3.5 text-white" strokeWidth={2} />
                        </div>
                      );
                    })}
                    {gamification.earnedBadges === 0 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-2 ring-white">
                        <Trophy className="h-3.5 w-3.5 text-[#7C83F6]" strokeWidth={1.75} />
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
                    <div className="mx-1 mt-2 rounded-[22px] bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] ring-1 ring-[#E5EAF1]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-400 mb-3">{t("your_achievements")}</p>
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
      {selectedSchedule && (
        <ModifyOrderModal
          isOpen={showModifyModal}
          onClose={() => { setShowModifyModal(false); setSelectedSchedule(null); }}
          schedule={selectedSchedule}
          onModified={() => { fetchActiveOrders(); setShowModifyModal(false); setSelectedSchedule(null); }}
        />
      )}
      <RewardUnlockSheet unlock={latestUnlock} onOpenChange={(open) => { if (!open) dismissLatestUnlock(); }} />
      <AnimatePresence>
        {cancelTarget && (
          <>
            <motion.button
              type="button"
              aria-label="Close cancel confirmation"
              className="fixed inset-0 z-[1100] bg-[#020617]/40 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!cancellingId) setCancelTarget(null);
              }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-order-title"
              className="fixed inset-x-0 bottom-0 z-[1110] mx-auto max-h-[calc(100dvh-24px)] max-w-[430px] overflow-y-auto rounded-t-[32px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-3 shadow-[0_-18px_55px_rgba(2,6,23,0.22)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 340 }}
            >
              <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-slate-200" />
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0F2] text-[#FB6B7A]">
                  <XCircle className="h-6 w-6" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="cancel-order-title" className="text-[20px] font-black leading-tight text-[#020617]">
                    Cancel this order?
                  </h2>
                  <p className="mt-1 text-[13px] font-semibold leading-5 text-slate-500">
                    You can reorder anytime. This will remove it from your active orders.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] bg-[#F6F8FB] p-4 ring-1 ring-slate-200/80">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Order
                </p>
                <p className="mt-2 truncate text-[15px] font-black text-[#020617]">
                  {cancelTarget.meal_name}
                </p>
                <p className="mt-1 truncate text-[12px] font-bold text-slate-500">
                  {cancelTarget.restaurant_name}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="min-h-12 rounded-full bg-[#F6F8FB] px-4 text-[14px] font-black text-[#020617] ring-1 ring-slate-200 transition active:scale-[0.98] disabled:opacity-60"
                  disabled={Boolean(cancellingId)}
                  onClick={() => setCancelTarget(null)}
                >
                  Keep order
                </button>
                <button
                  type="button"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FB6B7A] px-4 text-[14px] font-black text-white shadow-[0_12px_28px_rgba(251,107,122,0.32)] transition active:scale-[0.98] disabled:opacity-70"
                  disabled={cancellingId === cancelTarget.id}
                  onClick={() => handleCancelOrder(cancelTarget.id)}
                >
                  {cancellingId === cancelTarget.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel order
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Dashboard;
