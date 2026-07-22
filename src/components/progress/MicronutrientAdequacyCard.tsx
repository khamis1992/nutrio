import { useEffect, useState } from "react";
import {
  AlertCircle,
  Apple,
  Bone,
  Check,
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

export function MicronutrientAdequacyCard({
  endDate,
  initialRange,
  isRTL,
  userId,
}: MicronutrientAdequacyCardProps) {
  const featureEnabled = isPhaseOneFeatureEnabled("micronutrients");
  const [range, setRange] = useState<MicronutrientAdequacyRange>(initialRange);
  const { data = [], isLoading, isError, refetch } = useMicronutrientAdequacy(
    featureEnabled ? userId : undefined,
    endDate,
    range,
  );

  useEffect(() => setRange(initialRange), [initialRange]);

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
      };

  return (
    <section
      dir={isRTL ? "rtl" : "ltr"}
      className="mt-4 mb-5 rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">
            {isRTL ? "جودة التغذية" : "Nutrition quality"}
          </p>
          <h2 className="mt-0.5 text-[15px] font-black tracking-tight text-[#020617]">{copy.title}</h2>
          <p className="mt-0.5 truncate text-[10px] font-semibold text-[#94A3B8]">{copy.subtitle}</p>
        </div>
        <div className="grid shrink-0 grid-cols-2 rounded-full bg-slate-50 p-0.5 ring-1 ring-slate-100">
          {(["day", "week"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={cn(
                "min-h-8 rounded-full px-3 text-[10px] font-black transition-all active:scale-95",
                range === option
                  ? "bg-[#020617] text-white shadow-sm"
                  : "text-[#64748B]",
              )}
            >
              {option === "day" ? copy.day : copy.week}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-16 place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#22C7A1]" />
        </div>
      ) : isError ? (
        <div className="mt-3 rounded-xl bg-[#FFF1F3] p-3 text-center">
          <p className="text-[12px] font-bold text-[#020617]">
            {isRTL ? "تعذر تحميل بيانات المغذيات" : "Could not load nutrient data"}
          </p>
          <button
            type="button"
            className="mt-2 min-h-9 rounded-full bg-[#020617] px-4 text-[11px] font-black text-white active:scale-95"
            onClick={() => void refetch()}
          >
            {copy.retry}
          </button>
        </div>
      ) : data.length === 0 ? (
        <p className="mt-3 rounded-xl bg-[#F6F8FB] p-3 text-[12px] font-semibold text-[#64748B]">
          {copy.empty}
        </p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {data.map((row) => {
            const theme = nutrientTheme[row.nutrient_code] ?? nutrientTheme.magnesium_mg;
            const Icon = theme.Icon;
            const consumed = formatNumber(row.consumed);
            const visualProgress = row.percentage === null
              ? 0
              : Math.min(100, Math.max(0, row.percentage));
            const healthy = row.status === "on_track";

            return (
              <article key={row.nutrient_code} className="rounded-xl bg-[#F6F8FB] px-2.5 py-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: theme.surface, color: theme.color }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-black text-[#020617]">
                          {isRTL ? row.label_ar : row.label_en}
                        </p>
                        <p className="text-[9px] font-bold text-[#94A3B8]">
                          {row.measured_entries} {copy.measured}
                          {row.missing_entries > 0
                            ? ` · ${row.missing_entries} ${copy.missing}`
                            : ""}
                        </p>
                      </div>
                      {consumed === null ? (
                        <span className="text-[11px] font-black text-[#94A3B8]">--</span>
                      ) : (
                        <p className="whitespace-nowrap text-[12px] font-black text-[#020617]">
                          {consumed}
                          <span className="ml-0.5 text-[9px] text-[#64748B]">{row.unit}</span>
                          <span className="text-[9px] text-[#94A3B8]"> / {row.target}</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{ width: `${visualProgress}%`, backgroundColor: theme.color }}
                      />
                    </div>
                    <p
                      className="mt-1 flex items-center gap-1 text-[9px] font-bold"
                      style={{ color: healthy ? "#22C7A1" : row.status === "missing" ? "#94A3B8" : "#FB6B7A" }}
                    >
                      {healthy && <Check className="h-3 w-3" strokeWidth={3} />}
                      {statusCopy(row, isRTL)}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-2.5 text-center text-[9px] font-semibold text-[#94A3B8]">{copy.note}</p>
    </section>
  );
}
