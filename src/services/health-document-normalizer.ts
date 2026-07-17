export interface RawHealthMarker {
  name: string;
  value: number | string;
  unit?: string | null;
  source?: string;
}

export interface NormalizedHealthMarker {
  canonicalName: string;
  value: number;
  unit: string;
  originalValue: number | string;
  originalUnit: string | null;
  source?: string;
}

const aliases: Record<string, string> = {
  a1c: "HbA1c",
  hba1c: "HbA1c",
  glycatedhemoglobin: "HbA1c",
  fbs: "Fasting Glucose",
  fastingbloodsugar: "Fasting Glucose",
  bloodglucose: "Glucose",
  serumglucose: "Glucose",
  cholesterol: "Total Cholesterol",
  cholesteroltotal: "Total Cholesterol",
  hdlc: "HDL",
  ldlc: "LDL",
  tg: "Triglycerides",
  serumcreatinine: "Creatinine",
  "25ohvitamind": "Vitamin D",
  vitd: "Vitamin D",
};

const canonicalKey = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
const normalizedUnit = (value?: string | null) => (value || "")
  .toLocaleLowerCase()
  .replace("μ", "u")
  .replace("µ", "u")
  .replace(/\s+/g, "");

export function canonicalizeHealthMarkerName(name: string): string {
  const key = canonicalKey(name);
  return aliases[key] || name.trim();
}

function convertToCanonicalUnit(name: string, value: number, unit: string): { value: number; unit: string } {
  const marker = canonicalizeHealthMarkerName(name);
  const compactUnit = normalizedUnit(unit);

  if (["Glucose", "Fasting Glucose"].includes(marker) && compactUnit === "mmol/l") {
    return { value: value * 18.0182, unit: "mg/dL" };
  }
  if (["Total Cholesterol", "HDL", "LDL"].includes(marker) && compactUnit === "mmol/l") {
    return { value: value * 38.67, unit: "mg/dL" };
  }
  if (marker === "Triglycerides" && compactUnit === "mmol/l") {
    return { value: value * 88.57, unit: "mg/dL" };
  }
  if (marker === "Creatinine" && compactUnit === "umol/l") {
    return { value: value / 88.4, unit: "mg/dL" };
  }
  if (marker === "Hemoglobin" && compactUnit === "g/l") {
    return { value: value / 10, unit: "g/dL" };
  }
  if (marker === "Vitamin D" && compactUnit === "nmol/l") {
    return { value: value / 2.5, unit: "ng/mL" };
  }
  return { value, unit: unit || "unknown" };
}

export function normalizeHealthMarker(marker: RawHealthMarker): NormalizedHealthMarker {
  const parsed = typeof marker.value === "number"
    ? marker.value
    : Number(String(marker.value).replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error("INVALID_HEALTH_MARKER_VALUE");

  const canonicalName = canonicalizeHealthMarkerName(marker.name);
  const converted = convertToCanonicalUnit(canonicalName, parsed, marker.unit || "");
  return {
    canonicalName,
    value: Math.round(converted.value * 100) / 100,
    unit: converted.unit,
    originalValue: marker.value,
    originalUnit: marker.unit || null,
    source: marker.source,
  };
}

export function detectUnit(sourceLine: string, fallback?: string | null): string {
  const match = sourceLine.match(/(mg\/dL|mmol\/L|g\/dL|g\/L|µmol\/L|μmol\/L|umol\/L|mol\/L|nmol\/L|ng\/mL|pg\/mL|U\/L|%)/i);
  return match?.[1] || fallback || "unknown";
}
