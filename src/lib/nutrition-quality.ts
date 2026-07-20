export type CanonicalNutrientUnit = "kcal" | "g" | "mg" | "mcg";

export type NutritionDataSource =
  | "partner_entered"
  | "nutrition_label_ocr"
  | "open_food_facts"
  | "manual"
  | "estimated"
  | "backfilled";

export type NutrientQualityState = "measured" | "estimated" | "missing" | "invalid";

export type CoreNutrientCode =
  | "calories"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "fiber_g"
  | "sugar_g"
  | "sodium_mg";

export type ExtendedNutrientCode =
  | "saturated_fat_g"
  | "cholesterol_mg"
  | "potassium_mg"
  | "calcium_mg"
  | "iron_mg"
  | "vitamin_d_mcg"
  | "vitamin_b12_mcg"
  | "magnesium_mg";

export type NutrientCode = CoreNutrientCode | ExtendedNutrientCode;

export interface NormalizedNutrientValue {
  code: NutrientCode;
  value: number | null;
  unit: CanonicalNutrientUnit;
  state: NutrientQualityState;
  source: NutritionDataSource;
}

export interface NutritionCompletenessInput {
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  saturated_fat_g?: number | null;
  cholesterol_mg?: number | null;
  potassium_mg?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  vitamin_d_mcg?: number | null;
  vitamin_b12_mcg?: number | null;
  magnesium_mg?: number | null;
}

export interface NutrientCompletenessResult {
  score: number;
  presentCodes: NutrientCode[];
  missingCodes: NutrientCode[];
  invalidCodes: NutrientCode[];
  requiredMissingCodes: NutrientCode[];
}

export interface NutrientProvenance {
  source: NutritionDataSource;
  sourceRecordId: string | null;
  version: number;
  capturedAt: string;
}

export interface MicronutrientTarget {
  code: NutrientCode;
  label: string;
  unit: CanonicalNutrientUnit;
  target: number;
  direction: "minimum" | "maximum";
}

export interface MicronutrientEntry {
  code: NutrientCode;
  value: number | null;
}

export interface MicronutrientAdequacy {
  code: NutrientCode;
  label: string;
  value: number | null;
  target: number;
  unit: CanonicalNutrientUnit;
  percentage: number | null;
  direction: "minimum" | "maximum";
  status: "missing" | "low" | "on_track" | "over_limit";
}

export interface NutritionSnapshot {
  nutrition_version: number;
  provenance: NutrientProvenance;
  completeness_score: number;
  missing_nutrient_codes: NutrientCode[];
  nutrients: Record<NutrientCode, number | null>;
}

const REQUIRED_NUTRIENTS: NutrientCode[] = ["calories", "protein_g", "carbs_g", "fat_g"];
const QUALITY_NUTRIENTS: NutrientCode[] = [
  "fiber_g",
  "sugar_g",
  "sodium_mg",
  "potassium_mg",
  "calcium_mg",
  "iron_mg",
  "vitamin_d_mcg",
  "vitamin_b12_mcg",
  "magnesium_mg",
];
const ALL_COMPLETENESS_NUTRIENTS: NutrientCode[] = [...REQUIRED_NUTRIENTS, ...QUALITY_NUTRIENTS];

export const DEFAULT_MICRONUTRIENT_TARGETS: MicronutrientTarget[] = [
  { code: "fiber_g", label: "Fiber", unit: "g", target: 30, direction: "minimum" },
  { code: "sodium_mg", label: "Sodium", unit: "mg", target: 2300, direction: "maximum" },
  { code: "sugar_g", label: "Sugar", unit: "g", target: 45, direction: "maximum" },
  { code: "potassium_mg", label: "Potassium", unit: "mg", target: 3500, direction: "minimum" },
  { code: "calcium_mg", label: "Calcium", unit: "mg", target: 1000, direction: "minimum" },
  { code: "iron_mg", label: "Iron", unit: "mg", target: 8, direction: "minimum" },
  { code: "vitamin_d_mcg", label: "Vitamin D", unit: "mcg", target: 15, direction: "minimum" },
  { code: "vitamin_b12_mcg", label: "Vitamin B12", unit: "mcg", target: 2.4, direction: "minimum" },
  { code: "magnesium_mg", label: "Magnesium", unit: "mg", target: 400, direction: "minimum" },
];

function hasExplicitValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function finiteOrNull(value: unknown): number | null {
  if (!hasExplicitValue(value)) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeNutrientValue(
  code: NutrientCode,
  rawValue: unknown,
  rawUnit: CanonicalNutrientUnit,
  canonicalUnit: CanonicalNutrientUnit,
  source: NutritionDataSource,
): NormalizedNutrientValue {
  const parsed = finiteOrNull(rawValue);
  if (parsed === null) {
    return { code, value: null, unit: canonicalUnit, state: "missing", source };
  }
  if (parsed < 0) {
    return { code, value: null, unit: canonicalUnit, state: "invalid", source };
  }

  let value = parsed;
  if (rawUnit !== canonicalUnit) {
    const massInMcg: Partial<Record<CanonicalNutrientUnit, number>> = {
      g: 1_000_000,
      mg: 1_000,
      mcg: 1,
    };
    const rawFactor = massInMcg[rawUnit];
    const canonicalFactor = massInMcg[canonicalUnit];
    if (!rawFactor || !canonicalFactor) {
      return { code, value: null, unit: canonicalUnit, state: "invalid", source };
    }
    value = (parsed * rawFactor) / canonicalFactor;
  }

  return {
    code,
    value: Number(value.toFixed(canonicalUnit === "kcal" ? 0 : 2)),
    unit: canonicalUnit,
    state: source === "estimated" || source === "backfilled" ? "estimated" : "measured",
    source,
  };
}

export function calculateNutrientCompleteness(input: NutritionCompletenessInput): NutrientCompletenessResult {
  const presentCodes: NutrientCode[] = [];
  const missingCodes: NutrientCode[] = [];
  const invalidCodes: NutrientCode[] = [];

  for (const code of ALL_COMPLETENESS_NUTRIENTS) {
    const value = finiteOrNull(input[code as keyof NutritionCompletenessInput]);
    if (value === null) {
      missingCodes.push(code);
    } else if (value < 0) {
      invalidCodes.push(code);
    } else {
      presentCodes.push(code);
    }
  }

  const requiredPresent = REQUIRED_NUTRIENTS.filter((code) => presentCodes.includes(code)).length;
  const qualityPresent = QUALITY_NUTRIENTS.filter((code) => presentCodes.includes(code)).length;
  const requiredScore = (requiredPresent / REQUIRED_NUTRIENTS.length) * 70;
  const qualityScore = (qualityPresent / QUALITY_NUTRIENTS.length) * 30;

  return {
    score: Math.round(requiredScore + qualityScore),
    presentCodes,
    missingCodes,
    invalidCodes,
    requiredMissingCodes: REQUIRED_NUTRIENTS.filter((code) => !presentCodes.includes(code)),
  };
}

export function buildNutrientProvenance(
  source: NutritionDataSource,
  sourceRecordId: string | null = null,
  version = 1,
  capturedAt = new Date().toISOString(),
): NutrientProvenance {
  return { source, sourceRecordId, version, capturedAt };
}

export function calculateMicronutrientAdequacy(
  entries: MicronutrientEntry[],
  targets: MicronutrientTarget[] = DEFAULT_MICRONUTRIENT_TARGETS,
  inclusiveDayCount = 1,
): MicronutrientAdequacy[] {
  const targetMultiplier = Math.max(1, Math.floor(inclusiveDayCount));
  const totals = new Map<NutrientCode, number>();
  const measured = new Set<NutrientCode>();

  for (const entry of entries) {
    if (entry.value === null || !Number.isFinite(entry.value) || entry.value < 0) continue;
    totals.set(entry.code, (totals.get(entry.code) ?? 0) + entry.value);
    measured.add(entry.code);
  }

  return targets.map((target) => {
    const periodTarget = Number((target.target * targetMultiplier).toFixed(2));
    if (!measured.has(target.code)) {
      return {
        ...target,
        target: periodTarget,
        value: null,
        percentage: null,
        status: "missing",
      };
    }

    const value = Number((totals.get(target.code) ?? 0).toFixed(2));
    const percentage = periodTarget > 0 ? Math.round((value / periodTarget) * 100) : null;
    const status = target.direction === "minimum"
      ? value >= periodTarget ? "on_track" : "low"
      : value <= periodTarget ? "on_track" : "over_limit";

    return {
      ...target,
      target: periodTarget,
      value,
      percentage,
      status,
    };
  });
}

export function createNutritionSnapshot(
  input: NutritionCompletenessInput,
  provenance: NutrientProvenance,
): NutritionSnapshot {
  const completeness = calculateNutrientCompleteness(input);
  const nutrients = ALL_COMPLETENESS_NUTRIENTS.reduce((acc, code) => {
    const value = finiteOrNull(input[code as keyof NutritionCompletenessInput]);
    acc[code] = value === null || value < 0 ? null : value;
    return acc;
  }, {} as Record<NutrientCode, number | null>);

  return {
    nutrition_version: provenance.version,
    provenance,
    completeness_score: completeness.score,
    missing_nutrient_codes: completeness.missingCodes,
    nutrients,
  };
}
