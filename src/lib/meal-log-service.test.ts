import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/lib/community-challenge-service", () => ({
  syncCommunityChallengeProgressQuietly: vi.fn().mockResolvedValue(undefined),
}));

import { supabase } from "@/integrations/supabase/client";
import { logMealItems } from "@/lib/meal-log-service";

const rpc = vi.mocked(supabase.rpc);

describe("logMealItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
  });

  it("logs normalized nutrition through one authenticated atomic RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        success: true,
        duplicate: false,
        history_ids: ["history-1"],
        logged_count: 1,
        xp_awarded: 20,
      },
      error: null,
    } as never);
    const track = vi.fn();

    await expect(logMealItems({
      userId: "user-1",
      logDate: "2026-07-12",
      source: "barcode",
      track,
      items: [{
        name: "Chicken Bowl",
        calories: 420.4,
        protein_g: 35.2,
        carbs_g: 44.1,
        fat_g: 11.8,
        image_url: "https://example.test/meal.jpg",
        quantity: 2,
      }],
    })).resolves.toEqual({
      persisted: true,
      loggedCount: 1,
      calories: 841,
      protein: 70,
      carbs: 88,
      fat: 24,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("log_manual_meal_items_v3", {
      p_items: [{
        name: "Chicken Bowl",
        calories: 841,
        protein_g: 70,
        carbs_g: 88,
        fat_g: 24,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
        image_url: "https://example.test/meal.jpg",
      }],
      p_log_date: "2026-07-12",
      p_request_id: "00000000-0000-4000-8000-000000000001",
      p_source: "barcode",
      p_started_consuming_at: expect.any(String),
      p_time_precision: "exact",
      p_timezone_name: expect.any(String),
      p_utc_offset_minutes: expect.any(Number),
    });
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain("user-1");
    expect(track).toHaveBeenCalledWith("xp_earned", { amount: 20, source: "barcode" });
  });

  it("falls back to the v2 RPC while the v3 migration is pending", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "not found" } } as never)
      .mockResolvedValueOnce({
        data: { success: true, logged_count: 1, history_ids: ["history-1"] },
        error: null,
      } as never);

    await expect(logMealItems({
      userId: "user-1",
      items: [{ name: "Soup", calories: 180, protein_g: 8, carbs_g: 25, fat_g: 5 }],
    })).resolves.toMatchObject({ persisted: true, loggedCount: 1 });

    const rpcNames = (rpc.mock.calls as unknown as Array<[string]>).map((call) => call[0]);
    expect(rpcNames).toEqual([
      "log_manual_meal_items_v3",
      "log_manual_meal_items_v2",
    ]);
  });

  it("propagates server validation failures without partial client writes", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: new Error("INVALID_MEAL_ITEM_AT_INDEX_1"),
    } as never);

    await expect(logMealItems({
      userId: "user-1",
      items: [{ name: "Invalid", calories: 100, protein_g: 0, carbs_g: 0, fat_g: 0 }],
    })).rejects.toThrow("INVALID_MEAL_ITEM_AT_INDEX_1");
  });

  it("rejects zero nutrition without reporting a successful log", async () => {
    await expect(logMealItems({
      userId: "user-1",
      items: [{ name: "Empty", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }],
    })).rejects.toThrow("EMPTY_NUTRITION_AT_INDEX_1");

    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid nutrition without calling the backend", async () => {
    await expect(logMealItems({
      userId: "user-1",
      items: [{ name: "Invalid", calories: Number.NaN, protein_g: 10, carbs_g: 0, fat_g: 0 }],
    })).rejects.toThrow("INVALID_MEAL_ITEM_AT_INDEX_1");

    expect(rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC does not confirm that every item was persisted", async () => {
    rpc.mockResolvedValue({
      data: { success: true, logged_count: 0, history_ids: [] },
      error: null,
    } as never);

    await expect(logMealItems({
      userId: "user-1",
      items: [{ name: "Chicken Bowl", calories: 420, protein_g: 35, carbs_g: 44, fat_g: 12 }],
    })).rejects.toThrow("MEAL_LOG_NOT_PERSISTED");
  });
});
