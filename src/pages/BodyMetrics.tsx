import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  TrendingUp,
  Trash2,
  Loader2,
  Ruler,
  Activity,
  Dumbbell,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBodyMetrics, useLogBodyMetrics, useDeleteBodyMetrics } from "@/hooks/useBodyMetrics";
import { toast } from "sonner";

const BodyMetrics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { data: metricsHistory, isLoading: historyLoading } = useBodyMetrics(user?.id);
  const { mutate: logMetrics, isPending } = useLogBodyMetrics();
  const { mutate: deleteMetrics } = useDeleteBodyMetrics();

  const [formData, setFormData] = useState({
    weight_kg: "",
    waist_cm: "",
    body_fat_percent: "",
    muscle_mass_percent: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const weight = parseFloat(formData.weight_kg);
    if (!formData.weight_kg || isNaN(weight) || weight <= 0 || weight > 500) {
      toast.error("Please enter a valid weight (0.1 - 500 kg)");
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
    <div className="min-h-screen bg-[#f6fbf7] pb-24 pt-safe">
      <div className="sticky top-0 z-20 border-b border-emerald-900/5 bg-[#f6fbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-11 w-11 shrink-0 rounded-full bg-white text-emerald-950 shadow-sm active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-emerald-950">Body Metrics</h1>
            <p className="truncate text-xs font-medium text-emerald-900/55">{t("body_metrics_title")}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[28px] bg-[#103f32] p-5 text-white shadow-[0_18px_45px_rgba(16,63,50,0.20)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-100">
                <TrendingUp className="h-3.5 w-3.5" />
                Progress
              </div>
              <h2 className="text-2xl font-black leading-tight tracking-tight">Body check-in</h2>
              <p className="mt-2 max-w-[15rem] text-sm font-medium leading-relaxed text-white/75">
                Log today&apos;s weight and measurements to keep your plan personal.
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#24b893] text-white shadow-lg shadow-black/10">
              <Ruler className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-100">Latest</p>
              <p className="mt-1 text-xl font-black">
                {metricsHistory?.[0]?.weight_kg ? `${metricsHistory[0].weight_kg} kg` : "--"}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-100">Entries</p>
              <p className="mt-1 text-xl font-black">{metricsHistory?.length ?? 0}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-emerald-200/80 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eefaf6]">
              <TrendingUp className="h-5 w-5 text-[#12785f]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-black text-emerald-950">{t("body_metrics_log_new")}</h3>
              <p className="truncate text-sm font-medium text-emerald-950/55">{t("body_metrics_log_desc")}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-3xl bg-[#f3faf6] p-3">
              <Label htmlFor="weight" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-emerald-950">
                <TrendingUp className="h-4 w-4 text-[#24b893]" />
                Weight (kg) *
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0.1"
                max="500"
                placeholder="Enter your weight in kg"
                value={formData.weight_kg}
                onChange={(e) => setFormData((prev) => ({ ...prev, weight_kg: e.target.value }))}
                className="h-12 rounded-2xl border-emerald-900/10 bg-white text-base font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-3xl bg-[#fff8ed] p-3">
                <Label htmlFor="waist" className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-amber-700">
                  <Ruler className="h-3.5 w-3.5" />
                  Waist
                </Label>
                <Input
                  id="waist"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="300"
                  placeholder="cm"
                  value={formData.waist_cm}
                  onChange={(e) => setFormData((prev) => ({ ...prev, waist_cm: e.target.value }))}
                  className="h-11 rounded-2xl border-amber-200 bg-white px-3 text-sm font-bold"
                />
              </div>

              <div className="rounded-3xl bg-[#eefaf6] p-3">
                <Label htmlFor="bodyFat" className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-[#12785f]">
                  <Activity className="h-3.5 w-3.5" />
                  Fat
                </Label>
                <Input
                  id="bodyFat"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={formData.body_fat_percent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body_fat_percent: e.target.value }))}
                  className="h-11 rounded-2xl border-emerald-200 bg-white px-3 text-sm font-bold"
                />
              </div>

              <div className="rounded-3xl bg-[#eff8fb] p-3">
                <Label htmlFor="muscleMass" className="mb-2 flex items-center gap-1.5 text-xs font-extrabold text-teal-700">
                  <Dumbbell className="h-3.5 w-3.5" />
                  Muscle
                </Label>
                <Input
                  id="muscleMass"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={formData.muscle_mass_percent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, muscle_mass_percent: e.target.value }))}
                  className="h-11 rounded-2xl border-teal-200 bg-white px-3 text-sm font-bold"
                />
              </div>
            </div>

            <div className="rounded-3xl bg-[#f8fbf9] p-3">
              <Label htmlFor="notes" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-emerald-950">
                <StickyNote className="h-4 w-4 text-[#24b893]" />
                Notes
              </Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes about your progress..."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
                className="rounded-2xl border-emerald-900/10 bg-white text-sm font-medium"
              />
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="h-[52px] w-full rounded-2xl bg-[#103f32] text-base font-extrabold text-white shadow-[0_14px_32px_rgba(16,63,50,0.20)] hover:bg-[#103f32]/95 active:scale-[0.99]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...
                </>
              ) : (
                "Log Measurement"
              )}
            </Button>
          </form>
        </section>

        {historyLoading ? (
          <div className="flex items-center justify-center rounded-[28px] bg-white py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : metricsHistory && metricsHistory.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div className="min-w-0">
                <h3 className="text-base font-black text-emerald-950">{t("body_metrics_history")}</h3>
                <p className="truncate text-xs font-medium text-emerald-950/50">{t("body_metrics_history_desc")}</p>
              </div>
            </div>

            <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {metricsHistory.map((metric) => (
                <div
                  key={metric.id}
                  className="min-w-[238px] snap-start rounded-3xl border border-emerald-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-black text-emerald-950">{metric.weight_kg} kg</p>
                      <p className="text-xs font-bold text-emerald-950/45">
                        {format(new Date(metric.recorded_at), "MMM d")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 shrink-0 rounded-2xl text-rose-500 active:bg-rose-50 active:scale-95"
                      onClick={() => deleteMetrics(metric.id)}
                      aria-label="Delete measurement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-[#fff8ed] px-2 py-2">
                      <p className="text-[10px] font-bold uppercase text-amber-700">Waist</p>
                      <p className="text-sm font-black text-emerald-950">{metric.waist_cm ? `${metric.waist_cm}` : "--"}</p>
                    </div>
                    <div className="rounded-2xl bg-[#eefaf6] px-2 py-2">
                      <p className="text-[10px] font-bold uppercase text-[#12785f]">Fat</p>
                      <p className="text-sm font-black text-emerald-950">{metric.body_fat_percent ? `${metric.body_fat_percent}%` : "--"}</p>
                    </div>
                    <div className="rounded-2xl bg-[#eff8fb] px-2 py-2">
                      <p className="text-[10px] font-bold uppercase text-teal-700">Muscle</p>
                      <p className="text-sm font-black text-emerald-950">{metric.muscle_mass_percent ? `${metric.muscle_mass_percent}%` : "--"}</p>
                    </div>
                  </div>
                  {metric.notes && (
                    <p className="mt-3 line-clamp-1 text-xs font-medium text-emerald-950/55">{metric.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[28px] bg-white py-12 text-center shadow-sm">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[#eefaf6]">
              <TrendingUp className="h-8 w-8 text-[#24b893]" />
            </div>
            <p className="text-sm font-extrabold text-emerald-950">{t("body_metrics_empty")}</p>
            <p className="text-xs font-medium text-emerald-950/50">{t("body_metrics_empty_desc")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BodyMetrics;
