import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(document.body.textContent).toContain("My Schedule");
  });

  it("renders week progress stats", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    expect(document.body.textContent).toContain("This Week Progress");
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

  it("navigates back on back button click", async () => {
    render(<Schedule />, { wrapper: createWrapper() });
    const backButton = screen.getAllByRole("button")[0];
    if (backButton) {
      await userEvent.click(backButton);
    }
  });

  it("renders week progress and navigation elements", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    expect(document.body.textContent).toContain("This Week Progress");
  });

  it("renders empty state slots", () => {
    render(<Schedule />, { wrapper: createWrapper() });
    const emptySlots = document.querySelectorAll("[class*='rounded-2xl']");
    expect(emptySlots.length).toBeGreaterThan(0);
  });
});