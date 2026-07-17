import { describe, expect, it } from "vitest";

import { buildSafeDeepLink } from "@/hooks/usePushNotificationDeepLink";

const orderId = "00000000-0000-4000-8000-000000000123";

describe("push notification deep-link validation", () => {
  it("builds only known application routes", () => {
    expect(buildSafeDeepLink({ type: "delivery_tracking", id: orderId }))
      .toBe(`/live/${orderId}`);
    expect(buildSafeDeepLink({ type: "meal_detail", id: orderId }))
      .toBe(`/meals/${orderId}`);
    expect(buildSafeDeepLink({ type: "weight_tracking" }))
      .toBe("/weight-tracking");
  });

  it("rejects path traversal and unresolved identifiers", () => {
    expect(buildSafeDeepLink({ type: "delivery_tracking", id: "../../admin" }))
      .toBeNull();
    expect(buildSafeDeepLink({ type: "restaurant" })).toBeNull();
    expect(buildSafeDeepLink({ type: "unknown", id: orderId })).toBeNull();
  });

  it("allows only per-route bounded query parameters", () => {
    expect(buildSafeDeepLink({ type: "progress", params: { tab: "goals" } }))
      .toBe("/progress?tab=goals");
    expect(buildSafeDeepLink({ type: "progress", params: { redirect: "//evil.test" } }))
      .toBeNull();
    expect(buildSafeDeepLink({ type: "checkout", params: { planId: orderId } }))
      .toBeNull();
  });
});
