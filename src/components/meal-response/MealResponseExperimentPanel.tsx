import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  FlaskConical,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { MealResponseExperimentSummary } from "@/lib/meal-response";
import {
  cancelMealResponseExperiment,
  createMealResponseExperiment,
  getMealResponseExperiment,
  getMealResponseExperimentCatalog,
  pauseMealResponseExperiment,
  startMealResponseExperiment,
  type MealResponseExperimentMeal,
} from "@/lib/meal-response-experiments";
import { cn } from "@/lib/utils";

interface Props {
  experiments: MealResponseExperimentSummary[];
  glucoseConnected: boolean;
  isRTL: boolean;
  onChanged: () => Promise<unknown> | void;
}

const text = {
  en: {
    eyebrow: "CONTROLLED COMPARISON",
    title: "Compare two meals",
    body: "Alternate two similar-calorie meals on separate days. Nutrio links each logged meal automatically and waits for enough eligible repeats.",
    chooseFirst: "Choose meal A",
    chooseSecond: "Choose meal B",
    calories: "kcal",
    comparable: "Calories are comparable",
    notComparable: "Choose meals within 20% calories",
    start: "Start 8-meal comparison",
    needsGlucose: "Connect a glucose source before starting this comparison.",
    active: "Comparison in progress",
    paused: "Comparison paused",
    completed: "Comparison complete",
    next: "Next meal",
    automatic: "Order or log this meal normally. It will be counted automatically after you confirm eating it.",
    repeats: "eligible repeats",
    association: "Personal association supported",
    descriptive: "Results remain descriptive until both meals have enough eligible days.",
    pause: "Pause",
    resume: "Resume",
    cancel: "Cancel",
    retry: "Try again",
  },
  ar: {
    eyebrow: "مقارنة مضبوطة",
    title: "قارن بين وجبتين",
    body: "تناول وجبتين متقاربتين في السعرات بالتناوب وفي أيام منفصلة. يربط Nutrio الوجبة المسجلة تلقائيًا وينتظر تكرارات موثوقة كافية.",
    chooseFirst: "اختر الوجبة أ",
    chooseSecond: "اختر الوجبة ب",
    calories: "سعرة",
    comparable: "السعرات متقاربة ومناسبة للمقارنة",
    notComparable: "اختر وجبتين بفارق سعرات لا يتجاوز 20%",
    start: "ابدأ مقارنة من 8 وجبات",
    needsGlucose: "اربط مصدرًا لقياس الجلوكوز قبل بدء هذه المقارنة.",
    active: "المقارنة قيد التنفيذ",
    paused: "المقارنة متوقفة مؤقتًا",
    completed: "اكتملت المقارنة",
    next: "الوجبة التالية",
    automatic: "اطلب أو سجّل هذه الوجبة كالمعتاد. سيحتسبها النظام تلقائيًا بعد تأكيد تناولها.",
    repeats: "تكرارات مؤهلة",
    association: "توجد علاقة شخصية مدعومة بالتكرار",
    descriptive: "تبقى النتائج وصفية حتى تتوفر أيام وتكرارات مؤهلة كافية للوجبتين.",
    pause: "إيقاف مؤقت",
    resume: "متابعة",
    cancel: "إلغاء",
    retry: "إعادة المحاولة",
  },
} as const;

export function MealResponseExperimentPanel({ experiments, glucoseConnected, isRTL, onChanged }: Props) {
  const language = isRTL ? "ar" : "en";
  const copy = text[language];
  const queryClient = useQueryClient();
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [selecting, setSelecting] = useState<"first" | "second" | null>(null);
  const current = experiments.find((item) => ["draft", "active", "paused"].includes(item.status));

  const catalog = useQuery({
    queryKey: ["meal-response-experiment-catalog"],
    queryFn: getMealResponseExperimentCatalog,
    staleTime: 10 * 60_000,
    enabled: !current,
  });
  const detail = useQuery({
    queryKey: ["meal-response-experiment", current?.id],
    queryFn: () => getMealResponseExperiment(current!.id),
    enabled: Boolean(current?.id),
  });

  const first = catalog.data?.find((meal) => meal.id === firstId) || null;
  const second = catalog.data?.find((meal) => meal.id === secondId) || null;
  const comparable = useMemo(() => {
    if (!first || !second || first.id === second.id) return false;
    return Math.abs(first.calories - second.calories) / Math.max(first.calories, second.calories) <= 0.2;
  }, [first, second]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meal-response-experiment"] }),
      Promise.resolve(onChanged()),
    ]);
  };
  const create = useMutation({
    mutationFn: async () => {
      if (!first || !second || !comparable) throw new Error(copy.notComparable);
      const experiment = await createMealResponseExperiment({
        hypothesis: `${first.name} vs ${second.name}`,
        outcomeType: "glucose_positive_iauc",
        minimumRepeatsPerArm: 4,
        arms: [toArm("meal_a", first), toArm("meal_b", second)],
      });
      return startMealResponseExperiment(experiment.id);
    },
    onSuccess: async () => {
      toast.success(copy.active);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : copy.retry),
  });
  const status = useMutation({
    mutationFn: async (action: "pause" | "resume" | "cancel") => {
      if (!current) return;
      if (action === "pause") return pauseMealResponseExperiment(current.id);
      if (action === "resume") return startMealResponseExperiment(current.id);
      return cancelMealResponseExperiment(current.id);
    },
    onSuccess: refresh,
    onError: (error) => toast.error(error instanceof Error ? error.message : copy.retry),
  });

  if (current) {
    const experiment = detail.data?.experiment;
    const nextAssignment = detail.data?.assignments.find((item) => !item.completed_at);
    const nextArm = experiment?.arms.find((arm) => arm.key === nextAssignment?.arm_key);
    const completed = detail.data?.assignments.filter((item) => item.completed_at).length || 0;
    const total = detail.data?.assignments.length || current.minimum_repeats * 2;
    return (
      <section className="rounded-3xl bg-white p-4 ring-1 ring-[#DCE4EE]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]"><FlaskConical className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase text-[#7C83F6]">{copy.eyebrow}</p>
            <h2 className="mt-1 text-[16px] font-black text-[#020617]">{current.status === "completed" ? copy.completed : current.status === "paused" ? copy.paused : copy.active}</h2>
            <p className="mt-1 truncate text-[11px] font-semibold text-[#64748B]">{current.title}</p>
          </div>
          <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[10px] font-black text-[#020617]">{completed}/{total}</span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EDF1F6]">
          <div className="h-full rounded-full bg-[#22C7A1] transition-[width]" style={{ width: `${total ? Math.min(100, completed / total * 100) : 0}%` }} />
        </div>

        {nextArm ? (
          <div className="mt-4 rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
            <p className="text-[9px] font-black uppercase text-[#94A3B8]">{copy.next}</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
                {catalogImage(nextArm.meal_id, catalog.data) ? <img src={catalogImage(nextArm.meal_id, catalog.data)!} alt="" className="h-full w-full object-cover" /> : <FlaskConical className="h-5 w-5 text-[#7C83F6]" />}
              </span>
              <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-black text-[#020617]">{nextArm.label}</p><p className="mt-0.5 text-[10px] font-bold text-[#94A3B8]">{nextArm.calories} {copy.calories}</p></div>
              <ChevronRight className="h-4 w-4 text-[#94A3B8] rtl:rotate-180" />
            </div>
            <p className="mt-2 text-[10px] font-semibold leading-4 text-[#64748B]">{copy.automatic}</p>
          </div>
        ) : null}

        {detail.data ? (
          <p className="mt-3 flex items-start gap-2 text-[10px] font-semibold leading-4 text-[#64748B]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#22C7A1]" />
            {detail.data.causal_language_allowed ? copy.association : copy.descriptive}
          </p>
        ) : null}

        {current.status !== "completed" ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={status.isPending} onClick={() => status.mutate(current.status === "paused" ? "resume" : "pause")} className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#020617] text-[11px] font-black text-white disabled:opacity-50">
              {current.status === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{current.status === "paused" ? copy.resume : copy.pause}
            </button>
            <button type="button" disabled={status.isPending} onClick={() => status.mutate("cancel")} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#DCE4EE] text-[11px] font-black text-[#020617] disabled:opacity-50"><X className="h-4 w-4" />{copy.cancel}</button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-4 ring-1 ring-[#DCE4EE]">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]"><FlaskConical className="h-5 w-5" /></span>
        <div><p className="text-[10px] font-black uppercase text-[#7C83F6]">{copy.eyebrow}</p><h2 className="mt-1 text-[16px] font-black text-[#020617]">{copy.title}</h2><p className="mt-1 text-[11px] font-semibold leading-4 text-[#64748B]">{copy.body}</p></div>
      </div>

      <div className="mt-4 space-y-2">
        <MealChoice meal={first} placeholder={copy.chooseFirst} onClick={() => setSelecting(selecting === "first" ? null : "first")} />
        <MealChoice meal={second} placeholder={copy.chooseSecond} onClick={() => setSelecting(selecting === "second" ? null : "second")} />
      </div>

      {selecting ? (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-[#F6F8FB] p-2 ring-1 ring-[#E5EAF1]">
          {catalog.isLoading ? <div className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[#22C7A1]" /></div> : catalog.data?.filter((meal) => meal.id !== (selecting === "first" ? secondId : firstId)).map((meal) => (
            <button key={meal.id} type="button" onClick={() => { selecting === "first" ? setFirstId(meal.id) : setSecondId(meal.id); setSelecting(null); }} className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-white p-2 text-start ring-1 ring-[#E5EAF1]">
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#EDF1F6]">{meal.image_url ? <img src={meal.image_url} alt="" className="h-full w-full object-cover" /> : null}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-black text-[#020617]">{meal.name}</span><span className="text-[9px] font-bold text-[#94A3B8]">{meal.calories} {copy.calories} · P {Math.round(meal.protein_g)}g</span></span>
            </button>
          ))}
        </div>
      ) : null}

      {first && second ? <p className={cn("mt-3 flex items-center gap-2 text-[10px] font-black", comparable ? "text-[#0D9F7F]" : "text-[#FB6B7A]")}>{comparable ? <Check className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}{comparable ? copy.comparable : copy.notComparable}</p> : null}
      {!glucoseConnected ? <p className="mt-3 text-[10px] font-semibold leading-4 text-[#FB6B7A]">{copy.needsGlucose}</p> : null}
      <button type="button" disabled={!comparable || !glucoseConnected || create.isPending} onClick={() => create.mutate()} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#020617] px-4 text-[12px] font-black text-white disabled:bg-[#CBD5E1]">
        {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}{copy.start}
      </button>
    </section>
  );
}

function toArm(key: string, meal: MealResponseExperimentMeal) {
  return { key, label: meal.name, meal_id: meal.id, calories: meal.calories };
}

function catalogImage(mealId: string, meals?: MealResponseExperimentMeal[]) {
  return meals?.find((meal) => meal.id === mealId)?.image_url || null;
}

function MealChoice({ meal, placeholder, onClick }: { meal: MealResponseExperimentMeal | null; placeholder: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 rounded-2xl bg-[#F6F8FB] p-2.5 text-start ring-1 ring-[#E5EAF1]"><span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-white">{meal?.image_url ? <img src={meal.image_url} alt="" className="h-full w-full object-cover" /> : null}</span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-black text-[#020617]">{meal?.name || placeholder}</span>{meal ? <span className="mt-0.5 block text-[9px] font-bold text-[#94A3B8]">{meal.calories} kcal · P {Math.round(meal.protein_g)}g · C {Math.round(meal.carbs_g)}g</span> : null}</span><ChevronRight className="h-4 w-4 text-[#94A3B8] rtl:rotate-180" /></button>;
}
