import { useState, useEffect } from "react";
import { Target, Plus, Check, Flame, Droplet, Wheat as WheatIcon, Leaf, Utensils, Loader2, Scale, Ruler, Activity, TrendingUp } from "lucide-react";
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
  DialogTrigger,
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
  { value: "weight_loss", labelKey: "goal_weight_loss", icon: Flame, color: "text-orange-500" },
  { value: "muscle_gain", labelKey: "goal_muscle_gain", icon: Target, color: "text-blue-500" },
  { value: "maintenance", labelKey: "goal_maintenance", icon: Check, color: "text-green-500" },
  { value: "general_health", labelKey: "goal_general_health", icon: Leaf, color: "text-emerald-500" },
];

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
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 transition-all duration-300 text-left",
        "border-2",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/20 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 mt-0.5",
            selected ? "bg-primary" : "border-2 border-muted-foreground/30"
          )}
        >
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-3 h-3 text-primary-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm", selected && "text-primary")}>
            {tag.name}
          </p>
          {tag.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
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
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "relative w-full text-left p-4 rounded-xl transition-all duration-300",
        "border-2 flex items-center gap-4",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/20 hover:bg-muted/50"
      )}
    >
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i < intensityDots[level]
                ? selected
                  ? "bg-primary"
                  : "bg-primary/40"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
      <div className="flex-1">
        <p className={cn("font-medium", selected && "text-primary")}>
          {activityLevelLabels[level].title}
        </p>
        <p className="text-sm text-muted-foreground">
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
            <Check className="w-5 h-5 text-primary" />
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
    lose: "from-blue-500/20 to-cyan-500/20 text-blue-600",
    maintain: "from-green-500/20 to-emerald-500/20 text-green-600",
    gain: "from-amber-500/20 to-orange-500/20 text-amber-600",
  };
  const Icon = icons[goal];

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
        "border-2 text-left",
        selected
          ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10"
          : "border-border bg-card hover:border-primary/30 hover:shadow-md"
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br",
          colors[goal]
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <p className="font-semibold text-foreground mb-1">
        {goalLabels[goal].title}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {goalLabels[goal].description}
      </p>
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
          >
            <Check className="w-4 h-4 text-primary-foreground" />
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
  const { goals, activeGoal, loading, setGoal } = useNutritionGoals(user?.id);
  const { profile, updateProfile } = useProfile();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
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

  // Body metrics and goals state
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [healthGoal, setHealthGoal] = useState<Goal | null>(null);

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
      "bg-green-500",
      "bg-emerald-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-sky-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-violet-500",
    ];
    return colors[index % colors.length];
  };

  const handleCreateGoal = async () => {
    if (!user) return;

    try {
      setCreating(true);

      await setGoal({
        goal_type: formData.goal_type,
        target_weight_kg: formData.target_weight_kg ? parseFloat(formData.target_weight_kg) : null,
        target_date: formData.target_date || null,
        daily_calorie_target: formData.daily_calorie_target,
        protein_target_g: formData.protein_target_g,
        carbs_target_g: formData.carbs_target_g,
        fat_target_g: formData.fat_target_g,
        fiber_target_g: formData.fiber_target_g,
        is_active: true,
      });

      toast({
        title: t("goal_created_successfully"),
        description: t("new_nutrition_goal_active"),
      });

      setShowCreateDialog(false);
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

  const saveBodyMetrics = async () => {
    setSavingProfile(true);
    try {
      const { error } = await updateProfile({
        current_weight_kg: currentWeight ? parseFloat(currentWeight) : null,
        target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
        height_cm: height ? parseFloat(height) : null,
        activity_level: activityLevel,
        health_goal: healthGoal,
      });

      if (error) throw error;

      toast({
        title: t("profile_updated"),
        description: t("body_metrics_goals_saved"),
      });
    } catch (err) {
      toast({
        title: t("error_saving_profile"),
        description: t("please_try_again"),
        variant: "destructive",
      });
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 w-full bg-muted animate-pulse rounded-lg" />
        <div className="h-48 w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Goal Card */}
      {activeGoal && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {(() => {
                    const GoalIcon = getGoalTypeInfo(activeGoal.goal_type).icon;
                    return <GoalIcon className={cn("h-6 w-6", getGoalTypeInfo(activeGoal.goal_type).color)} />;
                  })()}
                </div>
                <div>
                  <CardTitle className="text-lg">{t("goal_active")}</CardTitle>
                  <CardDescription>
                    {t(getGoalTypeInfo(activeGoal.goal_type).labelKey)}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="default" className="bg-primary">{t("active")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Targets Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Flame className="h-4 w-4" />
                  <span className="text-xs">{t("nutrient_calories")}</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.daily_calorie_target.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t("kcal_per_day")}</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-xs">{t("nutrient_protein")}</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.protein_target_g}g</p>
                <p className="text-xs text-muted-foreground">{t("per_day")}</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <WheatIcon className="h-4 w-4" />
                  <span className="text-xs">{t("nutrient_carbs")}</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.carbs_target_g}g</p>
                <p className="text-xs text-muted-foreground">{t("per_day")}</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Droplet className="h-4 w-4" />
                  <span className="text-xs">{t("nutrient_fat")}</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.fat_target_g}g</p>
                <p className="text-xs text-muted-foreground">{t("per_day")}</p>
              </div>
            </div>

            {/* Target Weight & Date */}
            {(activeGoal.target_weight_kg || activeGoal.target_date) && (
              <div className="flex gap-4 pt-2 border-t">
                {activeGoal.target_weight_kg && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t("target_weight")}</p>
                    <p className="font-medium">{activeGoal.target_weight_kg} kg</p>
                  </div>
                )}
                {activeGoal.target_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t("target_date")}</p>
                    <p className="font-medium">{format(new Date(activeGoal.target_date), "MMM d, yyyy")}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Body Metrics */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("body_metrics_title")}</CardTitle>
              <CardDescription>{t("body_metrics_description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("body_metrics_current_weight")}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  placeholder={t("body_metrics_current_weight_placeholder")}
                  className="h-12 rounded-xl"
                />
                <Scale className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("body_metrics_target_weight")}</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  placeholder={t("body_metrics_target_weight_placeholder")}
                  className="h-12 rounded-xl"
                />
                <Target className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("body_metrics_height")}</Label>
            <div className="relative">
              <Input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder={t("body_metrics_height_placeholder")}
                className="h-12 rounded-xl"
              />
              <Ruler className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Goal */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Flame className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("health_goal_title")}</CardTitle>
              <CardDescription>{t("health_goal_description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["lose", "maintain", "gain"] as Goal[]).map((g) => (
              <HealthGoalCard
                key={g}
                goal={g}
                selected={healthGoal === g}
                onClick={() => setHealthGoal(g)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Activity Level */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("activity_level_title")}</CardTitle>
              <CardDescription>{t("activity_level_description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(["sedentary", "light", "moderate", "active", "very_active"] as ActivityLevel[]).map((a) => (
            <ActivityLevelCard
              key={a}
              level={a}
              selected={activityLevel === a}
              onClick={() => setActivityLevel(a)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Save Button */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={saveBodyMetrics}
          disabled={savingProfile}
          className="w-full h-12 rounded-xl text-base font-medium"
        >
          {savingProfile ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              {t("saving")}
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              {t("save_body_metrics_goals")}
            </>
          )}
        </Button>
      </motion.div>

      {/* Smart Goal Adjustment */}
      <AdaptiveGoalsSettings />

      {/* Previous Goals */}
      {goals.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("previous_goals_title")}</CardTitle>
            <CardDescription>{t("previous_goals_description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {goals
                .filter((g) => g.id !== activeGoal?.id)
                .map((goal) => {
                  const GoalIcon = getGoalTypeInfo(goal.goal_type).icon;
                  return (
                    <div
                      key={goal.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <GoalIcon className={cn("h-5 w-5", getGoalTypeInfo(goal.goal_type).color)} />
                        </div>
                        <div>
                          <p className="font-medium">{t(getGoalTypeInfo(goal.goal_type).labelKey)}</p>
                          <p className="text-sm text-muted-foreground">
                            {goal.daily_calorie_target.toLocaleString()} {t("kcal_per_day")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create New Goal Button */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Button className="w-full h-12 text-base font-medium" size="lg">
            <Plus className="w-5 h-5 mr-2" />
            {t("goal_create_new")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("create_new_nutrition_goal")}</DialogTitle>
            <DialogDescription>
              {t("create_goal_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
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
              <Label>{t("target_weight_label")} <span className="text-muted-foreground">({t("optional")})</span></Label>
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
              <Label>{t("target_date_label")} <span className="text-muted-foreground">({t("optional")})</span></Label>
              <Input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              />
            </div>

            {/* Daily Targets */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-base">{t("daily_nutrition_targets")}</Label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
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
                    <Target className="h-4 w-4 text-blue-500" />
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
                    <WheatIcon className="h-4 w-4 text-yellow-500" />
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
                    <Droplet className="h-4 w-4 text-cyan-500" />
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
                    <Leaf className="h-4 w-4 text-green-500" />
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
              className="w-full"
              onClick={handleCreateGoal}
              disabled={creating}
            >
              {creating ? t("creating") : t("create_goal")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dietary Preferences Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <Utensils className="w-5 h-5 text-teal-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("dietary_preferences_title")}</CardTitle>
              <CardDescription>
                {t("dietary_preferences_description")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tagsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : dietTags.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Utensils className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {t("no_dietary_preferences")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dietTags.map((tag, index) => (
                <DietTagCard
                  key={tag.id}
                  tag={tag}
                  selected={selectedTags.includes(tag.id)}
                  onClick={() => toggleDietPreference(tag.id)}
                  color={getTagColor(index)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
};
