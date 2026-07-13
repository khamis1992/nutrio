import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Target, Utensils } from "lucide-react";
import { GoalsManagement } from "@/components/GoalsManagement";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

const NutritionGoals = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const isEditGoalRoute = location.pathname.endsWith("/edit-goal");

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-24 pt-safe">
      <div className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-[#F6F8FB]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-11 w-11 shrink-0 rounded-full bg-white text-[#020617] shadow-sm active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-[#020617]">{isEditGoalRoute ? t("edit_goal") : t("nutrition_plan_title")}</h1>
            <p className="truncate text-xs font-medium text-[#94A3B8]">{t("nutrition_plan_subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        {!isEditGoalRoute && <section className="mb-4 overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#F3F4FF] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">
                <Target className="h-3.5 w-3.5" />
                {t("nutrition_plan_title")}
              </div>
              <h2 className="text-[22px] font-black leading-tight tracking-[-0.04em] text-[#020617]">{t("goal_setup_title")}</h2>
              <p className="mt-2 max-w-[17rem] text-[13px] font-semibold leading-5 text-[#64748B]">
                {t("nutrition_plan_subtitle")}
              </p>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
              <Utensils className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#FFF7ED] px-3 py-3 ring-1 ring-[#F97316]/15">
              <div className="flex items-center gap-2 text-[#F97316]">
                <Flame className="h-4 w-4 text-[#F97316]" />
                <span className="text-[11px] font-bold uppercase tracking-wide">{t("calories")}</span>
              </div>
              <p className="mt-1 text-[12px] font-black leading-4 text-[#020617]">{t("daily_nutrition_targets")}</p>
            </div>
            <div className="rounded-2xl bg-[#F3F4FF] px-3 py-3 ring-1 ring-[#7C83F6]/15">
              <div className="flex items-center gap-2 text-[#7C83F6]">
                <Target className="h-4 w-4 text-[#7C83F6]" />
                <span className="text-[11px] font-bold uppercase tracking-wide">{t("macros")}</span>
              </div>
              <p className="mt-1 text-[12px] font-black leading-4 text-[#020617]">{t("goal_impact_meals")}</p>
            </div>
          </div>
        </section>}

        <GoalsManagement autoOpenEditor={isEditGoalRoute} />
      </div>
    </div>
  );
};

export default NutritionGoals;
