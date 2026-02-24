import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Flame, Target, Calendar, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface MacroData {
  consumed: number;
  target: number;
  percentage: number;
}

interface WeeklySummaryProps {
  calories: {
    thisWeekAvg: number;
    lastWeekAvg: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "stable";
  };
  consistency: {
    daysLogged: number;
    totalDays: number;
    percentage: number;
    streak: number;
    bestStreak: number;
  };
  macros: {
    protein: MacroData;
    carbs: MacroData;
    fat: MacroData;
  };
}

export function WeeklySummaryCards({ calories, consistency, macros }: WeeklySummaryProps) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4" />;
      case "down":
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = (trend: string, isCalories: boolean = true) => {
    if (isCalories) {
      // For calories, down is usually good (weight loss)
      switch (trend) {
        case "down":
          return "text-emerald-600";
        case "up":
          return "text-orange-600";
        default:
          return "text-slate-600";
      }
    }
    return "text-slate-600";
  };

  const getMacroColor = (percentage: number) => {
    if (percentage >= 90) return "bg-emerald-500";
    if (percentage >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  const getMacroTextColor = (percentage: number) => {
    if (percentage >= 90) return "text-emerald-600";
    if (percentage >= 70) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      {/* Week Comparison Card */}
      <Card className="border-0 shadow-lg shadow-emerald-500/5 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            This Week vs Last Week
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Calories Comparison */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-lg">{calories.thisWeekAvg} cal</p>
                <p className="text-xs text-slate-500">Daily average</p>
              </div>
            </div>
            <div className={cn("flex items-center gap-1 text-sm", getTrendColor(calories.trend))}>
              {getTrendIcon(calories.trend)}
              <span>{Math.abs(calories.change)} cal</span>
              <span className="text-xs">({calories.changePercent > 0 ? "+" : ""}{calories.changePercent}%)</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Last week: {calories.lastWeekAvg} cal</span>
              <span>This week: {calories.thisWeekAvg} cal</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  calories.trend === "down" ? "bg-emerald-500" : calories.trend === "up" ? "bg-orange-500" : "bg-slate-500"
                )}
                style={{
                  width: `${Math.min(100, (calories.thisWeekAvg / Math.max(calories.lastWeekAvg, calories.thisWeekAvg)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consistency & Streak Card */}
      <Card className="border-0 shadow-lg shadow-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Consistency & Streaks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Consistency */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{consistency.percentage}%</p>
              <p className="text-xs text-slate-500">Consistency</p>
            </div>
            <div className="flex-1 mx-4">
              <Progress value={consistency.percentage} className="h-2" />
            </div>
            <div className="text-right">
              <p className="text-sm font-medium">{consistency.daysLogged}/{consistency.totalDays}</p>
              <p className="text-xs text-slate-500">days</p>
            </div>
          </div>

          {/* Streak Info */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{consistency.streak}</p>
              <p className="text-xs text-slate-500">Current Streak</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-700">{consistency.bestStreak}</p>
              <p className="text-xs text-slate-500">Best Streak</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Macro Targets Card */}
      <Card className="border-0 shadow-lg shadow-emerald-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Macro Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Protein */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Protein</span>
              <span className={cn("font-semibold", getMacroTextColor(macros.protein.percentage))}>
                {macros.protein.consumed}g / {macros.protein.target}g
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getMacroColor(macros.protein.percentage))}
                style={{ width: `${Math.min(100, macros.protein.percentage)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{macros.protein.percentage}% of target</p>
          </div>

          {/* Carbs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Carbs</span>
              <span className={cn("font-semibold", getMacroTextColor(macros.carbs.percentage))}>
                {macros.carbs.consumed}g / {macros.carbs.target}g
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getMacroColor(macros.carbs.percentage))}
                style={{ width: `${Math.min(100, macros.carbs.percentage)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{macros.carbs.percentage}% of target</p>
          </div>

          {/* Fat */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Fat</span>
              <span className={cn("font-semibold", getMacroTextColor(macros.fat.percentage))}>
                {macros.fat.consumed}g / {macros.fat.target}g
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", getMacroColor(macros.fat.percentage))}
                style={{ width: `${Math.min(100, macros.fat.percentage)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">{macros.fat.percentage}% of target</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
