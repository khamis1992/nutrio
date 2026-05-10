import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Heart, Activity, Droplets, Brain, Scale,
  TrendingUp, TrendingDown, AlertTriangle, ChevronRight,
  Loader2, Apple, Zap, Moon, Target,
} from "lucide-react";
import { fetchBloodWorkRecords, fetchMarkersForRecord } from "@/services/blood-work";
import {
  type BloodWorkRecord, type BloodMarker, type MarkerCategory,
  groupByCategory, statusColor, statusTextColor, statusBgLight,
  categoryIcon, categoryLabel, categoryLabelAr, calculateHealthScore,
} from "@/lib/blood-markers";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface WeightEntry { date: string; weight: number }
interface MealLog { date: string; calories: number; protein: number }

export default function HealthDashboard() {
  const { t, language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [records, setRecords] = useState<BloodWorkRecord[]>([]);
  const [allMarkers, setAllMarkers] = useState<BloodMarker[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [mealLogs, setMealLogs] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;
      try {
        // Blood work
        const recs = await fetchBloodWorkRecords(user.id);
        if (cancelled) return;
        setRecords(recs);
        const markers = (
          await Promise.all(recs.map((r) => fetchMarkersForRecord(r.id)))
        ).flat();
        if (cancelled) return;
        setAllMarkers(markers);

        // Weight history (last 30 days)
        const thirtyAgo = subDays(new Date(), 30).toISOString();
        const { data: weights } = await supabase
          .from("weight_logs")
          .select("date, weight")
          .eq("user_id", user.id)
          .gte("date", thirtyAgo)
          .order("date", { ascending: true });
        if (cancelled) return;
        setWeightHistory((weights as WeightEntry[]) || []);

        // Meal compliance (last 7 days)
        const weekAgo = subDays(new Date(), 7).toISOString();
        const { data: meals } = await supabase
          .from("meal_history")
          .select("logged_at, calories, protein_g")
          .eq("user_id", user.id)
          .gte("logged_at", weekAgo)
          .order("logged_at", { ascending: false });
        if (cancelled) return;
        // Transform to MealLog format (group by date)
        const transformedMeals: MealLog[] = (meals || []).map((m) => ({
          date: m.logged_at ? m.logged_at.split("T")[0] : "",
          calories: m.calories || 0,
          protein: m.protein_g || 0,
        }));
        setMealLogs(transformedMeals);
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();

    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const healthScore = calculateHealthScore(allMarkers);
  const grouped = groupByCategory(allMarkers.slice(0, 50)); // most recent markers
  const abnormalMarkers = allMarkers.filter((m) => m.status !== "normal");

  // Weight stats
  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;
  const startWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;
  const weightChange = currentWeight && startWeight ? currentWeight - startWeight : null;

  // Meal compliance
  const avgCalories = mealLogs.length > 0
    ? Math.round(mealLogs.reduce((s, m) => s + (m.calories || 0), 0) / mealLogs.length)
    : 0;
  const daysLogged = new Set(mealLogs.map((m) => m.date)).size;

  // Generate recommendations
  const recommendations = generateRecommendations(allMarkers, abnormalMarkers, {
    currentWeight, weightChange, avgCalories, daysLogged, profile,
    isRTL,
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b">
        <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className={cn("w-5 h-5", isRTL && "rotate-180")} />
          </button>
          <h1 className="text-lg font-bold flex-1">
            {isRTL ? "🏥 لوحة الصحة الذكية" : "🏥 Health Intelligence"}
          </h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Health Score Hero */}
        <Card className={cn(
          "border-2 overflow-hidden",
          healthScore >= 80 ? "border-green-200" : healthScore >= 50 ? "border-yellow-200" : "border-red-200"
        )}>
          <div className={cn(
            "h-2",
            healthScore >= 80 ? "bg-green-500" : healthScore >= 50 ? "bg-yellow-500" : "bg-red-500"
          )} />
          <CardContent className="p-6 text-center">
            <div className={cn(
              "w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-bold text-white mx-auto mb-3",
              healthScore >= 80 ? "bg-green-500" : healthScore >= 50 ? "bg-yellow-500" : "bg-red-500"
            )}>
              {healthScore}
            </div>
            <h2 className="text-xl font-bold">{isRTL ? "مؤشر الصحة العام" : "Overall Health Score"}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {healthScore >= 80
                ? isRTL ? "صحة ممتازة! استمر في نمط حياتك الحالي" : "Excellent health! Keep up your current lifestyle"
                : healthScore >= 50
                ? isRTL ? "جيد مع مساحة للتحسين" : "Good with room for improvement"
                : isRTL ? "تحتاج اهتمام - راجع طبيبك" : "Needs attention - see your doctor"}
            </p>
          </CardContent>
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Blood Work */}
          <Card className="cursor-pointer" onClick={() => navigate("/health/blood-work/results")}>
            <CardContent className="p-4">
              <Activity className="w-5 h-5 text-red-500 mb-2" />
              <p className="text-2xl font-bold">{records.length}</p>
              <p className="text-xs text-gray-500">{isRTL ? "تحاليل دم" : "Blood Tests"}</p>
              {abnormalMarkers.length > 0 && (
                <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {abnormalMarkers.length} {isRTL ? "تحتاج متابعة" : "need attention"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Weight */}
          <Card>
            <CardContent className="p-4">
              <Scale className="w-5 h-5 text-blue-500 mb-2" />
              <p className="text-2xl font-bold">{currentWeight ? `${currentWeight} kg` : "—"}</p>
              <p className="text-xs text-gray-500">{isRTL ? "الوزن الحالي" : "Current Weight"}</p>
              {weightChange !== null && weightChange !== 0 && (
                <p className={cn("text-xs mt-1 flex items-center gap-1", weightChange < 0 ? "text-green-600" : "text-red-600")}>
                  {weightChange < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                  {Math.abs(weightChange).toFixed(1)} kg
                </p>
              )}
            </CardContent>
          </Card>

          {/* Meal Compliance */}
          <Card>
            <CardContent className="p-4">
              <Apple className="w-5 h-5 text-emerald-500 mb-2" />
              <p className="text-2xl font-bold">{daysLogged}/7</p>
              <p className="text-xs text-gray-500">{isRTL ? "أيام تسجيل الوجبات" : "Meal Logging Days"}</p>
              <p className="text-xs text-gray-400 mt-1">
                {isRTL ? "متوسط" : "Avg"} {avgCalories} {isRTL ? "سعرة" : "kcal"}
              </p>
            </CardContent>
          </Card>

           {/* BMI */}
           <Card>
             <CardContent className="p-4">
               <Target className="w-5 h-5 text-purple-500 mb-2" />
               <p className="text-2xl font-bold">
                 {profile?.weight && profile?.height
                   ? (profile.weight / ((profile.height / 100) ** 2)).toFixed(1)
                   : "—"}
               </p>
               <p className="text-xs text-gray-500">BMI</p>
             </CardContent>
           </Card>
        </div>

        {/* Latest Blood Markers Summary */}
        {records.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  {isRTL ? "آخر تحاليل الدم" : "Latest Blood Work"}
                </h3>
                <button onClick={() => navigate("/health/blood-work/results")} className="text-sm text-emerald-600">
                  {isRTL ? "الكل" : "View all"} →
                </button>
              </div>
              {Object.entries(grouped).slice(0, 4).map(([cat, markers]) => (
                <div key={cat} className="mb-3 last:mb-0">
                  <p className="text-xs font-medium text-gray-400 mb-1.5 flex items-center gap-1">
                    {categoryIcon(cat as MarkerCategory)}{" "}
                    {language === "ar" ? categoryLabelAr(cat as MarkerCategory) : categoryLabel(cat as MarkerCategory)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {markers.slice(0, 5).map((m) => (
                      <span
                        key={m.id}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
                          statusBgLight(m.status)
                        )}
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusColor(m.status))} />
                        {language === "ar" && m.marker_name_ar ? m.marker_name_ar : m.marker_name}
                        <span className="text-gray-400">{m.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        <Card className="border-purple-100">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              {isRTL ? "توصيات ذكية" : "Smart Recommendations"}
            </h3>
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className={cn("p-3 rounded-lg border", rec.bg)}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{rec.icon}</span>
                    <div>
                      <p className="font-medium text-sm">{rec.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button className="w-full" onClick={() => navigate("/health/blood-work")}>
            <Activity className="w-4 h-4 mr-2" />
            {isRTL ? "إضافة تحليل دم جديد" : "Add New Blood Work"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Recommendation Generator ──────────────────────────────────────────
function generateRecommendations(
  allMarkers: BloodMarker[],
  abnormal: BloodMarker[],
  stats: {
    currentWeight: number | null;
    weightChange: number | null;
    avgCalories: number;
    daysLogged: number;
    profile: Record<string, unknown>;
    isRTL: boolean;
  }
) {
  const recs: { icon: string; title: string; description: string; bg: string }[] = [];
  const { isRTL } = stats;

  // Blood marker-based recommendations
  const markersByName = Object.fromEntries(allMarkers.map((m) => [m.marker_name.toLowerCase(), m]));

  if (markersByName["vitamin d"] && markersByName["vitamin d"].status !== "normal") {
    recs.push({
      icon: "☀️",
      title: isRTL ? "فيتامين د منخفض" : "Low Vitamin D",
      description: isRTL
        ? "أضف الأسماك الدهنية والبيض والحليب المدعم. التعرض لأشعة الشمس 15 دقيقة يومياً."
        : "Add fatty fish, eggs, and fortified milk. Get 15 min sunlight daily.",
      bg: "bg-yellow-50 border-yellow-200",
    });
  }

  if (markersByName["ldl"] && markersByName["ldl"].status !== "normal") {
    recs.push({
      icon: "🫀",
      title: isRTL ? "الكوليسترول الضار مرتفع" : "High LDL Cholesterol",
      description: isRTL
        ? "قلل الدهون المشبعة، أضف الشوفان والبقوليات والتفاح. زِد من الألياف القابلة للذوبان."
        : "Reduce saturated fats. Add oats, legumes, and apples. Increase soluble fiber.",
      bg: "bg-red-50 border-red-200",
    });
  }

  if (markersByName["glucose"] && markersByName["glucose"].status !== "normal") {
    recs.push({
      icon: "🍬",
      title: isRTL ? "سكر الدم مرتفع" : "High Blood Sugar",
      description: isRTL
        ? "قلل السكريات والكربوهيدرات البسيطة. تناول الألياف والبروتين مع كل وجبة."
        : "Reduce sugars and simple carbs. Pair carbs with protein and fiber at every meal.",
      bg: "bg-red-50 border-red-200",
    });
  }

  if (markersByName["hemoglobin"] && markersByName["hemoglobin"].status !== "normal") {
    recs.push({
      icon: "🩸",
      title: isRTL ? "الهيموجلوبين غير طبيعي" : "Abnormal Hemoglobin",
      description: isRTL
        ? "تناول اللحوم الحمراء والسبانخ والعدس مع فيتامين ج لتحسين الامتصاص."
        : "Eat red meat, spinach, and lentils with vitamin C to improve absorption.",
      bg: "bg-yellow-50 border-yellow-200",
    });
  }

  if (markersByName["iron"] && markersByName["iron"].status !== "normal") {
    recs.push({
      icon: "⚗️",
      title: isRTL ? "الحديد منخفض" : "Low Iron",
      description: isRTL
        ? "أضف الكبد والعدس والسبانخ. تجنب الشاي والقهوة مع الوجبات."
        : "Add liver, lentils, and spinach. Avoid tea/coffee with meals.",
      bg: "bg-yellow-50 border-yellow-200",
    });
  }

  // Weight-based
  if (stats.weightChange !== null && stats.weightChange > 1) {
    recs.push({
      icon: "📈",
      title: isRTL ? "زيادة في الوزن" : "Weight Gain Detected",
      description: isRTL
        ? `زِدت ${Math.abs(stats.weightChange).toFixed(1)} كجم هذا الشهر. راجع خطة وجباتك وزِد النشاط البدني.`
        : `Gained ${Math.abs(stats.weightChange).toFixed(1)} kg this month. Review your meal plan and increase activity.`,
      bg: "bg-orange-50 border-orange-200",
    });
  }

  // Compliance-based
  if (stats.daysLogged < 4) {
    recs.push({
      icon: "📝",
      title: isRTL ? "سجّل وجباتك بانتظام" : "Log Meals Consistently",
      description: isRTL
        ? `سجلت ${stats.daysLogged} من 7 أيام. التسجيل المنتظم يساعد في تتبع التقدم.`
        : `Logged ${stats.daysLogged} of 7 days. Consistent tracking helps monitor progress.`,
      bg: "bg-blue-50 border-blue-200",
    });
  }

  // Positive reinforcement
  if (abnormal.length === 0 && allMarkers.length > 0) {
    recs.push({
      icon: "🎉",
      title: isRTL ? "كل المؤشرات طبيعية!" : "All Markers Normal!",
      description: isRTL
        ? "ممتاز! استمر في نمط حياتك الصحي. لا تنسَ الفحص الدوري."
        : "Excellent! Keep up your healthy lifestyle. Don't forget regular checkups.",
      bg: "bg-green-50 border-green-200",
    });
  }

  // Generic if no specific recs
  if (recs.length === 0) {
    recs.push({
      icon: "💪",
      title: isRTL ? "ابدأ بتتبع صحتك" : "Start Tracking Your Health",
      description: isRTL
        ? "أضف تحليل دم لتحصل على توصيات مخصصة."
        : "Add a blood work test to get personalized recommendations.",
      bg: "bg-purple-50 border-purple-200",
    });
  }

  return recs.slice(0, 6);
}
