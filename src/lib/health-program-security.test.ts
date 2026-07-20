import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = (name: string) => readFileSync(resolve(process.cwd(), "supabase", "migrations", name), "utf8");

describe("health support program security contracts", () => {
  it("keeps private baseline and check-in rows owner-scoped", () => {
    const sql = migration("20260720190000_health_support_programs.sql");

    expect(sql).toContain("ALTER TABLE public.health_program_baselines ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.health_program_checkins ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("health_program_baselines_owner_read");
    expect(sql).toContain("health_program_checkins_owner_read");
    expect(sql).not.toMatch(/health_program_(?:baselines|checkins)_admin_read/i);
  });

  it("requires all four independent review gates before protocol publication", () => {
    const sql = migration("20260720191000_health_program_review_gates.sql");

    for (const gate of ["qatar_legal", "licensed_dietitian", "medical_safety", "privacy_dpia"]) {
      expect(sql).toContain(`'${gate}'`);
    }
    expect(sql).toContain("CREATE TRIGGER enforce_publication_gates");
    expect(sql).toContain("All four external review gates must be approved before publication");
  });

  it("requires onboarding and a complete private baseline before activation", () => {
    const sql = migration("20260720192000_health_program_onboarding.sql");

    expect(sql).toContain("v_enrollment.status <> 'onboarding'");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.complete_health_program_onboarding");
    expect(sql).toContain("A complete private baseline is required");
    expect(sql).toContain("status = 'active'");
  });

  it("exports and supports deletion of all program-specific personal data", () => {
    const exportFunction = readFileSync(resolve(process.cwd(), "supabase", "functions", "export-user-data", "index.ts"), "utf8");
    const deletionSql = migration("20260720191500_health_program_user_deletion.sql");

    expect(exportFunction).toContain("health_program_checkins");
    expect(exportFunction).toContain("health_program_safety_events");
    expect(deletionSql).toContain("delete_my_health_program_data");
    expect(deletionSql).toContain("user_id = auth.uid()");
  });

  it("explicitly removes anonymous access from every program RPC", () => {
    const sql = migration("20260720192700_harden_health_program_rpc_grants.sql");
    const functions = [
      "enroll_in_health_program",
      "set_health_program_status",
      "submit_health_program_checkin",
      "acknowledge_health_program_safety_event",
      "review_health_program_gate",
      "publish_health_program_version",
      "delete_my_health_program_data",
      "complete_health_program_onboarding",
    ];

    for (const functionName of functions) {
      expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${functionName}\\([^;]+ FROM anon;`));
    }
  });
});
