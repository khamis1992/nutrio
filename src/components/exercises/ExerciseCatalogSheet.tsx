import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Dumbbell,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { useLanguage } from "@/contexts/LanguageContext";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import {
  filterExercises,
  formatExerciseLabel,
  type ExerciseCatalogItem,
} from "@/lib/exercise-catalog";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

interface ExerciseCatalogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (exercise: ExerciseCatalogItem) => void;
  selectedId?: string | null;
  title?: string;
  allowedExerciseIds?: string[];
  initialExerciseId?: string | null;
}

export function ExerciseCatalogSheet({
  open,
  onOpenChange,
  onSelect,
  selectedId,
  title,
  allowedExerciseIds,
  initialExerciseId,
}: ExerciseCatalogSheetProps) {
  const { isRTL } = useLanguage();
  const { exercises, loading, error } = useExerciseCatalog(open);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [equipment, setEquipment] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeExercise, setActiveExercise] = useState<ExerciseCatalogItem | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, deferredQuery, equipment]);

  useEffect(() => {
    if (!open) {
      setActiveExercise(null);
    } else if (initialExerciseId) {
      setActiveExercise(exercises.find((exercise) => exercise.id === initialExerciseId) ?? null);
    }
  }, [exercises, initialExerciseId, open]);

  const availableExercises = useMemo(() => {
    if (!allowedExerciseIds) return exercises;
    const allowed = new Set(allowedExerciseIds);
    return exercises.filter((exercise) => allowed.has(exercise.id));
  }, [allowedExerciseIds, exercises]);

  const categories = useMemo(
    () => [...new Set(availableExercises.map((exercise) => exercise.category))].sort(),
    [availableExercises],
  );
  const equipmentOptions = useMemo(
    () => [...new Set(availableExercises.map((exercise) => exercise.equipment))].sort(),
    [availableExercises],
  );
  const filtered = useMemo(
    () => filterExercises(availableExercises, deferredQuery, category, equipment),
    [availableExercises, category, deferredQuery, equipment],
  );
  const visibleExercises = filtered.slice(0, visibleCount);

  const copy = isRTL
    ? {
        title: title || "مكتبة التمارين",
        description: "ابحث حسب العضلة أو المعدات أو اسم التمرين",
        search: "ابحث في 1,324 تمرينًا",
        allAreas: "كل العضلات",
        allEquipment: "كل المعدات",
        results: "تمرين",
        noResults: "لم نجد تمرينًا مطابقًا",
        loadMore: "عرض المزيد",
        steps: "طريقة الأداء",
        target: "العضلة المستهدفة",
        equipment: "المعدات",
        supporting: "عضلات مساعدة",
        choose: "اختيار التمرين",
        selected: "محدد",
        retry: "تعذر تحميل مكتبة التمارين. حاول مرة أخرى.",
      }
    : {
        title: title || "Exercise library",
        description: "Search by muscle, equipment, or exercise name",
        search: "Search 1,324 exercises",
        allAreas: "All body areas",
        allEquipment: "All equipment",
        results: "exercises",
        noResults: "No matching exercises found",
        loadMore: "Show more",
        steps: "How to perform",
        target: "Primary target",
        equipment: "Equipment",
        supporting: "Supporting muscles",
        choose: "Choose exercise",
        selected: "Selected",
        retry: "The exercise library could not be loaded. Please try again.",
      };

  const handleSelect = (exercise: ExerciseCatalogItem) => {
    onSelect?.(exercise);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        dir={isRTL ? "rtl" : "ltr"}
        className="inset-x-0 mx-auto flex h-[92dvh] w-full max-w-[430px] flex-col gap-0 overflow-hidden rounded-t-[28px] border-0 bg-[#F6F8FB] p-0 shadow-[0_-20px_60px_rgba(2,6,23,0.18)] !z-[1201]"
        closeButtonClassName="right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#020617] opacity-100 shadow-sm ring-1 ring-[#E5EAF1] rtl:left-4 rtl:right-auto [&_svg]:h-4 [&_svg]:w-4"
      >
        {activeExercise ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
            <div className="relative aspect-[16/11] w-full shrink-0 overflow-hidden bg-[#ECFDF8]">
              <ExerciseMedia
                exercise={activeExercise}
                alt={activeExercise.name}
                className="h-full w-full object-contain p-4"
              />
              <button
                type="button"
                onClick={() => {
                  setActiveExercise(null);
                }}
                className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/94 text-[#020617] shadow-md ring-1 ring-black/5 backdrop-blur rtl:left-auto rtl:right-4"
                aria-label={isRTL ? "العودة إلى المكتبة" : "Back to library"}
              >
                <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} />
              </button>
            </div>

            <div className="flex-1 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-[#E9FBF7] px-3 py-1.5 text-[10px] font-extrabold text-[#129A7F]">
                  {formatExerciseLabel(activeExercise.category)}
                </span>
                <span className="rounded-full bg-[#EEF6FF] px-3 py-1.5 text-[10px] font-extrabold text-[#1687D9]">
                  {formatExerciseLabel(activeExercise.equipment)}
                </span>
              </div>
              <h2 className="mt-3 text-[24px] font-black leading-tight text-[#020617]">
                {formatExerciseLabel(activeExercise.name)}
              </h2>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <DetailMetric label={copy.target} value={formatExerciseLabel(activeExercise.target)} />
                <DetailMetric label={copy.equipment} value={formatExerciseLabel(activeExercise.equipment)} />
              </div>

              {activeExercise.secondaryMuscles.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {copy.supporting}
                  </p>
                  <p className="mt-1.5 text-[13px] font-bold leading-relaxed text-slate-700">
                    {activeExercise.secondaryMuscles.map(formatExerciseLabel).join(", ")}
                  </p>
                </div>
              )}

              <div className="mt-6">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">
                  {copy.steps}
                </p>
                <ol className="mt-3 space-y-3">
                  {activeExercise.instructions.map((step, index) => (
                    <li key={`${activeExercise.id}-${index}`} className="flex gap-3 text-[13px] font-medium leading-relaxed text-slate-600">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#020617] text-[10px] font-black text-white">
                        {index + 1}
                      </span>
                      <span className="pt-1">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {onSelect && (
                <button
                  type="button"
                  onClick={() => handleSelect(activeExercise)}
                  className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-[18px] bg-[#020617] text-[14px] font-black text-white shadow-[0_12px_28px_rgba(2,6,23,0.18)] transition active:scale-[0.98]"
                >
                  {selectedId === activeExercise.id ? <Check className="h-5 w-5 text-[#22C7A1]" /> : <Dumbbell className="h-5 w-5" />}
                  {selectedId === activeExercise.id ? copy.selected : copy.choose}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <SheetHeader className="shrink-0 bg-white px-5 pb-4 pt-5 text-start">
              <SheetTitle className="pr-12 text-[21px] font-black text-[#020617] rtl:pl-12 rtl:pr-0">
                {copy.title}
              </SheetTitle>
              <SheetDescription className="text-[12px] font-semibold text-slate-400">
                {copy.description}
              </SheetDescription>
            </SheetHeader>

            <div className="shrink-0 border-b border-[#E5EAF1] bg-white px-4 pb-4">
              <label className="flex h-12 items-center gap-3 rounded-[16px] bg-[#F6F8FB] px-4 ring-1 ring-[#E5EAF1] focus-within:ring-2 focus-within:ring-[#22C7A1]/35">
                <Search className="h-5 w-5 shrink-0 text-[#22C7A1]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.search}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-[#020617] outline-none placeholder:text-slate-400"
                />
              </label>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <FilterSelect
                  label={copy.allAreas}
                  value={category}
                  onChange={setCategory}
                  options={categories}
                />
                <FilterSelect
                  label={copy.allEquipment}
                  value={equipment}
                  onChange={setEquipment}
                  options={equipmentOptions}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
              {loading ? (
                <div className="flex h-48 flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="h-7 w-7 animate-spin text-[#22C7A1]" />
                  <p className="text-[12px] font-bold">{copy.search}</p>
                </div>
              ) : error ? (
                <div className="rounded-[20px] bg-white p-6 text-center ring-1 ring-[#E5EAF1]">
                  <p className="text-[13px] font-bold text-slate-600">{copy.retry}</p>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-extrabold text-slate-400">
                      {filtered.length.toLocaleString()} {copy.results}
                    </p>
                    <SlidersHorizontal className="h-4 w-4 text-slate-300" />
                  </div>
                  {visibleExercises.length === 0 ? (
                    <div className="rounded-[22px] bg-white p-8 text-center ring-1 ring-[#E5EAF1]">
                      <Search className="mx-auto h-7 w-7 text-slate-300" />
                      <p className="mt-3 text-[13px] font-black text-[#020617]">{copy.noResults}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {visibleExercises.map((exercise) => (
                        <button
                          type="button"
                          key={exercise.id}
                          onClick={() => setActiveExercise(exercise)}
                          className="group overflow-hidden rounded-[20px] bg-white text-start shadow-[0_8px_22px_rgba(15,23,42,0.05)] ring-1 ring-[#E5EAF1] transition active:scale-[0.98]"
                        >
                          <div className="relative aspect-square overflow-hidden bg-[#F1FBF8]">
                            <ExerciseMedia
                              exercise={exercise}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105"
                            />
                            {selectedId === exercise.id && (
                              <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#22C7A1] text-white shadow-sm rtl:left-2 rtl:right-auto">
                                <Check className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="line-clamp-2 min-h-[34px] text-[12px] font-black leading-[17px] text-[#020617]">
                              {formatExerciseLabel(exercise.name)}
                            </p>
                            <p className="mt-1 truncate text-[10px] font-bold text-[#22A98D]">
                              {formatExerciseLabel(exercise.target)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {visibleCount < filtered.length && (
                    <button
                      type="button"
                      onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                      className="mt-4 h-12 w-full rounded-[16px] bg-white text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition active:scale-[0.99]"
                    >
                      {copy.loadMore}
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative shrink-0">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 appearance-none rounded-full bg-white py-0 pl-4 pr-9 text-[11px] font-extrabold text-slate-600 outline-none ring-1 ring-[#E5EAF1] rtl:pl-9 rtl:pr-4"
      >
        <option value="all">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>{formatExerciseLabel(option)}</option>
        ))}
      </select>
      <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-90 text-slate-400 rtl:left-3 rtl:right-auto" />
    </label>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-[13px] font-black leading-snug text-[#020617]">{value}</p>
    </div>
  );
}
