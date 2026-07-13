import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { createMockProfile, createMockUser } from "@/test/factories";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: vi.fn(),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(),
}));

vi.mock("@/hooks/useAdaptiveGoals", () => ({
  useAdaptiveGoals: vi.fn(),
}));

vi.mock("@/hooks/useFavoriteRestaurants", () => ({
  useFavoriteRestaurants: vi.fn(),
}));

vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: vi.fn(),
}));

vi.mock("@/hooks/useDashboardRolloverCredits", () => ({
  useDashboardRolloverCredits: vi.fn(),
}));

vi.mock("@/hooks/useTodayProgress", () => ({
  useTodayProgress: vi.fn(),
}));

vi.mock("@/hooks/useNutritionGoals", () => ({
  useNutritionGoals: () => ({ activeGoal: null, loading: false, error: null }),
}));

vi.mock("@/hooks/useHealthKitIntegration", () => ({
  useHealthKitIntegration: () => ({
    platform: null,
    isAvailable: false,
    isConnected: false,
    enabledTypes: [],
    lastSyncTimestamp: null,
    isSyncing: false,
    toggleDataType: vi.fn(),
    syncData: vi.fn(),
    formatLastSync: () => "",
  }),
}));

vi.mock("@/hooks/useHealthDailyMetrics", () => ({
  useHealthDailyMetrics: () => ({ metrics: null, rangeMetrics: [] }),
}));

vi.mock("@/hooks/useHealthTrackingGoals", () => ({
  useHealthTrackingGoals: () => ({
    goals: { waterGoalMl: 2500, stepGoal: 10000 },
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/useWeeklySummary", () => ({
  useWeeklySummary: () => ({ summary: null, loading: false, error: null }),
}));

vi.mock("@/hooks/useSmartRecommendations", () => ({
  useSmartRecommendations: () => ({ recommendations: [], loading: false }),
}));

vi.mock("@/hooks/useMealRecommendations", () => ({
  useMealRecommendations: () => ({ candidates: [] }),
}));

vi.mock("@/hooks/useWeekdayData", () => ({
  useWeekdayData: () => ({ days: [], loading: false, error: null }),
}));

vi.mock("@/hooks/useStreak", () => ({
  useStreak: () => ({ streaks: null, loading: false, error: null }),
}));

vi.mock("@/hooks/useBodyMeasurements", () => ({
  useBodyMeasurements: () => ({ measurements: [] }),
}));

vi.mock("@/hooks/useHasRestaurant", () => ({
  useHasRestaurant: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        good_morning: "Good morning",
        good_afternoon: "Good afternoon",
        good_evening: "Good evening",
        log_meal: "Log Meal",
        day_sat: "Sat",
        day_sun: "Sun",
        day_mon: "Mon",
        day_tue: "Tue",
        day_wed: "Wed",
        day_thu: "Thu",
        day_fri: "Fri",
        day: "day",
        days: "days",
        week: "week",
        weeks: "weeks",
        streak: "streak",
        keep_going: "Keep it up!",
        this_week: "this week",
        plan_card_active: "Active",
        plan_card_meals_left: "meals left",
        plan_card_unlimited: "unlimited",
        plan_card_all_used_title: "All meals used",
        plan_card_all_used_reset: "Resets {date}",
        plan_card_all_used_next_renewal: "Next renewal coming",
        todays_progress: "Today's progress",
        top_rated: "Top Rated",
        restaurants: "Restaurants",
        no_featured_restaurants: "No featured restaurants",
        check_back_restaurants: "Check back later for new options",
        featured_badge: "Featured",
        tracker: "Tracker",
        subscription: "Subscription",
        favorites: "Favorites",
        progress: "Progress",
        notifications: "Notifications",
        notifications_unread: "Notifications",
        add_to_favorites: "Add to favorites",
        remove_from_favorites: "Remove from favorites",
        ai_suggestions_unavailable: "AI suggestions temporarily unavailable",
        meals_label: "meals",
        orders_count_label: "orders",
        delicious_healthy_meals: "Delicious healthy meals",
      };
      return map[key] ?? key;
    },
    language: "en",
  }),
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarDay: () => "2026-04-15",
  getQatarNow: vi.fn(() => {
    const d = new Date();
    d.setHours(10, 0, 0, 0);
    return d;
  }),
  getWeekStartDay: () => 6,
  WEEK_DAYS_SATURDAY: [6, 0, 1, 2, 3, 4, 5],
  WEEK_DAYS_MONDAY: [1, 2, 3, 4, 5, 6, 0],
  isQatarToday: (d: string) => d === "2026-04-15",
  getQatarDate: () => new Date(),
  formatLocaleDate: () => "Wed, Apr 15",
}));

vi.mock("@/lib/animations", () => ({
  spring: { type: "spring", stiffness: 300, damping: 25, mass: 0.8 },
  springBouncy: { type: "spring", stiffness: 400, damping: 17, mass: 0.6 },
  fadeInUp: { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } },
  staggerContainer: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  pageVariants: { hidden: { opacity: 0, x: 30 }, visible: { opacity: 1, x: 0 } },
  pulseVariants: { pulse: { scale: [1, 1.1, 1] } },
  glowVariants: { glow: { boxShadow: ["0 0 0px rgba(0,0,0,0)", "0 0 8px rgba(0,0,0,0.4)"] } },
  breatheVariants: { breathe: { opacity: [1, 0.85, 1] } },
}));

vi.mock("framer-motion", async () => {
  const ReactModule = await vi.importActual<typeof import("react")>("react");
  const components = new Map<string, React.ComponentType<any>>();

  return {
    motion: new Proxy({}, {
      get: (_target, tag: string) => {
        if (!components.has(tag)) {
          components.set(tag, ReactModule.forwardRef<HTMLElement, any>(({ children, ...rest }, ref) => {
            const { variants, initial, animate, exit, whileTap, whileHover, transition, layout, ...domProps } = rest;
            return ReactModule.createElement(tag, { ...domProps, ref }, children);
          }));
        }
        return components.get(tag);
      },
    }),
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useScroll: () => ({ scrollY: { get: () => 0 } }),
    useTransform: () => 0,
    useReducedMotion: () => true,
  };
});

vi.mock("@/components/DashboardErrorBoundary", () => ({
  DashboardErrorBoundary: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/LogMealModal", () => ({
  default: ({ open }: { open: boolean }) => open ? <div data-testid="log-meal-modal" /> : null,
}));

vi.mock("@/components/ActiveOrderBanner", () => ({
  ActiveOrderBanner: ({ userId }: { userId: string }) => <div data-testid="active-order-banner">Active Orders ({userId})</div>,
}));

vi.mock("@/components/DailyNutritionCard", () => ({
  DailyNutritionCard: ({ streakDays, weekTarget, completedThisWeek }: any) => (
    <div data-testid="daily-nutrition-card">
      {streakDays !== undefined && (
        <div data-testid="streak-inline">
          {streakDays > 0 ? `${streakDays} day streak` : ''}
          {completedThisWeek}/{weekTarget}
        </div>
      )}
    </div>
  ),
}));

vi.mock("@/components/BehaviorPredictionWidget", () => ({
  BehaviorPredictionWidget: () => <div data-testid="behavior-prediction-widget" />,
}));

vi.mock("@/components/AdaptiveGoalCard", () => ({
  AdaptiveGoalCard: () => <div data-testid="adaptive-goal-card" />,
}));

vi.mock("@/components/RoleIndicator", () => ({
  RoleIndicator: () => <div data-testid="role-indicator" />,
}));

vi.mock("@/pages/ProgressRedesigned", () => ({
  default: () => <div data-testid="progress-redesigned" />,
}));

vi.mock("@/assets/flam.png", () => ({
  default: "flam-avatar.png",
}));

import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdaptiveGoals } from "@/hooks/useAdaptiveGoals";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useNotifications } from "@/hooks/useNotifications";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useHasRestaurant } from "@/hooks/useHasRestaurant";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

const renderDashboard = () => {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mockUser = createMockUser();

const defaultProfile = createMockProfile({
  id: "p1",
  user_id: "user-1",
  full_name: "John Doe",
  avatar_url: null,
  gender: "male" as const,
  age: 30,
  height_cm: 175,
  current_weight_kg: 80,
  target_weight_kg: 75,
  health_goal: "lose" as const,
  activity_level: "moderate" as const,
  daily_calorie_target: 2000,
  protein_target_g: 150,
  carbs_target_g: 200,
  fat_target_g: 65,
  onboarding_completed: true,
  referral_code: null,
  referral_rewards_earned: null,
  referred_by: null,
  affiliate_balance: null,
  total_affiliate_earnings: null,
  affiliate_tier: null,
  streak_days: 3,
  created_at: "2026-01-01",
  updated_at: "2026-04-15",
});

const defaultSubscription = {
  id: "sub-1",
  plan: "standard",
  status: "active",
  start_date: "2026-04-01",
  end_date: "2026-05-01",
  meals_per_month: 30,
  meals_used_this_month: 15,
  month_start_date: "2026-04-01",
  meals_per_week: 7,
  meals_used_this_week: 3,
  week_start_date: "2026-04-13",
  snacks_per_month: 0,
  snacks_used_this_month: 0,
  tier: "standard" as const,
  active: true,
};

const setupMocks = (overrides: Record<string, any> = {}) => {
  vi.mocked(useAuth).mockReturnValue({
    user: overrides.user ?? mockUser,
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  });

  vi.mocked(useProfile).mockReturnValue({
    profile: Object.prototype.hasOwnProperty.call(overrides, "profile") ? overrides.profile : defaultProfile,
    loading: overrides.profileLoading ?? false,
    error: overrides.profileError ?? null,
    refetch: vi.fn(),
    updateProfile: vi.fn(),
  });

  vi.mocked(useSubscription).mockReturnValue({
    subscription: Object.prototype.hasOwnProperty.call(overrides, "subscription") ? overrides.subscription : defaultSubscription,
    loading: false,
    error: null,
    hasActiveSubscription: overrides.hasActiveSubscription ?? true,
    isExpired: false,
    isPaused: false,
    remainingMeals: overrides.remainingMeals ?? 15,
    totalMeals: 30,
    mealsUsed: 15,
    remainingMealsWeekly: 4,
    totalMealsWeekly: 7,
    mealsUsedWeekly: 3,
    snacksPerMonth: 0,
    snacksUsed: 0,
    remainingSnacks: 0,
    hasSnacks: false,
    isUnlimited: overrides.isUnlimited ?? false,
    isVip: overrides.isVip ?? false,
    tier: overrides.isVip ? "vip" : "standard",
    canOrderMeal: true,
    incrementMealUsage: vi.fn(),
    incrementSnackUsage: vi.fn(),
    pauseSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
    refetch: vi.fn(),
  });

  vi.mocked(useAdaptiveGoals).mockReturnValue({
    recommendation: null,
    predictions: [],
    settings: null,
    adjustmentHistory: [],
    loading: false,
    settingsLoading: false,
    historyLoading: false,
    hasUnviewedAdjustment: false,
    edgeFunctionAvailable: true,
    fetchRecommendation: vi.fn(),
    fetchSettings: vi.fn(),
    fetchHistory: vi.fn(),
    applyAdjustment: vi.fn(),
    dismissAdjustment: vi.fn(),
    updateSettings: vi.fn(),
    analyzeNow: vi.fn(),
  });

  vi.mocked(useFavoriteRestaurants).mockReturnValue({
    favoriteIds: new Set<string>(),
    loading: false,
    toggling: false,
    toggleFavorite: vi.fn(),
    isFavorite: vi.fn().mockReturnValue(false),
  });

  vi.mocked(useNotifications).mockReturnValue({
    unreadCount: overrides.unreadCount ?? 0,
    loading: false,
  });

  vi.mocked(useDashboardRolloverCredits).mockReturnValue({
    rolloverCredits: overrides.rolloverCredits ?? 0,
    loading: false,
    error: null,
  });

  vi.mocked(useTodayProgress).mockReturnValue({
    todayProgress: { calories: 800, protein: 60, carbs: 120, fat: 30, fiber: 0, mealsLogged: 2 },
    error: null,
    loading: false,
  });

  vi.mocked(useHasRestaurant).mockReturnValue({
    hasRestaurant: false,
    loading: false,
    error: null,
  });
};

describe("Dashboard Page", () => {
  beforeEach(() => {
    setupMocks();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Greeting", () => {
    it("renders morning greeting before 12pm", () => {
      renderDashboard();
      expect(screen.getByText("Good morning")).toBeInTheDocument();
    });

  });

  describe("Daily score card", () => {
    it("displays the real meal balance when an active subscription exists", () => {
      setupMocks({ hasActiveSubscription: true, subscription: defaultSubscription });
      renderDashboard();
      expect(screen.getByText("15 meals_left")).toBeInTheDocument();
    });

    it("shows unlimited symbol when isUnlimited is true", () => {
      setupMocks({ isUnlimited: true, hasActiveSubscription: true, subscription: { ...defaultSubscription, tier: "vip" } });
      renderDashboard();
      expect(screen.getByText("∞")).toBeInTheDocument();
    });

  });

  describe("Quick actions", () => {
    it("opens log meal dialog on click", () => {
      renderDashboard();
      const btn = screen.getByTestId("dashboard-fab-log");
      fireEvent.click(btn);
      expect(screen.getByTestId("log-meal-modal")).toBeInTheDocument();
    });
  });

  describe("Dashboard actions", () => {
    it("navigates to meals from the order action", () => {
      renderDashboard();
      expect(screen.getByTestId("dashboard-fab-log")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-fab-coaches")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-fab-community")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-nutrition-card")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("dashboard-fab-order"));
      expect(mockNavigate).toHaveBeenCalledWith("/meals");
    });
  });

  describe("Daily metrics", () => {
    it("exposes the calorie metric as an accessible action", () => {
      const { container } = renderDashboard();
      expect(screen.getByRole("button", { name: /^Cal:/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Water:/ })).toBeInTheDocument();
      expect(container.querySelector('section[aria-label="Daily score"]')).toBeInTheDocument();
    });
  });

  describe("Dashboard tabs", () => {
    it("renders all dashboard tabs", () => {
      renderDashboard();
      expect(screen.getByTestId("dashboard-tab-today")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-tab-nutrition")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-tab-activity")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-tab-progress")).toBeInTheDocument();
    });
  });

  describe("Profile Error Handling", () => {
    it("renders a recoverable error state when profile loading fails", () => {
      setupMocks({ profileError: new Error("Network error"), profile: null });
      renderDashboard();
      expect(screen.getByText("retry_button")).toBeInTheDocument();
    });
  });

  describe("Notification Badge Overflow", () => {
    it("shows a compact 9+ badge when unread count exceeds 9", () => {
      setupMocks({ unreadCount: 150 });
      renderDashboard();
      expect(screen.getByText("9+")).toBeInTheDocument();
    });
  });

  describe("Rollover Credits", () => {
    it("shows rollover credits in meals left when rollover > 0", () => {
      setupMocks({
        hasActiveSubscription: true,
        remainingMeals: 13,
        rolloverCredits: 2,
      });
      renderDashboard();
      expect(screen.getByText("15 meals_left")).toBeInTheDocument();
    });
  });
});
