import { describe, expect, it } from "vitest";

import { shouldShowSubscriptionReactivation } from "@/pages/subscription/subscriptionPlanFlow";

describe("shouldShowSubscriptionReactivation", () => {
  it("does not show reactivation copy for an active subscription", () => {
    expect(shouldShowSubscriptionReactivation("reactivation", "active")).toBe(false);
  });

  it("shows reactivation copy only for inactive subscription states", () => {
    expect(shouldShowSubscriptionReactivation("reactivation", "expired")).toBe(true);
    expect(shouldShowSubscriptionReactivation("reactivation", "pending")).toBe(true);
    expect(shouldShowSubscriptionReactivation("reactivation", "cancelled")).toBe(true);
  });

  it("ignores inactive states when the route is not a reactivation flow", () => {
    expect(shouldShowSubscriptionReactivation(null, "expired")).toBe(false);
  });
});
