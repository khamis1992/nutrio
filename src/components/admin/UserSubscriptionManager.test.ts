import { describe, expect, it } from "vitest";

import {
  buildAdminSubscriptionWalletArgs,
  ensureActiveSubscriptionEndDate,
  getEditableSubscriptionStatus,
  getNextSubscriptionEndDate,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  normalizeSubscriptionTier,
  parseSubscriptionNumberInput,
} from "@/components/admin/userSubscriptionPayload";

describe("UserSubscriptionManager save payload", () => {
  it("includes every editable subscription, meal, and wallet field", () => {
    const args = buildAdminSubscriptionWalletArgs({
      userId: "user-1",
      subscriptionId: "sub-1",
      form: {
        selectedPlan: "monthly",
        selectedStatus: "active",
        selectedTier: "standard",
        mealsPerWeek: "10",
        mealsPerMonth: "43",
        mealsUsedWeek: "2",
        mealsUsed: "7",
        price: "499",
        endDate: "2026-03-24",
        walletBalance: "125.50",
      },
    });

    expect(args).toEqual({
      p_user_id: "user-1",
      p_subscription_id: "sub-1",
      p_plan: "monthly",
      p_status: "active",
      p_tier: "standard",
      p_meals_per_week: 10,
      p_meals_per_month: 43,
      p_meals_used_this_week: 2,
      p_meals_used_this_month: 7,
      p_price: 499,
      p_end_date: getNextSubscriptionEndDate("monthly"),
      p_includes_gym: false,
      p_wallet_balance: 125.5,
    });
  });

  it("lets action buttons reuse saved subscription values with targeted overrides", () => {
    const args = buildAdminSubscriptionWalletArgs({
      userId: "user-1",
      subscriptionId: "sub-1",
      form: {
        selectedPlan: "monthly",
        selectedStatus: "active",
        selectedTier: "standard",
        mealsPerWeek: "10",
        mealsPerMonth: "43",
        mealsUsedWeek: "3",
        mealsUsed: "9",
        price: "499",
        endDate: "2026-03-24",
        walletBalance: "20",
      },
      overrides: {
        status: "cancelled",
        mealsUsedThisWeek: 0,
        mealsUsedThisMonth: 0,
      },
    });

    expect(args.p_status).toBe("cancelled");
    expect(args.p_meals_used_this_week).toBe(0);
    expect(args.p_meals_used_this_month).toBe(0);
    expect(args.p_meals_per_week).toBe(10);
    expect(args.p_meals_per_month).toBe(43);
    expect(args.p_wallet_balance).toBe(20);
  });

  it("normalizes invalid and negative numbers before saving", () => {
    expect(parseSubscriptionNumberInput("not-a-number", 12)).toBe(12);
    expect(parseSubscriptionNumberInput("-5", 12)).toBe(0);
    expect(parseSubscriptionNumberInput("0.75", 12)).toBe(0.75);
  });

  it("normalizes database display values before binding them to selects", () => {
    expect(normalizeSubscriptionPlan("Monthly")).toBe("monthly");
    expect(normalizeSubscriptionTier("Standard")).toBe("standard");
    expect(normalizeSubscriptionStatus("Expired")).toBe("expired");
  });

  it("opens expired subscriptions ready to reactivate from the admin editor", () => {
    expect(getEditableSubscriptionStatus("expired")).toBe("active");
    expect(getEditableSubscriptionStatus("pending")).toBe("pending");
    expect(getEditableSubscriptionStatus("cancelled")).toBe("cancelled");
  });

  it("renews stale end dates when saving an active subscription", () => {
    const args = buildAdminSubscriptionWalletArgs({
      userId: "user-1",
      subscriptionId: "sub-1",
      form: {
        selectedPlan: "monthly",
        selectedStatus: "active",
        selectedTier: "standard",
        mealsPerWeek: "10",
        mealsPerMonth: "40",
        mealsUsedWeek: "0",
        mealsUsed: "0",
        price: "499",
        endDate: "2026-03-24",
        walletBalance: "0",
      },
    });

    expect(args.p_end_date).not.toBe("2026-03-24");
    expect(args.p_end_date).toBe(getNextSubscriptionEndDate("monthly"));
  });

  it("keeps future end dates and inactive stale dates as selected", () => {
    expect(
      ensureActiveSubscriptionEndDate({
        status: "active",
        plan: "weekly",
        endDate: "2099-01-01",
      }),
    ).toBe("2099-01-01");
    expect(
      ensureActiveSubscriptionEndDate({
        status: "expired",
        plan: "monthly",
        endDate: "2026-03-24",
      }),
    ).toBe("2026-03-24");
  });
});
