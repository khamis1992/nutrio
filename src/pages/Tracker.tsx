import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { useBodyMeasurements } from "@/hooks/useBodyMeasurements";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Droplets, Minus, Plus, Pencil, Loader2 } from "lucide-react";
import { TrackerInsights } from "@/components/TrackerInsights";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const STEP_GOAL = 6000;

function getBmiStatus(bmi: number, t: any): { label: string; color: string } {
  if (bmi < 18.5) return { label: t("underweight"), color: "bg-slate-700" };
  if (bmi < 25) return { label: t("normal"), color: "bg-emerald-500" };
  if (bmi < 30) return { label: t("overweight"), color: "bg-amber-500" };
  return { label: t("obese"), color: "bg-red-500" };
}

function getBmiBarPosition(bmi: number): number {
  // 15-40 range for the bar
  const clamped = Math.max(15, Math.min(40, bmi));
  return ((clamped - 15) / 25) * 100;
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
  const { measurements, latestMeasurement, fetchMeasurements } = useBodyMeasurements(user?.id);

  const [steps, setSteps] = useState(0);
  const [activeTab, setActiveTab] = useState<"today" | "insights">("today");
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [bmiDialogOpen, setBmiDialogOpen] = useState(false);
  const [heightInput, setHeightInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRemoveWater = async () => {
    const lastEntry = waterEntries[0];
    if (lastEntry) await deleteWaterEntry(lastEntry.id);
  };

  // Steps: localStorage for now (no backend)
  useEffect(() => {
    const key = `tracker_steps_${user?.id}_${today}`;
    const stored = localStorage.getItem(key);
    if (stored) setSteps(parseInt(stored, 10));
  }, [user?.id, today]);

  const saveSteps = (value: number) => {
    setSteps(value);
    const key = `tracker_steps_${user?.id}_${today}`;
    localStorage.setItem(key, String(value));
  };

  // Weight from body_measurements or profile
  const currentWeight = latestMeasurement?.weight_kg ?? profile?.current_weight_kg ?? null;
  const prevWeight = measurements[1]?.weight_kg ?? null;
  const startWeight = measurements.length > 0 ? (measurements[measurements.length - 1]?.weight_kg ?? currentWeight ?? 80) : (profile?.current_weight_kg ?? currentWeight ?? 80);
  const goalWeight = profile?.target_weight_kg ?? 75;
  const weightChange = currentWeight != null && prevWeight != null ? currentWeight - prevWeight : null;
  const weightProgress = startWeight && goalWeight && currentWeight != null
    ? Math.min(100, Math.max(0, ((startWeight - currentWeight!) / (startWeight - goalWeight)) * 100))
    : 0;

  // BMI
  const heightM = (profile?.height_cm ?? 170) / 100;
  const bmi = currentWeight ? currentWeight / (heightM * heightM) : null;
  const bmiStatus = bmi ? getBmiStatus(bmi, t) : null;

  const handleUpdateWeight = async () => {
    const kg = parseFloat(weightInput);
    if (!user || isNaN(kg) || kg <= 0) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("body_measurements")
        .upsert(
          { user_id: user.id, log_date: today, weight_kg: kg },
          { onConflict: "user_id,log_date" }
        );
      if (error) throw error;
      await updateProfile({ current_weight_kg: kg });
      await fetchMeasurements();
      toast({ title: t("weight_updated_toast"), description: `${kg} ${t("kg_logged")}` });
      setWeightDialogOpen(false);
      setWeightInput("");
    } catch {
      toast({ title: t("failed_to_update"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateHeight = async () => {
    const cm = parseFloat(heightInput);
    if (!user || isNaN(cm) || cm <= 0) return;
    setSubmitting(true);
    try {
      await updateProfile({ height_cm: cm });
      toast({ title: t("height_updated_toast"), description: t("bmi_recalculated") });
      setBmiDialogOpen(false);
      setHeightInput("");
    } catch {
      toast({ title: t("failed_to_update"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-gray-900 mb-4">{t("tracker")}</h1>

        {/* Tab bar */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
          {(["today", "insights"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize",
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === "today" ? t("today") : t("insights")}
            </button>
          ))}
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
        <div className="space-y-4">
          {/* Water Card */}
          <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
            <CardContent className="p-5">
              <p className="font-bold text-gray-900 mb-1">{t("water")}</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{waterMl} mL</p>
                  <p className="text-sm text-gray-500">/ {waterTargetMl.toLocaleString()} mL</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRemoveWater}
                    disabled={waterLoading || waterMl === 0}
                    className="w-10 h-10 rounded-full border-2 border-blue-500 text-blue-500 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-50 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-16 h-20 flex items-center justify-center">
                    <Droplets className={cn(
                      "w-14 h-14 transition-colors",
                      waterMl >= waterTargetMl ? "text-blue-500 fill-blue-200" : "text-gray-200"
                    )} />
                  </div>
                  <Link
                    to="/water-tracker"
                    className="w-10 h-10 rounded-full border-2 border-blue-500 text-blue-500 flex items-center justify-center hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step Card */}
          <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
            <CardContent className="p-5">
              <p className="font-bold text-gray-900 mb-1">{t("steps")}</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{steps.toLocaleString()} {t("steps")}</p>
                  <p className="text-sm text-gray-500">/ {STEP_GOAL.toLocaleString()} {t("steps")}</p>
                </div>
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${(steps / STEP_GOAL) * 94.25} 94.25`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold text-orange-500">
                      {Math.round((steps / STEP_GOAL) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full mt-3 text-white"
                style={{ backgroundColor: "#EA580C", borderColor: "#EA580C" }}
              >
                <Link to="/step-counter">{t("add_steps")}</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Weight Card */}
          <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
            <CardContent className="p-5">
              <p className="font-bold text-gray-900 mb-2">{t("weight")}</p>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {currentWeight != null ? `${currentWeight} kg` : "—"}
                  </p>
                  {weightChange != null && weightChange !== 0 && (
                    <p className={cn(
                      "text-sm flex items-center gap-0.5",
                      weightChange < 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {weightChange < 0 ? "↓" : "↑"} {Math.abs(weightChange).toFixed(1)} kg
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate("/weight-tracking")}
                  className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {t("update")}
                </Button>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all duration-500"
                  style={{ width: `${weightProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{t("starting")}: {startWeight} kg</span>
                <span>{t("goal")}: {goalWeight} kg</span>
              </div>
            </CardContent>
          </Card>

          {/* BMI Card */}
          <Card className="rounded-2xl shadow-sm border-gray-100 overflow-hidden">
            <CardContent className="p-5">
              <p className="font-bold text-gray-900 mb-2">{t("bmi")} (kg/m²)</p>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {bmi != null ? bmi.toFixed(1) : "—"}
                  </p>
                  {bmiStatus && (
                    <p className="text-sm text-gray-600">{bmiStatus.label}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setHeightInput(profile?.height_cm?.toString() ?? "");
                    setWeightInput(currentWeight?.toString() ?? "");
                    setBmiDialogOpen(true);
                  }}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              {/* BMI range bar */}
              <div className="relative h-3 rounded-full overflow-visible flex">
                <div className="flex-1 bg-slate-700 rounded-l-full" />
                <div className="flex-1 bg-slate-400" />
                <div className="flex-1 bg-emerald-500" />
                <div className="flex-1 bg-amber-400" />
                <div className="flex-1 bg-orange-500" />
                <div className="flex-1 bg-red-500 rounded-r-full" />
                {bmi != null && (
                  <div
                    className="absolute top-full mt-0.5 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-emerald-600"
                    style={{ left: `calc(${getBmiBarPosition(bmi)}% - 6px)` }}
                  />
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {t("underweight")} · {t("normal")} · {t("overweight")} · {t("obese")}
              </p>
            </CardContent>
          </Card>
        </div>
        )}

      </div>

      <CustomerNavigation />

      {/* Weight Update Dialog */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent className="rounded-2xl" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
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
            <Button
              onClick={handleUpdateWeight}
              disabled={submitting || !weightInput}
              className="w-full h-12 rounded-xl font-semibold bg-orange-500 hover:bg-orange-600"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit BMI Bottom Sheet */}
      {bmiDialogOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBmiDialogOpen(false)} />
          <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: '90dvh', overflowY: 'auto', paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Title */}
            <h2 className="text-center text-lg font-bold text-gray-900 pb-5">{t("edit_bmi")}</h2>

            {/* Height field */}
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

            {/* Weight field */}
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
                    className="text-5xl font-black text-gray-900 bg-transparent border-none outline-none text-center w-44 caret-purple-600"
                  />
                <span className="text-2xl font-semibold text-gray-400">kg</span>
              </div>
            </div>

            {/* Cancel / Save */}
            <div className="flex gap-3 px-4 pb-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}>
              <button
                onClick={() => setBmiDialogOpen(false)}
                className="flex-1 py-3.5 rounded-full border-2 border-purple-600 text-purple-600 font-bold text-base hover:bg-purple-50 transition-all"
              >
                {t("cancel")}
              </button>
              <button
                onClick={async () => {
                  await handleUpdateHeight();
                  if (weightInput) {
                    const kg = parseFloat(weightInput);
                    if (!isNaN(kg) && kg > 0 && user) {
                      await supabase.from("body_measurements").upsert(
                        { user_id: user.id, log_date: today, weight_kg: kg },
                        { onConflict: "user_id,log_date" }
                      );
                      await updateProfile({ current_weight_kg: kg });
                      await fetchMeasurements();
                    }
                  }
                  setBmiDialogOpen(false);
                }}
                disabled={submitting}
                className="flex-1 py-3.5 rounded-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.98]"
              >
                {submitting ? t("saving_progress") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
