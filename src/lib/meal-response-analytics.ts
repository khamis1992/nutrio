export type GlucoseUnit = "mg/dL" | "mmol/L";

export type MealTimePrecision = "exact" | "estimated_15m" | "estimated_30m" | "date_only";

export type Confounder =
  | "exercise"
  | "caffeine"
  | "alcohol"
  | "illness"
  | "poor_sleep"
  | "travel"
  | "fasting"
  | "medication_change"
  | "menstrual_cycle";

export type ExclusionReason =
  | "invalid_meal_time"
  | "date_only_meal_time"
  | "portion_not_confirmed"
  | "incomplete_nutrition"
  | "missing_baseline"
  | "low_baseline_coverage"
  | "missing_post_meal_window"
  | "low_post_meal_coverage"
  | "sensor_gap"
  | "sensor_warmup"
  | "overlapping_meal"
  | "unknown_source"
  | "unresolved_mixed_sources";

export type EpisodeEligibility = "eligible" | "descriptive_only" | "excluded";
export type EvidenceTier = "insufficient" | "descriptive" | "early" | "medium" | "strong";
export type CalibrationStatus = "not_applicable" | "calibrated" | "uncalibrated";

export interface GlucoseSample {
  timestamp: string | number | Date;
  value: number;
  unit: GlucoseUnit | string;
  sourceId?: string | null;
}

export interface NormalizedGlucoseSample {
  timestampMs: number;
  timestamp: string;
  valueMgDl: number;
  sourceIds: string[];
  observationCount: number;
}

export interface PreparedGlucoseSamples {
  samples: NormalizedGlucoseSample[];
  duplicateCount: number;
  invalidCount: number;
  outlierCount: number;
  mixedUnits: boolean;
}

export interface SampleCoverage {
  sampleCount: number;
  expectedSampleCount: number;
  ratio: number;
  maxGapMinutes: number | null;
  gapsOverThreshold: number;
  startGapMinutes: number | null;
  endGapMinutes: number | null;
}

export interface PeakMetrics {
  peakDeltaMgDl: number;
  peakValueMgDl: number;
  timeToPeakMinutes: number;
}

export interface EpisodeQualityInput {
  baselineAvailable: boolean;
  baselineCoverage: SampleCoverage;
  postMealCoverage: SampleCoverage;
  portionConfirmed?: boolean;
  nutritionCompleteness?: number;
  timePrecision?: MealTimePrecision;
  overlappingMeal?: boolean;
  sensorWarmup?: boolean;
  sourceKnown?: boolean;
  mixedSourcesResolved?: boolean;
  confounders?: Confounder[];
  minimumCoverage?: number;
  maximumGapMinutes?: number;
}

export interface EpisodeQuality {
  eligibility: EpisodeEligibility;
  exclusionReasons: ExclusionReason[];
  confounders: Confounder[];
}

export interface ConfidenceInput {
  quality: EpisodeQuality;
  baselineCoverage: number;
  postMealCoverage: number;
  maxGapMinutes: number | null;
  expectedIntervalMinutes?: number;
  timePrecision?: MealTimePrecision;
  calibrationStatus?: CalibrationStatus;
}

export interface CompositeConfidence {
  score: number;
  measurementQuality: number;
  timingQuality: number;
  contextQuality: number;
  calibrationQuality: number;
}

export interface EvidenceInput {
  eligibleEpisodeCount: number;
  distinctDayCount: number;
  consistentDirection: boolean;
  calibrated?: boolean;
  experimentBacked?: boolean;
  stable?: boolean;
  confidenceScore?: number;
}

export interface EvidenceAssessment {
  tier: EvidenceTier;
  claim: string;
}

export interface MealResponseAnalysisInput extends Omit<EpisodeQualityInput, "baselineAvailable" | "baselineCoverage" | "postMealCoverage"> {
  mealAt: string | number | Date;
  samples: GlucoseSample[];
  postMealMinutes?: 120 | 180;
  expectedIntervalMinutes?: number;
  minimumBaselineSamples?: number;
}

export interface MealResponseAnalysis {
  mealAt: string;
  windowMinutes: 120 | 180;
  baselineMgDl: number | null;
  positiveIAucMgDlMinutes: number | null;
  peak: PeakMetrics | null;
  recoveryTimeMinutes: number | null;
  baselineCoverage: SampleCoverage;
  postMealCoverage: SampleCoverage;
  quality: EpisodeQuality;
  confidence: CompositeConfidence;
  prepared: PreparedGlucoseSamples;
}

export type OutcomeSourceKind = "measured" | "self_reported";
export type OutcomeAssociationScope = "post_meal_window" | "next_day_context";

export interface DerivedMealResponseOutcome {
  outcomeType: string;
  value: number;
  unit: string;
  sourceKind: OutcomeSourceKind;
  associationScope: OutcomeAssociationScope;
  evidenceEligible: boolean;
  uncertainty: string[];
  limitations: string[];
}

export interface MealResponseCheckInObservation {
  promptOffsetMinutes: number;
  submittedAt: string | number | Date;
  satiety?: number | null;
  energy?: number | null;
  digestiveSymptoms?: readonly string[] | null;
  symptomSeverity?: number | null;
}

export interface HeartRateSample {
  timestamp: string | number | Date;
  value: number;
  unit: string;
  sourceId?: string | null;
}

export interface DailyRecoveryContext {
  metricDate: string;
  sleepMinutes?: number | null;
  hrvMs?: number | null;
  restingHeartRateBpm?: number | null;
  source?: string | null;
}

const MIN_GLUCOSE_MG_DL = 20;
const MAX_GLUCOSE_MG_DL = 600;
const MMOL_TO_MG_DL = 18.0182;
const MINUTE_MS = 60_000;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function finiteInRange(value: unknown, minimum: number, maximum: number): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= minimum && numeric <= maximum ? numeric : null;
}

/**
 * Selects one response for each intended prompt window. This prevents repeated
 * submissions from being averaged into false precision.
 */
export function deriveSelfReportedOutcomes(
  observations: readonly MealResponseCheckInObservation[],
  targetOffsets: readonly number[] = [90, 180],
  toleranceMinutes = 45,
): DerivedMealResponseOutcome[] {
  const valid = observations.flatMap((observation, index) => {
    const submittedAtMs = toUtcMilliseconds(observation.submittedAt);
    const offset = finiteInRange(observation.promptOffsetMinutes, -60, 1440);
    if (submittedAtMs === null || offset === null) return [];
    return [{ observation, submittedAtMs, offset, index }];
  });
  const outcomes: DerivedMealResponseOutcome[] = [];

  for (const target of targetOffsets) {
    const selected = valid
      .filter(({ offset }) => Math.abs(offset - target) <= toleranceMinutes)
      .sort((left, right) => {
        const offsetDifference = Math.abs(left.offset - target) - Math.abs(right.offset - target);
        if (offsetDifference !== 0) return offsetDifference;
        const timeDifference = right.submittedAtMs - left.submittedAtMs;
        return timeDifference !== 0 ? timeDifference : right.index - left.index;
      })[0];
    if (!selected) continue;

    const offsetUncertainty = selected.offset === target
      ? []
      : [`prompt_offset_${selected.offset}_minutes`];
    const shared = {
      sourceKind: "self_reported" as const,
      associationScope: "post_meal_window" as const,
      evidenceEligible: true,
      uncertainty: ["subjective_single_check_in", ...offsetUncertainty],
      limitations: ["self_reported_wellness_signal", "association_not_causation", "not_medical_advice"],
    };
    const satiety = finiteInRange(selected.observation.satiety, 1, 10);
    const energy = finiteInRange(selected.observation.energy, 1, 10);
    const severity = finiteInRange(selected.observation.symptomSeverity, 0, 4);
    const symptoms = [...new Set(selected.observation.digestiveSymptoms ?? [])]
      .filter((value) => typeof value === "string" && value.length > 0);

    if (satiety !== null) outcomes.push({
      ...shared, outcomeType: `satiety_${target}m`, value: satiety, unit: "score_1_10",
    });
    if (energy !== null) outcomes.push({
      ...shared, outcomeType: `energy_${target}m`, value: energy, unit: "score_1_10",
    });
    if (severity !== null || symptoms.length > 0) outcomes.push({
      ...shared,
      outcomeType: `digestive_symptom_severity_${target}m`,
      value: severity ?? (symptoms.length > 0 ? 1 : 0),
      unit: "score_0_4",
      uncertainty: [...shared.uncertainty, ...(severity === null ? ["severity_inferred_from_symptom_presence"] : [])],
    });
    if (symptoms.length > 0) outcomes.push({
      ...shared,
      outcomeType: `digestive_symptom_count_${target}m`,
      value: symptoms.length,
      unit: "count",
    });
  }

  return outcomes;
}

/** Heart-rate response is exploratory wellness context, not a clinical endpoint. */
export function deriveExploratoryHeartRateOutcomes(
  samples: readonly HeartRateSample[],
  mealAt: string | number | Date,
): DerivedMealResponseOutcome[] {
  const mealAtMs = toUtcMilliseconds(mealAt);
  if (mealAtMs === null) return [];
  const normalized = samples.flatMap((sample) => {
    const timestampMs = toUtcMilliseconds(sample.timestamp);
    const value = finiteInRange(sample.value, 25, 240);
    const isBpm = ["bpm", "count/min", "beats/min"].includes(sample.unit.trim().toLowerCase());
    return timestampMs === null || value === null || !isBpm ? [] : [{ timestampMs, value }];
  });
  const baseline = normalized.filter(({ timestampMs }) =>
    timestampMs >= mealAtMs - 30 * MINUTE_MS && timestampMs <= mealAtMs - 5 * MINUTE_MS);
  const postMeal = normalized.filter(({ timestampMs }) =>
    timestampMs >= mealAtMs && timestampMs <= mealAtMs + 120 * MINUTE_MS);
  if (baseline.length < 3 || postMeal.length < 6) return [];

  const baselineMedian = median(baseline.map(({ value }) => value));
  const postMealMean = mean(postMeal.map(({ value }) => value));
  if (baselineMedian === null || postMealMean === null) return [];
  const shared = {
    sourceKind: "measured" as const,
    associationScope: "post_meal_window" as const,
    evidenceEligible: false,
    uncertainty: ["activity_and_posture_not_fully_controlled", "exploratory_heart_rate_signal"],
    limitations: ["exploratory_wellness_context_only", "association_not_causation", "not_medical_advice"],
  };
  return [
    { ...shared, outcomeType: "heart_rate_baseline", value: baselineMedian, unit: "bpm" },
    { ...shared, outcomeType: "heart_rate_post_meal_mean", value: postMealMean, unit: "bpm" },
    { ...shared, outcomeType: "heart_rate_post_meal_delta", value: postMealMean - baselineMedian, unit: "bpm" },
  ];
}

/** Emits next-day observations without attributing them to an individual meal. */
export function deriveNextDayRecoveryContext(
  context: DailyRecoveryContext | null | undefined,
): DerivedMealResponseOutcome[] {
  if (!context || !/^\d{4}-\d{2}-\d{2}$/.test(context.metricDate)) return [];
  const shared = {
    sourceKind: "measured" as const,
    associationScope: "next_day_context" as const,
    evidenceEligible: false,
    uncertainty: ["day_level_signal_shared_across_all_meals", "unmeasured_daily_factors_possible"],
    limitations: ["day_level_association_only", "must_not_be_attributed_to_one_meal", "association_not_causation", "not_medical_advice"],
  };
  const candidates = [
    ["next_day_sleep_minutes", finiteInRange(context.sleepMinutes, 0, 1440), "minutes"],
    ["next_day_hrv", finiteInRange(context.hrvMs, 0, 500), "ms"],
    ["next_day_resting_heart_rate", finiteInRange(context.restingHeartRateBpm, 25, 240), "bpm"],
  ] as const;
  return candidates.flatMap(([outcomeType, value, unit]) => value === null
    ? []
    : [{ ...shared, outcomeType, value, unit }]);
}

function normalizedUnit(unit: string): GlucoseUnit | null {
  const compact = unit.trim().toLowerCase().replace(/\s/g, "");
  if (["mg/dl", "mgdl", "mg_dl"].includes(compact)) return "mg/dL";
  if (["mmol/l", "mmoll", "mmol_l"].includes(compact)) return "mmol/L";
  return null;
}

/** Parses instants only. Strings without an explicit UTC offset are rejected. */
export function toUtcMilliseconds(timestamp: string | number | Date): number | null {
  if (timestamp instanceof Date) {
    const value = timestamp.getTime();
    return Number.isFinite(value) ? value : null;
  }
  if (typeof timestamp === "number") {
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const value = timestamp.trim();
  if (!/(?:z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function glucoseToMgDl(value: number, unit: string): number | null {
  if (!Number.isFinite(value)) return null;
  const canonicalUnit = normalizedUnit(unit);
  if (canonicalUnit === null) return null;
  return canonicalUnit === "mmol/L" ? value * MMOL_TO_MG_DL : value;
}

export function prepareGlucoseSamples(samples: readonly GlucoseSample[]): PreparedGlucoseSamples {
  const observations = new Map<number, Array<{ value: number; sourceId: string | null }>>();
  const units = new Set<GlucoseUnit>();
  let invalidCount = 0;
  let outlierCount = 0;

  for (const sample of samples) {
    const timestampMs = toUtcMilliseconds(sample.timestamp);
    const unit = normalizedUnit(sample.unit);
    const valueMgDl = glucoseToMgDl(sample.value, sample.unit);
    if (timestampMs === null || unit === null || valueMgDl === null) {
      invalidCount += 1;
      continue;
    }
    units.add(unit);
    if (valueMgDl < MIN_GLUCOSE_MG_DL || valueMgDl > MAX_GLUCOSE_MG_DL) {
      outlierCount += 1;
      continue;
    }
    const existing = observations.get(timestampMs) ?? [];
    existing.push({ value: valueMgDl, sourceId: sample.sourceId?.trim() || null });
    observations.set(timestampMs, existing);
  }

  const normalizedSamples = [...observations.entries()]
    .sort(([left], [right]) => left - right)
    .map(([timestampMs, duplicates]) => ({
      timestampMs,
      timestamp: new Date(timestampMs).toISOString(),
      valueMgDl: median(duplicates.map(({ value }) => value)) as number,
      sourceIds: [...new Set(duplicates.flatMap(({ sourceId }) => sourceId ? [sourceId] : []))].sort(),
      observationCount: duplicates.length,
    }));

  return {
    samples: normalizedSamples,
    duplicateCount: normalizedSamples.reduce((total, sample) => total + sample.observationCount - 1, 0),
    invalidCount,
    outlierCount,
    mixedUnits: units.size > 1,
  };
}

export function samplesInRelativeWindow(
  samples: readonly NormalizedGlucoseSample[],
  mealAtMs: number,
  startMinutes: number,
  endMinutes: number,
): NormalizedGlucoseSample[] {
  const start = mealAtMs + startMinutes * MINUTE_MS;
  const end = mealAtMs + endMinutes * MINUTE_MS;
  return samples.filter(({ timestampMs }) => timestampMs >= start && timestampMs <= end);
}

export function calculateBaselineMedian(
  samples: readonly NormalizedGlucoseSample[],
  mealAt: string | number | Date,
  minimumSamples = 3,
): number | null {
  const mealAtMs = toUtcMilliseconds(mealAt);
  if (mealAtMs === null || minimumSamples < 1) return null;
  const baseline = samplesInRelativeWindow(samples, mealAtMs, -30, -5);
  if (baseline.length < minimumSamples) return null;
  return median(baseline.map(({ valueMgDl }) => valueMgDl));
}

export function selectPostMealWindow(
  samples: readonly NormalizedGlucoseSample[],
  mealAt: string | number | Date,
  windowMinutes: 120 | 180 = 120,
): NormalizedGlucoseSample[] {
  const mealAtMs = toUtcMilliseconds(mealAt);
  return mealAtMs === null ? [] : samplesInRelativeWindow(samples, mealAtMs, 0, windowMinutes);
}

export function calculatePositiveIAuc(
  postMealSamples: readonly NormalizedGlucoseSample[],
  baselineMgDl: number,
): number | null {
  if (!Number.isFinite(baselineMgDl) || postMealSamples.length < 2) return null;
  const sorted = [...postMealSamples].sort((left, right) => left.timestampMs - right.timestampMs);
  let area = 0;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const durationMinutes = (current.timestampMs - previous.timestampMs) / MINUTE_MS;
    if (durationMinutes <= 0) continue;
    const previousDelta = previous.valueMgDl - baselineMgDl;
    const currentDelta = current.valueMgDl - baselineMgDl;
    if (previousDelta >= 0 && currentDelta >= 0) {
      area += durationMinutes * (previousDelta + currentDelta) / 2;
    } else if (previousDelta > 0 || currentDelta > 0) {
      const positiveDelta = Math.max(previousDelta, currentDelta);
      const positiveFraction = positiveDelta / Math.abs(currentDelta - previousDelta);
      area += durationMinutes * positiveFraction * positiveDelta / 2;
    }
  }
  return area;
}

export function calculatePeakMetrics(
  postMealSamples: readonly NormalizedGlucoseSample[],
  baselineMgDl: number,
  mealAt: string | number | Date,
): PeakMetrics | null {
  const mealAtMs = toUtcMilliseconds(mealAt);
  if (mealAtMs === null || !Number.isFinite(baselineMgDl) || postMealSamples.length === 0) return null;
  const peak = postMealSamples.reduce((highest, sample) =>
    sample.valueMgDl > highest.valueMgDl
      || (sample.valueMgDl === highest.valueMgDl && sample.timestampMs < highest.timestampMs)
      ? sample
      : highest);
  return {
    peakDeltaMgDl: Math.max(0, peak.valueMgDl - baselineMgDl),
    peakValueMgDl: peak.valueMgDl,
    timeToPeakMinutes: (peak.timestampMs - mealAtMs) / MINUTE_MS,
  };
}

export function calculateRecoveryTime(
  postMealSamples: readonly NormalizedGlucoseSample[],
  baselineMgDl: number,
  mealAt: string | number | Date,
): number | null {
  const mealAtMs = toUtcMilliseconds(mealAt);
  if (mealAtMs === null || !Number.isFinite(baselineMgDl) || postMealSamples.length < 2) return null;
  const sorted = [...postMealSamples].sort((left, right) => left.timestampMs - right.timestampMs);
  const peak = calculatePeakMetrics(sorted, baselineMgDl, mealAtMs);
  if (peak === null || peak.peakDeltaMgDl <= 0) return 0;
  const peakAtMs = mealAtMs + peak.timeToPeakMinutes * MINUTE_MS;
  const afterPeak = sorted.filter(({ timestampMs }) => timestampMs >= peakAtMs);

  for (let index = 1; index < afterPeak.length; index += 1) {
    const previous = afterPeak[index - 1];
    const current = afterPeak[index];
    const previousDelta = previous.valueMgDl - baselineMgDl;
    const currentDelta = current.valueMgDl - baselineMgDl;
    if (currentDelta > 0) continue;
    if (previousDelta <= 0) return (previous.timestampMs - mealAtMs) / MINUTE_MS;
    const fraction = previousDelta / (previousDelta - currentDelta);
    const crossingMs = previous.timestampMs + fraction * (current.timestampMs - previous.timestampMs);
    return (crossingMs - mealAtMs) / MINUTE_MS;
  }
  return null;
}

export function assessSampleCoverage(
  samples: readonly NormalizedGlucoseSample[],
  windowStartMs: number,
  windowEndMs: number,
  expectedIntervalMinutes = 5,
  gapThresholdMinutes = 15,
): SampleCoverage {
  if (windowEndMs < windowStartMs || expectedIntervalMinutes <= 0 || gapThresholdMinutes <= 0) {
    return {
      sampleCount: 0,
      expectedSampleCount: 0,
      ratio: 0,
      maxGapMinutes: null,
      gapsOverThreshold: 0,
      startGapMinutes: null,
      endGapMinutes: null,
    };
  }
  const inWindow = [...samples]
    .filter(({ timestampMs }) => timestampMs >= windowStartMs && timestampMs <= windowEndMs)
    .sort((left, right) => left.timestampMs - right.timestampMs);
  const durationMinutes = (windowEndMs - windowStartMs) / MINUTE_MS;
  const expectedSampleCount = Math.floor(durationMinutes / expectedIntervalMinutes) + 1;
  if (inWindow.length === 0) {
    return {
      sampleCount: 0,
      expectedSampleCount,
      ratio: 0,
      maxGapMinutes: durationMinutes,
      gapsOverThreshold: durationMinutes > gapThresholdMinutes ? 1 : 0,
      startGapMinutes: durationMinutes,
      endGapMinutes: durationMinutes,
    };
  }
  const gaps = [
    (inWindow[0].timestampMs - windowStartMs) / MINUTE_MS,
    ...inWindow.slice(1).map((sample, index) =>
      (sample.timestampMs - inWindow[index].timestampMs) / MINUTE_MS),
    (windowEndMs - inWindow[inWindow.length - 1].timestampMs) / MINUTE_MS,
  ];
  return {
    sampleCount: inWindow.length,
    expectedSampleCount,
    ratio: clamp(inWindow.length / expectedSampleCount, 0, 1),
    maxGapMinutes: Math.max(...gaps),
    gapsOverThreshold: gaps.filter((gap) => gap > gapThresholdMinutes).length,
    startGapMinutes: gaps[0],
    endGapMinutes: gaps[gaps.length - 1],
  };
}

export function assessEpisodeQuality(input: EpisodeQualityInput): EpisodeQuality {
  const minimumCoverage = input.minimumCoverage ?? 0.8;
  const maximumGapMinutes = input.maximumGapMinutes ?? 15;
  const reasons: ExclusionReason[] = [];
  if (input.timePrecision === "date_only") reasons.push("date_only_meal_time");
  if (input.portionConfirmed === false) reasons.push("portion_not_confirmed");
  if ((input.nutritionCompleteness ?? 1) < 0.8) reasons.push("incomplete_nutrition");
  if (!input.baselineAvailable) reasons.push("missing_baseline");
  if (input.baselineCoverage.ratio < minimumCoverage) reasons.push("low_baseline_coverage");
  if (input.postMealCoverage.sampleCount === 0) reasons.push("missing_post_meal_window");
  else if (input.postMealCoverage.ratio < minimumCoverage) reasons.push("low_post_meal_coverage");
  if (Math.max(
    input.baselineCoverage.maxGapMinutes ?? 0,
    input.postMealCoverage.maxGapMinutes ?? 0,
  ) > maximumGapMinutes) reasons.push("sensor_gap");
  if (input.sensorWarmup) reasons.push("sensor_warmup");
  if (input.overlappingMeal) reasons.push("overlapping_meal");
  if (input.sourceKnown === false) reasons.push("unknown_source");
  if (input.mixedSourcesResolved === false) reasons.push("unresolved_mixed_sources");

  const confounders = [...new Set(input.confounders ?? [])].sort();
  const timingIsEstimated = input.timePrecision === "estimated_15m" || input.timePrecision === "estimated_30m";
  return {
    eligibility: reasons.length > 0 ? "excluded" : confounders.length > 0 || timingIsEstimated ? "descriptive_only" : "eligible",
    exclusionReasons: reasons,
    confounders,
  };
}

export function calculateCompositeConfidence(input: ConfidenceInput): CompositeConfidence {
  const measurementQuality = clamp(Math.min(input.baselineCoverage, input.postMealCoverage), 0, 1);
  const timingQuality: Record<MealTimePrecision, number> = {
    exact: 1,
    estimated_15m: 0.75,
    estimated_30m: 0.45,
    date_only: 0,
  };
  const timing = timingQuality[input.timePrecision ?? "exact"];
  const contextQuality = input.quality.confounders.length === 0
    ? 1
    : Math.max(0.4, 1 - input.quality.confounders.length * 0.15);
  const calibrationQuality = input.calibrationStatus === "uncalibrated" ? 0.65 : 1;
  const gapQuality = input.maxGapMinutes === null
    ? 0
    : clamp((input.expectedIntervalMinutes ?? 5) / Math.max(input.maxGapMinutes, input.expectedIntervalMinutes ?? 5), 0, 1);
  const geometricScore = 100 * Math.pow(
    measurementQuality * timing * contextQuality * calibrationQuality * gapQuality,
    1 / 5,
  );
  const eligibilityCap: Record<EpisodeEligibility, number> = {
    eligible: 100,
    descriptive_only: 49,
    excluded: 0,
  };
  const calibrationCap = input.calibrationStatus === "uncalibrated" ? 69 : 100;

  return {
    score: Math.round(Math.min(geometricScore || 0, eligibilityCap[input.quality.eligibility], calibrationCap)),
    measurementQuality,
    timingQuality: timing,
    contextQuality,
    calibrationQuality,
  };
}

const EVIDENCE_CLAIMS: Record<EvidenceTier, string> = {
  insufficient: "There is not enough qualified data to describe a meal-response pattern.",
  descriptive: "This describes what was observed after this meal and does not establish a personal pattern or cause.",
  early: "An early pattern may be present; more qualified repetitions are needed.",
  medium: "A repeated personal association is present under similar observed conditions; it does not establish cause.",
  strong: "A stable personal pattern is supported within the observed wellness context; it is not a diagnosis or treatment claim.",
};

export function classifyEvidenceTier(input: EvidenceInput): EvidenceAssessment {
  const episodes = Math.max(0, Math.floor(input.eligibleEpisodeCount));
  const days = Math.max(0, Math.floor(input.distinctDayCount));
  const confidence = clamp(input.confidenceScore ?? 100, 0, 100);
  let tier: EvidenceTier = "insufficient";
  if (episodes >= 1 && confidence > 0) tier = "descriptive";
  if (episodes >= 3 && confidence >= 50) tier = "early";
  if (episodes >= 5 && days >= 3 && input.consistentDirection && input.calibrated === true && confidence >= 70) {
    tier = "medium";
  }
  if ((episodes >= 8 || input.experimentBacked === true)
    && days >= 3
    && input.consistentDirection
    && input.stable === true
    && input.calibrated === true
    && confidence >= 85) {
    tier = "strong";
  }
  return { tier, claim: EVIDENCE_CLAIMS[tier] };
}

export function analyzeMealResponse(input: MealResponseAnalysisInput): MealResponseAnalysis {
  const mealAtMs = toUtcMilliseconds(input.mealAt);
  const prepared = prepareGlucoseSamples(input.samples);
  const windowMinutes = input.postMealMinutes ?? 120;
  const expectedInterval = input.expectedIntervalMinutes ?? 5;
  const emptyCoverage = assessSampleCoverage([], 0, 0, expectedInterval);
  if (mealAtMs === null) {
    const quality: EpisodeQuality = {
      eligibility: "excluded",
      exclusionReasons: ["invalid_meal_time"],
      confounders: [...new Set(input.confounders ?? [])].sort(),
    };
    return {
      mealAt: "",
      windowMinutes,
      baselineMgDl: null,
      positiveIAucMgDlMinutes: null,
      peak: null,
      recoveryTimeMinutes: null,
      baselineCoverage: emptyCoverage,
      postMealCoverage: emptyCoverage,
      quality,
      confidence: calculateCompositeConfidence({
        quality,
        baselineCoverage: 0,
        postMealCoverage: 0,
        maxGapMinutes: null,
        expectedIntervalMinutes: expectedInterval,
        timePrecision: input.timePrecision,
      }),
      prepared,
    };
  }

  const baselineSamples = samplesInRelativeWindow(prepared.samples, mealAtMs, -30, -5);
  const postMealSamples = samplesInRelativeWindow(prepared.samples, mealAtMs, 0, windowMinutes);
  const baselineMgDl = baselineSamples.length >= (input.minimumBaselineSamples ?? 3)
    ? median(baselineSamples.map(({ valueMgDl }) => valueMgDl))
    : null;
  const baselineCoverage = assessSampleCoverage(
    baselineSamples,
    mealAtMs - 30 * MINUTE_MS,
    mealAtMs - 5 * MINUTE_MS,
    expectedInterval,
  );
  const postMealCoverage = assessSampleCoverage(
    postMealSamples,
    mealAtMs,
    mealAtMs + windowMinutes * MINUTE_MS,
    expectedInterval,
  );
  const quality = assessEpisodeQuality({
    ...input,
    baselineAvailable: baselineMgDl !== null,
    baselineCoverage,
    postMealCoverage,
  });
  const confidence = calculateCompositeConfidence({
    quality,
    baselineCoverage: baselineCoverage.ratio,
    postMealCoverage: postMealCoverage.ratio,
    maxGapMinutes: postMealCoverage.maxGapMinutes,
    expectedIntervalMinutes: expectedInterval,
    timePrecision: input.timePrecision,
    calibrationStatus: "not_applicable",
  });

  return {
    mealAt: new Date(mealAtMs).toISOString(),
    windowMinutes,
    baselineMgDl,
    positiveIAucMgDlMinutes: baselineMgDl === null ? null : calculatePositiveIAuc(postMealSamples, baselineMgDl),
    peak: baselineMgDl === null ? null : calculatePeakMetrics(postMealSamples, baselineMgDl, mealAtMs),
    recoveryTimeMinutes: baselineMgDl === null ? null : calculateRecoveryTime(postMealSamples, baselineMgDl, mealAtMs),
    baselineCoverage,
    postMealCoverage,
    quality,
    confidence,
    prepared,
  };
}
