import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WeeklyReportData } from "@/lib/professional-weekly-report-pdf";

const mocks = vi.hoisted(() => ({
  getHealthContext: vi.fn(),
  maybeSingle: vi.fn(),
  runAiTask: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/ai-router", () => ({ runAiTask: mocks.runAiTask }));
vi.mock("@/lib/health-context", () => ({
  getConsentedHealthContextAiSummary: mocks.getHealthContext,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: mocks.maybeSingle })),
        })),
      })),
      upsert: mocks.upsert,
    })),
  },
}));

import { aiReportGenerator } from "@/lib/ai-report-generator";

const reportData: WeeklyReportData = {
  userName: "Test User",
  userEmail: "test@example.com",
  reportDate: "2026-07-22",
  weekStart: "2026-07-20",
  weekEnd: "2026-07-26",
  currentWeight: 80,
  weightChange: 0,
  weightGoal: 75,
  weightProgress: 10,
  avgCalories: 1800,
  calorieTarget: 2000,
  calorieProgress: 90,
  avgProtein: 90,
  proteinTarget: 100,
  avgCarbs: 180,
  carbsTarget: 220,
  avgFat: 60,
  fatTarget: 70,
  dailyData: [],
  consistencyScore: 70,
  daysLogged: 5,
  totalDays: 7,
  mealQualityScore: 75,
  waterAverage: 2,
  currentStreak: 3,
  bestStreak: 5,
  activeGoal: "general health",
  goalProgress: 10,
  milestonesAchieved: 0,
  totalMilestones: 0,
  insights: [],
  recommendations: [],
  vsLastWeek: { calories: 0, weight: 0, consistency: 0 },
};

const aiContent = JSON.stringify({
  summary: "AI summary",
  weightAnalysis: "Weight analysis",
  weightCommentary: "Weight commentary",
  metabolicCommentary: "Metabolic commentary",
  macroCommentary: "Macro commentary",
  insights: [{ type: "success", text: "Good consistency" }],
  recommendations: [{ title: "Keep going", description: "Stay consistent" }],
  proteinAssessment: "Protein assessment",
});

describe("aiReportGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHealthContext.mockResolvedValue(null);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it("deduplicates concurrent generation for the same weekly report", async () => {
    let resolveTask!: (value: {
      content: string;
      provider: string;
      model: string;
      citations: never[];
      routed: boolean;
    }) => void;
    mocks.runAiTask.mockReturnValue(new Promise((resolve) => {
      resolveTask = resolve;
    }));

    const first = aiReportGenerator.generateReportContent(reportData, "user-1", "en");
    const second = aiReportGenerator.generateReportContent(reportData, "user-1", "en");

    await vi.waitFor(() => expect(mocks.runAiTask).toHaveBeenCalledTimes(1));
    resolveTask({
      content: aiContent,
      provider: "longcat",
      model: "LongCat-2.0",
      citations: [],
      routed: true,
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.content.summary).toBe("AI summary");
    expect(secondResult.content.summary).toBe("AI summary");
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("returns fallback content without caching provider failures", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.runAiTask.mockRejectedValue(new Error("daily_ai_request_limit_reached"));

    const result = await aiReportGenerator.generateReportContent(reportData, "user-2", "en");

    expect(result.content.summary).toBeTruthy();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(
      "AI report provider not available, using fallback content",
      "daily_ai_request_limit_reached",
    );
    warning.mockRestore();
  });
});
