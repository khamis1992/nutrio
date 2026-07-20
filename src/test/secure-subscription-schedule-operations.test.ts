import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720248000_secure_subscription_schedule_operations.sql"),
  "utf8",
);
const schedulePage = readFileSync(resolve(process.cwd(), "src/pages/Schedule.tsx"), "utf8");

describe("Secure subscription schedule operations", () => {
  it("binds every schedule result to the exact subscription", () => {
    expect(migration).toContain("subscription_id UUID REFERENCES public.subscriptions");
    expect(migration).toContain("quota_month_start DATE");
    expect(migration).toContain("quota_week_start DATE");
    expect(migration).toContain("schedule_meals_atomic_legacy_20260720");
    expect(migration).toContain("SCHEDULE_SUBSCRIPTION_MISMATCH");
  });

  it("makes cancellation idempotent and restores exact quota and snack usage", () => {
    expect(migration).toContain("already_cancelled");
    expect(migration).toContain("snacks_used_this_month");
    expect(migration).toContain("schedule_operation_single_cancel_idx");
    expect(migration).toContain("corporate_benefit_reversed");
    expect(migration).toContain("event.event_type = 'redeemed'");
    expect(migration).toContain("COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'");
    expect(migration).toContain("job.status IN ('picked_up', 'in_transit', 'delivered', 'completed')");
    expect(migration).toContain("status IN ('pending', 'assigned', 'accepted')");
    expect(migration).not.toContain("status IN ('pending', 'scheduled', 'assigned', 'accepted')");
    expect(migration).not.toContain("'preparing', 'ready', 'out_for_delivery'");
    expect(migration).not.toContain("INTERVAL '1 hour'");
  });

  it("prevents direct browser mutations and uses an owner-bound delivery RPC", () => {
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.meal_schedules FROM authenticated");
    expect(migration).toContain("update_my_scheduled_delivery");
    expect(schedulePage).toContain('"update_my_scheduled_delivery" as never');
    expect(schedulePage).not.toContain('.from("meal_schedules")\n        .update(updates)');
  });

  it("reroutes and reprices a changed delivery before recording the audit event", () => {
    expect(migration).toContain("route_meal_schedule_branch");
    expect(migration).toContain("delivery_fee_surge");
    expect(migration).toContain("'delivery_updated'");
  });
});
