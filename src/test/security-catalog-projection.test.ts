import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260717139000_enforce_catalog_projections.sql",
);

const customerCatalogReaders = [
  "src/pages/Meals.tsx",
  "src/pages/MealDetail.tsx",
  "src/pages/RestaurantDetail.tsx",
  "src/pages/Dashboard.tsx",
  "src/pages/OrderHistory.tsx",
  "src/pages/OrderDetail.tsx",
  "src/pages/DeliveryTracking.tsx",
  "src/pages/Favorites.tsx",
  "src/pages/Schedule.tsx",
  "src/components/ActiveOrderBanner.tsx",
  "src/integrations/supabase/delivery.ts",
  "src/services/taste-profile-calculator.ts",
  "src/services/taste-aware-menu-generator.ts",
  "src/pages/coach/CoachClientDetail.tsx",
].map(readRepoFile);

describe("catalog projection authorization", () => {
  it("removes all historical base-table SELECT policies before installing role-scoped reads", () => {
    expect(migration).toContain("tablename IN ('restaurants', 'meals')");
    expect(migration).toContain("AND cmd = 'SELECT'");
    expect(migration).toContain("CREATE POLICY restaurants_operator_select");
    expect(migration).toContain("CREATE POLICY restaurants_aal2_admin_select");
    expect(migration).toContain("CREATE POLICY meals_operator_select");
    expect(migration).toContain("CREATE POLICY meals_aal2_admin_select");
    expect(migration).toContain("COALESCE(auth.jwt() ->> 'aal', 'aal1') = 'aal2'");
  });

  it("does not expose financial or moderation-only fields through public projections", () => {
    const restaurantProjection = migration.slice(
      migration.indexOf("CREATE OR REPLACE VIEW public.public_restaurant_catalog"),
      migration.indexOf("CREATE OR REPLACE VIEW public.public_meal_catalog"),
    );
    const mealProjection = migration.slice(
      migration.indexOf("CREATE OR REPLACE VIEW public.public_meal_catalog"),
      migration.indexOf("REVOKE ALL ON public.public_restaurant_catalog"),
    );

    for (const field of [
      "owner_id",
      "bank_info",
      "commission_rate",
      "payout_rate",
      "approved_by",
      "rejection_reason",
      "premium_analytics_until",
    ]) {
      expect(restaurantProjection).not.toContain(`r.${field}`);
    }
    expect(mealProjection).not.toContain("m.estimated_cost");
  });

  it("routes customer-facing reads through the reviewed projections", () => {
    for (const source of customerCatalogReaders) {
      expect(source).not.toMatch(/\.from\(["']meals["']\)/);
      expect(source).not.toMatch(/\.from\(["']restaurants["']\)/);
    }
  });

  it("does not rely on foreign-key embedding from projection views", () => {
    for (const source of customerCatalogReaders) {
      expect(source).not.toMatch(
        /public_meal_catalog[\s\S]{0,220}restaurants:restaurant_id/,
      );
    }
  });
});
