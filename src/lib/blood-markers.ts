// ─── Types ──────────────────────────────────────────────────────────────────
export type MarkerCategory =
  | "metabolic" | "lipid" | "liver" | "kidney"
  | "thyroid" | "vitamins" | "hormones" | "blood" | "inflammation";

export type MarkerStatus = "low" | "normal" | "high" | "critical";

export interface BloodMarkerDefinition {
  id: string;
  marker_name: string;
  marker_name_ar: string | null;
  unit: string;
  normal_min: number | null;
  normal_max: number | null;
  category: MarkerCategory;
  description: string | null;
}

export interface BloodWorkRecord {
  id: string;
  user_id: string;
  lab_name: string | null;
  test_date: string;
  fasting: boolean;
  report_url: string | null;
  status: "pending" | "processing" | "analyzed" | "error";
  ai_analysis: string | null;
  created_at: string;
}

export interface BloodMarker {
  id: string;
  record_id: string;
  marker_name: string;
  marker_name_ar: string | null;
  value: number;
  unit: string;
  normal_min: number | null;
  normal_max: number | null;
  status: MarkerStatus;
  category: MarkerCategory;
  notes: string | null;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function computeMarkerStatus(
  value: number,
  normalMin: number | null,
  normalMax: number | null
): MarkerStatus {
  if (normalMin !== null && normalMax !== null) {
    const range = normalMax - normalMin;
    const lowThreshold = normalMin - range * 0.3;
    const highThreshold = normalMax + range * 0.3;
    if (value < lowThreshold) return "critical";
    if (value < normalMin) return "low";
    if (value > highThreshold) return "critical";
    if (value > normalMax) return "high";
    return "normal";
  }
  if (normalMin !== null && value < normalMin) {
    const diff = normalMin - value;
    return diff > normalMin * 0.3 ? "critical" : "low";
  }
  if (normalMax !== null && value > normalMax) {
    const diff = value - normalMax;
    return diff > normalMax * 0.3 ? "critical" : "high";
  }
  return "normal";
}

export function statusColor(status: MarkerStatus): string {
  switch (status) {
    case "normal": return "bg-green-500";
    case "low":
    case "high": return "bg-yellow-500";
    case "critical": return "bg-red-600";
  }
}

export function statusTextColor(status: MarkerStatus): string {
  switch (status) {
    case "normal": return "text-green-600";
    case "low":
    case "high": return "text-yellow-600";
    case "critical": return "text-red-600";
  }
}

export function statusBgLight(status: MarkerStatus): string {
  switch (status) {
    case "normal": return "bg-green-50 border-green-200";
    case "low":
    case "high": return "bg-yellow-50 border-yellow-200";
    case "critical": return "bg-red-50 border-red-200";
  }
}

export function categoryIcon(category: MarkerCategory): string {
  const icons: Record<MarkerCategory, string> = {
    metabolic: "🔥",
    lipid: "🫀",
    liver: "🫘",
    kidney: "💧",
    thyroid: "🦋",
    vitamins: "💊",
    hormones: "⚗️",
    blood: "🩸",
    inflammation: "🌡️",
  };
  return icons[category] || "🔬";
}

export function categoryLabel(category: MarkerCategory): string {
  const labels: Record<MarkerCategory, { en: string; ar: string }> = {
    metabolic: { en: "Metabolic", ar: "التمثيل الغذائي" },
    lipid: { en: "Lipid Panel", ar: "لوحة الدهون" },
    liver: { en: "Liver Function", ar: "وظائف الكبد" },
    kidney: { en: "Kidney Function", ar: "وظائف الكلى" },
    thyroid: { en: "Thyroid", ar: "الغدة الدرقية" },
    vitamins: { en: "Vitamins & Minerals", ar: "الفيتامينات والمعادن" },
    hormones: { en: "Hormones", ar: "الهرمونات" },
    blood: { en: "Blood Count", ar: "تحليل الدم" },
    inflammation: { en: "Inflammation", ar: "الالتهابات" },
  };
  return labels[category]?.en || category;
}

export function categoryLabelAr(category: MarkerCategory): string {
  const labels: Record<MarkerCategory, string> = {
    metabolic: "التمثيل الغذائي",
    lipid: "لوحة الدهون",
    liver: "وظائف الكبد",
    kidney: "وظائف الكلى",
    thyroid: "الغدة الدرقية",
    vitamins: "الفيتامينات والمعادن",
    hormones: "الهرمونات",
    blood: "تحليل الدم",
    inflammation: "الالتهابات",
  };
  return labels[category] || category;
}

/** Group markers by category */
export function groupByCategory(markers: BloodMarker[]): Record<string, BloodMarker[]> {
  return markers.reduce((acc, m) => {
    (acc[m.category] = acc[m.category] || []).push(m);
    return acc;
  }, {} as Record<string, BloodMarker[]>);
}

/** Calculate overall health score from markers (0-100) */
export function calculateHealthScore(markers: BloodMarker[]): number {
  if (markers.length === 0) return 0;
  const weights: Record<MarkerStatus, number> = { normal: 1, low: 0.7, high: 0.7, critical: 0.3 };
  const total = markers.reduce((sum, m) => sum + weights[m.status], 0);
  return Math.round((total / markers.length) * 100);
}
