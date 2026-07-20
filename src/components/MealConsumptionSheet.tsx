import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  RotateCcw,
  Search,
  UtensilsCrossed,
  X,
} from "lucide-react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  getOrderMealConsumption,
  recordOrderMealConsumption,
  scaleNutrition,
  setMealConsumptionTiming,
  type ConsumptionTimePrecision,
  type ConsumptionSourceType,
  type ConsumptionStatus,
  type MealConsumption,
  type NutritionSnapshot,
  type RecordMealConsumptionResult,
} from "@/lib/order-consumption";
import { cn } from "@/lib/utils";

interface ReplacementMeal extends NutritionSnapshot {
  id: string;
}

interface MealConsumptionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: ConsumptionSourceType;
  sourceId: string;
  sourceMealId: string;
  meal: NutritionSnapshot;
  onSaved?: (result: RecordMealConsumptionResult) => void;
}

const PORTIONS = [25, 50, 75] as const;

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function MealConsumptionSheet({
  open,
  onOpenChange,
  sourceType,
  sourceId,
  sourceMealId,
  meal,
  onSaved,
}: MealConsumptionSheetProps) {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const [status, setStatus] = useState<ConsumptionStatus>("full");
  const [portion, setPortion] = useState(50);
  const [current, setCurrent] = useState<MealConsumption | null>(null);
  const [replacements, setReplacements] = useState<ReplacementMeal[]>([]);
  const [replacementId, setReplacementId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(false);
  const [startedAt, setStartedAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [timePrecision, setTimePrecision] = useState<ConsumptionTimePrecision>("exact");

  const copy = isRTL ? {
    title: "ماذا أكلت من الوجبة؟",
    description: "أكد الكمية الفعلية حتى تكون السعرات والتوصيات دقيقة.",
    all: "أكلت الوجبة كاملة",
    allHint: "إضافة 100% من القيم الغذائية",
    part: "أكلت جزءاً منها",
    partHint: "حدد الكمية التي تناولتها",
    skip: "لم أتناولها",
    skipHint: "لن تضاف أي سعرات",
    substitute: "تناولت وجبة أخرى",
    substituteHint: "اختر الوجبة البديلة",
    portion: "الكمية المتناولة",
    search: "ابحث عن الوجبة البديلة",
    current: "المسجل حالياً",
    save: "حفظ الاستهلاك",
    undo: "إلغاء التسجيل",
    saved: "تم تحديث تغذيتك",
    savedBody: "تم احتساب الكمية الفعلية في تقدم اليوم.",
    error: "تعذر حفظ الاستهلاك",
    noMeals: "لا توجد وجبات مطابقة.",
    cal: "سعرة",
    protein: "بروتين",
    carbs: "كارب",
    fat: "دهون",
  } : {
    title: "What did you eat?",
    description: "Confirm the actual portion so your calories and recommendations stay accurate.",
    all: "I ate the full meal",
    allHint: "Add 100% of its nutrition",
    part: "I ate part of it",
    partHint: "Choose how much you had",
    skip: "I did not eat it",
    skipHint: "No calories will be added",
    substitute: "I ate a different meal",
    substituteHint: "Choose the replacement meal",
    portion: "Portion eaten",
    search: "Search replacement meals",
    current: "Currently recorded",
    save: "Save consumption",
    undo: "Undo this log",
    saved: "Nutrition updated",
    savedBody: "Your actual portion is now included in today's progress.",
    error: "Could not save consumption",
    noMeals: "No matching meals found.",
    cal: "cal",
    protein: "Protein",
    carbs: "Carbs",
    fat: "Fat",
  };
  const timingCopy = isRTL ? {
    title: "متى بدأت الأكل؟",
    hint: "الوقت الدقيق يساعدنا على ربط الوجبة باستجابتك المقاسة.",
    now: "الآن",
    exact: "دقيق",
    estimated15: "تقريبي ±15 دقيقة",
    estimated30: "تقريبي ±30 دقيقة",
  } : {
    title: "When did you start eating?",
    hint: "An accurate time helps connect this meal with your measured response.",
    now: "Now",
    exact: "Exact",
    estimated15: "About ±15 min",
    estimated30: "About ±30 min",
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoadingState(true);
      try {
        const existing = await getOrderMealConsumption(sourceType, sourceId, sourceMealId);
        if (cancelled) return;
        setCurrent(existing);
        if (existing) {
          setStatus(existing.status === "reversed" ? "full" : existing.status);
          setPortion(existing.portion_percent || 50);
          setReplacementId(existing.substitute_meal_id);
          setStartedAt(existing.started_consuming_at
            ? toLocalDateTimeInput(new Date(existing.started_consuming_at))
            : toLocalDateTimeInput(new Date()));
          setTimePrecision(existing.time_precision || "exact");
        } else {
          setStatus("full");
          setPortion(50);
          setReplacementId(null);
          setStartedAt(toLocalDateTimeInput(new Date()));
          setTimePrecision("exact");
        }
      } catch (error) {
        console.error("Failed to load meal consumption:", error);
      } finally {
        if (!cancelled) setLoadingState(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [open, sourceId, sourceMealId, sourceType]);

  useEffect(() => {
    if (!open || status !== "substituted" || replacements.length > 0) return;
    let cancelled = false;

    const loadReplacements = async () => {
      const { data, error } = await supabase
        .from("public_meal_catalog" as "meals")
        .select("id, name, image_url, calories, protein_g, carbs_g, fat_g, fiber_g")
        .neq("id", sourceMealId)
        .limit(12);

      if (error) {
        console.error("Failed to load replacement meals:", error);
        return;
      }
      if (cancelled) return;

      setReplacements((data || []).map((item) => ({
        id: item.id,
        meal_id: item.id,
        meal_name: item.name,
        image_url: item.image_url,
        calories: item.calories || 0,
        protein_g: item.protein_g || 0,
        carbs_g: item.carbs_g || 0,
        fat_g: item.fat_g || 0,
        fiber_g: item.fiber_g || 0,
      })));
    };

    void loadReplacements();
    return () => { cancelled = true; };
  }, [open, replacements.length, sourceMealId, status]);

  const selectedReplacement = replacements.find((item) => item.id === replacementId);
  const previewMeal = status === "substituted" && selectedReplacement ? selectedReplacement : meal;
  const previewPortion = status === "full" ? 100 : status === "partial" ? portion : status === "substituted" ? 100 : 0;
  const preview = scaleNutrition(previewMeal, previewPortion);

  const filteredReplacements = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return replacements;
    return replacements.filter((item) => item.meal_name.toLowerCase().includes(query));
  }, [replacements, search]);

  const chooseStatus = (nextStatus: ConsumptionStatus) => {
    setStatus(nextStatus);
    if (nextStatus !== "substituted") setReplacementId(null);
  };

  const save = async (nextStatus: ConsumptionStatus = status) => {
    if (nextStatus === "substituted" && !replacementId) return;
    setLoading(true);
    try {
      const result = await recordOrderMealConsumption({
        sourceType,
        sourceId,
        sourceMealId,
        status: nextStatus,
        portionPercent: nextStatus === "partial" ? portion : 100,
        substituteMealId: nextStatus === "substituted" ? replacementId : null,
      });
      if (!["skipped", "reversed"].includes(nextStatus)) {
        const localStart = new Date(startedAt);
        if (!Number.isNaN(localStart.getTime())) {
          await setMealConsumptionTiming({
            consumptionId: result.consumption_id,
            startedConsumingAt: localStart.toISOString(),
            timePrecision,
            timezoneName: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Qatar",
            utcOffsetMinutes: -localStart.getTimezoneOffset(),
          });
        }
      }
      setCurrent((previous) => previous ? {
        ...previous,
        status: result.status,
        portion_percent: result.portion_percent,
        applied_calories: result.nutrition.calories,
        applied_protein_g: result.nutrition.protein_g,
        applied_carbs_g: result.nutrition.carbs_g,
        applied_fat_g: result.nutrition.fat_g,
        applied_fiber_g: result.nutrition.fiber_g || 0,
        event_version: result.event_version,
      } : previous);
      toast({ title: copy.saved, description: copy.savedBody });
      onSaved?.(result);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to record meal consumption:", error);
      toast({ title: copy.error, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const options: Array<{
    status: ConsumptionStatus;
    title: string;
    hint: string;
  }> = [
    { status: "full", title: copy.all, hint: copy.allHint },
    { status: "partial", title: copy.part, hint: copy.partHint },
    { status: "skipped", title: copy.skip, hint: copy.skipHint },
    { status: "substituted", title: copy.substitute, hint: copy.substituteHint },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        dir={isRTL ? "rtl" : "ltr"}
        className="max-h-[90dvh] rounded-t-[24px] border-[#E5EAF1] bg-white"
      >
        <div className="mx-auto flex w-full max-w-[430px] min-h-0 flex-1 flex-col">
          <DrawerHeader className="relative border-b border-[#E5EAF1] px-5 pb-4 pt-3 text-start">
            <DrawerClose asChild>
              <button
                type="button"
                aria-label={isRTL ? "إغلاق" : "Close"}
                className="absolute end-4 top-2 flex h-11 w-11 items-center justify-center rounded-full border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"
              >
                <X className="h-5 w-5" />
              </button>
            </DrawerClose>
            <DrawerTitle className="pe-12 text-[20px] font-extrabold leading-7 text-[#020617]">
              {copy.title}
            </DrawerTitle>
            <DrawerDescription className="max-w-[320px] pe-8 text-[13px] font-medium leading-5 text-[#94A3B8]">
              {copy.description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                {meal.image_url ? (
                  <img src={meal.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UtensilsCrossed className="h-5 w-5 text-[#94A3B8]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold text-[#020617]">{meal.meal_name}</p>
                <p className="mt-1 text-[12px] font-semibold text-[#94A3B8]">
                  {meal.calories} {copy.cal} · {meal.protein_g}g {copy.protein}
                </p>
              </div>
              {current && current.status !== "reversed" && (
                <span className="rounded-full bg-[#E8FBF6] px-2.5 py-1 text-[10px] font-extrabold text-[#0D9F7F]">
                  {copy.current}
                </span>
              )}
            </div>

            {loadingState ? (
              <div className="flex min-h-44 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-[#7C83F6]" />
              </div>
            ) : (
              <>
                <div className="space-y-2" role="radiogroup" aria-label={copy.title}>
                  {options.map((option) => {
                    const selected = status === option.status;
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        key={option.status}
                        onClick={() => chooseStatus(option.status)}
                        className={cn(
                          "flex min-h-[58px] w-full items-center gap-3 rounded-lg border px-3 py-2 text-start transition",
                          selected
                            ? "border-[#22C7A1] bg-[#E8FBF6]"
                            : "border-[#E5EAF1] bg-white",
                        )}
                      >
                        <span className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                          selected
                            ? "border-[#22C7A1] bg-[#22C7A1] text-white"
                            : "border-[#E5EAF1] bg-[#F6F8FB] text-transparent",
                        )}>
                          <Check className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-extrabold text-[#020617]">{option.title}</span>
                          <span className="mt-0.5 block text-[12px] font-medium text-[#94A3B8]">{option.hint}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8] rtl:rotate-180" />
                      </button>
                    );
                  })}
                </div>

                {status === "partial" && (
                  <section className="mt-4 rounded-lg border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-extrabold text-[#020617]">{copy.portion}</p>
                      <output className="text-[18px] font-black text-[#22C7A1]">{portion}%</output>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      step="5"
                      value={portion}
                      onChange={(event) => setPortion(Number(event.target.value))}
                      className="mt-3 h-2 w-full accent-[#22C7A1]"
                      aria-label={copy.portion}
                    />
                    <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={copy.portion}>
                      {PORTIONS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPortion(value)}
                          className={cn(
                            "min-h-11 rounded-lg border text-[13px] font-extrabold",
                            portion === value
                              ? "border-[#020617] bg-[#020617] text-white"
                              : "border-[#E5EAF1] bg-white text-[#020617]",
                          )}
                        >
                          {value}%
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {status === "substituted" && (
                  <section className="mt-4">
                    <label className="flex min-h-12 items-center gap-2 rounded-lg border border-[#E5EAF1] bg-[#F6F8FB] px-3">
                      <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={copy.search}
                        className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#020617] outline-none placeholder:text-[#94A3B8]"
                      />
                    </label>
                    <div className="mt-2 max-h-56 space-y-2 overflow-y-auto">
                      {filteredReplacements.map((replacement) => {
                        const selected = replacementId === replacement.id;
                        return (
                          <button
                            type="button"
                            key={replacement.id}
                            onClick={() => setReplacementId(replacement.id)}
                            className={cn(
                              "flex min-h-[56px] w-full items-center gap-3 rounded-lg border p-2 text-start",
                              selected ? "border-[#7C83F6] bg-[#F1F2FF]" : "border-[#E5EAF1] bg-white",
                            )}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F6F8FB]">
                              {replacement.image_url ? (
                                <img src={replacement.image_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <UtensilsCrossed className="h-4 w-4 text-[#94A3B8]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-extrabold text-[#020617]">{replacement.meal_name}</p>
                              <p className="mt-0.5 text-[11px] font-semibold text-[#94A3B8]">
                                {replacement.calories} {copy.cal} · {replacement.protein_g}g {copy.protein}
                              </p>
                            </div>
                            {selected && <Check className="h-5 w-5 shrink-0 text-[#7C83F6]" />}
                          </button>
                        );
                      })}
                      {filteredReplacements.length === 0 && (
                        <p className="py-6 text-center text-[13px] font-semibold text-[#94A3B8]">{copy.noMeals}</p>
                      )}
                    </div>
                  </section>
                )}

                {!(["skipped", "reversed"] as ConsumptionStatus[]).includes(status) && (
                  <section className="mt-4 rounded-lg border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF8FF] text-[#38BDF8]">
                        <Clock3 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-extrabold text-[#020617]">{timingCopy.title}</p>
                        <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#94A3B8]">{timingCopy.hint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStartedAt(toLocalDateTimeInput(new Date()));
                          setTimePrecision("exact");
                        }}
                        className="min-h-9 shrink-0 rounded-full border border-[#DCE4EE] bg-white px-3 text-[11px] font-extrabold text-[#020617]"
                      >
                        {timingCopy.now}
                      </button>
                    </div>
                    <input
                      type="datetime-local"
                      value={startedAt}
                      max={toLocalDateTimeInput(new Date())}
                      onChange={(event) => setStartedAt(event.target.value)}
                      className="mt-3 min-h-12 w-full rounded-lg border border-[#DCE4EE] bg-white px-3 text-[13px] font-extrabold text-[#020617] outline-none focus:border-[#38BDF8]"
                      aria-label={timingCopy.title}
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={timingCopy.hint}>
                      {([
                        ["exact", timingCopy.exact],
                        ["estimated_15m", timingCopy.estimated15],
                        ["estimated_30m", timingCopy.estimated30],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTimePrecision(value)}
                          className={cn(
                            "min-h-11 rounded-lg border px-2 text-[10px] font-extrabold leading-4",
                            timePrecision === value
                              ? "border-[#020617] bg-[#020617] text-white"
                              : "border-[#DCE4EE] bg-white text-[#64748B]",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <div className="mt-4 grid grid-cols-4 gap-2 rounded-lg border border-[#E5EAF1] bg-white p-3 text-center">
                  <div>
                    <p className="text-[15px] font-black text-[#22C7A1]">{preview.calories}</p>
                    <p className="text-[10px] font-bold text-[#94A3B8]">{copy.cal}</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-black text-[#7C83F6]">{preview.protein_g}g</p>
                    <p className="text-[10px] font-bold text-[#94A3B8]">{copy.protein}</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-black text-[#F97316]">{preview.carbs_g}g</p>
                    <p className="text-[10px] font-bold text-[#94A3B8]">{copy.carbs}</p>
                  </div>
                  <div>
                    <p className="text-[15px] font-black text-[#FB6B7A]">{preview.fat_g}g</p>
                    <p className="text-[10px] font-bold text-[#94A3B8]">{copy.fat}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="border-t border-[#E5EAF1] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={loading || loadingState || (status === "substituted" && !replacementId)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#020617] px-4 text-[14px] font-extrabold text-white disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {copy.save}
            </button>
            {current && current.status !== "reversed" && (
              <button
                type="button"
                onClick={() => void save("reversed")}
                disabled={loading}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-[13px] font-extrabold text-[#FB6B7A] disabled:opacity-40"
              >
                <RotateCcw className="h-4 w-4" />
                {copy.undo}
              </button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
