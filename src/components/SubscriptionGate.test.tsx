/**
 * SubscriptionGate Component Tests
 * Tests for the subscription paywall/gate component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { SubscriptionGate } from "./SubscriptionGate";
import * as SubscriptionHook from "@/hooks/useSubscription";

// Mock the useSubscription hook
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

describe("SubscriptionGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with meal context by default", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate />);

      expect(screen.getByText("Unlock This Meal")).toBeInTheDocument();
      expect(screen.getByText("Join thousands in Qatar achieving their health goals")).toBeInTheDocument();
    });

    it("renders with schedule context", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate context="schedule" />);

      expect(screen.getByText("Start Your Meal Plan")).toBeInTheDocument();
      expect(screen.getByText("Flexible weekly meal scheduling")).toBeInTheDocument();
    });

    it("renders with tracking context", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate context="tracking" />);

      expect(screen.getByText("Track Your Progress")).toBeInTheDocument();
      expect(screen.getByText("Daily calorie & macro tracking")).toBeInTheDocument();
    });

    it("renders all benefits for the context", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate context="meal" />);

      expect(screen.getByText("Schedule this meal for delivery")).toBeInTheDocument();
      expect(screen.getByText("Track your nutrition automatically")).toBeInTheDocument();
      expect(screen.getByText("Get personalized meal recommendations")).toBeInTheDocument();
    });

    it("displays pricing information", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate />);

      expect(screen.getByText(/Plans start at/i)).toBeInTheDocument();
      expect(screen.getByText(/215 QAR\/month/i)).toBeInTheDocument();
      expect(screen.getByText(/Cancel anytime/i)).toBeInTheDocument();
    });
  });

  describe("Active Subscription State", () => {
    it("returns null when user has active subscription", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
      } as any);

      const { container } = renderWithRouter(<SubscriptionGate />);

      expect(container.firstChild).toBeNull();
    });

    it("does not render gate content when subscribed", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: true,
      } as any);

      renderWithRouter(<SubscriptionGate />);

      expect(screen.queryByText("Unlock This Meal")).not.toBeInTheDocument();
      expect(screen.queryByText("View Plans")).not.toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("navigates to subscription page when View Plans button is clicked", async () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate />);

      const viewPlansButton = screen.getByText(/View Plans/i);
      await userEvent.click(viewPlansButton);

      expect(mockNavigate).toHaveBeenCalledWith("/subscription");
    });
  });

  describe("Dismiss Button", () => {
    it("renders dismiss button when showDismiss is true and onDismiss is provided", () => {
      const mockDismiss = vi.fn();
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate onDismiss={mockDismiss} showDismiss={true} />);

      const dismissButton = screen.getByRole("button", { name: /close/i });
      expect(dismissButton).toBeInTheDocument();
    });

    it("does not render dismiss button when showDismiss is false", () => {
      const mockDismiss = vi.fn();
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate onDismiss={mockDismiss} showDismiss={false} />);

      const dismissButtons = screen.queryAllByRole("button");
      const hasDismissButton = dismissButtons.some((btn) => 
        btn.querySelector("svg")
      );
      expect(hasDismissButton).toBe(false);
    });

    it("does not render dismiss button when onDismiss is not provided", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate showDismiss={true} />);

      // Should still not show dismiss button without onDismiss handler
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(1); // Only View Plans button
    });

    it("calls onDismiss when dismiss button is clicked", async () => {
      const mockDismiss = vi.fn();
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate onDismiss={mockDismiss} showDismiss={true} />);

      const dismissButton = screen.getByRole("button", { name: /close/i });
      await userEvent.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("Styling", () => {
    it("applies custom className when provided", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate className="custom-class" />);

      const card = screen.getByText("Unlock This Meal").closest("div[class*='border']");
      expect(card).toHaveClass("custom-class");
    });

    it("renders with sparkles icon", () => {
      vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
        hasActiveSubscription: false,
      } as any);

      renderWithRouter(<SubscriptionGate />);

      const sparklesIcon = document.querySelector("svg");
      expect(sparklesIcon).toBeInTheDocument();
    });
  });

  describe("Context-specific Content", () => {
    const contexts = ["meal", "schedule", "tracking"] as const;

    contexts.forEach((context) => {
      it(`renders correct title for ${context} context`, () => {
        vi.mocked(SubscriptionHook.useSubscription).mockReturnValue({
          hasActiveSubscription: false,
        } as any);

        renderWithRouter(<SubscriptionGate context={context} />);

        const titles: Record<typeof context, string> = {
          meal: "Unlock This Meal",
          schedule: "Start Your Meal Plan",
          tracking: "Track Your Progress",
        };

        expect(screen.getByText(titles[context])).toBeInTheDocument();
      });
    });
  });
});
