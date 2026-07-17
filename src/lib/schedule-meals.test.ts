import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { scheduleMealsAtomic, scheduleMealsResilient } from "@/lib/schedule-meals";
import { readOfflineMutations } from "@/lib/offline-mutation-queue";

const rpc = vi.mocked(supabase.rpc);

describe("scheduleMealsAtomic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("sends the complete batch through one idempotent RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        already_processed: false,
        schedule_ids: ["schedule-1", "schedule-2"],
      },
      error: null,
    } as never);

    const items = [
      {
        meal_id: "meal-1",
        scheduled_date: "2026-07-13",
        meal_type: "lunch" as const,
        addons: [{ addon_id: "addon-1", quantity: 2 }],
      },
      {
        meal_id: "meal-2",
        scheduled_date: "2026-07-13",
        meal_type: "dinner" as const,
      },
    ];

    await expect(
      scheduleMealsAtomic("subscription-1", items, "00000000-0000-4000-8000-000000000001"),
    ).resolves.toEqual({
      success: true,
      already_processed: false,
      schedule_ids: ["schedule-1", "schedule-2"],
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("schedule_meals_atomic", {
      p_subscription_id: "subscription-1",
      p_items: items,
      p_request_batch_id: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("propagates quota and wallet failures", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error("MEAL_QUOTA_EXHAUSTED"),
    } as never);

    await expect(scheduleMealsAtomic("subscription-1", [{
      meal_id: "meal-1",
      scheduled_date: "2026-07-13",
      meal_type: "lunch",
    }], "00000000-0000-4000-8000-000000000002")).rejects.toThrow("MEAL_QUOTA_EXHAUSTED");
  });

  it("rejects a malformed successful response", async () => {
    rpc.mockResolvedValue({ data: { success: true }, error: null } as never);

    await expect(scheduleMealsAtomic("subscription-1", [{
      meal_id: "meal-1",
      scheduled_date: "2026-07-13",
      meal_type: "lunch",
    }], "00000000-0000-4000-8000-000000000003")).rejects.toThrow("MEAL_SCHEDULING_FAILED");
  });

  it("queues a stable batch while offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const items = [{
      meal_id: "meal-1",
      scheduled_date: "2026-07-13",
      meal_type: "lunch" as const,
    }];

    await expect(scheduleMealsResilient(
      "user-1",
      "subscription-1",
      items,
      "00000000-0000-4000-8000-000000000004",
    )).resolves.toMatchObject({ queued: true });

    expect(rpc).not.toHaveBeenCalled();
    expect(readOfflineMutations()).toHaveLength(1);
  });
});
