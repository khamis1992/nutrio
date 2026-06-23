import { useState, useEffect, useMemo } from "react";
import { Target, Plus, Check, Flame, Droplet, Wheat as WheatIcon, Leaf, Activity, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useProfile } from "@/hooks/useProfile";
import { AdaptiveGoalsSettings } from "@/components/AdaptiveGoalsSettings";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { activityLevelLabels, goalLabels } from "@/lib/nutrition-calculator";
import { calculateGoalPlan, type NutritionGoalType } from "@/lib/goal-engine";
import { useLanguage } from "@/contexts/LanguageContext";

type Goal = "lose" | "gain" | "maintain";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

interface DietTag {
  id: string;
  name: string;
  description: string | null;
  category?: string;
}

const goalTypes = [
  { value: "weight_loss", labelKey: "goal_weight_loss", icon: Flame, color: "text-[#F97316]" },
  { value: "muscle_gain", labelKey: "goal_muscle_gain", icon: Target, color: "text-[#7C83F6]" },
  { value: "maintenance", labelKey: "goal_maintenance", icon: Check, color: "text-[#22C7A1]" },
  { value: "general_health", labelKey: "goal_general_health", icon: Leaf, color: "text-[#22C7A1]" },
];

const healthGoalToNutritionGoal: Record<Goal, NutritionGoalType> = {
  lose: "weight_loss",
  maintain: "maintenance",
  gain: "muscle_gain",
};

// Diet tag component
const DietTagCard = ({
  tag,
  selected,
  onClick,
  color,
}: {
  tag: DietTag;
  selected: boolean;
  onClick: () => void;
  color: string;
}) => {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 transition-all duration-300 text-left",
        "border-2",
        selected
          ? "border-[#22C7A1] bg-[#EFFFFA] shadow-md"
          : "border-[#E5EAF1] bg-white hover:border-[#22C7A1]/30 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 mt-0.5",
            selected ? "bg-[#020617]" : "border-2 border-[#94A3B8]/40"
          )}
        >
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-3 h-3 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm text-[#020617]", selected && "text-[#020617]")}>
            {tag.name}
          </p>
          {tag.description && (
            <p className="text-xs text-[#94A3B8] mt-0.5 line-clamp-2">
              {tag.description}
            </p>
          )}
        </div>
      </div>
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
          selected ? color : "bg-transparent"
        )}
      />
    </motion.button>
  );
};

// Activity level card component
const ActivityLevelCard = ({
  level,
  selected,
  onClick,
}: {
  level: ActivityLevel;
  selected: boolean;
  onClick: () => void;
}) => {
  const intensityDots = {
    sedentary: 1,
    light: 2,
    moderate: 3,
    active: 4,
    very_active: 5,
  };

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "relative flex min-h-[62px] w-full items-center gap-3 rounded-3xl p-3 text-left transition-all duration-300",
        "border",
        selected
          ? "border-[#22C7A1] bg-white shadow-[0_12px_30px_rgba(34,199,161,0.16)]"
          : "border-[#E5EAF1] bg-white hover:border-[#22C7A1]/30"
      )}
    >
      <div className="flex shrink-0 gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-all duration-300",
              i < intensityDots[level]
                ? selected
                  ? "bg-[#22C7A1]"
                  : "bg-[#22C7A1]/35"
                : "bg-[#E5EAF1]"
            )}
          />
        ))}
      </div>
      <div className="flex-1">
        <p className={cn("text-[13px] font-extrabold leading-tight text-[#020617]", selected && "text-[#020617]")}>
          {activityLevelLabels[level].title}
        </p>
        <p className="line-clamp-1 text-[11px] font-medium text-[#94A3B8]">
          {activityLevelLabels[level].description}
        </p>
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <Check className="h-4 w-4 text-[#22C7A1]" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// Health Goal card component
const HealthGoalCard = ({
  goal,
  selected,
  onClick,
}: {
  goal: Goal;
  selected: boolean;
  onClick: () => void;
}) => {
  const icons = {
    lose: TrendingUp,
    maintain: Activity,
    gain: Flame,
  };
  const colors = {
    lose: "bg-[#FFF7ED] text-[#F97316]",
    maintain: "bg-[#EFFFFA] text-[#22C7A1]",
    gain: "bg-[#F3F4FF] text-[#7C83F6]",
  };
  const Icon = icons[goal];

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative min-h-[92px] overflow-hidden rounded-3xl p-3 transition-all duration-300",
        "border text-left",
        selected
          ? "border-[#22C7A1] bg-white shadow-[0_14px_35px_rgba(34,199,161,0.16)]"
          : "border-[#E5EAF1] bg-white hover:border-[#22C7A1]/30"
      )}
    >
      <div
        className={cn(
          "mb-2 flex h-9 w-9 items-center justify-center rounded-2xl",
          colors[goal]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="mb-1 text-[13px] font-extrabold leading-tight text-[#020617]">
        {goalLabels[goal].title}
      </p>
      <p className="line-clamp-2 text-[11px] font-medium leading-4 text-[#94A3B8]">
        {goalLabels[goal].description}
      </p>
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#22C7A1]"
          >
            <Check className="h-3.5 w-3.5 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export const GoalsManagement = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { goals, activeGoal, goalEvents, loading, setGoal, updateActiveGoal } = useNutritionGoals(user?.id);
  const { profile, updateProfile } = useProfile();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGoalAppliedDialog, setShowGoalAppliedDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [healthGoal, setHealthGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({
    goal_type: "general_health" as const,
    target_weight_kg: "",
    target_date: "",
    daily_calorie_target: 2000,
    protein_target_g: 120,
    carbs_target_g: 250,
    fat_target_g: 65,
    fiber_target_g: 30,
  });

  const goalPlan = useMemo(() => calculateGoalPlan({
    goalType: formData.goal_type as NutritionGoalType,
    targetWeightKg: formData.target_weight_kg ? parseFloat(formData.target_weight_kg) : null,
    targetDate: formData.target_date || null,
    currentWeightKg: currentWeight ? parseFloat(currentWeight) : profile?.current_weight_kg ?? null,
    heightCm: height ? parseFloat(height) : profile?.height_cm ?? null,
    age: profile?.age ?? null,
    gender: profile?.gender,
    activityLevel: activityLevel || profile?.activity_level,
  }), [activityLevel, currentWeight, formData.goal_type, formData.target_date, formData.target_weight_kg, height, profile]);

  const goalImpactItems = [
    t("goal_impact_meals"),
    t("goal_impact_progress"),
    t("goal_impact_report"),
  ];

  const applyCalculatedPlan = () => {
    setFormData((prev) => ({
      ...prev,
      target_date: prev.target_date || goalPlan.targetDate || "",
      daily_calorie_target: goalPlan.dailyCalorieTarget,
      protein_target_g: goalPlan.proteinTargetG,
      carbs_target_g: goalPlan.carbsTargetG,
      fat_target_g: goalPlan.fatTargetG,
      fiber_target_g: goalPlan.fiberTargetG,
    }));
    setReviewMode(true);
  };

  const openGoalDialog = () => {
    setFormData({
      goal_type: (activeGoal?.goal_type as typeof formData.goal_type) || "general_health",
      target_weight_kg: activeGoal?.target_weight_kg?.toString() || targetWeight || "",
      target_date: activeGoal?.target_date || "",
      daily_calorie_target: activeGoal?.daily_calorie_target || goalPlan.dailyCalorieTarget,
      protein_target_g: activeGoal?.protein_target_g || goalPlan.proteinTargetG,
      carbs_target_g: activeGoal?.carbs_target_g || goalPlan.carbsTargetG,
      fat_target_g: activeGoal?.fat_target_g || goalPlan.fatTargetG,
      fiber_target_g: activeGoal?.fiber_target_g || goalPlan.fiberTargetG,
    });
    setReviewMode(false);
    setShowCreateDialog(true);
  };

  // Load profile data
  useEffect(() => {
    if (profile) {
      setCurrentWeight(profile.current_weight_kg?.toString() || "");
      setTargetWeight(profile.target_weight_kg?.toString() || "");
      setHeight(profile.height_cm?.toString() || "");
      setActivityLevel(profile.activity_level);
      setHealthGoal(profile.health_goal);
    }
  }, [profile]);

  // Diet preferences state
  const [dietTags, setDietTags] = useState<DietTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  // Fetch diet tags and user preferences
  useEffect(() => {
    const fetchDietTagsAndPreferences = async () => {
      try {
        const { data: tags, error: tagsError } = await supabase
          .from("diet_tags")
          .select("*")
          .order("name");

        if (tagsError) throw tagsError;
        setDietTags(tags || []);

        if (user) {
          const { data: prefs, error: prefsError } = await supabase
            .from("user_dietary_preferences")
            .select("diet_tag_id")
            .eq("user_id", user.id);

          if (prefsError) throw prefsError;
          setSelectedTags(prefs?.map((p) => p.diet_tag_id) || []);
        }
      } catch (err) {
        console.error("Error fetching diet tags:", err);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchDietTagsAndPreferences();
  }, [user]);

  const toggleDietPreference = async (tagId: string) => {
    if (!user) return;

    const isSelected = selectedTags.includes(tagId);

    try {
      if (isSelected) {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);

        if (error) throw error;
        setSelectedTags((prev) => prev.filter((id) => id !== tagId));
      } else {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .insert({ user_id: user.id, diet_tag_id: tagId });

        if (error) throw error;
        setSelectedTags((prev) => [...prev, tagId]);
      }
    } catch (err) {
      toast({
        title: t("error_updating_preferences"),
        description: t("please_try_again"),
        variant: "destructive",
      });
    }
  };

  // Get tag colors based on category
  const getTagColor = (index: number) => {
    const colors = [
      "bg-[#22C7A1]",
      "bg-[#7C83F6]",
      "bg-[#F97316]",
      "bg-[#38BDF8]",
      "bg-[#FB6B7A]",
    ];
    return colors[index % colors.length];
  };

  const handleCreateGoal = async () => {
    if (!user) return;

    try {
      setCreating(true);

      const { error } = await updateProfile({
        current_weight_kg: currentWeight ? parseFloat(currentWeight) : null,
        target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
        height_cm: height ? parseFloat(height) : null,
        activity_level: activityLevel,
        health_goal: healthGoal,
      });

      if (error) throw error;

      const payload = {
        goal_type: formData.goal_type,
        target_weight_kg: formData.target_weight_kg ? parseFloat(formData.target_weight_kg) : null,
        target_date: formData.target_date || null,
        daily_calorie_target: formData.daily_calorie_target,
        protein_target_g: formData.protein_target_g,
        carbs_target_g: formData.carbs_target_g,
        fat_target_g: formData.fat_target_g,
        fiber_target_g: formData.fiber_target_g,
        is_active: true,
        calculation_source: "goal_engine",
        reason: goalPlan.summary,
        activity_level_snapshot: activityLevel || profile?.activity_level || null,
      };

      const shouldCreateVersion = !activeGoal || activeGoal.goal_type !== formData.goal_type;
      if (shouldCreateVersion) {
        await setGoal(payload, goalPlan.summary);
      } else {
        const updated = await updateActiveGoal(payload, goalPlan.summary, "recalculated");
        if (!updated) throw new Error("Failed to update goal");
      }

      toast({
        title: shouldCreateVersion ? t("goal_created_successfully") : t("goal_updated"),
        description: t("goal_update_applied_desc"),
      });

      setShowCreateDialog(false);
      setShowGoalAppliedDialog(true);
      setFormData({
        goal_type: "general_health",
        target_weight_kg: "",
        target_date: "",
        daily_calorie_target: 2000,
        protein_target_g: 120,
        carbs_target_g: 250,
        fat_target_g: 65,
        fiber_target_g: 30,
      });
    } catch (error) {
      toast({
        title: t("failed_to_create_goal"),
        description: t("please_try_again"),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getGoalTypeInfo = (type: string) => {
    return goalTypes.find((g) => g.value === type) || goalTypes[3];
  };

  const selectHealthGoal = (goal: Goal) => {
    const nextGoalType = healthGoalToNutritionGoal[goal];
    setHealthGoal(goal);
    setFormData((prev) => ({
      ...prev,
      goal_type: nextGoalType,
    }));
  };

  const activeMacroProfile = useMemo(() => {
    if (!activeGoal) return null;

    const proteinCalories = activeGoal.protein_target_g * 4;
    const carbsCalories = activeGoal.carbs_target_g * 4;
    const fatCalories = activeGoal.fat_target_g * 9;
    const macroCalories = Math.max(proteinCalories + carbsCalories + fatCalories, 1);
    const macroGrams = activeGoal.protein_target_g + activeGoal.carbs_target_g + activeGoal.fat_target_g;

    return {
      macroGrams,
      proteinPct: Math.round((proteinCalories / macroCalories) * 100),
      carbsPct: Math.round((carbsCalories / macroCalories) * 100),
      fatPct: Math.round((fatCalories / macroCalories) * 100),
    };
  }, [activeGoal]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 w-full animate-pulse rounded-[28px] bg-white" />
        <div className="h-48 w-full animate-pulse rounded-[28px] bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Active Goal Card */}
      {activeGoal && (
        <Card className="overflow-hidden rounded-[28px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
          <CardHeader className="bg-white pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                  {(() => {
                    const GoalIcon = getGoalTypeInfo(activeGoal.goal_type).icon;
                    return <GoalIcon className={cn("h-6 w-6", getGoalTypeInfo(activeGoal.goal_type).color)} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("current_goal")}</p>
                  <CardTitle className="mt-0.5 text-[20px] font-black leading-tight text-[#020617]">
                    {t(getGoalTypeInfo(activeGoal.goal_type).labelKey)}
                  </CardTitle>
                  <CardDescription className="truncate text-[12px] font-semibold text-[#94A3B8]">{t("goal_active")}</CardDescription>
                </div>
              </div>
              <Badge className="shrink-0 rounded-full bg-[#EFFFFA] px-3 py-1.5 text-[11px] font-black text-[#22C7A1] hover:bg-[#EFFFFA]">{t("active")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeMacroProfile && (
              <div className="rounded-[26px] border border-[#E5EAF1] bg-white p-4 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">{t("nutrition")}</p>
                    <h3 className="mt-0.5 text-[22px] font-black leading-tight text-[#020617]">{t("nutrition_profile")}</h3>
                    <p className="mt-1 text-[12px] font-semibold text-[#64748B]">{t("calories_macros_fiber")}</p>
                  </div>
                  <span className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#64748B] ring-1 ring-[#E5EAF1]">
                    {t("per_day")}
                  </span>
                </div>

                <div className="grid grid-cols-[122px_1fr] items-center gap-3">
                  <div
                    className="relative flex h-[118px] w-[118px] items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#7C83F6 0 ${activeMacroProfile.proteinPct}%, #F97316 ${activeMacroProfile.proteinPct}% ${activeMacroProfile.proteinPct + activeMacroProfile.carbsPct}%, #FB6B7A ${activeMacroProfile.proteinPct + activeMacroProfile.carbsPct}% 100%)`,
                    }}
                  >
                    <div className="absolute inset-[10px] rounded-full bg-[#E5EAF1]" />
                    <div className="absolute inset-[20px] flex flex-col items-center justify-center rounded-full bg-white">
                      <Flame className="mb-1 h-4 w-4 text-[#F97316]" />
                      <p className="text-[26px] font-black leading-none text-[#020617]">{activeGoal.daily_calorie_target.toLocaleString()}</p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Cal</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5EAF1] bg-[#F3F4FF]">
                        <Target className="h-4 w-4 text-[#7C83F6]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black leading-tight text-[#020617]">{t("nutrient_protein")}</p>
                        <p className="text-[11px] font-bold text-[#94A3B8]">{activeGoal.protein_target_g}g {t("per_day")}</p>
                      </div>
                      <p className="text-[13px] font-black text-[#64748B]">{activeMacroProfile.proteinPct}%</p>
                    </div>
                    <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5EAF1] bg-[#FFF7ED]">
                        <WheatIcon className="h-4 w-4 text-[#F97316]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black leading-tight text-[#020617]">{t("nutrient_carbs")}</p>
                        <p className="text-[11px] font-bold text-[#94A3B8]">{activeGoal.carbs_target_g}g {t("per_day")}</p>
                      </div>
                      <p className="text-[13px] font-black text-[#64748B]">{activeMacroProfile.carbsPct}%</p>
                    </div>
                    <div className="grid grid-cols-[34px_1fr_auto] items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5EAF1] bg-[#FFF0F2]">
                        <Droplet className="h-4 w-4 text-[#FB6B7A]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black leading-tight text-[#020617]">{t("nutrient_fat")}</p>
                        <p className="text-[11px] font-bold text-[#94A3B8]">{activeGoal.fat_target_g}g {t("per_day")}</p>
                      </div>
                      <p className="text-[13px] font-black text-[#64748B]">{activeMacroProfile.fatPct}%</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
                  <div className="h-full bg-[#7C83F6]" style={{ width: `${activeMacroProfile.proteinPct}%` }} />
                  <div className="h-full bg-[#F97316]" style={{ width: `${activeMacroProfile.carbsPct}%` }} />
                  <div className="h-full bg-[#FB6B7A]" style={{ width: `${activeMacroProfile.fatPct}%` }} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E5EAF1]">
                      <Target className="h-4 w-4 text-[#020617]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("macros")}</p>
                      <p className="text-[15px] font-black leading-tight text-[#020617]">{activeMacroProfile.macroGrams}g {t("total")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E5EAF1]">
                      <Leaf className="h-4 w-4 text-[#22C7A1]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("nutrient_fiber")}</p>
                      <p className="text-[15px] font-black leading-tight text-[#020617]">{activeGoal.fiber_target_g ? `${activeGoal.fiber_target_g}g` : "-"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Target Weight & Date */}
            {(activeGoal.target_weight_kg || activeGoal.target_date) && (
              <div className="grid grid-cols-2 gap-2 border-t border-[#E5EAF1] pt-3">
                {activeGoal.target_weight_kg && (
                  <div className="rounded-2xl bg-[#F6F8FB] px-3 py-2 ring-1 ring-[#E5EAF1]">
                    <p className="text-xs font-medium text-[#94A3B8]">{t("target_weight")}</p>
                    <p className="font-extrabold text-[#020617]">{activeGoal.target_weight_kg} kg</p>
                  </div>
                )}
                {activeGoal.target_date && (
                  <div className="rounded-2xl bg-[#F6F8FB] px-3 py-2 ring-1 ring-[#E5EAF1]">
                    <p className="text-xs font-medium text-[#94A3B8]">{t("target_date")}</p>
                    <p className="font-extrabold text-[#020617]">{format(new Date(activeGoal.target_date), "MMM d, yyyy")}</p>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("goal_system_role")}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] font-bold leading-5 text-[#020617]">{activeGoal.reason || t("goal_system_role_desc")}</p>
                  <p className="mt-2 text-[10px] font-bold text-[#94A3B8]">
                    {activeGoal.calculation_source || "manual"} | v{activeGoal.version || 1} | {t("weekly")}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={openGoalDialog}
                  className="h-10 shrink-0 rounded-2xl bg-[#020617] px-3 text-[11px] font-black text-white hover:bg-[#020617]/90"
                >
                  {t("goal_review_update")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeGoal && (
        <Card className="rounded-[28px] border-[#E5EAF1] bg-white shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EFFFFA]">
                <Target className="h-6 w-6 text-[#22C7A1]" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-[#020617]">{t("goal_create_new")}</p>
                <p className="text-sm font-semibold leading-5 text-[#94A3B8]">{t("create_goal_description")}</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={openGoalDialog}
              className="h-[52px] w-full rounded-2xl bg-[#020617] text-base font-extrabold text-white hover:bg-[#020617]/90"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t("goal_create_new")}
            </Button>
          </CardContent>
        </Card>
      )}


      {goalEvents.length > 0 && (
        <details className="group rounded-[28px] border border-[#E5EAF1] bg-white shadow-sm">
          <summary className="flex min-h-[70px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="text-[15px] font-black leading-tight text-[#020617]">{t("goal_change_history")}</p>
              <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-[#94A3B8]">{t("goal_change_history_desc")}</p>
            </div>
            <span className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1] group-open:hidden">
              {t("view")}
            </span>
            <span className="hidden rounded-full bg-[#020617] px-3 py-1.5 text-[11px] font-black text-white group-open:inline-flex">
              {t("close")}
            </span>
          </summary>
          <div className="space-y-2 border-t border-[#E5EAF1] p-3">
            {goalEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-2xl bg-[#F6F8FB] p-3">
                <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#22C7A1]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black capitalize text-[#020617]">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="line-clamp-2 text-xs font-semibold text-[#64748B]">{event.reason || t("goal_updated")}</p>
                </div>
                <p className="shrink-0 text-[10px] font-bold text-[#94A3B8]">
                  {format(new Date(event.created_at), "MMM d")}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}


      {/* Smart Goal Adjustment */}
      <details className="group rounded-[28px] border border-[#E5EAF1] bg-white shadow-sm">
        <summary className="flex min-h-[72px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-black leading-tight text-[#020617]">{t("smart_goal_adjustment")}</p>
              <p className="mt-0.5 line-clamp-1 text-[12px] font-semibold text-[#94A3B8]">{t("smart_goal_adjustment_desc")}</p>
            </div>
          </div>
          <span className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1] group-open:hidden">
            {t("view")}
          </span>
          <span className="hidden rounded-full bg-[#020617] px-3 py-1.5 text-[11px] font-black text-white group-open:inline-flex">
            {t("close")}
          </span>
        </summary>
        <div className="border-t border-[#E5EAF1] p-3">
          <AdaptiveGoalsSettings />
        </div>
      </details>

      {/* Previous Goals */}
      {goals.length > 1 && (
        <details className="group rounded-[28px] border border-[#E5EAF1] bg-white shadow-sm">
          <summary className="flex min-h-[70px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <div className="min-w-0">
              <p className="text-[15px] font-black leading-tight text-[#020617]">{t("previous_goals_title")}</p>
              <p className="mt-0.5 truncate text-[12px] font-semibold text-[#94A3B8]">{goals.length - 1} saved</p>
            </div>
            <span className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1] group-open:hidden">
              {t("view")}
            </span>
            <span className="hidden rounded-full bg-[#020617] px-3 py-1.5 text-[11px] font-black text-white group-open:inline-flex">
              {t("close")}
            </span>
          </summary>

          <div className="flex snap-x gap-3 overflow-x-auto border-t border-[#E5EAF1] p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {goals
              .filter((g) => g.id !== activeGoal?.id)
              .slice(0, 8)
              .map((goal) => {
                const GoalIcon = getGoalTypeInfo(goal.goal_type).icon;
                return (
                  <div
                    key={goal.id}
                    className="min-w-[176px] snap-start rounded-3xl border border-[#E5EAF1] bg-white p-3 shadow-sm"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                        <GoalIcon className={cn("h-[18px] w-[18px]", getGoalTypeInfo(goal.goal_type).color)} />
                      </div>
                      <p className="min-w-0 truncate text-sm font-extrabold text-[#020617]">
                        {t(getGoalTypeInfo(goal.goal_type).labelKey)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-[#FFF7ED] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#F97316]">{t("nutrient_calories")}</p>
                        <p className="text-sm font-black text-[#020617]">{goal.daily_calorie_target.toLocaleString()}</p>
                      </div>
                      <div className="rounded-2xl bg-[#F3F4FF] px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#7C83F6]">{t("nutrient_protein")}</p>
                        <p className="text-sm font-black text-[#020617]">{goal.protein_target_g}g</p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </details>
      )}

      {/* Create New Goal Button */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) {
          setFormData({
            goal_type: "general_health",
            target_weight_kg: "",
            target_date: "",
            daily_calorie_target: 2000,
            protein_target_g: 120,
            carbs_target_g: 250,
            fat_target_g: 65,
            fiber_target_g: 30,
          });
          setReviewMode(false);
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{t("create_new_nutrition_goal")}</DialogTitle>
            <DialogDescription>
              {t("create_goal_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED]">
                  <Flame className="h-5 w-5 text-[#F97316]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#020617]">{t("health_goal_title")}</p>
                  <p className="line-clamp-1 text-[11px] font-semibold text-[#94A3B8]">{t("health_goal_description")}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(["lose", "maintain", "gain"] as Goal[]).map((g) => (
                  <HealthGoalCard
                    key={g}
                    goal={g}
                    selected={healthGoal === g}
                    onClick={() => selectHealthGoal(g)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EFFFFA]">
                  <Activity className="h-5 w-5 text-[#22C7A1]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#020617]">{t("activity_level_title")}</p>
                  <p className="line-clamp-1 text-[11px] font-semibold text-[#94A3B8]">{t("activity_level_description")}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["sedentary", "light", "moderate", "active", "very_active"] as ActivityLevel[]).map((a) => (
                  <ActivityLevelCard
                    key={a}
                    level={a}
                    selected={activityLevel === a}
                    onClick={() => setActivityLevel(a)}
                  />
                ))}
              </div>
            </div>

            {/* Goal Type */}
            <div className="space-y-2">
              <Label>{t("goal_type_label")}</Label>
              <Select
                value={formData.goal_type}
                onValueChange={(value: typeof formData.goal_type) =>
                  setFormData({ ...formData, goal_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {goalTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className={cn("h-4 w-4", type.color)} />
                        {t(type.labelKey)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Weight (Optional) */}
            <div className="space-y-2">
              <Label>{t("target_weight_label")} <span className="text-[#94A3B8]">({t("optional")})</span></Label>
              <Input
                type="number"
                step="0.1"
                placeholder={t("target_weight_placeholder")}
                value={formData.target_weight_kg}
                onChange={(e) => setFormData({ ...formData, target_weight_kg: e.target.value })}
              />
            </div>

            {/* Target Date (Optional) */}
            <div className="space-y-2">
              <Label>{t("target_date_label")} <span className="text-[#94A3B8]">({t("optional")})</span></Label>
              <Input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              />
            </div>

            <div className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("goal_engine_preview")}</p>
                  <h3 className="mt-1 text-lg font-black text-[#020617]">{goalPlan.dailyCalorieTarget.toLocaleString()} {t("kcal")}</h3>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#64748B]">{goalPlan.summary}</p>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-[#E5EAF1]">
                  <p className="text-[10px] font-bold text-[#94A3B8]">TDEE</p>
                  <p className="text-sm font-black text-[#020617]">{goalPlan.tdee}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white p-2 text-center ring-1 ring-[#E5EAF1]">
                  <p className="text-[10px] font-bold text-[#94A3B8]">{t("nutrient_protein")}</p>
                  <p className="text-sm font-black text-[#7C83F6]">{goalPlan.proteinTargetG}g</p>
                </div>
                <div className="rounded-2xl bg-white p-2 text-center ring-1 ring-[#E5EAF1]">
                  <p className="text-[10px] font-bold text-[#94A3B8]">{t("nutrient_carbs")}</p>
                  <p className="text-sm font-black text-[#F97316]">{goalPlan.carbsTargetG}g</p>
                </div>
                <div className="rounded-2xl bg-white p-2 text-center ring-1 ring-[#E5EAF1]">
                  <p className="text-[10px] font-bold text-[#94A3B8]">{t("nutrient_fat")}</p>
                  <p className="text-sm font-black text-[#FB6B7A]">{goalPlan.fatTargetG}g</p>
                </div>
              </div>
              {goalPlan.safetyNote && <p className="mt-3 text-xs font-bold text-[#FB6B7A]">{goalPlan.safetyNote}</p>}
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-11 w-full rounded-2xl border-[#E5EAF1] bg-white text-[#020617]"
                onClick={applyCalculatedPlan}
              >
                {t("goal_apply_calculated_plan")}
              </Button>
            </div>

            {reviewMode && (
              <div className="rounded-[22px] border border-[#22C7A1]/25 bg-[#EFFFFA] p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("goal_before_save_review")}</p>
                <p className="mt-1 text-sm font-bold leading-relaxed text-[#020617]">{t("goal_before_save_desc")}</p>
                <div className="mt-3 space-y-2">
                  {goalImpactItems.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-bold text-[#020617]">
                      <Check className="h-4 w-4 shrink-0 text-[#22C7A1]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Targets */}
            <div className="space-y-3 border-t border-[#E5EAF1] pt-2">
              <Label className="text-base">{t("daily_nutrition_targets")}</Label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-[#F97316]" />
                    {t("nutrient_calories")}
                  </Label>
                  <span className="text-sm font-medium">{formData.daily_calorie_target} {t("kcal")}</span>
                </div>
                <Input
                  type="range"
                  min="1200"
                  max="4000"
                  step="50"
                  value={formData.daily_calorie_target}
                  onChange={(e) =>
                    setFormData({ ...formData, daily_calorie_target: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4 text-[#7C83F6]" />
                    {t("nutrient_protein")}
                  </Label>
                  <span className="text-sm font-medium">{formData.protein_target_g}g</span>
                </div>
                <Input
                  type="range"
                  min="50"
                  max="300"
                  step="5"
                  value={formData.protein_target_g}
                  onChange={(e) =>
                    setFormData({ ...formData, protein_target_g: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <WheatIcon className="h-4 w-4 text-[#F97316]" />
                    {t("nutrient_carbs")}
                  </Label>
                  <span className="text-sm font-medium">{formData.carbs_target_g}g</span>
                </div>
                <Input
                  type="range"
                  min="50"
                  max="500"
                  step="10"
                  value={formData.carbs_target_g}
                  onChange={(e) =>
                    setFormData({ ...formData, carbs_target_g: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Droplet className="h-4 w-4 text-[#FB6B7A]" />
                    {t("nutrient_fat")}
                  </Label>
                  <span className="text-sm font-medium">{formData.fat_target_g}g</span>
                </div>
                <Input
                  type="range"
                  min="20"
                  max="150"
                  step="5"
                  value={formData.fat_target_g}
                  onChange={(e) =>
                    setFormData({ ...formData, fat_target_g: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-[#22C7A1]" />
                    {t("nutrient_fiber")}
                  </Label>
                  <span className="text-sm font-medium">{formData.fiber_target_g}g</span>
                </div>
                <Input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={formData.fiber_target_g}
                  onChange={(e) =>
                    setFormData({ ...formData, fiber_target_g: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <Button
              className="h-12 w-full rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
              onClick={handleCreateGoal}
              disabled={creating}
            >
              {creating ? t("saving") : activeGoal && activeGoal.goal_type === formData.goal_type ? t("goal_update_current") : t("create_goal")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGoalAppliedDialog} onOpenChange={setShowGoalAppliedDialog}>
        <DialogContent className="max-w-md rounded-[28px] border-[#E5EAF1] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#020617]">{t("goal_updated")}</DialogTitle>
            <DialogDescription className="text-sm font-semibold leading-6 text-[#64748B]">
              {t("goal_update_applied_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {goalImpactItems.map((item) => (
              <div key={item} className="rounded-2xl bg-[#F6F8FB] p-3 text-center ring-1 ring-[#E5EAF1]">
                <Check className="mx-auto h-5 w-5 text-[#22C7A1]" />
                <p className="mt-2 text-[11px] font-black leading-snug text-[#020617]">{item}</p>
              </div>
            ))}
          </div>
          <Button
            className="h-12 rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
            onClick={() => setShowGoalAppliedDialog(false)}
          >
            {t("done")}
          </Button>
        </DialogContent>
      </Dialog>



    </div>
  );
};
