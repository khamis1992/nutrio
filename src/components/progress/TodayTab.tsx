import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Flame,
  Target,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { WeightPredictionChart } from "@/components/WeightPredictionChart";

interface TodayTabProps {
  calorieProgress: number;
  proteinProgress: number;
  todayCalories: number;
  dailyCalorieTarget: number;
  todayProtein: number;
  dailyProteinTarget: number;
  waterProgress: number;
  todayBurned: number;
  averageScore: number | undefined;
  qualityLoading: boolean;
  recommendations: Array<{ title: string; description: string }>;
  predictions: Array<{
    date: string;
    predicted_weight: number;
    confidence_lower: number;
    confidence_upper: number;
  }>;
  weightChartData: Array<{
    date: string;
    label: string;
    actual: number | null;
    predicted: number | null;
    lower: number | null;
    upper: number | null;
  }>;
  currentWeight: number;
  targetWeight: number;
}

export const TodayTab = ({
  calorieProgress,
  proteinProgress,
  todayCalories,
  dailyCalorieTarget,
  todayProtein,
  dailyProteinTarget,
  todayBurned,
  averageScore,
  qualityLoading,
  recommendations,
  predictions,
  weightChartData,
  currentWeight,
  targetWeight,
}: TodayTabProps) => {
  const { t } = useLanguage();

  return (
    <>
      {/* Today Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="font-bold text-slate-900">{t("todays_progress")}</h3>
          <p className="text-xs text-slate-500">{format(new Date(), "EEEE, MMM d")}</p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white",
          (calorieProgress + proteinProgress) / 2 >= 80 ? "bg-emerald-500" :
          (calorieProgress + proteinProgress) / 2 >= 50 ? "bg-amber-500" : "bg-orange-500"
        )}>
          <div className="w-1.5 h-1.5 rounded-full bg-white/70" />
          {(calorieProgress + proteinProgress) / 2 >= 80 ? t("great") :
           (calorieProgress + proteinProgress) / 2 >= 50 ? t("good") : t("keep_going")}
        </div>
      </div>

      {/* Ring Gauge Cards — Calories & Protein */}
      <div className="grid grid-cols-2 gap-3">
        {/* Calories Ring */}
        <div className="relative rounded-2xl bg-white p-4 shadow-sm flex flex-col items-center">
          <p className="text-sm font-semibold text-slate-700 mb-3">{t("calories")}</p>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#calGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${Math.min(calorieProgress, 100) * 2.639} 263.9`}
                className="transition-all duration-700"
              />
              <defs>
                <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-300/40">
                <Flame className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-lg font-bold text-slate-900">
              <span className="text-orange-500">{todayCalories}</span>
              <span className="text-slate-400 text-sm font-normal">/{dailyCalorieTarget}</span>
            </p>
            <p className="text-xs text-slate-400">{calorieProgress}% {t("of_goal")}</p>
          </div>
        </div>

        {/* Protein Ring */}
        <div className="relative rounded-2xl bg-white p-4 shadow-sm flex flex-col items-center">
          <p className="text-sm font-semibold text-slate-700 mb-3">{t("protein")}</p>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="url(#proGrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${Math.min(proteinProgress, 100) * 2.639} 263.9`}
                className="transition-all duration-700"
              />
              <defs>
                <linearGradient id="proGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-300/40">
                <Target className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          <div className="mt-3 text-center">
            <p className="text-lg font-bold text-slate-900">
              <span className="text-blue-500">{todayProtein}g</span>
              <span className="text-slate-400 text-sm font-normal">/{dailyProteinTarget}g</span>
            </p>
            <p className="text-xs text-slate-400">{proteinProgress}% {t("of_goal")}</p>
          </div>
        </div>
      </div>

      {/* Burned — Horizontal bar */}
      <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-semibold text-slate-700">{t("burned")}</span>
          </div>
          <div className="flex-1 h-2 rounded-full bg-amber-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
              style={{ width: `${Math.min((todayBurned / 500) * 100, 100)}%` }}
            />
          </div>
          <div className="shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-bold px-3 py-1 rounded-lg">
            {todayBurned} cal
          </div>
        </div>
        <p className="text-xs text-slate-400 px-4 pb-3 -mt-1">{todayBurned > 0 ? t("from_activities") : t("no_activities_yet")}</p>
      </div>

      {/* Meal Quality */}
      {!qualityLoading && (
        <div className="rounded-2xl bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-base font-bold text-slate-900">{t("meal_quality")}</p>
              <p className="text-xs text-slate-400">{t("todays_score")}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11">
                <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#d1fae5" strokeWidth="4" />
                  <circle
                    cx="22" cy="22" r="18" fill="none"
                    stroke="#10b981" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={`${Math.min((averageScore || 0) * 1.131, 113.1)} 113.1`}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-emerald-600">{averageScore || 0}</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300" />
            </div>
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recommendations.length > 0 && (
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900 text-sm">
                  {recommendations[0].title}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {recommendations[0].description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weight Prediction Chart — always rendered, shows empty state when no data */}
      <WeightPredictionChart
        predictions={predictions}
        weightChartData={weightChartData}
        currentWeight={currentWeight}
        targetWeight={targetWeight}
      />
    </>
  );
};
