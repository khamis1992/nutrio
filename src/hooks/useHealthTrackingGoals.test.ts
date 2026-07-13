import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHealthTrackingGoals } from "@/hooks/useHealthTrackingGoals";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
};

describe("useHealthTrackingGoals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the authenticated user's persisted goals", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: [{ water_goal_ml: 3200, step_goal: 9000 }],
      error: null,
    } as never);

    const { result } = renderHook(
      () => useHealthTrackingGoals("user-1"),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.goals).toEqual({ waterGoalMl: 3200, stepGoal: 9000 });
    expect(supabase.rpc).toHaveBeenCalledWith("get_own_health_tracking_goals");
  });

  it("persists a goal through the owner-bound RPC", async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: [{ water_goal_ml: 2500, step_goal: 6000 }],
        error: null,
      } as never)
      .mockResolvedValueOnce({
        data: [{ water_goal_ml: 3000, step_goal: 6000 }],
        error: null,
      } as never);

    const { result } = renderHook(
      () => useHealthTrackingGoals("user-1"),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateGoals({ waterGoalMl: 3000 });
    });

    expect(supabase.rpc).toHaveBeenLastCalledWith(
      "set_own_health_tracking_goals",
      { p_water_goal_ml: 3000, p_step_goal: null },
    );
    await waitFor(() => expect(result.current.goals.waterGoalMl).toBe(3000));
  });

  it("does not query user goals while signed out", () => {
    const { result } = renderHook(
      () => useHealthTrackingGoals(undefined),
      { wrapper: createWrapper() },
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.goals).toEqual({ waterGoalMl: 2500, stepGoal: 6000 });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
