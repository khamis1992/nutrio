import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Loader2, Brain, TrendingUp, Trash2,
  ChevronDown, ChevronUp, FileText, Calendar, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import {
  fetchBloodWorkRecords, fetchMarkersForRecord, deleteBloodWorkRecord,
  updateRecordAnalysis, fetchMarkerHistory,
} from "@/services/blood-work";
import { analyzeBloodWork } from "@/services/blood-work-ai";
import {
  type BloodWorkRecord, type BloodMarker, type MarkerCategory,
  groupByCategory, statusColor, statusTextColor, statusBgLight,
  categoryIcon, categoryLabel, categoryLabelAr, calculateHealthScore,
} from "@/lib/blood-markers";
import { format } from "date-fns";

// ─── Simple CSS line chart component ───────────────────────────────────
function MiniChart({ data }: { data: { test_date: string; value: number }[] }) {
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.1;
  const range = max - min || 1;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((d.value - min) / range) * 80 - 10;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 100" className="w-full h-16">
      <polyline fill="none" stroke="#10b981" strokeWidth="2" points={points} />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.value - min) / range) * 80 - 10;
        return <circle key={i} cx={x} cy={y} r="3" fill="#10b981" />;
      })}
    </svg>
  );
}

// ─── Visual bar for a marker value ─────────────────────────────────────
function MarkerBar({ marker }: { marker: BloodMarker }) {
  const { language } = useLanguage();
  const isHdl = marker.marker_name.toLowerCase().includes("hdl") || marker.marker_name.toLowerCase().includes("egfr");
  const low = marker.normal_min;
  const high = marker.normal_max;
  let barMin = low ?? 0;
  let barMax = high ?? (low ? low * 2 : 200);
  if (barMin === barMax) barMax = barMin * 1.5;

  // Extend range for visualization
  const padding = (barMax - barMin) * 0.3;
  barMin = Math.max(0, barMin - padding);
  barMax = barMax + padding;

  const pct = Math.min(100, Math.max(0, ((marker.value - barMin) / (barMax - barMin)) * 100));
  const normalMinPct = low ? Math.min(100, Math.max(0, ((low - barMin) / (barMax - barMin)) * 100)) : 0;
  const normalMaxPct = high ? Math.min(100, Math.max(0, ((high - barMin) / (barMax - barMin)) * 100)) : 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {language === "ar" && marker.marker_name_ar ? marker.marker_name_ar : marker.marker_name}
        </span>
        <span className="font-semibold">
          {marker.value} <span className="text-gray-400 font-normal">{marker.unit}</span>
        </span>
      </div>
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        {/* Normal range zone */}
        <div
          className="absolute top-0 h-full bg-green-100 rounded-full"
          style={{ left: `${normalMinPct}%`, width: `${normalMaxPct - normalMinPct}%` }}
        />
        {/* Value indicator */}
        <div
          className={cn("absolute top-0 h-full w-1.5 rounded-full", statusColor(marker.status))}
          style={{ left: `${Math.min(98, pct)}%` }}
        />
      </div>
      {low !== null && high !== null && (
        <div className="text-[10px] text-gray-400">
          {isHdl ? `> ${low}` : `${low} – ${high}`} {marker.unit}
        </div>
      )}
    </div>
  );
}

export default function BloodWorkResults() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();

  const [records, setRecords] = useState<BloodWorkRecord[]>([]);
  const [markersMap, setMarkersMap] = useState<Record<string, BloodMarker[]>>({});
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [trendMarker, setTrendMarker] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<{ test_date: string; value: number }[]>([]);

  async function loadData() {
    if (!user) return;
    const recs = await fetchBloodWorkRecords(user.id);
    setRecords(recs);
    const mMap: Record<string, BloodMarker[]> = {};
    for (const r of recs) {
      mMap[r.id] = await fetchMarkersForRecord(r.id);
    }
    setMarkersMap(mMap);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;
      const recs = await fetchBloodWorkRecords(user.id);
      if (cancelled) return;
      setRecords(recs);
      const mMap: Record<string, BloodMarker[]> = {};
      for (const r of recs) {
        const markers = await fetchMarkersForRecord(r.id);
        if (cancelled) return;
        mMap[r.id] = markers;
      }
      if (!cancelled) setMarkersMap(mMap);
    }
    load();

    return () => { cancelled = true; };
  }, [user]);

  async function handleAnalyze(record: BloodWorkRecord) {
    if (!user) return;
    setAnalyzing(record.id);
    try {
      const markers = markersMap[record.id] || [];
      const analysis = await analyzeBloodWork(markers, {
        age: profile?.age,
        gender: profile?.gender,
        weight: profile?.weight,
        height: profile?.height,
        healthGoals: profile?.health_goals,
      });
      await updateRecordAnalysis(record.id, analysis, "analyzed");
      setRecords((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, ai_analysis: analysis, status: "analyzed" as const } : r))
      );
    } catch {
      toast({ title: "Error", description: "AI analysis failed", variant: "destructive" });
    } finally {
      setAnalyzing(null);
    }
  }

  async function handleDelete(recordId: string) {
    try {
      await deleteBloodWorkRecord(recordId);
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      toast({ title: isRTL ? "تم الحذف" : "Deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  }

  async function showTrend(markerName: string) {
    if (!user) return;
    setTrendMarker(markerName);
    const data = await fetchMarkerHistory(user.id, markerName);
    setTrendData(data);
  }

  const allMarkers = Object.values(markersMap).flat();
  const healthScore = calculateHealthScore(allMarkers);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className={cn("w-5 h-5", isRTL && "rotate-180")} />
          </button>
          <h1 className="text-lg font-bold flex-1">
            {isRTL ? "🩸 نتائج تحاليل الدم" : "🩸 Blood Work Results"}
          </h1>
          <Button size="sm" onClick={() => navigate("/health/blood-work")}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Health Score */}
        {allMarkers.length > 0 && (
          <Card className={cn("border-2", healthScore >= 80 ? "border-green-200" : healthScore >= 50 ? "border-yellow-200" : "border-red-200")}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white",
                healthScore >= 80 ? "bg-green-500" : healthScore >= 50 ? "bg-yellow-500" : "bg-red-500"
              )}>
                {healthScore}
              </div>
              <div>
                <p className="font-semibold">{isRTL ? "مؤشر الصحة" : "Health Score"}</p>
                <p className="text-sm text-gray-500">
                  {healthScore >= 80
                    ? isRTL ? "ممتاز! معظم المؤشرات طبيعية" : "Excellent! Most markers are normal"
                    : healthScore >= 50
                    ? isRTL ? "جيد، بعض المؤشرات تحتاج متابعة" : "Good, some markers need attention"
                    : isRTL ? "تحتاج متابعة طبية" : "Needs medical follow-up"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Records */}
        {records.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{isRTL ? "لا توجد تحاليل دم بعد" : "No blood work records yet"}</p>
            <Button onClick={() => navigate("/health/blood-work")}>
              <Plus className="w-4 h-4 mr-2" />
              {isRTL ? "إضافة تحليل" : "Add Blood Work"}
            </Button>
          </div>
        ) : (
          records.map((record) => {
            const markers = markersMap[record.id] || [];
            const grouped = groupByCategory(markers);
            const isExpanded = expandedRecord === record.id;
            const score = calculateHealthScore(markers);
            const abnormalCount = markers.filter((m) => m.status !== "normal").length;

            return (
              <Card key={record.id}>
                <CardContent className="p-4">
                  {/* Record header */}
                  <button
                    onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold",
                          score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"
                        )}>
                          {score}
                        </div>
                        <div>
                          <p className="font-semibold">
                            {record.lab_name || (isRTL ? "تحليل دم" : "Blood Work")}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(record.test_date), "MMM d, yyyy")}
                            {record.fasting && ` • ${isRTL ? "صائم" : "Fasting"}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {abnormalCount > 0 && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium",
                            abnormalCount <= 2 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                          )}>
                            {abnormalCount} {isRTL ? "غير طبيعي" : "abnormal"}
                          </span>
                        )}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* Markers by category */}
                      {Object.entries(grouped).map(([cat, catMarkers]) => (
                        <div key={cat}>
                          <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                            {categoryIcon(cat as MarkerCategory)}{" "}
                            {language === "ar" ? categoryLabelAr(cat as MarkerCategory) : categoryLabel(cat as MarkerCategory)}
                          </h3>
                          <div className="space-y-2">
                            {catMarkers.map((marker) => (
                              <div
                                key={marker.id}
                                className={cn(
                                  "p-2.5 rounded-lg border cursor-pointer transition",
                                  statusBgLight(marker.status),
                                  trendMarker === marker.marker_name ? "ring-2 ring-emerald-400" : ""
                                )}
                                onClick={() => showTrend(marker.marker_name)}
                              >
                                <MarkerBar marker={marker} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* AI Analysis */}
                      {record.ai_analysis ? (
                        <div className="bg-gray-50 rounded-xl p-4">
                          <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Brain className="w-4 h-4 text-purple-500" />
                            {isRTL ? "تحليل AI" : "AI Analysis"}
                          </h3>
                          <div
                            className="text-sm prose prose-sm max-w-none text-gray-700"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(
                                (record.ai_analysis || "")
                                  .replace(/## (.*)/g, '<h3 class="font-semibold mt-3">$1</h3>')
                                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                  .replace(/^- (.*)/gm, '<li class="ml-4">$1</li>')
                                  .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc">$&</ul>')
                                  .replace(/\n/g, "<br />")
                              ),
                            }}
                          />
                        </div>
                      ) : markers.length > 0 && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleAnalyze(record)}
                          disabled={!!analyzing}
                        >
                          {analyzing === record.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Brain className="w-4 h-4 mr-2" />
                          )}
                          {isRTL ? "تحليل بالذكاء الاصطناعي" : "AI Analysis"}
                        </Button>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        {record.report_url && (
                          <a href={record.report_url} target="_blank" rel="noopener">
                            <Button variant="outline" size="sm">
                              <FileText className="w-4 h-4 mr-1" />
                              {isRTL ? "التقرير" : "Report"}
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(record.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {/* Trend modal */}
        {trendMarker && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setTrendMarker(null)}>
            <Card className="w-full max-w-lg rounded-t-2xl" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">{isRTL ? "اتجاه" : "Trend"}: {trendMarker}</h3>
                {trendData.length < 2 ? (
                  <p className="text-gray-500 text-sm">{isRTL ? "تحتاج نتيجتين على الأقل" : "Need at least 2 results to show trend"}</p>
                ) : (
                  <>
                    <MiniChart data={trendData} />
                    <div className="mt-2 space-y-1">
                      {trendData.map((d, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-500">{format(new Date(d.test_date), "MMM d, yyyy")}</span>
                          <span className="font-medium">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Button variant="outline" className="w-full mt-3" onClick={() => setTrendMarker(null)}>
                  {isRTL ? "إغلاق" : "Close"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
