export interface EvaluationRecord {
  userId: string;
  observedAt: string | Date;
  actual: number;
  predicted?: number | null;
  intervalLower?: number | null;
  intervalUpper?: number | null;
  predictedProbability?: number | null;
  label?: boolean | null;
  subgroup?: string | null;
  abstained?: boolean;
}

export interface UserTemporalSplit<T extends Pick<EvaluationRecord, "userId" | "observedAt">> {
  train: T[];
  validation: T[];
  test: T[];
  trainUserIds: string[];
  testUserIds: string[];
}

export interface SplitOptions {
  testUserFraction?: number;
  validationFraction?: number;
  seed?: string;
}

export interface EvaluationMetrics {
  mae: number | null;
  rankAccuracy: number | null;
  intervalCoverage: number | null;
  calibrationError: number | null;
  abstentionRate: number;
  evaluatedCount: number;
  totalCount: number;
}

export interface SubgroupGapResult {
  groupValues: Record<string, number>;
  maximumGap: number | null;
  passes: boolean;
  insufficientGroups: string[];
}

export interface AcceptanceThresholds {
  minimumRecords: number;
  maximumMaeRegression: number;
  minimumRankAccuracyGain: number;
  minimumIntervalCoverage: number;
  maximumCalibrationError: number;
  maximumAbstentionRate: number;
  maximumSubgroupGap: number;
}

export interface AcceptanceGateInput {
  candidate: EvaluationMetrics;
  baseline: EvaluationMetrics;
  subgroupGap: SubgroupGapResult;
  thresholds?: Partial<AcceptanceThresholds>;
}

export interface AcceptanceGateResult {
  accepted: boolean;
  failures: string[];
  thresholds: AcceptanceThresholds;
}

const DEFAULT_THRESHOLDS: AcceptanceThresholds = {
  minimumRecords: 100,
  maximumMaeRegression: 0,
  minimumRankAccuracyGain: 0,
  minimumIntervalCoverage: 0.8,
  maximumCalibrationError: 0.1,
  maximumAbstentionRate: 0.35,
  maximumSubgroupGap: 0.1,
};

function assertFraction(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new RangeError(`${name} must be between 0 and 1`);
  }
}

function asTimestamp(value: string | Date): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError("observedAt must be a valid date");
  return timestamp;
}

// FNV-1a is used only for reproducible partitioning, never for security.
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function isScored(record: EvaluationRecord): record is EvaluationRecord & { predicted: number } {
  return !record.abstained && typeof record.predicted === "number" && Number.isFinite(record.predicted);
}

export function splitByUserThenTime<
  T extends Pick<EvaluationRecord, "userId" | "observedAt">,
>(records: readonly T[], options: SplitOptions = {}): UserTemporalSplit<T> {
  const testUserFraction = options.testUserFraction ?? 0.2;
  const validationFraction = options.validationFraction ?? 0.2;
  const seed = options.seed ?? "meal-response-pilot-v1";
  assertFraction(testUserFraction, "testUserFraction");
  assertFraction(validationFraction, "validationFraction");

  const byUser = new Map<string, T[]>();
  records.forEach((record) => {
    if (!record.userId) throw new TypeError("userId is required");
    asTimestamp(record.observedAt);
    const bucket = byUser.get(record.userId) ?? [];
    bucket.push(record);
    byUser.set(record.userId, bucket);
  });

  const userIds = [...byUser.keys()].sort((a, b) => {
    const hashDifference = stableHash(`${seed}:${a}`) - stableHash(`${seed}:${b}`);
    return hashDifference || a.localeCompare(b);
  });
  const testCount = userIds.length < 2
    ? 0
    : Math.max(1, Math.min(userIds.length - 1, Math.round(userIds.length * testUserFraction)));
  const testUserIds = userIds.slice(0, testCount).sort();
  const trainUserIds = userIds.slice(testCount).sort();
  const testUsers = new Set(testUserIds);
  const train: T[] = [];
  const validation: T[] = [];
  const test: T[] = [];

  userIds.forEach((userId) => {
    const ordered = [...(byUser.get(userId) ?? [])].sort((a, b) =>
      asTimestamp(a.observedAt) - asTimestamp(b.observedAt));
    if (testUsers.has(userId)) {
      test.push(...ordered);
      return;
    }
    const validationCount = ordered.length < 2
      ? 0
      : Math.max(1, Math.min(ordered.length - 1, Math.round(ordered.length * validationFraction)));
    train.push(...ordered.slice(0, ordered.length - validationCount));
    validation.push(...ordered.slice(ordered.length - validationCount));
  });

  return { train, validation, test, trainUserIds, testUserIds };
}

export function meanAbsoluteError(records: readonly EvaluationRecord[]): number | null {
  const errors = records.filter(isScored).map((record) => Math.abs(record.predicted - record.actual));
  return errors.length ? roundMetric(errors.reduce((sum, error) => sum + error, 0) / errors.length) : null;
}

export function pairwiseRankAccuracy(records: readonly EvaluationRecord[]): number | null {
  const scored = records.filter(isScored);
  let comparable = 0;
  let concordant = 0;
  for (let left = 0; left < scored.length; left += 1) {
    for (let right = left + 1; right < scored.length; right += 1) {
      const actualDifference = scored[left].actual - scored[right].actual;
      const predictedDifference = scored[left].predicted - scored[right].predicted;
      if (actualDifference === 0 || predictedDifference === 0) continue;
      comparable += 1;
      if (Math.sign(actualDifference) === Math.sign(predictedDifference)) concordant += 1;
    }
  }
  return comparable ? roundMetric(concordant / comparable) : null;
}

export function intervalCoverage(records: readonly EvaluationRecord[]): number | null {
  const eligible = records.filter((record) =>
    !record.abstained
    && typeof record.intervalLower === "number"
    && Number.isFinite(record.intervalLower)
    && typeof record.intervalUpper === "number"
    && Number.isFinite(record.intervalUpper)
    && record.intervalLower <= record.intervalUpper);
  if (!eligible.length) return null;
  const covered = eligible.filter((record) =>
    record.actual >= (record.intervalLower as number)
    && record.actual <= (record.intervalUpper as number)).length;
  return roundMetric(covered / eligible.length);
}

export function expectedCalibrationError(
  records: readonly EvaluationRecord[],
  binCount = 10,
): number | null {
  if (!Number.isInteger(binCount) || binCount < 2 || binCount > 100) {
    throw new RangeError("binCount must be an integer between 2 and 100");
  }
  const eligible = records.filter((record) =>
    !record.abstained
    && typeof record.predictedProbability === "number"
    && Number.isFinite(record.predictedProbability)
    && record.predictedProbability >= 0
    && record.predictedProbability <= 1
    && typeof record.label === "boolean");
  if (!eligible.length) return null;

  let weightedError = 0;
  for (let bin = 0; bin < binCount; bin += 1) {
    const lower = bin / binCount;
    const upper = (bin + 1) / binCount;
    const bucket = eligible.filter((record) => {
      const probability = record.predictedProbability as number;
      return probability >= lower && (bin === binCount - 1 ? probability <= upper : probability < upper);
    });
    if (!bucket.length) continue;
    const confidence = bucket.reduce((sum, record) => sum + (record.predictedProbability as number), 0) / bucket.length;
    const observed = bucket.filter((record) => record.label).length / bucket.length;
    weightedError += (bucket.length / eligible.length) * Math.abs(confidence - observed);
  }
  return roundMetric(weightedError);
}

export function abstentionRate(records: readonly EvaluationRecord[]): number {
  if (!records.length) return 0;
  const abstained = records.filter((record) => record.abstained || !isScored(record)).length;
  return roundMetric(abstained / records.length);
}

export function evaluateRecords(records: readonly EvaluationRecord[]): EvaluationMetrics {
  return {
    mae: meanAbsoluteError(records),
    rankAccuracy: pairwiseRankAccuracy(records),
    intervalCoverage: intervalCoverage(records),
    calibrationError: expectedCalibrationError(records),
    abstentionRate: abstentionRate(records),
    evaluatedCount: records.filter(isScored).length,
    totalCount: records.length,
  };
}

export function checkSubgroupGap(
  records: readonly EvaluationRecord[],
  metric: (group: readonly EvaluationRecord[]) => number | null,
  maximumAllowedGap: number,
  minimumGroupSize = 20,
): SubgroupGapResult {
  if (maximumAllowedGap < 0 || !Number.isFinite(maximumAllowedGap)) {
    throw new RangeError("maximumAllowedGap must be non-negative");
  }
  if (!Number.isInteger(minimumGroupSize) || minimumGroupSize < 1) {
    throw new RangeError("minimumGroupSize must be a positive integer");
  }
  const groups = new Map<string, EvaluationRecord[]>();
  records.forEach((record) => {
    const key = record.subgroup?.trim() || "unknown";
    const bucket = groups.get(key) ?? [];
    bucket.push(record);
    groups.set(key, bucket);
  });
  const groupValues: Record<string, number> = {};
  const insufficientGroups: string[] = [];
  [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([group, values]) => {
    if (values.length < minimumGroupSize) {
      insufficientGroups.push(group);
      return;
    }
    const result = metric(values);
    if (result === null || !Number.isFinite(result)) insufficientGroups.push(group);
    else groupValues[group] = result;
  });
  const values = Object.values(groupValues);
  const maximumGap = values.length >= 2 ? roundMetric(Math.max(...values) - Math.min(...values)) : null;
  return {
    groupValues,
    maximumGap,
    passes: insufficientGroups.length === 0 && maximumGap !== null && maximumGap <= maximumAllowedGap,
    insufficientGroups,
  };
}

export function evaluateAcceptanceGate(input: AcceptanceGateInput): AcceptanceGateResult {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };
  const failures: string[] = [];
  const { candidate, baseline } = input;

  if (candidate.evaluatedCount < thresholds.minimumRecords) failures.push("insufficient_evaluation_records");
  if (candidate.mae === null || baseline.mae === null
      || candidate.mae > baseline.mae + thresholds.maximumMaeRegression) {
    failures.push("mae_not_acceptable");
  }
  if (candidate.rankAccuracy === null || baseline.rankAccuracy === null
      || candidate.rankAccuracy < baseline.rankAccuracy + thresholds.minimumRankAccuracyGain) {
    failures.push("rank_accuracy_not_acceptable");
  }
  if (candidate.intervalCoverage === null
      || candidate.intervalCoverage < thresholds.minimumIntervalCoverage) {
    failures.push("interval_coverage_too_low");
  }
  if (candidate.calibrationError === null
      || candidate.calibrationError > thresholds.maximumCalibrationError) {
    failures.push("calibration_error_too_high");
  }
  if (candidate.abstentionRate > thresholds.maximumAbstentionRate) {
    failures.push("abstention_rate_too_high");
  }
  if (!input.subgroupGap.passes || input.subgroupGap.maximumGap === null
      || input.subgroupGap.maximumGap > thresholds.maximumSubgroupGap) {
    failures.push("subgroup_gap_not_acceptable");
  }

  return { accepted: failures.length === 0, failures, thresholds };
}
