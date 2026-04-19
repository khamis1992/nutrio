import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSubscription } from "@/hooks/useSubscription";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    }),
    removeChannel: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test" } } }) },
    realtime: { setAuth: vi.fn() },
  },
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarDay: () => "2026-04-15",
}));

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const buildChain = (resolver: () => Promise<any>) => {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.gte = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockImplementation(resolver);
  return chain;
};

describe("useSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      session: null,
      loading: false,
      signUp: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    (supabase as any).channel = vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    });
  });

  it("returns null subscription when user is null", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscription).toBeNull();
    expect(result.current.hasActiveSubscription).toBe(false);
  });

  it("returns default values when no subscription data", async () => {
    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return buildChain(async () => ({ data: null, error: null }));
      }
      return buildChain(async () => ({ data: null, error: null }));
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.subscription).toBeNull();
    expect(result.current.hasActiveSubscription).toBe(false);
    expect(result.current.remainingMeals).toBe(0);
  });

  it("recognizes active subscription with derived values", async () => {
    const mockSub = {
      id: "sub-1", plan: "standard", status: "active",
      start_date: "2026-04-01", end_date: "2026-05-01",
      meals_per_month: 30, meals_used_this_month: 15,
      month_start_date: "2026-04-01",
      meals_per_week: 7, meals_used_this_week: 3,
      week_start_date: "2026-04-13",
      tier: "standard", active: true,
    };

    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return buildChain(async () => ({ data: mockSub, error: null }));
      }
      if (callIdx === 2) {
        return buildChain(async () => ({ data: { snacks_per_month: 0, snacks_used_this_month: 0 }, error: null }));
      }
      return buildChain(async () => ({ data: null, error: null }));
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.hasActiveSubscription).toBe(true);
    expect(result.current.isUnlimited).toBe(false);
    expect(result.current.isVip).toBe(false);
    expect(result.current.remainingMeals).toBe(15);
    expect(result.current.mealsUsed).toBe(15);
    expect(result.current.totalMeals).toBe(30);
  });

  it("recognizes VIP tier as unlimited", async () => {
    const vipSub = {
      id: "sub-vip", plan: "vip", status: "active",
      start_date: "2026-04-01", end_date: "2026-05-01",
      meals_per_month: 0, meals_used_this_month: 0,
      month_start_date: "2026-04-01",
      meals_per_week: 0, meals_used_this_week: 0,
      week_start_date: "2026-04-13",
      tier: "vip", active: true,
    };

    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return buildChain(async () => ({ data: vipSub, error: null }));
      }
      if (callIdx === 2) {
        return buildChain(async () => ({ data: { snacks_per_month: 0, snacks_used_this_month: 0 }, error: null }));
      }
      return buildChain(async () => ({ data: null, error: null }));
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.isVip).toBe(true);
    expect(result.current.isUnlimited).toBe(true);
  });

  it("returns false from incrementMealUsage when no subscription", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null, session: null, loading: false, signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn(),
    });
    const { result } = renderHook(() => useSubscription());
    const res = await result.current.incrementMealUsage();
    expect(res).toBe(false);
  });

  it("recognizes cancelled-but-unexpired subscription as active", async () => {
    const cancelledSub = {
      id: "sub-cancelled", plan: "standard", status: "cancelled",
      start_date: "2026-03-01", end_date: "2099-12-31",
      meals_per_month: 30, meals_used_this_month: 5,
      month_start_date: "2026-04-01",
      meals_per_week: 7, meals_used_this_week: 2,
      week_start_date: "2026-04-13",
      tier: "standard", active: true,
    };

    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return buildChain(async () => ({ data: null, error: null }));
      }
      if (callIdx === 2) {
        return buildChain(async () => ({ data: cancelledSub, error: null }));
      }
      return buildChain(async () => ({ data: { snacks_per_month: 0, snacks_used_this_month: 0 }, error: null }));
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.hasActiveSubscription).toBe(true);
  });

  it("recognizes paused subscription via isPaused", async () => {
    const pendingSub = {
      id: "sub-pending", plan: "standard", status: "pending",
      start_date: "2026-04-01", end_date: "2026-05-01",
      meals_per_month: 30, meals_used_this_month: 0,
      month_start_date: "2026-04-01",
      meals_per_week: 7, meals_used_this_week: 0,
      week_start_date: "2026-04-13",
      tier: "standard", active: true,
    };

    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return buildChain(async () => ({ data: pendingSub, error: null }));
      }
      return buildChain(async () => ({ data: { snacks_per_month: 0, snacks_used_this_month: 0 }, error: null }));
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.isPaused).toBe(true);
  });

  it("computes snack values correctly", async () => {
    const subWithSnacks = {
      id: "sub-snack", plan: "premium", status: "active",
      start_date: "2026-04-01", end_date: "2026-05-01",
      meals_per_month: 30, meals_used_this_month: 10,
      month_start_date: "2026-04-01",
      meals_per_week: 7, meals_used_this_week: 3,
      week_start_date: "2026-04-13",
      snacks_per_month: 8, snacks_used_this_month: 3,
      tier: "premium", active: true,
    };

    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return buildChain(async () => ({ data: subWithSnacks, error: null }));
      }
      return buildChain(async () => ({ data: { snacks_per_month: 8, snacks_used_this_month: 3 }, error: null }));
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.snacksPerMonth).toBe(8);
    expect(result.current.snacksUsed).toBe(3);
    expect(result.current.remainingSnacks).toBe(5);
    expect(result.current.hasSnacks).toBe(true);
  });

  it("canOrderMeal is true when meals remaining", async () => {
    const activeSub = {
      id: "sub-active", plan: "standard", status: "active",
      start_date: "2026-04-01", end_date: "2026-05-01",
      meals_per_month: 30, meals_used_this_month: 10,
      month_start_date: "2026-04-01",
      meals_per_week: 7, meals_used_this_week: 2,
      week_start_date: "2026-04-13",
      tier: "standard", active: true,
    };

    let callIdx = 0;
    (supabase as any).from = vi.fn().mockImplementation(() => {
      callIdx++;
      if (callIdx === 1) {
        return buildChain(async () => ({ data: activeSub, error: null }));
      }
      return buildChain(async () => ({ data: { snacks_per_month: 0, snacks_used_this_month: 0 }, error: null }));
    });

    const { result } = renderHook(() => useSubscription());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.canOrderMeal).toBe(true);
  });
});