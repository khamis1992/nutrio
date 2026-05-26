import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  TrendingDown,
  Zap,
  Minus,
  Sparkles,
  Activity,
  Target,
} from "lucide-react";

export interface GoalTypeConfig {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface GoalHeroCardProps {
  currentGoal: GoalTypeConfig | null;
  activeGoal: {
    goal_type: string;
    target_weight_kg: number | null;
    target_date: string | null;
    daily_calorie_target: number;
    protein_target_g: number;
    carbs_target_g: number;
    fat_target_g: number;
    fiber_target_g: number;
  } | null;
}

export const GoalHeroCard = ({ currentGoal, activeGoal }: GoalHeroCardProps) => {
  const { t } = useLanguage();

  if (!currentGoal) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 p-5 shadow-sm">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-slate-300 flex items-center justify-center mx-auto mb-3">
            <Target className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-1">{t("no_active_goal")}</h3>
          <p className="text-slate-500 text-sm mb-4">{t("set_goal_hint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-2xl text-white p-5 shadow-md", currentGoal.bgColor)}>
      <div className="absolute -top-6 -right-6 w-28 h-28 bg-white/10 rounded-full" />
      <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full" />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
            {currentGoal.icon}
          </div>
          <div>
            <p className="text-white/70 text-sm">{t("active_goal")}</p>
            <h3 className="text-xl font-bold">{t(currentGoal.label)}</h3>
          </div>
        </div>
        {activeGoal?.target_weight_kg && (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-white/15 rounded-xl p-3">
              <p className="text-white/70 text-xs mb-1">{t("target_weight")}</p>
              <p className="text-lg font-bold">{activeGoal.target_weight_kg} kg</p>
            </div>
            {activeGoal.target_date && (
              <div className="flex-1 bg-white/15 rounded-xl p-3">
                <p className="text-white/70 text-xs mb-1">{t("target_date")}</p>
                <p className="text-lg font-bold">{new Date(activeGoal.target_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-white/80 text-sm">
          <Activity className="w-4 h-4" />
          <span>{t("on_track_nutrition")}</span>
        </div>
      </div>
    </div>
  );
};

export const goalTypeConfig: Record<string, GoalTypeConfig> = {
  weight_loss: {
    label: "weight_loss",
    icon: <TrendingDown className="w-5 h-5" />,
    color: "text-orange-600",
    bgColor: "bg-orange-500",
  },
  muscle_gain: {
    label: "muscle_gain",
    icon: <Zap className="w-5 h-5" />,
    color: "text-blue-600",
    bgColor: "bg-blue-500",
  },
  maintenance: {
    label: "maintenance_goal",
    icon: <Minus className="w-5 h-5" />,
    color: "text-amber-600",
    bgColor: "bg-amber-500",
  },
  general_health: {
    label: "general_health",
    icon: <Sparkles className="w-5 h-5" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500",
  },
};
