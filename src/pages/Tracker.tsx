import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Minus,
  Plus,
  Pencil,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Footprints,
  Weight,
  Activity,
  BarChart3,
  ArrowUp,
  CheckCircle2,
  Star,
  CupSoda,
} from "lucide-react";
import { TrackerInsights } from "@/components/TrackerInsights";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ActivityLevelPrompt } from "@/components/onboarding/ActivityLevelPrompt";

const STEP_GOAL = 6000;

function getBmiStatus(bmi: number, t: (key: string) => string): { label: string; color: string } {
  if (bmi < 18.5) return { label: t("underweight"), color: "bg-slate-700" };
  if (bmi < 25) return { label: t("normal"), color: "bg-emerald-500" };
  if (bmi < 30) return { label: t("overweight"), color: "bg-emerald-500" };
  return { label: t("obese"), color: "bg-red-500" };
}

function getBmiBarPosition(bmi: number): number {
  const clamped = Math.max(15, Math.min(40, bmi));
  return ((clamped - 15) / 25) * 100;
}

// Inline leaf icon matching reference
function LeafIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.5C13.4 3.9 19 3 19 3c0 2.6-1.3 5.5-3.2 7.4A10.5 10.5 0 0 1 11 20Z" />
      <path d="M11 20v-5.5c0-1.4.6-2.7 1.6-3.6" />
    </svg>
  );
}

// Inline water drop illustration
function WaterDropIllustration({ filled }: { filled?: boolean }) {
  return (
    <svg width="36" height="48" viewBox="0 0 36 48" fill="none">
      <path
        d="M18 2C18 2 2 20 2 30C2 38.8 9.2 46 18 46C26.8 46 34 38.8 34 30C34 20 18 2 18 2Z"
        fill={filled ? "#22C55E" : "none"}
        stroke={filled ? "#22C55E" : "#D1D5DB"}
        strokeWidth="2"
      />
      {filled && (
        <path
          d="M12 34C12 34 14 38 18 38C22 38 24 34 24 34"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </svg>
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

  useEffect(() => {
    fetchWaterEntries(today);
  }, [fetchWaterEntries, today]);
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
    const key = `tracker_steps_${user?.id}_${today}`;
    const stored = localStorage.getItem(key);
    if (stored) setSteps(parseInt(stored, 10));
  }, [user?.id, today]);

  useEffect(() => {
    if (user && profile && !showActivityPrompt) {
      const hasActivityLevel = !!profile.activity_level;
      const promptSuppressed = sessionStorage.getItem("nutrio_activity_prompt_suppressed");
      if (!hasActivityLevel && !promptSuppressed) {
        const timer = setTimeout(() => setShowActivityPrompt(true), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [user, profile, showActivityPrompt]);

  const saveSteps = (value: number) => {
    setSteps(value);
    const key = `tracker_steps_${user?.id}_${today}`;
    localStorage.setItem(key, String(value));
  };

  const currentWeight = latestMeasurement?.weight_kg ?? profile?.current_weight_kg ?? null;
  const prevWeight = measurements[1]?.weight_kg ?? null;
  const startWeight = measurements.length > 0
    ? (measurements[measurements.length - 1]?.weight_kg ?? currentWeight ?? null)
    : (profile?.current_weight_kg ?? currentWeight ?? null);
  const goalWeight = profile?.target_weight_kg ?? null;
  const weightChange = currentWeight != null && prevWeight != null ? currentWeight - prevWeight : null;
  const weightProgress = startWeight && goalWeight && currentWeight != null
    ? Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - goalWeight)) * 100))
    : 0;
  const hasWeightData = startWeight != null && goalWeight != null;

  const heightCm = profile?.height_cm ?? null;
  const heightM = heightCm ? heightCm / 100 : null;
  const bmi = currentWeight && heightM ? currentWeight / (heightM * heightM) : null;
  const bmiStatus = bmi ? getBmiStatus(bmi, t) : null;

  const waterPct = Math.round((waterMl / Math.max(1, waterTargetMl)) * 100);
  const stepsPct = Math.round((steps / STEP_GOAL) * 100);

  const handleUpdateWeight = async () => {
    const kg = parseFloat(weightInput);
    if (!user || isNaN(kg) || kg <= 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("body_measurements")
        .upsert(
          { user_id: user.id, log_date: today, weight_kg: kg },
          { onConflict: "user_id,log_date" }
        );
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
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <div className="max-w-[480px] mx-auto px-4 py-5">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <LeafIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{t("tracker")}</h1>
            <p className="text-xs text-gray-400">{t("tracker_subtitle")}</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-3 mt-4 mb-4">
          <button
            onClick={() => setActiveTab("today")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all",
              activeTab === "today"
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-100"
            )}
          >
            <CupSoda className="w-4 h-4" />
            {t("today")}
          </button>
          <button
            onClick={() => setActiveTab("insights")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all",
              activeTab === "insights"
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-100"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            {t("insights")}
          </button>
        </div>

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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CupSoda className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="font-bold text-gray-900">{t("water")}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-extrabold text-gray-900">{waterMl.toLocaleString()} <span className="text-xl">mL</span></p>
                  <p className="text-sm text-gray-400 mt-0.5">/ {waterTargetMl.toLocaleString()} mL</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <WaterDropIllustration filled={waterMl > 0} />
                    <WaterDropIllustration filled={false} />
                  </div>
                  <button
                    onClick={handleRemoveWater}
                    disabled={waterLoading || waterMl === 0}
                    className="w-9 h-9 rounded-full border-2 border-emerald-500 text-emerald-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-50 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <Link
                    to="/water-tracker"
                    className="w-9 h-9 rounded-full border-2 border-emerald-500 text-emerald-500 flex items-center justify-center hover:bg-emerald-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, waterPct)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-emerald-500">{waterPct}%</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <CupSoda className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-400">{t("stay_hydrated")}</span>
              </div>
            </div>

            {/* Steps Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Footprints className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="font-bold text-gray-900">{t("steps")}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-extrabold text-gray-900">{steps.toLocaleString()} <span className="text-xl">{t("steps")}</span></p>
                  <p className="text-sm text-gray-400 mt-0.5">/ {STEP_GOAL.toLocaleString()} {t("steps")}</p>
                </div>
                <div className="relative w-[72px] h-[72px] flex-shrink-0">
                  <svg className="w-[72px] h-[72px] -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#22C55E"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${(steps / STEP_GOAL) * 94.25} 94.25`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-emerald-500">{stepsPct}%</span>
                  </div>
                </div>
              </div>
              <Link
                to="/step-counter"
                className="flex items-center justify-center gap-2 w-full mt-4 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold text-sm transition-colors"
              >
                <Footprints className="w-4 h-4" />
                {t("add_steps")}
              </Link>
              <div className="flex items-center gap-2 mt-3">
                <Star className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-gray-400">{t("keep_moving")}</span>
              </div>
            </div>

            {/* Weight Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Weight className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="font-bold text-gray-900">{t("weight")}</span>
              </div>
              {!hasWeightData && currentWeight == null ? (
                <div className="text-center py-3">
                  <p className="text-sm text-gray-400 mb-3">{t("set_up_profile_cta")}</p>
                  <button
                    onClick={() => navigate("/profile")}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm"
                  >
                    {t("set_up_profile")}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-3xl font-extrabold text-gray-900">
                        {currentWeight != null ? `${currentWeight} ` : "— "}
                        <span className="text-xl font-bold">kg</span>
                      </p>
                      {weightChange != null && weightChange !== 0 && (
                        <p className={cn(
                          "text-sm font-semibold flex items-center gap-0.5 mt-0.5",
                          weightChange < 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          <ArrowUp className={cn("w-3 h-3", weightChange < 0 && "rotate-180")} />
                          {Math.abs(weightChange).toFixed(1)} kg
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setWeightDialogOpen(true)}
                      className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
                    >
                      {t("update")}
                    </button>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${weightProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>{t("starting_cap")}: <span className="text-emerald-500 font-medium">{startWeight ?? "—"} kg</span></span>
                    <span>{t("goal_cap")}: <span className="text-emerald-500 font-medium">{goalWeight ?? "—"} kg</span></span>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-gray-400">{t("progress_towards_goal")}</span>
                  </div>
                </>
              )}
            </div>

            {/* BMI Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-emerald-500" />
                </div>
                <span className="font-bold text-gray-900">{t("bmi")} (kg/m²)</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-extrabold text-gray-900">
                    {bmi != null ? bmi.toFixed(1) : "—"}
                  </p>
                  {bmiStatus && (
                    <p className="text-sm text-gray-400 mt-0.5">{bmiStatus.label}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setHeightInput(profile?.height_cm?.toString() ?? "");
                    setWeightInput(currentWeight?.toString() ?? "");
                    setBmiDialogOpen(true);
                  }}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <div className="flex h-3 rounded-full overflow-hidden">
                  <div className="flex-1 bg-slate-600 rounded-l-full" />
                  <div className="flex-1 bg-emerald-500" />
                  <div className="flex-1 bg-amber-400" />
                  <div className="flex-1 bg-emerald-500" />
                  <div className="flex-1 bg-red-500 rounded-r-full" />
                </div>
                {bmi != null && (
                  <div
                    className="absolute top-full mt-0.5"
                    style={{ left: `calc(${getBmiBarPosition(bmi)}% - 6px)` }}
                  >
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-emerald-500" />
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-3">
                <span className="text-center flex-1">{t("underweight")}</span>
                <span className="text-center flex-1">{t("normal")}</span>
                <span className="text-center flex-1 text-emerald-500 font-medium">{t("overweight")}</span>
                <span className="text-center flex-1">{t("obese")}</span>
              </div>
            </div>

            {/* Consistency Card */}
            <button
              onClick={() => navigate("/progress")}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{t("consistency_key")}</p>
                  <p className="text-xs text-gray-400">{t("track_daily_results")}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300" />
            </button>
          </div>
        )}
      </div>

      {/* Weight Update Dialog */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent className="rounded-2xl" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <DialogHeader>
            <DialogTitle>{t("update_weight")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t("weight")} (kg)</Label>
              <Input
                type="number"
                step="0.1"
                min="20"
                max="300"
                placeholder={t("weight_placeholder")}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="mt-2 rounded-xl h-12"
              />
            </div>
            <button
              onClick={handleUpdateWeight}
              disabled={submitting || !weightInput}
              className="w-full h-12 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t("save")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit BMI Bottom Sheet */}
      {bmiDialogOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBmiDialogOpen(false)} />
          <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "90dvh", overflowY: "auto", paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <h2 className="text-center text-lg font-bold text-gray-900 pb-5">{t("edit_bmi")}</h2>
            <div className="border-t border-b border-gray-100 py-5 px-6 mb-1">
              <p className="text-sm text-gray-400 text-center mb-2">{t("height")}</p>
              <div className="flex items-baseline justify-center gap-2">
                <input
                  type="number"
                  min="100"
                  max="250"
                  step="0.1"
                  placeholder="0.0"
                  value={heightInput}
                  onChange={(e) => setHeightInput(e.target.value)}
                  className="text-5xl font-black text-gray-900 bg-transparent border-none outline-none text-center w-44"
                />
                <span className="text-2xl font-semibold text-gray-400">cm</span>
              </div>
            </div>
            <div className="border-b border-gray-100 py-5 px-6 mb-6">
              <p className="text-sm text-gray-400 text-center mb-2">{t("weight")}</p>
              <div className="flex items-baseline justify-center gap-2">
                <input
                  type="number"
                  min="20"
                  max="300"
                  step="0.1"
                  placeholder="0.0"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="text-5xl font-black text-gray-900 bg-transparent border-none outline-none text-center w-44 caret-emerald-500"
                />
                <span className="text-2xl font-semibold text-gray-400">kg</span>
              </div>
            </div>
            <div className="flex gap-3 px-4 pb-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
              <button
                onClick={() => setBmiDialogOpen(false)}
                className="flex-1 py-3.5 rounded-full border-2 border-emerald-500 text-emerald-500 font-bold text-base hover:bg-emerald-50 transition-all"
              >
                {t("cancel")}
              </button>
              <button
                onClick={async () => {
                  const cm = parseFloat(heightInput);
                  const kg = parseFloat(weightInput);
                  if (!user) return;
                  if (isNaN(cm) || cm <= 0) return;
                  setSubmitting(true);
                  try {
                    await updateProfile({ height_cm: cm });
                    if (!isNaN(kg) && kg > 0) {
                      await supabase.from("body_measurements").upsert(
                        { user_id: user.id, log_date: today, weight_kg: kg },
                        { onConflict: "user_id,log_date" }
                      );
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
                className="flex-1 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.98]"
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
