import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = source("supabase/migrations/20260720240000_care_team_foundation.sql");

describe("Care Team launch contract", () => {
  it("supports a real team while preventing duplicate active roles", () => {
    expect(migration).toContain("care_assignment_one_active_type_idx");
    expect(migration).toContain("(client_id, assignment_type)");
    expect(migration).toContain("DROP INDEX IF EXISTS public.coach_client_assignments_one_open_per_client_idx");
    expect(migration).not.toContain("care_assignment_one_active_client_idx\n  ON");
    expect(migration).toContain("ACTIVE_CARE_ASSIGNMENT_TYPE_EXISTS");
  });

  it("makes application and care-record writes server authoritative", () => {
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.coach_applications FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_client_assignments FROM authenticated",
    );
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_notes FROM authenticated",
    );
    expect(migration).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.coach_sessions FROM authenticated",
    );
    expect(migration).toContain("submit_care_professional_application");
    expect(migration).toContain("admin_review_care_professional_application");
  });

  it("requires verified, unexpired credentials and explicit consent scopes", () => {
    expect(migration).toContain("credential.verification_status = 'verified'");
    expect(migration).toContain("credential.license_expires_on >= CURRENT_DATE");
    expect(migration).toContain("consent_version TEXT NOT NULL DEFAULT 'care-team-v1'");
    expect(migration).toContain("CARE_CONSENT_SCOPES_INVALID");
    expect(migration).toContain("LICENSED_DIETITIAN_REQUIRED");
    expect(migration).toContain("care_professional_has_scope");
    expect(migration).toContain("care_weight_scope_read");
    expect(migration).toContain("care_macros_scope_goal_read");
    expect(migration).toContain("care_meal_adherence_scope_read");
    expect(migration).toContain('DROP POLICY IF EXISTS "coaches_update_client_targets"');
  });

  it("preserves historical records before enforcing assignment-bound access", () => {
    expect(migration).toContain("UPDATE public.coach_notes note");
    expect(migration).toContain("UPDATE public.coach_sessions session");
    expect(migration).toContain("ORDER BY (assignment.status = 'active') DESC");
  });

  it("keeps message content out of notifications and records SLA escalation", () => {
    const notificationFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.notify_coach_message"),
      migration.indexOf("DROP POLICY IF EXISTS \"coaches_read_own_notes\""),
    );
    expect(notificationFunction).toContain("Open Nutrio to read your care-team message.");
    expect(notificationFunction).not.toContain("NEW.message");
    expect(migration).toContain("track_care_message_sla");
    expect(migration).toContain("escalate_overdue_care_responses");
  });

  it("provides auditable plan review, notes, sessions, and escalation RPCs", () => {
    for (const rpc of [
      "add_care_note",
      "amend_care_note",
      "archive_care_note",
      "create_care_session",
      "update_care_session",
      "review_care_plan",
      "acknowledge_care_plan_review",
      "open_care_escalation",
      "resolve_care_escalation",
    ]) {
      expect(migration).toContain(`FUNCTION public.${rpc}`);
    }
    expect(migration).toContain("public.care_team_events");
  });
});
