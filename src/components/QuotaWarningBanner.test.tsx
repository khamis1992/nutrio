/**
 * QuotaWarningBanner Component Tests
 * Tests for subscription quota warning display
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { QuotaWarningBanner } from "./QuotaWarningBanner";
import * as SubscriptionHook from "@/hooks/useSubscription";

// Mock useSubscription hook
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe("QuotaWarningBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Visibility Conditions", () => {
    it("returns null when user has no active subscription", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
        remainingMeals: 0,
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      const { container } = renderWithRouter(<QuotaWarningBanner />);

      expect(container.firstChild).toBeNull();
    });

    it("returns null when user has unlimited plan", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 999,
        totalMeals: 999,
        isUnlimited: true,
      } as any);

      const { container } = renderWithRouter(<QuotaWarningBanner />);

      expect(container.firstChild).toBeNull();
    });

    it("returns null when usage is below 75%", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 10,
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      const { container } = renderWithRouter(<QuotaWarningBanner />);

      expect(container.firstChild).toBeNull();
    });

    it("renders when usage reaches 75%", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 5,
        totalMeals: 22, // ~77% used
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText(/5 Meals Remaining/i)).toBeInTheDocument();
    });

    it("renders when usage is at 100%", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 0,
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText(/Meal Quota Exhausted/i)).toBeInTheDocument();
    });
  });

  describe("Warning State (75-99% usage)", () => {
    beforeEach(() => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 3,
        totalMeals: 22, // ~86% used
        isUnlimited: false,
      } as any);
    });

    it("shows remaining meals count", () => {
      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText("3 Meals Remaining")).toBeInTheDocument();
    });

    it("shows usage percentage", () => {
      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText(/86% of your monthly meals/i)).toBeInTheDocument();
    });

    it("uses default alert variant", () => {
      renderWithRouter(<QuotaWarningBanner />);

      const alert = screen.getByRole("alert");
      expect(alert).not.toHaveClass("destructive");
    });

    it("shows CheckCircle icon", () => {
      renderWithRouter(<QuotaWarningBanner />);

      const checkIcon = document.querySelector("svg");
      expect(checkIcon).toBeInTheDocument();
    });

    it("shows View Options button", () => {
      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText("View Options")).toBeInTheDocument();
    });
  });

  describe("Exhausted State (100% usage)", () => {
    beforeEach(() => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 0,
        totalMeals: 22,
        isUnlimited: false,
      } as any);
    });

    it("shows exhausted message", () => {
      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText("Meal Quota Exhausted")).toBeInTheDocument();
    });

    it("shows upgrade suggestion", () => {
      renderWithRouter(<QuotaWarningBanner />);

      expect(
        screen.getByText(/You've used all your meals for this period/i)
      ).toBeInTheDocument();
    });

    it("uses destructive alert variant", () => {
      renderWithRouter(<QuotaWarningBanner />);

      const alert = screen.getByRole("alert");
      expect(alert.className).toContain("destructive");
    });

    it("shows AlertTriangle icon", () => {
      renderWithRouter(<QuotaWarningBanner />);

      const alertIcon = document.querySelector("svg");
      expect(alertIcon).toBeInTheDocument();
    });

    it("shows Upgrade Plan button", () => {
      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText("Upgrade Plan")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("navigates to subscription page from warning state", async () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 3,
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      const viewOptionsButton = screen.getByText("View Options");
      await userEvent.click(viewOptionsButton);

      expect(mockNavigate).toHaveBeenCalledWith("/subscription");
    });

    it("navigates to subscription page from exhausted state", async () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 0,
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      const upgradeButton = screen.getByText("Upgrade Plan");
      await userEvent.click(upgradeButton);

      expect(mockNavigate).toHaveBeenCalledWith("/subscription");
    });
  });

  describe("Usage Calculation", () => {
    it("calculates percentage correctly at exactly 75%", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 5.5, // 75% of 22
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText(/75% of your monthly meals/i)).toBeInTheDocument();
    });

    it("calculates percentage correctly at exactly 90%", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 2.2, // 10% remaining = 90% used
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText(/90% of your monthly meals/i)).toBeInTheDocument();
    });

    it("rounds percentage to whole number", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 6,
        totalMeals: 22, // ~72.7% used, should not show
        isUnlimited: false,
      } as any);

      const { container } = renderWithRouter(<QuotaWarningBanner />);

      // 72.7% is below 75% threshold, should not render
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("handles zero total meals gracefully", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 0,
        totalMeals: 0,
        isUnlimited: false,
      } as any);

      const { container } = renderWithRouter(<QuotaWarningBanner />);

      // Division by zero should not crash
      expect(container.firstChild).toBeNull();
    });

    it("handles negative remaining meals", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: -5,
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      // Should show exhausted state
      expect(screen.getByText("Meal Quota Exhausted")).toBeInTheDocument();
    });

    it("handles single meal remaining", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 1,
        totalMeals: 22,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText("1 Meals Remaining")).toBeInTheDocument();
    });

    it("handles very large meal counts", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
        remainingMeals: 10,
        totalMeals: 100,
        isUnlimited: false,
      } as any);

      renderWithRouter(<QuotaWarningBanner />);

      expect(screen.getByText("10 Meals Remaining")).toBeInTheDocument();
      expect(screen.getByText(/90% of your monthly meals/i)).toBeInTheDocument();
    });
  });
});
