import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, Trophy, TrendingUp, CheckCircle2, Lock } from "lucide-react";

interface GoalsMilestonesProps {
  activeGoal: {
    goal_type: string;
    target_weight_kg: number | null;
    daily_calorie_target: number;
    protein_target_g: number;
    carbs_target_g: number;
    fat_target_g: number;
    fiber_target_g: number;
  } | null;
  milestones: Array<{
    id: string;
    description: string;
    milestone_value: number | null;
    achieved_at: string;
    is_celebrated: boolean;
    icon_emoji: string;
  }>;
  loading: boolean;
  currentWeight: number;
}

const goalTypeLabels: Record<string, string> = {
  weight_loss: "Weight Loss",
  muscle_gain: "Muscle Gain",
  maintenance: "Maintenance",
  general_health: "General Health",
};

export function GoalsMilestones({
  activeGoal,
  milestones,
  loading,
  currentWeight,
}: GoalsMilestonesProps) {
  if (loading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-500" />
            Goals & Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse space-y-3">
            <div className="h-20 rounded-lg bg-slate-100" />
            <div className="h-16 rounded-lg bg-slate-100" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate weight progress
  const weightProgress =
    activeGoal?.target_weight_kg && currentWeight
      ? Math.min(
          100,
          Math.max(
            0,
            100 -
              (Math.abs(currentWeight - activeGoal.target_weight_kg) /
                Math.abs(currentWeight - activeGoal.target_weight_kg + 10)) *
                100
          )
        )
      : 0;

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-500" />
          Goals & Milestones
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Active Goal */}
        {activeGoal ? (
          <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span className="font-medium text-emerald-900">
                {goalTypeLabels[activeGoal.goal_type] || "Active Goal"}
              </span>
            </div>

            {activeGoal.target_weight_kg && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">Weight Goal</span>
                  <span className="font-medium text-slate-900">
                    {currentWeight.toFixed(1)} → {activeGoal.target_weight_kg} kg
                  </span>
                </div>
                <Progress value={weightProgress} className="h-2" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-white/50">
                <span className="text-slate-500">Calories</span>
                <p className="font-medium text-slate-900">{activeGoal.daily_calorie_target}</p>
              </div>
              <div className="p-2 rounded bg-white/50">
                <span className="text-slate-500">Protein</span>
                <p className="font-medium text-slate-900">{activeGoal.protein_target_g}g</p>
              </div>
              <div className="p-2 rounded bg-white/50">
                <span className="text-slate-500">Carbs</span>
                <p className="font-medium text-slate-900">{activeGoal.carbs_target_g}g</p>
              </div>
              <div className="p-2 rounded bg-white/50">
                <span className="text-slate-500">Fiber</span>
                <p className="font-medium text-slate-900">{activeGoal.fiber_target_g}g</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <Target className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">No active goal set</p>
            <Button variant="link" size="sm" className="mt-1">
              Set your first goal
            </Button>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="pt-2">
            <p className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              Milestones
            </p>
            <div className="space-y-2">
              {milestones.slice(0, 5).map((milestone) => (
                <div
                  key={milestone.id}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    milestone.achieved_at ? "bg-amber-50 border border-amber-100" : "bg-slate-50"
                  }`}
                >
                  {milestone.achieved_at ? (
                    <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0" />
                  ) : (
                    <Lock className="w-5 h-5 text-slate-300 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        milestone.achieved_at ? "text-amber-900" : "text-slate-600"
                      }`}
                    >
                      {milestone.description}
                    </p>
                    {milestone.milestone_value && (
                      <p className="text-xs text-slate-500">
                        Target: {milestone.milestone_value}
                      </p>
                    )}
                  </div>
                  {milestone.achieved_at && (
                    <span className="text-xs font-medium text-amber-600">Achieved!</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {milestones.length === 0 && activeGoal && (
          <div className="text-center py-4 text-slate-400">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-slate-200" />
            <p className="text-xs">Complete goals to unlock milestones</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
