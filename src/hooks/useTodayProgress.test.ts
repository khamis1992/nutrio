import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTodayProgress } from "@/hooks/useTodayProgress";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn(),
}));

vi.mock("date-fns", () => ({
  format: (date: Date, fmt: string) => {
    if (fmt === "yyyy-MM-dd") return "2026-04-15";
    return date.toISOString();
  },
}));

import { withRetry } from "@/lib/retry";

const stableDate = new Date("2026-04-15T12:00:00");

describe("useTodayProgress", () => {
  it("returns default progress when userId is undefined", () => {
    const { result } = renderHook(() =>
      useTodayProgress(undefined, stableDate, 0)
    );
    expect(result.current.todayProgress).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(result.current.loading).toBe(false);
  });

  it("fetches progress and updates state", async () => {
    vi.mocked(withRetry).mockResolvedValue({
      data: {
        calories_consumed: 1200,
        protein_consumed_g: 80,
        carbs_consumed_g: 150,
        fat_consumed_g: 40,
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.todayProgress.calories).toBe(1200);
  });

  it("returns zeroed progress when data is null", async () => {
    vi.mocked(withRetry).mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.todayProgress).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("sets error when withRetry rejects", async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error("Progress query failed"));

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.error).toBeTruthy();
  });

  it("handles null fields with defaults", async () => {
    vi.mocked(withRetry).mockResolvedValue({
      data: {
        calories_consumed: null,
        protein_consumed_g: null,
        carbs_consumed_g: null,
        fat_consumed_g: null,
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.todayProgress).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("sets error on network failure", async () => {
    vi.mocked(withRetry).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.error).toBeTruthy();
  });
});