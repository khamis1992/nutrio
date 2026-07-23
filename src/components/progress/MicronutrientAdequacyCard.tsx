import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Apple,
  Bone,
  Check,
  ChevronDown,
  Droplets,
  Dumbbell,
  HeartPulse,
  Loader2,
  Sun,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  type MicronutrientAdequacyRange,
  type MicronutrientAdequacyRow,
  useMicronutrientAdequacy,
} from "@/hooks/useMicronutrientAdequacy";
import { isPhaseOneFeatureEnabled } from "@/lib/phase-one-feature-flags";
import { cn } from "@/lib/utils";

interface MicronutrientAdequacyCardProps {
  endDate: Date;
  initialRange: MicronutrientAdequacyRange;
  isRTL: boolean;
  userId?: string;
}

const nutrientTheme: Record<
  string,
  { color: string; surface: string; Icon: LucideIcon }
> = {
  fiber_g: { color: "#22C7A1", surface: "#EFFFFA", Icon: Wheat },
  sodium_mg: { color: "#38BDF8", surface: "#EFFAFF", Icon: Droplets },
  sugar_g: { color: "#FB6B7A", surface: "#FFF1F3", Icon: AlertCircle },
  potassium_mg: { color: "#7C83F6", surface: "#F1F1FF", Icon: Apple },
  calcium_mg: { color: "#0284C7", surface: "#EFFAFF", Icon: Bone },
  iron_mg: { color: "#DC2626", surface: "#FFF1F3", Icon: Dumbbell },
  vitamin_d_mcg: { color: "#F59E0B", surface: "#FFF8ED", Icon: Sun },
  vitamin_b12_mcg: { color: "#DB2777", surface: "#FFF1F7", Icon: HeartPulse },
  magnesium_mg: { color: "#059669", surface: "#EFFFFA", Icon: Zap },
};

const PREVIEW_COUNT = 4;

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function statusCopy(row: MicronutrientAdequacyRow, isRTL: boolean) {
  if (row.status === "missing") {
    return isRTL ? "بيانات مقاسة غير كافية" : "Not enough measured data";
  }
  if (row.status === "on_track") return isRTL ? "ضمن النطاق المرجعي" : "Within reference";
  if (row.status === "over_limit") return isRTL ? "أعلى من الحد المرجعي" : "Above reference";
  return isRTL ? "أقل من الهدف المرجعي" : "Below reference";
}

function statusColor(row: MicronutrientAdequacyRow) {
  if (row.status === "on_track") return "#22C7A1";
  if (row.status === "missing") return "#94A3B8";
  if (row.status === "over_limit") return "#FB6B7A";
  return "#F97316";
}

export function MicronutrientAdequacyCard({
  endDate,
  initialRange,
  isRTL,
  userId,
}: MicronutrientAdequacyCardProps) {
  const featureEnabled = isPhaseOneFeatureEnabled("micronutrients");
  const [range, setRange] = useState<MicronutrientAdequacyRange>(initialRange);
  const [expanded, setExpanded] = useState(false);
  const { data = [], isLoading, isError, refetch } = useMicronutrientAdequacy(
    featureEnabled ? userId : undefined,
    endDate,
    range,
  );

  useEffect(() => setRange(initialRange), [initialRange]);

  const summary = useMemo(() => {
    if (!data.length) return { onTrack: 0, gaps: 0, missing: 0 };
    return data.reduce(
      (acc, row) => {
        if (row.status === "on_track") acc.onTrack += 1;
        else if (row.status === "missing") acc.missing += 1;
        else acc.gaps += 1;
        return acc;
      },
      { onTrack: 0, gaps: 0, missing: 0 },
    );
  }, [data]);

  const visibleRows = useMemo(() => {
    if (expanded || data.length <= PREVIEW_COUNT) return data;
    // Prefer showing gaps first in the collapsed preview
    const prioritized = [...data].sort((a, b) => {
      const rank = (s: string) =>
        s === "low" || s === "over_limit" ? 0 : s === "missing" ? 1 : 2;
      return rank(a.status) - rank(b.status);
    });
    return prioritized.slice(0, PREVIEW_COUNT);
  }, [data, expanded]);

  if (!featureEnabled) return null;

  const copy = isRTL
    ? {
        title: "فجوات المغذيات",
        subtitle: "المغذيات المقاسة من الوجبات المسجلة فقط",
        day: "اليوم",
        week: "7 أيام",
        retry: "إعادة المحاولة",
        empty: "سجّل وجبة تحتوي بيانات غذائية مقاسة لعرض التحليل.",
        measured: "مدخل مقاس",
        missing: "مدخل بلا قياس",
        note: "هذه مراجع غذائية عامة وليست تشخيصًا طبيًا.",
        showMore: `عرض الكل (${data.length})`,
        showLess: "إخفاء",
        ok: "سليم",
        gap: "فجوة",
        na: "—",
      }
    : {
        title: "Nutrient gaps",
        subtitle: "Measured nutrients from logged meals only",
        day: "Today",
        week: "7 days",
        retry: "Retry",
        empty: "Log a meal with measured nutrition data to see this analysis.",
        measured: "measured",
        missing: "missing",
        note: "General nutrition references, not a medical diagnosis.",
        showMore: `Show all (${data.length})`,
        showLess: "Show less",
        ok: "OK",
        gap: "Gap",
        na: "—",
      };

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      className="mt-4 mb-4 rounded-2xl bg-white p-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
    >
      {/* Compact header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 text-start">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">
            {isRTL ? "جودة التغذية" : "Nutrition quality"}
          </p>
          <h2 className="truncate text-[14px] font-black tracking-tight text-slate-900">{copy.title}</h2>
        </div>
        <div className="grid shrink-0 grid-cols-2 rounded-full bg-slate-100 p-0.5">
          {(["day", "week"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={cn(
                "min-h-7 rounded-full px-2.5 text-[10px] font-black transition-all active:scale-95",
                range === option ? "bg-slate-900 text-white" : "text-slate-500",
              )}
            >
              {option === "day" ? copy.day : copy.week}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && !isError && data.length > 0 ? (
        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <span className="tabular-nums text-emerald-600" dir="ltr">{summary.onTrack}</span>
          <span>{copy.ok}</span>
          <span className="text-slate-300">·</span>
          <span className="tabular-nums text-orange-600" dir="ltr">{summary.gaps}</span>
          <span>{copy.gap}</span>
          <span className="text-slate-300">·</span>
          <span className="tabular-nums text-slate-400" dir="ltr">{summary.missing}</span>
          <span>{copy.na}</span>
        </div>
      ) : null}

      <div className="mt-2.5">
        {isLoading ? (
          <div className="grid min-h-12 place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-[#22C7A1]" />
          </div>
        ) : isError ? (
          <div className="rounded-xl bg-rose-50 px-3 py-2.5 text-center">
            <p className="text-[11px] font-bold text-slate-800">
              {isRTL ? "تعذر تحميل بيانات المغذيات" : "Could not load nutrient data"}
            </p>
            <button
              type="button"
              className="mt-1.5 min-h-8 rounded-full bg-slate-900 px-3 text-[10px] font-black text-white active:scale-95"
              onClick={() => void refetch()}
            >
              {copy.retry}
            </button>
          </div>
        ) : data.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] font-semibold leading-snug text-slate-500">
            {copy.empty}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100/80">
              {visibleRows.map((row) => {
                const theme = nutrientTheme[row.nutrient_code] ?? nutrientTheme.magnesium_mg;
                const Icon = theme.Icon;
                const consumed = formatNumber(row.consumed);
                const visualProgress =
                  row.percentage === null ? 0 : Math.min(100, Math.max(0, row.percentage));
                const healthy = row.status === "on_track";
                const tone = statusColor(row);

                return (
                  <li key={row.nutrient_code} className="flex items-center gap-2 px-2.5 py-2">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                      style={{ backgroundColor: theme.surface, color: theme.color }}
                      aria-hidden="true"
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </span>

                    <div className="min-w-0 flex-1 text-start">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-black text-slate-900">
                          {isRTL ? row.label_ar : row.label_en}
                        </p>
                        <p className="shrink-0 text-[11px] font-black tabular-nums text-slate-800" dir="ltr">
                          {consumed === null ? (
                            <span className="text-slate-400">--</span>
                          ) : (
                            <>
                              {consumed}
                              <span className="text-[9px] font-bold text-slate-400">{row.unit}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{
                              width: `${row.status === "missing" ? 0 : visualProgress}%`,
                              backgroundColor: tone,
                            }}
                          />
                        </div>
                        <span
                          className="inline-flex max-w-[42%] shrink-0 items-center gap-0.5 truncate text-[9px] font-bold"
                          style={{ color: tone }}
                          title={statusCopy(row, isRTL)}
                        >
                          {healthy ? <Check className="h-2.5 w-2.5 shrink-0" strokeWidth={3} /> : null}
                          <span className="truncate">{statusCopy(row, isRTL)}</span>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Keep full status strings in DOM for a11y/tests when collapsed */}
            {!expanded && data.length > PREVIEW_COUNT ? (
              <div className="sr-only">
                {data.map((row) => (
                  <span key={`a11y-${row.nutrient_code}`}>
                    {isRTL ? row.label_ar : row.label_en}: {statusCopy(row, isRTL)}
                  </span>
                ))}
              </div>
            ) : null}

            {data.length > PREVIEW_COUNT ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 flex min-h-9 w-full items-center justify-center gap-1 rounded-full bg-slate-100 text-[11px] font-black text-slate-600 active:scale-[0.98]"
              >
                {expanded ? copy.showLess : copy.showMore}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                  strokeWidth={2.5}
                />
              </button>
            ) : null}
          </>
        )}
      </div>

      <p className="mt-2 text-center text-[8px] font-semibold leading-tight text-slate-400">{copy.note}</p>
      <p className="sr-only">{copy.subtitle}</p>
      <p className="sr-only">
        {copy.measured} / {copy.missing}
      </p>
    </section>
  );
}
