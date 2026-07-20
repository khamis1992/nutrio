import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Save, ShieldCheck, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { useCoachPerformanceDirective } from "@/hooks/useCoachPerformanceDirective";
import { useDailyPerformanceDecision } from "@/hooks/useDailyPerformanceDecision";
import type { CarbFocus } from "@/lib/daily-performance";
import { cn } from "@/lib/utils";

interface Props { clientId: string }

const futureDateTime = () => {
  const value = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 16);
};

const numberOrNull = (value: string) => value === "" ? null : Number(value);

export function CoachPerformanceDirectivePanel({ clientId }: Props) {
  const directiveQuery = useCoachPerformanceDirective(clientId);
  const decisionQuery = useDailyPerformanceDecision(clientId);
  const [message, setMessage] = useState("");
  const [calorieMin, setCalorieMin] = useState("");
  const [calorieMax, setCalorieMax] = useState("");
  const [proteinMin, setProteinMin] = useState("");
  const [carbsTarget, setCarbsTarget] = useState("");
  const [hydrationMin, setHydrationMin] = useState("");
  const [intensityCap, setIntensityCap] = useState("");
  const [carbFocus, setCarbFocus] = useState<CarbFocus>("balanced");
  const [validUntil, setValidUntil] = useState(futureDateTime);
  const [excludedMealTypes, setExcludedMealTypes] = useState<string[]>([]);

  useEffect(() => {
    const directive = directiveQuery.data;
    if (!directive) return;
    setMessage(directive.message);
    setCalorieMin(directive.calorie_min?.toString() ?? "");
    setCalorieMax(directive.calorie_max?.toString() ?? "");
    setProteinMin(directive.protein_min_g?.toString() ?? "");
    setCarbsTarget(directive.carbs_target_g?.toString() ?? "");
    setHydrationMin(directive.hydration_min_ml?.toString() ?? "");
    setIntensityCap(directive.workout_intensity_cap?.toString() ?? "");
    setCarbFocus(directive.carb_focus);
    setValidUntil(new Date(directive.valid_until).toISOString().slice(0, 16));
    setExcludedMealTypes(directive.excluded_meal_types);
  }, [directiveQuery.data]);

  const toggleMealType = (mealType: string) => setExcludedMealTypes((current) =>
    current.includes(mealType) ? current.filter((type) => type !== mealType) : [...current, mealType],
  );

  const save = async () => {
    if (message.trim().length < 2) {
      toast.error("Add a clear direction for the client");
      return;
    }
    const validUntilDate = new Date(validUntil);
    if (!validUntil || Number.isNaN(validUntilDate.getTime()) || validUntilDate <= new Date()) {
      toast.error("Choose a future expiry time");
      return;
    }
    if (calorieMin && calorieMax && Number(calorieMin) > Number(calorieMax)) {
      toast.error("Minimum calories cannot exceed maximum calories");
      return;
    }
    try {
      await directiveQuery.save.mutateAsync({
        id: directiveQuery.data?.id,
        client_id: clientId,
        message: message.trim(),
        calorie_min: numberOrNull(calorieMin),
        calorie_max: numberOrNull(calorieMax),
        protein_min_g: numberOrNull(proteinMin),
        carbs_target_g: numberOrNull(carbsTarget),
        hydration_min_ml: numberOrNull(hydrationMin),
        workout_intensity_cap: numberOrNull(intensityCap),
        carb_focus: carbFocus,
        excluded_meal_types: excludedMealTypes,
        priority: 50,
        valid_from: directiveQuery.data?.valid_from ?? new Date().toISOString(),
        valid_until: validUntilDate.toISOString(),
      });
      toast.success("Performance direction applied to today's decision");
      decisionQuery.refetch();
    } catch (error) {
      console.error("Error saving performance directive:", error);
      toast.error(error instanceof Error ? error.message : "Could not save direction");
    }
  };

  const archive = async () => {
    if (!directiveQuery.data) return;
    try {
      await directiveQuery.archive.mutateAsync(directiveQuery.data.id);
      setMessage("");
      toast.success("Performance direction archived");
      decisionQuery.refetch();
    } catch (error) {
      console.error("Error archiving performance directive:", error);
      toast.error(error instanceof Error ? error.message : "Could not archive direction");
    }
  };

  if (directiveQuery.isLoading) {
    return <div className="flex min-h-32 items-center justify-center rounded-[24px] bg-white"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>;
  }

  return (
    <section className="client-card client-card--teal rounded-[24px] bg-white p-5" data-testid="coach-performance-directive">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-teal-600" />
            <h2 className="text-[15px] font-extrabold text-slate-950">Daily performance direction</h2>
          </div>
          <p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">One instruction that changes today's workout load and meal recommendation.</p>
        </div>
        {decisionQuery.data && (
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-black uppercase text-teal-700 ring-1 ring-teal-200">
            {decisionQuery.data.mode} · {decisionQuery.data.confidence_score}%
          </span>
        )}
      </div>

      {directiveQuery.error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700">
          <AlertCircle className="h-4 w-4" /> {directiveQuery.error.message}
        </div>
      )}

      <label className="mt-4 block">
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Direction shown to client</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-2xl border border-slate-200 p-3 text-[12px] font-semibold text-slate-900 outline-none focus:border-teal-500" placeholder="Example: Keep the session moderate and prioritize protein after training." />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LimitInput label="Calories min" value={calorieMin} min={800} max={6000} onChange={setCalorieMin} />
        <LimitInput label="Calories max" value={calorieMax} min={800} max={6000} onChange={setCalorieMax} />
        <LimitInput label="Protein min (g)" value={proteinMin} min={0} max={400} onChange={setProteinMin} />
        <LimitInput label="Carbs target (g)" value={carbsTarget} min={0} max={800} onChange={setCarbsTarget} />
        <LimitInput label="Hydration (ml)" value={hydrationMin} min={500} max={8000} onChange={setHydrationMin} />
        <LimitInput label="Intensity cap (%)" value={intensityCap} min={30} max={100} onChange={setIntensityCap} />
        <label className="col-span-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
          <span className="block text-[9px] font-black uppercase text-slate-400">Carb timing</span>
          <select value={carbFocus} onChange={(event) => setCarbFocus(event.target.value as CarbFocus)} className="mt-1 min-h-9 w-full bg-transparent text-[11px] font-extrabold text-slate-900 outline-none">
            <option value="none">No focus</option><option value="balanced">Balanced</option><option value="pre_workout">Pre-workout</option><option value="post_workout">Post-workout</option>
          </select>
        </label>
      </div>

      <div className="mt-3">
        <p className="text-[9px] font-black uppercase text-slate-400">Exclude meal types</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {["breakfast", "lunch", "dinner", "snack"].map((type) => (
            <button key={type} type="button" onClick={() => toggleMealType(type)} className={cn("min-h-11 rounded-xl px-3 text-[11px] font-extrabold capitalize ring-1", excludedMealTypes.includes(type) ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-slate-50 text-slate-600 ring-slate-200")}>{type}</button>
          ))}
        </div>
      </div>

      <label className="mt-3 block">
        <span className="text-[9px] font-black uppercase text-slate-400">Valid until</span>
        <input type="datetime-local" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-200 px-3 text-[11px] font-bold outline-none focus:border-teal-500" />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={directiveQuery.save.isPending} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 text-[12px] font-black text-white disabled:opacity-60">
          {directiveQuery.save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Apply to decision
        </button>
        {directiveQuery.data && <button type="button" onClick={archive} disabled={directiveQuery.archive.isPending} className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 text-[12px] font-black text-rose-700 ring-1 ring-rose-200"><Trash2 className="h-4 w-4" /> Archive</button>}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[9px] font-bold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Medical and allergy safety always overrides coach limits.</p>
    </section>
  );
}

function LimitInput({ label, value, min, max, onChange }: { label: string; value: string; min: number; max: number; onChange: (value: string) => void }) {
  return <label className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200"><span className="block text-[9px] font-black uppercase text-slate-400">{label}</span><input type="number" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="mt-1 h-8 w-full bg-transparent text-[12px] font-extrabold text-slate-900 outline-none" placeholder="Default" /></label>;
}
