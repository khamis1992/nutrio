import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260720243000_arabic_behavior_support.sql"),
  "utf8",
);

describe("Arabic behavior support launch contract", () => {
  it("requires bilingual reviewed content before publication", () => {
    expect(migration).toContain("title_en TEXT NOT NULL");
    expect(migration).toContain("title_ar TEXT NOT NULL");
    expect(migration).toContain("body_en TEXT NOT NULL");
    expect(migration).toContain("body_ar TEXT NOT NULL");
    expect(migration).toContain("review_status <> 'published' OR (reviewed_at IS NOT NULL AND review_reference IS NOT NULL)");
    expect(migration).toContain("Nutrio low-risk habit content baseline v1");
  });

  it("keeps user behavior writes behind ownership-checking RPCs", () => {
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("v_user_id UUID := auth.uid()");
    expect(migration).toContain("id = p_intervention_id AND user_id = v_user_id");
    expect(migration).toContain("submit_my_behavior_reflection");
    expect(migration).toContain("record_my_behavior_intervention_event");
  });

  it("enforces quiet hours and bounded prompt budgets", () => {
    expect(migration).toContain("max_prompts_per_day SMALLINT NOT NULL DEFAULT 1");
    expect(migration).toContain("max_prompts_per_week SMALLINT NOT NULL DEFAULT 4");
    expect(migration).toContain("reason', 'quiet_hours'");
    expect(migration).toContain("reason', 'budget_reached'");
    expect(migration).toContain("v_daily_count >= v_pref.max_prompts_per_day");
    expect(migration).toContain("v_weekly_count >= v_pref.max_prompts_per_week");
  });

  it("captures reflection and outcome evidence without sensitive push copy", () => {
    expect(migration).toContain("behavior_reflections");
    expect(migration).toContain("behavior_intervention_events");
    expect(migration).toContain("experiment_key TEXT NOT NULL DEFAULT 'behavior_support_v1'");
    expect(migration).toContain("variant IN ('action_first', 'reflection_first', 'control')");
    expect(migration).not.toContain("push_notification");
  });
});
