import { describe, expect, it } from "vitest";

import {
  analyzeMealResponse,
  assessEpisodeQuality,
  assessSampleCoverage,
  calculateBaselineMedian,
  calculateCompositeConfidence,
  calculatePeakMetrics,
  calculatePositiveIAuc,
  calculateRecoveryTime,
  classifyEvidenceTier,
  deriveExploratoryHeartRateOutcomes,
  deriveNextDayRecoveryContext,
  deriveSelfReportedOutcomes,
  glucoseToMgDl,
  prepareGlucoseSamples,
  selectPostMealWindow,
  toUtcMilliseconds,
  type EpisodeQuality,
  type GlucoseSample,
  type NormalizedGlucoseSample,
} from "@/lib/meal-response-analytics";

const MEAL_AT = "2026-07-20T12:00:00Z";
const MINUTE = 60_000;
const mealMs = Date.parse(MEAL_AT);

function sample(minutes: number, value: number, unit = "mg/dL"): GlucoseSample {
  return { timestamp: new Date(mealMs + minutes * MINUTE).toISOString(), value, unit, sourceId: "cgm" };
}

function normalized(minutes: number, valueMgDl: number): NormalizedGlucoseSample {
  const timestampMs = mealMs + minutes * MINUTE;
  return {
    timestampMs,
    timestamp: new Date(timestampMs).toISOString(),
    valueMgDl,
    sourceIds: ["cgm"],
    observationCount: 1,
  };
}

describe("glucose normalization", () => {
  it("converts mixed units and collapses duplicate instants with a robust median", () => {
    const result = prepareGlucoseSamples([
      sample(0, 100),
      sample(0, 5.55, "mmol/L"),
      sample(0, 500),
      sample(5, 6, "mmol_l"),
    ]);

    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].valueMgDl).toBeCloseTo(100, 1);
    expect(result.samples[0].observationCount).toBe(3);
    expect(result.duplicateCount).toBe(2);
    expect(result.mixedUnits).toBe(true);
  });

  it("rejects invalid timestamps, unknown units, non-finite values, and implausible outliers", () => {
    const result = prepareGlucoseSamples([
      { timestamp: "2026-07-20T12:00:00", value: 100, unit: "mg/dL" },
      { timestamp: MEAL_AT, value: 100, unit: "g/L" },
      { timestamp: MEAL_AT, value: Number.NaN, unit: "mg/dL" },
      { timestamp: MEAL_AT, value: 19, unit: "mg/dL" },
      { timestamp: MEAL_AT, value: 601, unit: "mg/dL" },
    ]);

    expect(result.samples).toEqual([]);
    expect(result.invalidCount).toBe(3);
    expect(result.outlierCount).toBe(2);
  });

  it("normalizes equivalent timezone offsets to the same UTC instant", () => {
    expect(toUtcMilliseconds("2026-07-20T15:00:00+03:00")).toBe(mealMs);
    expect(toUtcMilliseconds("2026-07-20T12:00:00Z")).toBe(mealMs);
    expect(toUtcMilliseconds("2026-07-20T12:00:00")).toBeNull();
    expect(glucoseToMgDl(5.55, "mmol/L")).toBeCloseTo(100, 1);
  });
});

describe("deterministic response metrics", () => {
  const prepared = prepareGlucoseSamples([
    sample(-30, 200),
    sample(-25, 98),
    sample(-20, 100),
    sample(-15, 102),
    sample(-10, 99),
    sample(-5, 101),
    sample(0, 100),
    sample(30, 140),
    sample(60, 120),
    sample(90, 100),
    sample(120, 90),
    sample(150, 110),
  ]).samples;

  it("uses only -30 through -5 minutes and resists a baseline outlier", () => {
    expect(calculateBaselineMedian(prepared, MEAL_AT)).toBeCloseTo(100.5);
    expect(calculateBaselineMedian(prepared, MEAL_AT, 7)).toBeNull();
  });

  it("selects inclusive 120 and 180 minute windows", () => {
    expect(selectPostMealWindow(prepared, MEAL_AT, 120).map((item) => item.valueMgDl))
      .toEqual([100, 140, 120, 100, 90]);
    expect(selectPostMealWindow(prepared, MEAL_AT, 180)).toHaveLength(6);
  });

  it("computes positive trapezoidal iAUC without subtracting below-baseline area", () => {
    const curve = [normalized(0, 100), normalized(30, 140), normalized(60, 120), normalized(90, 100)];
    expect(calculatePositiveIAuc(curve, 100)).toBe(1_800);
    expect(calculatePositiveIAuc([normalized(0, 110), normalized(10, 90)], 100)).toBe(25);
    expect(calculatePositiveIAuc(curve.slice(0, 1), 100)).toBeNull();
  });

  it("reports the first tied peak and interpolates recovery to baseline", () => {
    const curve = [
      normalized(0, 100),
      normalized(30, 140),
      normalized(45, 140),
      normalized(75, 110),
      normalized(90, 90),
    ];
    expect(calculatePeakMetrics(curve, 100, MEAL_AT)).toEqual({
      peakDeltaMgDl: 40,
      peakValueMgDl: 140,
      timeToPeakMinutes: 30,
    });
    expect(calculateRecoveryTime(curve, 100, MEAL_AT)).toBeCloseTo(82.5);
    expect(calculateRecoveryTime(curve.slice(0, 4), 100, MEAL_AT)).toBeNull();
  });

  it("returns zero recovery time when the curve never rises above baseline", () => {
    expect(calculateRecoveryTime([normalized(0, 95), normalized(30, 90)], 100, MEAL_AT)).toBe(0);
  });
});

describe("non-CGM response outcomes", () => {
  it("selects the closest deterministic +90/+180 check-ins and labels them self-reported", () => {
    const outcomes = deriveSelfReportedOutcomes([
      {
        promptOffsetMinutes: 100,
        submittedAt: "2026-07-20T13:40:00Z",
        satiety: 8,
        energy: 7,
        digestiveSymptoms: ["bloating", "bloating"],
        symptomSeverity: 2,
      },
      {
        promptOffsetMinutes: 90,
        submittedAt: "2026-07-20T13:30:00Z",
        satiety: 6,
        energy: 5,
        digestiveSymptoms: [],
        symptomSeverity: 0,
      },
      {
        promptOffsetMinutes: 180,
        submittedAt: "2026-07-20T15:00:00Z",
        satiety: 4,
        energy: 6,
        digestiveSymptoms: ["reflux"],
        symptomSeverity: 1,
      },
    ]);

    expect(outcomes.find(({ outcomeType }) => outcomeType === "satiety_90m")?.value).toBe(6);
    expect(outcomes.find(({ outcomeType }) => outcomeType === "energy_180m")?.value).toBe(6);
    expect(outcomes.find(({ outcomeType }) => outcomeType === "digestive_symptom_count_180m")?.value).toBe(1);
    expect(outcomes.every(({ sourceKind }) => sourceKind === "self_reported")).toBe(true);
    expect(outcomes.every(({ limitations }) => limitations.includes("association_not_causation"))).toBe(true);
  });

  it("does not manufacture self-reported outcomes outside the prompt tolerance", () => {
    expect(deriveSelfReportedOutcomes([{
      promptOffsetMinutes: 20,
      submittedAt: "2026-07-20T12:20:00Z",
      satiety: 10,
    }])).toEqual([]);
  });

  it("derives exploratory heart-rate deltas only with adequate valid coverage", () => {
    const heartSamples = [
      ...[-30, -20, -5].map((minutes, index) => ({
        timestamp: new Date(mealMs + minutes * MINUTE).toISOString(), value: 60 + index, unit: "bpm",
      })),
      ...[0, 20, 40, 60, 90, 120].map((minutes) => ({
        timestamp: new Date(mealMs + minutes * MINUTE).toISOString(), value: 72, unit: "bpm",
      })),
    ];
    const outcomes = deriveExploratoryHeartRateOutcomes(heartSamples, MEAL_AT);

    expect(outcomes.find(({ outcomeType }) => outcomeType === "heart_rate_baseline")?.value).toBe(61);
    expect(outcomes.find(({ outcomeType }) => outcomeType === "heart_rate_post_meal_delta")?.value).toBe(11);
    expect(outcomes.every(({ evidenceEligible }) => !evidenceEligible)).toBe(true);
    expect(deriveExploratoryHeartRateOutcomes(heartSamples.slice(0, 5), MEAL_AT)).toEqual([]);
  });

  it("marks next-day sleep and recovery signals as day-level associations only", () => {
    const outcomes = deriveNextDayRecoveryContext({
      metricDate: "2026-07-21",
      sleepMinutes: 455,
      hrvMs: 48,
      restingHeartRateBpm: 59,
      source: "apple_health",
    });

    expect(outcomes).toEqual(expect.arrayContaining([
      expect.objectContaining({ outcomeType: "next_day_sleep_minutes", value: 455 }),
      expect.objectContaining({ outcomeType: "next_day_hrv", value: 48 }),
    ]));
    expect(outcomes.every(({ associationScope }) => associationScope === "next_day_context")).toBe(true);
    expect(outcomes.every(({ limitations }) => limitations.includes("must_not_be_attributed_to_one_meal"))).toBe(true);
  });
});

describe("coverage and quality gates", () => {
  it("measures expected sample coverage, edge gaps, and internal gaps", () => {
    const coverage = assessSampleCoverage(
      [normalized(0, 100), normalized(5, 105), normalized(25, 110), normalized(30, 100)],
      mealMs,
      mealMs + 30 * MINUTE,
      5,
      15,
    );
    expect(coverage).toMatchObject({
      sampleCount: 4,
      expectedSampleCount: 7,
      gapsOverThreshold: 1,
      startGapMinutes: 0,
      endGapMinutes: 0,
      maxGapMinutes: 20,
    });
    expect(coverage.ratio).toBeCloseTo(4 / 7);
  });

  it("never reports coverage above one and handles a missing window", () => {
    const duplicates = [normalized(0, 100), normalized(0, 101), normalized(5, 102)];
    expect(assessSampleCoverage(duplicates, mealMs, mealMs + 5 * MINUTE).ratio).toBe(1);
    expect(assessSampleCoverage([], mealMs, mealMs + 120 * MINUTE)).toMatchObject({
      ratio: 0,
      sampleCount: 0,
      maxGapMinutes: 120,
    });
  });

  it("excludes hard quality failures and preserves auditable reasons", () => {
    const coverage = assessSampleCoverage([normalized(0, 100)], mealMs, mealMs + 120 * MINUTE);
    const quality = assessEpisodeQuality({
      baselineAvailable: false,
      baselineCoverage: coverage,
      postMealCoverage: coverage,
      portionConfirmed: false,
      nutritionCompleteness: 0.7,
      timePrecision: "date_only",
      overlappingMeal: true,
      sensorWarmup: true,
      sourceKnown: false,
      mixedSourcesResolved: false,
      confounders: ["exercise", "caffeine", "exercise"],
    });
    expect(quality.eligibility).toBe("excluded");
    expect(quality.exclusionReasons).toEqual(expect.arrayContaining([
      "date_only_meal_time",
      "portion_not_confirmed",
      "incomplete_nutrition",
      "missing_baseline",
      "low_post_meal_coverage",
      "sensor_gap",
      "sensor_warmup",
      "overlapping_meal",
      "unknown_source",
      "unresolved_mixed_sources",
    ]));
    expect(quality.confounders).toEqual(["caffeine", "exercise"]);
  });

  it("keeps otherwise sound estimated or confounded episodes descriptive only", () => {
    const full = assessSampleCoverage(
      Array.from({ length: 25 }, (_, index) => normalized(index * 5, 100)),
      mealMs,
      mealMs + 120 * MINUTE,
    );
    expect(assessEpisodeQuality({
      baselineAvailable: true,
      baselineCoverage: full,
      postMealCoverage: full,
      timePrecision: "estimated_15m",
      confounders: ["poor_sleep"],
    }).eligibility).toBe("descriptive_only");
  });
});

describe("confidence and evidence", () => {
  const eligibleQuality: EpisodeQuality = {
    eligibility: "eligible",
    exclusionReasons: [],
    confounders: [],
  };

  it("produces a bounded composite score and caps descriptive, excluded, and uncalibrated inputs", () => {
    expect(calculateCompositeConfidence({
      quality: eligibleQuality,
      baselineCoverage: 1,
      postMealCoverage: 1,
      maxGapMinutes: 5,
      timePrecision: "exact",
    }).score).toBe(100);
    expect(calculateCompositeConfidence({
      quality: { ...eligibleQuality, eligibility: "descriptive_only", confounders: ["exercise"] },
      baselineCoverage: 1,
      postMealCoverage: 1,
      maxGapMinutes: 5,
    }).score).toBeLessThanOrEqual(49);
    expect(calculateCompositeConfidence({
      quality: { ...eligibleQuality, eligibility: "excluded" },
      baselineCoverage: 1,
      postMealCoverage: 1,
      maxGapMinutes: 5,
    }).score).toBe(0);
    expect(calculateCompositeConfidence({
      quality: eligibleQuality,
      baselineCoverage: 1,
      postMealCoverage: 1,
      maxGapMinutes: 5,
      calibrationStatus: "uncalibrated",
    }).score).toBeLessThanOrEqual(69);
  });

  it("applies conservative episode, day, consistency, calibration, and stability gates", () => {
    expect(classifyEvidenceTier({
      eligibleEpisodeCount: 0, distinctDayCount: 0, consistentDirection: false,
    }).tier).toBe("insufficient");
    expect(classifyEvidenceTier({
      eligibleEpisodeCount: 1, distinctDayCount: 1, consistentDirection: false,
    }).tier).toBe("descriptive");
    expect(classifyEvidenceTier({
      eligibleEpisodeCount: 3, distinctDayCount: 2, consistentDirection: false, confidenceScore: 60,
    }).tier).toBe("early");
    expect(classifyEvidenceTier({
      eligibleEpisodeCount: 5, distinctDayCount: 3, consistentDirection: true, calibrated: true, confidenceScore: 75,
    }).tier).toBe("medium");
    expect(classifyEvidenceTier({
      eligibleEpisodeCount: 8, distinctDayCount: 4, consistentDirection: true, calibrated: false, stable: true,
    }).tier).toBe("early");
    const strong = classifyEvidenceTier({
      eligibleEpisodeCount: 6,
      distinctDayCount: 4,
      consistentDirection: true,
      calibrated: true,
      stable: true,
      experimentBacked: true,
      confidenceScore: 90,
    });
    expect(strong.tier).toBe("strong");
    expect(strong.claim).toContain("not a diagnosis or treatment claim");
  });
});

describe("complete meal response analysis", () => {
  it("builds the same eligible analysis regardless of input order", () => {
    const samples = [
      ...Array.from({ length: 6 }, (_, index) => sample(-30 + index * 5, 100)),
      ...Array.from({ length: 25 }, (_, index) => sample(index * 5, index <= 6 ? 100 + index * 5 : 130 - (index - 6) * 2)),
    ];
    const input = {
      mealAt: "2026-07-20T15:00:00+03:00",
      samples,
      portionConfirmed: true,
      nutritionCompleteness: 0.9,
      timePrecision: "exact" as const,
      sourceKnown: true,
      mixedSourcesResolved: true,
    };
    const forward = analyzeMealResponse(input);
    const reversed = analyzeMealResponse({ ...input, samples: [...samples].reverse() });

    expect(forward).toEqual(reversed);
    expect(forward.mealAt).toBe(new Date(MEAL_AT).toISOString());
    expect(forward.quality.eligibility).toBe("eligible");
    expect(forward.baselineMgDl).toBe(100);
    expect(forward.peak?.timeToPeakMinutes).toBe(30);
    expect(Number.isFinite(forward.positiveIAucMgDlMinutes)).toBe(true);
    expect(forward.postMealCoverage.ratio).toBe(1);
  });

  it("abstains from metrics when baseline and post-meal windows are missing", () => {
    const result = analyzeMealResponse({ mealAt: MEAL_AT, samples: [] });
    expect(result.baselineMgDl).toBeNull();
    expect(result.positiveIAucMgDlMinutes).toBeNull();
    expect(result.peak).toBeNull();
    expect(result.quality.eligibility).toBe("excluded");
    expect(result.quality.exclusionReasons).toEqual(expect.arrayContaining([
      "missing_baseline",
      "missing_post_meal_window",
    ]));
    expect(result.confidence.score).toBe(0);
  });

  it("supports the configured 180-minute mixed-meal window", () => {
    const samples = [
      ...Array.from({ length: 6 }, (_, index) => sample(-30 + index * 5, 100)),
      ...Array.from({ length: 37 }, (_, index) => sample(index * 5, 100)),
    ];
    const result = analyzeMealResponse({ mealAt: MEAL_AT, samples, postMealMinutes: 180 });
    expect(result.windowMinutes).toBe(180);
    expect(result.postMealCoverage).toMatchObject({ sampleCount: 37, expectedSampleCount: 37, ratio: 1 });
  });
});
