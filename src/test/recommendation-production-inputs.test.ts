import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("recommendation production inputs", () => {
  it("derives credit eligibility from subscription and wallet state", () => {
    const hook = source("src/hooks/useMealRecommendations.ts");

    expect(hook).toContain("mealCreditsAvailable");
    expect(hook).toContain("snackCreditsAvailable");
    expect(hook).toContain("walletPurchaseAvailable");
    expect(hook).not.toContain("creditEligible: true");
    expect(hook).not.toContain("walletOrCardAvailable: true");
  });

  it("derives delivery availability from the server branch router", () => {
    const hook = source("src/hooks/useMealRecommendations.ts");

    expect(hook).toContain('"route_meal_schedule_branch"');
    expect(hook).toContain("deriveMealDeliveryAvailability");
    expect(hook).not.toContain("deliveryAvailable: null,");
    expect(hook).not.toContain("deliveryMinutes: null,");
  });

  it("routes the detailed recommendation screen instead of redirecting", () => {
    const routes = source("src/customer/routes.tsx");

    expect(routes).toContain("<SmartMealRecommendations />");
    expect(routes).not.toContain(
      'path="/recommendations"\n      element={<Navigate to="/meals" replace />}',
    );
  });
});
