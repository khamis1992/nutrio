import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

import {
  deleteMealResponseData,
  exportMealResponseData,
  revokeMealResponseScopes,
} from "@/lib/meal-response-privacy";

describe("meal-response privacy client", () => {
  beforeEach(() => rpc.mockReset());

  it("passes a stable request UUID to the minimized export RPC", async () => {
    rpc.mockResolvedValue({
      data: {
        schema_version: "meal-response-export-v1",
        request_id: "request-1",
        preferences: {},
      },
      error: null,
    });

    const result = await exportMealResponseData("request-1");

    expect(rpc).toHaveBeenCalledWith("export_my_meal_response_data", {
      p_request_id: "request-1",
    });
    expect(result.consumptions).toEqual([]);
    expect(result.request_id).toBe("request-1");
  });

  it("uses the caller request UUID so scope revocation can be retried safely", async () => {
    rpc.mockResolvedValue({
      data: { action: "revoke_scopes", already_processed: true, scopes: ["glucose_analysis"] },
      error: null,
    });

    const result = await revokeMealResponseScopes(["glucose_analysis"], "request-2");

    expect(rpc).toHaveBeenCalledWith("revoke_my_meal_response_scopes", {
      p_scopes: ["glucose_analysis"],
      p_request_id: "request-2",
      p_policy_version: "2026-07-meal-response-v1",
    });
    expect(result.already_processed).toBe(true);
  });

  it("rejects empty or duplicate scopes before calling the database", async () => {
    await expect(revokeMealResponseScopes([], "request-3"))
      .rejects.toThrow("MEAL_RESPONSE_PRIVACY_SCOPES_REQUIRED");
    await expect(revokeMealResponseScopes(["research_use", "research_use"], "request-3"))
      .rejects.toThrow("MEAL_RESPONSE_PRIVACY_SCOPES_REQUIRED");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exposes an explicit full-delete action without deleting nutrition logs", async () => {
    rpc.mockResolvedValue({
      data: {
        action: "delete_dataset",
        already_processed: false,
        canonical_nutrition_logs_retained: true,
      },
      error: null,
    });

    const result = await deleteMealResponseData("request-4");

    expect(rpc).toHaveBeenCalledWith("delete_my_meal_response_data", {
      p_request_id: "request-4",
      p_policy_version: "2026-07-meal-response-v1",
    });
    expect(result.canonical_nutrition_logs_retained).toBe(true);
  });
});
