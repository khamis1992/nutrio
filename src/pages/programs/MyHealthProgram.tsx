import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, ChevronRight, Circle, Download, Droplets, Dumbbell, HeartPulse, Loader2, Pause, Play, ShieldAlert, Stethoscope, Trash2, Utensils, Waves } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  useAcknowledgeHealthProgramSafetyEvent,
  useActiveHealthProgram,
  useCompleteHealthProgramTask,
  useDeleteHealthProgramData,
  useHealthProgramHistory,
  useHealthProgramSafetyEvents,
  useHealthProgramTasks,
  useSetHealthProgramStatus,
  useSubmitHealthProgramCheckin,
  useTodayHealthProgramCheckin,
  type HealthProgramCheckinInput,
} from "@/hooks/useHealthPrograms";
import { downloadHealthProgramReport } from "@/lib/health-program-report";

const today = new Date().toISOString().slice(0, 10);

const TASKS = [
  { code: "meal_plan", type: "meal", title: "Plan today's meals", subtitle: "Choose smaller, nutrient-dense meals", icon: Utensils, color: "#FB6B7A" },
  { code: "hydration", type: "hydration", title: "Keep water visible", subtitle: "Use your personal hydration target", icon: Droplets, color: "#38BDF8" },
  { code: "nutrition_focus", type: "nutrition", title: "Prioritize nutrition", subtitle: "Protein first, fiber as tolerated", icon: Waves, color: "#7C83F6" },
  { code: "strength", type: "strength", title: "Strength routine", subtitle: "Use a comfortable, controlled effort", icon: Dumbbell, color: "#22C7A1" },
] as const;

const initialCheckin: Omit<HealthProgramCheckinInput, "enrollmentId"> = {
  appetite: 3,
  energy: 3,
  hydrationAbility: 3,
  nausea: 0,
  vomiting: 0,
  constipation: 0,
  diarrhea: 0,
  reflux: 0,
  symptomsDisruptFood: false,
  symptomsPersistent: false,
  severePersistentAbdominalPain: false,
  unableToKeepFluids: false,
  breathingOrSwallowingDifficulty: false,
  faceOrTongueSwelling: false,
  fainting: false,
  suddenVisionChange: false,
};

function Scale({ label, value, onChange, zero = false }: { label: string; value: number; onChange: (value: number) => void; zero?: boolean }) {
  const values = zero ? [0, 1, 2, 3, 4] : [1, 2, 3, 4, 5];
  return (
    <div>
      <div className="mb-2 flex items-center justify-between"><span className="text-sm font-black">{label}</span><span className="text-xs font-bold text-[#64748B]">{zero ? ["None", "Mild", "Moderate", "Strong", "Severe"][value] : `${value}/5`}</span></div>
      <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-[#E5EAF1] bg-white">
        {values.map((option) => <button key={option} type="button" onClick={() => onChange(option)} className={cn("min-h-11 border-r border-[#E5EAF1] text-sm font-black last:border-r-0", value === option ? "bg-[#020617] text-white" : "text-[#64748B]")}>{option}</button>)}
      </div>
    </div>
  );
}

export default function MyHealthProgram() {
  const navigate = useNavigate();
  const { data: enrollment, isLoading } = useActiveHealthProgram();
  const { data: tasks = [] } = useHealthProgramTasks(enrollment?.id, today);
  const { data: checkin } = useTodayHealthProgramCheckin(enrollment?.id, today);
  const { data: safetyEvents = [] } = useHealthProgramSafetyEvents(enrollment?.id);
  const { data: history } = useHealthProgramHistory(enrollment?.id);
  const completeTask = useCompleteHealthProgramTask();
  const submitCheckin = useSubmitHealthProgramCheckin();
  const setStatus = useSetHealthProgramStatus();
  const acknowledgeSafety = useAcknowledgeHealthProgramSafetyEvent();
  const deleteProgramData = useDeleteHealthProgramData();
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [form, setForm] = useState(initialCheckin);

  useEffect(() => {
    if (!isLoading && !enrollment) navigate("/programs", { replace: true });
    if (enrollment?.status === "onboarding") navigate("/programs/onboarding", { replace: true });
  }, [enrollment, isLoading, navigate]);

  useEffect(() => {
    if (!checkin) return;
    setForm({
      appetite: checkin.appetite ?? 3,
      energy: checkin.energy ?? 3,
      hydrationAbility: checkin.hydration_ability ?? 3,
      nausea: checkin.nausea,
      vomiting: checkin.vomiting,
      constipation: checkin.constipation,
      diarrhea: checkin.diarrhea,
      reflux: checkin.reflux,
      symptomsDisruptFood: checkin.symptoms_disrupt_food,
      symptomsPersistent: checkin.symptoms_persistent,
      severePersistentAbdominalPain: checkin.severe_persistent_abdominal_pain,
      unableToKeepFluids: checkin.unable_to_keep_fluids,
      breathingOrSwallowingDifficulty: checkin.breathing_or_swallowing_difficulty,
      faceOrTongueSwelling: checkin.face_or_tongue_swelling,
      fainting: checkin.fainting,
      suddenVisionChange: checkin.sudden_vision_change,
    });
  }, [checkin]);

  const completedCodes = useMemo(() => new Set(tasks.map((task) => task.task_code)), [tasks]);
  const progress = useMemo(() => {
    if (!enrollment) return { week: 1, percent: 0, days: 1 };
    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(`${enrollment.start_date}T00:00:00`).getTime()) / 86_400_000));
    const total = Math.max(1, Math.floor((new Date(`${enrollment.target_end_date}T00:00:00`).getTime() - new Date(`${enrollment.start_date}T00:00:00`).getTime()) / 86_400_000) + 1);
    return { week: Math.min(enrollment.health_programs.duration_weeks, Math.floor(elapsed / 7) + 1), percent: Math.min(100, Math.round(((elapsed + 1) / total) * 100)), days: elapsed + 1 };
  }, [enrollment]);

  if (isLoading || !enrollment) return <div className="grid min-h-full place-items-center bg-[#F6F8FB]"><Loader2 className="h-7 w-7 animate-spin text-[#7C83F6]" /></div>;

  const safetyEvent = safetyEvents[0];
  const isPaused = enrollment.status === "paused";

  const toggleTask = async (code: string, type: string) => {
    try {
      await completeTask.mutateAsync({ enrollmentId: enrollment.id, taskCode: code, taskType: type, completed: !completedCodes.has(code) });
    } catch (error) {
      console.error("Could not update program task:", error);
      toast.error("Could not update this task");
    }
  };

  const saveCheckin = async () => {
    try {
      const result = await submitCheckin.mutateAsync({ enrollmentId: enrollment.id, ...form });
      setCheckinOpen(false);
      if (result.guidance_level === "urgent") toast.error("Please review the urgent safety message now");
      else if (result.guidance_level === "contact_clinician") toast.warning("Please contact your prescribing clinician");
      else toast.success("Today's check-in is saved");
    } catch (error) {
      console.error("Could not save program check-in:", error);
      toast.error("Could not save your check-in");
    }
  };

  return (
    <main className="min-h-full bg-[#F6F8FB] pb-8 text-[#020617]">
      <header className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-white/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={() => navigate("/programs")} className="grid h-11 w-11 place-items-center rounded-full border border-[#E5EAF1] bg-white" aria-label="Back to programs"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase text-[#22C7A1]">Week {progress.week}</p><h1 className="truncate text-lg font-black">My Program</h1></div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-lg bg-[#020617] text-white shadow-[0_14px_34px_rgba(2,6,23,0.18)]">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#7C83F6]"><HeartPulse className="h-6 w-6" /></span>
              <span className={cn("rounded-full px-3 py-1.5 text-xs font-extrabold", isPaused ? "bg-[#FFF1F3] text-[#C74459]" : "bg-[#E9FBF6] text-[#08765F]")}>{isPaused ? "Paused" : "Active"}</span>
            </div>
            <h2 className="mt-4 text-xl font-black leading-7">{enrollment.health_programs.name}</h2>
            <p className="mt-1 text-sm font-semibold text-white/65">Day {progress.days} · Week {progress.week} of {enrollment.health_programs.duration_weeks}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#22C7A1]" style={{ width: `${progress.percent}%` }} /></div>
          </div>
          <div className="border-t border-white/10 px-5 py-3 text-xs font-semibold leading-5 text-white/60">Nutrition and activity support only. Medication and dose decisions stay with your clinician.</div>
        </section>

        {safetyEvent && (
          <section className={cn("rounded-lg border p-4", safetyEvent.severity === "urgent" ? "border-[#FB6B7A] bg-[#FFF1F3]" : "border-[#F5C98A] bg-[#FFF8ED]")} role="alert">
            <div className="flex items-start gap-3"><ShieldAlert className={cn("mt-0.5 h-6 w-6 shrink-0", safetyEvent.severity === "urgent" ? "text-[#FB6B7A]" : "text-[#F97316]")} /><div className="min-w-0 flex-1"><h2 className="font-black">{safetyEvent.severity === "urgent" ? "Seek urgent medical care" : "Contact your prescribing clinician"}</h2><p className="mt-1 text-sm font-semibold leading-6 text-[#5D4750]">{safetyEvent.severity === "urgent" ? "Your answers include a warning sign that needs medical assessment. Nutrio cannot diagnose this or advise a medication change." : "Your symptoms are persistent, strong, or affecting food or fluids. Contact your prescribing clinician before changing medication."}</p><button type="button" onClick={() => void acknowledgeSafety.mutateAsync({ eventId: safetyEvent.id, enrollmentId: enrollment.id })} className="mt-3 min-h-11 rounded-full bg-[#020617] px-4 text-sm font-black text-white">I understand</button></div></div>
          </section>
        )}

        {isPaused ? (
          <section className="rounded-lg border border-[#DDDFFF] bg-white p-5 text-center"><Pause className="mx-auto h-9 w-9 text-[#7C83F6]" /><h2 className="mt-3 text-lg font-black">Your program is paused</h2><p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">Your history is safe. Resume when you are ready to continue daily tasks.</p><button type="button" onClick={() => void setStatus.mutateAsync({ enrollmentId: enrollment.id, status: "active" })} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#7C83F6] px-5 font-black text-white"><Play className="h-5 w-5" />Resume program</button></section>
        ) : (
          <>
            <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
              <div className="flex items-end justify-between gap-3"><div><p className="text-[11px] font-extrabold uppercase text-[#22C7A1]">Today</p><h2 className="mt-1 text-lg font-black">Four calm priorities</h2></div><span className="text-sm font-black text-[#7C83F6]">{completedCodes.size}/{TASKS.length + 1}</span></div>
              <div className="mt-3 divide-y divide-[#E5EAF1]">
                {TASKS.map((task) => { const done = completedCodes.has(task.code); const Icon = task.icon; return <button key={task.code} type="button" onClick={() => void toggleTask(task.code, task.type)} className="flex min-h-[72px] w-full items-center gap-3 py-2 text-left active:bg-[#F6F8FB]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${task.color}16`, color: task.color }}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className={cn("block text-sm font-black", done && "text-[#64748B] line-through")}>{task.title}</span><span className="mt-0.5 block text-xs font-semibold text-[#94A3B8]">{task.subtitle}</span></span>{done ? <CheckCircle2 className="h-6 w-6 shrink-0 text-[#22C7A1]" /> : <Circle className="h-6 w-6 shrink-0 text-[#CBD5E1]" />}</button>; })}
                <button type="button" onClick={() => setCheckinOpen(true)} className="flex min-h-[72px] w-full items-center gap-3 py-2 text-left active:bg-[#F6F8FB]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FFF8ED] text-[#F97316]"><HeartPulse className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black">Daily check-in</span><span className="mt-0.5 block text-xs font-semibold text-[#94A3B8]">Appetite, energy, hydration, and comfort</span></span>{checkin ? <CheckCircle2 className="h-6 w-6 text-[#22C7A1]" /> : <ChevronRight className="h-5 w-5 text-[#94A3B8]" />}</button>
              </div>
            </section>

            <button type="button" onClick={() => navigate("/programs/current/meals")} className="flex min-h-14 w-full items-center justify-between rounded-lg bg-[#22C7A1] px-4 font-black text-white shadow-[0_10px_24px_rgba(34,199,161,0.2)]"><span className="flex items-center gap-2"><Utensils className="h-5 w-5" />Choose your next meal</span><ChevronRight className="h-5 w-5" /></button>
          </>
        )}

        <section className="rounded-lg border border-[#BFEFE3] bg-[#E9FBF6] p-4"><div className="flex gap-3"><Stethoscope className="mt-0.5 h-5 w-5 shrink-0 text-[#0A8F73]" /><div><h2 className="text-sm font-black">Keep your clinician in the loop</h2><p className="mt-1 text-xs font-semibold leading-5 text-[#47645D]">Share your progress and symptoms with the professional who prescribed your medicine. Do not change your medication through Nutrio.</p></div></div></section>

        <button type="button" disabled={!history} onClick={() => history && downloadHealthProgramReport({ enrollment, checkins: history.checkins, tasks: history.tasks })} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#E5EAF1] bg-white text-sm font-black disabled:text-[#94A3B8]"><Download className="h-4 w-4 text-[#38BDF8]" />Download my progress report</button>

        <section className="flex gap-2">
          {!isPaused && <button type="button" onClick={() => void setStatus.mutateAsync({ enrollmentId: enrollment.id, status: "paused" })} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-[#E5EAF1] bg-white text-sm font-black"><Pause className="h-4 w-4" />Pause</button>}
          <AlertDialog><AlertDialogTrigger asChild><button type="button" className="min-h-12 flex-1 rounded-lg border border-[#FED7DC] bg-white px-3 text-sm font-black text-[#D64D62]">Leave program</button></AlertDialogTrigger><AlertDialogContent className="max-w-[calc(100%-32px)] rounded-lg"><AlertDialogHeader><AlertDialogTitle>Leave this program?</AlertDialogTitle><AlertDialogDescription>Your history remains available, but daily program processing and tasks stop. This does not change your medication or meal subscription.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Stay enrolled</AlertDialogCancel><AlertDialogAction onClick={() => void setStatus.mutateAsync({ enrollmentId: enrollment.id, status: "withdrawn" })} className="bg-[#FB6B7A] text-white">Leave program</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </section>
        <AlertDialog><AlertDialogTrigger asChild><button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 text-xs font-black text-[#D64D62]"><Trash2 className="h-4 w-4" />Delete all program data</button></AlertDialogTrigger><AlertDialogContent className="max-w-[calc(100%-32px)] rounded-lg"><AlertDialogHeader><AlertDialogTitle>Delete all program data?</AlertDialogTitle><AlertDialogDescription>This permanently deletes this enrollment, check-ins, tasks, consent events, and safety records. Your medication list, Nutrio account, and meal subscription are not changed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep my data</AlertDialogCancel><AlertDialogAction onClick={() => void deleteProgramData.mutateAsync(enrollment.id).then(() => navigate("/programs", { replace: true }))} className="bg-[#FB6B7A] text-white">Delete permanently</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>

      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-24px)] max-w-md overflow-y-auto rounded-lg p-0">
          <DialogHeader className="border-b border-[#E5EAF1] px-4 pb-3 pt-5 text-left"><DialogTitle>How are you today?</DialogTitle><DialogDescription>This is private self-tracking, not a diagnosis.</DialogDescription></DialogHeader>
          <div className="space-y-5 px-4 py-4">
            <Scale label="Appetite" value={form.appetite} onChange={(value) => setForm((current) => ({ ...current, appetite: value }))} />
            <Scale label="Energy" value={form.energy} onChange={(value) => setForm((current) => ({ ...current, energy: value }))} />
            <Scale label="Ability to drink fluids" value={form.hydrationAbility} onChange={(value) => setForm((current) => ({ ...current, hydrationAbility: value }))} />
            <div className="border-t border-[#E5EAF1] pt-4"><p className="mb-4 text-[11px] font-extrabold uppercase text-[#64748B]">Digestive comfort</p><div className="space-y-5"><Scale zero label="Nausea" value={form.nausea} onChange={(value) => setForm((current) => ({ ...current, nausea: value }))} /><Scale zero label="Vomiting" value={form.vomiting} onChange={(value) => setForm((current) => ({ ...current, vomiting: value }))} /><Scale zero label="Constipation" value={form.constipation} onChange={(value) => setForm((current) => ({ ...current, constipation: value }))} /><Scale zero label="Diarrhea" value={form.diarrhea} onChange={(value) => setForm((current) => ({ ...current, diarrhea: value }))} /><Scale zero label="Reflux" value={form.reflux} onChange={(value) => setForm((current) => ({ ...current, reflux: value }))} /></div></div>
            <div className="space-y-3 border-t border-[#E5EAF1] pt-4"><p className="text-[11px] font-extrabold uppercase text-[#F97316]">Contact your clinician</p>{[["symptomsPersistent", "Symptoms are continuing or not improving"], ["symptomsDisruptFood", "Symptoms make eating or drinking difficult"]].map(([key, label]) => <label key={key} className="flex items-start gap-3 rounded-lg bg-[#FFF8ED] p-3"><Checkbox checked={Boolean(form[key as keyof typeof form])} onCheckedChange={(value) => setForm((current) => ({ ...current, [key]: value === true }))} className="mt-0.5" /><span className="text-sm font-bold leading-5">{label}</span></label>)}</div>
            <div className="space-y-3 rounded-lg border border-[#FED7DC] bg-[#FFF1F3] p-3"><div className="flex gap-2"><AlertTriangle className="h-5 w-5 shrink-0 text-[#FB6B7A]" /><div><p className="text-sm font-black">Urgent warning signs</p><p className="text-xs font-semibold leading-5 text-[#7A4B55]">Select only what you are experiencing now. Nutrio will direct you to medical care, not diagnose it.</p></div></div>{[["severePersistentAbdominalPain", "Severe stomach pain that does not go away"], ["unableToKeepFluids", "I cannot keep fluids down"], ["breathingOrSwallowingDifficulty", "Difficulty breathing or swallowing"], ["faceOrTongueSwelling", "Swelling of the face, lips, tongue, or throat"], ["fainting", "Fainting or loss of consciousness"], ["suddenVisionChange", "Sudden change or loss of vision"]].map(([key, label]) => <label key={key} className="flex items-start gap-3 rounded-lg bg-white p-3"><Checkbox checked={Boolean(form[key as keyof typeof form])} onCheckedChange={(value) => setForm((current) => ({ ...current, [key]: value === true }))} className="mt-0.5" /><span className="text-sm font-bold leading-5">{label}</span></label>)}</div>
          </div>
          <div className="sticky bottom-0 border-t border-[#E5EAF1] bg-white p-4"><button type="button" disabled={submitCheckin.isPending} onClick={() => void saveCheckin()} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-[#020617] font-black text-white">{submitCheckin.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Save check-in</button></div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
