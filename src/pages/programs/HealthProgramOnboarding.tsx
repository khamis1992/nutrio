import { useEffect, useState } from "react";
import { ArrowLeft, Check, Droplets, Dumbbell, Loader2, ShieldCheck, Utensils } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useActiveHealthProgram,
  useCompleteHealthProgramOnboarding,
  useHealthProgramBaseline,
  useSaveHealthProgramBaseline,
} from "@/hooks/useHealthPrograms";
import { cn } from "@/lib/utils";

const goals = [
  { code: "protein_consistency", label: "Keep protein more consistent" },
  { code: "hydration_routine", label: "Build a hydration routine" },
  { code: "digestive_comfort", label: "Support digestive comfort" },
  { code: "strength_habit", label: "Maintain a strength habit" },
] as const;

function ChoiceScale({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-black">{label}</span>
        <span className="text-xs font-bold text-[#94A3B8]">{value}/5</span>
      </div>
      <div className="grid grid-cols-5 overflow-hidden rounded-lg border border-[#E5EAF1]">
        {[1, 2, 3, 4, 5].map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)} className={cn("min-h-11 border-r border-[#E5EAF1] text-sm font-black last:border-r-0", option === value ? "bg-[#020617] text-white" : "bg-white text-[#64748B]")}>{option}</button>
        ))}
      </div>
    </div>
  );
}

export default function HealthProgramOnboarding() {
  const navigate = useNavigate();
  const { data: enrollment, isLoading } = useActiveHealthProgram();
  const { data: baseline } = useHealthProgramBaseline(enrollment?.id);
  const saveBaseline = useSaveHealthProgramBaseline();
  const completeOnboarding = useCompleteHealthProgramOnboarding();
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [appetite, setAppetite] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [hydration, setHydration] = useState(3);
  const [strength, setStrength] = useState<"none" | "beginner" | "regular">("beginner");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !enrollment) navigate("/programs", { replace: true });
    if (enrollment && enrollment.status !== "onboarding") navigate("/programs/current", { replace: true });
  }, [enrollment, isLoading, navigate]);

  useEffect(() => {
    if (!baseline) return;
    const eatingPattern = baseline.eating_pattern as { meals_per_day?: number };
    setMealsPerDay(eatingPattern.meals_per_day ?? 3);
    setAppetite(baseline.appetite ?? 3);
    setEnergy(baseline.energy ?? 3);
    setHydration(baseline.hydration_confidence ?? 3);
    setStrength((baseline.strength_experience as "none" | "beginner" | "regular") ?? "beginner");
    setSelectedGoals(baseline.goals);
  }, [baseline]);

  if (isLoading || !enrollment) return <div className="grid min-h-full place-items-center bg-[#F6F8FB]"><Loader2 className="h-7 w-7 animate-spin text-[#7C83F6]" /></div>;

  const toggleGoal = (code: string) => setSelectedGoals((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  const submit = async () => {
    if (selectedGoals.length === 0) {
      toast.error("Choose at least one support goal");
      return;
    }
    try {
      await saveBaseline.mutateAsync({ enrollmentId: enrollment.id, mealsPerDay, appetite, energy, hydrationConfidence: hydration, strengthExperience: strength, goals: selectedGoals });
      await completeOnboarding.mutateAsync(enrollment.id);
      toast.success("Your private baseline is saved");
      navigate("/programs/current", { replace: true });
    } catch (error) {
      console.error("Could not complete health program onboarding:", error);
      toast.error("Could not finish setup");
    }
  };

  return (
    <main className="min-h-full bg-[#F6F8FB] pb-[calc(92px+env(safe-area-inset-bottom,0px))] text-[#020617]">
      <header className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-white/95 px-4 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))] backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button type="button" onClick={() => navigate("/programs")} className="grid h-11 w-11 place-items-center rounded-full border border-[#E5EAF1] bg-white" aria-label="Back to programs"><ArrowLeft className="h-5 w-5" /></button>
          <div><p className="text-[11px] font-extrabold uppercase text-[#7C83F6]">Private setup</p><h1 className="text-lg font-black">Your starting point</h1></div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        <section className="rounded-lg border border-[#DDDFFF] bg-white p-4">
          <div className="flex gap-3"><ShieldCheck className="h-6 w-6 shrink-0 text-[#7C83F6]" /><div><h2 className="font-black">Only you can read these answers</h2><p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">They personalize nutrition and activity support. They are not shared with restaurants and are not used to diagnose or change medication.</p></div></div>
        </section>

        <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#FFF4F6] text-[#FB6B7A]"><Utensils className="h-5 w-5" /></span><div><p className="text-[11px] font-extrabold uppercase text-[#FB6B7A]">Eating routine</p><h2 className="font-black">How does today usually feel?</h2></div></div>
          <div className="mt-5 space-y-5">
            <div><p className="mb-2 text-sm font-black">Meals you usually manage</p><div className="grid grid-cols-4 gap-2">{[1, 2, 3, 4].map((count) => <button key={count} type="button" onClick={() => setMealsPerDay(count)} className={cn("min-h-11 rounded-lg border text-sm font-black", mealsPerDay === count ? "border-[#FB6B7A] bg-[#FFF4F6] text-[#D64D62]" : "border-[#E5EAF1] bg-white")}>{count}{count === 4 ? "+" : ""}</button>)}</div></div>
            <ChoiceScale label="Appetite" value={appetite} onChange={setAppetite} />
            <ChoiceScale label="Energy" value={energy} onChange={setEnergy} />
          </div>
        </section>

        <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#EFF9FF] text-[#38BDF8]"><Droplets className="h-5 w-5" /></span><div><p className="text-[11px] font-extrabold uppercase text-[#38BDF8]">Hydration</p><h2 className="font-black">Confidence drinking enough</h2></div></div>
          <div className="mt-5"><ChoiceScale label="From difficult to confident" value={hydration} onChange={setHydration} /></div>
        </section>

        <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[#F3F3FF] text-[#7C83F6]"><Dumbbell className="h-5 w-5" /></span><div><p className="text-[11px] font-extrabold uppercase text-[#7C83F6]">Strength</p><h2 className="font-black">Your current experience</h2></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2">{(["none", "beginner", "regular"] as const).map((level) => <button key={level} type="button" onClick={() => setStrength(level)} className={cn("min-h-12 rounded-lg border px-2 text-xs font-black capitalize", strength === level ? "border-[#7C83F6] bg-[#F3F3FF] text-[#5B63DA]" : "border-[#E5EAF1]")}>{level}</button>)}</div>
        </section>

        <section className="rounded-lg border border-[#E5EAF1] bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase text-[#22C7A1]">Your focus</p><h2 className="mt-1 font-black">Choose what matters now</h2>
          <div className="mt-3 space-y-2">{goals.map((goal) => { const selected = selectedGoals.includes(goal.code); return <button key={goal.code} type="button" onClick={() => toggleGoal(goal.code)} className={cn("flex min-h-12 w-full items-center justify-between rounded-lg border px-3 text-left text-sm font-bold", selected ? "border-[#22C7A1] bg-[#E9FBF6]" : "border-[#E5EAF1]")}><span>{goal.label}</span><span className={cn("grid h-6 w-6 place-items-center rounded-full border", selected ? "border-[#22C7A1] bg-[#22C7A1] text-white" : "border-[#CBD5E1]")}>{selected && <Check className="h-4 w-4" />}</span></button>; })}</div>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5EAF1] bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3">
        <button type="button" disabled={saveBaseline.isPending || completeOnboarding.isPending} onClick={() => void submit()} className="mx-auto flex min-h-14 w-full max-w-2xl items-center justify-center gap-2 rounded-lg bg-[#020617] font-black text-white disabled:bg-[#CBD5E1]">{saveBaseline.isPending || completeOnboarding.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}Save and begin</button>
      </div>
    </main>
  );
}
