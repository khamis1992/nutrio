import { useMemo, useState } from "react";
import { ArrowUpRight, Dumbbell, Search } from "lucide-react";

import { ExerciseCatalogSheet } from "@/components/exercises/ExerciseCatalogSheet";
import { ExerciseMedia } from "@/components/exercises/ExerciseMedia";
import { useLanguage } from "@/contexts/LanguageContext";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { formatExerciseLabel } from "@/lib/exercise-catalog";

export function ExerciseLibraryCard() {
  const { isRTL } = useLanguage();
  const { exercises } = useExerciseCatalog();
  const [open, setOpen] = useState(false);
  const previews = useMemo(() => {
    const preferred = ["chest", "upper legs", "back"];
    return preferred
      .map((category) => exercises.find((exercise) => exercise.category === category))
      .filter((exercise) => exercise !== undefined);
  }, [exercises]);

  return (
    <>
      <section
        data-testid="exercise-library-card"
        className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]"
      >
        <div className="px-4 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#22A98D]">
                {isRTL ? "مكتبة Nutrio" : "Nutrio movement library"}
              </p>
              <h3 className="mt-1 text-[19px] font-black text-[#020617]">
                {isRTL ? "تعلّم الحركة قبل التمرين" : "Know the movement before you train"}
              </h3>
              <p className="mt-1 max-w-[270px] text-[11px] font-semibold leading-relaxed text-slate-400">
                {isRTL
                  ? "ابحث حسب العضلة أو المعدات وشاهد خطوات الأداء الصحيحة."
                  : "Search by muscle or equipment and review step-by-step form guidance."}
              </p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#E9FBF7] text-[#22A98D]">
              <Dumbbell className="h-5 w-5" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 flex h-12 w-full items-center gap-3 rounded-[16px] bg-[#F6F8FB] px-4 text-start ring-1 ring-[#E5EAF1] transition active:scale-[0.99]"
          >
            <Search className="h-5 w-5 text-[#22A98D]" />
            <span className="min-w-0 flex-1 text-[12px] font-bold text-slate-400">
              {isRTL ? "ابحث في 1,324 تمرينًا" : "Search 1,324 exercises"}
            </span>
            <ArrowUpRight className="h-4 w-4 text-[#020617]" />
          </button>
        </div>

        {previews.length > 0 && (
          <div className="grid grid-cols-3 border-t border-[#E5EAF1]">
            {previews.map((exercise) => (
              <button
                type="button"
                key={exercise.id}
                onClick={() => setOpen(true)}
                className="group relative aspect-square overflow-hidden bg-[#F1FBF8] [&:not(:first-child)]:border-s [&:not(:first-child)]:border-[#E5EAF1]"
                aria-label={formatExerciseLabel(exercise.name)}
              >
                <ExerciseMedia
                  exercise={exercise}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        )}
      </section>

      <ExerciseCatalogSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
