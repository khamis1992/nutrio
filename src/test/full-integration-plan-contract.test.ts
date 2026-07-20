import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("full retention and body progress integration contract", () => {
  it("keeps the customer body progress experience routed and navigable", () => {
    const customerRoutes = readRepoFile("src/customer/routes.tsx");
    const customerNavigation = readRepoFile("src/components/CustomerNavigation.tsx");
    const bodyProgress = readRepoFile("src/pages/progress/BodyProgressDashboard.tsx");

    expect(customerRoutes).toContain('path="/dashboard/progress"');
    expect(customerRoutes).toContain('path="/progress"');
    expect(customerRoutes).toContain('path="/body-progress"');
    expect(customerNavigation).toContain('to: "/dashboard/progress"');
    expect(bodyProgress).toContain("@/components/body-metrics/WeeklyMetricsForm");
    expect(bodyProgress).toContain("@/components/health-score/ComplianceScoreCard");
    expect(bodyProgress).toContain("@/components/charts/WeightTrendChart");
    expect(bodyProgress).toContain("@/components/charts/WaistChart");
    expect(bodyProgress).toContain("@/components/charts/BodyFatChart");
  });

  it("keeps subscription freeze, rollover, and active-credit consumption wired", () => {
    const subscriptionPage = readRepoFile("src/pages/Subscription.tsx");
    const subscriptionManage = readRepoFile("src/components/subscription/SubscriptionManage.tsx");
    const useSubscription = readRepoFile("src/hooks/useSubscription.ts");
    const rolloverPriorityMigration = readRepoFile(
      "supabase/migrations/20260720173000_prioritize_rollover_meal_usage.sql",
    );

    expect(subscriptionPage).toContain("useFreezeDaysRemaining");
    expect(subscriptionPage).toContain("effectiveMealsLeft = remainingMeals");
    expect(subscriptionManage).toContain("FreezeSubscriptionModal");
    expect(subscriptionManage).toContain("rolloverCredits");
    expect(useSubscription).toContain('useRealtimeTable("subscription_rollovers"');
    expect(useSubscription).toContain("use_rollover_credit_if_available");
    expect(rolloverPriorityMigration).toContain("increment_monthly_meal_usage");
    expect(rolloverPriorityMigration).toContain("use_rollover_credit_if_available");
  });

  it("keeps admin retention pages, user health visibility, and analytics linked", () => {
    const app = readRepoFile("src/App.tsx");
    const adminSidebar = readRepoFile("src/components/AdminSidebar.tsx");
    const adminLayout = readRepoFile("src/components/AdminLayout.tsx");
    const adminUsers = readRepoFile("src/pages/admin/AdminUsers.tsx");
    const adminAnalytics = readRepoFile("src/pages/admin/AdminAnalytics.tsx");

    expect(app).toContain('path="subscriptions/freezes"');
    expect(app).toContain('path="audit/rollovers"');
    expect(app).toContain('path="analytics/retention"');
    expect(adminSidebar).toContain("/admin/subscriptions/freezes");
    expect(adminSidebar).toContain("/admin/audit/rollovers");
    expect(adminSidebar).toContain("/admin/analytics/retention");
    expect(adminLayout).toContain("/admin/subscriptions/freezes");
    expect(adminLayout).toContain("/admin/audit/rollovers");
    expect(adminLayout).toContain("/admin/analytics/retention");
    expect(adminUsers).toContain("UserRetentionHealthSummary");
    expect(adminUsers).toContain("health_score");
    expect(adminAnalytics).toContain("Retention Health");
    expect(adminAnalytics).toContain("subscription_freezes");
    expect(adminAnalytics).toContain("subscription_rollovers");
  });

  it("keeps partner and driver retention context visible", () => {
    const partnerOrders = readRepoFile("src/pages/partner/PartnerOrders.tsx");
    const partnerDashboard = readRepoFile("src/pages/partner/PartnerDashboard.tsx");
    const driverOrders = readRepoFile("src/pages/driver/DriverOrders.tsx");

    expect(partnerOrders).toContain("CustomerSubscriptionBadge");
    expect(partnerDashboard).toContain("FreezeNotificationCenter");
    expect(driverOrders).toContain("CustomerSubscriptionBadge");
  });

  it("keeps required retention edge functions and scheduled workers present", () => {
    for (const path of [
      "supabase/functions/process-subscription-renewal/index.ts",
      "supabase/functions/handle-freeze-request/index.ts",
      "supabase/functions/calculate-health-score/index.ts",
      "supabase/functions/cleanup-expired-rollovers/index.ts",
    ]) {
      expect(existsSync(resolve(process.cwd(), path))).toBe(true);
    }

    const workflow = readRepoFile(".github/workflows/deploy-edge-functions.yml");
    expect(workflow).toContain("/functions/v1/process-subscription-renewal");
    expect(workflow).toContain("/functions/v1/calculate-health-score");
    expect(workflow).toContain("/functions/v1/cleanup-expired-rollovers");
    expect(workflow).toContain("SUBSCRIPTION_RENEWAL_CRON_SECRET");
    expect(workflow).toContain("HEALTH_SCORE_CRON_SECRET");
    expect(workflow).toContain("ROLLOVER_CLEANUP_CRON_SECRET");
  });
});
