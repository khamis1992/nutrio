import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

interface ProgressRingsProps {
  weeklySummary: {
    consistency: { percentage: number };
    macros: {
      protein: { percentage: number };
      carbs: { percentage: number };
      fat: { percentage: number };
    };
  } | null;
  waterPercentage: number;
  mealQualityScore: number;
  loading: boolean;
}

interface RingProps {
  percentage: number;
  color: string;
  size: number;
  strokeWidth: number;
  label: string;
  sublabel?: string;
}

function ProgressRing({ percentage, color, size, strokeWidth, label, sublabel }: RingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{Math.round(percentage)}%</span>
        </div>
      </div>
      <p className="text-sm font-medium text-slate-700 mt-2">{label}</p>
      {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
    </div>
  );
}

export function ProgressRings({
  weeklySummary,
  waterPercentage,
  mealQualityScore,
  loading,
}: ProgressRingsProps) {
  if (loading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse h-40 rounded-lg bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  // Calculate overall health score
  const macroAvg = weeklySummary
    ? (weeklySummary.macros.protein.percentage +
        weeklySummary.macros.carbs.percentage +
        weeklySummary.macros.fat.percentage) /
      3
    : 0;

  const overallScore = Math.round(
    (weeklySummary?.consistency.percentage || 0) * 0.3 +
      macroAvg * 0.3 +
      waterPercentage * 0.2 +
      mealQualityScore * 0.2
  );

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          Overall Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Large Overall Score */}
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <div
              className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${
                overallScore >= 80
                  ? "border-emerald-500 bg-emerald-50"
                  : overallScore >= 60
                  ? "border-amber-500 bg-amber-50"
                  : "border-red-500 bg-red-50"
              }`}
            >
              <span
                className={`text-3xl font-bold ${
                  overallScore >= 80
                    ? "text-emerald-700"
                    : overallScore >= 60
                    ? "text-amber-700"
                    : "text-red-700"
                }`}
              >
                {overallScore}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-700 mt-2">Health Score</p>
            <p className="text-xs text-slate-400">
              {overallScore >= 80 ? "Excellent!" : overallScore >= 60 ? "Good progress" : "Keep pushing"}
            </p>
          </div>
        </div>

        {/* Individual Rings */}
        <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-100">
          <ProgressRing
            percentage={weeklySummary?.consistency.percentage || 0}
            color="hsl(199 89% 48%)"
            size={70}
            strokeWidth={6}
            label="Log"
            sublabel="Consistency"
          />
          <ProgressRing
            percentage={macroAvg}
            color="hsl(38 92% 50%)"
            size={70}
            strokeWidth={6}
            label="Macros"
            sublabel="Average"
          />
          <ProgressRing
            percentage={waterPercentage}
            color="hsl(199 89% 48%)"
            size={70}
            strokeWidth={6}
            label="Water"
            sublabel="Hydration"
          />
          <ProgressRing
            percentage={mealQualityScore}
            color="hsl(270 50% 60%)"
            size={70}
            strokeWidth={6}
            label="Quality"
            sublabel="Meals"
          />
        </div>
      </CardContent>
    </Card>
  );
}
