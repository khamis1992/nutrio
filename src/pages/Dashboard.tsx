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
  Beef,
  Bike,
  CheckCircle2,
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
  Medal,
  Moon,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  Soup,
  Trash2,
  TrendingUp,
  Trophy,
  Truck,
  Utensils,
  UtensilsCrossed,
  Heart,
  Users,
  Wheat,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Custom hand-drawn SVG icons for the Quick Actions cards.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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
import { SportHubActivityBridge } from "@/components/partners/SportHubActivityBridge";
import { SubscriptionNudge } from "@/components/SubscriptionNudge";
import { RewardUnlockSheet } from "@/components/rewards/RewardUnlockSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useHealthKitIntegration } from "@/hooks/useHealthKitIntegration";
import { useHealthDailyMetrics } from "@/hooks/useHealthDailyMetrics";
import { useHealthTrackingGoals } from "@/hooks/useHealthTrackingGoals";
import { calculateBodyLoad, calculateRecoveryReadiness, buildReadinessFoodTip, type HealthDailyMetrics } from "@/lib/health-readiness";
import { syncWorkoutSessionsToHealthDailyMetrics } from "@/lib/health-daily-metrics";
import { syncCommunityChallengeProgressQuietly } from "@/lib/community-challenge-service";
import { calculateNutritionPerformance, findNutritionMatchedMeal } from "@/lib/nutrition-performance";
import { selectPerformanceMeal } from "@/lib/daily-performance";
import { PLATFORM_LABELS, type SyncDataType } from "@/lib/healthKit";
import { useSubscription } from "@/hooks/useSubscription";
import { useWeeklySummary } from "@/hooks/useWeeklySummary";
import { useWeekdayData } from "@/hooks/useWeekdayData";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useSmartRecommendations } from "@/hooks/useSmartRecommendations";
import { useMealRecommendations } from "@/hooks/useMealRecommendations";
import { useDailyPerformanceDecision } from "@/hooks/useDailyPerformanceDecision";
import { DailyPerformanceSnapshotSync } from "@/hooks/useDailyPerformanceSnapshot";
import ProgressRedesigned from "@/pages/ProgressRedesigned";
import { getQatarNow, getQatarDay, formatLocaleDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useBadgeChecker } from "@/hooks/useBadgeChecker";
import { trackEvent } from "@/lib/analytics";
import { recordSportHubEvent } from "@/lib/partnerTracking";
import { staggerItem } from "@/lib/animations";

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
    fiber_g?: number | null;
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
  id: string;
  name: string;
  logo_url: string | null;
  rating: number | null;
  total_orders: number | null;
  description: string | null;
  cuisine_types: string[] | null;
}

interface RecentNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  created_at: string;
}

interface DashboardAiInsightSlide {
  id: string;
  title: string;
  detail: string;
}

interface DashboardAiInsightCardProps {
  slides: DashboardAiInsightSlide[];
  fallback: DashboardAiInsightSlide;
  prefersReducedMotion: boolean;
  ArrowIcon: LucideIcon;
  openLabel: string;
  onOpen: () => void;
}

const DashboardAiInsightCard = ({
  slides,
  fallback,
  prefersReducedMotion,
  ArrowIcon,
  openLabel,
  onOpen,
}: DashboardAiInsightCardProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const slideCount = slides.length;
  const activeInsight = slideCount ? slides[activeIndex % slideCount] : fallback;

  useEffect(() => {
    if (slideCount <= 1) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [slideCount]);

  useEffect(() => {
    if (activeIndex >= Math.max(slideCount, 1)) {
      setActiveIndex(0);
    }
  }, [activeIndex, slideCount]);

  return (
    <article className="relative overflow-hidden rounded-[28px] bg-[#171B52] p-4 text-white shadow-[0_18px_42px_rgba(23,27,82,0.24)] ring-1 ring-white/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_20%,rgba(138,143,255,0.55),transparent_30%),radial-gradient(circle_at_88%_50%,rgba(124,83,246,0.30),transparent_26%),linear-gradient(135deg,#101A34,#211E66)]" />
      <div className="relative flex min-h-[92px] items-center gap-3">
        <img
          src="/ai-insight-mascot-professional.svg"
          alt=""
          aria-hidden="true"
          className="h-[82px] w-[82px] shrink-0 object-contain drop-shadow-[0_14px_22px_rgba(86,84,214,0.28)]"
          draggable={false}
        />

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-[#20C7A5]">Today's Insight</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeInsight.id}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
              animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              <h2 className="mt-0.5 truncate text-[19px] font-black leading-tight tracking-[-0.03em] text-white">
                {activeInsight.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-5 text-white/78">
                {activeInsight.detail}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#6D5CF6] text-white shadow-[0_12px_24px_rgba(109,92,246,0.34)] ring-1 ring-white/20 transition active:scale-95"
          aria-label={openLabel}
        >
          <ArrowIcon className="h-5 w-5" strokeWidth={2.8} />
        </button>
      </div>
    </article>
  );
};

interface MealSchedule {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  created_at: string;
  order_status: string;
  meal_id: string;
}

interface DashboardWorkoutSession {
  id: string;
  workout_type: string;
  duration_minutes: number;
  calories_burned: number;
  created_at?: string;
  source: string | null;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   BENTO DASHBOARD â€” Level 6 Redesign
   New layout paradigm: bento grid canvas with tabbed sections,
   horizontal carousels, floating action button, and compact stat pills.
   Light mode. Emerald brand. Plus Jakarta Sans.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

type TabKey = "today" | "nutrition" | "activity" | "progress";

const INLINE_ACTIVITIES: Array<{ id: string; name: string; category: string; met: number; Icon: LucideIcon }> = [
  { id: "walking_moderate", name: "Walk", category: "Cardio", met: 3.5, Icon: Footprints },
  { id: "running_5mph", name: "Run", category: "Cardio", met: 8.3, Icon: Footprints },
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
  const { activeGoal, loading: goalsLoading, error: goalsError } = useNutritionGoals(user?.id);
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
  const {
    goals: healthTrackingGoals,
    loading: healthTrackingGoalsLoading,
    error: healthTrackingGoalsError,
  } = useHealthTrackingGoals(user?.id);
  const {
    remainingMeals,
    totalMeals,
    isUnlimited,
    loading: subscriptionLoading,
    error: subscriptionError,
    hasActiveSubscription,
  } = useSubscription();
  const {
    rolloverCredits,
    loading: rolloverLoading,
    error: rolloverError,
  } = useDashboardRolloverCredits(user?.id);
  const { t, language, isRTL } = useLanguage();
  useEffect(() => { document.title = `${t("dashboard_title")} - Nutrio`; }, [t]);
  const { NextIcon } = getNavArrows(isRTL);
  const sportHubCardViewKey = user?.id ? `nutrio:sporthub-card-viewed:${user.id}` : null;
  const translateActivityName = (activity: { id: string; name: string }) => t(DASHBOARD_ACTIVITY_LABEL_KEYS[activity.id] || activity.name);
  const { unreadCount } = useNotifications(user?.id);
  const { summary: weeklySummary, loading: weeklyLoading, error: weeklyError } = useWeeklySummary(user?.id);
  const { recommendations: smartRecommendations, loading: smartRecommendationsLoading } = useSmartRecommendations(user?.id);
  const {
    recommendations: safeMealRecommendations,
    ranking: mealRanking,
  } = useMealRecommendations();
  const dailyPerformanceDecision = useDailyPerformanceDecision();
  const performanceMatchedMeal = selectPerformanceMeal(
    mealRanking?.ranked ?? [],
    dailyPerformanceDecision.data,
  );
  useEffect(() => {
    if (!performanceMatchedMeal
      || dailyPerformanceDecision.data?.recommended_meal_id === performanceMatchedMeal.id
      || dailyPerformanceDecision.setRecommendedMeal.isPending) return;
    dailyPerformanceDecision.setRecommendedMeal.mutate(performanceMatchedMeal.id, {
      onError: (saveError) => console.error("Unable to persist performance meal:", saveError),
    });
  }, [
    dailyPerformanceDecision.data?.recommended_meal_id,
    dailyPerformanceDecision.setRecommendedMeal,
    performanceMatchedMeal,
  ]);
  const activeTab: TabKey = location.pathname.endsWith("/nutrition")
    ? "nutrition"
    : location.pathname.endsWith("/activity")
      ? "activity"
      : location.pathname.endsWith("/progress")
        ? "progress"
        : "today";
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [selectedDate] = useState(new Date());
  const [progressKey, setProgressKey] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [workoutLoading, setWorkoutLoading] = useState(true);
  const [workoutLoadError, setWorkoutLoadError] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState(INLINE_ACTIVITIES[0].id);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [activityDuration, setActivityDuration] = useState("30");
  const [activityCustomCal, setActivityCustomCal] = useState("");
  const [activitySaving, setActivitySaving] = useState(false);
  const openActivityLogger = useCallback((activityId: string) => {
    setSelectedActivityId(activityId);
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
    window.setTimeout(() => setActivityLogOpen(true), 0);
  }, []);
  const [workoutSessions, setWorkoutSessions] = useState<DashboardWorkoutSession[]>([]);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<string | null>(null);
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [totalActiveOrders, setTotalActiveOrders] = useState(0);
  const [, setOrdersLoading] = useState(true);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [topRestaurantsLoading, setTopRestaurantsLoading] = useState(true);
  const [topRestaurantsError, setTopRestaurantsError] = useState(false);
  const [todayMeals, setTodayMeals] = useState<TodayMeal[]>([]);
  const [todayMealsLoading, setTodayMealsLoading] = useState(true);
  const [todayMealsError, setTodayMealsError] = useState(false);
  const [, setExpandedMeal] = useState<string | null>(null);
  const [activeMealSlide, setActiveMealSlide] = useState("breakfast");
  const [waterToday, setWaterToday] = useState(0);
  const [waterEntriesLoading, setWaterEntriesLoading] = useState(true);
  const [waterEntriesLoadError, setWaterEntriesLoadError] = useState(false);
  const [stepsToday, setStepsToday] = useState(0);
  const waterGoal = healthTrackingGoals.waterGoalMl;
  const stepsGoal = healthTrackingGoals.stepGoal;
  const waterLoading = waterEntriesLoading || healthTrackingGoalsLoading;
  const waterLoadError = waterEntriesLoadError || Boolean(healthTrackingGoalsError);
  const [hasActiveCoach, setHasActiveCoach] = useState(false);
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
  const {
    todayProgress,
    loading: todayProgressLoading,
    error: todayProgressError,
  } = useTodayProgress(user?.id, selectedDate, progressKey);
  const configuredDailyCalorieTarget = Number(
    activeGoal?.daily_calorie_target ?? profile?.daily_calorie_target ?? 0
  );
  const {
    days: weekdayData,
    loading: weekdayDataLoading,
    error: weekdayDataError,
  } = useWeekdayData(user?.id, configuredDailyCalorieTarget);
  const { latestUnlock, dismissLatestUnlock } = useBadgeChecker(user?.id);
  const todayStr = getQatarDay(selectedDate);
  const selectedActivity = INLINE_ACTIVITIES.find((activity) => activity.id === selectedActivityId) ?? INLINE_ACTIVITIES[0];
  const SelectedActivityIcon = selectedActivity.Icon;
  const activityMinutes = parseInt(activityDuration, 10) || 0;
  const activityWeightKg = Number(profile?.current_weight_kg ?? 0);
  const hasActivityWeight = Number.isFinite(activityWeightKg) && activityWeightKg > 0;
  const estimatedActivityCal = hasActivityWeight
    ? Math.max(0, Math.round(selectedActivity.met * activityWeightKg * (activityMinutes / 60)))
    : 0;
  const customActivityCal = parseInt(activityCustomCal, 10) || 0;
  const loggedActivityCal = customActivityCal > 0 ? customActivityCal : estimatedActivityCal;
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
    if (!user?.id) {
      setWaterToday(0);
      setWaterEntriesLoading(false);
      setWaterEntriesLoadError(false);
      return;
    }
    let cancelled = false;
    setWaterEntriesLoading(true);
    setWaterEntriesLoadError(false);
    supabase
      .from("water_entries")
      .select("amount_ml")
      .eq("user_id", user.id)
      .eq("log_date", todayStr)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load today's water entries:", error);
          setWaterToday(0);
          setWaterEntriesLoadError(true);
        } else {
          setWaterToday((data ?? []).reduce((sum, e) => sum + (e.amount_ml || 0), 0));
        }
        setWaterEntriesLoading(false);
      });
    return () => { cancelled = true; };
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
    if (!user?.id) {
      setWorkoutLoading(false);
      setWorkoutLoadError(false);
      return;
    }
    setWorkoutLoading(true);
    setWorkoutLoadError(false);
    try {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id, workout_type, duration_minutes, calories_burned, created_at, source")
        .eq("user_id", user.id)
        .eq("session_date", todayStr)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const sessions = (data ?? []) as DashboardWorkoutSession[];
      setWorkoutSessions(sessions);
      setTotalBurned(sessions.reduce((sum, session) => sum + (session.calories_burned ?? 0), 0));
      setWorkoutCount(sessions.length);
    } catch (error) {
      console.error("Failed to load workout summary", error);
      setWorkoutSessions([]);
      setTotalBurned(0);
      setWorkoutCount(0);
      setWorkoutLoadError(true);
    } finally {
      setWorkoutLoading(false);
    }
  }, [todayStr, user?.id]);

  const saveInlineActivity = async () => {
    if (!user?.id || !selectedActivity || activityMinutes <= 0 || loggedActivityCal <= 0 || activitySaving) return;
    setActivitySaving(true);
    try {
      const { error } = await supabase.from("workout_sessions").insert({
        user_id: user.id,
        session_date: todayStr,
        workout_type: selectedActivity.name,
        duration_minutes: activityMinutes,
        calories_burned: loggedActivityCal,
        source: "manual",
        confirmed: true,
      });
      if (error) throw error;
      await loadWorkoutSummary();
      await syncWorkoutSessionsToHealthDailyMetrics(user.id, todayStr);
      await syncCommunityChallengeProgressQuietly(user.id);
      setActivityCustomCal("");
      setActivityLogOpen(false);
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
      const stepsRaw = localStorage.getItem(`tracker_steps_${user.id}_${todayStr}`);
      setStepsToday(stepsRaw ? parseInt(stepsRaw, 10) : 0);
    }
  }, [user?.id, todayStr]);

  const fetchActiveOrders = useCallback(async () => {
    if (!user?.id) return;
    try {
      const today = getQatarDay();
      const [{ data: schedules, error: schedulesError }, { count: totalCount, error: countError }] = await Promise.all([
        supabase
          .from("meal_schedules")
          .select("id, scheduled_date, order_status, meal_id, meal_type, delivery_type, delivery_time_slot, updated_at")
          .eq("user_id", user.id)
          .in("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery"])
          .gte("scheduled_date", today)
          .order("scheduled_date", { ascending: true })
          .limit(3),
        supabase
          .from("meal_schedules")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery"])
          .gte("scheduled_date", today),
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
          .from("public_meal_catalog" as "meals")
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
        ? await supabase.from("public_restaurant_catalog" as "restaurants").select("id, name").in("id", restaurantIds)
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
            meal_name: meal?.name || t("unknown_meal"),
            restaurant_name: restaurant?.name || t("unknown_restaurant"),
            delivery_type: schedule.delivery_type || null,
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
  }, [t, user?.id]);

  useEffect(() => { fetchActiveOrders(); }, [fetchActiveOrders]);

  useEffect(() => {
    if (!user?.id || !sportHubCardViewKey) return;
    if (sessionStorage.getItem(sportHubCardViewKey) === "true") return;

    sessionStorage.setItem(sportHubCardViewKey, "true");
    trackEvent("sporthub_card_viewed", {
      partner: "sporthub",
      campaign: "dashboard_card",
      referral_code: "NUTRIO15",
    });
    recordSportHubEvent({
      userId: user.id,
      campaign: "dashboard_card",
      eventType: "sporthub_card_viewed",
      metadata: {
        active_orders_count: activeOrders.length,
        workout_count: workoutCount,
      },
    });
  }, [activeOrders.length, sportHubCardViewKey, user?.id, workoutCount]);

  const handleCancelOrder = async (scheduleId: string) => {
    setCancellingId(scheduleId);
    try {
      const { error } = await supabase.rpc("cancel_meal_schedule", { p_schedule_id: scheduleId, p_reason: undefined });
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
      const restaurants = (featured || [])
        .map((listing) => listing.restaurants)
        .filter((restaurant): restaurant is TopRestaurant => restaurant !== null);
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
      setTodayMealsError(false);
      const { data: schedules, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select("id, meal_type, meal_id, scheduled_date, delivery_time_slot, order_status, restaurant_id")
        .eq("user_id", user.id)
        .eq("scheduled_date", todayStr)
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
          .from("public_meal_catalog" as "meals")
          .select("id, name, image_url, calories, protein_g, carbs_g, fat_g, fiber_g, restaurant_id")
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
        ? await supabase.from("public_restaurant_catalog" as "restaurants").select("id, name").in("id", restaurantIds)
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
            type: group,
            schedule_id: s.id,
            meal_type: group,
            meal,
            restaurant: restaurantsMap.get(s.restaurant_id || meal?.restaurant_id || "") || null,
            delivery_time_slot: s.delivery_time_slot || null,
          });
        }
      });
      const mealList = Object.entries(slots).map(([type, items]) => items[0] ?? { type });
      setTodayMeals(mealList);
      const firstPlannedMeal = mealList.find((item) => item.meal && item.schedule_id);
      if (firstPlannedMeal) {
        setActiveMealSlide(firstPlannedMeal.type);
        setExpandedMeal(`${firstPlannedMeal.type}-${firstPlannedMeal.schedule_id}`);
      }
    } catch (err) {
      console.error("Error fetching today's meals:", err);
      setTodayMeals([]);
      setTodayMealsError(true);
    } finally {
      setTodayMealsLoading(false);
    }
  }, [todayStr, user?.id]);

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
  const animatedBalance = useAnimatedCounter(
    isUnlimited || !hasActiveSubscription
      ? 0
      : Number.isFinite(remainingMeals + rolloverCredits)
        ? Number(remainingMeals + rolloverCredits)
        : 0,
    600
  );

  useEffect(() => {
    if (sessionStorage.getItem("nutrio_onboarding_done") === "true") return;
    if (profileLoading) return;
    if (profile && profile.onboarding_completed === false && !profile.health_goal) {
      navigate("/onboarding");
    }
  }, [profile, profileLoading, navigate]);

  useEffect(() => {
    const handler = () => setProgressKey((key) => key + 1);
    window.addEventListener("nutrio:meal-progress-changed", handler);
    return () => window.removeEventListener("nutrio:meal-progress-changed", handler);
  }, []);


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

  // â”€â”€ Loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Error state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Computed values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const mealBalanceLoading = subscriptionLoading || rolloverLoading;
  const mealBalanceError = Boolean(subscriptionError || rolloverError);
  const effectiveMealsLeft = isUnlimited
    ? Infinity
    : hasActiveSubscription
      ? remainingMeals + (rolloverCredits || 0)
      : 0;
  const balanceDisplay: number | string = mealBalanceLoading
    ? "..."
    : mealBalanceError
      ? "--"
      : isUnlimited
        ? t("unlimited_meals_short")
        : Number.isFinite(effectiveMealsLeft)
          ? Number(effectiveMealsLeft)
          : "--";
  const totalMealsDisplay = hasActiveSubscription && Number.isFinite(totalMeals) ? Number(totalMeals) : 0;
  const rawUserName = profile?.full_name?.trim()
    ? (profile.full_name.includes(" ") ? profile.full_name.split(" ")[0] : profile.full_name)
    : t("guest_greeting") || "Guest";
  const userName = rawUserName.charAt(0).toUpperCase() + rawUserName.slice(1).toLowerCase();
  const qatarNow = getQatarNow();
  const hourNow = qatarNow.getHours();
  const timeGreeting = hourNow < 12 ? t("good_morning") : hourNow < 18 ? t("good_afternoon") : t("good_evening");
  const dateLabel = formatLocaleDate(selectedDate, language, { weekday: "short", month: "short", day: "numeric" });
  const hasDailyCalorieTarget = Number.isFinite(configuredDailyCalorieTarget) && configuredDailyCalorieTarget > 0;
  const dailyCalories = hasDailyCalorieTarget ? configuredDailyCalorieTarget : 0;
  const calConsumed = Math.round(todayProgress.calories);
  const calBurned = totalBurned;
  const netCalories = Math.max(0, calConsumed - calBurned);
  const calRemaining = hasDailyCalorieTarget ? Math.max(0, dailyCalories - netCalories) : 0;
  const consumedPct = hasDailyCalorieTarget ? Math.min((netCalories / dailyCalories) * 100, 100) : 0;
  const overBudget = hasDailyCalorieTarget && netCalories > dailyCalories;
  const balancePct = !hasActiveSubscription
    ? 0
    : isUnlimited
      ? 100
      : totalMealsDisplay > 0
        ? Math.min((Number(effectiveMealsLeft) / totalMealsDisplay) * 100, 100)
        : 0;
  const waterPct = waterGoal > 0 ? Math.min((waterToday / waterGoal) * 100, 100) : 0;
  const stepsPct = stepsGoal > 0 ? Math.min((stepsToday / stepsGoal) * 100, 100) : 0;
  const scoreSignals = [
    hasDailyCalorieTarget && !todayProgressError && !workoutLoadError ? Math.min(consumedPct, 100) : null,
    !waterLoadError ? waterPct : null,
    Number.isFinite(stepsToday) ? stepsPct : null,
  ].filter((value): value is number => value !== null);
  const dailyScore = scoreSignals.length
    ? Math.round(scoreSignals.reduce((sum, value) => sum + value, 0) / scoreSignals.length)
    : 0;
  const hasTodayActivity = calConsumed > 0 || waterToday > 0 || stepsToday > 0 || workoutCount > 0;
  const dailyStatusLabel = todayProgressLoading || waterLoading || workoutLoading
    ? t("loading")
    : todayProgressError || waterLoadError || workoutLoadError
      ? t("no_data")
      : !hasTodayActivity
        ? t("goal_alignment_needs_tracking")
        : dailyScore >= 75
          ? t("progress_on_track")
          : t("goal_alignment_needs_tracking");
  const calorieRemainingLabel = todayProgressLoading || workoutLoading
    ? t("loading")
    : todayProgressError || workoutLoadError
      ? t("no_data")
      : goalsLoading
        ? t("loading")
        : goalsError
          ? t("no_data")
          : hasDailyCalorieTarget
            ? `${calRemaining} ${t("cal_short")} remaining`
            : t("progress_set_goal");
  const mealBalanceLabel = mealBalanceLoading
    ? t("loading_meal_balance")
    : mealBalanceError
      ? t("no_data")
      : !hasActiveSubscription
        ? t("no_active_subscription_yet")
        : isUnlimited
          ? t("unlimited_meals")
          : `${balanceDisplay} ${t("meals_left")}`;
  const caloriesMetricDisplay = todayProgressLoading ? "..." : todayProgressError ? "--" : String(animatedCalories);
  const mealMetricDisplay = mealBalanceLoading || mealBalanceError ? String(balanceDisplay) : isUnlimited ? "∞" : String(animatedBalance);
  const waterMetricDisplay = waterLoading ? "..." : waterLoadError ? "--" : `${Math.round(waterPct)}%`;
  const dailyScoreDisplay = todayProgressLoading || waterLoading || workoutLoading
    ? "..."
    : todayProgressError || waterLoadError || workoutLoadError
      ? "--"
      : String(Math.max(0, Math.min(10, Math.round(dailyScore / 10))));
  const dailyScorePercentDisplay = todayProgressLoading || waterLoading || workoutLoading
    ? "..."
    : todayProgressError || waterLoadError || workoutLoadError
      ? "--"
      : String(dailyScore);

  const displayedUnreadCount = unreadCount > 99 ? 99 : unreadCount;

  const configuredCarbsTarget = Number(activeGoal?.carbs_target_g ?? profile?.carbs_target_g ?? 0);
  const configuredProteinTarget = Number(activeGoal?.protein_target_g ?? profile?.protein_target_g ?? 0);
  const configuredFatTarget = Number(activeGoal?.fat_target_g ?? profile?.fat_target_g ?? 0);
  const carbsTarget = Number.isFinite(configuredCarbsTarget) && configuredCarbsTarget > 0 ? configuredCarbsTarget : 0;
  const proteinTarget = Number.isFinite(configuredProteinTarget) && configuredProteinTarget > 0 ? configuredProteinTarget : 0;
  const fatTarget = Number.isFinite(configuredFatTarget) && configuredFatTarget > 0 ? configuredFatTarget : 0;

  const plannedMeals = todayMeals.filter((item) => item.meal);
  const nextMeal = plannedMeals[0];
  const proteinGap = Math.max(0, proteinTarget - todayProgress.protein);
  const carbsGap = Math.max(0, carbsTarget - todayProgress.carbs);
  const fatGap = Math.max(0, fatTarget - todayProgress.fat);
  const dailyPct = dailyCalories > 0 ? Math.min(100, Math.round((calConsumed / dailyCalories) * 100)) : 0;
  const proteinPct = proteinTarget > 0 ? Math.min(100, Math.round((todayProgress.protein / proteinTarget) * 100)) : 0;
  const hydrationPct = Math.min(100, Math.round(waterPct));
  const weeklyLoggedDays = weeklySummary?.consistency?.daysLogged ?? 0;
  const weeklyConsistencyPct = weeklySummary?.consistency?.percentage ?? Math.round((weeklyLoggedDays / 7) * 100);
  const hasFoodLogged = calConsumed > 0 || todayProgress.protein > 0 || todayProgress.carbs > 0 || todayProgress.fat > 0;
  const nutritionScore = Math.round((dailyPct * 0.38) + (proteinPct * 0.32) + (hydrationPct * 0.2) + (weeklyConsistencyPct * 0.1));
  const hasNutritionScoreData = hasDailyCalorieTarget && proteinTarget > 0 && !todayProgressError && !waterLoadError && !workoutLoadError && !weeklyLoading && !weeklyError && !goalsLoading && !goalsError;
  const nutritionScoreDisplay = hasNutritionScoreData ? String(nutritionScore) : "--";
  const hasHydrationLogged = waterToday > 0 || hydrationPct > 0;
  const hasWeeklyContext = weeklyLoggedDays > 0;
  const aiConfidence = Math.min(100, Math.round(
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
    : t("ai_confidence_needs", { items: missingConfidenceInputs.join(isRTL ? "ØŒ " : ", ") });
  const aiOverallScore = Math.round((nutritionScore + weeklyConsistencyPct + hydrationPct + Math.min(balancePct, 100)) / 4);
  const aiMealQualityStatus = aiOverallScore >= 80 ? t("ai_status_good") : aiOverallScore >= 60 ? t("ai_status_moderate") : t("ai_status_needs_work");
  const primarySmartRecommendation = smartRecommendations[0];
  const macroTotal = Math.max(1, todayProgress.protein + todayProgress.carbs + todayProgress.fat);
  const macroSplit = [
    { label: t("protein_label"), value: Math.round((todayProgress.protein / macroTotal) * 100), color: DASHBOARD_COLORS.protein, textClass: "text-macro-protein" },
    { label: t("carbs"), value: Math.round((todayProgress.carbs / macroTotal) * 100), color: DASHBOARD_COLORS.carbs, textClass: "text-macro-carbs" },
    { label: t("fat_label"), value: Math.round((todayProgress.fat / macroTotal) * 100), color: DASHBOARD_COLORS.fat, textClass: "text-macro-fat" },
  ];
  const largestMacroGap = [
    { label: t("protein_label"), value: Math.round(proteinGap), color: "#7C83F6", bg: "bg-macro-protein-soft", Icon: Drumstick },
    { label: t("carbs"), value: Math.round(carbsGap), color: "#F97316", bg: "bg-macro-carbs-soft", Icon: Wheat },
    { label: t("fat_label"), value: Math.round(fatGap), color: "#FB6B7A", bg: "bg-macro-fat-soft", Icon: FatIcon },
  ].sort((a, b) => b.value - a.value)[0];
  const dailyBalanceState = !hasDailyCalorieTarget || proteinTarget <= 0
    ? { label: t("goal_alignment_needs_tracking"), detail: t("set_nutrition_goal_first"), color: "#64748B", bg: "bg-slate-50" }
    : overBudget
      ? { label: t("progress_over_target"), detail: t("cal_above_target", { count: Math.max(0, netCalories - dailyCalories) }), color: "#FB6B7A", bg: "bg-macro-fat-soft" }
      : proteinGap > 20
        ? { label: t("needs_protein"), detail: t("protein_left_to_goal", { grams: Math.round(proteinGap) }), color: "#7C83F6", bg: "bg-macro-protein-soft" }
        : nutritionScore >= 80
          ? { label: t("progress_on_track"), detail: t("intake_aligned"), color: "#22C7A1", bg: "bg-brand-soft" }
          : { label: t("needs_balance"), detail: t("macro_left", { grams: largestMacroGap.value, macro: largestMacroGap.label }), color: largestMacroGap.color, bg: largestMacroGap.bg };
  const dailyBalanceMetrics = [
    { label: t("cal_short"), value: hasDailyCalorieTarget ? `${Math.round(consumedPct)}%` : "--", width: hasDailyCalorieTarget ? Math.min(100, Math.round(consumedPct)) : 0, color: "#22C7A1" },
    { label: t("protein_label"), value: proteinTarget > 0 ? `${Math.round(todayProgress.protein)}/${proteinTarget}g` : "--", width: proteinTarget > 0 ? proteinPct : 0, color: "#7C83F6" },
    { label: t("water"), value: waterLoadError ? "--" : `${Math.round(waterPct)}%`, width: waterLoadError ? 0 : Math.round(waterPct), color: "#38BDF8" },
  ];
  const calorieBalanceValue = hasDailyCalorieTarget && !todayProgressError && !workoutLoadError ? netCalories - dailyCalories : null;
  const deficitDisplay = calorieBalanceValue === null
    ? "--"
    : `${calorieBalanceValue > 0 ? "+" : ""}${Math.round(calorieBalanceValue)}`;
  const fiberTargetValue = Number(activeGoal?.fiber_target_g ?? 0);
  const fiberTarget = Number.isFinite(fiberTargetValue) && fiberTargetValue > 0 ? fiberTargetValue : null;
  const nutrientGaps = [
    { label: t("fiber"), value: Math.round(todayProgress.fiber), target: fiberTarget, available: !todayProgressError && hasFoodLogged, textClass: "text-brand", bgClass: "bg-brand-soft ring-brand/20", unit: "g" },
    { label: t("sodium"), value: 0, target: null, available: false, textClass: "text-macro-water", bgClass: "bg-macro-water-soft ring-macro-water/20", unit: "g" },
    { label: t("sugar"), value: 0, target: null, available: false, textClass: "text-macro-fat", bgClass: "bg-macro-fat-soft ring-macro-fat/20", unit: "g" },
  ];
  const scheduledMealEntry = plannedMeals.find((item) => item.meal) || nextMeal || null;
  const scheduledMealSuggestion = performanceMatchedMeal;
  const suggestedMealTitle = scheduledMealSuggestion?.name || t("browse_meals_btn");
  const suggestedMealReason = scheduledMealSuggestion
    ? `${Math.round(scheduledMealSuggestion.calories || 0)} ${t("cal_short")} / ${Math.round(scheduledMealSuggestion.protein_g || 0)}g ${t("protein_label")}`
    : hasDailyCalorieTarget
      ? calorieRemainingLabel
      : t("set_goal_hint");
  const suggestedMealCategory = scheduledMealSuggestion?.meal_type
    || scheduledMealEntry?.type
    || (hourNow >= 17 ? "dinner" : hourNow >= 11 ? "lunch" : "breakfast");
  const suggestedMealPath = scheduledMealSuggestion?.id
    ? `/meals/${scheduledMealSuggestion.id}`
    : `/meals?category=${suggestedMealCategory}&source=nutrition`;
  const smartMealImage = scheduledMealSuggestion?.image_url || null;
  const smartMealImageAlt = scheduledMealSuggestion?.name || suggestedMealTitle;
  const weeklyCalorieTrend = weekdayData.length === 7
    ? weekdayData.map((day) => Math.max(0, Math.round(day.calories)))
    : [0, 0, 0, 0, 0, 0, 0];
  const weekDayLabels = weekdayData.length === 7
    ? weekdayData.map((day) => day.dayLabel)
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const loggedWeeklyCalories = weeklyCalorieTrend
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value > 0);
  const hasWeeklyNutritionData = loggedWeeklyCalories.length > 0;
  const weeklyCalorieMax = Math.max(dailyCalories, ...weeklyCalorieTrend, 1);
  const weeklySparklinePoints = weeklyCalorieTrend
    .map((value, index) => value > 0 ? `${index * 34},${72 - (value / weeklyCalorieMax) * 56}` : null)
    .filter((point): point is string => point !== null)
    .join(" ");
  const weeklyBestIndex = hasWeeklyNutritionData
    ? loggedWeeklyCalories.reduce((best, entry) => entry.value > best.value ? entry : best).index
    : -1;
  const weeklyWorstIndex = hasWeeklyNutritionData
    ? loggedWeeklyCalories.reduce((worst, entry) => entry.value < worst.value ? entry : worst).index
    : -1;
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
          metric_date: getQatarDay(),
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
  const nutritionPerformance = todayProgressError || waterLoadError || workoutLoadError || todayMealsError || goalsError
    ? {
        score: 0,
        label: t("no_data"),
        summary: t("ai_report_no_data"),
        primaryReason: t("ai_report_no_data"),
        reasons: [t("ai_report_no_data")],
        actionLabel: t("retry_button"),
        actionPath: "/dashboard",
        mealNeed: { protein: 0, calories: 0, query: "", category: "", focus: "balanced" as const },
      }
    : calculateNutritionPerformance({
        caloriesConsumed: todayProgress.calories,
        calorieTarget: dailyCalories,
        proteinConsumed: todayProgress.protein,
        proteinTarget,
        carbsGap,
        carbsTarget,
        fatGap,
        fatTarget,
        waterPercent: waterPct,
        mealsLogged: todayProgress.mealsLogged,
        mealsPlanned: plannedMeals.length,
        remainingCalories: calRemaining,
        proteinGap,
        bodyLoad,
        readiness: recoveryReadiness,
      });
  const mealRecommendationCandidates = safeMealRecommendations?.forYou ?? [];
  const nutritionMatchedMeal = findNutritionMatchedMeal(mealRecommendationCandidates, nutritionPerformance);
  const readinessFoodTipKey = buildReadinessFoodTip(recoveryReadiness, bodyLoad);
  const readinessScoreDisplay = recoveryReadiness.score === null ? "--" : recoveryReadiness.score;
  const readinessTrend = healthRangeMetrics.map((item) => calculateRecoveryReadiness(item).score ?? 0);
  const readinessAverage = readinessTrend.length
    ? Math.round(readinessTrend.reduce((sum, score) => sum + score, 0) / readinessTrend.length)
    : null;
  const mealsLoggedToday = todayProgress.mealsLogged;

  const focusItems = [
    todayMealsError
      ? { label: t("meals"), title: t("no_data"), detail: t("no_data_available"),
          Icon: ConciergeBell, tone: "bg-slate-50 text-slate-700 ring-slate-200",
          action: () => navigate("/meals") }
      : nextMeal
      ? { label: t("next_meal"), title: nextMeal.meal?.name || t("meal_ready"),
          detail: nextMeal.delivery_time_slot || nextMeal.restaurant?.name || t("review_todays_meal"),
          Icon: UtensilsCrossed, tone: "bg-orange-50 text-orange-600 ring-orange-100",
          action: () => navigate(nextMeal.meal?.id ? `/meals/${nextMeal.meal.id}` : "/meals") }
      : { label: t("meals"), title: t("plan_todays_meals"), detail: t("meal_slots_open"),
          Icon: ConciergeBell, tone: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
          action: () => navigate("/meals") },
    waterLoadError
      ? { label: t("hydration"), title: t("no_data"), detail: t("no_data_available"),
          Icon: Droplets, tone: "bg-sky-50 text-[#38BDF8] ring-[#38BDF8]/20",
          action: () => navigate("/tracker") }
      : waterPct < 80
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
      : workoutLoadError
        ? { label: t("movement"), title: t("no_data"), detail: t("no_data_available"),
            Icon: Activity, tone: "bg-slate-50 text-slate-700 ring-slate-200",
            action: () => navigate("/tracker") }
      : { label: t("movement"), title: workoutCount > 0 ? t("sessions_logged_count", { count: workoutCount }) : t("log_workout"),
          detail: workoutCount > 0 ? t("cal_burned", { amount: totalBurned }) : t("keep_activity_streak"),
          Icon: Activity, tone: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
          action: () => navigate("/tracker") },
  ];

  const dashboardInsightUnavailable = Boolean(todayProgressError || waterLoadError || workoutLoadError || todayMealsError || weeklyError || goalsError);
  const coachInsights = dashboardInsightUnavailable
    ? [{
        label: t("ai_summary"),
        title: t("no_data"),
        detail: t("ai_report_no_data"),
        Icon: AlertCircle,
        tone: "bg-slate-50 text-slate-700 ring-slate-200",
      }]
    : [
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
  const aiInsightSlides = [
    ...coachInsights.map((insight) => ({
      id: `coach-${insight.label}`,
      title: insight.title,
      detail: insight.detail,
    })),
    ...aiRecommendationItems.map((rec) => ({
      id: `rec-${rec.id}`,
      title: rec.title,
      detail: rec.description,
    })),
  ].filter((item) => item.title || item.detail);
  const fallbackAiInsight = {
    id: "ai-loading",
    title: t("generating_insight"),
    detail: confidenceExplanation,
  };

  const tabs: { key: TabKey; label: string; icon: LucideIcon; path: string }[] = [
    { key: "today", label: t("today"), icon: ConciergeBell, path: "/dashboard" },
    { key: "nutrition", label: t("nutrition"), icon: Apple, path: "/dashboard/nutrition" },
    { key: "activity", label: t("activity"), icon: Activity, path: "/dashboard/activity" },
    { key: "progress", label: t("progress"), icon: TrendingUp, path: "/dashboard/progress" },
  ];

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER â€” Bento Grid Dashboard
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      className="relative min-h-screen bg-[#F6F8FB] text-[#020617]"
      style={{ overflowX: "clip" }}
    >
      {!todayProgressError && !waterLoadError && !workoutLoadError && !todayMealsError && !goalsError && hasDailyCalorieTarget && proteinTarget > 0 && (
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
      )}

      {/* Ambient gradient background */}
      <div className="absolute inset-0 pointer-events-none bg-[#F6F8FB]" />

      {/* â”€â”€ Floating Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="sticky top-0 z-30 border-b border-[#E2E8F0]/50 bg-white/80 backdrop-blur-xl shadow-[0_2px_15px_rgba(0,0,0,0.02)]">
        <div className="mx-auto max-w-[430px] px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex h-[72px] items-center justify-between">
            <Link to="/profile" className="flex items-center gap-3 group">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-[#F8FAFC] shadow-[0_8px_20px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 group-hover:scale-105 transition-transform duration-300">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={userName} className="h-full w-full object-cover animate-fade-in" />
                ) : (
                  <span className="text-[15px] font-black text-[#22C7A1]">{userName.charAt(0)}</span>
                )}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#10B981]">{timeGreeting}</p>
                <h1 className="text-[18px] font-black leading-none tracking-tight text-slate-900 mt-1">{userName}</h1>
              </div>
            </Link>

            <div className="flex items-center gap-2.5">
              {/* Favorites */}
              <button
                type="button"
                data-testid="dashboard-favorites-btn"
                onClick={() => navigate("/favorites")}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#FB6B7A] border border-[#E2E8F0] shadow-sm hover:bg-[#FFF1F2] hover:border-[#FECDD3] transition-all duration-300 active:scale-95"
                aria-label={t("favorites_label")}
              >
                <Heart className="h-5 w-5 fill-current" strokeWidth={2.2} />
              </button>

              {/* Notifications */}
              <div ref={notificationRef} className="relative">
                <button
                  type="button"
                  data-testid="dashboard-notifications-btn"
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 border border-[#E2E8F0] shadow-sm hover:bg-slate-50 transition-all duration-300"
                  aria-label={t("Notifications")}
                >
                  <Bell className="h-5 w-5" strokeWidth={2.2} />
                  {displayedUnreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9px] font-black leading-none text-white ring-2 ring-white shadow-sm animate-pulse">
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

          {/* â”€â”€ Tab Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="mb-3 flex gap-1 rounded-full bg-[#F7F9FC] p-1 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ring-1 ring-[#EEF2F7]">
            {tabs.map(({ key, label, icon: Icon, path }) => (
              <button
                key={key}
                type="button"
                data-testid={`dashboard-tab-${key}`}
                onClick={() => navigate(path)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-extrabold transition-all duration-300 active:scale-95 shrink-0",
                  activeTab === key
                    ? "bg-[#101A34] text-white shadow-[0_10px_22px_rgba(16,26,52,0.22)]"
                    : "text-[#4F5870] hover:text-[#101A34]"
                )}
              >
                <Icon className={cn("h-4 w-4", activeTab === key ? "text-white" : "text-[#5E667A]")} strokeWidth={2.2} />
                <span className="capitalize">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ Main Content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <main className="relative mx-auto max-w-[430px] px-4 pb-[72px] pt-3">

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            TAB: TODAY â€” Bento grid with score, focus, meals, orders
            â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === "today" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {/* â”€â”€ Bento Row 1: Premium Daily Score Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <motion.section
              className="relative aspect-[1680/944] w-full overflow-hidden text-left text-white"
              aria-label="Daily score"
            >
              <img
                src="/dashboard-score-card.png"
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
                draggable={false}
              />

              <div className="absolute left-[8.4%] top-[8.5%] w-[40%] min-w-0">
                <p className="truncate text-[6.5px] font-black uppercase tracking-[0.14em] text-[#51F1C5] min-[390px]:text-[7px]">
                  {dateLabel.toUpperCase()}
                </p>
                <h2 className="mt-1.5 text-[17px] font-black leading-none text-white min-[390px]:text-[19px]">
                  Daily score
                </h2>
                <p className="mt-1.5 truncate text-[7.5px] font-bold text-white/68 min-[390px]:text-[8.5px]">
                  {calorieRemainingLabel}
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/subscription")}
                className="group absolute left-[7.2%] top-[39.6%] flex h-[12%] w-[31.5%] items-center justify-center rounded-full text-center transition active:scale-[0.98]"
                aria-label="Open meal plan details"
              >
                <span className="absolute left-1/2 top-1/2 max-w-[62%] -translate-x-1/2 -translate-y-[125%] truncate whitespace-nowrap text-[7px] font-black leading-none text-[#55F1C9] min-[390px]:text-[8px]">{dailyStatusLabel}</span>
                <ArrowUpRight className="absolute right-[7%] top-1/2 h-2 w-2 -translate-y-[125%] text-[#55F1C9]/65 transition group-hover:-translate-y-full group-hover:translate-x-0.5" strokeWidth={2.6} />
              </button>
              <p className="absolute left-[9.2%] top-[55.4%] w-[22%] truncate text-[7.5px] font-extrabold text-white/82 min-[390px]:text-[8.5px]">
                {mealBalanceLabel}
              </p>

              <div className="absolute left-[59.2%] top-[13.5%] flex h-[42%] w-[29%] flex-col items-center justify-center text-center">
                <p className="relative flex w-full items-end justify-center leading-none">
                  <span className="text-[32px] font-black text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)] min-[390px]:text-[36px]">
                    {dailyScoreDisplay}
                  </span>
                  <span className="absolute bottom-0.5 left-[59%] text-[7px] font-bold text-white/58 min-[390px]:text-[8px]">/10</span>
                </p>
                <p className="mt-1 text-[6.5px] font-extrabold uppercase tracking-[0.12em] text-white/70 min-[390px]:text-[7px]">Score</p>
              </div>

              <div className="absolute inset-x-[4.7%] bottom-[5.6%] grid h-[24.5%] grid-cols-4">
                {[
                  { label: "Cal", value: caloriesMetricDisplay, path: "/dashboard/nutrition" },
                  { label: "Meals", value: mealMetricDisplay, path: "/schedule" },
                  { label: "Water", value: waterMetricDisplay, path: "/water-tracker" },
                  { label: "Steps", value: `${stepsToday}`, path: "/dashboard/activity" },
                ].map(({ label, value, path }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => navigate(path)}
                    className="group flex min-w-0 items-center justify-start pl-[53%] text-left transition active:scale-95"
                    aria-label={`${label}: ${value}`}
                  >
                    <span className="flex min-w-0 translate-x-[5px] -translate-y-[1px] flex-col">
                      <span className="max-w-[40px] truncate text-[10px] font-black leading-none text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.7)] min-[390px]:text-[11px]">{value}</span>
                      <span className="mt-1 text-[5.5px] font-extrabold uppercase tracking-[0.06em] text-white/62 transition group-hover:text-white min-[390px]:text-[6px]">{label}</span>
                    </span>
                  </button>
                ))}
              </div>
            </motion.section>


            {/* â”€â”€ Quick Action Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="rounded-[30px] border border-[#E5EAF1] bg-white p-2 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  {
                    label: t("order"),
                    sublabel: "Meals",
                    testid: "dashboard-fab-order",
                    Icon: ConciergeBell,
                    action: () => navigate("/meals"),
                    primary: true,
                    bg: "bg-[#22C7A1] text-white shadow-[0_10px_20px_rgba(34,199,161,0.28)]",
                    iconClass: "text-white",
                    sublabelClass: "text-white/75",
                  },
                  {
                    label: t("log"),
                    sublabel: "Macros",
                    testid: "dashboard-fab-log",
                    Icon: Plus,
                    action: () => setLogMealOpen(true),
                    primary: false,
                    bg: "bg-[#F8FAFC] text-[#020617] ring-1 ring-[#E5EAF1]",
                    iconClass: "bg-white text-[#22C7A1] ring-1 ring-[#D7F8EC]",
                    sublabelClass: "text-[#64748B]",
                  },
                  {
                    label: "Coaches",
                    sublabel: "Programs",
                    testid: "dashboard-fab-coaches",
                    Icon: Medal,
                    action: () => navigate(hasActiveCoach ? "/coach-programs" : "/coaches"),
                    primary: false,
                    bg: "bg-[#F8FAFC] text-[#020617] ring-1 ring-[#E5EAF1]",
                    iconClass: "bg-white text-[#F97316] ring-1 ring-[#FED7AA]/80",
                    sublabelClass: "text-[#64748B]",
                  },
                  {
                    label: t("community"),
                    sublabel: "Social",
                    testid: "dashboard-fab-community",
                    Icon: Users,
                    action: () => navigate("/community"),
                    primary: false,
                    bg: "bg-[#F8FAFC] text-[#020617] ring-1 ring-[#E5EAF1]",
                    iconClass: "bg-white text-[#7C83F6] ring-1 ring-[#E0E7FF]",
                    sublabelClass: "text-[#64748B]",
                  },
                ].map(({ label, sublabel, testid, Icon, action, bg, iconClass, sublabelClass, primary }) => (
                  <motion.button
                    key={label}
                    type="button"
                    data-testid={testid}
                    onClick={action}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.96 }}
                    className={cn(
                      "flex min-h-[80px] flex-col items-center justify-center rounded-[22px] px-1 py-2 text-center transition-all duration-300 active:scale-[0.98]",
                      bg
                    )}
                  >
                    <span
                      className={cn(
                        "mb-1.5 flex items-center justify-center transition-transform duration-300",
                        primary ? "h-7 w-7" : "h-9 w-9 rounded-full shadow-sm",
                        iconClass
                      )}
                    >
                      <Icon className={primary ? "h-5 w-5" : "h-[18px] w-[18px]"} strokeWidth={primary ? 2.5 : 2.3} />
                    </span>
                    <span className="max-w-full truncate text-[11px] font-black leading-tight">{label}</span>
                    <span className={cn("mt-0.5 max-w-full truncate text-[10px] font-bold leading-tight", sublabelClass)}>
                      {sublabel}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_16px_45px_rgba(15,23,42,0.07)]">
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-600">{t("meals")}</p>
                  <h2 className="mt-0.5 text-[18px] font-black tracking-normal text-slate-950">{t("dashboard_today_meals")}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#EFFFFA] px-3 py-1.5 text-[11px] font-black text-[#22C7A1]">
                    {todayMealsError ? "--" : `${todayMeals.filter((meal) => meal.meal).length}/4`}
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

                  if (todayMealsError) {
                    return (
                      <div className="flex min-h-[72px] items-center justify-center rounded-[20px] bg-white p-3 text-[12px] font-bold text-slate-500 ring-1 ring-[#E5EAF1]">
                        {t("no_data_available")}
                      </div>
                    );
                  }

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
                    const calories = Math.round(meal?.meal?.calories || 0);
                    const protein = Math.round(meal?.meal?.protein_g || 0);
                    const carbs = Math.round(meal?.meal?.carbs_g || 0);
                    const fat = Math.round(meal?.meal?.fat_g || 0);
                    const fiber = meal?.meal?.fiber_g ? Math.round(meal.meal.fiber_g) : null;
                    const macroTotal = protein + carbs + fat;
                    const proteinPct = macroTotal > 0 ? Math.round((protein / macroTotal) * 100) : 0;
                    const carbsPct = macroTotal > 0 ? Math.round((carbs / macroTotal) * 100) : 0;
                    const fatPct = macroTotal > 0 ? Math.max(0, 100 - proteinPct - carbsPct) : 0;
                    return (
                      <div key={slot.type} className="min-w-full max-w-full shrink-0 snap-start">
                        <motion.div
                          whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
                          onClick={(event) => {
                            event.currentTarget.scrollIntoView({
                              behavior: prefersReducedMotion ? "auto" : "smooth",
                              block: "nearest",
                              inline: "start",
                            });
                            setActiveMealSlide(slot.type);
                          }}
                          className="min-h-[408px] overflow-hidden rounded-[24px] bg-white p-3 ring-1 ring-[#E5EAF1] shadow-[0_8px_20px_rgba(15,23,42,0.04)]"
                        >
                          {hasMeal ? (
                            <>
                              <div className="flex items-center gap-3">
                                {meal.meal?.image_url ? (
                                  <img
                                    src={meal.meal.image_url}
                                    alt={meal.meal.name ?? ""}
                                    className="h-[58px] w-[58px] shrink-0 rounded-[16px] object-cover shadow-sm ring-1 ring-slate-100"
                                  />
                                ) : (
                                  <div className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br ${slot.color} text-white shadow-sm`}>
                                    <IconSlot className="h-5 w-5" strokeWidth={2} />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1 text-start">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`h-1.5 w-1.5 rounded-full ${slot.accent}`} />
                                    <p className={`truncate text-[10px] font-black uppercase tracking-[0.16em] ${slot.text}`}>{slot.label}</p>
                                  </div>
                                  <p className="mt-1 truncate text-[17px] font-black leading-tight tracking-[-0.03em] text-[#020617]">
                                    {meal.meal?.name || slot.label}
                                  </p>
                                  <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] font-bold text-[#64748B]">
                                    {meal.restaurant?.name && <span className="truncate">{meal.restaurant.name}</span>}
                                    {calories > 0 && <><span className="text-slate-300">/</span><span>{calories} cal</span></>}
                                  </p>
                                </div>
                                <Link
                                  to={`/meals/${meal.meal?.id}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DDF8E7] text-[#22C7A1] transition active:scale-95"
                                  aria-label="View meal"
                                >
                                  <ChevronRight className="h-4 w-4 -rotate-90" strokeWidth={2.4} />
                                </Link>
                              </div>

                              <div className="mt-3 rounded-[22px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Nutrition</p>
                                    <h3 className="mt-0.5 text-[22px] font-black leading-tight tracking-normal text-[#020617]">Nutrition profile</h3>
                                    <p className="mt-1 text-[12px] font-semibold text-[#64748B]">Calories, macros and fiber</p>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-black text-[#64748B]">per meal</span>
                                </div>

                                <div className="mt-4 grid grid-cols-[118px_minmax(0,1fr)] items-center gap-4">
                                  <div className="relative flex h-[118px] w-[118px] shrink-0 items-center justify-center rounded-full bg-[#F1F5F9]">
                                    <div
                                      className="absolute inset-0 rounded-full"
                                      style={{
                                        background: `conic-gradient(#020617 0 ${proteinPct}%, #94A3B8 ${proteinPct}% ${proteinPct + carbsPct}%, #38BDF8 ${proteinPct + carbsPct}% 100%)`,
                                      }}
                                    />
                                    <div className="absolute inset-[10px] rounded-full bg-white" />
                                    <div className="relative text-center">
                                      <Flame className="mx-auto mb-1 h-4 w-4 text-[#FB6B7A]" strokeWidth={2.4} />
                                      <p className="text-[25px] font-black leading-none text-[#020617] tabular-nums">{calories}</p>
                                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">kcal</p>
                                    </div>
                                  </div>

                                  <div className="grid gap-2.5">
                                    {[
                                      { label: "Protein", value: protein, pct: proteinPct, Icon: Beef, color: "#020617" },
                                      { label: "Carbs", value: carbs, pct: carbsPct, Icon: Wheat, color: "#94A3B8" },
                                      { label: "Fat", value: fat, pct: fatPct, Icon: Droplets, color: "#38BDF8" },
                                    ].map(({ label, value, pct, Icon, color }) => (
                                      <div key={`${slot.type}-${label}`} className="flex min-w-0 items-center gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                                          <Icon className="h-4 w-4" style={{ color }} strokeWidth={2.4} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-baseline justify-between gap-2">
                                            <p className="truncate text-[13px] font-black text-[#020617]">{label}</p>
                                            <p className="text-[12px] font-black text-[#64748B]">{pct}%</p>
                                          </div>
                                          <p className="mt-0.5 text-[12px] font-bold text-[#94A3B8]">
                                            {value}g of {macroTotal}g
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-5 overflow-hidden rounded-full bg-[#F1F5F9]">
                                  <div className="flex h-2.5 w-full">
                                    <div className="bg-[#020617]" style={{ width: `${proteinPct}%` }} />
                                    <div className="bg-[#94A3B8]" style={{ width: `${carbsPct}%` }} />
                                    <div className="bg-[#38BDF8]" style={{ width: `${fatPct}%` }} />
                                  </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                  <div className="flex min-w-0 items-center gap-3 rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] ring-1 ring-[#E5EAF1]">
                                      <Beef className="h-4 w-4" strokeWidth={2.4} />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">Macros</p>
                                      <p className="mt-0.5 truncate text-[16px] font-black leading-none text-[#020617]">{macroTotal}g total</p>
                                    </div>
                                  </div>
                                  <div className="flex min-w-0 items-center gap-3 rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#22C7A1] ring-1 ring-[#E5EAF1]">
                                      <Leaf className="h-4 w-4" strokeWidth={2.4} />
                                    </span>
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">Fiber</p>
                                      <p className="mt-0.5 truncate text-[16px] font-black leading-none text-[#020617]">{fiber ? `${fiber}g` : "-"}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                            </>
                          ) : (
                            <div className="flex min-h-[382px] items-center gap-3">
                              <div className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[19px] ${slot.bg} ${slot.text} ring-1 ${slot.ring}`}>
                                <IconSlot className="h-[20px] w-[20px]" strokeWidth={1.8} />
                              </div>
                              <div className="min-w-0 flex-1 text-start">
                                <p className={`text-[13px] font-black ${slot.text}`}>{slot.label}</p>
                                <p className="mt-0.5 text-[11px] font-bold text-[#94A3B8]">{t("dashboard_no_meal_planned")}</p>
                              </div>
                              <Link to="/meals" className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[10px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-95">
                                <Plus className="h-3 w-3" strokeWidth={2.5} />Order Now
                              </Link>
                            </div>
                          )}
                        </motion.div>
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


            {/* -- Subscription Nudge ---------------------------------- */}
            {/* â”€â”€ Subscription Nudge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <SubscriptionNudge />

            {activeOrders.length > 0 && (
              <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-900 ring-1 ring-slate-200/50 shadow-sm">
                      <ShoppingBag className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">{t("orders")}</p>
                      <h2 className="mt-1 text-[18px] font-black leading-tight text-slate-900 tracking-tight">{t("active_orders")}</h2>
                      <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{t("orders_in_progress_full", { count: String(totalActiveOrders), plural: totalActiveOrders !== 1 ? "s" : "", show: String(activeOrders.length) })}</p>
                    </div>
                  </div>
                  <Link to="/orders?tab=scheduled" className="flex items-center gap-1.5 rounded-full bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 text-[11px] font-black text-slate-700 shadow-sm transition active:scale-95">
                    {t("orders_section_view_all")}<NextIcon className="h-4 w-4 text-slate-400" />
                  </Link>
                </div>
                <div className="mt-3 space-y-0 divide-y divide-slate-100">
                  {activeOrders.map((order) => {
                    const statusConfig: Record<string, { label: string; Icon: React.ElementType; badgeClass: string; iconBg: string; hint: string }> = {
                      pending: { label: t("order_status_pending"), Icon: Clock, badgeClass: "bg-[#FFF4ED] text-[#F97316]", iconBg: "bg-[#FF7A1A] text-white", hint: t("order_awaiting") },
                      confirmed: { label: t("order_status_confirmed"), Icon: CheckCircle2, badgeClass: "bg-[#EAF7FF] text-[#38BDF8]", iconBg: "bg-[#55C3F7] text-white", hint: t("order_accepted") },
                      preparing: { label: t("order_status_preparing"), Icon: Flame, badgeClass: "bg-[#FFF4ED] text-[#F97316]", iconBg: "bg-[#FF7A1A] text-white", hint: t("order_cooking") },
                      ready: { label: t("order_status_ready"), Icon: Package, badgeClass: "bg-[#EAF7FF] text-[#38BDF8]", iconBg: "bg-[#55C3F7] text-white", hint: t("order_ready_pickup") },
                      out_for_delivery: { label: t("order_status_on_the_way"), Icon: Bike, badgeClass: "bg-[#EAF7FF] text-[#0284C7]", iconBg: "bg-[#55C3F7] text-white", hint: t("tracking_status_on_the_way_desc") },
                    };
                    const config = statusConfig[order.order_status] || statusConfig.pending;
                    const orderStatusDetail = order.delivery_time_slot || config.hint;
                    const IconComponent = config.Icon;
                    return (
                      <motion.div key={order.id} variants={prefersReducedMotion ? undefined : staggerItem} whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }} className="overflow-hidden rounded-2xl ring-1 ring-slate-100 bg-slate-50/50 p-1 mb-2.5 transition-all duration-300 hover:ring-slate-200">
                        <Link to={`/live/${order.id}`} className="block">
                          <div className="flex items-center gap-3.5 p-3">
                            <div className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl shadow-sm ${config.iconBg}`}>
                              <IconComponent className="h-[22px] w-[22px]" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <div className="flex items-center gap-2.5">
                                <h3 className="truncate text-[15px] font-black tracking-tight text-slate-900 leading-tight">{order.restaurant_name}</h3>
                                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", config.badgeClass)}>{config.label}</span>
                              </div>
                              <p className="mt-1 truncate text-[12px] font-semibold text-slate-500 leading-none">{order.meal_name}</p>
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <p className="text-[11px] font-semibold text-[#94A3B8]">{orderStatusDetail}</p>
                              </div>
                            </div>
                            <NextIcon className="h-4.5 w-4.5 shrink-0 text-slate-300" strokeWidth={2.5} />
                          </div>
                        </Link>
                        {(order.order_status === "pending" || order.order_status === "confirmed") && (
                          <div className="flex items-center gap-2 bg-white/80 px-3 pb-3 pt-2 rounded-b-2xl border-t border-slate-100">
                            <button type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setSelectedSchedule({
                                  id: order.id,
                                  scheduled_date: order.scheduled_date,
                                  meal_type: order.meal_type ?? "lunch",
                                  is_completed: false,
                                  created_at: order.updated_at,
                                  order_status: order.order_status,
                                  meal_id: order.meal_id,
                                });
                                setShowModifyModal(true);
                              }}
                              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[11px] font-black text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm active:scale-95 transition-all">
                              <Pencil className="h-3.5 w-3.5 text-slate-500" strokeWidth={2.2} />{t("reschedule_button")}
                            </button>
                            <button type="button"
                              onClick={(e) => { e.preventDefault(); setCancelTarget(order); }}
                              disabled={cancellingId === order.id}
                              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#FFF0F2] py-2 text-[11px] font-black text-[#FB6B7A] border border-[#FB6B7A]/15 hover:bg-[#FFF0F2]/80 shadow-sm active:scale-95 transition-all disabled:opacity-50">
                              {cancellingId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" strokeWidth={2.2} />}{t("cancel_button")}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 p-6">
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-500">{t("daily_focus")}</p>
                  <h2 className="mt-1 text-[19px] font-black leading-tight text-slate-900 tracking-tight">{t("do_this_next")}</h2>
                </div>
                <div className="rounded-full bg-[#F0FDF6] px-3 py-1.5 text-[11px] font-black text-emerald-600 ring-1 ring-emerald-100">
                  {dailyScorePercentDisplay}{dailyScorePercentDisplay === "..." || dailyScorePercentDisplay === "--" ? "" : "/100"}
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {focusItems.map(({ label, title, detail, Icon, tone, action }, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={action}
                    className="flex min-h-[68px] w-full items-center gap-3.5 rounded-xl bg-slate-50/50 p-3 text-start ring-1 ring-slate-100/80 transition-all duration-300 active:scale-[0.99] hover:ring-emerald-100/50 hover:bg-slate-50"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ${tone}`}>
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white text-[10px] font-black text-slate-400 border border-slate-200/60 shadow-sm">
                          {index + 1}
                        </span>
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
                      </div>
                      <p className="mt-1.5 truncate text-[14px] font-black text-slate-900 leading-none">{title}</p>
                      <p className="mt-1 truncate text-[11px] font-semibold text-[#64748B]">{detail}</p>
                    </div>
                    <NextIcon className="h-4 w-4 shrink-0 text-slate-300" strokeWidth={2.4} />
                  </button>
                ))}
              </div>
            </div>

            <DashboardAiInsightCard
              slides={aiInsightSlides}
              fallback={fallbackAiInsight}
              prefersReducedMotion={Boolean(prefersReducedMotion)}
              ArrowIcon={NextIcon}
              openLabel={t("ai_coach_label")}
              onOpen={() => navigate("/ai-coach")}
            />

            {user && <BodyCorrelationWidget />}
          </motion.div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            TAB: NUTRITION â€” Calorie ring, macros, water, streak
            â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === "nutrition" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3 pb-4"
          >
            <section
              className="rounded-2xl bg-white p-5 text-start shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
              aria-label={t("nutrition_today")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">{t("nutrition_today")}</p>
                  <p className="mt-1 text-[13px] font-medium text-slate-500">{t("nutrition_hero_subtitle")}</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand ring-1 ring-brand/15">
                  <Apple className="h-5 w-5" strokeWidth={2.2} />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-[118px_1fr] items-center gap-5">
                <div className="relative flex h-[118px] w-[118px] items-center justify-center">
                  <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#F1F5F9" strokeWidth="9" />
                    <motion.circle
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      stroke={overBudget ? "#FB6B7A" : "#22C7A1"}
                      strokeWidth="9"
                      strokeLinecap="round"
                      strokeDasharray="326.73"
                      initial={{ strokeDashoffset: 326.73 }}
                      animate={{ strokeDashoffset: 326.73 - (Math.min(consumedPct, 100) / 100) * 326.73 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="relative text-center" dir="ltr">
                    <p className="text-[24px] font-black leading-none tabular-nums text-slate-900">
                      {hasDailyCalorieTarget ? Math.max(0, calRemaining).toLocaleString() : "--"}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">{t("cal_left")}</p>
                    <span className="mt-1.5 inline-flex items-center justify-center rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 ring-1 ring-slate-100">
                      {hasDailyCalorieTarget ? `${Math.round(consumedPct)}%` : "--"}
                    </span>
                  </div>
                </div>

                <div className="min-w-0 space-y-2">
                  {[
                    { label: t("target"), value: hasDailyCalorieTarget ? dailyCalories.toLocaleString() : "--", unit: hasDailyCalorieTarget ? t("cal_short") : "", Icon: Flame, chipClass: "bg-macro-carbs-soft text-macro-carbs" },
                    { label: t("eaten"), value: caloriesMetricDisplay, unit: todayProgressError ? "" : t("cal_short"), Icon: Utensils, chipClass: "bg-macro-fat-soft text-macro-fat" },
                    { label: t("water"), value: waterLoading || waterLoadError ? waterMetricDisplay : Math.round(waterPct).toLocaleString(), unit: waterLoading || waterLoadError ? "" : "%", Icon: Droplets, chipClass: "bg-macro-water-soft text-macro-water" },
                  ].map(({ label, value, unit, Icon, chipClass }) => (
                    <div key={label} className="flex items-center gap-3 rounded-xl bg-slate-50/60 px-3 py-2.5 ring-1 ring-slate-100">
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", chipClass)}>
                        <Icon className="h-4 w-4" strokeWidth={2.2} />
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-500">{label}</p>
                      <p className="flex shrink-0 items-baseline gap-1 text-[15px] font-black leading-none tabular-nums text-slate-900" dir="ltr">
                        {value}
                        {unit && <span className="text-[10px] font-semibold text-slate-400">{unit}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 text-start">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[19px] font-black tracking-tight text-slate-900">{t("daily_balance")}</h3>
                  <p className="mt-1 text-[12px] font-medium text-slate-500">{t("daily_balance_hint")}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold", dailyBalanceState.bg)} style={{ color: dailyBalanceState.color }}>{dailyBalanceState.label}</span>
              </div>

              <div className="mt-4 grid grid-cols-[105px_1fr] items-center gap-4">
                <div className="relative flex h-[105px] w-[105px] items-center justify-center rounded-full bg-macro-protein-soft/60">
                  <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="60" cy="60" r="47" fill="none" stroke="#F1F5F9" strokeWidth="9" />
                    <motion.circle cx="60" cy="60" r="47" fill="none" stroke="#7C83F6" strokeWidth="9" strokeLinecap="round" strokeDasharray="295.31" initial={{ strokeDashoffset: 295.31 }} animate={{ strokeDashoffset: 295.31 - (hasNutritionScoreData ? (Math.min(nutritionScore, 100) / 100) * 295.31 : 0) }} transition={{ duration: 0.7 }} />
                  </svg>
                  <div className="relative text-center"><p className="text-[27px] font-black leading-none text-slate-900">{nutritionScoreDisplay}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{t("score")}</p></div>
                </div>

                <div className="min-w-0">
                  <div className="rounded-xl bg-macro-protein-soft px-4 py-3.5">
                    <p className="text-[13px] font-bold leading-5 text-slate-900">{dailyBalanceState.detail}</p>
                    <p className="mt-1 text-[12px] font-medium text-slate-500">{hasDailyCalorieTarget ? t("cal_left_today", { count: Math.max(0, calRemaining) }) : t("progress_set_goal")}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-100"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{t("meal_coverage")}</p><p className="mt-1 text-[17px] font-black text-slate-900">{plannedMeals.length}/4</p></div>
                    <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-100"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">{t("top_gap")}</p><p className="mt-1 text-[17px] font-black text-macro-protein">{proteinTarget > 0 && carbsTarget > 0 && fatTarget > 0 ? `${largestMacroGap.value}g` : "--"}</p></div>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3.5">
                {dailyBalanceMetrics.map((metric) => (
                  <div key={metric.label}>
                    <div className="mb-1.5 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{metric.label}</p><p className="text-[11px] font-bold text-slate-900">{metric.value}</p></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><motion.div initial={{ width: 0 }} animate={{ width: `${metric.width}%` }} transition={{ duration: 0.65 }} className="h-full rounded-full" style={{ backgroundColor: metric.color }} /></div>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <section className="overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-slate-100 text-start">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-macro-carbs">{t("calorie_balance")}</p>
                <p className="mt-3 flex items-baseline whitespace-nowrap font-black leading-none text-slate-900 text-[22px]" dir="ltr">
                  <span className="tabular-nums">{deficitDisplay}</span>
                  <span className="ms-1 text-[10px] font-semibold text-slate-400">{calorieBalanceValue === null ? "" : t("cal_short")}</span>
                </p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(consumedPct)}%` }} /></div>
                <p className="mt-2 text-[10px] font-semibold leading-4 text-slate-500">{dailyBalanceState.label}</p>
                <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                  {macroSplit.map((macro) => <div key={macro.label} className="flex items-center justify-between text-[10px] font-bold"><span className={macro.textClass}>{macro.label}</span><span className="tabular-nums text-slate-500">{macro.value}%</span></div>)}
                </div>
              </section>

              <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 text-start">
                <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("micros_to_watch")}</p><span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">{t("today")}</span></div>
                <div className="mt-4 space-y-4">
                  {nutrientGaps.map((gap) => {
                    const percentage = gap.available && gap.target ? Math.min(100, (gap.value / gap.target) * 100) : 0;
                    return <div key={gap.label}><div className="flex items-baseline justify-between gap-2"><p className={cn("text-[10px] font-semibold uppercase tracking-[0.08em]", gap.textClass)}>{gap.label}</p><p className={cn("text-[13px] font-black", gap.textClass)}>{gap.available ? gap.value : "--"}{gap.available && <span className="text-[10px] font-semibold text-slate-400">{gap.unit}{gap.target ? `/${gap.target}${gap.unit}` : ""}</span>}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full bg-current", gap.textClass)} style={{ width: `${percentage}%` }} /></div></div>;
                  })}
                </div>
              </section>
            </div>

            <motion.button type="button" onClick={() => navigate(suggestedMealPath)} whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }} className="flex min-h-[112px] w-full items-center gap-4 overflow-hidden rounded-2xl bg-white p-3 text-start shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100" aria-label={`${t("smart_next_meal")}: ${suggestedMealTitle}`}>
              {smartMealImage ? <img src={smartMealImage} alt={smartMealImageAlt} className="h-[88px] w-[126px] shrink-0 rounded-xl object-cover" /> : <span className="flex h-[88px] w-[126px] shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><UtensilsCrossed className="h-8 w-8" strokeWidth={1.8} /></span>}
              <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-macro-carbs">{t("smart_next_meal")}</p><h3 className="mt-1.5 line-clamp-2 text-[16px] font-black leading-tight text-slate-900">{suggestedMealTitle}</h3><p className="mt-1 line-clamp-1 text-[11px] font-medium text-slate-500">{suggestedMealReason}</p></div>
              <span className="me-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"><NextIcon className="h-4 w-4" strokeWidth={2.4} /></span>
            </motion.button>

            <section className="rounded-2xl bg-white p-4 text-start ring-1 ring-slate-100 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t("weekly_nutrition")}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase text-slate-400">{t("calories")}</p>
                </div>
                {hasWeeklyNutritionData && (
                  <div className="text-end">
                    <p className="text-[10px] font-bold text-brand">{t("best_day")}</p>
                    <p className="text-[11px] font-bold text-slate-900">{weekDayLabels[weeklyBestIndex]}</p>
                    <p className="text-[10px] font-medium tabular-nums text-slate-400">{weeklyCalorieTrend[weeklyBestIndex].toLocaleString()} {t("cal_short")}</p>
                    <p className="mt-2 text-[10px] font-bold text-macro-fat">{t("lowest_logged_day")}</p>
                    <p className="text-[11px] font-bold text-slate-900">{weekDayLabels[weeklyWorstIndex]}</p>
                  </div>
                )}
              </div>

              {weekdayDataLoading ? (
                <div className="mt-4 h-[112px] animate-pulse rounded-xl bg-slate-100" />
              ) : weekdayDataError || !hasWeeklyNutritionData ? (
                <div className="mt-4 flex h-[112px] items-center justify-center rounded-xl bg-slate-50 text-[12px] font-bold text-slate-400">
                  {weekdayDataError ? t("no_data_available") : t("no_data")}
                </div>
              ) : (
                <div className="mt-1 grid grid-cols-[28px_1fr] gap-2">
                  <div className="flex h-[112px] flex-col justify-between pb-5 pt-1 text-end">
                    {[weeklyCalorieMax, Math.round(weeklyCalorieMax * 0.75), Math.round(weeklyCalorieMax * 0.5), Math.round(weeklyCalorieMax * 0.25), 0].map((label) => (
                      <span key={label} className="text-[10px] font-medium tabular-nums text-slate-400">{label.toLocaleString()}</span>
                    ))}
                  </div>
                  <div>
                    <svg viewBox="0 0 204 86" className="h-[100px] w-full overflow-visible" aria-hidden="true">
                      {[16, 34.5, 53, 72].map((y) => <line key={y} x1="0" x2="204" y1={y} y2={y} stroke="#F1F5F9" strokeWidth="1" />)}
                      {hasDailyCalorieTarget && <line x1="0" x2="204" y1={72 - (dailyCalories / weeklyCalorieMax) * 56} y2={72 - (dailyCalories / weeklyCalorieMax) * 56} stroke="#94A3B8" strokeDasharray="4 5" strokeWidth="1.2" />}
                      <polyline points={weeklySparklinePoints} fill="none" stroke="#0F172A" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                      {weeklyCalorieTrend.map((value, index) => value > 0 ? <circle key={`${value}-${index}`} cx={index * 34} cy={72 - (value / weeklyCalorieMax) * 56} r="3" fill="#0F172A" /> : null)}
                    </svg>
                    <div className="grid grid-cols-7 text-center">
                      {weekDayLabels.map((day) => <span key={day} className="text-[10px] font-medium text-slate-400">{day}</span>)}
                    </div>
                  </div>
                </div>
              )}
            </section>



            {/* Macro gap suggestion */}
            {(() => {
              const protRemaining = Math.max(0, proteinTarget - todayProgress.protein);
              const carbsRemaining = Math.max(0, carbsTarget - todayProgress.carbs);
              const fatRemaining = Math.max(0, fatTarget - todayProgress.fat);
              const protPct = proteinTarget > 0 ? protRemaining / proteinTarget : 0;
              const carbsPct = carbsTarget > 0 ? carbsRemaining / carbsTarget : 0;
              const fatPct = fatTarget > 0 ? fatRemaining / fatTarget : 0;
              const gaps = [
                { label: "protein", pct: protPct, remaining: protRemaining, unit: "g", color: "text-macro-protein", bg: "bg-macro-protein-soft", icon: Drumstick, ring: "ring-macro-protein/20" },
                { label: "carbs", pct: carbsPct, remaining: carbsRemaining, unit: "g", color: "text-macro-carbs", bg: "bg-macro-carbs-soft", icon: Wheat, ring: "ring-macro-carbs/20" },
                { label: "fat", pct: fatPct, remaining: fatRemaining, unit: "g", color: "text-macro-fat", bg: "bg-macro-fat-soft", icon: FatIcon, ring: "ring-macro-fat/20" },
              ].filter(g => g.remaining > 0 && g.pct >= 0.2);
              if (gaps.length === 0 || !isUnlimited) return null;
              gaps.sort((a, b) => b.pct - a.pct);
              const top = gaps[0];
              let suggestion = "";
              let SuggestionIcon = top.icon;
              if (top.label === "protein" && calRemaining >= 300) suggestion = t("gap_suggest_protein", { grams: top.remaining, cal: calRemaining });
              else if (top.label === "carbs" && calRemaining >= 300) suggestion = t("gap_suggest_carbs", { grams: top.remaining, cal: calRemaining });
              else if (top.label === "fat" && calRemaining >= 300) suggestion = t("gap_suggest_fat", { grams: top.remaining });
              else if (calRemaining < 300 && calRemaining > 0) { suggestion = t("gap_suggest_light", { cal: calRemaining }); SuggestionIcon = Soup; }
              else return null;
              return (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 26 }}>
                  <Link to="/meals" className={`block rounded-[20px] p-3 ring-1 transition-all active:scale-[0.99] ${top.bg} ${top.ring}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
                        <SuggestionIcon className={`h-4 w-4 ${top.color}`} strokeWidth={2} />
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

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            TAB: ACTIVITY â€” Burned, sessions, log activity
            â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {activeTab === "activity" && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 12 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Add exercise</p>
                  <p className="mt-0.5 text-[12px] font-bold text-slate-500">Choose a sport to log your workout</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#F0FDF6] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#22C7A1] ring-1 ring-emerald-100">
                  Tap to log
                </span>
              </div>
              <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex w-max items-center gap-2">
                  {INLINE_ACTIVITIES.slice(0, 10).map((activity) => {
                    const Icon = activity.Icon;
                    const selected = selectedActivity.id === activity.id;

                    return (
                      <button
                        key={`activity-quick-${activity.id}`}
                        type="button"
                        onClick={() => openActivityLogger(activity.id)}
                        className={cn(
                          "flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-[12px] font-extrabold shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 transition-all duration-200 active:scale-95",
                          selected
                            ? "bg-[#020617] text-white ring-[#020617]"
                            : "bg-[#F6F8FB] text-slate-700 ring-slate-100 hover:bg-slate-50"
                        )}
                        aria-label={`Log ${translateActivityName(activity)}`}
                      >
                        <Icon className={cn("h-4 w-4", selected ? "text-white" : "text-slate-500")} strokeWidth={2.2} />
                        <span>Log {translateActivityName(activity)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <SportHubActivityBridge onActivitiesChanged={loadWorkoutSummary} />

            <section className="rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 p-6 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">{t("activity")}</p>
                  <h2 className="mt-1 text-[20px] font-black leading-tight tracking-[-0.04em] text-slate-900">{t("move_log")}</h2>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">{t("move_log_subtitle")}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500 ring-1 ring-indigo-100/50">
                  <Activity className="h-5 w-5" strokeWidth={2.4} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="rounded-xl bg-slate-50/50 p-4 ring-1 ring-slate-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("total_burned_label")}</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.05em] text-slate-900">{workoutLoading ? "..." : workoutLoadError ? "--" : totalBurned}<span className="ml-1 text-[11px] font-bold text-slate-400">{workoutLoadError ? "" : t("cal_short")}</span></p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${workoutLoadError || totalBurned <= 0 ? 0 : Math.min(100, totalBurned / 5)}%` }} />
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50/50 p-4 ring-1 ring-slate-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{t("sessions")}</p>
                  <p className="mt-1 text-[24px] font-black tracking-[-0.05em] text-slate-900">{workoutLoading ? "..." : workoutLoadError ? "--" : workoutCount}</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${workoutLoadError || workoutCount <= 0 ? 0 : Math.min(100, workoutCount * 18)}%` }} />
                  </div>
                </div>
              </div>
            </section>

            {hasReadinessData && (
            <section className="rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 text-start">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("body_readiness")}</p>
                  <h3 className="mt-1 text-[20px] font-black tracking-[-0.04em] text-slate-900">{t(recoveryReadiness.labelKey)}</h3>
                  <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">{t(recoveryReadiness.detailKey)}</p>
                </div>
                <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-slate-900 text-white ring-8 ring-slate-50 shadow-md">
                  <div className="text-center">
                    <p className="text-[24px] font-black leading-none">{readinessScoreDisplay}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wide text-white/70">{t("score")}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-slate-50/50 p-4 ring-1 ring-slate-100/80">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t("body_load")}</span>
                    <Activity className="h-4 w-4 text-[#7C83F6]" strokeWidth={2.4} />
                  </div>
                  <p className="mt-2 text-[26px] font-black leading-none text-slate-900">{bodyLoad.score}<span className="ml-1 text-[11px] font-black text-slate-400">/21</span></p>
                  <p className="mt-1 text-[11px] font-semibold leading-4 text-slate-500">{t(bodyLoad.labelKey)}</p>
                </div>
                <div className="rounded-xl bg-[#F0FDF6]/70 p-4 ring-1 ring-emerald-100/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-black uppercase tracking-wide text-emerald-600">{t("food_tip")}</span>
                    <Utensils className="h-4 w-4 text-emerald-500" strokeWidth={2.4} />
                  </div>
                  <p className="mt-2 text-[12px] font-black leading-5 text-slate-900">{t(readinessFoodTipKey)}</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-slate-50/50 p-4 ring-1 ring-slate-100/80">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{t("readiness_7_day_trend")}</p>
                  <p className="text-[12px] font-black text-slate-900">
                    {readinessAverage === null ? "--" : readinessAverage}
                    <span className="ml-1 text-[10px] font-black text-slate-400">{t("avg_readiness")}</span>
                  </p>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 7 }).map((_, index) => {
                    const score = readinessTrend[index] ?? 0;
                    const height = Math.max(16, Math.round((score / 100) * 46));
                    return (
                      <div key={`readiness-trend-${index}`} className="flex h-12 items-end justify-center rounded-lg bg-white px-1 ring-1 ring-slate-100">
                        <div
                          className={cn("w-full rounded-full", score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-[#7C83F6]" : score > 0 ? "bg-orange-400" : "bg-slate-100")}
                          style={{ height }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.max(8, recoveryReadiness.score ?? 12)}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-400">
                {t("readiness_data_sources")}
              </p>
              <button
                type="button"
                onClick={() => navigate("/recovery-insights")}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-900 hover:bg-slate-800 px-4 text-[12px] font-black text-white shadow-sm transition active:scale-[0.98]"
              >
                <Activity className="h-4 w-4" strokeWidth={2.4} />
                {t("open_recovery_insights")}
              </button>
            </section>
            )}

            {!hasReadinessData ? (
            <section
              data-testid="dashboard-activity-health-apps-card"
              className="relative aspect-[1402/1154] w-full overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(124,131,246,0.12)]"
              aria-label={t("connect_activity_apps")}
            >
              <img
                src="/activity-health-apps-card.png"
                alt=""
                className="absolute left-[-4.5%] top-[-2.8%] h-[105.6%] w-[109.5%] max-w-none object-fill"
                aria-hidden="true"
              />

              <div className="absolute left-[19.5%] top-[36.8%] w-[47%] -translate-y-1/2 text-start">
                <p className="truncate text-[9px] font-black leading-none text-[#020617] min-[390px]:text-[10px]">
                  {healthIsNativePlatform ? healthPlatformLabel : t("no_health_app_detected")}
                </p>
              </div>
              <span className={cn(
                "absolute left-[72%] top-[33.4%] flex h-[6.2%] w-[19.3%] items-center justify-center rounded-full text-[7px] font-black min-[390px]:text-[8px]",
                healthConnected
                  ? "bg-[#EFFFFA]/95 text-[#22C7A1]"
                  : healthNeedsPlugin
                    ? "bg-[#FFF7ED]/95 text-[#F97316]"
                    : "bg-white/90 text-[#94A3B8] ring-1 ring-[#7C83F6]/10",
              )}>
                {healthConnected ? t("connected") : healthNeedsPlugin ? t("coming_soon") : t("not_connected")}
              </span>
              <p className="absolute left-[19.5%] top-[42.2%] w-[67%] bg-white/95 py-0.5 text-start text-[7px] font-semibold leading-3 text-[#64748B] min-[390px]:text-[8px]">
                {healthNeedsPlugin ? t("health_plugin_required") : t("health_sync_available_mobile")}
              </p>

              <div className="absolute left-[6%] top-[50.9%] grid h-[20.7%] w-[88%] grid-cols-4 gap-[2.4%]">
                {healthSyncOptions.slice(0, 4).map(({ key, label }) => {
                  const enabled = healthEnabledTypes.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleHealthDataType(key, !enabled)}
                      disabled={!user || !healthIsNativePlatform || healthNeedsPlugin}
                      aria-label={label}
                      aria-pressed={enabled}
                      className={cn(
                        "relative h-full rounded-[18px] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45",
                        enabled && "ring-2 ring-inset ring-[#7C83F6] shadow-[0_8px_18px_rgba(124,131,246,0.15)]",
                      )}
                    >
                      {enabled && (
                        <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#7C83F6] text-[9px] font-black text-white">
                          <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => syncHealthData()}
                disabled={!healthConnected || healthSyncing}
                aria-label={t("sync_now")}
                className="absolute left-[5.9%] top-[76%] flex h-[11.6%] w-[42.5%] items-center justify-center rounded-[20px] transition active:scale-[0.98] disabled:bg-white/55 disabled:backdrop-blur-[1px]"
              >
                {healthSyncing && <RefreshCw className="h-5 w-5 animate-spin text-white" strokeWidth={2.4} />}
              </button>
              <button
                type="button"
                onClick={() => navigate("/settings")}
                aria-label={t("open_health_settings")}
                className="absolute left-[51.4%] top-[76%] h-[11.6%] w-[42.5%] rounded-[20px] transition active:scale-[0.98]"
              />

              {lastSyncTimestamp && (
                <p className="absolute bottom-[5.7%] left-1/2 w-[54%] -translate-x-1/2 rounded-full bg-white/95 px-2 py-1 text-center text-[8px] font-bold text-[#64748B] shadow-sm min-[390px]:text-[9px]">
                  {t("last_synced")}: {formatLastSync()}
                </p>
              )}
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
                {workoutLoading ? (
                  <div className="h-[84px] animate-pulse rounded-[22px] bg-[#F1F4F8]" />
                ) : workoutLoadError ? (
                  <div className="rounded-[22px] bg-[#F6F8FB] p-5 text-center ring-1 ring-[#E5EAF1]">
                    <p className="text-[13px] font-black text-[#020617]">{t("no_data_available")}</p>
                  </div>
                ) : workoutSessions.length > 0 ? workoutSessions.map((session) => (
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
                    {session.source === "sporthub" ? (
                      <span className="rounded-full bg-[#E9FBF7] px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#22C7A1]">SportHub</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => deleteInlineActivity(session.id)}
                        disabled={deletingWorkoutId === session.id}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#FB6B7A] ring-1 ring-[#E5EAF1] transition active:scale-95 disabled:opacity-45"
                        aria-label="Delete activity session"
                      >
                        {deletingWorkoutId === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={2.1} />}
                      </button>
                    )}
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

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            TAB: PROGRESS â€” Weight, consistency, level, streak, badges
            â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {(activeTab === "progress" || progressPreloaded) && (
          <div className={activeTab === "progress" ? "block" : "hidden"} aria-hidden={activeTab !== "progress"}>
            <ProgressRedesigned embedded />
          </div>
        )}


        {/* â”€â”€ Top Restaurants Error â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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


      {/* â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {user && (
        <LogMealModal
          open={logMealOpen}
          onOpenChange={setLogMealOpen}
          onMealLogged={() => setProgressKey((key) => key + 1)}
        />
      )}
      <AnimatePresence>
        {activityLogOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close activity logger"
              className="fixed inset-0 z-[1100] bg-[#020617]/45 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActivityLogOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="activity-log-title"
              className="fixed inset-x-0 bottom-0 z-[1110] mx-auto max-h-[calc(100dvh-12px)] max-w-[430px] overflow-y-auto rounded-t-[30px] border-0 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 shadow-[0_-18px_55px_rgba(2,6,23,0.22)]"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 340 }}
            >
              <div className="mx-auto mb-2.5 h-1 w-16 rounded-full bg-[#E5EAF1]" />
            <button
              type="button"
              onClick={() => setActivityLogOpen(false)}
              className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617] shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-[#E5EAF1] transition active:scale-95"
              aria-label="Close activity logger"
            >
              <X className="h-5 w-5" strokeWidth={2.4} />
            </button>
          <div className="px-0 pb-3 pt-0 text-start">
            <div className="flex items-center gap-3 pr-11">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#7C83F6] shadow-[0_8px_18px_rgba(2,6,23,0.08)] ring-1 ring-[#E5EAF1]">
                <SelectedActivityIcon className="h-7 w-7" strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#7C83F6] ring-1 ring-[#E5EAF1]">
                  {t("log_activity")}
                </div>
                <h2 id="activity-log-title" className="mt-2 truncate text-[30px] font-black leading-none tracking-[-0.05em] text-[#020617]">
                  {translateActivityName(selectedActivity)}
                </h2>
                <p className="mt-2 text-[12px] font-semibold leading-4 text-[#94A3B8]">
                  {hasActivityWeight ? t("based_on_weight_met", { weight: activityWeightKg, met: selectedActivity.met }) : t("set_weight_profile_hint")}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-0">
            <div className="grid grid-cols-3 gap-2">
              <div className="min-h-[76px] rounded-[18px] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-[#E5EAF1]">
                <Clock className="h-5 w-5 rounded-full bg-[#F6F8FB] p-1 text-[#38BDF8]" strokeWidth={2.1} />
                <p className="mt-1.5 text-[11px] font-bold text-[#94A3B8]">{t("duration")}</p>
                <p className="mt-0.5 text-[20px] font-black leading-none text-[#020617]">{activityMinutes || 0}<span className="ml-1 text-[11px] font-bold text-[#94A3B8]">{t("min")}</span></p>
              </div>
              <div className="min-h-[76px] rounded-[18px] bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-[#E5EAF1]">
                <Activity className="h-5 w-5 rounded-full bg-[#F6F8FB] p-1 text-[#7C83F6]" strokeWidth={2.1} />
                <p className="mt-1.5 text-[11px] font-bold text-[#94A3B8]">MET</p>
                <p className="mt-0.5 text-[20px] font-black leading-none text-[#020617]">{selectedActivity.met}</p>
              </div>
              <div className="min-h-[76px] rounded-[18px] bg-[#FB6B7A]/10 p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-[#FB6B7A]/25">
                <Flame className="h-5 w-5 rounded-full bg-white p-1 text-[#FB6B7A] shadow-sm" strokeWidth={2.1} />
                <p className="mt-1.5 text-[11px] font-bold text-[#94A3B8]">{t("cal_short")}</p>
                <p className="mt-0.5 text-[20px] font-black leading-none text-[#FB6B7A]">{loggedActivityCal > 0 ? loggedActivityCal : "--"}</p>
              </div>
            </div>

            <div className="rounded-[22px] bg-white p-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.045)] ring-1 ring-[#E5EAF1]">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[18px] font-black tracking-[-0.03em] text-[#020617]">{t("duration")}</p>
                <p className="inline-flex items-center gap-2 rounded-full bg-[#38BDF8]/10 px-3 py-1.5 text-[12px] font-black text-[#020617] ring-1 ring-[#38BDF8]/20">
                  <Clock className="h-4 w-4 text-[#38BDF8]" strokeWidth={2.2} />
                  {activityMinutes || 0} {t("min")}
                </p>
              </div>
              <div className="rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9),0_8px_18px_rgba(15,23,42,0.04)]">
                <div className="grid grid-cols-4 gap-1">
                  {DURATION_PRESETS.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setActivityDuration(String(minutes))}
                      className={cn(
                        "min-h-10 rounded-full text-[14px] font-black transition active:scale-[0.98]",
                        activityMinutes === minutes
                          ? "bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.20)]"
                          : "text-[#94A3B8]"
                      )}
                    >
                      {minutes}
                    </button>
                  ))}
                </div>
              </div>
              <label className="mt-3 flex min-h-[52px] items-center gap-3 rounded-[18px] bg-white px-3 shadow-[inset_0_0_0_1px_rgba(226,232,240,0.95)] focus-within:ring-2 focus-within:ring-[#38BDF8]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#38BDF8]/10 text-[#38BDF8]">
                  <Clock className="h-4.5 w-4.5" strokeWidth={2.1} />
                </span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={activityDuration}
                  onChange={(event) => setActivityDuration(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[26px] font-black leading-none text-[#020617] outline-none"
                  aria-label={t("activity_duration_aria")}
                />
                <span className="text-[16px] font-black uppercase tracking-wide text-[#94A3B8]">{t("min")}</span>
              </label>
            </div>

            <div className="relative overflow-hidden rounded-[22px] bg-white p-4 shadow-[0_8px_24px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
              <div className="pointer-events-none absolute -right-8 top-6 h-24 w-24 rounded-full border border-[#38BDF8]/20" />
              <div className="pointer-events-none absolute -right-1 top-10 h-16 w-16 rounded-full bg-white/60" />
              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] font-black tracking-[0.02em] text-[#020617]">{t("estimated_burn")}</p>
                  <p className="mt-2 text-[42px] font-black leading-none tracking-[-0.06em] text-[#020617]">
                    {loggedActivityCal > 0 ? loggedActivityCal : "--"}
                    <span className="ml-1.5 text-[17px] font-black tracking-normal text-[#94A3B8]">{t("cal_short")}</span>
                  </p>
                  <p className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-[#94A3B8]">
                    <CheckCircle2 className="h-4 w-4 fill-[#38BDF8] text-white" strokeWidth={2.5} />
                    {customActivityCal > 0 ? "Using custom calories" : hasActivityWeight ? "Auto estimate from duration and MET" : t("set_weight_profile_hint")}
                  </p>
                </div>
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#F6F8FB] text-[#FB6B7A] shadow-[0_10px_20px_rgba(251,107,122,0.14)] ring-4 ring-[#FB6B7A]/10">
                  <Flame className="h-7 w-7" strokeWidth={2.1} />
                </div>
              </div>
            </div>

            <label className="flex min-h-[54px] items-center gap-3 rounded-[20px] bg-[#FB6B7A]/8 px-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-[#FB6B7A]/20 focus-within:ring-2 focus-within:ring-[#FB6B7A]">
              <Flame className="h-6 w-6 shrink-0 text-[#FB6B7A]" strokeWidth={2.1} />
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={activityCustomCal}
                onChange={(event) => setActivityCustomCal(event.target.value)}
                placeholder={estimatedActivityCal > 0 ? `${estimatedActivityCal}` : t("custom_cal")}
                className="min-w-0 flex-1 bg-transparent text-[18px] font-black text-[#020617] outline-none placeholder:text-[#020617]"
                aria-label="Custom calories burned"
              />
              <span className="text-[13px] font-black uppercase tracking-wide text-[#FB6B7A]">{t("custom_cal")}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#94A3B8]" strokeWidth={2.4} />
            </label>
          </div>

          <div className="px-0 pb-1 pt-3">
            <button
              type="button"
              data-testid="log-activity-inline-button"
              onClick={saveInlineActivity}
              disabled={!user || activityMinutes <= 0 || loggedActivityCal <= 0 || activitySaving}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#020617] text-[14px] font-black text-white shadow-[0_10px_24px_rgba(2,6,23,0.22)] transition active:scale-[0.98] disabled:opacity-45"
            >
              {activitySaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" strokeWidth={2.1} />}
              {t("log_activity")}
            </button>
          </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
