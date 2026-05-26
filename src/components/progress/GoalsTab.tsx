import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoalHeroCard, goalTypeConfig } from "@/components/progress/GoalHeroCard";
import { CreateGoalModal } from "@/components/progress/CreateGoalModal";
import { SmartAdjustmentsPanel } from "@/components/progress/SmartAdjustmentsPanel";
import { MilestonesList } from "@/components/progress/MilestonesList";
import {
  Flame,
  Target,
  Zap,
  Droplets,
  Scale,
  ChevronRight,
  Plus,
} from "lucide-react";

interface GoalsTabProps {
  userId: string | undefined;
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
  updateGoalTargets: (updates: Record<string, number>) => Promise<boolean>;
  onGoalUpdated: () => void;
  setGoal: (goal: {
    goal_type: "weight_loss" | "muscle_gain" | "maintenance" | "general_health";
    target_weight_kg: number | null;
    target_date: string | null;
    daily_calorie_target: number;
    protein_target_g: number;
    carbs_target_g: number;
    fat_target_g: number;
    fiber_target_g: number;
    is_active: boolean;
  }) => Promise<void>;
}

export const GoalsTab = ({ activeGoal, userId, updateGoalTargets, onGoalUpdated, setGoal }: GoalsTabProps) => {
  const { t } = useLanguage();
  const [showCreateGoal, setShowCreateGoal] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("macros");

  const currentGoal = activeGoal ? goalTypeConfig[activeGoal.goal_type] || goalTypeConfig.general_health : null;

  const macroData = activeGoal ? [
    { label: t("calories"), value: activeGoal.daily_calorie_target, unit: "kcal", color: "bg-orange-500", icon: <Flame className="w-4 h-4" /> },
    { label: t("protein"), value: activeGoal.protein_target_g, unit: "g", color: "bg-blue-500", icon: <Target className="w-4 h-4" /> },
    { label: t("carbs"), value: activeGoal.carbs_target_g, unit: "g", color: "bg-amber-500", icon: <Zap className="w-4 h-4" /> },
    { label: t("fat"), value: activeGoal.fat_target_g, unit: "g", color: "bg-emerald-500", icon: <Droplets className="w-4 h-4" /> },
  ] : [];

  const milestones = [
    { id: 1, title: t("first_week_complete"), description: t("logged_meals_7_days"), achieved: true, icon: "🎯" },
    { id: 2, title: t("protein_pro"), description: t("hit_protein_goal_5_days"), achieved: true, icon: "💪" },
    { id: 3, title: t("hydration_hero"), description: t("drank_8_glasses"), achieved: false, icon: "💧" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Create New Goal Button */}
      <button
        onClick={() => setShowCreateGoal(true)}
        className="w-full flex items-center gap-4 bg-white rounded-2xl px-4 py-3.5 shadow-sm active:scale-[0.98] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Plus className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[15px] font-semibold text-slate-900">{t("create_new_goal")}</p>
          <p className="text-xs text-slate-400 mt-0.5">{t("create_goal_description")}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
      </button>

      {/* Hero Goal Card */}
      <GoalHeroCard currentGoal={currentGoal} activeGoal={activeGoal} />

      {/* Daily Targets - Expandable */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <button 
          onClick={() => setExpandedSection(expandedSection === "macros" ? null : "macros")}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-slate-900">{t("daily_targets")}</h3>
              <p className="text-sm text-slate-500">{t("your_nutrition_goals")}</p>
            </div>
          </div>
          {expandedSection === "macros" ? (
            <ChevronRight className="w-5 h-5 text-slate-400 rotate-90 transition-transform" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400 transition-transform" />
          )}
        </button>
        
        {expandedSection === "macros" && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-3">
              {macroData.map((macro) => (
                <div key={macro.label} className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", macro.color)}>
                      {macro.icon}
                    </div>
                    <span className="text-sm text-slate-600">{macro.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {macro.value}
                    <span className="text-sm font-normal text-slate-400 ml-1">{macro.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Body Metrics */}
      <Card className="border-0 shadow-sm">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{t("body_metrics")}</h3>
              <p className="text-sm text-slate-500">{t("track_physical_progress")}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">{t("current_weight")}</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="75" 
                  className="h-12 rounded-xl pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">kg</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">{t("height")}</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="175" 
                  className="h-12 rounded-xl pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">cm</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Smart Adjustments */}
      <SmartAdjustmentsPanel
        userId={userId}
        activeGoal={activeGoal}
        updateGoalTargets={updateGoalTargets}
        onGoalUpdated={onGoalUpdated}
      />

      {/* Milestones */}
      <MilestonesList milestones={milestones} />

      {/* Create Goal Modal */}
      <CreateGoalModal
        open={showCreateGoal}
        onClose={() => setShowCreateGoal(false)}
        onGoalUpdated={onGoalUpdated}
        setGoal={setGoal}
      />
    </div>
  );
};
