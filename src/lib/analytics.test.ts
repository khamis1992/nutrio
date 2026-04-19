import { describe, it, expect } from "vitest";
import { sanitizeProperties } from "./analytics";

describe("analytics", () => {
  describe("sanitizeProperties", () => {
    it("passes through non-sensitive properties", () => {
      const result = sanitizeProperties({ user_id: "123", plan: "standard" });
      expect(result.user_id).toBe("123");
      expect(result.plan).toBe("standard");
    });

    it("redacts email properties", () => {
      const result = sanitizeProperties({ email: "test@example.com" });
      expect(result.email).toBe("[REDACTED]");
    });

    it("redacts phone properties", () => {
      const result = sanitizeProperties({ phone: "+97412345678" });
      expect(result.phone).toBe("[REDACTED]");
    });

    it("redacts password properties", () => {
      const result = sanitizeProperties({ password: "secret123" });
      expect(result.password).toBe("[REDACTED]");
    });

    it("redacts token properties (case-insensitive)", () => {
      const result = sanitizeProperties({ token: "abc", ACCESS_TOKEN: "xyz" });
      expect(result.token).toBe("[REDACTED]");
      expect(result.ACCESS_TOKEN).toBe("[REDACTED]");
    });

    it("redacts secret properties", () => {
      const result = sanitizeProperties({ secret: "s3cr3t" });
      expect(result.secret).toBe("[REDACTED]");
    });

    it("redacts credit_card properties", () => {
      const result = sanitizeProperties({ credit_card: "4111111111111111" });
      expect(result.credit_card).toBe("[REDACTED]");
    });

    it("handles mixed sensitive and non-sensitive properties", () => {
      const result = sanitizeProperties({
        order_id: "ord-123",
        amount: 50,
        email: "user@test.com",
        status: "completed",
        password: "hunter2",
      });
      expect(result.order_id).toBe("ord-123");
      expect(result.amount).toBe(50);
      expect(result.email).toBe("[REDACTED]");
      expect(result.status).toBe("completed");
      expect(result.password).toBe("[REDACTED]");
    });

    it("returns empty object when no properties passed", () => {
      const result = sanitizeProperties();
      expect(result).toEqual({});
    });

    it("redacts access_token", () => {
      const result = sanitizeProperties({ access_token: "tok123" });
      expect(result.access_token).toBe("[REDACTED]");
    });

    it("redacts refresh_token", () => {
      const result = sanitizeProperties({ refresh_token: "ref456" });
      expect(result.refresh_token).toBe("[REDACTED]");
    });

    it("does not redact api_key (not in sensitive list)", () => {
      const result = sanitizeProperties({ api_key: "key789" });
      expect(result.api_key).toBe("key789");
    });

    it("redacts user_password", () => {
      const result = sanitizeProperties({ user_password: "pw123" });
      expect(result.user_password).toBe("[REDACTED]");
    });

    it("handles empty object", () => {
      const result = sanitizeProperties({});
      expect(result).toEqual({});
    });

    it("does not redact non-sensitive keys like user_id", () => {
      const result = sanitizeProperties({ user_id: "u1", plan: "basic" });
      expect(result.user_id).toBe("u1");
      expect(result.plan).toBe("basic");
    });
  });

  describe("AnalyticsEvents", () => {
    it("has all required event names", async () => {
      const { AnalyticsEvents } = await import("./analytics");
      expect(AnalyticsEvents.USER_SIGNED_UP).toBe("user_signed_up");
      expect(AnalyticsEvents.USER_LOGGED_IN).toBe("user_logged_in");
      expect(AnalyticsEvents.USER_LOGGED_OUT).toBe("user_logged_out");
      expect(AnalyticsEvents.ORDER_STARTED).toBe("order_started");
      expect(AnalyticsEvents.ORDER_COMPLETED).toBe("order_completed");
      expect(AnalyticsEvents.ORDER_CANCELLED).toBe("order_cancelled");
      expect(AnalyticsEvents.SUBSCRIPTION_STARTED).toBe("subscription_started");
      expect(AnalyticsEvents.SUBSCRIPTION_CANCELLED).toBe("subscription_cancelled");
      expect(AnalyticsEvents.SUBSCRIPTION_UPGRADED).toBe("subscription_upgraded");
      expect(AnalyticsEvents.WALLET_TOPUP_INITIATED).toBe("wallet_topup_initiated");
      expect(AnalyticsEvents.WALLET_TOPUP_COMPLETED).toBe("wallet_topup_completed");
      expect(AnalyticsEvents.APP_OPENED).toBe("app_opened");
      expect(AnalyticsEvents.APP_CLOSED).toBe("app_closed");
      expect(AnalyticsEvents.ERROR_OCCURRED).toBe("error_occurred");
    });
  });
});