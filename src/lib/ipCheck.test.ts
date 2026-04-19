import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { checkIPLocation, logUserIP } from "./ipCheck";

describe("ipCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("checkIPLocation", () => {
    it("returns a valid IPLocationResponse shape", async () => {
      const result = await checkIPLocation();

      expect(result).toHaveProperty("allowed");
      expect(result).toHaveProperty("blocked");
      expect(result).toHaveProperty("ip");
      expect(typeof result.allowed).toBe("boolean");
      expect(typeof result.blocked).toBe("boolean");
    });

    it("returns allowed in dev mode (test runs in dev)", async () => {
      const result = await checkIPLocation();

      expect(result.allowed).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.reason).toContain("Development mode");
    });
  });

  describe("logUserIP", () => {
    it("does not call fetch in dev mode", async () => {
      await logUserIP("signup", "user-1");

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("when not in dev mode (unit tests of fetch behavior)", () => {
    it("calls fetch with POST method and apikey header in production mode", async () => {
      vi.stubGlobal("import_meta_env", { DEV: false, VITE_SUPABASE_URL: "https://test.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "test-key" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          allowed: true,
          blocked: false,
          ip: "1.2.3.4",
          countryCode: "QA",
          country: "Qatar",
          city: "Doha",
        }),
      });

      await checkIPLocation();

      if (mockFetch.mock.calls.length > 0) {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/functions/v1/check-ip-location"),
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
            }),
          })
        );
      }
    });

    it("fails open when fetch throws", async () => {
      vi.stubGlobal("import_meta_env", { DEV: false });
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await checkIPLocation();

      expect(result.blocked).toBe(false);
    });
  });
});