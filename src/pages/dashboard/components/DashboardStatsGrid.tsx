import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Flame,
  Dumbbell,
  Calendar,
  Award,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, subDays } from "date-fns";

interface DashboardStatsGridProps {
  weightLogs: Array<{ id: string; weight_kg: number; logged_at: string }>;
  adjustments: Array<{
    id: string;
    adjustment_type: string;
    ai_reason: string;
    confidence_score: number;
    was_accepted: boolean;
    created_at: string;
    previous_values: Record<string, unknown> | null;
    new_values: Record<string, unknown> | null;
  }>;
  weeklyStats: Array<{
    week_start: string;
    adherence_rate: number;
    meals_planned: number;
    meals_ordered: number;
  }>;
  nutritionData: {
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fats: number;
    bmr: number;
    tdee: number;
  } | null;
  calculateWeightChange: () => number;
  averageAdherence: () => number;
  onRefresh: () => void;
}

export function DashboardStatsGrid({
  weightLogs,
  adjustments,
  weeklyStats,
  nutritionData,
  calculateWeightChange,
  averageAdherence,
  onRefresh
}: DashboardStatsGridProps) {
  const weightChange = calculateWeightChange();
  const avgAdherence = averageAdherence();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Weight Change</span>
            {weightChange < 0 ? (
              <TrendingDown className="w-4 h-4 text-primary" />
            ) : (
              <TrendingUp className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className={cn(
              "text-2xl font-bold",
              weightChange < 0 ? "text-primary" : "text-primary"
            )}>
              {weightChange > 0 ? "+" : ""}{weightChange}
            </span>
            <span className="text-sm text-muted-foreground">kg</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan Adherence</span>
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-2xl font-bold text-primary">
              {avgAdherence}
            </span>
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <Progress value={avgAdherence} className="mt-2 h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Daily Calories</span>
            <Flame className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold text-warning mt-2">
            {nutritionData?.target_calories || 2000}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Target</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">AI Adjustments</span>
            <AlertCircle className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold text-warning mt-2">
            {adjustments.length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total made</p>
        </CardContent>
      </Card>
    </div>
  );
}
