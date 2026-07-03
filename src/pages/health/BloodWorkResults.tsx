import { useEffect, useState } from "react";
import { format } from "date-fns";
import DOMPurify from "dompurify";
import {
  Activity,
  ArrowLeft,
  Brain,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile, type Profile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import {
  calculateHealthScore,
  categoryIcon,
  categoryLabel,
  categoryLabelAr,
  computeMarkerStatus,
  groupByCategory,
  type BloodMarker,
  type BloodWorkRecord,
  type MarkerCategory,
} from "@/lib/blood-markers";
import { cn } from "@/lib/utils";
import { analyzeBloodWork } from "@/services/blood-work-ai";
import { extractBloodMarkersFromPdf } from "@/services/blood-work-extractor";
import {
  deleteBloodWorkRecord,
  fetchBloodWorkRecords,
  fetchMarkerDefinitions,
  fetchMarkerHistory,
  fetchMarkersForRecord,
  insertMarkers,
  updateRecordAnalysis,
} from "@/services/blood-work";

const NORMAL_MARKER_COLOR = "#22C7A1";
const WARNING_MARKER_COLOR = "#FB6B7A";

function markerColor(status: BloodMarker["status"]) {
  return status === "normal" ? NORMAL_MARKER_COLOR : WARNING_MARKER_COLOR;
}

function markerPosition(marker: BloodMarker) {
  const low = marker.normal_min;
  const high = marker.normal_max;
  const value = Number(marker.value);

  if (low !== null && high !== null && high > low) {
    const paddedLow = Math.max(0, low - (high - low) * 0.35);
    const paddedHigh = high + (high - low) * 0.35;
    return Math.min(96, Math.max(4, ((value - paddedLow) / (paddedHigh - paddedLow)) * 100));
  }

  if (high !== null && high > 0) return Math.min(96, Math.max(4, (value / (high * 1.35)) * 100));
  if (low !== null && low > 0) return Math.min(96, Math.max(4, (value / (low * 1.65)) * 100));
  return 50;
}

function markerRange(marker: BloodMarker) {
  if (marker.normal_min !== null && marker.normal_max !== null) {
    return `${marker.normal_min} - ${marker.normal_max} ${marker.unit}`;
  }
  if (marker.normal_min !== null) return `> ${marker.normal_min} ${marker.unit}`;
  if (marker.normal_max !== null) return `< ${marker.normal_max} ${marker.unit}`;
  return marker.unit;
}

function formatAnalysisHtml(markdown: string) {
  const cleaned = markdown
    .replace(/^\s*[-*]\s+\*\*(Name|Age|Gender|Height|Current weight|Target weight|Health goal|Activity level|Daily calorie target|Macro targets):\*\*.*$/gim, "")
    .replace(/^\s*[-*]\s+(Name|Age|Gender|Height|Current weight|Target weight|Health goal|Activity level|Daily calorie target|Macro targets):.*$/gim, "")
    .replace(/^\s*(Name|Age|Gender|Height|Current weight|Target weight|Health goal|Activity level|Daily calorie target|Macro targets):.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const escaped = cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return DOMPurify.sanitize(
    escaped
      .replace(/^### (.*)$/gm, '<h4 class="mt-5 text-[14px] font-black text-[#020617]">$1</h4>')
      .replace(/^## (.*)$/gm, '<h3 class="mt-5 text-[16px] font-black text-[#020617]">$1</h3>')
      .replace(/^# (.*)$/gm, '<h3 class="mt-5 text-[16px] font-black text-[#020617]">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-[#020617]">$1</strong>')
      .replace(/^\s*[-*]\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/\n---\n/g, '<hr class="my-4 border-[#E5EAF1]" />')
      .replace(/\n{2,}/g, "<br /><br />")
      .replace(/\n/g, "<br />")
  );
}

function prettyValue(value: string | number | null | undefined, suffix = "") {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "number") return `${value.toLocaleString()}${suffix}`;
  return `${value.replace(/_/g, " ")}${suffix}`;
}

type TrendInsight = {
  markerName: string;
  unit: string;
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number | null;
  direction: "up" | "down" | "stable";
  status: BloodMarker["status"];
  category: MarkerCategory;
};

function buildTrendInsights(
  record: BloodWorkRecord,
  records: BloodWorkRecord[],
  markersMap: Record<string, BloodMarker[]>
): TrendInsight[] {
  const currentMarkers = markersMap[record.id] || [];
  if (currentMarkers.length === 0) return [];

  const currentTime = new Date(record.test_date).getTime();
  const previousRecord = records
    .filter((item) => item.id !== record.id && new Date(item.test_date).getTime() < currentTime)
    .sort((a, b) => new Date(b.test_date).getTime() - new Date(a.test_date).getTime())
    .find((item) => (markersMap[item.id] || []).length > 0);

  if (!previousRecord) return [];

  const previousByName = new Map((markersMap[previousRecord.id] || []).map((marker) => [marker.marker_name.toLowerCase(), marker]));

  return currentMarkers
    .map((marker) => {
      const previous = previousByName.get(marker.marker_name.toLowerCase());
      if (!previous) return null;

      const change = Number(marker.value) - Number(previous.value);
      const changePercent = previous.value !== 0 ? (change / Number(previous.value)) * 100 : null;
      const stableThreshold = Math.max(Math.abs(Number(previous.value)) * 0.03, 0.1);

      return {
        markerName: marker.marker_name,
        unit: marker.unit,
        currentValue: Number(marker.value),
        previousValue: Number(previous.value),
        change,
        changePercent,
        direction: Math.abs(change) <= stableThreshold ? "stable" : change > 0 ? "up" : "down",
        status: marker.status,
        category: marker.category,
      } satisfies TrendInsight;
    })
    .filter((item): item is TrendInsight => Boolean(item))
    .sort((a, b) => Math.abs(b.changePercent ?? b.change) - Math.abs(a.changePercent ?? a.change))
    .slice(0, 6);
}

function formatTrendSummaryForAi(trends: TrendInsight[]) {
  if (trends.length === 0) return "No previous comparable report is available yet.";

  return trends
    .map((trend) => {
      const sign = trend.change > 0 ? "+" : "";
      const percent = trend.changePercent === null ? "" : ` (${sign}${trend.changePercent.toFixed(1)}%)`;
      return `- ${trend.markerName}: ${trend.previousValue} -> ${trend.currentValue} ${trend.unit}, change ${sign}${trend.change.toFixed(2)}${percent}, direction ${trend.direction}, current status ${trend.status}`;
    })
    .join("\n");
}

function CustomerProfileCard({ profile }: { profile: Profile | null }) {
  const facts = [
    { label: "Name", value: prettyValue(profile?.full_name) },
    { label: "Age", value: prettyValue(profile?.age) },
    { label: "Gender", value: prettyValue(profile?.gender) },
    { label: "Height", value: prettyValue(profile?.height_cm, " cm") },
    { label: "Weight", value: prettyValue(profile?.current_weight_kg, " kg") },
    { label: "Goal", value: prettyValue(profile?.health_goal) },
  ];

  const nutritionTargets = [
    { label: "Calories", value: prettyValue(profile?.daily_calorie_target, " kcal") },
    { label: "Protein", value: prettyValue(profile?.protein_target_g, "g") },
    { label: "Carbs", value: prettyValue(profile?.carbs_target_g, "g") },
    { label: "Fat", value: prettyValue(profile?.fat_target_g, "g") },
  ];

  return (
    <div className="mb-3 rounded-[20px] border border-[#E5EAF1] bg-white p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Verified profile</p>
          <h4 className="text-[14px] font-black text-[#020617]">Customer details</h4>
        </div>
        <span className="rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[10px] font-black text-[#059669]">Nutrio data</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {facts.map((fact) => (
          <div key={fact.label} className="rounded-[15px] bg-[#F6F8FB] px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{fact.label}</p>
            <p className="mt-1 truncate text-[12px] font-black capitalize text-[#020617]">{fact.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-[16px] bg-[#F8FAFC] p-2">
        {nutritionTargets.map((target) => (
          <div key={target.label} className="min-w-0 text-center">
            <p className="truncate text-[9px] font-black uppercase text-[#94A3B8]">{target.label}</p>
            <p className="mt-0.5 truncate text-[11px] font-black text-[#020617]">{target.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthTrendsCard({ trends }: { trends: TrendInsight[] }) {
  if (trends.length === 0) {
    return (
      <div className="rounded-[22px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#22C7A1]">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Health trends</p>
            <h3 className="mt-1 text-[16px] font-black text-[#020617]">Upload another report to compare</h3>
            <p className="mt-1 text-[12px] font-bold leading-5 text-[#64748B]">
              Nutrio will compare matching markers across reports and show what is improving, stable, or needs attention.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const improvingCount = trends.filter((trend) => trend.status === "normal" && trend.direction !== "stable").length;
  const watchCount = trends.filter((trend) => trend.status !== "normal").length;

  return (
    <div className="rounded-[24px] border border-[#D7F8EC] bg-gradient-to-br from-white to-[#F0FDF9] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Health trends</p>
          <h3 className="mt-1 text-[17px] font-black text-[#020617]">Compared with previous report</h3>
          <p className="mt-1 text-[12px] font-bold text-[#64748B]">Matching markers only</p>
        </div>
        <div className="rounded-[16px] bg-white px-3 py-2 text-right shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
          <p className="text-[17px] font-black text-[#020617]">{trends.length}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">tracked</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-[16px] bg-white px-3 py-2">
          <p className="text-[10px] font-black uppercase text-[#94A3B8]">Normal movement</p>
          <p className="mt-1 text-[16px] font-black text-[#22C7A1]">{improvingCount}</p>
        </div>
        <div className="rounded-[16px] bg-white px-3 py-2">
          <p className="text-[10px] font-black uppercase text-[#94A3B8]">Watch list</p>
          <p className="mt-1 text-[16px] font-black text-[#FB6B7A]">{watchCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        {trends.slice(0, 4).map((trend) => {
          const color = trend.status === "normal" ? "#22C7A1" : "#FB6B7A";
          const sign = trend.change > 0 ? "+" : "";
          const percent = trend.changePercent === null ? null : `${sign}${trend.changePercent.toFixed(1)}%`;

          return (
            <div key={trend.markerName} className="rounded-[17px] border border-[#E5EAF1] bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-[#020617]">{trend.markerName}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-[#94A3B8]">
                    {trend.previousValue} to {trend.currentValue} {trend.unit}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[13px] font-black" style={{ color }}>
                    {percent ?? `${sign}${trend.change.toFixed(2)}`}
                  </p>
                  <p className="text-[9px] font-black uppercase text-[#94A3B8]">{trend.direction}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniChart({ data }: { data: { test_date: string; value: number }[] }) {
  if (data.length < 2) return null;

  const values = data.map((item) => item.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.1;
  const range = max - min || 1;
  const points = data
    .map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((item.value - min) / range) * 78 - 11;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="h-24 w-full">
      <polyline fill="none" stroke={NORMAL_MARKER_COLOR} strokeLinecap="round" strokeWidth="3" points={points} />
      {data.map((item, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((item.value - min) / range) * 78 - 11;
        return <circle key={`${item.test_date}-${item.value}`} cx={x} cy={y} r="3" fill={NORMAL_MARKER_COLOR} />;
      })}
    </svg>
  );
}

function MarkerRow({ marker, onTrend }: { marker: BloodMarker; onTrend: () => void }) {
  const { language } = useLanguage();
  const color = markerColor(marker.status);

  return (
    <button
      type="button"
      onClick={onTrend}
      className="w-full rounded-[18px] border border-[#E5EAF1] bg-white p-3 text-left shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-black text-[#020617]">
            {language === "ar" && marker.marker_name_ar ? marker.marker_name_ar : marker.marker_name}
          </p>
          <p className="mt-1 text-[11px] font-bold text-[#94A3B8]">{markerRange(marker)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] font-black tabular-nums text-[#020617]">
            {Number(marker.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <span className="ml-1 text-[10px] font-bold text-[#94A3B8]">{marker.unit}</span>
          </p>
          <span
            className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black uppercase"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {marker.status}
          </span>
        </div>
      </div>

      <div className="relative mt-3 h-2 rounded-full bg-[#EEF2F7]">
        <div className="absolute inset-y-0 left-[20%] right-[20%] rounded-full bg-[#DDF8EE]" />
        <span
          className="absolute top-1/2 h-4 w-1.5 -translate-y-1/2 rounded-full shadow-[0_2px_8px_rgba(15,23,42,0.2)]"
          style={{ left: `${markerPosition(marker)}%`, backgroundColor: color }}
        />
      </div>
    </button>
  );
}

export default function BloodWorkResults() {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();

  const [records, setRecords] = useState<BloodWorkRecord[]>([]);
  const [markersMap, setMarkersMap] = useState<Record<string, BloodMarker[]>>({});
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [readingReport, setReadingReport] = useState<string | null>(null);
  const [trendMarker, setTrendMarker] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<{ test_date: string; value: number }[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;

      const recs = await fetchBloodWorkRecords(user.id);
      if (cancelled) return;

      setRecords(recs);
      if (recs[0] && !expandedRecord) setExpandedRecord(recs[0].id);

      const nextMarkers: Record<string, BloodMarker[]> = {};
      for (const record of recs) {
        const markers = await fetchMarkersForRecord(record.id);
        if (cancelled) return;
        nextMarkers[record.id] = markers;
      }

      if (!cancelled) setMarkersMap(nextMarkers);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, expandedRecord]);

  async function handleAnalyze(record: BloodWorkRecord) {
    if (!user) return;

    setAnalyzing(record.id);
    try {
      const markers = markersMap[record.id] || [];
      const trends = buildTrendInsights(record, records, markersMap);
      const analysis = await analyzeBloodWork(markers, {
        fullName: profile?.full_name,
        age: profile?.age,
        gender: profile?.gender,
        currentWeightKg: profile?.current_weight_kg,
        targetWeightKg: profile?.target_weight_kg,
        heightCm: profile?.height_cm,
        healthGoal: profile?.health_goal,
        activityLevel: profile?.activity_level,
        dailyCalorieTarget: profile?.daily_calorie_target,
        proteinTargetG: profile?.protein_target_g,
        carbsTargetG: profile?.carbs_target_g,
        fatTargetG: profile?.fat_target_g,
        trendSummary: formatTrendSummaryForAi(trends),
      });

      await updateRecordAnalysis(record.id, analysis, "analyzed");
      setRecords((previous) =>
        previous.map((item) => (item.id === record.id ? { ...item, ai_analysis: analysis, status: "analyzed" } : item))
      );
      toast({ title: isRTL ? "تم إنشاء التحليل" : "Analysis ready" });
    } catch (error: unknown) {
      toast({
        title: isRTL ? "تعذر إنشاء التحليل" : "Analysis failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(null);
    }
  }

  async function handleReadSavedReport(record: BloodWorkRecord) {
    if (!record.report_url) return;

    setReadingReport(record.id);
    try {
      const response = await fetch(record.report_url);
      if (!response.ok) throw new Error("Could not download the saved report.");

      const blob = await response.blob();
      const file = new File([blob], "blood-report.pdf", { type: "application/pdf" });
      const definitions = await fetchMarkerDefinitions().catch(() => []);
      const extracted = await extractBloodMarkersFromPdf(file, definitions);

      if (extracted.length === 0) {
        toast({
          title: isRTL ? "لم يتم العثور على قيم" : "No values found",
          description: isRTL
            ? "لم نتمكن من قراءة مؤشرات واضحة من هذا التقرير."
            : "No clear blood marker values were found in this report.",
          variant: "destructive",
        });
        return;
      }

      const markersToInsert = extracted.map(({ definition, value }) => {
        const numericValue = Number(value);

        return {
          record_id: record.id,
          marker_name: definition.marker_name,
          marker_name_ar: definition.marker_name_ar,
          value: numericValue,
          unit: definition.unit,
          normal_min: definition.normal_min,
          normal_max: definition.normal_max,
          status: computeMarkerStatus(numericValue, definition.normal_min, definition.normal_max),
          category: definition.category,
          notes: null,
        };
      });

      const savedMarkers = await insertMarkers(markersToInsert);
      setMarkersMap((previous) => ({ ...previous, [record.id]: savedMarkers }));
      toast({
        title: isRTL ? "تم استخراج القيم" : "Values extracted",
        description: isRTL
          ? `تم العثور على ${savedMarkers.length} مؤشر من التقرير.`
          : `${savedMarkers.length} markers were found in the report.`,
      });
    } catch (error: unknown) {
      toast({
        title: isRTL ? "تعذرت قراءة التقرير" : "Could not read report",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setReadingReport(null);
    }
  }

  async function handleDelete(recordId: string) {
    try {
      await deleteBloodWorkRecord(recordId);
      setRecords((previous) => previous.filter((record) => record.id !== recordId));
      setMarkersMap((previous) => {
        const next = { ...previous };
        delete next[recordId];
        return next;
      });
      toast({ title: isRTL ? "تم الحذف" : "Deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function showTrend(markerName: string) {
    if (!user) return;

    const data = await fetchMarkerHistory(user.id, markerName);
    if (data.length < 2) {
      toast({
        title: isRTL ? "لا يوجد ترند بعد" : "No trend yet",
        description: isRTL
          ? "ارفع تقريرا ثانيا بتاريخ مختلف حتى يظهر اتجاه هذا المؤشر."
          : "Add a second report with a different date to see this marker's trend.",
      });
      return;
    }

    setTrendMarker(markerName);
    setTrendData(data);
  }

  const allMarkers = Object.values(markersMap).flat();
  const healthScore = calculateHealthScore(allMarkers);
  const abnormalTotal = allMarkers.filter((marker) => marker.status !== "normal").length;
  const latestRecord = records[0];

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-32 text-[#020617]" dir={isRTL ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-[#F6F8FB]/92 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[430px] items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Health</p>
            <h1 className="truncate text-[17px] font-black tracking-[-0.03em]">Blood work report</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/health/blood-work")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_12px_24px_rgba(2,6,23,0.18)] active:scale-95"
            aria-label="Add blood work"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] space-y-4 px-4 pb-28 pt-4">
        {allMarkers.length > 0 && (
          <section className="overflow-hidden rounded-[30px] border border-[#CFF8ED] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.07)]">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[28px] bg-[#10B981] text-[28px] font-black text-white shadow-[0_14px_26px_rgba(16,185,129,0.24)]">
                {healthScore}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Health Score</p>
                <h2 className="mt-1 text-[21px] font-black tracking-[-0.04em]">
                  {abnormalTotal === 0 ? "Excellent range" : "Needs attention"}
                </h2>
                <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">
                  {abnormalTotal === 0
                    ? "All extracted markers are inside their reference ranges."
                    : `${abnormalTotal} marker${abnormalTotal > 1 ? "s" : ""} outside normal range.`}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB]">
              {[
                { label: "Markers", value: allMarkers.length },
                { label: "Abnormal", value: abnormalTotal },
                { label: "Reports", value: records.length },
              ].map((item, index) => (
                <div key={item.label} className={cn("p-3", index > 0 && "border-l border-[#E5EAF1]")}>
                  <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">{item.label}</p>
                  <p className="mt-1 text-[18px] font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {records.length === 0 ? (
          <section className="rounded-[30px] bg-white p-8 text-center shadow-[0_18px_42px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <FileText className="mx-auto h-12 w-12 text-[#94A3B8]" />
            <h2 className="mt-4 text-[19px] font-black">No reports yet</h2>
            <p className="mt-2 text-sm font-semibold text-[#64748B]">Upload a blood work report to start tracking markers.</p>
            <Button className="mt-5 h-12 rounded-[18px] bg-[#020617] px-5 font-black" onClick={() => navigate("/health/blood-work")}>
              <Plus className="mr-2 h-4 w-4" />
              Add blood work
            </Button>
          </section>
        ) : (
          records.map((record) => {
            const markers = markersMap[record.id] || [];
            const grouped = groupByCategory(markers);
            const isExpanded = expandedRecord === record.id;
            const hasMarkers = markers.length > 0;
            const score = calculateHealthScore(markers);
            const abnormalCount = markers.filter((marker) => marker.status !== "normal").length;
            const trendInsights = buildTrendInsights(record, records, markersMap);
            const isBasicSummary =
              !!record.ai_analysis &&
              (record.ai_analysis.includes("Great news!") ||
                record.ai_analysis.includes("This is a general analysis.") ||
                record.ai_analysis.includes("Blood Work Analysis"));

            return (
              <section
                key={record.id}
                className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.07)]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] text-[16px] font-black text-white",
                      hasMarkers ? "bg-[#10B981]" : "bg-[#38BDF8]"
                    )}
                  >
                    {hasMarkers ? score : <FileText className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-black">{record.lab_name || "Blood Work"}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-[#94A3B8]">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(record.test_date), "MMM d, yyyy")}
                      {record.fasting && <span>Fasting</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasMarkers && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{
                          backgroundColor: abnormalCount === 0 ? "#EFFFFA" : "#FFF0F2",
                          color: abnormalCount === 0 ? NORMAL_MARKER_COLOR : WARNING_MARKER_COLOR,
                        }}
                      >
                        {abnormalCount === 0 ? "Normal" : `${abnormalCount} alert`}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-[#94A3B8]" /> : <ChevronDown className="h-4 w-4 text-[#94A3B8]" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-[#E5EAF1] px-4 pb-4 pt-3">
                    {!hasMarkers && (
                      <div className="rounded-[24px] border border-[#BDEBFF] bg-[#EFF9FF] p-4">
                        <div className="flex gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-white text-[#38BDF8]">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-black">Report saved</h3>
                            <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">
                              Read the saved PDF to extract marker values, or enter values manually.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {record.report_url && (
                                <Button
                                  size="sm"
                                  className="h-10 rounded-[14px] bg-[#020617] font-black"
                                  onClick={() => handleReadSavedReport(record)}
                                  disabled={readingReport === record.id}
                                >
                                  {readingReport === record.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <FileText className="mr-2 h-4 w-4" />
                                  )}
                                  Read report
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-10 rounded-[14px] font-black" onClick={() => navigate("/health/blood-work")}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add values
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasMarkers && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Markers", value: markers.length, icon: Activity },
                          { label: "Normal", value: markers.length - abnormalCount, icon: ShieldCheck },
                          { label: "Alerts", value: abnormalCount, icon: Sparkles },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <div key={item.label} className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                              <Icon className="h-4 w-4 text-[#22C7A1]" />
                              <p className="mt-2 text-[18px] font-black leading-none">{item.value}</p>
                              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">{item.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {hasMarkers && <HealthTrendsCard trends={trendInsights} />}

                    {Object.entries(grouped).map(([category, categoryMarkers]) => (
                      <div key={category} className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                          <h3 className="text-[13px] font-black text-[#020617]">
                            <span className="mr-1.5">{categoryIcon(category as MarkerCategory)}</span>
                            {language === "ar" ? categoryLabelAr(category as MarkerCategory) : categoryLabel(category as MarkerCategory)}
                          </h3>
                          <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[10px] font-black text-[#64748B]">
                            {categoryMarkers.length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {categoryMarkers.map((marker) => (
                            <MarkerRow key={marker.id} marker={marker} onTrend={() => showTrend(marker.marker_name)} />
                          ))}
                        </div>
                      </div>
                    ))}

                    {markers.length > 0 && (
                      <div className="rounded-[24px] border border-[#E5EAF1] bg-[#FBFCFE] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-[15px] bg-[#F3F4FF] text-[#7C83F6]">
                              <Brain className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">
                                {isRTL ? "تحليل Nutrio" : "Nutrio AI"}
                              </p>
                              <h3 className="text-[16px] font-black text-[#020617]">
                                {record.ai_analysis
                                  ? isBasicSummary
                                    ? isRTL
                                      ? "ملخص أولي"
                                      : "Basic summary"
                                    : isRTL
                                      ? "ملخص Nutrio الذكي"
                                      : "Nutrio health insight"
                                  : isRTL
                                    ? "إنشاء ملخص ذكي"
                                    : "Generate insight"}
                              </h3>
                            </div>
                          </div>
                        </div>

                        {record.ai_analysis ? (
                          <>
                            <CustomerProfileCard profile={profile} />
                            <div className="mb-3 rounded-[18px] border border-[#BAE6FD] bg-[#F0F9FF] px-3 py-2.5">
                              <p className="text-[11px] font-bold leading-5 text-[#0369A1]">
                                {isRTL
                                  ? "هذا ملخص إرشادي مولد بالذكاء الاصطناعي من Nutrio، وليس تقريرًا طبيًا أو تشخيصًا. النتائج تقريبية وتعتمد على القيم المتاحة فقط، ويجب مراجعة الطبيب عند وجود أي قلق صحي."
                                  : "This is an AI-generated Nutrio guidance summary, not a medical report or diagnosis. It is approximate and based only on the available values. Please consult a healthcare professional for medical concerns."}
                              </p>
                            </div>
                            <div
                              className="max-h-[360px] overflow-y-auto rounded-[18px] bg-white p-3 text-[12px] font-semibold leading-5 text-[#475569] ring-1 ring-[#E5EAF1]"
                              dangerouslySetInnerHTML={{ __html: formatAnalysisHtml(record.ai_analysis) }}
                            />
                            <Button
                              variant="outline"
                              className="mt-3 h-11 w-full rounded-[16px] font-black"
                              onClick={() => handleAnalyze(record)}
                              disabled={!!analyzing}
                            >
                              {analyzing === record.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Brain className="mr-2 h-4 w-4" />
                              )}
                              {isBasicSummary
                                ? isRTL
                                  ? "إنشاء ملخص Nutrio الذكي"
                                  : "Generate Nutrio insight"
                                : isRTL
                                  ? "تحديث الملخص"
                                  : "Refresh insight"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            className="h-12 w-full rounded-[18px] bg-[#020617] font-black text-white"
                            onClick={() => handleAnalyze(record)}
                            disabled={!!analyzing}
                          >
                            {analyzing === record.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Brain className="mr-2 h-4 w-4" />
                            )}
                            {isRTL ? "إنشاء ملخص Nutrio الذكي" : "Generate Nutrio insight"}
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {record.report_url && (
                        <a href={record.report_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" className="h-10 rounded-[14px] font-black">
                            <FileText className="mr-1.5 h-4 w-4" />
                            Report
                          </Button>
                        </a>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 rounded-[14px] text-[#FB6B7A] hover:text-[#FB6B7A]"
                        onClick={() => handleDelete(record.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            );
          })
        )}

        {latestRecord && records.length > 1 && (
          <p className="px-2 text-center text-[11px] font-bold text-[#94A3B8]">
            Latest report: {format(new Date(latestRecord.test_date), "MMM d, yyyy")}
          </p>
        )}
      </main>

      {trendMarker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-3 pb-safe" onClick={() => setTrendMarker(null)}>
          <Card className="max-h-[58vh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border-0 shadow-[0_-18px_44px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()}>
            <CardContent className="p-4 pb-6">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#CBD5E1]" />
              <h3 className="text-[18px] font-black">Trend: {trendMarker}</h3>
              <MiniChart data={trendData} />
              <div className="mt-3 space-y-2">
                {trendData.map((item) => (
                  <div key={`${item.test_date}-${item.value}`} className="flex justify-between rounded-[14px] bg-[#F6F8FB] px-3 py-2 text-sm">
                    <span className="font-bold text-[#64748B]">{format(new Date(item.test_date), "MMM d, yyyy")}</span>
                    <span className="font-black text-[#020617]">{item.value}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-4 h-11 w-full rounded-[16px] font-black" onClick={() => setTrendMarker(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
