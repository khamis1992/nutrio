import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Target, Utensils } from "lucide-react";
import { GoalsManagement } from "@/components/GoalsManagement";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const NutritionGoals = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useLanguage();
  const isEditGoalRoute = location.pathname.endsWith("/edit-goal");

  // Dedicated edit route = full-screen editor only (no stacked overview page).
  if (isEditGoalRoute) {
    return (
      <div className="min-h-[100dvh] bg-[#F7F8FA]">
        <GoalsManagement
          autoOpenEditor
          onGoalSaved={() => {
            navigate("/dashboard/progress?tab=goals", { replace: true });
          }}
          onEditorDismiss={() => {
            navigate(-1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F8FA] pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-safe">
      <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#F7F8FA]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[430px] items-center gap-3 px-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/80 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1 text-start">
            <h1 className="truncate text-[17px] font-extrabold leading-none tracking-tight text-slate-950">
              {t("nutrition_plan_title")}
            </h1>
            <p className="mt-1 truncate text-[12px] font-semibold text-slate-400">
              {t("nutrition_plan_subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[430px] space-y-4 px-5 py-4">
        <section className="overflow-hidden rounded-[20px] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-start">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-indigo-600">
                <Target className="h-3.5 w-3.5" strokeWidth={2.4} />
                {t("nutrition_plan_title")}
              </div>
              <h2 className="text-[20px] font-extrabold leading-tight tracking-tight text-slate-950">
                {t("goal_setup_title")}
              </h2>
              <p className="mt-1.5 text-[13px] font-semibold leading-5 text-slate-500">
                {t("nutrition_plan_subtitle")}
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <Utensils className="h-5 w-5" strokeWidth={2.3} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-orange-50 px-3 py-3 ring-1 ring-orange-100">
              <div className="flex items-center gap-1.5 text-orange-600">
                <Flame className="h-4 w-4" strokeWidth={2.3} />
                <span className="text-[12px] font-bold uppercase tracking-wide">{t("calories")}</span>
              </div>
              <p className="mt-1 text-[12px] font-extrabold leading-4 text-slate-950">
                {t("daily_nutrition_targets")}
              </p>
            </div>
            <div className="rounded-[14px] bg-indigo-50 px-3 py-3 ring-1 ring-indigo-100">
              <div className="flex items-center gap-1.5 text-indigo-600">
                <Target className="h-4 w-4" strokeWidth={2.3} />
                <span className="text-[12px] font-bold uppercase tracking-wide">{t("macros")}</span>
              </div>
              <p className="mt-1 text-[12px] font-extrabold leading-4 text-slate-950">
                {t("goal_impact_meals")}
              </p>
            </div>
          </div>
        </section>

        <GoalsManagement />
      </div>
    </div>
  );
};

export default NutritionGoals;
