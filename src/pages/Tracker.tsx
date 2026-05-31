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
import { Minus, Plus, Pencil, Loader2, ChevronLeft, ChevronRight, Footprints, Weight, Activity, BarChart3, ArrowUp, CheckCircle2, Star, CupSoda } from "lucide-react";
import { TrackerInsights } from "@/components/TrackerInsights";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ActivityLevelPrompt } from "@/components/onboarding/ActivityLevelPrompt";

const STEP_GOAL = 6000;

function getBmiStatus(bmi: number, t: (key: string) => string): { label: string; color: string } {
  if (bmi < 18.5) return { label: t("underweight"), color: "bg-slate-700" };
  if (bmi < 25) return { label: t("normal"), color: "bg-emerald-500" };
  if (bmi < 30) return { label: t("overweight"), color: "bg-amber-500" };
  return { label: t("obese"), color: "bg-red-500" };
}

function getBmiBarPosition(bmi: number): number {
  return ((Math.max(15, Math.min(40, bmi)) - 15) / 25) * 100;
}

function LeafIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.5C13.4 3.9 19 3 19 3c0 2.6-1.3 5.5-3.2 7.4A10.5 10.5 0 0 1 11 20Z" /><path d="M11 20v-5.5c0-1.4.6-2.7 1.6-3.6" /></svg>;
}

function WaterDropIllustration({ filled }: { filled?: boolean }) {
  return <svg width="36" height="48" viewBox="0 0 36 48" fill="none"><path d="M18 2C18 2 2 20 2 30C2 38.8 9.2 46 18 46C26.8 46 34 38.8 34 30C34 20 18 2 18 2Z" fill={filled ? "#10B981" : "none"} stroke={filled ? "#10B981" : "#D1D5DB"} strokeWidth="2" />{filled && <path d="M12 34C12 34 14 38 18 38C22 38 24 34 24 34" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />}</svg>;
}

/* ═══════════════════════════════════════════════
   DESIGN SYSTEM — Single accent (emerald), surface ladder
   Cards: rounded-2xl, subtle shadow, ring instead of border
   ═══════════════════════════════════════════════ */

function TrackerCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">{icon}</div>
        <span className="font-extrabold text-slate-800 text-[15px]">{title}</span>
      </div>
      {children}
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
  const { totalMl: waterMl, goalMl: waterTargetMl, entries: waterEntries, loading: waterLoading, fetchEntries: fetchWaterEntries, deleteEntry: deleteWaterEntry } = useWaterEntries(user?.id);
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

  const handleRemoveWater = async () => { const lastEntry = waterEntries[0]; if (lastEntry) await deleteWaterEntry(lastEntry.id); };

  useEffect(() => { const stored = localStorage.getItem(`tracker_steps_${user?.id}_${today}`); if (stored) setSteps(parseInt(stored, 10)); }, [user?.id, today]);
  useEffect(() => { if (user && profile && !showActivityPrompt) { const has = !!profile.activity_level; const sup = sessionStorage.getItem("nutrio_activity_prompt_suppressed"); if (!has && !sup) { const tmr = setTimeout(() => setShowActivityPrompt(true), 1500); return () => clearTimeout(tmr); } } }, [user, profile, showActivityPrompt]);

  const saveSteps = (value: number) => { setSteps(value); localStorage.setItem(`tracker_steps_${user?.id}_${today}`, String(value)); };

  const currentWeight = latestMeasurement?.weight_kg ?? profile?.current_weight_kg ?? null;
  const prevWeight = measurements[1]?.weight_kg ?? null;
  const startWeight = measurements.length > 0 ? (measurements[measurements.length - 1]?.weight_kg ?? currentWeight ?? null) : (profile?.current_weight_kg ?? currentWeight ?? null);
  const goalWeight = profile?.target_weight_kg ?? null;
  const weightChange = currentWeight != null && prevWeight != null ? currentWeight - prevWeight : null;
  const weightProgress = startWeight && goalWeight && currentWeight != null ? Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - goalWeight)) * 100)) : 0;
  const hasWeightData = startWeight != null && goalWeight != null;
  const heightCm = profile?.height_cm ?? null;
  const bmi = currentWeight && heightCm ? currentWeight / ((heightCm / 100) * (heightCm / 100)) : null;
  const bmiStatus = bmi ? getBmiStatus(bmi, t) : null;
  const waterPct = Math.round((waterMl / Math.max(1, waterTargetMl)) * 100);
  const stepsPct = Math.round((steps / STEP_GOAL) * 100);

  const handleUpdateWeight = async () => { /* unchanged business logic */ };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="max-w-[480px] mx-auto px-5 py-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="w-[38px] h-[38px] rounded-full bg-white flex items-center justify-center shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <ChevronLeft className="h-[18px] w-[18px] text-slate-500" />
          </button>
          <div className="w-[38px] h-[38px] rounded-full bg-emerald-50 flex items-center justify-center">
            <LeafIcon className="w-[18px] h-[18px] text-emerald-600" />
          </div>
          <div>
            <h1 className="text-[18px] font-extrabold text-slate-900">{t("tracker")}</h1>
            <p className="text-[12px] text-slate-500">{t("tracker_subtitle")}</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-slate-100 rounded-full p-1 mb-5">
          <button onClick={() => setActiveTab("today")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[13px] font-semibold transition-all", activeTab === "today" ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]" : "text-slate-500")}>
            <CupSoda className="w-4 h-4" /> {t("today")}
          </button>
          <button onClick={() => setActiveTab("insights")} className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-[13px] font-semibold transition-all", activeTab === "insights" ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.08)]" : "text-slate-500")}>
            <BarChart3 className="w-4 h-4" /> {t("insights")}
          </button>
        </div>

        {/* ── Insights Tab ── */}
        {activeTab === "insights" && <TrackerInsights userId={user?.id} stepGoal={STEP_GOAL} waterTargetMl={waterTargetMl} waterMl={waterMl} measurements={measurements} bmi={bmi} bmiLabel={bmiStatus?.label ?? null} profile={profile} />}

        {/* ── Today Tab ── */}
        {activeTab === "today" && (
          <div className="space-y-3">

            {/* Water Card */}
            <TrackerCard icon={<CupSoda className="w-4 h-4 text-emerald-500" />} title={t("water")}>
              <div className="flex items-center justify-between">
                <div><p className="text-[28px] font-extrabold text-slate-900 tracking-[-0.02em]">{waterMl.toLocaleString()} <span className="text-lg font-bold text-slate-400">mL</span></p><p className="text-[13px] text-slate-400 mt-0.5">/ {waterTargetMl.toLocaleString()} mL</p></div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1"><WaterDropIllustration filled={waterMl > 0} /><WaterDropIllustration filled={false} /></div>
                  <button onClick={handleRemoveWater} disabled={waterLoading || waterMl === 0} className="w-9 h-9 rounded-full ring-1 ring-slate-200 text-slate-400 flex items-center justify-center disabled:opacity-30 hover:bg-slate-50"><Minus className="w-4 h-4" /></button>
                  <Link to="/water-tracker" className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 shadow-[0_3px_8px_rgba(16,185,129,0.2)]"><Plus className="w-4 h-4" /></Link>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-3"><div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, waterPct)}%` }} /></div><span className="text-[13px] font-extrabold text-emerald-500">{waterPct}%</span></div>
              <div className="flex items-center gap-2 mt-3"><CupSoda className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[11px] text-slate-400">{t("stay_hydrated")}</span></div>
            </TrackerCard>

            {/* Steps Card */}
            <TrackerCard icon={<Footprints className="w-4 h-4 text-emerald-500" />} title={t("steps")}>
              <div className="flex items-center justify-between"><div><p className="text-[28px] font-extrabold text-slate-900 tracking-[-0.02em]">{steps.toLocaleString()} <span className="text-lg font-bold text-slate-400">{t("steps")}</span></p><p className="text-[13px] text-slate-400 mt-0.5">/ {STEP_GOAL.toLocaleString()} {t("steps")}</p></div>
                <div className="relative w-16 h-16"><svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" /><circle cx="18" cy="18" r="15" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(steps/STEP_GOAL)*94.25} 94.25`} className="transition-all duration-500" /></svg><div className="absolute inset-0 flex items-center justify-center"><span className="text-[11px] font-extrabold text-emerald-500">{stepsPct}%</span></div></div>
              </div>
              <Link to="/step-counter" className="flex items-center justify-center gap-2 w-full mt-4 py-2.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-[13px] transition-colors shadow-[0_3px_8px_rgba(249,115,22,0.2)]"><Footprints className="w-4 h-4" /> {t("add_steps")}</Link>
              <div className="flex items-center gap-2 mt-3"><Star className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[11px] text-slate-400">{t("keep_moving")}</span></div>
            </TrackerCard>

            {/* Weight Card */}
            <TrackerCard icon={<Weight className="w-4 h-4 text-emerald-500" />} title={t("weight")}>
              {!hasWeightData && currentWeight == null ? (
                <div className="text-center py-3"><p className="text-[13px] text-slate-400 mb-3">{t("set_up_profile_cta")}</p><button onClick={() => navigate("/profile")} className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[13px]">{t("set_up_profile")}</button></div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div><p className="text-[28px] font-extrabold text-slate-900 tracking-[-0.02em]">{currentWeight != null ? `${currentWeight} ` : "— "}<span className="text-lg font-bold text-slate-400">kg</span></p>
                      {weightChange != null && weightChange !== 0 && <p className={cn("text-[13px] font-semibold flex items-center gap-0.5 mt-0.5", weightChange < 0 ? "text-emerald-500" : "text-red-500")}><ArrowUp className={cn("w-3 h-3", weightChange < 0 && "rotate-180")} /> {Math.abs(weightChange).toFixed(1)} kg</p>}</div>
                    <button onClick={() => setWeightDialogOpen(true)} className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-[13px] transition-colors shadow-[0_3px_8px_rgba(16,185,129,0.2)]">{t("update")}</button>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${weightProgress}%` }} /></div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-2"><span>{t("starting_cap")}: <span className="text-emerald-600 font-semibold">{startWeight ?? "—"} kg</span></span><span>{t("goal_cap")}: <span className="text-emerald-600 font-semibold">{goalWeight ?? "—"} kg</span></span></div>
                  <div className="flex items-center gap-2 mt-3"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[11px] text-slate-400">{t("progress_towards_goal")}</span></div>
                </>
              )}
            </TrackerCard>

            {/* BMI Card */}
            <TrackerCard icon={<Activity className="w-4 h-4 text-emerald-500" />} title={`${t("bmi")} (kg/m²)`}>
              <div className="flex items-center justify-between mb-4">
                <div><p className="text-[28px] font-extrabold text-slate-900 tracking-[-0.02em]">{bmi != null ? bmi.toFixed(1) : "—"}</p>{bmiStatus && <p className="text-[13px] text-slate-400 mt-0.5">{bmiStatus.label}</p>}</div>
                <button onClick={() => { setHeightInput(profile?.height_cm?.toString() ?? ""); setWeightInput(currentWeight?.toString() ?? ""); setBmiDialogOpen(true); }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200"><Pencil className="w-4 h-4" /></button>
              </div>
              <div className="relative"><div className="flex h-3 rounded-full overflow-hidden"><div className="flex-1 bg-slate-600 rounded-l-full" /><div className="flex-1 bg-emerald-500" /><div className="flex-1 bg-amber-400" /><div className="flex-1 bg-emerald-500" /><div className="flex-1 bg-red-500 rounded-r-full" /></div>
                {bmi != null && <div className="absolute top-full mt-0.5" style={{ left: `calc(${getBmiBarPosition(bmi)}% - 6px)` }}><div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-emerald-500" /></div>}</div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-3"><span className="text-center flex-1">{t("underweight")}</span><span className="text-center flex-1">{t("normal")}</span><span className="text-center flex-1 text-emerald-500 font-semibold">{t("overweight")}</span><span className="text-center flex-1">{t("obese")}</span></div>
            </TrackerCard>

            {/* Consistency Card */}
            <button onClick={() => navigate("/progress")} className="w-full rounded-2xl bg-[#F0FDF6] p-4 flex items-center justify-between hover:bg-[#E8FBF2] transition-colors text-left shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm"><BarChart3 className="w-5 h-5 text-emerald-500" /></div><div><p className="font-extrabold text-slate-800 text-[14px]">{t("consistency_key")}</p><p className="text-[12px] text-slate-500">{t("track_daily_results")}</p></div></div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </button>
          </div>
        )}
      </div>

      {/* ═══════ DIALOGS (unchanged business logic) ═══════ */}
      <Dialog open={weightDialogOpen} onOpenChange={setWeightDialogOpen}>
        <DialogContent className="rounded-2xl" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
          <DialogHeader><DialogTitle>{t("update_weight")}</DialogTitle><DialogDescription>{t("enter_your_current_weight")}</DialogDescription></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>{t("weight")} (kg)</Label><Input type="number" step="0.1" min="20" max="300" placeholder={t("weight_placeholder")} value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="mt-2 rounded-xl h-12" /></div>
            <button onClick={async () => { const kg = parseFloat(weightInput); if (!user || isNaN(kg) || kg <= 0) return; setSubmitting(true); try { const { error } = await supabase.from("body_measurements").upsert({ user_id: user.id, log_date: today, weight_kg: kg }, { onConflict: "user_id,log_date" }); if (error) throw error; await updateProfile({ current_weight_kg: kg }); await refreshMeasurements(); toast({ title: t("weight_updated_toast"), description: `${kg} ${t("kg_logged")}` }); setWeightDialogOpen(false); setWeightInput(""); } catch { toast({ title: t("failed_to_update"), variant: "destructive" }); } finally { setSubmitting(false); } }} disabled={submitting || !weightInput} className="w-full h-12 rounded-full font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors">{submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t("save")}</button>
          </div>
        </DialogContent>
      </Dialog>

      {bmiDialogOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end"><div className="absolute inset-0 bg-black/40" onClick={() => setBmiDialogOpen(false)} /><div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "90dvh", overflowY: "auto", paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}><div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div><h2 className="text-center text-lg font-bold text-slate-900 pb-5">{t("edit_bmi")}</h2>
          <div className="border-t border-b border-slate-100 py-5 px-6"><p className="text-sm text-slate-400 text-center mb-2">{t("height")}</p><div className="flex items-baseline justify-center gap-2"><input type="number" min="100" max="250" step="0.1" value={heightInput} onChange={(e) => setHeightInput(e.target.value)} className="text-5xl font-black text-slate-900 bg-transparent border-none outline-none text-center w-44" /><span className="text-2xl font-semibold text-slate-400">cm</span></div></div>
          <div className="border-b border-slate-100 py-5 px-6 mb-6"><p className="text-sm text-slate-400 text-center mb-2">{t("weight")}</p><div className="flex items-baseline justify-center gap-2"><input type="number" min="20" max="300" step="0.1" value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="text-5xl font-black text-slate-900 bg-transparent border-none outline-none text-center w-44" /><span className="text-2xl font-semibold text-slate-400">kg</span></div></div>
          <div className="flex gap-3 px-4 pb-2" style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}><button onClick={() => setBmiDialogOpen(false)} className="flex-1 py-3.5 rounded-full ring-1 ring-slate-200 text-slate-600 font-bold text-base hover:bg-slate-50">Cancel</button>
          <button onClick={async () => { const cm = parseFloat(heightInput); const kg = parseFloat(weightInput); if (!user || isNaN(cm) || cm <= 0) return; setSubmitting(true); try { await updateProfile({ height_cm: cm }); if (!isNaN(kg) && kg > 0) { await supabase.from("body_measurements").upsert({ user_id: user.id, log_date: today, weight_kg: kg }, { onConflict: "user_id,log_date" }); await updateProfile({ current_weight_kg: kg }); } await refreshMeasurements(); toast({ title: t("height_updated_toast"), description: t("bmi_recalculated") }); setBmiDialogOpen(false); } catch { toast({ title: t("failed_to_update"), variant: "destructive" }); } finally { setSubmitting(false); } }} disabled={submitting} className="flex-1 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-base">{submitting ? t("saving_progress") : t("save")}</button></div></div></div>
      )}

      {showActivityPrompt && <ActivityLevelPrompt t={t} onClose={() => { setShowActivityPrompt(false); sessionStorage.setItem("nutrio_activity_prompt_suppressed", "1"); }} />}
    </div>
  );
}
