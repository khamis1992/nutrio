import { useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Apple,
  ArrowLeft,
  Brain,
  ChevronRight,
  Droplets,
  Heart,
  Loader2,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { fetchBloodWorkRecords, fetchMarkersForRecord } from "@/services/blood-work";
import {
  type BloodMarker,
  type BloodWorkRecord,
  type MarkerCategory,
  calculateHealthScore,
  categoryIcon,
  categoryLabel,
  categoryLabelAr,
  groupByCategory,
  statusBgLight,
  statusColor,
} from "@/lib/blood-markers";

interface WeightEntry {
  date: string;
  weight: number;
}

interface MealLog {
  date: string;
  calories: number;
  protein: number;
}

type Recommendation = {
  title: string;
  description: string;
  tone: "red" | "amber" | "blue" | "emerald" | "violet";
};

const toneClasses: Record<Recommendation["tone"], string> = {
  red: "bg-red-50 text-red-700 ring-red-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
};

export default function HealthDashboard() {
  const { language, isRTL } = useLanguage();
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
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const recs = await fetchBloodWorkRecords(user.id);
        if (cancelled) return;
        setRecords(recs);

        const markers = (await Promise.all(recs.map((r) => fetchMarkersForRecord(r.id)))).flat();
        if (cancelled) return;
        setAllMarkers(markers);

        const thirtyAgo = subDays(new Date(), 30).toISOString();
        const { data: weights } = await supabase
          .from("weight_logs")
          .select("date, weight")
          .eq("user_id", user.id)
          .gte("date", thirtyAgo)
          .order("date", { ascending: true });
        if (cancelled) return;
        setWeightHistory((weights as WeightEntry[]) || []);

        const weekAgo = subDays(new Date(), 7).toISOString();
        const { data: meals } = await supabase
          .from("meal_history")
          .select("logged_at, calories, protein_g")
          .eq("user_id", user.id)
          .gte("logged_at", weekAgo)
          .order("logged_at", { ascending: false });
        if (cancelled) return;

        setMealLogs(
          (meals || []).map((m) => ({
            date: m.logged_at ? m.logged_at.split("T")[0] : "",
            calories: m.calories || 0,
            protein: m.protein_g || 0,
          })),
        );
      } catch (err) {
        console.error("Failed to load health dashboard", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7FAF8]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const healthScore = calculateHealthScore(allMarkers);
  const grouped = groupByCategory(allMarkers.slice(0, 50));
  const abnormalMarkers = allMarkers.filter((m) => m.status !== "normal");
  const currentWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : null;
  const startWeight = weightHistory.length > 0 ? weightHistory[0].weight : null;
  const weightChange = currentWeight && startWeight ? currentWeight - startWeight : null;
  const avgCalories = mealLogs.length > 0
    ? Math.round(mealLogs.reduce((sum, meal) => sum + (meal.calories || 0), 0) / mealLogs.length)
    : 0;
  const daysLogged = new Set(mealLogs.map((meal) => meal.date)).size;
  const bmi = profile?.weight && profile?.height
    ? (profile.weight / ((profile.height / 100) ** 2)).toFixed(1)
    : "-";
  const scoreTone = healthScore >= 80 ? "emerald" : healthScore >= 50 ? "amber" : "red";
  const scoreColor = healthScore >= 80 ? "bg-emerald-500" : healthScore >= 50 ? "bg-amber-500" : "bg-red-500";
  const recommendations = generateRecommendations(allMarkers, abnormalMarkers, {
    weightChange,
    daysLogged,
    isRTL,
  });

  return (
    <div className="min-h-screen bg-[#F7FAF8] pb-44">
      <div className="sticky top-0 z-20 bg-[#F7FAF8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.1} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">Nutrio</p>
            <h1 className="truncate text-[23px] font-black leading-tight text-slate-950">
              {isRTL ? "الصحة" : "Health"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/health/blood-work")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_10px_22px_rgba(16,185,129,0.18)] active:scale-95"
            aria-label="Add blood work"
          >
            <Activity className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-slate-100">
          <div className="px-5 pb-5 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
                  {isRTL ? "الذكاء الصحي" : "Health intelligence"}
                </p>
                <h2 className="mt-1 text-[28px] font-black leading-tight text-slate-950">
                  {healthScore >= 80 ? (isRTL ? "صحتك ممتازة" : "Looking strong") : healthScore >= 50 ? (isRTL ? "مسار جيد" : "Good baseline") : (isRTL ? "يحتاج متابعة" : "Needs attention")}
                </h2>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-slate-500">
                  {healthScore >= 80
                    ? isRTL ? "استمر على نمطك الحالي." : "Your markers look stable. Keep the rhythm."
                    : healthScore >= 50
                      ? isRTL ? "هناك نقاط بسيطة للتحسين." : "A few areas can be tightened this week."
                      : isRTL ? "راجع مؤشراتك مع مختص." : "Review your markers with a clinician."}
                </p>
              </div>
              <div className={cn("grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full text-[30px] font-black text-white shadow-[0_14px_26px_rgba(15,23,42,0.12)]", scoreColor)}>
                {healthScore}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px bg-slate-100">
            {[
              { label: isRTL ? "تحاليل" : "Tests", value: records.length, Icon: Activity, color: "text-red-500" },
              { label: isRTL ? "تنبيهات" : "Alerts", value: abnormalMarkers.length, Icon: AlertTriangle, color: abnormalMarkers.length > 0 ? "text-amber-500" : "text-emerald-500" },
              { label: isRTL ? "تسجيل" : "Logged", value: `${daysLogged}/7`, Icon: Apple, color: "text-emerald-500" },
            ].map((item) => (
              <div key={item.label} className="bg-white px-3 py-3 text-center">
                <item.Icon className={cn("mx-auto mb-1 h-4 w-4", item.color)} />
                <p className="text-[17px] font-black leading-none text-slate-950">{item.value}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate("/health/blood-work/results")}
            className="rounded-[24px] bg-white p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.055)] ring-1 ring-slate-100 transition-transform active:scale-[0.98]"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <Activity className="h-5 w-5" />
            </div>
            <p className="text-[24px] font-black leading-none text-slate-950">{records.length}</p>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">{isRTL ? "تحاليل الدم" : "Blood tests"}</p>
            {abnormalMarkers.length > 0 && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-black text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                {abnormalMarkers.length} {isRTL ? "تحتاج متابعة" : "need attention"}
              </p>
            )}
          </button>

          <HealthStatCard
            icon={<Scale className="h-5 w-5" />}
            iconClassName="bg-blue-50 text-blue-500"
            label={isRTL ? "الوزن" : "Weight"}
            value={currentWeight ? `${currentWeight}` : "-"}
            suffix={currentWeight ? "kg" : ""}
            helper={weightChange !== null && weightChange !== 0 ? `${Math.abs(weightChange).toFixed(1)} kg` : undefined}
            helperIcon={weightChange !== null && weightChange < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            helperClassName={weightChange !== null && weightChange < 0 ? "text-emerald-600" : "text-red-500"}
          />
          <HealthStatCard
            icon={<Apple className="h-5 w-5" />}
            iconClassName="bg-emerald-50 text-emerald-600"
            label={isRTL ? "تسجيل الوجبات" : "Meal logs"}
            value={`${daysLogged}/7`}
            helper={`${avgCalories} kcal avg`}
            helperClassName="text-slate-400"
          />
          <HealthStatCard
            icon={<Target className="h-5 w-5" />}
            iconClassName="bg-violet-50 text-violet-600"
            label="BMI"
            value={bmi}
          />
        </div>

        {records.length > 0 && (
          <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[17px] font-black text-slate-950">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 text-red-500">
                  <Heart className="h-4 w-4" />
                </span>
                {isRTL ? "آخر تحاليل الدم" : "Latest blood work"}
              </h3>
              <button
                type="button"
                onClick={() => navigate("/health/blood-work/results")}
                className="flex h-9 items-center gap-1 rounded-full bg-slate-50 px-3 text-[12px] font-black text-emerald-600"
              >
                {isRTL ? "الكل" : "View"}
                <ChevronRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
              </button>
            </div>
            {Object.entries(grouped).slice(0, 4).map(([cat, markers]) => (
              <div key={cat} className="mb-4 last:mb-0">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.1em] text-slate-400">
                  {categoryIcon(cat as MarkerCategory)}{" "}
                  {language === "ar" ? categoryLabelAr(cat as MarkerCategory) : categoryLabel(cat as MarkerCategory)}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {markers.slice(0, 5).map((marker) => (
                    <span
                      key={marker.id}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-black",
                        statusBgLight(marker.status),
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusColor(marker.status))} />
                      {language === "ar" && marker.marker_name_ar ? marker.marker_name_ar : marker.marker_name}
                      <span className="text-slate-400">{marker.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
          <h3 className="mb-4 flex items-center gap-2 text-[17px] font-black text-slate-950">
            <span className={cn("grid h-9 w-9 place-items-center rounded-full ring-1", toneClasses[scoreTone])}>
              <Brain className="h-4 w-4" />
            </span>
            {isRTL ? "توصيات ذكية" : "Smart recommendations"}
          </h3>
          <div className="space-y-2.5">
            {recommendations.map((rec) => (
              <div key={rec.title} className={cn("rounded-[22px] p-3 ring-1", toneClasses[rec.tone])}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white">
                    <Brain className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black">{rec.title}</p>
                    <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-slate-500">{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-14 z-20 bg-gradient-to-t from-[#F7FAF8] via-[#F7FAF8] to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-8">
        <button
          type="button"
          onClick={() => navigate("/health/blood-work")}
          className="mx-auto flex h-14 w-full max-w-[398px] items-center justify-center gap-2 rounded-full bg-emerald-600 text-[15px] font-black text-white shadow-[0_16px_30px_rgba(16,185,129,0.24)] active:scale-[0.98]"
        >
          <Droplets className="h-4 w-4" />
          {isRTL ? "إضافة تحليل دم جديد" : "Add new blood work"}
        </button>
      </div>
    </div>
  );
}

function HealthStatCard({
  icon,
  iconClassName,
  label,
  value,
  suffix,
  helper,
  helperIcon,
  helperClassName,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  value: string | number;
  suffix?: string;
  helper?: string;
  helperIcon?: React.ReactNode;
  helperClassName?: string;
}) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)] ring-1 ring-slate-100">
      <div className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-2xl", iconClassName)}>
        {icon}
      </div>
      <p className="text-[24px] font-black leading-none text-slate-950">
        {value}
        {suffix ? <span className="ml-1 text-[12px] font-black text-slate-400">{suffix}</span> : null}
      </p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
      {helper ? (
        <p className={cn("mt-2 flex items-center gap-1 text-[10px] font-black", helperClassName)}>
          {helperIcon}
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function generateRecommendations(
  allMarkers: BloodMarker[],
  abnormal: BloodMarker[],
  stats: {
    weightChange: number | null;
    daysLogged: number;
    isRTL: boolean;
  },
) {
  const recs: Recommendation[] = [];
  const { isRTL } = stats;
  const markersByName = Object.fromEntries(allMarkers.map((marker) => [marker.marker_name.toLowerCase(), marker]));

  if (markersByName["vitamin d"] && markersByName["vitamin d"].status !== "normal") {
    recs.push({
      title: isRTL ? "فيتامين د منخفض" : "Low Vitamin D",
      description: isRTL ? "أضف الأسماك الدهنية والبيض، وحاول التعرض للشمس يوميا." : "Add fatty fish and eggs, and aim for brief daily sunlight.",
      tone: "amber",
    });
  }

  if (markersByName.ldl && markersByName.ldl.status !== "normal") {
    recs.push({
      title: isRTL ? "الكوليسترول يحتاج متابعة" : "LDL needs attention",
      description: isRTL ? "زد الألياف وقلل الدهون المشبعة خلال الأسبوع القادم." : "Increase soluble fiber and reduce saturated fats this week.",
      tone: "red",
    });
  }

  if (markersByName.glucose && markersByName.glucose.status !== "normal") {
    recs.push({
      title: isRTL ? "سكر الدم مرتفع" : "Blood sugar is elevated",
      description: isRTL ? "اجمع الكربوهيدرات مع البروتين والألياف في كل وجبة." : "Pair carbs with protein and fiber at each meal.",
      tone: "red",
    });
  }

  if (stats.weightChange !== null && stats.weightChange > 1) {
    recs.push({
      title: isRTL ? "زيادة وزن ملحوظة" : "Weight gain detected",
      description: isRTL ? `زاد وزنك ${Math.abs(stats.weightChange).toFixed(1)} كجم خلال آخر فترة.` : `You gained ${Math.abs(stats.weightChange).toFixed(1)} kg recently. Review calories and activity.`,
      tone: "amber",
    });
  }

  if (stats.daysLogged < 4) {
    recs.push({
      title: isRTL ? "سجل وجباتك أكثر" : "Log meals consistently",
      description: isRTL ? `سجلت ${stats.daysLogged} من 7 أيام. التتبع المنتظم يحسن دقة التوصيات.` : `You logged ${stats.daysLogged} of 7 days. Consistent tracking improves recommendations.`,
      tone: "blue",
    });
  }

  if (abnormal.length === 0 && allMarkers.length > 0) {
    recs.push({
      title: isRTL ? "المؤشرات طبيعية" : "All markers look normal",
      description: isRTL ? "ممتاز. استمر على نمطك الحالي ولا تنس الفحص الدوري." : "Great work. Keep your current rhythm and continue regular checkups.",
      tone: "emerald",
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: isRTL ? "ابدأ بتتبع صحتك" : "Start tracking your health",
      description: isRTL ? "أضف تحليل دم للحصول على توصيات مخصصة." : "Add a blood work test to unlock personalized recommendations.",
      tone: "violet",
    });
  }

  return recs.slice(0, 4);
}
