import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disconnectGoogleFit: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/google-fit-workout-service", () => ({
  disconnectGoogleFit: mocks.disconnectGoogleFit,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

import { disconnectWearableProvider } from "@/lib/wearable-disconnect";

describe("disconnectWearableProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.disconnectGoogleFit.mockResolvedValue(true);
    mocks.rpc.mockResolvedValue({ data: { ok: true, revoked_samples: 4 }, error: null });
  });

  it("removes Google credentials before revoking provider samples", async () => {
    await expect(disconnectWearableProvider("google_fit")).resolves.toEqual({
      ok: true,
      revoked_samples: 4,
    });
    expect(mocks.disconnectGoogleFit).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_wearable_provider", {
      p_provider: "google_fit",
    });
    expect(mocks.disconnectGoogleFit.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.rpc.mock.invocationCallOrder[0],
    );
  });

  it("revokes Apple Health samples without a Google credential call", async () => {
    await disconnectWearableProvider("apple_health");
    expect(mocks.disconnectGoogleFit).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_wearable_provider", {
      p_provider: "apple_health",
    });
  });

  it("keeps the local connection intact when server credential deletion fails", async () => {
    mocks.disconnectGoogleFit.mockResolvedValue(false);
    await expect(disconnectWearableProvider("google_fit")).rejects.toThrow(
      "Google Fit credentials could not be revoked",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
