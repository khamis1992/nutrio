import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDailyPerformanceSnapshot } from "@/hooks/useDailyPerformanceSnapshot";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarDay: () => "2026-07-12",
}));

import { supabase } from "@/integrations/supabase/client";

const buildInput = () => ({
  userId: "user-1",
  performance: {
    score: 99,
    label: "client-value-must-not-be-trusted",
    summary: "client-value-must-not-be-trusted",
    primaryReason: "client-value-must-not-be-trusted",
    reasons: ["client-value-must-not-be-trusted"],
    actionLabel: "client-value-must-not-be-trusted",
    actionPath: "/ignored",
    mealNeed: {
      protein: 100,
      calories: 1000,
      query: "ignored",
      category: "ignored",
      focus: "protein" as const,
    },
  },
  matchedMeal: null,
  readinessScore: 99,
  bodyLoad: 45,
  caloriesConsumed: 1200,
  calorieTarget: 2600,
  proteinConsumed: 80,
  proteinTarget: 160,
  waterPercent: 40,
  mealsLogged: 2,
});

describe("useDailyPerformanceSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: {}, error: null } as never);
  });

  it("asks the server to derive today's snapshot", async () => {
    renderHook(() => useDailyPerformanceSnapshot(buildInput()));

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith(
        "refresh_daily_performance_snapshot",
        { p_snapshot_date: "2026-07-12" },
      );
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("does not refresh without an authenticated user", () => {
    renderHook(() => useDailyPerformanceSnapshot({ ...buildInput(), userId: undefined }));

    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("allows a retry after a failed server refresh", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: null, error: new Error("offline") } as never)
      .mockResolvedValueOnce({ data: {}, error: null } as never);

    const { rerender } = renderHook(
      ({ input }) => useDailyPerformanceSnapshot(input),
      { initialProps: { input: buildInput() } },
    );

    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(1));
    rerender({ input: buildInput() });
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(2));
  });
});
