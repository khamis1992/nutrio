import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, invokeFunction } = vi.hoisted(() => ({
  rpc: vi.fn(),
  invokeFunction: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    functions: { invoke: invokeFunction },
  },
}));

import {
  HEALTH_CONTEXT_AI_POLICY_VERSION,
  exportUserDataWithHealthContext,
  fetchHealthContextState,
  saveHealthContextEntry,
  setHealthContextAiConsent,
} from "@/lib/health-context";

describe("health context client contract", () => {
  beforeEach(() => {
    rpc.mockReset();
    invokeFunction.mockReset();
  });

  it("loads only the authenticated user's server-composed state", async () => {
    rpc.mockResolvedValue({
      data: { feature_enabled: true, entries: [] },
      error: null,
    });

    await expect(fetchHealthContextState(30)).resolves.toMatchObject({
      feature_enabled: true,
    });
    expect(rpc).toHaveBeenCalledWith("get_health_context_state", { p_days: 30 });
  });

  it("bounds private notes and sends structured journal fields", async () => {
    rpc.mockResolvedValue({ data: { id: "entry-1" }, error: null });

    await saveHealthContextEntry({
      entryDate: "2026-07-19",
      mood: 4,
      digestiveSymptoms: ["bloating"],
      note: `  ${"x".repeat(900)}  `,
    });

    expect(rpc).toHaveBeenCalledWith("upsert_health_context_entry", expect.objectContaining({
      p_entry_date: "2026-07-19",
      p_mood: 4,
      p_digestive_symptoms: ["bloating"],
      p_note: "x".repeat(800),
    }));
  });

  it("always sends the reviewed AI consent policy version", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await setHealthContextAiConsent(true);

    expect(rpc).toHaveBeenCalledWith("set_health_context_ai_consent", {
      p_granted: true,
      p_policy_version: HEALTH_CONTEXT_AI_POLICY_VERSION,
    });
  });

  it("uses the complete account export instead of building a partial browser export", async () => {
    invokeFunction.mockResolvedValue({ data: { health_context: {} }, error: null });

    await expect(exportUserDataWithHealthContext()).resolves.toEqual({ health_context: {} });
    expect(invokeFunction).toHaveBeenCalledWith("export-user-data", {
      body: { format: "json" },
    });
  });

  it("propagates RPC errors instead of returning misleading empty data", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "denied" } });

    await expect(fetchHealthContextState()).rejects.toThrow("denied");
  });
});
