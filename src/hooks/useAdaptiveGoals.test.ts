import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAdaptiveGoals } from "@/hooks/useAdaptiveGoals";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarDay: () => "2026-04-15",
}));

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const localStorageStore: Record<string, string> = {};

describe("useAdaptiveGoals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);

    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    (supabase as any).from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    (supabase as any).functions = {
      invoke: vi.fn().mockResolvedValue({ data: null, error: { message: "CORS error" } }),
    };
  });

  it("initializes with null recommendation", () => {
    const { result } = renderHook(() => useAdaptiveGoals());
    expect(result.current.recommendation).toBeNull();
  });

  it("sets edgeFunctionAvailable to false on CORS error", async () => {
    (supabase as any).functions = {
      invoke: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "CORS error blocking request" },
      }),
    };

    const { result } = renderHook(() => useAdaptiveGoals());
    await waitFor(() => {
      expect(result.current.edgeFunctionAvailable).toBe(false);
    });
  });

  it("returns default values when user is null", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    });

    const { result } = renderHook(() => useAdaptiveGoals());
    expect(result.current.recommendation).toBeNull();
    expect(result.current.hasUnviewedAdjustment).toBe(false);
  });

  it("dismissAdjustment sets hasUnviewedAdjustment to false", async () => {
    const { result } = renderHook(() => useAdaptiveGoals());
    await act(async () => {
      await result.current.dismissAdjustment();
    });
    expect(result.current.hasUnviewedAdjustment).toBe(false);
  });

  it("fetchSettings updates settings when data exists", async () => {
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      if (table === "adaptive_goal_settings") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  auto_adjust_enabled: true,
                  adjustment_frequency: "weekly",
                  min_calorie_floor: 1200,
                  max_calorie_ceiling: 3000,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const { result } = renderHook(() => useAdaptiveGoals());
    await waitFor(() => expect(result.current.settingsLoading).toBe(false));
    expect(result.current.settings).toEqual({
      auto_adjust_enabled: true,
      adjustment_frequency: "weekly",
      min_calorie_floor: 1200,
      max_calorie_ceiling: 3000,
    });
  });

  it("fetchHistory updates adjustmentHistory", async () => {
    const mockHistory = [
      {
        id: "adj-1",
        adjustment_date: "2026-04-10",
        previous_calories: 2000,
        new_calories: 1800,
        reason: "Plateau detected",
        weight_change_kg: -0.5,
        adherence_rate: 0.85,
        plateau_detected: true,
        ai_confidence: 0.9,
        applied: true,
      },
    ];

    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      callIdx++;
      if (table === "goal_adjustment_history") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockHistory, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const { result } = renderHook(() => useAdaptiveGoals());
    await waitFor(() => expect(result.current.historyLoading).toBe(false));
    expect(result.current.adjustmentHistory).toHaveLength(1);
    expect(result.current.adjustmentHistory[0].new_calories).toBe(1800);
  });

  it("updateSettings calls supabase update and merges settings", async () => {
    (supabase as any).from = vi.fn().mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      };
    });

    const { result } = renderHook(() => useAdaptiveGoals());
    await waitFor(() => expect(result.current.settingsLoading).toBe(false));

    const success = await act(async () => {
      return result.current.updateSettings({ auto_adjust_enabled: false });
    });

    expect(success).toBe(true);
  });
});