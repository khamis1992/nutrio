import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarDay: () => "2026-04-15",
}));

vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn((fn) => fn()),
}));

import { supabase } from "@/integrations/supabase/client";

describe("useDashboardRolloverCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 rolloverCredits when userId is undefined", () => {
    const { result } = renderHook(() => useDashboardRolloverCredits(undefined));
    expect(result.current.rolloverCredits).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it("fetches and sums rollover credits", async () => {
    const mockData = [
      { rollover_credits: 3 },
      { rollover_credits: 2 },
    ];

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useDashboardRolloverCredits("user-1"));

    await waitFor(() => {
      expect(result.current.rolloverCredits).toBe(5);
      expect(result.current.loading).toBe(false);
    });
  });

  it("returns 0 when no active rollovers", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useDashboardRolloverCredits("user-1"));

    await waitFor(() => {
      expect(result.current.rolloverCredits).toBe(0);
      expect(result.current.loading).toBe(false);
    });
  });

  it("handles null data gracefully", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useDashboardRolloverCredits("user-1"));

    await waitFor(() => {
      expect(result.current.rolloverCredits).toBe(0);
      expect(result.current.loading).toBe(false);
    });
  });

  it("sets error on fetch exception", async () => {
    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useDashboardRolloverCredits("user-1"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });

  it("handles rollover_credits being null in data rows", async () => {
    const mockData = [
      { rollover_credits: null },
      { rollover_credits: 4 },
    ];

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useDashboardRolloverCredits("user-1"));

    await waitFor(() => {
      expect(result.current.rolloverCredits).toBe(4);
    });
  });
});