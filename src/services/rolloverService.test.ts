import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/dateUtils", () => ({
  getQatarDay: () => "2026-07-19",
}));

import { fetchRolloverCredits } from "@/services/rolloverService";

function createSubscriptionQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        meals_per_month: 40,
        meals_used_this_month: 15,
        rollover_credits: 1,
      },
      error: null,
    }),
  };
}

function createRolloverQuery() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          id: "rollover-1",
          subscription_id: "subscription-1",
          user_id: "user-1",
          rollover_credits: 3,
          expiry_date: "2026-07-25",
          is_consumed: false,
          status: "active",
          source_cycle_start: "2026-06-01",
          source_cycle_end: "2026-06-30",
          created_at: "2026-07-01T00:00:00Z",
          updated_at: "2026-07-01T00:00:00Z",
          consumed_at: null,
        },
        {
          id: "rollover-2",
          subscription_id: "subscription-1",
          user_id: "user-1",
          rollover_credits: 2,
          expiry_date: "2026-07-28",
          is_consumed: false,
          status: "active",
          source_cycle_start: "2026-06-01",
          source_cycle_end: "2026-06-30",
          created_at: "2026-07-01T00:00:00Z",
          updated_at: "2026-07-01T00:00:00Z",
          consumed_at: null,
        },
      ],
      error: null,
    }),
  };
}

describe("fetchRolloverCredits", () => {
  beforeEach(() => {
    mocks.from.mockReset();
  });

  it("uses active rollover records instead of returning placeholder zeroes", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "subscriptions") return createSubscriptionQuery();
      if (table === "subscription_rollovers") return createRolloverQuery();
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(fetchRolloverCredits("subscription-1")).resolves.toEqual({
      rollover_credits: 5,
      expiry_date: "2026-07-25",
      total_credits: 30,
      new_credits: 25,
    });
  });
});
