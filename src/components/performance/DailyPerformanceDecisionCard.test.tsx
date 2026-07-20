import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DailyPerformanceDecisionCard } from "@/components/performance/DailyPerformanceDecisionCard";
import { normalizeDailyPerformanceDecision } from "@/lib/daily-performance";

const navigate = vi.fn();
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "en", isRTL: false }),
}));
vi.mock("@/components/performance/BehaviorSupportAction", () => ({
  BehaviorSupportAction: () => null,
}));

const decision = normalizeDailyPerformanceDecision({
  id: "decision-1",
  user_id: "user-1",
  decision_date: "2026-07-20",
  version: 1,
  mode: "train",
  confidence_score: 85,
  confidence_level: "high",
  workout_program_id: "program-1",
  workout_day_id: "day-1",
  workout_title: "Upper body",
  workout_day_type: "workout",
  workout_intensity_percent: 80,
  exercise_count: 6,
  calorie_min: 1800,
  calorie_max: 2200,
  protein_min_g: 140,
  hydration_min_ml: 2500,
  meal_calorie_min: 350,
  meal_calorie_max: 600,
  meal_protein_min_g: 30,
  coach_message: "Keep two reps in reserve.",
  evidence: { workout_day_number: 2 },
});

describe("DailyPerformanceDecisionCard", () => {
  beforeEach(() => navigate.mockReset());

  it("presents workout, nutrition, meal and coach direction as one decision", () => {
    render(<DailyPerformanceDecisionCard decision={decision} meal={{ id: "meal-1", name: "Protein bowl", calories: 520, protein_g: 42, meal_type: "lunch" }} />);
    expect(screen.getByText("Train as planned")).toBeInTheDocument();
    expect(screen.getByText(/Upper body/)).toBeInTheDocument();
    expect(screen.getByText(/Protein bowl/)).toBeInTheDocument();
    expect(screen.getByText("Keep two reps in reserve.")).toBeInTheDocument();
  });

  it("opens the exact prescribed workout day", () => {
    render(<DailyPerformanceDecisionCard decision={decision} />);
    fireEvent.click(screen.getByRole("button", { name: /start workout/i }));
    expect(navigate).toHaveBeenCalledWith("/coach-programs/workout/program-1/day/2");
  });
});
