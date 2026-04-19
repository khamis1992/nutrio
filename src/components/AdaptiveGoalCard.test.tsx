import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdaptiveGoalCard } from "@/components/AdaptiveGoalCard";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        adaptiveGoals_greatProgress: "Great Progress!",
        adaptiveGoals_aiSuggestion: "AI Suggestion",
        adaptiveGoals_basedOnProgress: "Based on your progress",
        adaptiveGoals_plateauDetected: "Plateau",
        adaptiveGoals_confidence: "% conf",
        adaptiveGoals_dailyCalorieTarget: "Daily Calorie Target",
        adaptiveGoals_caloriesPerDay: "cal/day",
        adaptiveGoals_was: "was",
        adaptiveGoals_protein: "Protein",
        adaptiveGoals_carbs: "Carbs",
        adaptiveGoals_fat: "Fat",
        adaptiveGoals_whyThisChange: "Why this change?",
        adaptiveGoals_tip: "Tip",
        adaptiveGoals_safetyRange: "Adjustments stay within safe nutritional ranges",
        adaptiveGoals_applyChanges: "Apply Changes",
        adaptiveGoals_dismiss: "Dismiss",
        adaptiveGoals_applying: "Applying...",
      };
      return map[key] ?? key;
    },
    language: "en",
  }),
}));

const defaultRecommendation = {
  new_calories: 1800,
  new_protein: 140,
  new_carbs: 190,
  new_fat: 60,
  reason: "You've been plateauing for 2 weeks",
  confidence: 0.85,
  plateau_detected: true,
  suggested_action: "Reduce calories slightly to break the plateau",
};

describe("AdaptiveGoalCard", () => {
  const defaultProps = {
    recommendation: defaultRecommendation,
    currentCalories: 2000,
    currentProtein: 150,
    currentCarbs: 200,
    currentFat: 65,
    onApply: vi.fn(),
    onDismiss: vi.fn(),
    loading: false,
  };

  it("renders when recommendation has changes", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText("AI Suggestion")).toBeInTheDocument();
    expect(screen.getByText("1800")).toBeInTheDocument();
    expect(screen.getByText("cal/day")).toBeInTheDocument();
  });

  it("shows plateau badge when plateau_detected is true", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText("Plateau")).toBeInTheDocument();
  });

  it("shows confidence percentage", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText("85% conf")).toBeInTheDocument();
  });

  it("shows macro changes", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText("Protein")).toBeInTheDocument();
    expect(screen.getByText("Carbs")).toBeInTheDocument();
    expect(screen.getByText("Fat")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button clicked", async () => {
    const onDismiss = vi.fn();
    render(<AdaptiveGoalCard {...defaultProps} onDismiss={onDismiss} />);
    const dismissBtn = screen.getByText("Dismiss");
    await userEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("calls onApply when apply button clicked", async () => {
    const onApply = vi.fn();
    render(<AdaptiveGoalCard {...defaultProps} onApply={onApply} adjustmentId="adj-1" />);
    const applyBtn = screen.getByText("Apply Changes");
    await userEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledWith("adj-1");
  });

  it("shows great progress card when no changes needed", () => {
    const noDiffRecommendation = {
      ...defaultRecommendation,
      new_calories: 2000,
      new_protein: 150,
      new_carbs: 200,
      new_fat: 65,
    };
    render(<AdaptiveGoalCard {...defaultProps} recommendation={noDiffRecommendation} />);
    expect(screen.getByText("Great Progress!")).toBeInTheDocument();
  });

  it("returns null when recommendation is null", () => {
    const { container } = render(
      <AdaptiveGoalCard {...defaultProps} recommendation={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("disables apply button when loading", () => {
    render(<AdaptiveGoalCard {...defaultProps} loading={true} />);
    const applyBtn = screen.getByText("Applying...");
    expect(applyBtn.closest("button")).toBeDisabled();
  });

  it("disables apply button when no adjustmentId", () => {
    render(<AdaptiveGoalCard {...defaultProps} adjustmentId={undefined} />);
    const applyBtn = screen.getByText("Apply Changes");
    expect(applyBtn.closest("button")).toBeDisabled();
  });

  it("shows calorie decrease indicator with TrendingDown icon", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText("-200")).toBeInTheDocument();
  });

  it("shows calorie increase indicator with TrendingUp icon when calories increase", () => {
    const increaseRec = {
      ...defaultRecommendation,
      new_calories: 2200,
    };
    render(<AdaptiveGoalCard {...defaultProps} recommendation={increaseRec} currentCalories={2000} />);
    expect(screen.getByText("+200")).toBeInTheDocument();
  });

  it("shows safety range text", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText("Adjustments stay within safe nutritional ranges")).toBeInTheDocument();
  });

  it("shows macro direction indicators for protein decrease", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    const indicators = screen.getAllByText("-10g");
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });

  it("shows reason text", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText("You've been plateauing for 2 weeks")).toBeInTheDocument();
  });

  it("shows suggested action in tip box", () => {
    render(<AdaptiveGoalCard {...defaultProps} />);
    expect(screen.getByText(/Reduce calories slightly to break the plateau/)).toBeInTheDocument();
  });
});