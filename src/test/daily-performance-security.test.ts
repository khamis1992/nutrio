import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720185000_daily_performance_program.sql"),
  "utf8",
);

describe("daily performance database boundaries", () => {
  it("keeps source tables private and grants only authenticated RPCs", () => {
    expect(migration).toContain("ALTER TABLE public.coach_performance_directives FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.daily_performance_decisions FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON public.coach_performance_directives FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("REVOKE ALL ON public.daily_performance_decisions FROM PUBLIC, anon, authenticated");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.resolve_daily_performance_decision_internal[\s\S]*FROM PUBLIC, anon, authenticated/);
  });

  it("requires an active coach relationship for client reads and writes", () => {
    expect(migration).toContain("public.is_active_performance_coach(v_coach_id, p_client_id)");
    expect(migration).toContain("ACTIVE_COACH_ASSIGNMENT_REQUIRED");
  });

  it("validates a recommended meal against coach limits", () => {
    expect(migration).toContain("MEAL_TYPE_EXCLUDED_BY_COACH");
    expect(migration).toContain("MEAL_OUTSIDE_PERFORMANCE_ENVELOPE");
    expect(migration).toContain("COALESCE(approval_status, 'approved') = 'approved'");
    expect(migration).toContain("COALESCE(is_available, TRUE) = TRUE");
  });
});
