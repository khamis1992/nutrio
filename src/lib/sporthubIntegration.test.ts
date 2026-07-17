import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    from: vi.fn(),
  },
}));

import {
  completeSportHubLink,
  startSportHubLink,
  syncSportHub,
  unlinkSportHub,
} from "./sporthubIntegration";

describe("SportHub integration client", () => {
  beforeEach(() => invoke.mockReset());

  it("starts OAuth with the requested return path", async () => {
    invoke.mockResolvedValue({ data: { authorization_url: "https://sporthub.test/oauth" }, error: null });

    await expect(startSportHubLink("/dashboard/activity")).resolves.toBe("https://sporthub.test/oauth");
    expect(invoke).toHaveBeenCalledWith("sporthub-link-start", {
      body: { redirect_path: "/dashboard/activity" },
    });
  });

  it("rejects a link response without an authorization URL", async () => {
    invoke.mockResolvedValue({ data: { error: "not_configured" }, error: null });
    await expect(startSportHubLink()).rejects.toThrow("not_configured");
  });

  it("completes OAuth only through the authenticated one-time claim", async () => {
    const completionToken = "a".repeat(43);
    invoke.mockResolvedValue({
      data: { ok: true, integration_id: "integration-1" },
      error: null,
    });

    await expect(completeSportHubLink(completionToken)).resolves.toMatchObject({
      ok: true,
      integration_id: "integration-1",
    });
    expect(invoke).toHaveBeenCalledWith("sporthub-link-complete", {
      body: { completion_token: completionToken },
    });
  });

  it("rejects malformed completion handles before calling the backend", async () => {
    await expect(completeSportHubLink("short")).rejects.toThrow(
      "completion token is invalid",
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("returns the synchronization result", async () => {
    invoke.mockResolvedValue({
      data: { ok: true, synced: 3, last_synced_at: "2026-07-12T10:00:00Z" },
      error: null,
    });
    await expect(syncSportHub()).resolves.toMatchObject({ ok: true, synced: 3 });
  });

  it("propagates unlink failures", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("network") });
    await expect(unlinkSportHub()).rejects.toThrow("network");
  });
});
