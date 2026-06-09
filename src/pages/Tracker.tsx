import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Minus, Plus, Pencil, Loader2, ChevronLeft, ChevronRight, Footprints, Weight, Activity, BarChart3, ArrowUp, CheckCircle2, Droplets } from "lucide-react";
import { TrackerInsights } from "@/components/TrackerInsights";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ActivityLevelPrompt } from "@/components/onboarding/ActivityLevelPrompt";

const STEP_GOAL = 6000;

function getBmiStatus(bmi: number, t: (key: string) => string): { label: string; color: string; bg: string } {
  if (bmi < 18.5) return { label: t("underweight"), color: "text-blue-600", bg: "bg-blue-500" };
  if (bmi < 25) return { label: t("normal"), color: "text-emerald-600", bg: "bg-emerald-500" };
  if (bmi < 30) return { label: t("overweight"), color: "text-amber-600", bg: "bg-amber-500" };
  return { label: t("obese"), color: "text-red-600", bg: "bg-red-500" };
}

function getBmiBarPosition(bmi: number): number {
  return ((Math.max(15, Math.min(40, bmi)) - 15) / 25) * 100;
}

/* ─── Stat Card ─────────────────────────────────────── */
function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  progress,
  progressColor = "bg-emerald-500",
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  progress?: number;
  progressColor?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <span className="text-[13px] font-bold text-slate-700">{label}</span>
        </div>
        {action}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[26px] font-extrabold text-slate-900 tracking-[-0.03em] leading-none">
          {value}
        </span>
        {unit && <span className="text-[13px] font-semibold text-slate-400">{unit}</span>}
      </div>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function Tracker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const { t } = useLanguage();
  const today = format(new Date(), "yyyy-MM-dd");

  const {
    totalMl: waterMl,
    goalMl: waterTargetMl,
    entries: waterEntries,
    loading: waterLoading,
    fetchEntries: fetchWaterEntries,
    deleteEntry: deleteWaterEntry,
  } = useWaterEntries(user?.id);

  useEffect(() => { fetchWaterEntries(today); }, [fetchWaterEntries, today]);

  const { measurements, latestMeasurement, refresh: refreshMeasurements } = useBodyMeasurements(user?.id);

  const [steps, setSteps] = useState(0);
  const [activeTab, setActiveTab] = useState<"today" | "insights">("today");
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [bmiDialogOpen, setBmiDialogOpen] = useState(false);
  const [heightInput, setHeightInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showActivityPrompt, setShowActivityPrompt] = useState(false);

  const handleRemoveWater = async () => {
    const lastEntry = waterEntries[0];
    if (lastEntry) await deleteWaterEntry(lastEntry.id);
  };

  useEffect(() => {
    const stored = localStorage.getItem(`tracker_steps_${user?.id}_${today}`);
    if (stored) setSteps(parseInt(stored, 10));
  }, [user?.id, today]);

  useEffect(() => {
    if (user && profile && !showActivityPrompt) {
      const has = !!profile.activity_level;
      const sup = sessionStorage.getItem("nutrio_activity_prompt_suppressed");
      if (!has && !sup) {
        const tmr = setTimeout(() => setShowActivityPrompt(true), 1500);
        return () => clearTimeout(tmr);
      }
    }
  }, [user, profile, showActivityPrompt]);

  const saveSteps = (value: number) => {
    setSteps(value);
    localStorage.setItem(`tracker_steps_${user?.id}_${today}`, String(value));
  };

  const currentWeight = latestMeasurement?.weight_kg ?? profile?.current_weight_kg ?? null;
  const prevWeight = measurements[1]?.weight_kg ?? null;
  const startWeight =
    measurements.length > 0
      ? (measurements[measurements.length - 1]?.weight_kg ?? currentWeight ?? null)
      : (profile?.current_weight_kg ?? currentWeight ?? null);
  const goalWeight = profile?.target_weight_kg ?? null;
  const weightChange = currentWeight != null && prevWeight != null ? currentWeight - prevWeight : null;
  const weightProgress =
    startWeight && goalWeight && currentWeight != null
      ? Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - goalWeight)) * 100))
      : 0;
  const hasWeightData = startWeight != null && goalWeight != null;
  const heightCm = profile?.height_cm ?? null;
  const bmi = currentWeight && heightCm ? currentWeight / ((heightCm / 100) * (heightCm / 100)) : null;
  const bmiStatus = bmi ? getBmiStatus(bmi, t) : null;
  const waterPct = Math.round((waterMl / Math.max(1, waterTargetMl)) * 100);
  const stepsPct = Math.round((steps / STEP_GOAL) * 100);

  return (
    <div className="min-h-screen bg-[#F5F7FA] pb-20">
      {/* ── Header ── */}
      <div className="bg-white px-4 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3 max-w-[480px] mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-extrabold text-slate-900 leading-tight">{t("tracker")}</h1>
            <p className="text-[11px] text-slate-500">{t("tracker_subtitle")}</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="max-w-[480px] mx-auto mt-3">
          <div className="flex bg-slate-100 rounded-full p-1 gap-1">
            <button
              onClick={() => setActiveTab("today")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[13px] font-semibold transition-all",
                activeTab === "today"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              )}
            >
              <Droplets className="w-3.5 h-3.5" />
              {t("today")}
            </button>
            <button
              onClick={() => setActiveTab("insights")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[13px] font-semibold transition-all",
                activeTab === "insights"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {t("insights")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-[480px] mx-auto px-4 py-4">

        {/* ── Insights Tab ── */}
        {activeTab === "insights" && (
          <TrackerInsights
            userId={user?.id}
            stepGoal={STEP_GOAL}
            waterTargetMl={waterTargetMl}
            waterMl={waterMl}
            measurements={measurements}
            bmi={bmi}
            bmiLabel={bmiStatus?.label ?? null}
            profile={profile}
          />
        )}

        {/* ── Today Tab ── */}
        {activeTab === "today" && (
          <div className="space-y-3">

            {/* Water Card */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Droplets className="w-4.5 h-4.5 text-blue-500" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("water")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRemoveWater}
                    disabled={waterLoading || waterMl === 0}
                    className="w-8 h-8 rounded-full ring-1 ring-slate-200 text-slate-400 flex items-center justify-center disabled:opacity-30"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <Link
                    to="/water-tracker"
                    className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-0.5">
                <span className="text-[26px] font-extrabold text-slate-900 tracking-[-0.03em] leading-none">
                  {waterMl.toLocaleString()}
                </span>
                <span className="text-[13px] font-semibold text-slate-400">mL</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">/ {waterTargetMl.toLocaleString()} mL goal</p>
              <div className="h-[6px] w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, waterPct)}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-500 font-semibold mt-1.5">{waterPct}% of daily goal</p>
            </div>

            {/* Steps Card */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Footprints className="w-4.5 h-4.5 text-orange-500" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("steps")}</span>
                </div>
                {/* Circular progress */}
                <div className="relative w-14 h-14">
                  <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#FED7AA" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none" stroke="#F97316" strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${(steps / STEP_GOAL) * 94.25} 94.25`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] font-extrabold text-orange-500">{stepsPct}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-0.5">
                <span className="text-[26px] font-extrabold text-slate-900 tracking-[-0.03em] leading-none">
                  {steps.toLocaleString()}
                </span>
                <span className="text-[13px] font-semibold text-slate-400">{t("steps")}</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">/ {STEP_GOAL.toLocaleString()} goal</p>
              <Link
                to="/step-counter"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-orange-500 text-white font-semibold text-[13px] shadow-sm"
              >
                <Footprints className="w-4 h-4" />
                {t("add_steps")}
              </Link>
            </div>

            {/* Weight Card */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Weight className="w-4.5 h-4.5 text-violet-500" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("weight")}</span>
                </div>
                <button
                  onClick={() => setWeightDialogOpen(true)}
                  className="px-3 py-1.5 rounded-full bg-violet-500 text-white text-[12px] font-semibold shadow-sm"
                >
                  {t("update")}
                </button>
              </div>
              {!hasWeightData && currentWeight == null ? (
                <div className="text-center py-2">
                  <p className="text-[13px] text-slate-400 mb-3">{t("set_up_profile_cta")}</p>
                  <button
                    onClick={() => navigate("/profile")}
                    className="px-4 py-2 rounded-full bg-violet-500 text-white font-semibold text-[13px]"
                  >
                    {t("set_up_profile")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-[26px] font-extrabold text-slate-900 tracking-[-0.03em] leading-none">
                      {currentWeight != null ? currentWeight : "—"}
                    </span>
                    <span className="text-[13px] font-semibold text-slate-400">kg</span>
                    {weightChange != null && weightChange !== 0 && (
                      <span className={cn("text-[12px] font-semibold flex items-center gap-0.5 ml-1", weightChange < 0 ? "text-emerald-500" : "text-red-500")}>
                        <ArrowUp className={cn("w-3 h-3", weightChange < 0 && "rotate-180")} />
                        {Math.abs(weightChange).toFixed(1)} kg
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3">
                    {t("starting_cap")}: {startWeight ?? "—"} kg · {t("goal_cap")}: {goalWeight ?? "—"} kg
                  </p>
                  <div className="h-[6px] w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-violet-500 transition-all duration-500"
                      style={{ width: `${weightProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span className="text-[11px] text-slate-400">{t("progress_towards_goal")}</span>
                  </div>
                </>
              )}
            </div>

            {/* BMI Card */}
            <div className="rounded-2xl bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <Activity className="w-4.5 h-4.5 text-emerald-500" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("bmi")} (kg/m²)</span>
                </div>
                <button
                  onClick={() => {
                    setHeightInput(profile?.height_cm?.toString() ?? "");
                    setWeightInput(currentWeight?.toString() ?? "");
                    setBmiDialogOpen(true);
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[26px] font-extrabold text-slate-900 tracking-[-0.03em] leading-none">
                  {bmi != null ? bmi.toFixed(1) : "—"}
                </span>
                {bmiStatus && (
                  <span className={cn("text-[13px] font-semibold", bmiStatus.color)}>
                    {bmiStatus.label}
                  </span>
                )}
              </div>
              {/* BMI bar */}
              <div className="relative mt-3">
                <div className="flex h-2.5 rounded-full overflow-hidden">
                  <div className="flex-1 bg-blue-400" />
                  <div className="flex-1 bg-emerald-500" />
                  <div className="flex-1 bg-amber-400" />
                  <div className="flex-1 bg-red-500" />
                </div>
                {bmi != null && (
                  <div
                    className="absolute -top-0.5"
                    style={{ left: `calc(${getBmiBarPosition(bmi)}% - 6px)` }}
                  >
                    <div className="w-3 h-3 rounded-full bg-white border-2 border-slate-700 shadow-sm" />
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-1.5">
                <span>{t("underweight")}</span>
                <span>{t("normal")}</span>
                <span>{t("overweight")}</span>
                <span>{t("obese")}</span>
              </div>
            </div>

            {/* Progress Link */}
            <button
              onClick={() => navigate("/progress")}
              className="w-full rounded-2xl bg-emerald-50 p-4 flex items-center justify-between hover:bg-emerald-100 transition-colors text-left ring-1 ring-emerald-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <BarChart3 className="w-4.5 h-4.5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-[14px]">{t("consistency_key")}</p>
                  <p className="text-[11px] text-slate-500">{t("track_daily_results")}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
            </button>

          </div>
        )}
      </div>

      {/* ═══════ DIALOGS ═══════ */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent className="rounded-2xl" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <DialogHeader>
            <DialogTitle>{t("update_weight")}</DialogTitle>
            <DialogDescription>{t("enter_your_current_weight")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t("weight")} (kg)</Label>
              <Input
                type="number" step="0.1" min="20" max="300"
                placeholder={t("weight_placeholder")}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="mt-2 rounded-xl h-12"
              />
            </div>
            <button
              onClick={async () => {
                const kg = parseFloat(weightInput);
                if (!user || isNaN(kg) || kg <= 0) return;
                setSubmitting(true);
                try {
                  const { error } = await supabase
                    .from("body_measurements")
                    .upsert({ user_id: user.id, log_date: today, weight_kg: kg }, { onConflict: "user_id,log_date" });
                  if (error) throw error;
                  await updateProfile({ current_weight_kg: kg });
                  await refreshMeasurements();
                  toast({ title: t("weight_updated_toast"), description: `${kg} ${t("kg_logged")}` });
                  setWeightDialogOpen(false);
                  setWeightInput("");
                } catch {
                  toast({ title: t("failed_to_update"), variant: "destructive" });
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting || !weightInput}
              className="w-full h-12 rounded-full font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t("save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {bmiDialogOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBmiDialogOpen(false)} />
          <div
            className="relative bg-white rounded-t-3xl flex flex-col"
            style={{ maxHeight: "90dvh", overflowY: "auto", paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <h2 className="text-center text-lg font-bold text-slate-900 pb-5">{t("edit_bmi")}</h2>
            <div className="border-t border-b border-slate-100 py-5 px-6">
              <p className="text-sm text-slate-400 text-center mb-2">{t("height")}</p>
              <div className="flex items-baseline justify-center gap-2">
                <input
                  type="number" min="100" max="250" step="0.1"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  className="text-5xl font-black text-slate-900 bg-transparent border-none outline-none text-center w-44"
                />
                <span className="text-2xl font-semibold text-slate-400">cm</span>
              </div>
            </div>
            <div className="border-b border-slate-100 py-5 px-6 mb-6">
              <p className="text-sm text-slate-400 text-center mb-2">{t("weight")}</p>
              <div className="flex items-baseline justify-center gap-2">
                <input
                  type="number" min="20" max="300" step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="text-5xl font-black text-slate-900 bg-transparent border-none outline-none text-center w-44"
                />
                <span className="text-2xl font-semibold text-slate-400">kg</span>
              </div>
            </div>
            <div className="flex gap-3 px-4" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
              <button
                onClick={() => setBmiDialogOpen(false)}
                className="flex-1 py-3.5 rounded-full ring-1 ring-slate-200 text-slate-600 font-bold text-base hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const cm = parseFloat(heightInput);
                  const kg = parseFloat(weightInput);
                  if (!user || isNaN(cm) || cm <= 0) return;
                  setSubmitting(true);
                  try {
                    await updateProfile({ height_cm: cm });
                    if (!isNaN(kg) && kg > 0) {
                      await supabase
                        .from("body_measurements")
                        .upsert({ user_id: user.id, log_date: today, weight_kg: kg }, { onConflict: "user_id,log_date" });
                      await updateProfile({ current_weight_kg: kg });
                    }
                    await refreshMeasurements();
                    toast({ title: t("height_updated_toast"), description: t("bmi_recalculated") });
                    setBmiDialogOpen(false);
                  } catch {
                    toast({ title: t("failed_to_update"), variant: "destructive" });
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-base"
              >
                {submitting ? t("saving_progress") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showActivityPrompt && (
        <ActivityLevelPrompt
          t={t}
          onClose={() => {
            setShowActivityPrompt(false);
            sessionStorage.setItem("nutrio_activity_prompt_suppressed", "1");
          }}
        />
      )}
    </div>
  );
}
