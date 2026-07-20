import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const worker = readFileSync(resolve(process.cwd(), "supabase/functions/build-meal-response-episodes/index.ts"), "utf8");

describe("meal response episode worker", () => {
  it("authenticates and requires explicit meal-response consent", () => {
    expect(worker).toContain("authenticateRequest(req)");
    expect(worker).toContain("meal_response_opt_in_required");
    expect(worker).toContain("glucose_analysis_enabled");
  });

  it("uses deterministic audited analytics and immutable lineage", () => {
    expect(worker).toContain("analyzeMealResponse");
    expect(worker).toContain("classifyEvidenceTier");
    expect(worker).toContain("meal_response_feature_snapshots");
    expect(worker).toContain("deterministic-meal-response");
  });

  it("builds non-CGM outcomes with explicit provenance and conservative context", () => {
    expect(worker).toContain("deriveSelfReportedOutcomes");
    expect(worker).toContain("deriveExploratoryHeartRateOutcomes");
    expect(worker).toContain("deriveNextDayRecoveryContext");
    expect(worker).toContain("association_scope");
    expect(worker).toContain("next_day_day_level_association_only");
    expect(worker).toContain("association_not_causation");
  });

  it("supersedes prior current estimates after the replacement is written", () => {
    const insertAt = worker.indexOf('.from("meal_response_estimates").insert(estimateRows)');
    const supersedeAt = worker.indexOf('.update({ superseded_at: now })');
    expect(insertAt).toBeGreaterThan(-1);
    expect(supersedeAt).toBeGreaterThan(insertAt);
    expect(worker).toContain('.is("superseded_at", null)');
  });

  it("does not send raw glucose or notes to an LLM", () => {
    expect(worker).not.toContain("OPENAI");
    expect(worker).not.toContain("anthropic");
    expect(worker).not.toContain("prompt:");
  });
});
