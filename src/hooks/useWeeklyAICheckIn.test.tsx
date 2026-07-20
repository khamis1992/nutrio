import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  normalizeWeeklyCheckInReview,
  useWeeklyAICheckIn,
} from "@/hooks/useWeeklyAICheckIn";

const { rpc, user } = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: { id: "user-1" },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const reviewPayload = {
  id: "check-in-1",
  week_start: "2026-07-19",
  status: "reviewed",
  adjustment_id: null,
  current_targets: { calories: 2000, protein: 140, carbs: 210, fat: 65 },
  proposed_targets: { calories: 1950, protein: 145, carbs: 195, fat: 65 },
  review_summary: "Keep protein steady while adjusting energy.",
  confidence: 0.82,
  days_logged: 6,
  adherence_rate: 0.75,
  weight_change_kg: -0.4,
  recommendation_state: "change",
  decision_code: "weight_loss_plateau_small_decrease",
  reason_codes: ["trend.smoothed_plateau", "change.bounded"],
  hold_reasons: [],
  data_quality: {
    label: "high",
    days_logged: 6,
    weight_samples: 7,
    outliers_removed: 1,
    span_days: 25,
    prior_window_samples: 3,
    recent_window_samples: 4,
  },
  weight_trend: {
    method: "two_window_median",
    window_days: 28,
    prior_median_kg: 91.2,
    recent_median_kg: 90.8,
    change_kg: -0.4,
    weekly_rate_kg: -0.2,
  },
  safety_context: {
    health_context_date: null,
    health_context_codes: [],
    active_health_program: false,
    unresolved_safety_event: false,
  },
  algorithm_version: "adaptive-week-v2",
  expires_at: "2026-07-27T08:00:00Z",
  response_evidence_summary: {
    meal_response_enabled: true,
    eligible_episodes: 4,
    descriptive_episodes: 2,
    published_estimate_count: 1,
    evidence_tier: "early",
    summary: "Four qualified meal responses informed this review.",
  },
};

describe("weekly AI check-in meal-response integration", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("normalizes response evidence without requiring it to exist", () => {
    expect(normalizeWeeklyCheckInReview(reviewPayload)?.meal_response_evidence).toEqual({
      enabled: true,
      eligible_episode_count: 4,
      descriptive_episode_count: 2,
      estimate_count: 1,
      strongest_evidence_tier: "early",
      summary: "Four qualified meal responses informed this review.",
    });
    expect(normalizeWeeklyCheckInReview({
      ...reviewPayload,
      response_evidence_summary: undefined,
    })?.meal_response_evidence.enabled).toBe(false);
  });

  it("normalizes the server-owned decision, trend, quality and safety evidence", () => {
    const review = normalizeWeeklyCheckInReview(reviewPayload);

    expect(review?.recommendation_state).toBe("change");
    expect(review?.decision_code).toBe("weight_loss_plateau_small_decrease");
    expect(review?.data_quality).toMatchObject({ label: "high", weight_samples: 7, outliers_removed: 1 });
    expect(review?.weight_trend).toMatchObject({ method: "two_window_median", weekly_rate_kg: -0.2 });
    expect(review?.safety_context.active_health_program).toBe(false);
    expect(review?.algorithm_version).toBe("adaptive-week-v2");
  });

  it("invalidates every dependent query domain only after apply", async () => {
    rpc
      .mockResolvedValueOnce({ data: reviewPayload, error: null })
      .mockResolvedValueOnce({ data: { status: "applied" }, error: null });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useWeeklyAICheckIn(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.resolve("apply")).toBe(true);
    });

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["profile", "user-1"],
      ["nutrition-goals", "user-1"],
      ["daily-performance-decision", "user-1"],
      ["meal-ranking", "user-1"],
      ["meal-response-dashboard", "user-1"],
    ]);
  });

  it("does not invalidate targets when the server marks a proposal stale", async () => {
    rpc
      .mockResolvedValueOnce({ data: reviewPayload, error: null })
      .mockResolvedValueOnce({
        data: { status: "stale", code: "WEEKLY_CHECK_IN_STALE_REFRESH_REQUIRED" },
        error: null,
      });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useWeeklyAICheckIn(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.resolve("apply")).toBe(false);
    });

    expect(result.current.review?.status).toBe("stale");
    expect(result.current.error).toBe("WEEKLY_CHECK_IN_STALE_REFRESH_REQUIRED");
    expect(invalidate).not.toHaveBeenCalled();
  });
});
