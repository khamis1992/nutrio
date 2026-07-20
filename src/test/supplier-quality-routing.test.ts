import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720244000_supplier_quality_routing.sql"),
  "utf8",
);

describe("Supplier quality routing contract", () => {
  it("uses order-bound incidents instead of unverified free-form supplier reports", () => {
    expect(migration).toContain("order_id UUID NOT NULL REFERENCES public.orders");
    expect(migration).toContain("WHERE id = p_order_id AND user_id = v_user_id");
    expect(migration).toContain("ELIGIBLE_ORDER_REQUIRED");
    expect(migration).toContain("UNIQUE (user_id, order_id, category)");
  });

  it("combines delivery, preparation, reviews, incidents, and nutrition evidence", () => {
    for (const signal of [
      "delivery_score",
      "preparation_score",
      "review_score",
      "incident_score",
      "nutrition_score",
    ]) {
      expect(migration).toContain(signal);
    }
    expect(migration).toContain("meal_nutrition_verification_samples");
    expect(migration).toContain("is_verified_purchase = TRUE");
  });

  it("preserves safety and capacity routing before bounded quality reranking", () => {
    expect(migration).toContain("RENAME TO route_meal_schedule_branch_base");
    expect(migration).toContain("v_base := public.route_meal_schedule_branch_base");
    expect(migration).toContain("WHERE COALESCE((candidate ->> 'eligible')::BOOLEAN, FALSE)");
    expect(migration).toContain("routing_adjustment BETWEEN -20 AND 10");
    expect(migration).toContain("best_distance_capacity_quality_score");
  });

  it("keeps quality refresh and incident resolution privileged", () => {
    expect(migration).toContain("ADMIN_AAL2_REQUIRED");
    expect(migration).toContain("REVOKE ALL ON FUNCTION public.refresh_supplier_quality_snapshots(INTEGER) FROM PUBLIC, anon");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.refresh_supplier_quality_snapshots(INTEGER) TO authenticated, service_role");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
  });
});
