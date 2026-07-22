import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Pencil, Loader2, ArrowLeft, Footprints, Weight, Activity, BarChart3, ArrowUp, Droplets, X } from "lucide-react";
import { TrackerInsights } from "@/components/TrackerInsights";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ActivityLevelPrompt } from "@/components/onboarding/ActivityLevelPrompt";
import { motion } from "framer-motion";

const STEP_GOAL = 6000;

function getBmiStatus(bmi: number, t: (key: string) => string): { label: string; color: string; bg: string } {
  if (bmi < 18.5) return { label: t("underweight"), color: "text-macro-water", bg: "bg-macro-water" };
  if (bmi < 25) return { label: t("normal"), color: "text-brand", bg: "bg-brand" };
  if (bmi < 30) return { label: t("overweight"), color: "text-macro-carbs", bg: "bg-macro-carbs" };
  return { label: t("obese"), color: "text-macro-fat", bg: "bg-macro-fat" };
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
    return undefined;
  }, [user, profile, showActivityPrompt]);

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
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-slate-900">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-gradient-to-b from-[#F8FAFC] via-[#F8FAFC]/90 to-transparent pb-4 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto max-w-[430px] px-5 pt-4">
          <div className="flex items-center justify-between">
            <button
              data-testid="tracker-back-btn"
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-slate-600 backdrop-blur-md transition-all hover:bg-white active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="rounded-full bg-white/60 px-3 py-1 backdrop-blur-md">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {format(new Date(), "EEE, MMM d")}
              </p>
            </div>
            <button
              data-testid="tracker-progress-btn"
              onClick={() => navigate("/progress")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/50 text-slate-600 backdrop-blur-md transition-all hover:bg-white active:scale-95"
              aria-label={t("progress")}
            >
              <BarChart3 className="h-5 w-5" />
            </button>
          </div>
          <h1 className="mt-4 text-[28px] font-black tracking-tight text-slate-900 text-start">{t("tracker")}</h1>
          
          {/* ── Tabs ── */}
          <div className="mt-4 flex gap-6 border-b border-slate-200/60">
            <button
              data-testid="tracker-tab-today"
              onClick={() => setActiveTab("today")}
              className={cn(
                "relative pb-3 text-[14px] font-bold transition-colors",
                activeTab === "today" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {t("today")}
              {activeTab === "today" && (
                <motion.div layoutId="tracker-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-brand" />
              )}
            </button>
            <button
              data-testid="tracker-tab-insights"
              onClick={() => setActiveTab("insights")}
              className={cn(
                "relative pb-3 text-[14px] font-bold transition-colors",
                activeTab === "insights" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {t("insights")}
              {activeTab === "insights" && (
                <motion.div layoutId="tracker-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full bg-brand" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[430px] px-5 py-2">
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, staggerChildren: 0.1 }}
            className="space-y-5"
          >
            {/* HERO: Concentric Rings */}
            <motion.section className="relative overflow-hidden rounded-[32px] bg-[#0F172A] p-6 shadow-[0_8px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-800">
              <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/10 blur-3xl" />
              
              <div className="relative flex flex-col items-center">
                <div className="relative flex h-[180px] w-[180px] items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 180 180" aria-hidden="true">
                    {/* Outer Ring: Steps */}
                    <circle cx="90" cy="90" r="76" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                    <motion.circle
                      cx="90"
                      cy="90"
                      r="76"
                      fill="none"
                      stroke="#7C83F6"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(100, Math.max(0, stepsPct)) * 4.775} 477.5`}
                      pathLength="100"
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                    
                    {/* Inner Ring: Water */}
                    <circle cx="90" cy="90" r="58" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                    <motion.circle
                      cx="90"
                      cy="90"
                      r="58"
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.min(100, Math.max(0, waterPct)) * 3.644} 364.4`}
                      pathLength="100"
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
                    />
                  </svg>
                  <div className="flex flex-col items-center justify-center text-center">
                    <span className="text-[32px] font-black leading-none tracking-tight text-white" dir="ltr">
                      {Math.round((Math.min(100, stepsPct) + Math.min(100, waterPct)) / 2)}%
                    </span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{t("score")}</span>
                  </div>
                </div>

                <div className="mt-6 w-full space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-macro-protein/20 text-macro-protein">
                      <Footprints className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-end justify-between">
                        <p className="text-[12px] font-bold text-white">{t("steps")}</p>
                        <p className="text-[12px] font-bold text-slate-400" dir="ltr"><span className="text-white">{steps.toLocaleString()}</span> / {STEP_GOAL.toLocaleString()}</p>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <motion.div className="h-full rounded-full bg-macro-protein" initial={{ width: 0 }} animate={{ width: `${Math.min(100, stepsPct)}%` }} transition={{ duration: 1 }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-macro-water/20 text-macro-water">
                      <Droplets className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-end justify-between">
                        <p className="text-[12px] font-bold text-white">{t("water")}</p>
                        <p className="text-[12px] font-bold text-slate-400" dir="ltr"><span className="text-white">{waterMl.toLocaleString()}</span> / {waterTargetMl.toLocaleString()} mL</p>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <motion.div className="h-full rounded-full bg-macro-water" initial={{ width: 0 }} animate={{ width: `${Math.min(100, waterPct)}%` }} transition={{ duration: 1, delay: 0.1 }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Quick Tiles */}
            <div className="grid grid-cols-2 gap-3">
              <Link to="/water-tracker" data-testid="tracker-water-link" className="group flex flex-col justify-between rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition-all hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] active:scale-[0.98]">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-macro-water-soft text-macro-water ring-1 ring-macro-water/20 transition-transform group-hover:scale-110">
                    <Droplets className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400" dir="ltr">{Math.min(100, waterPct)}%</span>
                </div>
                <div className="mt-4 text-start">
                  <p className="text-[24px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{waterMl.toLocaleString()}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">mL {t("water")}</p>
                </div>
              </Link>
              <Link to="/step-counter" data-testid="tracker-steps-link" className="group flex flex-col justify-between rounded-[24px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100 transition-all hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] active:scale-[0.98]">
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-macro-protein-soft text-macro-protein ring-1 ring-macro-protein/20 transition-transform group-hover:scale-110">
                    <Footprints className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <span className="text-[11px] font-bold text-slate-400" dir="ltr">{Math.min(100, stepsPct)}%</span>
                </div>
                <div className="mt-4 text-start">
                  <p className="text-[24px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{steps.toLocaleString()}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{t("steps")}</p>
                </div>
              </Link>
            </div>

            {/* BODY Section */}
            <section className="rounded-[28px] bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-black uppercase tracking-[0.12em] text-slate-900">{t("tracker_body")}</span>
                </div>
                <button
                  data-testid="tracker-bmi-edit-btn"
                  onClick={() => {
                    setHeightInput(profile?.height_cm?.toString() ?? "");
                    setWeightInput(currentWeight?.toString() ?? "");
                    setBmiDialogOpen(true);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                  aria-label="Edit Body Stats"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              </div>

              <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
                {/* Left: Weight */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Weight className="h-4 w-4" />
                      <span className="text-[12px] font-bold">{t("weight")}</span>
                    </div>
                    <button
                      data-testid="tracker-weight-update-btn"
                      onClick={() => setWeightDialogOpen(true)}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95"
                    >
                      {t("update")}
                    </button>
                  </div>

                  {!hasWeightData && currentWeight == null ? (
                    <div className="mt-4 flex flex-col items-start rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100/50">
                      <p className="mb-3 text-[12px] font-medium text-slate-500">{t("set_up_profile_cta")}</p>
                      <button
                        onClick={() => navigate("/profile")}
                        className="rounded-full bg-white px-4 py-2 text-[12px] font-bold text-slate-900 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50 active:scale-95"
                      >
                        {t("set_up_profile")}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 text-start">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[32px] font-black leading-none tracking-tight text-slate-900" dir="ltr">
                          {currentWeight != null ? currentWeight : "—"}
                        </span>
                        <span className="text-[14px] font-bold text-slate-400">kg</span>
                        {weightChange != null && weightChange !== 0 && (
                          <span className={cn("ms-2 flex items-center gap-0.5 text-[12px] font-bold", weightChange < 0 ? "text-brand" : "text-macro-fat")} dir="ltr">
                            <ArrowUp className={cn("h-3.5 w-3.5", weightChange < 0 && "rotate-180")} strokeWidth={2.5} />
                            {Math.abs(weightChange).toFixed(1)} kg
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <span>{t("starting_cap")}: <span className="text-slate-700" dir="ltr">{startWeight ?? "—"} kg</span></span>
                        <span>{t("goal_cap")}: <span className="text-slate-700" dir="ltr">{goalWeight ?? "—"} kg</span></span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                        <motion.div
                          className="h-full rounded-full bg-brand"
                          initial={{ width: 0 }}
                          animate={{ width: `${weightProgress}%` }}
                          transition={{ duration: 0.8 }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="hidden w-px bg-slate-100 sm:block" />
                <div className="h-px w-full bg-slate-100 sm:hidden" />

                {/* Right/Bottom: BMI */}
                <div className="flex-1 text-start">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Activity className="h-4 w-4" />
                    <span className="text-[12px] font-bold">{t("bmi")}</span>
                  </div>
                  
                  {bmi != null ? (
                    <div className="mt-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[32px] font-black leading-none tracking-tight text-slate-900" dir="ltr">{bmi.toFixed(1)}</span>
                        {bmiStatus && (
                          <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-sm", bmiStatus.bg)}>
                            {bmiStatus.label}
                          </span>
                        )}
                      </div>
                      <div className="relative mt-5" dir="ltr">
                        <div className="flex h-2 overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                          <div className="flex-1 bg-macro-water" />
                          <div className="flex-1 bg-brand" />
                          <div className="flex-1 bg-macro-carbs" />
                          <div className="flex-1 bg-macro-fat" />
                        </div>
                        <motion.div
                          className="absolute -top-1.5 h-5 w-3 rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.15)] ring-1 ring-slate-200"
                          initial={{ left: 0 }}
                          animate={{ left: `calc(${getBmiBarPosition(bmi)}% - 6px)` }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400" dir="ltr">
                        <span>15</span>
                        <span>22.5</span>
                        <span>30</span>
                        <span>40</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-slate-50 py-5 ring-1 ring-slate-100/50">
                      <p className="text-[12px] font-medium text-slate-500">{t("set_height_weight_bmi")}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

          </motion.div>
        )}
      </div>

      {/* ═══════ DIALOGS ═══════ */}
      {weightDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setWeightDialogOpen(false)} />
          <div
            className="relative mx-auto w-full max-w-[430px] rounded-t-[32px] bg-white px-5 pt-3 shadow-[0_-8px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-100"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="text-start">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {t("weight")}
                </p>
                <h2 className="mt-0.5 text-[22px] font-black leading-tight tracking-tight text-slate-900">{t("update_weight")}</h2>
                <p className="mt-1 text-[13px] font-medium text-slate-500">{t("tracker_weight_dialog_subtitle")}</p>
              </div>
              <button
                data-testid="tracker-weight-close-btn"
                onClick={() => setWeightDialogOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                aria-label="Close"
              >
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100/50">
              <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{t("weight")} <span className="text-slate-400">(kg)</span></label>
              <div className="mt-3 flex items-center rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand">
                <input
                  data-testid="tracker-weight-input"
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="75"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[36px] font-black leading-none tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
                  dir="ltr"
                />
                <span className="text-[18px] font-bold text-slate-400">kg</span>
              </div>
            </div>

            <button
              data-testid="tracker-weight-save-btn"
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
              className="mt-5 flex h-14 w-full items-center justify-center rounded-full bg-slate-900 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)] transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}
            </button>
          </div>
        </div>
      )}

      {bmiDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setBmiDialogOpen(false)} />
          <div
            className="relative mx-auto flex w-full max-w-[430px] flex-col rounded-t-[32px] bg-white shadow-[0_-8px_32px_rgba(15,23,42,0.12)] ring-1 ring-slate-100"
            style={{ maxHeight: "88dvh" }}
          >
            <div className="px-5 pt-3">
              <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="text-start">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {t("bmi")}
                  </p>
                  <h2 className="mt-0.5 text-[22px] font-black leading-tight tracking-tight text-slate-900">{t("edit_bmi")}</h2>
                  <p className="mt-1 text-[13px] font-medium text-slate-500">{t("tracker_bmi_dialog_subtitle")}</p>
                </div>
                <button
                  data-testid="tracker-bmi-close-btn"
                  onClick={() => setBmiDialogOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 ring-1 ring-slate-200 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" strokeWidth={2.2} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100/50">
                <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{t("height")} <span className="text-slate-400">(cm)</span></label>
                <div className="mt-3 flex items-center rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand">
                  <input
                    type="number"
                    min="100"
                    max="250"
                    step="0.1"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[36px] font-black leading-none tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
                    dir="ltr"
                  />
                  <span className="text-[18px] font-bold text-slate-400">cm</span>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-100/50">
                <label className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{t("weight")} <span className="text-slate-400">(kg)</span></label>
                <div className="mt-3 flex items-center rounded-2xl bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand">
                  <input
                    type="number"
                    min="20"
                    max="300"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[36px] font-black leading-none tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
                    dir="ltr"
                  />
                  <span className="text-[18px] font-bold text-slate-400">kg</span>
                </div>
              </div>
            </div>

            <div
              className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-5 pt-4"
              style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
            >
              <button
                data-testid="tracker-bmi-cancel-btn"
                onClick={() => setBmiDialogOpen(false)}
                className="flex h-14 items-center justify-center rounded-full bg-slate-50 text-[15px] font-bold text-slate-600 ring-1 ring-slate-200 transition-all hover:bg-slate-100 active:scale-[0.98]"
              >
                {t("cancel")}
              </button>
              <button
                data-testid="tracker-bmi-save-btn"
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
                className="flex h-14 items-center justify-center rounded-full bg-slate-900 text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)] transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("save")}
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
