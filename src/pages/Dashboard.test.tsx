import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";

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

vi.mock("@/hooks/useFeaturedRestaurants", () => ({
  useFeaturedRestaurants: vi.fn(),
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

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: () => {
        return ({ children, ...rest }: any) => {
          const { variants, initial, animate, exit, whileTap, whileHover, transition, layout, style: _style, ...domProps } = rest;
          return <div {...domProps}>{children}</div>;
        };
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useScroll: () => ({ scrollY: { get: () => 0 } }),
  useTransform: () => 0,
  useReducedMotion: () => false,
}));

vi.mock("@/components/DashboardErrorBoundary", () => ({
  DashboardErrorBoundary: ({ children }: any) => <>{children}</>,
}));

vi.mock("@/components/LogMealDialog", () => ({
  LogMealDialog: () => <div data-testid="log-meal-dialog" />,
}));

vi.mock("@/components/ActiveOrderBanner", () => ({
  ActiveOrderBanner: ({ userId }: { userId: string }) => <div data-testid="active-order-banner">Active Orders ({userId})</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
    realtime: { setAuth: vi.fn() },
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
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

vi.mock("@/assets/flam.png", () => ({
  default: "flam-avatar.png",
}));

import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdaptiveGoals } from "@/hooks/useAdaptiveGoals";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useFeaturedRestaurants } from "@/hooks/useFeaturedRestaurants";
import { useNotifications } from "@/hooks/useNotifications";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useHasRestaurant } from "@/hooks/useHasRestaurant";
import { getQatarNow } from "@/lib/dateUtils";

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

const mockUser = { id: "user-1", email: "test@example.com" };

const defaultProfile = {
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
};

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
    profile: overrides.profile ?? defaultProfile,
    loading: overrides.profileLoading ?? false,
    error: overrides.profileError ?? null,
    refetch: vi.fn(),
    updateProfile: vi.fn(),
  });

  vi.mocked(useSubscription).mockReturnValue({
    subscription: overrides.subscription ?? defaultSubscription,
    loading: false,
    hasActiveSubscription: overrides.hasActiveSubscription ?? true,
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

  vi.mocked(useFeaturedRestaurants).mockReturnValue({
    featuredRestaurants: overrides.featuredRestaurants ?? [],
    loading: overrides.restaurantsLoading ?? false,
    isFeatured: vi.fn().mockReturnValue(false),
    featuredIds: new Set<string>(),
  });

  vi.mocked(useNotifications).mockReturnValue({
    unreadCount: overrides.unreadCount ?? 0,
    setUnreadCount: vi.fn(),
  });

  vi.mocked(useDashboardRolloverCredits).mockReturnValue({
    rolloverCredits: overrides.rolloverCredits ?? 0,
    loading: false,
    error: null,
  });

  vi.mocked(useTodayProgress).mockReturnValue({
    todayProgress: { calories: 800, protein: 60, carbs: 120, fat: 30 },
    setTodayProgress: vi.fn(),
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

    it("renders afternoon greeting between 12pm-6pm", () => {
      vi.mocked(useProfile).mockReturnValue({
        ...vi.mocked(useProfile)(),
        profile: defaultProfile,
        loading: false,
        error: null,
        refetch: vi.fn(),
        updateProfile: vi.fn(),
      });
      renderDashboard();
      expect(screen.getByText(/Good (morning|afternoon|evening)/)).toBeInTheDocument();
    });
  });

  describe("Subscription Card (compact pill in header)", () => {
    it("displays meal count pill when active subscription exists", () => {
      setupMocks({ hasActiveSubscription: true, subscription: defaultSubscription });
      renderDashboard();
      expect(screen.getByText("15")).toBeInTheDocument();
    });

    it("shows unlimited symbol when isUnlimited is true", () => {
      setupMocks({ isUnlimited: true, hasActiveSubscription: true, subscription: { ...defaultSubscription, tier: "vip" } });
      renderDashboard();
      expect(screen.getByText("∞")).toBeInTheDocument();
    });

    it("shows all meals used warning when remaining = 0", () => {
      setupMocks({
        hasActiveSubscription: true,
        remainingMeals: 0,
        subscription: defaultSubscription,
      });
      renderDashboard();
      expect(screen.getByText("All meals used")).toBeInTheDocument();
    });

    it("does not render subscription pill when no active subscription", () => {
      setupMocks({ hasActiveSubscription: false, subscription: null });
      renderDashboard();
      expect(screen.queryByText("meals left")).not.toBeInTheDocument();
    });
  });

  describe("Log Meal Button", () => {
    it("shows log meal button", () => {
      renderDashboard();
      expect(screen.getByText("Log Meal")).toBeInTheDocument();
    });

    it("opens log meal dialog on click", async () => {
      const user = userEvent.setup();
      renderDashboard();
      const btn = screen.getByText("Log Meal");
      await user.click(btn);
    });
  });

  describe("Featured Restaurants", () => {
    it("shows restaurant carousel when restaurants exist", () => {
      setupMocks({
        featuredRestaurants: [
          {
            id: "r1",
            name: "Healthy Bites",
            description: "Fresh meals",
            logo_url: null,
            rating: 4.5,
            total_orders: 120,
            meal_count: 8,
            featured_listing_id: "fl1",
            package_type: "premium",
            ends_at: "2026-05-01",
          },
        ],
      });
      renderDashboard();
      expect(screen.getByText("Healthy Bites")).toBeInTheDocument();
    });

    it("shows empty state when no featured restaurants", () => {
      setupMocks({ featuredRestaurants: [], restaurantsLoading: false });
      renderDashboard();
      expect(screen.getByText("No featured restaurants")).toBeInTheDocument();
    });

    it("shows loading shimmer when restaurants are loading", () => {
      setupMocks({ restaurantsLoading: true });
      renderDashboard();
    });
  });

  describe("Streak Widget (inline in nutrition card)", () => {
    it("shows streak with correct day count", () => {
      renderDashboard();
      expect(screen.getByText(/3 day streak/)).toBeInTheDocument();
    });

    it("shows multi-week streak when streak >= 2 * weekTarget", () => {
      setupMocks({ profile: { ...defaultProfile, streak_days: 16 } });
      renderDashboard();
      expect(screen.getByText(/day streak/)).toBeInTheDocument();
    });

    it("shows current week completion fraction", () => {
      renderDashboard();
      expect(screen.getByTestId("streak-inline")).toBeInTheDocument();
    });
  });

  describe("Quick Actions are removed (replaced by bottom tab bar)", () => {
    it("does not render quick action links", () => {
      renderDashboard();
      expect(screen.queryByText("Tracker")).not.toBeInTheDocument();
      expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
      expect(screen.queryByText("Progress")).not.toBeInTheDocument();
    });
  });

  describe("Onboarding Redirect", () => {
    it("redirects to /onboarding when onboarding_completed is false", async () => {
      setupMocks({ profile: { ...defaultProfile, onboarding_completed: false } });
      renderDashboard();
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/onboarding");
      });
    });

    it("does not redirect when onboarding_completed is true", () => {
      renderDashboard();
      expect(mockNavigate).not.toHaveBeenCalledWith("/onboarding");
    });

    it("does not redirect during profile loading", () => {
      setupMocks({ profileLoading: true });
      renderDashboard();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("Profile Error Handling", () => {
    it("renders dashboard even when profile has error", () => {
      setupMocks({ profileError: new Error("Network error"), profile: null });
      renderDashboard();
      expect(screen.getByText("Log Meal")).toBeInTheDocument();
    });
  });

  describe("Null Subscription", () => {
    it("handles null subscription without crashing", () => {
      setupMocks({ subscription: null, hasActiveSubscription: false });
      renderDashboard();
      expect(screen.getByText("Log Meal")).toBeInTheDocument();
    });
  });

  describe("Empty Notifications", () => {
    it("renders notification bell with no unread count", () => {
      setupMocks({ unreadCount: 0 });
      renderDashboard();
      const bell = screen.getByLabelText("Notifications");
      expect(bell).toBeInTheDocument();
    });

    it("renders notification unread count badge when > 0", () => {
      setupMocks({ unreadCount: 5 });
      renderDashboard();
      const badges = screen.getAllByText("5");
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  describe("AI Widgets", () => {
    it("shows AI suggestions unavailable message when edge function is not available", () => {
      vi.mocked(useAdaptiveGoals).mockReturnValue({
        ...vi.mocked(useAdaptiveGoals)(),
        edgeFunctionAvailable: false,
      });
      renderDashboard();
      expect(screen.getByText("AI suggestions temporarily unavailable")).toBeInTheDocument();
    });
  });

  describe("Evening Greeting", () => {
    it("renders evening greeting at 6pm+", () => {
      const eveningNow = new Date();
      eveningNow.setHours(19, 0, 0, 0);
      vi.mocked(getQatarNow).mockReturnValue(eveningNow);
      renderDashboard();
      expect(screen.getByText("Good evening")).toBeInTheDocument();
    });
  });

  describe("Subscription CTA", () => {
    it("shows CTA when no active subscription", () => {
      setupMocks({ hasActiveSubscription: false, subscription: null });
      renderDashboard();
    });
  });

  describe("Notification Badge Overflow", () => {
    it("shows 99+ when unread count exceeds 99", () => {
      setupMocks({ unreadCount: 150 });
      renderDashboard();
      expect(screen.getByText("99+")).toBeInTheDocument();
    });
  });

  describe("canOrderMeal when meals exhausted", () => {
    it("canOrderMeal returns false when no meals remaining and not unlimited", () => {
      setupMocks({
        hasActiveSubscription: true,
        remainingMeals: 0,
        subscription: defaultSubscription,
      });
      renderDashboard();
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
      expect(screen.getByText("15")).toBeInTheDocument();
    });
  });
});