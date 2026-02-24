import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Utensils, Award, CheckCircle2, XCircle, Salad } from "lucide-react";

interface MealQualityEntry {
  id: string;
  log_date: string;
  meal_quality_score: number;
  protein_present: boolean;
  vegetables_count: number;
  whole_grains: boolean;
  added_sugars: boolean;
  overall_grade: string;
}

interface MealQualityScoreProps {
  todayQuality: MealQualityEntry[];
  averageScore: number;
  loading: boolean;
}

const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  C: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  D: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  F: { bg: "bg-red-100", text: "text-red-700", border: "border-red-200" },
};

export function MealQualityScore({ todayQuality, averageScore, loading }: MealQualityScoreProps) {
  if (loading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="w-4 h-4 text-indigo-500" />
            Meal Quality Score
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse space-y-3">
            <div className="h-20 rounded-lg bg-slate-100" />
            <div className="h-12 rounded-lg bg-slate-100" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallGrade =
    averageScore >= 90 ? "A" : averageScore >= 80 ? "B" : averageScore >= 70 ? "C" : averageScore >= 60 ? "D" : "F";

  const gradeStyle = gradeColors[overallGrade] || gradeColors.F;

  // Calculate nutrition stats from today's meals
  const totalMeals = todayQuality.length;
  const proteinCount = todayQuality.filter(m => m.protein_present).length;
  const wholeGrainCount = todayQuality.filter(m => m.whole_grains).length;
  const lowSugarCount = todayQuality.filter(m => !m.added_sugars).length;
  const totalVegetables = todayQuality.reduce((sum, m) => sum + (m.vegetables_count || 0), 0);

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Utensils className="w-4 h-4 text-indigo-500" />
          Meal Quality Score
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Overall Score */}
        <div className="flex items-center gap-4">
          <div
            className={`w-16 h-16 rounded-2xl ${gradeStyle.bg} ${gradeStyle.text} border-2 ${gradeStyle.border} flex items-center justify-center`}
          >
            <span className="text-2xl font-bold">{overallGrade}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900">{averageScore}</span>
              <span className="text-slate-500">/ 100</span>
            </div>
            <p className="text-xs text-slate-500">7-day average quality score</p>
            <div className="mt-2">
              <Progress value={averageScore} className="h-2" />
            </div>
          </div>
        </div>

        {/* Today's Nutrition Summary */}
        {totalMeals > 0 && (
          <div className="p-3 rounded-lg bg-slate-50 space-y-2">
            <p className="text-xs font-medium text-slate-700 mb-2">
              Today&apos;s Meals ({totalMeals} logged)
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded bg-white">
                {proteinCount > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-300" />
                )}
                <span className="text-xs text-slate-600">
                  {proteinCount}/{totalMeals} with protein
                </span>
              </div>
              
              <div className="flex items-center gap-2 p-2 rounded bg-white">
                <Salad className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-slate-600">
                  {totalVegetables} veggie servings
                </span>
              </div>
              
              <div className="flex items-center gap-2 p-2 rounded bg-white">
                {wholeGrainCount > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-300" />
                )}
                <span className="text-xs text-slate-600">
                  {wholeGrainCount}/{totalMeals} whole grains
                </span>
              </div>
              
              <div className="flex items-center gap-2 p-2 rounded bg-white">
                {lowSugarCount > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-300" />
                )}
                <span className="text-xs text-slate-600">
                  {lowSugarCount}/{totalMeals} low sugar
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Meal List */}
        {todayQuality.length > 0 && (
          <div className="space-y-2">
            {todayQuality.map((meal, index) => (
              <div key={meal.id} className="flex items-center gap-3 p-2 rounded bg-white border border-slate-100">
                <span className="text-xs text-slate-400 w-6">#{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {meal.protein_present && <span className="text-xs" title="Protein">🥩</span>}
                      {meal.vegetables_count > 0 && (
                        <span className="text-xs" title={`${meal.vegetables_count} vegetables`}>
                          🥬x{meal.vegetables_count}
                        </span>
                      )}
                      {meal.whole_grains && <span className="text-xs" title="Whole grains">🌾</span>}
                      {meal.added_sugars && <span className="text-xs" title="Added sugars">🍬</span>}
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        gradeColors[meal.overall_grade]?.bg || "bg-slate-100"
                      } ${gradeColors[meal.overall_grade]?.text || "text-slate-600"}`}
                    >
                      {meal.overall_grade}
                    </span>
                  </div>
                  <Progress value={meal.meal_quality_score} className="h-1 mt-1" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {todayQuality.length === 0 && (
          <div className="text-center py-4 text-slate-400">
            <Award className="w-10 h-10 mx-auto mb-2 text-slate-200" />
            <p className="text-sm">No meals graded today</p>
            <p className="text-xs mt-1">Log meals to see quality scores</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
