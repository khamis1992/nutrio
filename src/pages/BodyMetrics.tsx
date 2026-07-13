import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Activity,
  ArrowLeft,
  Dumbbell,
  Loader2,
  Ruler,
  Scale,
  StickyNote,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBodyMetrics, useDeleteBodyMetrics, useLogBodyMetrics } from "@/hooks/useBodyMetrics";

const SYSTEM_COLORS = {
  ink: "#020617",
  bg: "#F6F8FB",
  line: "#E5EAF1",
  muted: "#94A3B8",
  progress: "#22C7A1",
  protein: "#7C83F6",
  fat: "#FB6B7A",
  water: "#38BDF8",
  orange: "#F97316",
};

const BodyMetrics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: metricsHistory, isLoading: historyLoading } = useBodyMetrics(user?.id);
  const { mutate: logMetrics, isPending } = useLogBodyMetrics();
  const { mutate: deleteMetrics } = useDeleteBodyMetrics();
  const [showOptionalMetrics, setShowOptionalMetrics] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [hiddenMetricIds, setHiddenMetricIds] = useState<string[]>([]);
  const deleteTimersRef = useRef(new Map<string, number>());

  const [formData, setFormData] = useState({
    weight_kg: "",
    waist_cm: "",
    body_fat_percent: "",
    muscle_mass_percent: "",
    notes: "",
  });

  const activeMetricsHistory = (metricsHistory ?? []).filter((metric) => !hiddenMetricIds.includes(metric.id));
  const latestMetric = activeMetricsHistory[0];
  const previousMetric = activeMetricsHistory[1];
  const weightDelta = useMemo(() => {
    if (!latestMetric?.weight_kg || !previousMetric?.weight_kg) return null;
    return Number((latestMetric.weight_kg - previousMetric.weight_kg).toFixed(1));
  }, [latestMetric, previousMetric]);
  const weightTrend = useMemo(() => {
    const points = (metricsHistory ?? [])
      .filter((metric) => Number.isFinite(metric.weight_kg))
      .slice(0, 10)
      .reverse();
    if (points.length < 2) return null;
    const values = points.map((metric) => metric.weight_kg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const polyline = points.map((metric, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 36 - ((metric.weight_kg - min) / range) * 28;
      return `${x},${y}`;
    }).join(" ");
    return { points, polyline, min, max };
  }, [metricsHistory]);
  const visibleMetricsHistory = activeMetricsHistory;
  const displayedMetricsHistory = showAllHistory ? visibleMetricsHistory : visibleMetricsHistory.slice(0, 3);

  const scheduleMetricDelete = (metricId: string) => {
    setPendingDeleteId(null);
    setHiddenMetricIds((ids) => [...ids, metricId]);
    const timer = window.setTimeout(() => {
      deleteMetrics(metricId);
      deleteTimersRef.current.delete(metricId);
      setHiddenMetricIds((ids) => ids.filter((id) => id !== metricId));
    }, 5000);
    deleteTimersRef.current.set(metricId, timer);
    toast(t("body_metrics_delete_scheduled"), {
      action: {
        label: t("undo"),
        onClick: () => {
          const pendingTimer = deleteTimersRef.current.get(metricId);
          if (pendingTimer) window.clearTimeout(pendingTimer);
          deleteTimersRef.current.delete(metricId);
          setHiddenMetricIds((ids) => ids.filter((id) => id !== metricId));
        },
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const weight = parseFloat(formData.weight_kg);
    if (!formData.weight_kg || Number.isNaN(weight) || weight <= 0 || weight > 500) {
      toast.error(t("body_metrics_invalid_weight"));
      return;
    }

    logMetrics(
      {
        userId: user.id,
        data: {
          weight_kg: weight,
          waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : undefined,
          body_fat_percent: formData.body_fat_percent ? parseFloat(formData.body_fat_percent) : undefined,
          muscle_mass_percent: formData.muscle_mass_percent ? parseFloat(formData.muscle_mass_percent) : undefined,
          notes: formData.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          setFormData({
            weight_kg: "",
            waist_cm: "",
            body_fat_percent: "",
            muscle_mass_percent: "",
            notes: "",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24 pt-safe text-[#020617]">
      <div className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-[#F6F8FB]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            data-testid="body-metrics-back-btn"
            onClick={() => navigate(-1)}
            className="h-11 w-11 shrink-0 rounded-full bg-white text-[#020617] shadow-sm active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-[#020617]">{t("body_metrics")}</h1>
            <p className="truncate text-xs font-semibold text-[#64748B]">{t("body_metrics_title")}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#F3F4FF] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">
                <Scale className="h-3.5 w-3.5" />
                {t("body_metrics_check_in")}
              </div>
              <h2 className="text-[26px] font-black leading-tight tracking-[-0.05em] text-[#020617]">
                {latestMetric?.weight_kg ? `${latestMetric.weight_kg} kg` : t("body_metrics_no_weight")}
              </h2>
              <p className="mt-2 max-w-[17rem] text-[13px] font-semibold leading-5 text-[#64748B]">
                {t("body_metrics_plan_hint")}
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-[#020617] text-white">
              <Scale className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-[20px] bg-[#EFFFFA] px-3 py-3 ring-1 ring-[#22C7A1]/15">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#22C7A1]">{t("body_metrics_entries")}</p>
              <p className="mt-1 text-[20px] font-black text-[#020617]">{activeMetricsHistory.length}</p>
            </div>
            <div className="rounded-[20px] bg-[#FFF7ED] px-3 py-3 ring-1 ring-[#F97316]/15">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#F97316]">{t("body_metrics_change")}</p>
              <p className="mt-1 flex items-center gap-1 text-[20px] font-black text-[#020617]">
                {weightDelta == null ? "--" : `${weightDelta > 0 ? "+" : ""}${weightDelta}`}
              </p>
            </div>
            <div className="rounded-[20px] bg-[#F6F8FB] px-3 py-3 ring-1 ring-[#E5EAF1]">
              <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">{t("body_metrics_last")}</p>
              <p className="mt-1 text-[13px] font-black leading-tight text-[#020617]">
                {latestMetric ? format(new Date(latestMetric.recorded_at), "MMM d") : "--"}
              </p>
            </div>
          </div>
        </section>

        {weightTrend && (
          <section className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.05)]">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">{t("body_metrics_trend_title")}</p>
                <h3 className="mt-1 text-[17px] font-black text-[#020617]">{weightTrend.points[0].weight_kg} - {weightTrend.points[weightTrend.points.length - 1].weight_kg} kg</h3>
              </div>
              <span className="rounded-full bg-[#EFFFFA] px-3 py-1.5 text-[10px] font-black text-[#22C7A1]">{weightTrend.points.length} {t("body_metrics_entries").toLowerCase()}</span>
            </div>
            <svg className="h-24 w-full overflow-visible" viewBox="0 0 100 44" preserveAspectRatio="none" aria-label={t("body_metrics_trend_title")}>
              <defs>
                <linearGradient id="bodyWeightTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C7A1" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#22C7A1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline fill="none" stroke="#E5EAF1" strokeWidth="0.7" points="0,36 100,36" />
              <polygon fill="url(#bodyWeightTrendFill)" points={`0,40 ${weightTrend.polyline} 100,40`} />
              <polyline fill="none" stroke="#22C7A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={weightTrend.polyline} />
            </svg>
            <div className="mt-1 flex justify-between text-[10px] font-bold text-[#94A3B8]">
              <span>{format(new Date(weightTrend.points[0].recorded_at), "MMM d")}</span>
              <span>{format(new Date(weightTrend.points[weightTrend.points.length - 1].recorded_at), "MMM d")}</span>
            </div>
          </section>
        )}

        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] bg-[#EFFFFA] text-[#22C7A1]">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[18px] font-black tracking-[-0.04em] text-[#020617]">{t("body_metrics_log_new")}</h3>
              <p className="truncate text-[12px] font-semibold text-[#64748B]">{t("body_metrics_log_desc")}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
              <Label htmlFor="weight" className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#020617]">
                <Scale className="h-4 w-4 text-[#22C7A1]" />
                {t("body_metrics_weight_required")}
              </Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.1"
                max="500"
                placeholder={t("body_metrics_current_weight_placeholder")}
                value={formData.weight_kg}
                onChange={(e) => setFormData((prev) => ({ ...prev, weight_kg: e.target.value }))}
                className="h-14 rounded-[18px] border-[#E5EAF1] bg-white text-[20px] font-black text-[#020617] shadow-none placeholder:text-[#94A3B8]"
                required
              />
            </div>

            <button
              type="button"
              onClick={() => setShowOptionalMetrics((shown) => !shown)}
              className="flex h-11 w-full items-center justify-between rounded-[16px] bg-[#F6F8FB] px-4 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] active:scale-[0.99]"
              aria-expanded={showOptionalMetrics}
            >
              <span>{showOptionalMetrics ? t("body_metrics_hide_optional") : t("body_metrics_add_more")}</span>
              <span className="text-lg leading-none text-[#22C7A1]">{showOptionalMetrics ? "-" : "+"}</span>
            </button>

            {showOptionalMetrics && <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
              <MetricInput
                color={SYSTEM_COLORS.orange}
                icon={Ruler}
                id="waist"
                label={t("body_metrics_waist")}
                placeholder="cm"
                value={formData.waist_cm}
                onChange={(value) => setFormData((prev) => ({ ...prev, waist_cm: value }))}
              />
              <MetricInput
                color={SYSTEM_COLORS.fat}
                icon={Activity}
                id="bodyFat"
                label={t("body_metrics_fat")}
                placeholder="%"
                value={formData.body_fat_percent}
                onChange={(value) => setFormData((prev) => ({ ...prev, body_fat_percent: value }))}
              />
              <MetricInput
                color={SYSTEM_COLORS.protein}
                icon={Dumbbell}
                id="muscleMass"
                label={t("body_metrics_muscle")}
                placeholder="%"
                value={formData.muscle_mass_percent}
                onChange={(value) => setFormData((prev) => ({ ...prev, muscle_mass_percent: value }))}
              />
            </div>}

            <div className="rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
              <Label htmlFor="notes" className="mb-2 flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.08em] text-[#020617]">
                <StickyNote className="h-4 w-4 text-[#38BDF8]" />
                {t("notes")}
              </Label>
              <Textarea
                id="notes"
                placeholder={t("body_metrics_notes_placeholder")}
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="rounded-[18px] border-[#E5EAF1] bg-white text-sm font-semibold text-[#020617] shadow-none placeholder:text-[#94A3B8]"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="h-[52px] w-full rounded-[18px] bg-[#020617] text-[15px] font-black text-white shadow-none active:scale-[0.98]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin rtl:ml-2 rtl:mr-0" />
                  {t("saving")}
                </>
              ) : (
                t("body_metrics_log_button")
              )}
            </Button>
          </form>
        </section>

        {historyLoading ? (
          <div className="flex items-center justify-center rounded-[28px] border border-[#E5EAF1] bg-white py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#020617]" />
          </div>
        ) : metricsHistory && metricsHistory.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div className="min-w-0">
                <h3 className="text-[17px] font-black tracking-[-0.04em] text-[#020617]">{t("body_metrics_history")}</h3>
                <p className="truncate text-[12px] font-semibold text-[#64748B]">{t("body_metrics_history_desc")}</p>
              </div>
              {visibleMetricsHistory.length > 3 && (
                <button type="button" onClick={() => setShowAllHistory((shown) => !shown)} className="min-h-11 shrink-0 rounded-full bg-[#F6F8FB] px-3 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                  {showAllHistory ? t("body_metrics_show_less") : t("body_metrics_view_all")}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {displayedMetricsHistory.map((metric, index) => {
                const prev = visibleMetricsHistory[index + 1];
                const delta = prev?.weight_kg ? Number((metric.weight_kg - prev.weight_kg).toFixed(1)) : null;
                const TrendIcon = delta != null && delta <= 0 ? TrendingDown : TrendingUp;
                const trendColor = delta == null ? SYSTEM_COLORS.muted : delta <= 0 ? SYSTEM_COLORS.progress : SYSTEM_COLORS.orange;

                return (
                  <article
                    key={metric.id}
                    className="rounded-[26px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[28px] font-black leading-none tracking-[-0.06em] text-[#020617]">
                          {metric.weight_kg}
                          <span className="ml-1 text-[12px] font-bold tracking-normal text-[#64748B]">kg</span>
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-[#94A3B8]">
                          {format(new Date(metric.recorded_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full bg-[#FFF0F2] text-[#FB6B7A] active:scale-95"
                        onClick={() => setPendingDeleteId(metric.id)}
                        aria-label="Delete measurement"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mb-3 flex items-center gap-2 rounded-[18px] bg-[#F6F8FB] px-3 py-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-white" style={{ color: trendColor }}>
                        <TrendIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">{t("body_metrics_change")}</p>
                        <p className="text-[13px] font-black text-[#020617]">
                          {delta == null ? "--" : `${delta > 0 ? "+" : ""}${delta} kg`}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <HistoryMetric color={SYSTEM_COLORS.orange} label={t("body_metrics_waist")} value={metric.waist_cm ? `${metric.waist_cm}` : "--"} />
                      <HistoryMetric color={SYSTEM_COLORS.fat} label={t("body_metrics_fat")} value={metric.body_fat_percent ? `${metric.body_fat_percent}%` : "--"} />
                      <HistoryMetric color={SYSTEM_COLORS.protein} label={t("body_metrics_muscle")} value={metric.muscle_mass_percent ? `${metric.muscle_mass_percent}%` : "--"} />
                    </div>
                    {metric.notes && (
                      <p className="mt-3 line-clamp-2 rounded-[16px] bg-[#F6F8FB] px-3 py-2 text-[12px] font-semibold leading-5 text-[#64748B]">
                        {metric.notes}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[28px] border border-[#E5EAF1] bg-white py-12 text-center shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-[24px] bg-[#EFFFFA] text-[#22C7A1]">
              <Target className="h-8 w-8" />
            </div>
            <p className="text-sm font-black text-[#020617]">{t("body_metrics_empty")}</p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">{t("body_metrics_empty_desc")}</p>
          </div>
        )}
      </main>

      {pendingDeleteId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#020617]/45 p-3 backdrop-blur-sm">
          <section className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-[0_24px_80px_rgba(2,6,23,0.24)]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E5EAF1]" />
            <h3 className="text-[19px] font-black text-[#020617]">{t("body_metrics_confirm_delete")}</h3>
            <p className="mt-2 text-[13px] font-semibold leading-5 text-[#64748B]">{t("body_metrics_confirm_delete_desc")}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-12 rounded-[16px]" onClick={() => setPendingDeleteId(null)}>{t("cancel")}</Button>
              <Button
                type="button"
                className="h-12 rounded-[16px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
                onClick={() => {
                  scheduleMetricDelete(pendingDeleteId);
                }}
              >
                {t("delete")}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

type MetricInputProps = {
  color: string;
  icon: typeof Ruler;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
};

function MetricInput({ color, icon: Icon, id, label, onChange, placeholder, value }: MetricInputProps) {
  return (
    <div className="rounded-[20px] bg-[#F6F8FB] p-2 ring-1 ring-[#E5EAF1]">
      <Label htmlFor={id} className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.08em]" style={{ color }}>
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate">{label}</span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="0.1"
        min="0"
        max="300"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-[16px] border-[#E5EAF1] bg-white px-2 text-sm font-black text-[#020617] shadow-none placeholder:text-[#94A3B8]"
      />
    </div>
  );
}

function HistoryMetric({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="rounded-[16px] bg-[#F6F8FB] px-2 py-2">
      <p className="truncate text-[9px] font-black uppercase tracking-[0.08em]" style={{ color }}>{label}</p>
      <p className="mt-1 text-[13px] font-black text-[#020617]">{value}</p>
    </div>
  );
}

export default BodyMetrics;
