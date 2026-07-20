import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgramCompletions } from "@/hooks/useProgramCompletions";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/community-challenge-service", () => ({
  syncCommunityChallengeProgressQuietly: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from "@/integrations/supabase/client";

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

type CompletionRow = {
  id: string;
  program_meal_id: string;
  client_id: string;
  completed_at: string;
  notes: null;
};

function queryResult(getData: () => unknown[]) {
  const result = () => Promise.resolve({ data: getData(), error: null });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
      result().then(resolve),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.gte.mockImplementation(result);
  return query;
}

describe("useProgramCompletions coach meals", () => {
  let mealRows: CompletionRow[];
  let exerciseQuery: ReturnType<typeof queryResult>;
  let mealQuery: ReturnType<typeof queryResult>;

  beforeEach(() => {
    vi.clearAllMocks();
    mealRows = [];
    exerciseQuery = queryResult(() => []);
    mealQuery = queryResult(() => mealRows);
    fromMock.mockImplementation((table: string) => (
      table === "program_meal_completions" ? mealQuery : exerciseQuery
    ));
  });

  it("records a full canonical consumption with exact timing", async () => {
    rpcMock.mockImplementation(async (_name: string, params: Record<string, unknown>) => {
      mealRows = [{
        id: "completion-1",
        program_meal_id: "program-meal-1",
        client_id: "client-1",
        completed_at: "2026-07-20",
        notes: null,
      }];
      return {
        data: { success: true, status: (params as { p_status: string }).p_status },
        error: null,
      };
    });

    const { result } = renderHook(() => useProgramCompletions("client-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleMeal("program-meal-1", {
        startedConsumingAt: "2026-07-20T12:15:00.000Z",
        timePrecision: "exact",
        timezoneName: "Asia/Qatar",
        utcOffsetMinutes: 180,
      });
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "record_coach_program_meal_consumption",
      expect.objectContaining({
        p_program_meal_id: "program-meal-1",
        p_status: "full",
        p_started_consuming_at: "2026-07-20T12:15:00.000Z",
        p_time_precision: "exact",
        p_timezone_name: "Asia/Qatar",
        p_utc_offset_minutes: 180,
      }),
    );
    expect(result.current.isMealCompleted("program-meal-1")).toBe(true);
    expect(mealQuery.gte).not.toHaveBeenCalled();
  });

  it("reverses an existing meal through the same canonical RPC", async () => {
    mealRows = [{
      id: "completion-1",
      program_meal_id: "program-meal-1",
      client_id: "client-1",
      completed_at: "2026-07-19",
      notes: null,
    }];
    rpcMock.mockImplementation(async () => {
      mealRows = [];
      return { data: { success: true, status: "reversed" }, error: null };
    });

    const { result } = renderHook(() => useProgramCompletions("client-1"));
    await waitFor(() => expect(result.current.isMealCompleted("program-meal-1")).toBe(true));

    await act(async () => {
      await result.current.toggleMeal("program-meal-1");
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "record_coach_program_meal_consumption",
      expect.objectContaining({
        p_program_meal_id: "program-meal-1",
        p_status: "reversed",
      }),
    );
    expect(result.current.isMealCompleted("program-meal-1")).toBe(false);
  });
});
