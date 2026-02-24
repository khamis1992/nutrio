import { useState } from "react";
import { Target, Plus, Check, Flame, Droplet, Wheat as WheatIcon, Leaf } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { AdaptiveGoalsSettings } from "@/components/AdaptiveGoalsSettings";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const goalTypes = [
  { value: "weight_loss", label: "Weight Loss", icon: Flame, color: "text-orange-500" },
  { value: "muscle_gain", label: "Muscle Gain", icon: Target, color: "text-blue-500" },
  { value: "maintenance", label: "Maintenance", icon: Check, color: "text-green-500" },
  { value: "general_health", label: "General Health", icon: Leaf, color: "text-emerald-500" },
];

export const GoalsManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { goals, activeGoal, loading, setGoal } = useNutritionGoals(user?.id);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
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
        title: "Goal created successfully",
        description: "Your new nutrition goal is now active",
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
        title: "Failed to create goal",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const getGoalTypeInfo = (type: string) => {
    return goalTypes.find((g) => g.value === type) || goalTypes[3];
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
                  <CardTitle className="text-lg">Active Goal</CardTitle>
                  <CardDescription>
                    {getGoalTypeInfo(activeGoal.goal_type).label}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="default" className="bg-primary">Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Targets Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Flame className="h-4 w-4" />
                  <span className="text-xs">Calories</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.daily_calorie_target.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">kcal/day</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Target className="h-4 w-4" />
                  <span className="text-xs">Protein</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.protein_target_g}g</p>
                <p className="text-xs text-muted-foreground">per day</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <WheatIcon className="h-4 w-4" />
                  <span className="text-xs">Carbs</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.carbs_target_g}g</p>
                <p className="text-xs text-muted-foreground">per day</p>
              </div>
              <div className="bg-background rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Droplet className="h-4 w-4" />
                  <span className="text-xs">Fat</span>
                </div>
                <p className="text-xl font-bold">{activeGoal.fat_target_g}g</p>
                <p className="text-xs text-muted-foreground">per day</p>
              </div>
            </div>

            {/* Target Weight & Date */}
            {(activeGoal.target_weight_kg || activeGoal.target_date) && (
              <div className="flex gap-4 pt-2 border-t">
                {activeGoal.target_weight_kg && (
                  <div>
                    <p className="text-xs text-muted-foreground">Target Weight</p>
                    <p className="font-medium">{activeGoal.target_weight_kg} kg</p>
                  </div>
                )}
                {activeGoal.target_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Target Date</p>
                    <p className="font-medium">{format(new Date(activeGoal.target_date), "MMM d, yyyy")}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Smart Goal Adjustment */}
      <AdaptiveGoalsSettings />

      {/* Previous Goals */}
      {goals.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Previous Goals</CardTitle>
            <CardDescription>Your goal history</CardDescription>
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
                          <p className="font-medium">{getGoalTypeInfo(goal.goal_type).label}</p>
                          <p className="text-sm text-muted-foreground">
                            {goal.daily_calorie_target.toLocaleString()} kcal/day
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
            Create New Goal
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Nutrition Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Goal Type */}
            <div className="space-y-2">
              <Label>Goal Type</Label>
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
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Target Weight (Optional) */}
            <div className="space-y-2">
              <Label>Target Weight (kg) <span className="text-muted-foreground">(Optional)</span></Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g., 70"
                value={formData.target_weight_kg}
                onChange={(e) => setFormData({ ...formData, target_weight_kg: e.target.value })}
              />
            </div>

            {/* Target Date (Optional) */}
            <div className="space-y-2">
              <Label>Target Date <span className="text-muted-foreground">(Optional)</span></Label>
              <Input
                type="date"
                value={formData.target_date}
                onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              />
            </div>

            {/* Daily Targets */}
            <div className="space-y-3 pt-2 border-t">
              <Label className="text-base">Daily Nutrition Targets</Label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Calories
                  </Label>
                  <span className="text-sm font-medium">{formData.daily_calorie_target} kcal</span>
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
                    Protein
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
                    Carbs
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
                    Fat
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
                    Fiber
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
              {creating ? "Creating..." : "Create Goal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
