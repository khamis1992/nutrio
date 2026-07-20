import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: mocks.rpc },
}));

import {
  createMealResponseExperiment,
  getMealResponseExperiment,
  linkMealResponseExperimentConsumption,
  normalizeMealResponseExperimentDetail,
  pauseMealResponseExperiment,
  startMealResponseExperiment,
} from "@/lib/meal-response-experiments";

const experiment = {
  id: "experiment-1",
  hypothesis: "A smaller carb portion reduces my glucose peak",
  outcome_type: "glucose_peak_delta",
  arms: [
    { key: "usual", label: "Usual portion", meal_id: "11111111-1111-4111-8111-111111111111", calories: 500 },
    { key: "smaller", label: "Smaller portion", meal_id: "22222222-2222-4222-8222-222222222222", calories: 450 },
  ],
  minimum_repeats_per_arm: 4,
  protocol_version: "n-of-1-v2",
  status: "draft",
  started_at: null,
  completed_at: null,
  created_at: "2026-07-20T10:00:00.000Z",
  updated_at: "2026-07-20T10:00:00.000Z",
};

describe("meal response experiment client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({ data: { experiment }, error: null });
  });

  it("creates an exactly two-arm experiment with an explicit idempotency key", async () => {
    const result = await createMealResponseExperiment({
      hypothesis: experiment.hypothesis,
      outcomeType: "glucose_peak_delta",
      arms: experiment.arms as [typeof experiment.arms[0], typeof experiment.arms[1]],
      requestId: "request-create",
    });

    expect(result.id).toBe("experiment-1");
    expect(mocks.rpc).toHaveBeenCalledWith("create_meal_response_experiment", {
      p_request_id: "request-create",
      p_hypothesis: experiment.hypothesis,
      p_outcome_type: "glucose_peak_delta",
      p_arms: experiment.arms,
      p_minimum_repeats_per_arm: 4,
      p_protocol_version: "n-of-1-v2",
    });
  });

  it("uses separate typed lifecycle RPCs", async () => {
    await startMealResponseExperiment("experiment-1", "request-start");
    await pauseMealResponseExperiment("experiment-1", "request-pause");

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "start_meal_response_experiment", {
      p_experiment_id: "experiment-1",
      p_request_id: "request-start",
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "pause_meal_response_experiment", {
      p_experiment_id: "experiment-1",
      p_request_id: "request-pause",
    });
  });

  it("links a canonical consumption to a specific immutable assignment", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        experiment: { ...experiment, status: "active" },
        assignment: {
          id: "assignment-1",
          experiment_id: "experiment-1",
          sequence_number: 1,
          arm_key: "usual",
          consumed_consumption_id: "consumption-1",
          completed_at: "2026-07-20T12:00:00.000Z",
        },
      },
      error: null,
    });

    const result = await linkMealResponseExperimentConsumption(
      "experiment-1", "assignment-1", "consumption-1", "request-link",
    );

    expect(result.assignment.sequence_number).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("link_meal_response_experiment_consumption", {
      p_experiment_id: "experiment-1",
      p_assignment_id: "assignment-1",
      p_consumption_id: "consumption-1",
      p_request_id: "request-link",
    });
  });

  it("keeps causal claims off when the server reports insufficient repeats", async () => {
    const detail = normalizeMealResponseExperimentDetail({
      experiment,
      assignments: [],
      arm_summaries: [
        { arm_key: "usual", label: "Usual", eligible_repeats: "2", distinct_days: 2, mean: 40 },
        { arm_key: "smaller", label: "Smaller", eligible_repeats: 3, distinct_days: 3, mean: 30 },
      ],
      causal_language_allowed: false,
      causal_abstention_reason: "INSUFFICIENT_ELIGIBLE_DISTINCT_DAY_REPEATS",
      claim_scope: "descriptive_only",
    });

    expect(detail.causal_language_allowed).toBe(false);
    expect(detail.claim_scope).toBe("descriptive_only");
    expect(detail.arm_summaries[0].eligible_repeats).toBe(2);
  });

  it("loads server-derived summaries and surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: {
        experiment,
        assignments: [],
        arm_summaries: [],
        causal_language_allowed: true,
        claim_scope: "personal_n_of_1_association",
      },
      error: null,
    });
    await expect(getMealResponseExperiment("experiment-1")).resolves.toMatchObject({
      causal_language_allowed: true,
      claim_scope: "personal_n_of_1_association",
    });

    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "EXPERIMENT_NOT_FOUND" } });
    await expect(getMealResponseExperiment("missing")).rejects.toThrow("EXPERIMENT_NOT_FOUND");
  });
});
