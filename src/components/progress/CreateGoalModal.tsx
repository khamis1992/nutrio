import { useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateBMR, calculateTDEE, calculateTargetCalories, calculateMacros } from "@/lib/nutrition-calculator";
import { goalTypeConfig, type GoalTypeConfig } from "@/components/progress/GoalHeroCard";
import {
  Flame,
  Target,
  Zap,
  Droplets,
  Loader2,
} from "lucide-react";

interface CreateGoalModalProps {
  open: boolean;
  onClose: () => void;
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

export const CreateGoalModal = ({ open, onClose, onGoalUpdated, setGoal }: CreateGoalModalProps) => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [selectedGoalType, setSelectedGoalType] = useState<"weight_loss" | "muscle_gain" | "maintenance" | "general_health">("general_health");
  const [goalTargetWeight, setGoalTargetWeight] = useState("");
  const [goalTargetDate, setGoalTargetDate] = useState("");
  const [creatingGoal, setCreatingGoal] = useState(false);

  const toCalcGoal = (type: string): "lose" | "gain" | "maintain" => {
    if (type === "weight_loss") return "lose";
    if (type === "muscle_gain") return "gain";
    return "maintain";
  };

  const calculateGoalTargets = (goalType: string) => {
    const calcGoal = toCalcGoal(goalType);
    const p = profile;
    if (
      p?.current_weight_kg && p?.height_cm && p?.age &&
      p?.gender && p.gender !== "prefer_not_to_say" && p?.activity_level
    ) {
      const bmr = calculateBMR(p.gender as "male" | "female", p.current_weight_kg, p.height_cm, p.age);
      const tdee = calculateTDEE(bmr, p.activity_level);
      const dailyCalories = calculateTargetCalories(tdee, calcGoal);
      const macros = calculateMacros(dailyCalories, calcGoal);
      return {
        daily_calorie_target: dailyCalories,
        protein_target_g: macros.protein,
        carbs_target_g: macros.carbs,
        fat_target_g: macros.fat,
        fiber_target_g: calcGoal === "lose" ? 35 : 30,
      };
    }
    const fallbacks: Record<string, { daily_calorie_target: number; protein_target_g: number; carbs_target_g: number; fat_target_g: number; fiber_target_g: number }> = {
      weight_loss:    { daily_calorie_target: 1600, protein_target_g: 140, carbs_target_g: 140, fat_target_g: 53,  fiber_target_g: 35 },
      muscle_gain:    { daily_calorie_target: 2500, protein_target_g: 188, carbs_target_g: 281, fat_target_g: 69,  fiber_target_g: 30 },
      maintenance:    { daily_calorie_target: 2000, protein_target_g: 150, carbs_target_g: 200, fat_target_g: 67,  fiber_target_g: 30 },
      general_health: { daily_calorie_target: 2000, protein_target_g: 120, carbs_target_g: 250, fat_target_g: 65,  fiber_target_g: 30 },
    };
    return fallbacks[goalType] ?? fallbacks.general_health;
  };

  const computedTargets = calculateGoalTargets(selectedGoalType);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">{t("create_new_goal")}</h3>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
            >
              <span className="text-2xl leading-none">&times;</span>
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-slate-600 mb-2 block">{t("goal_type")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(goalTypeConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedGoalType(key as typeof selectedGoalType)}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-colors text-left",
                      selectedGoalType === key
                        ? "border-primary bg-primary/5"
                        : "border-slate-100 hover:border-primary/50"
                    )}
                  >
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", config.color.replace("text-", "bg-").replace("600", "100"))}>
                      <div className={config.color}>{config.icon}</div>
                    </div>
                    <p className="font-medium text-sm">{t(config.label)}</p>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-slate-600 mb-2 block">{t("target_weight_kg")}</Label>
                <Input
                  type="number"
                  placeholder="70"
                  className="h-12 rounded-xl"
                  value={goalTargetWeight}
                  onChange={(e) => setGoalTargetWeight(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm text-slate-600 mb-2 block">{t("target_date")}</Label>
                <Input
                  type="date"
                  className="h-12 rounded-xl"
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                />
              </div>
            </div>

            {/* Calculated targets preview */}
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {profile?.current_weight_kg && profile?.height_cm ? "Your personalized targets" : "Recommended targets"}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-slate-600">Calories</span>
                  <span className="ml-auto font-semibold">{computedTargets.daily_calorie_target}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-slate-600">Protein</span>
                  <span className="ml-auto font-semibold">{computedTargets.protein_target_g}g</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
                  <span className="text-slate-600">Carbs</span>
                  <span className="ml-auto font-semibold">{computedTargets.carbs_target_g}g</span>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-cyan-500 shrink-0" />
                  <span className="text-slate-600">Fat</span>
                  <span className="ml-auto font-semibold">{computedTargets.fat_target_g}g</span>
                </div>
              </div>
              {!profile?.current_weight_kg && (
                <p className="text-xs text-slate-400 mt-1">Complete your profile for personalized targets</p>
              )}
            </div>
            
            <Button
              className="w-full h-12 rounded-xl"
              disabled={creatingGoal}
              onClick={async () => {
                try {
                  setCreatingGoal(true);
                  await setGoal({
                    goal_type: selectedGoalType,
                    target_weight_kg: goalTargetWeight ? parseFloat(goalTargetWeight) : null,
                    target_date: goalTargetDate || null,
                    ...computedTargets,
                    is_active: true,
                  });
                  toast({ title: t("goal_created_successfully") });
                  onClose();
                  setGoalTargetWeight("");
                  setGoalTargetDate("");
                  setSelectedGoalType("general_health");
                  onGoalUpdated();
                } catch {
                  toast({ title: t("failed_to_create_goal"), variant: "destructive" });
                } finally {
                  setCreatingGoal(false);
                }
              }}
            >
              {creatingGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : t("create_goal")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
