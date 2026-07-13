import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "test@example.com" } }),
}));

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { id: "user-1", onboarding_completed: true } }),
}));

vi.mock("@/hooks/usePlatformSettings", () => ({
  usePlatformSettings: () => ({
    settings: { features: { meal_scheduling: true } },
    loading: false,
  }),
}));

vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    subscription: {
      id: "sub-1",
      status: "active",
      meals_per_month: 30,
      meals_used_this_month: 10,
    },
    remainingMeals: 20,
    isUnlimited: false,
    hasActiveSubscription: true,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({ wallet: { balance: 100 }, refresh: vi.fn() }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/GuestLoginPrompt", () => ({
  GuestLoginPrompt: () => null,
  useGuestLoginPrompt: () => ({
    showLoginPrompt: false,
    setShowLoginPrompt: vi.fn(),
    promptLogin: vi.fn(),
    loginPromptConfig: { title: "", description: "", actionLabel: "", signUpLabel: "" },
  }),
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

vi.mock("@/components/ui/delivery-scheduler", () => ({
  DeliveryScheduler: () => null,
}));

vi.mock("@/components/MealWizard", () => ({
  default: () => null,
}));

vi.mock("@/components/ModifyOrderModal", () => ({
  ModifyOrderModal: () => null,
}));

vi.mock("@/hooks/useSmartSubstitutions", () => ({
  useSmartSubstitutions: () => ({
    unavailableMeals: [],
    dismissMeal: vi.fn(),
    performSubstitution: vi.fn(),
    hasUnavailable: false,
  }),
}));

vi.mock("@/components/meal/SmartSubstitutionBanner", () => ({
  SmartSubstitutionBanner: () => null,
}));

vi.mock("@/components/meal/MealPlanGenerator", () => ({
  MealPlanGenerator: () => null,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

import Schedule from "@/pages/Schedule";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { container } = render(<Schedule />, { wrapper: createWrapper() });
    expect(container).toBeTruthy();
  });

  it("renders the page title", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    expect(document.body.textContent).toContain("Meal schedule");
  });

  it("renders the daily schedule summary", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    expect(document.body.textContent).toContain("planned");
    expect(document.body.textContent).toContain("kcal");
  });

  it("renders meal credits badge", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    expect(document.body.textContent).toContain("20");
  });

  it("renders navigation buttons", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows today label", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    const today = new Date();
    expect(document.body.textContent).toContain(today.getDate().toString());
  });

  it("navigates back on back button click", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    const backButton = screen.getAllByRole("button")[0];
    fireEvent.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("renders week navigation elements", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: "Previous week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next week" })).toBeTruthy();
  });

  it("renders the seven day picker", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    const weekNavigationButtons = screen.getAllByRole("button");
    expect(weekNavigationButtons.length).toBeGreaterThanOrEqual(10);
  });
});
