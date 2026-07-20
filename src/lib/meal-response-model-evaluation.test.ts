import { describe, expect, it } from "vitest";

import {
  abstentionRate,
  checkSubgroupGap,
  evaluateAcceptanceGate,
  evaluateRecords,
  expectedCalibrationError,
  intervalCoverage,
  meanAbsoluteError,
  pairwiseRankAccuracy,
  splitByUserThenTime,
  type EvaluationMetrics,
  type EvaluationRecord,
} from "@/lib/meal-response-model-evaluation";

const records: EvaluationRecord[] = [
  { userId: "a", observedAt: "2026-01-01", actual: 1, predicted: 1.2 },
  { userId: "a", observedAt: "2026-01-02", actual: 2, predicted: 1.8 },
  { userId: "a", observedAt: "2026-01-03", actual: 3, predicted: 3.1 },
  { userId: "b", observedAt: "2026-01-01", actual: 4, predicted: 3.8 },
  { userId: "b", observedAt: "2026-01-02", actual: 5, predicted: 5.2 },
  { userId: "c", observedAt: "2026-01-01", actual: 6, predicted: 5.9 },
];

describe("splitByUserThenTime", () => {
  it("holds test users out completely and uses later observations for validation", () => {
    const first = splitByUserThenTime(records, {
      seed: "pilot",
      testUserFraction: 0.34,
      validationFraction: 0.34,
    });
    const second = splitByUserThenTime([...records].reverse(), {
      seed: "pilot",
      testUserFraction: 0.34,
      validationFraction: 0.34,
    });

    expect(first).toEqual(second);
    expect(first.testUserIds).toHaveLength(1);
    expect(first.test.every((record) => first.testUserIds.includes(record.userId))).toBe(true);
    expect([...first.train, ...first.validation].every(
      (record) => !first.testUserIds.includes(record.userId),
    )).toBe(true);

    first.trainUserIds.forEach((userId) => {
      const trainTimes = first.train.filter((record) => record.userId === userId)
        .map((record) => Date.parse(record.observedAt as string));
      const validationTimes = first.validation.filter((record) => record.userId === userId)
        .map((record) => Date.parse(record.observedAt as string));
      if (trainTimes.length && validationTimes.length) {
        expect(Math.max(...trainTimes)).toBeLessThan(Math.min(...validationTimes));
      }
    });
  });

  it("rejects invalid split configuration and dates", () => {
    expect(() => splitByUserThenTime(records, { testUserFraction: 1 })).toThrow(RangeError);
    expect(() => splitByUserThenTime([
      { userId: "a", observedAt: "not-a-date" },
    ])).toThrow(TypeError);
  });
});

describe("pilot evaluation metrics", () => {
  it("computes MAE and pairwise rank accuracy without counting abstentions", () => {
    expect(meanAbsoluteError([
      ...records,
      { userId: "d", observedAt: "2026-01-01", actual: 99, abstained: true },
    ])).toBe(0.166667);
    expect(pairwiseRankAccuracy(records)).toBe(1);
  });

  it("computes interval coverage and validates intervals", () => {
    expect(intervalCoverage([
      { userId: "a", observedAt: "2026-01-01", actual: 5, intervalLower: 4, intervalUpper: 6 },
      { userId: "b", observedAt: "2026-01-01", actual: 8, intervalLower: 4, intervalUpper: 6 },
      { userId: "c", observedAt: "2026-01-01", actual: 3, intervalLower: 5, intervalUpper: 4 },
    ])).toBe(0.5);
  });

  it("computes weighted calibration error using deterministic bins", () => {
    expect(expectedCalibrationError([
      { userId: "a", observedAt: "2026-01-01", actual: 0, predictedProbability: 0.1, label: false },
      { userId: "b", observedAt: "2026-01-01", actual: 1, predictedProbability: 0.9, label: true },
    ], 10)).toBe(0.1);
    expect(() => expectedCalibrationError([], 1)).toThrow(RangeError);
  });

  it("treats explicit and missing predictions as abstentions", () => {
    expect(abstentionRate([
      { userId: "a", observedAt: "2026-01-01", actual: 1, predicted: 1 },
      { userId: "b", observedAt: "2026-01-01", actual: 2, predicted: null },
      { userId: "c", observedAt: "2026-01-01", actual: 3, predicted: 3, abstained: true },
      { userId: "d", observedAt: "2026-01-01", actual: 4, predicted: Number.NaN },
    ])).toBe(0.75);
  });

  it("returns one consistent metric bundle", () => {
    const result = evaluateRecords(records.map((record) => ({
      ...record,
      intervalLower: record.actual - 1,
      intervalUpper: record.actual + 1,
      predictedProbability: record.actual > 3 ? 0.9 : 0.1,
      label: record.actual > 3,
    })));
    expect(result).toMatchObject({
      mae: 0.166667,
      rankAccuracy: 1,
      intervalCoverage: 1,
      calibrationError: 0.1,
      abstentionRate: 0,
      evaluatedCount: 6,
      totalCount: 6,
    });
  });
});

describe("subgroup safety and acceptance gate", () => {
  it("fails closed when a subgroup is too small", () => {
    const result = checkSubgroupGap([
      { ...records[0], subgroup: "group-a" },
      { ...records[1], subgroup: "group-a" },
      { ...records[2], subgroup: "group-b" },
    ], meanAbsoluteError, 0.2, 2);
    expect(result.passes).toBe(false);
    expect(result.insufficientGroups).toEqual(["group-b"]);
  });

  it("accepts only a candidate that beats baseline and every safety threshold", () => {
    const candidate: EvaluationMetrics = {
      mae: 0.8,
      rankAccuracy: 0.75,
      intervalCoverage: 0.86,
      calibrationError: 0.06,
      abstentionRate: 0.2,
      evaluatedCount: 200,
      totalCount: 250,
    };
    const baseline: EvaluationMetrics = {
      ...candidate,
      mae: 1,
      rankAccuracy: 0.65,
    };
    const result = evaluateAcceptanceGate({
      candidate,
      baseline,
      subgroupGap: {
        groupValues: { female: 0.8, male: 0.85 },
        maximumGap: 0.05,
        passes: true,
        insufficientGroups: [],
      },
      thresholds: { minimumRankAccuracyGain: 0.05 },
    });
    expect(result.accepted).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("reports every failed gate instead of silently promoting", () => {
    const poor: EvaluationMetrics = {
      mae: 2,
      rankAccuracy: null,
      intervalCoverage: null,
      calibrationError: 0.3,
      abstentionRate: 0.8,
      evaluatedCount: 10,
      totalCount: 50,
    };
    const baseline = { ...poor, mae: 1, rankAccuracy: 0.7 };
    const result = evaluateAcceptanceGate({
      candidate: poor,
      baseline,
      subgroupGap: {
        groupValues: {}, maximumGap: null, passes: false, insufficientGroups: ["unknown"],
      },
    });
    expect(result.accepted).toBe(false);
    expect(result.failures).toEqual([
      "insufficient_evaluation_records",
      "mae_not_acceptable",
      "rank_accuracy_not_acceptable",
      "interval_coverage_too_low",
      "calibration_error_too_high",
      "abstention_rate_too_high",
      "subgroup_gap_not_acceptable",
    ]);
  });
});
