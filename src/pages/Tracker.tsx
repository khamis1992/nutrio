import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Pencil, Loader2, ArrowLeft, Footprints, Weight, Activity, BarChart3, ArrowUp, CheckCircle2, Droplets, X } from "lucide-react";
import { TrackerInsights } from "@/components/TrackerInsights";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ActivityLevelPrompt } from "@/components/onboarding/ActivityLevelPrompt";

const STEP_GOAL = 6000;
const TRACKER_COLORS = {
  text: "#020617",
  surface: "#F6F8FB",
  track: "#E5EAF1",
  calories: "#22C7A1",
  protein: "#7C83F6",
  fat: "#FB6B7A",
  water: "#38BDF8",
  carbs: "#F97316",
};

function getBmiStatus(bmi: number, t: (key: string) => string): { label: string; color: string; bg: string } {
  if (bmi < 18.5) return { label: t("underweight"), color: "text-[#38BDF8]", bg: "bg-[#38BDF8]" };
  if (bmi < 25) return { label: t("normal"), color: "text-[#22C7A1]", bg: "bg-[#22C7A1]" };
  if (bmi < 30) return { label: t("overweight"), color: "text-[#F97316]", bg: "bg-[#F97316]" };
  return { label: t("obese"), color: "text-[#FB6B7A]", bg: "bg-[#FB6B7A]" };
}

function getBmiBarPosition(bmi: number): number {
  return ((Math.max(15, Math.min(40, bmi)) - 15) / 25) * 100;
}

/* ─── Stat Card ─────────────────────────────────────── */
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
    fetchEntries: fetchWaterEntries,
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
    <div className="min-h-screen bg-[#F6F8FB] pb-28 text-[#020617]">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 border-b border-white/70 bg-[#F6F8FB]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[430px] px-4 pb-3 pt-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#7C83F6]">
              {format(new Date(), "EEE, MMM d")}
            </p>
            <h1 className="text-[24px] font-black leading-tight text-[#020617]">{t("tracker")}</h1>
          </div>
          <button
            onClick={() => navigate("/progress")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]"
            aria-label={t("progress")}
          >
            <BarChart3 className="h-5 w-5" />
          </button>
        </div>

        {/* ── Tabs ── */}
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <button
              onClick={() => setActiveTab("today")}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-full text-[13px] font-extrabold transition-all",
                activeTab === "today"
                  ? "bg-[#020617] text-white shadow-[0_8px_18px_rgba(2,6,23,0.16)]"
                  : "text-slate-500"
              )}
            >
              <Droplets className="h-4 w-4" />
              {t("today")}
            </button>
            <button
              onClick={() => setActiveTab("insights")}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-full text-[13px] font-extrabold transition-all",
                activeTab === "insights"
                  ? "bg-[#020617] text-white shadow-[0_8px_18px_rgba(2,6,23,0.16)]"
                  : "text-slate-500"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              {t("insights")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[430px] px-4 py-4">

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
          <div className="space-y-4">

            <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_8px_32px_rgba(15,23,42,0.10)] ring-1 ring-slate-100">
              <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                    {t("today")}
                  </p>
                  <h2 className="mt-1 text-[20px] font-black leading-tight text-slate-900">{t("tracker_subtitle")}</h2>
                  <p className="mt-2 text-[12px] font-semibold text-slate-500">
                    {Math.min(100, stepsPct)}% {t("steps")} · {Math.min(100, waterPct)}% {t("water")}
                  </p>
                </div>
                <div className="relative h-[86px] w-[86px] shrink-0">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" stroke={TRACKER_COLORS.track} strokeWidth="4" />
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      fill="none"
                      stroke={TRACKER_COLORS.protein}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(100, Math.max(0, stepsPct))} 100`}
                      pathLength="100"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[22px] font-black text-[#020617]">{Math.min(100, stepsPct)}%</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{t("steps")}</span>
                  </div>
                </div>
              </div>

              </div>
              <div className="grid grid-cols-2 gap-px bg-slate-100">
                <Link to="/water-tracker" className="block bg-white px-5 py-4 transition active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{t("water")}</p>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-[24px] font-black leading-none tracking-[-0.04em] text-slate-950">{waterMl.toLocaleString()}</span>
                        <span className="text-[11px] font-black text-slate-400">mL</span>
                      </div>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#EFF9FF] text-[#38BDF8] ring-1 ring-[#38BDF8]/20">
                      <Droplets className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] font-bold text-slate-500">
                    {Math.min(100, waterPct)}% of {waterTargetMl.toLocaleString()} mL
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#38BDF8] transition-all duration-500"
                      style={{ width: `${Math.min(100, waterPct)}%` }}
                    />
                  </div>
                </Link>

                <Link to="/step-counter" className="block bg-white px-5 py-4 transition active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{t("steps")}</p>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-[24px] font-black leading-none tracking-[-0.04em] text-slate-950">{steps.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                      <Footprints className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-1.5 truncate text-[11px] font-bold text-slate-500">
                    {Math.min(100, stepsPct)}% of {STEP_GOAL.toLocaleString()} steps
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#7C83F6] transition-all duration-500"
                      style={{ width: `${Math.min(100, stepsPct)}%` }}
                    />
                  </div>
                </Link>
              </div>
            </section>

            {/* Weight Card */}
            <div className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#EFFFFA] flex items-center justify-center shrink-0 ring-1 ring-[#22C7A1]/20">
                    <Weight className="h-[18px] w-[18px] text-[#22C7A1]" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("weight")}</span>
                </div>
                <button
                  onClick={() => setWeightDialogOpen(true)}
                  className="px-3 py-1.5 rounded-full bg-[#020617] text-white text-[12px] font-semibold shadow-[0_8px_18px_rgba(2,6,23,0.16)]"
                >
                  {t("update")}
                </button>
              </div>
              {!hasWeightData && currentWeight == null ? (
                <div className="text-center py-2">
                  <p className="text-[13px] text-slate-400 mb-3">{t("set_up_profile_cta")}</p>
                  <button
                    onClick={() => navigate("/profile")}
                    className="px-4 py-2 rounded-full bg-[#020617] text-white font-semibold text-[13px] shadow-[0_8px_18px_rgba(2,6,23,0.16)]"
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
                      <span className={cn("text-[12px] font-semibold flex items-center gap-0.5 ml-1", weightChange < 0 ? "text-[#22C7A1]" : "text-[#FB6B7A]")}>
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
                      className="h-full rounded-full bg-[#22C7A1] transition-all duration-500"
                      style={{ width: `${weightProgress}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <CheckCircle2 className="w-3 h-3 text-[#22C7A1]" />
                    <span className="text-[11px] text-slate-400">{t("progress_towards_goal")}</span>
                  </div>
                </>
              )}
            </div>

            {/* BMI Card */}
            <div className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] flex items-center justify-center shrink-0 ring-1 ring-[#F97316]/20">
                    <Activity className="h-[18px] w-[18px] text-[#F97316]" />
                  </div>
                  <span className="text-[13px] font-bold text-slate-700">{t("bmi")} (kg/m²)</span>
                </div>
                <button
                  onClick={() => {
                    setHeightInput(profile?.height_cm?.toString() ?? "");
                    setWeightInput(currentWeight?.toString() ?? "");
                    setBmiDialogOpen(true);
                  }}
                    className="w-8 h-8 rounded-full bg-[#F6F8FB] flex items-center justify-center ring-1 ring-[#E5EAF1]"
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
                  <div className="flex-1 bg-[#38BDF8]" />
                  <div className="flex-1 bg-[#22C7A1]" />
                  <div className="flex-1 bg-[#F97316]" />
                  <div className="flex-1 bg-[#FB6B7A]" />
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

          </div>
        )}
      </div>

      {/* ═══════ DIALOGS ═══════ */}
      {weightDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setWeightDialogOpen(false)} />
          <div
            className="relative mx-auto w-full max-w-[430px] rounded-t-[32px] bg-white px-5 pt-3 shadow-[0_-24px_48px_rgba(15,23,42,0.18)]"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                  {t("weight")}
                </p>
                <h2 className="mt-1 text-[24px] font-black leading-tight text-slate-950">{t("update_weight")}</h2>
                <p className="mt-1 text-[13px] font-semibold text-slate-500">Enter your current weight</p>
              </div>
              <button
                onClick={() => setWeightDialogOpen(false)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-[26px] bg-slate-50 p-4">
              <label className="text-[12px] font-extrabold text-slate-600">{t("weight")} (kg)</label>
              <div className="mt-3 flex items-center rounded-[22px] bg-white px-4 py-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#020617]">
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="75"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[34px] font-black leading-none text-slate-950 outline-none placeholder:text-slate-300"
                />
                <span className="text-[18px] font-black text-slate-400">kg</span>
              </div>
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
              className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-[#020617] text-[15px] font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] transition-colors disabled:opacity-45"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}
            </button>
          </div>
        </div>
      )}

      {bmiDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={() => setBmiDialogOpen(false)} />
          <div
            className="relative mx-auto flex w-full max-w-[430px] flex-col rounded-t-[32px] bg-white shadow-[0_-24px_48px_rgba(15,23,42,0.18)]"
            style={{ maxHeight: "88dvh" }}
          >
            <div className="px-5 pt-3">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                    {t("bmi")}
                  </p>
                  <h2 className="mt-1 text-[24px] font-black leading-tight text-slate-950">{t("edit_bmi")}</h2>
                  <p className="mt-1 text-[13px] font-semibold text-slate-500">Update height and weight</p>
                </div>
                <button
                  onClick={() => setBmiDialogOpen(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-4">
              <div className="rounded-[26px] bg-slate-50 p-4">
                <label className="text-[12px] font-extrabold text-slate-600">{t("height")}</label>
                <div className="mt-3 flex items-center rounded-[22px] bg-white px-4 py-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#020617]">
                  <input
                    type="number"
                    min="100"
                    max="250"
                    step="0.1"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[42px] font-black leading-none text-slate-950 outline-none"
                  />
                  <span className="text-[20px] font-black text-slate-400">cm</span>
                </div>
              </div>

              <div className="rounded-[26px] bg-slate-50 p-4">
                <label className="text-[12px] font-extrabold text-slate-600">{t("weight")}</label>
                <div className="mt-3 flex items-center rounded-[22px] bg-white px-4 py-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-[#020617]">
                  <input
                    type="number"
                    min="20"
                    max="300"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[42px] font-black leading-none text-slate-950 outline-none"
                  />
                  <span className="text-[20px] font-black text-slate-400">kg</span>
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-5 pt-4"
              style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
            >
              <button
                onClick={() => setBmiDialogOpen(false)}
                className="flex h-14 items-center justify-center rounded-full bg-slate-100 text-[15px] font-black text-slate-600"
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
                className="flex h-14 items-center justify-center rounded-full bg-[#020617] text-[15px] font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] disabled:opacity-45"
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
