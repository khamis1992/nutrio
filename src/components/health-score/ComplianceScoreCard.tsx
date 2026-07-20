import { ArrowDown, ArrowUp, Award, Calendar, Minus, Target, TrendingUp, Utensils } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  getScoreColor,
  getScoreLabel,
  SCORE_WEIGHTS,
} from "@/hooks/useHealthScore";

interface ComplianceScoreCardProps {
  score: number;
  category: "green" | "orange" | "red";
  breakdown?: {
    macro_adherence: number;
    meal_consistency: number;
    weight_logging: number;
    protein_accuracy: number;
  };
  previousScore?: number;
  className?: string;
}

export function ComplianceScoreCard({
  score,
  category,
  breakdown,
  previousScore,
  className,
}: ComplianceScoreCardProps) {
  const colorClass = getScoreColor(category);
  const label = getScoreLabel(category);
  const trend = previousScore !== undefined ? score - previousScore : 0;
  const TrendIcon = trend > 0 ? ArrowUp : trend < 0 ? ArrowDown : Minus;
  const trendColor = trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-gray-500";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          <span className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Health Compliance Score
          </span>
          {previousScore !== undefined && (
            <span className={cn("flex items-center gap-1 text-xs", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-4">
          <div
            className={cn(
              "relative flex h-32 w-32 flex-col items-center justify-center rounded-full border-4",
              colorClass.split(" ")[1],
            )}
          >
            <span className={cn("text-4xl font-bold", colorClass.split(" ")[0])}>
              {Math.round(score)}
            </span>
            <span className={cn("mt-1 text-xs font-medium", colorClass.split(" ")[0])}>
              /100
            </span>
          </div>
        </div>

        <div className="text-center">
          <span className={cn("inline-block rounded-full px-3 py-1 text-sm font-medium", colorClass)}>
            {label}
          </span>
        </div>

        {breakdown && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Score Breakdown
            </p>

            <ScoreBreakdownRow
              icon={Target}
              label="Macro Adherence"
              value={breakdown.macro_adherence}
              weight={SCORE_WEIGHTS.macro_adherence}
            />
            <ScoreBreakdownRow
              icon={Utensils}
              label="Meal Consistency"
              value={breakdown.meal_consistency}
              weight={SCORE_WEIGHTS.meal_consistency}
            />
            <ScoreBreakdownRow
              icon={TrendingUp}
              label="Weight Logging"
              value={breakdown.weight_logging}
              weight={SCORE_WEIGHTS.weight_logging}
            />
            <ScoreBreakdownRow
              icon={Calendar}
              label="Protein Accuracy"
              value={breakdown.protein_accuracy}
              weight={SCORE_WEIGHTS.protein_accuracy}
            />
          </div>
        )}

        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            {score >= 80
              ? "Outstanding. Keep up the excellent work."
              : score >= 60
                ? "Good progress. You're on the right track."
                : "Let's work together to improve your score."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreBreakdownRow({
  icon: Icon,
  label,
  value,
  weight,
}: {
  icon: typeof Target;
  label: string;
  value: number;
  weight: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="flex items-center gap-1">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="font-medium">{Math.round(value)}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
      <p className="text-[10px] text-muted-foreground">Weight: {weight}%</p>
    </div>
  );
}

export function ComplianceScoreBadge({
  score,
  category,
  showLabel = true,
  className,
}: {
  score: number;
  category: "green" | "orange" | "red";
  showLabel?: boolean;
  className?: string;
}) {
  const colorClass = getScoreColor(category);
  const label = getScoreLabel(category);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold", colorClass)}>
        {Math.round(score)}
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      )}
    </div>
  );
}
