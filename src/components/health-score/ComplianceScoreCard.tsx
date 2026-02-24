import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Utensils, 
  Calendar, 
  Target,
  Award,
  ArrowUp,
  ArrowDown,
  Minus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  getScoreColor, 
  getScoreLabel,
  SCORE_WEIGHTS 
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
  className 
}: ComplianceScoreCardProps) {
  const colorClass = getScoreColor(category);
  const label = getScoreLabel(category);
  
  // Calculate trend
  const trend = previousScore !== undefined ? score - previousScore : 0;
  const TrendIcon = trend > 0 ? ArrowUp : trend < 0 ? ArrowDown : Minus;
  const trendColor = trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-gray-500";

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
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
        {/* Main Score Display */}
        <div className="flex items-center justify-center py-4">
          <div className={cn(
            "relative flex flex-col items-center justify-center w-32 h-32 rounded-full border-4",
            colorClass.split(" ")[1] // Use bg color class
          )}>
            <span className={cn("text-4xl font-bold", colorClass.split(" ")[0])}>
              {Math.round(score)}
            </span>
            <span className={cn("text-xs font-medium mt-1", colorClass.split(" ")[0])}>
              /100
            </span>
          </div>
        </div>

        {/* Score Label */}
        <div className="text-center">
          <span className={cn("inline-block px-3 py-1 rounded-full text-sm font-medium", colorClass)}>
            {label}
          </span>
        </div>

        {/* Breakdown */}
        {breakdown && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Score Breakdown
            </p>
            
            {/* Macro Adherence - 40% */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Macro Adherence
                </span>
                <span className="font-medium">{Math.round(breakdown.macro_adherence)}%</span>
              </div>
              <Progress value={breakdown.macro_adherence} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                Weight: {SCORE_WEIGHTS.macro_adherence}%
              </p>
            </div>

            {/* Meal Consistency - 30% */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Utensils className="h-3 w-3" />
                  Meal Consistency
                </span>
                <span className="font-medium">{Math.round(breakdown.meal_consistency)}%</span>
              </div>
              <Progress value={breakdown.meal_consistency} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                Weight: {SCORE_WEIGHTS.meal_consistency}%
              </p>
            </div>

            {/* Weight Logging - 20% */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Weight Logging
                </span>
                <span className="font-medium">{Math.round(breakdown.weight_logging)}%</span>
              </div>
              <Progress value={breakdown.weight_logging} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                Weight: {SCORE_WEIGHTS.weight_logging}%
              </p>
            </div>

            {/* Protein Accuracy - 10% */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Protein Accuracy
                </span>
                <span className="font-medium">{Math.round(breakdown.protein_accuracy)}%</span>
              </div>
              <Progress value={breakdown.protein_accuracy} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                Weight: {SCORE_WEIGHTS.protein_accuracy}%
              </p>
            </div>
          </div>
        )}

        {/* Motivational Message */}
        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            {score >= 80 
              ? "🔥 Outstanding! Keep up the excellent work!" 
              : score >= 60 
              ? "👍 Good progress! You're on the right track."
              : "💪 Let's work together to improve your score!"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for dashboard
export function ComplianceScoreBadge({ 
  score, 
  category,
  showLabel = true,
  className 
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
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold",
        colorClass
      )}>
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
