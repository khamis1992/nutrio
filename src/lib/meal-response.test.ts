import { describe, expect, it } from "vitest";

import { normalizeMealResponseDashboard } from "@/lib/meal-response";

describe("normalizeMealResponseDashboard", () => {
  it("defaults consent to off and never promotes malformed evidence", () => {
    const result = normalizeMealResponseDashboard({
      estimates: [{ id: "one", evidence_tier: "clinical", source_kind: "causal", confidence_score: 140 }],
    });

    expect(result.preferences.meal_response_enabled).toBe(false);
    expect(result.estimates[0]).toMatchObject({
      evidence_tier: "descriptive",
      source_kind: "observed",
      confidence_score: 100,
    });
  });

  it("keeps measured estimates and filters invalid pending rows", () => {
    const result = normalizeMealResponseDashboard({
      eligible_episode_count: "4",
      pending_check_ins: [{ meal_name: "No id" }, { consumption_id: "c1", meal_name: "Bowl" }],
      estimates: [{
        id: "e1",
        meal_name: "Bowl",
        evidence_tier: "medium",
        source_kind: "measured",
        explanation_codes: ["good_coverage"],
      }],
    });

    expect(result.eligible_episode_count).toBe(4);
    expect(result.pending_check_ins).toHaveLength(1);
    expect(result.estimates[0].source_kind).toBe("measured");
  });
});
