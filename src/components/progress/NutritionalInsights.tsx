import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

interface Insight {
  id: string;
  type: "success" | "warning" | "info" | "tip";
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NutritionalInsightsProps {
  todayStats: {
    calories: number;
    targetCalories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  weeklyStats: {
    avgCalories: number;
    avgProtein: number;
    daysLogged: number;
  } | null;
}

export function NutritionalInsights({ todayStats, weeklyStats }: NutritionalInsightsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];

    // Calorie insights
    const calorieDiff = todayStats.calories - todayStats.targetCalories;
    if (todayStats.calories === 0) {
      insights.push({
        id: "no-calories",
        type: "warning",
        title: "No meals logged today",
        message: "Start logging your meals to track your nutrition goals.",
      });
    } else if (calorieDiff > 500) {
      insights.push({
        id: "high-calories",
        type: "warning",
        title: "Calorie intake is high",
        message: `You're ${calorieDiff} calories above your daily target. Consider lighter options for your next meal.`,
      });
    } else if (calorieDiff < -800) {
      insights.push({
        id: "low-calories",
        type: "info",
        title: "Low calorie intake",
        message: `You're ${Math.abs(calorieDiff)} calories under your target. Make sure you're eating enough to fuel your body.`,
      });
    } else if (Math.abs(calorieDiff) <= 100) {
      insights.push({
        id: "on-target",
        type: "success",
        title: "On target!",
        message: "Great job! Your calorie intake is right on track with your goal.",
      });
    }

    // Protein insights
    const proteinTarget = 120; // grams
    const proteinPercentage = (todayStats.protein / proteinTarget) * 100;
    if (todayStats.protein > 0 && proteinPercentage < 50 && todayStats.calories > 0) {
      insights.push({
        id: "low-protein",
        type: "tip",
        title: "Boost your protein",
        message: `You've only reached ${Math.round(proteinPercentage)}% of your protein goal. Try adding lean meats, fish, or legumes to your next meal.`,
      });
    } else if (proteinPercentage >= 100) {
      insights.push({
        id: "protein-goal",
        type: "success",
        title: "Protein goal reached!",
        message: "Excellent work! You've hit your protein target for today.",
      });
    }

    // Weekly insights
    if (weeklyStats) {
      if (weeklyStats.daysLogged < 3) {
        insights.push({
          id: "low-logging",
          type: "info",
          title: "Track more consistently",
          message: `You've logged ${weeklyStats.daysLogged} day${weeklyStats.daysLogged === 1 ? "" : "s"} this week. Consistent tracking helps you stay on top of your goals.`,
        });
      }

      const avgDiff = weeklyStats.avgCalories - todayStats.targetCalories;
      if (Math.abs(avgDiff) > 200) {
        insights.push({
          id: "weekly-trend",
          type: avgDiff > 0 ? "warning" : "info",
          title: avgDiff > 0 ? "Weekly average is high" : "Weekly average is low",
          message: `Your weekly average is ${Math.round(weeklyStats.avgCalories)} calories, which is ${Math.abs(Math.round(avgDiff))} calories ${avgDiff > 0 ? "above" : "below"} your daily target.`,
        });
      }
    }

    // General tips
    if (insights.length < 3) {
      const tips = [
        {
          id: "hydration-tip",
          title: "Stay hydrated",
          message: "Drinking water before meals can help with portion control and digestion.",
        },
        {
          id: "balance-tip",
          title: "Aim for balance",
          message: "Try to include protein, complex carbs, and healthy fats in each meal.",
        },
        {
          id: "timing-tip",
          title: "Meal timing matters",
          message: "Spacing meals evenly throughout the day helps maintain energy levels.",
        },
      ];

      const randomTip = tips[Math.floor(Math.random() * tips.length)];
      insights.push({
        ...randomTip,
        type: "tip",
      });
    }

    return insights.slice(0, 4); // Max 4 insights
  };

  const insights = generateInsights().filter((i) => !dismissed.has(i.id));

  const getIcon = (type: Insight["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case "tip":
        return <Lightbulb className="w-5 h-5 text-purple-500" />;
      default:
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = (type: Insight["type"]) => {
    switch (type) {
      case "success":
        return "bg-emerald-50 border-emerald-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      case "tip":
        return "bg-purple-50 border-purple-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Insights & Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-3 rounded-lg border ${getStyles(insight.type)} transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getIcon(insight.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900">{insight.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{insight.message}</p>
                  {insight.action && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={insight.action.onClick}
                      className="p-0 h-auto mt-1 text-xs"
                    >
                      {insight.action.label}
                      <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Button>
                  )}
                </div>
                <button
                  onClick={() => setDismissed(new Set([...dismissed, insight.id]))}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <TrendingDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {insights.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-200" />
              <p className="text-sm">All caught up! No new insights.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
