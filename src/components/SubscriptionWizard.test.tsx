/**
 * SubscriptionWizard Component Tests
 * Tests for the subscription quiz/wizard component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { SubscriptionWizard, RecommendedPlanBanner } from "./SubscriptionWizard";

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

describe("SubscriptionWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Render", () => {
    it("renders the first question on mount", () => {
      renderWithRouter(<SubscriptionWizard />);

      expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument();
      expect(screen.getByText(/How many meals do you want delivered per day/i)).toBeInTheDocument();
    });

    it("renders progress indicators for all questions", () => {
      renderWithRouter(<SubscriptionWizard />);

      const progressBars = screen.getAllByRole("generic").filter((el) =>
        el.className.includes("h-2 w-6")
      );
      expect(progressBars.length).toBe(3);
    });

    it("shows first progress bar as active", () => {
      renderWithRouter(<SubscriptionWizard />);

      const progressBars = screen.getAllByRole("generic").filter((el) =>
        el.className.includes("h-2 w-6")
      );
      expect(progressBars[0]).toHaveClass("bg-primary");
    });
  });

  describe("Question Rendering", () => {
    it("renders all question options as radio buttons", () => {
      renderWithRouter(<SubscriptionWizard />);

      expect(screen.getByLabelText("1 meal")).toBeInTheDocument();
      expect(screen.getByLabelText("2 meals")).toBeInTheDocument();
      expect(screen.getByLabelText("3 meals")).toBeInTheDocument();
      expect(screen.getByLabelText("Varies / Flexible")).toBeInTheDocument();
    });

    it("renders radio group for question 2 after navigation", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Select option and proceed
      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => {
        expect(screen.getByText(/How committed are you to your health goals/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Just exploring")).toBeInTheDocument();
      expect(screen.getByLabelText("Moderately committed")).toBeInTheDocument();
      expect(screen.getByLabelText("Very committed")).toBeInTheDocument();
      expect(screen.getByLabelText("All in - I want a coach")).toBeInTheDocument();
    });

    it("renders radio group for question 3", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Navigate to question 3
      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));
      await waitFor(() => screen.getByLabelText("Moderately committed"));
      await userEvent.click(screen.getByLabelText("Moderately committed"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => {
        expect(screen.getByText(/What matters most to you/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Best value for money")).toBeInTheDocument();
      expect(screen.getByLabelText("Wide restaurant variety")).toBeInTheDocument();
      expect(screen.getByLabelText("Personal coaching & support")).toBeInTheDocument();
      expect(screen.getByLabelText("Premium experience & priority")).toBeInTheDocument();
    });
  });

  describe("Answer Selection", () => {
    it("selects answer when radio button is clicked", async () => {
      renderWithRouter(<SubscriptionWizard />);

      const option = screen.getByLabelText("2 meals");
      await userEvent.click(option);

      expect(option).toBeChecked();
    });

    it("enables Next button after selecting an answer", async () => {
      renderWithRouter(<SubscriptionWizard />);

      const nextButton = screen.getByText(/Next/i);
      expect(nextButton).toBeDisabled();

      await userEvent.click(screen.getByLabelText("2 meals"));

      expect(nextButton).not.toBeDisabled();
    });

    it("maintains answer selection when navigating back and forth", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Select answer
      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByText(/How committed/i));

      // Go back
      await userEvent.click(screen.getByText(/Back/i));

      await waitFor(() => screen.getByText(/How many meals/i));

      // Answer should still be selected
      expect(screen.getByLabelText("2 meals")).toBeChecked();
    });
  });

  describe("Navigation", () => {
    it("disables Back button on first question", () => {
      renderWithRouter(<SubscriptionWizard />);

      const backButton = screen.getByText(/Back/i);
      expect(backButton).toBeDisabled();
    });

    it("advances to next question when Next is clicked", async () => {
      renderWithRouter(<SubscriptionWizard />);

      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => {
        expect(screen.getByText(/Question 2 of 3/i)).toBeInTheDocument();
      });
    });

    it("goes back to previous question when Back is clicked", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Go to question 2
      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByText(/Question 2 of 3/i));

      // Go back
      await userEvent.click(screen.getByText(/Back/i));

      await waitFor(() => {
        expect(screen.getByText(/Question 1 of 3/i)).toBeInTheDocument();
      });
    });

    it("updates progress bars when navigating forward", async () => {
      renderWithRouter(<SubscriptionWizard />);

      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByText(/Question 2 of 3/i));

      const progressBars = screen.getAllByRole("generic").filter((el) =>
        el.className.includes("h-2 w-6")
      );
      expect(progressBars[0]).toHaveClass("bg-primary");
      expect(progressBars[1]).toHaveClass("bg-primary");
    });
  });

  describe("Plan Recommendation", () => {
    it("navigates to subscription page with recommended plan on final step", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Answer all questions
      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByLabelText("Moderately committed"));
      await userEvent.click(screen.getByLabelText("Moderately committed"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByLabelText("Wide restaurant variety"));
      await userEvent.click(screen.getByLabelText("Wide restaurant variety"));

      // Should show "See My Plan" button
      const seePlanButton = screen.getByText(/See My Plan/i);
      await userEvent.click(seePlanButton);

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("/subscription"));
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("recommended"));
    });

    it("recommends basic plan for price-conscious users", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Select basic-oriented answers
      await userEvent.click(screen.getByLabelText("1 meal"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByLabelText("Just exploring"));
      await userEvent.click(screen.getByLabelText("Just exploring"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByLabelText("Best value for money"));
      await userEvent.click(screen.getByLabelText("Best value for money"));

      const seePlanButton = screen.getByText(/See My Plan/i);
      await userEvent.click(seePlanButton);

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("recommended=basic"));
    });

    it("recommends vip plan for premium-oriented users", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Select VIP-oriented answers
      await userEvent.click(screen.getByLabelText("Varies / Flexible"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByLabelText("All in - I want a coach"));
      await userEvent.click(screen.getByLabelText("All in - I want a coach"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => screen.getByLabelText("Premium experience & priority"));
      await userEvent.click(screen.getByLabelText("Premium experience & priority"));

      const seePlanButton = screen.getByText(/See My Plan/i);
      await userEvent.click(seePlanButton);

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("recommended=vip"));
    });
  });

  describe("Button States", () => {
    it("shows Next button on non-final questions", async () => {
      renderWithRouter(<SubscriptionWizard />);

      expect(screen.getByText(/Next/i)).toBeInTheDocument();
      expect(screen.queryByText(/See My Plan/i)).not.toBeInTheDocument();
    });

    it("shows See My Plan button on final question", async () => {
      renderWithRouter(<SubscriptionWizard />);

      // Navigate to final question
      await userEvent.click(screen.getByLabelText("2 meals"));
      await userEvent.click(screen.getByText(/Next/i));
      await waitFor(() => screen.getByLabelText("Moderately committed"));
      await userEvent.click(screen.getByLabelText("Moderately committed"));
      await userEvent.click(screen.getByText(/Next/i));

      await waitFor(() => {
        expect(screen.getByText(/See My Plan/i)).toBeInTheDocument();
        expect(screen.queryByText(/Next/i)).not.toBeInTheDocument();
      });
    });
  });
});

describe("RecommendedPlanBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders basic plan details", () => {
    renderWithRouter(<RecommendedPlanBanner plan="basic" />);

    expect(screen.getByText("Recommended for You")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
    expect(screen.getByText("Best for trying out")).toBeInTheDocument();
    expect(screen.getByText(/22 meals\/month/i)).toBeInTheDocument();
    expect(screen.getByText(/215 QAR/i)).toBeInTheDocument();
  });

  it("renders standard plan details", () => {
    renderWithRouter(<RecommendedPlanBanner plan="standard" />);

    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.getByText(/43 meals\/month/i)).toBeInTheDocument();
  });

  it("renders premium plan details", () => {
    renderWithRouter(<RecommendedPlanBanner plan="premium" />);

    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByText("Best value")).toBeInTheDocument();
    expect(screen.getByText(/65 meals\/month/i)).toBeInTheDocument();
  });

  it("renders vip plan details", () => {
    renderWithRouter(<RecommendedPlanBanner plan="vip" />);

    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("Premium experience")).toBeInTheDocument();
    expect(screen.getByText(/Unlimited meals\/month/i)).toBeInTheDocument();
  });

  it("has Select This Plan button", () => {
    renderWithRouter(<RecommendedPlanBanner plan="standard" />);

    expect(screen.getByText("Select This Plan")).toBeInTheDocument();
  });

  it("renders with sparkles icon", () => {
    renderWithRouter(<RecommendedPlanBanner plan="standard" />);

    const sparkles = document.querySelector("svg");
    expect(sparkles).toBeInTheDocument();
  });
});
