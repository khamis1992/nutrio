import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface WeeklyReportProps {
  currentWeekReport: {
    week_start_date: string;
    week_end_date: string;
    avg_calories: number;
    avg_protein: number;
    avg_carbs: number;
    avg_fat: number;
    weight_change_kg: number | null;
    consistency_score: number;
    meal_quality_avg: number;
    report_data: {
      highlights?: string[];
      recommendations?: string[];
    };
  } | null;
  historicalReports: Array<{
    week_start_date: string;
    consistency_score: number;
    avg_calories: number;
  }>;
  loading: boolean;
}

export function WeeklyReport({ currentWeekReport, historicalReports, loading }: WeeklyReportProps) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <Card className="border-0 shadow-lg shadow-slate-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            {t("report_weekly_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse space-y-3">
            <div className="h-24 rounded-lg bg-slate-100" />
            <div className="h-16 rounded-lg bg-slate-100" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleDownload = () => {
    if (!currentWeekReport) return;
    
    const highlights = currentWeekReport.report_data?.highlights || [];
    const recommendations = currentWeekReport.report_data?.recommendations || [];
    
    const reportText = `
${t("report_nutrition_title")}
======================================

${t("report_week")}: ${format(parseISO(currentWeekReport.week_start_date), "MMM d")} - ${format(parseISO(currentWeekReport.week_end_date), "MMM d, yyyy")}

${t("report_nutrition_summary")}
-----------------
${t("report_avg_calories")}: ${Math.round(currentWeekReport.avg_calories)}
${t("report_avg_protein")}: ${Math.round(currentWeekReport.avg_protein)}g
${t("report_avg_carbs")}: ${Math.round(currentWeekReport.avg_carbs)}g
${t("report_avg_fat")}: ${Math.round(currentWeekReport.avg_fat)}g

${t("report_performance")}
-----------
${t("report_consistency_score")}: ${currentWeekReport.consistency_score}%
${t("report_meal_quality_avg")}: ${currentWeekReport.meal_quality_avg}/100
${t("report_weight_change")}: ${currentWeekReport.weight_change_kg !== null && currentWeekReport.weight_change_kg !== undefined ? (currentWeekReport.weight_change_kg > 0 ? "+" : "") + currentWeekReport.weight_change_kg.toFixed(1) : t("report_na")} kg

${t("report_highlights")}
----------
${highlights.map(h => `- ${h}`).join("\n") || t("report_no_highlights")}

${t("report_recommendations")}
---------------
${recommendations.map(r => `- ${r}`).join("\n") || t("report_keep_up_good_work")}

${t("report_generated_by")}
    `.trim();

    const blob = new Blob([reportText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-report-${currentWeekReport.week_start_date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const weightChange = currentWeekReport?.weight_change_kg;
  const hasWeightChange = weightChange !== null && weightChange !== undefined;

  return (
    <Card className="border-0 shadow-lg shadow-slate-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          {t("report_weekly_title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {currentWeekReport ? (
          <>
            {/* Week Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(parseISO(currentWeekReport.week_start_date), "MMM d")} -{" "}
                  {format(parseISO(currentWeekReport.week_end_date), "MMM d")}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1" />
                {t("report_download")}
              </Button>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-xs text-slate-500">{t("report_avg_calories_short")}</p>
                <p className="text-lg font-bold text-slate-900">
                  {Math.round(currentWeekReport.avg_calories)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-xs text-slate-500">{t("report_meal_quality_short")}</p>
                <p className="text-lg font-bold text-slate-900">
                  {currentWeekReport.meal_quality_avg}/100
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-xs text-slate-500">{t("report_consistency_short")}</p>
                <p className="text-lg font-bold text-slate-900">
                  {currentWeekReport.consistency_score}%
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50">
                <p className="text-xs text-slate-500">{t("report_weight")}</p>
                <div className="flex items-center gap-1">
                  {hasWeightChange ? (
                    <>
                      {weightChange > 0 ? (
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-emerald-500" />
                      )}
                      <p className={`text-lg font-bold ${weightChange > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {weightChange > 0 ? "+" : ""}
                        {weightChange.toFixed(1)} kg
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">{t("report_no_data")}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Consistency Progress */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">{t("report_weekly_consistency")}</span>
                <span className="font-medium text-slate-900">{currentWeekReport.consistency_score}%</span>
              </div>
              <Progress value={currentWeekReport.consistency_score} className="h-2" />
            </div>

            {/* Highlights */}
            {currentWeekReport.report_data?.highlights && currentWeekReport.report_data.highlights.length > 0 && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-sm font-medium text-emerald-900 mb-2">{t("report_highlights_title")}</p>
                <ul className="space-y-1">
                  {currentWeekReport.report_data.highlights.slice(0, 3).map((highlight, idx) => (
                    <li key={idx} className="text-xs text-emerald-700 flex items-start gap-2">
                      <span>•</span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-sm">{t("report_no_report_available")}</p>
            <p className="text-xs mt-1">{t("report_complete_week")}</p>
          </div>
        )}

        {/* Historical Trend */}
        {historicalReports.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">{t("report_previous_weeks")}</p>
            <div className="flex items-end gap-1 h-16">
              {historicalReports.slice(0, 4).reverse().map((report, idx) => (
                <div
                  key={idx}
                  className="flex-1 bg-blue-100 rounded-t transition-all hover:bg-blue-200 relative group"
                  style={{ height: `${report.consistency_score}%` }}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {Math.round(report.consistency_score)}% - {format(parseISO(report.week_start_date), "MMM d")}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 text-center mt-1">{t("report_consistency_trend")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
