import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTodayProgress } from "@/hooks/useTodayProgress";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarDay: () => "2026-04-15",
  QATAR_TIMEZONE: "Asia/Qatar",
}));

import { supabase } from "@/integrations/supabase/client";

const stableDate = new Date("2026-04-15T12:00:00");

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

const mockProgressResponse = (
  response: { data: unknown; error: unknown },
  historyResponse: { count: number | null; error: unknown } = { count: 0, error: null },
) => {
  const maybeSingle = vi.fn().mockResolvedValue(response);
  const progressQuery = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    }),
  };
  const historyQuery = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue(historyResponse),
        }),
      }),
    }),
  };
  (supabase.from as any).mockImplementation((table: string) => (
    table === "progress_logs" ? progressQuery : historyQuery
  ) as never);
  return maybeSingle;
};

const mockProgressFailure = (error: Error) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error });
  const progressQuery = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    }),
  };
  const historyQuery = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockReturnValue({
          lt: vi.fn().mockResolvedValue({ count: 0, error: null }),
        }),
      }),
    }),
  };
  (supabase.from as any).mockImplementation((table: string) => (
    table === "progress_logs" ? progressQuery : historyQuery
  ) as never);
};

describe("useTodayProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default progress when userId is undefined", () => {
    const { result } = renderHook(() =>
      useTodayProgress(undefined, stableDate, 0)
    , { wrapper: createWrapper() });
    expect(result.current.todayProgress).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      mealsLogged: 0,
    });
    expect(result.current.loading).toBe(false);
  });

  it("fetches progress and updates state", async () => {
    mockProgressResponse(
      {
        data: {
          calories_consumed: 1200,
          protein_consumed_g: 80,
          carbs_consumed_g: 150,
          fat_consumed_g: 40,
          fiber_consumed_g: 18,
        },
        error: null,
      },
      { count: 2, error: null },
    );

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    , { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.todayProgress.calories).toBe(1200);
    expect(result.current.todayProgress.fiber).toBe(18);
    expect(result.current.todayProgress.mealsLogged).toBe(2);
  });

  it("refetches progress when progressKey changes", async () => {
    const firstResponse = {
      data: {
        calories_consumed: 400,
        protein_consumed_g: 30,
        carbs_consumed_g: 45,
        fat_consumed_g: 12,
        fiber_consumed_g: 5,
      },
      error: null,
    };
    const secondResponse = {
      data: {
        calories_consumed: 820,
        protein_consumed_g: 65,
        carbs_consumed_g: 89,
        fat_consumed_g: 24,
        fiber_consumed_g: 10,
      },
      error: null,
    };
    const maybeSingle = mockProgressResponse(firstResponse);
    maybeSingle
      .mockResolvedValueOnce(firstResponse)
      .mockResolvedValueOnce(secondResponse);
    const wrapper = createWrapper();

    const { result, rerender } = renderHook(
      ({ progressKey }) => useTodayProgress("user-1", stableDate, progressKey),
      { initialProps: { progressKey: 0 }, wrapper },
    );

    await waitFor(() => {
      expect(result.current.todayProgress.calories).toBe(400);
    });

    rerender({ progressKey: 1 });

    await waitFor(() => {
      expect(result.current.todayProgress.calories).toBe(820);
    });
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("returns zeroed progress when data is null", async () => {
    mockProgressResponse({
      data: null,
      error: null,
    });

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    , { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.todayProgress).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      mealsLogged: 0,
    });
  });

  it("sets error when the progress query returns an error", async () => {
    mockProgressResponse({ data: null, error: new Error("Progress query failed") });

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    , { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.error).toBeTruthy();
  });

  it("handles null fields with defaults", async () => {
    mockProgressResponse({
      data: {
        calories_consumed: null,
        protein_consumed_g: null,
        carbs_consumed_g: null,
        fat_consumed_g: null,
        fiber_consumed_g: null,
      },
      error: null,
    });

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    , { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.todayProgress).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      mealsLogged: 0,
    });
  });

  it("sets error on network failure", async () => {
    mockProgressFailure(new Error("Network error"));

    const { result } = renderHook(() =>
      useTodayProgress("user-1", stableDate, 0)
    , { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    expect(result.current.error).toBeTruthy();
  });
});
