import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = readRepoFile(
  "supabase/migrations/20260720150000_health_context_and_cycle_personalization.sql",
);
const defaultOffCorrection = readRepoFile(
  "supabase/migrations/20260720192500_restore_health_context_default_off.sql",
);
const router = readRepoFile("supabase/functions/ai-router/index.ts");
const exportFunction = readRepoFile("supabase/functions/export-user-data/index.ts");

describe("health context privacy boundary", () => {
  it("ships behind the final default-off correction and forced owner-only RLS", () => {
    expect(defaultOffCorrection).toContain("'enabled', false");
    expect(defaultOffCorrection).toContain("'rollout_percent', 0");
    expect(defaultOffCorrection).toContain("on conflict (key) do update");
    expect(migration).toContain("'phase1-health-context'");
    for (const table of [
      "health_context_preferences",
      "health_context_entries",
      "health_context_consent_events",
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
    }
    expect(migration).toContain("USING (user_id = (SELECT auth.uid()))");
    expect(migration).not.toMatch(/GRANT (INSERT|UPDATE|DELETE).*health_context_.*TO authenticated/);
  });

  it("requires separate journal, cycle, recommendation, and AI consent gates", () => {
    expect(migration).toContain("HEALTH_CONTEXT_OPT_IN_REQUIRED");
    expect(migration).toContain("CYCLE_CONTEXT_OPT_IN_REQUIRED");
    expect(migration).toContain("recommendation_context_enabled");
    expect(migration).toContain("'2026-07-health-context-ai-v1'");
    expect(migration).toContain("v_consent_revoked := FOUND");
    expect(migration).toContain("'has_existing_data', v_has_existing_data");
  });

  it("keeps cycle context manual and excludes predictive health fields", () => {
    expect(migration).toContain("'context.user_logged_cycle_phase'");
    expect(migration).not.toMatch(/fertile_window|predicted_ovulation|pregnancy_probability/);
  });

  it("keeps private health context out of direct social access", () => {
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.health_context_entries FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("GRANT SELECT ON TABLE public.health_context_entries TO authenticated");
    expect(migration).not.toMatch(/health_context_(entries|preferences)[\s\S]{0,120}(challenge|community)/i);
  });

  it("sends AI only a consented aggregate loaded by the service role", () => {
    const summaryFunction = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.health_context_ai_summary_internal"),
      migration.indexOf("CREATE OR REPLACE FUNCTION public.get_health_context_ai_summary("),
    );
    expect(summaryFunction).toContain("consent.status = 'granted'");
    expect(summaryFunction).toContain("count(*) < 3 THEN NULL");
    expect(summaryFunction).not.toMatch(/jsonb_build_object\([\s\S]*?'note'/);
    expect(summaryFunction).not.toContain("'entry_date'");
    expect(summaryFunction).not.toContain("'bleeding_flow'");
    expect(migration).toContain("SERVICE_ROLE_REQUIRED");
    expect(router).toContain('service.rpc(\n        "get_health_context_ai_summary_for_user"');
    expect(router).not.toMatch(/value\.healthContextSummary|body\.healthContextSummary/);
  });

  it("exports the complete private dataset and supports one-step deletion", () => {
    for (const table of [
      "health_context_preferences",
      "health_context_entries",
      "health_context_consent_events",
    ]) {
      expect(exportFunction).toContain(`from("${table}")`);
    }
    expect(exportFunction).toContain("health_context_export_unavailable");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.delete_health_context_dataset()");
    expect(migration).toContain("'dataset_deleted'");
  });
});
