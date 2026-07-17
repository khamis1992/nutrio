import { describe, expect, it } from "vitest";

import {
  dedupeSubscriptionPlans,
  normalizeSubscriptionPlanInterval,
  type DbSubscriptionPlan,
} from "@/hooks/useSubscriptionPlans";

const createPlan = (
  overrides: Partial<DbSubscriptionPlan>,
): DbSubscriptionPlan => ({
  id: "plan-1",
  tier: "weekly",
  name_ar: null,
  description: null,
  description_en: null,
  short_description: null,
  short_description_ar: null,
  price_qar: 450,
  billing_interval: "weekly",
  meals_per_month: 5,
  meals_per_week: 5,
  snacks_per_month: 10,
  daily_meals: 1,
  daily_snacks: 1,
  price_per_meal: null,
  price_per_snack: null,
  features: [],
  is_active: true,
  discount_percent: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("normalizeSubscriptionPlanInterval", () => {
  it("keeps weekly tier plans in the weekly billing filter", () => {
    expect(normalizeSubscriptionPlanInterval("monthly", "weekly")).toBe("weekly");
  });

  it("keeps supported billing intervals for non-weekly plans", () => {
    expect(normalizeSubscriptionPlanInterval("monthly", "fresh")).toBe("monthly");
    expect(normalizeSubscriptionPlanInterval("annual", "elite")).toBe("annual");
  });

  it("defaults unknown intervals to monthly", () => {
    expect(normalizeSubscriptionPlanInterval(null, "healthy")).toBe("monthly");
    expect(normalizeSubscriptionPlanInterval("custom", "healthy")).toBe("monthly");
  });

  it("deduplicates equivalent plans after interval normalization", () => {
    const plans = dedupeSubscriptionPlans([
      createPlan({ id: "old-weekly", updated_at: "2026-01-01T00:00:00Z" }),
      createPlan({ id: "new-weekly", updated_at: "2026-02-01T00:00:00Z" }),
      createPlan({ id: "monthly-fresh", tier: "fresh", billing_interval: "monthly" }),
    ]);

    expect(plans).toHaveLength(2);
    expect(plans.some((plan) => plan.id === "new-weekly")).toBe(true);
    expect(plans.some((plan) => plan.id === "old-weekly")).toBe(false);
  });
});
