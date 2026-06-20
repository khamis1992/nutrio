import { useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Target, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalsManagement } from "@/components/GoalsManagement";
import { useLanguage } from "@/contexts/LanguageContext";

const NutritionGoals = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#f6fbf7] pb-24 pt-safe">
      <div className="sticky top-0 z-20 border-b border-emerald-900/5 bg-[#f6fbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-11 w-11 shrink-0 rounded-full bg-white text-emerald-950 shadow-sm active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-emerald-950">Nutrition Goals</h1>
            <p className="truncate text-xs font-medium text-emerald-900/55">{t("nutrition_goals_desc")}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        <section className="mb-4 overflow-hidden rounded-[28px] bg-[#103f32] p-5 text-white shadow-[0_18px_45px_rgba(16,63,50,0.20)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-100">
                <Target className="h-3.5 w-3.5" />
                Goals
              </div>
              <h2 className="text-2xl font-black leading-tight tracking-tight">Fuel targets</h2>
              <p className="mt-2 max-w-[15rem] text-sm font-medium leading-relaxed text-white/75">
                Tune your calories, macros, activity, and health direction in one place.
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#24b893] text-white shadow-lg shadow-black/10">
              <Utensils className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-100">
                <Flame className="h-4 w-4 text-amber-300" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Calories</span>
              </div>
              <p className="mt-1 text-sm font-extrabold">Daily plan</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-100">
                <Target className="h-4 w-4 text-[#6de3c4]" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Macros</span>
              </div>
              <p className="mt-1 text-sm font-extrabold">Protein first</p>
            </div>
          </div>
        </section>

        <GoalsManagement />
      </div>
    </div>
  );
};

export default NutritionGoals;
