import { useEffect, useState } from "react";
import { subDays } from "date-fns";
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
  Pencil,
  Scale,
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
  red: "bg-[#FFF0F2] text-[#FB6B7A] ring-[#FB6B7A]/20",
  amber: "bg-[#FFF7ED] text-[#F97316] ring-[#F97316]/20",
  blue: "bg-[#EFF9FF] text-[#38BDF8] ring-[#38BDF8]/20",
  emerald: "bg-[#EFFFFA] text-[#22C7A1] ring-[#22C7A1]/20",
  violet: "bg-[#F3F4FF] text-[#7C83F6] ring-[#7C83F6]/20",
};

function getBmiStatus(bmi: number, isRTL: boolean) {
  if (bmi < 18.5) return { label: isRTL ? "نحافة" : "Underweight", color: "#38BDF8" };
  if (bmi < 25) return { label: isRTL ? "طبيعي" : "Normal", color: "#22C7A1" };
  if (bmi < 30) return { label: isRTL ? "زيادة وزن" : "Overweight", color: "#F97316" };
  return { label: isRTL ? "سمنة" : "Obese", color: "#FB6B7A" };
}

function getBmiPosition(bmi: number) {
  return ((Math.max(15, Math.min(40, bmi)) - 15) / 25) * 100;
}

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
          .from("body_measurements")
          .select("log_date, weight_kg")
          .eq("user_id", user.id)
          .not("weight_kg", "is", null)
          .gte("log_date", thirtyAgo.split("T")[0])
          .order("log_date", { ascending: true });
        if (cancelled) return;
        setWeightHistory((weights || []).map((entry) => ({
          date: entry.log_date,
          weight: entry.weight_kg || 0,
        })));

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
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
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
  const profileWeightKg = currentWeight ?? profile?.current_weight_kg ?? null;
  const profileHeightCm = profile?.height_cm ?? null;
  const bmiValue = profileWeightKg && profileHeightCm
    ? Number((profileWeightKg / ((profileHeightCm / 100) ** 2)).toFixed(1))
    : null;
  const bmiStatus = bmiValue ? getBmiStatus(bmiValue, isRTL) : null;
  const bmiPosition = bmiValue ? getBmiPosition(bmiValue) : 0;
  const scoreTone = healthScore >= 80 ? "emerald" : healthScore >= 50 ? "amber" : "red";
  const scoreColor = healthScore >= 80 ? "bg-[#22C7A1]" : healthScore >= 50 ? "bg-[#F97316]" : "bg-[#FB6B7A]";
  const recommendations = generateRecommendations(allMarkers, abnormalMarkers, {
    weightChange,
    daysLogged,
    isRTL,
  });

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-44 text-[#020617]">
      <div className="sticky top-0 z-20 border-b border-white/70 bg-[#F6F8FB]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[78px] max-w-[430px] items-center gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className={cn("h-5 w-5", isRTL && "rotate-180")} strokeWidth={2.1} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">Nutrio</p>
            <h1 className="truncate text-[23px] font-black leading-tight text-[#020617]">
              {isRTL ? "الصحة" : "Health"}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/health/blood-work")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white active:scale-95"
            aria-label="Add blood work"
          >
            <Activity className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[34px] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="px-5 pb-5 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                  {isRTL ? "الذكاء الصحي" : "Health intelligence"}
                </p>
                <h2 className="mt-1 text-[28px] font-black leading-tight text-[#020617]">
                  {healthScore >= 80 ? (isRTL ? "صحتك ممتازة" : "Looking strong") : healthScore >= 50 ? (isRTL ? "مسار جيد" : "Good baseline") : (isRTL ? "يحتاج متابعة" : "Needs attention")}
                </h2>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[#64748B]">
                  {healthScore >= 80
                    ? isRTL ? "استمر على نمطك الحالي." : "Your markers look stable. Keep the rhythm."
                    : healthScore >= 50
                      ? isRTL ? "هناك نقاط بسيطة للتحسين." : "A few areas can be tightened this week."
                      : isRTL ? "راجع مؤشراتك مع مختص." : "Review your markers with a clinician."}
                </p>
              </div>
              <div className={cn("grid h-[86px] w-[86px] shrink-0 place-items-center rounded-full text-[30px] font-black text-white ring-8 ring-[#F6F8FB]", scoreColor)}>
                {healthScore}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px bg-[#E5EAF1]">
            {[
              { label: isRTL ? "تحاليل" : "Tests", value: records.length, Icon: Activity, color: "text-[#7C83F6]" },
              { label: isRTL ? "تنبيهات" : "Alerts", value: abnormalMarkers.length, Icon: AlertTriangle, color: abnormalMarkers.length > 0 ? "text-[#F97316]" : "text-[#22C7A1]" },
              { label: isRTL ? "تسجيل" : "Logged", value: `${daysLogged}/7`, Icon: Apple, color: "text-[#22C7A1]" },
            ].map((item) => (
              <div key={item.label} className="bg-white px-3 py-3 text-center">
                <item.Icon className={cn("mx-auto mb-1 h-4 w-4", item.color)} />
                <p className="text-[17px] font-black leading-none text-[#020617]">{item.value}</p>
                <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate("/health/blood-work/results")}
            className="rounded-[24px] bg-white p-4 text-left shadow-[0_12px_28px_rgba(15,23,42,0.055)] ring-1 ring-[#E5EAF1] transition-transform active:scale-[0.98]"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
              <Activity className="h-5 w-5" />
            </div>
            <p className="text-[24px] font-black leading-none text-[#020617]">{records.length}</p>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{isRTL ? "تحاليل الدم" : "Blood tests"}</p>
            {abnormalMarkers.length > 0 && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-black text-[#F97316]">
                <AlertTriangle className="h-3 w-3" />
                {abnormalMarkers.length} {isRTL ? "تحتاج متابعة" : "need attention"}
              </p>
            )}
          </button>

          <HealthStatCard
            icon={<Scale className="h-5 w-5" />}
            iconClassName="bg-[#EFF9FF] text-[#38BDF8] ring-1 ring-[#38BDF8]/20"
            label={isRTL ? "الوزن" : "Weight"}
            value={currentWeight ? `${currentWeight}` : "-"}
            suffix={currentWeight ? "kg" : ""}
            helper={weightChange !== null && weightChange !== 0 ? `${Math.abs(weightChange).toFixed(1)} kg` : undefined}
            helperIcon={weightChange !== null && weightChange < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
            helperClassName={weightChange !== null && weightChange < 0 ? "text-[#22C7A1]" : "text-[#FB6B7A]"}
          />
          <div className="col-span-2">
            <HealthStatCard
              icon={<Apple className="h-5 w-5" />}
              iconClassName="bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/20"
              label={isRTL ? "تسجيل الوجبات" : "Meal logs"}
              value={`${daysLogged}/7`}
              helper={`${avgCalories} kcal avg`}
              helperClassName="text-[#94A3B8]"
              compact
            />
          </div>
        </div>

        <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#F97316]/15">
                <Activity className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-black text-[#020617]">
                  {isRTL ? "مؤشر كتلة الجسم" : "BMI"} <span className="text-[12px] font-extrabold text-[#475569]">(kg/m²)</span>
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate("/body-metrics")}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1] transition active:scale-95"
              aria-label={isRTL ? "تعديل القياسات" : "Edit body metrics"}
            >
              <Pencil className="h-4 w-4" strokeWidth={2.1} />
            </button>
          </div>

          <div className="mt-5 flex items-end gap-2">
            <p className="text-[28px] font-black leading-none tracking-[-0.05em] text-[#020617]">
              {bmiValue ? bmiValue.toFixed(1) : "--"}
            </p>
            {bmiStatus && (
              <p className="pb-1 text-[13px] font-extrabold" style={{ color: bmiStatus.color }}>
                {bmiStatus.label}
              </p>
            )}
          </div>

          <div className="relative mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-[#E5EAF1]">
              <div className="grid h-full grid-cols-4">
                <span className="bg-[#38BDF8]" />
                <span className="bg-[#22C7A1]" />
                <span className="bg-[#F97316]" />
                <span className="bg-[#FB6B7A]" />
              </div>
            </div>
            {bmiValue && (
              <span
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#020617] ring-2 ring-white"
                style={{ left: `${bmiPosition}%` }}
              />
            )}
          </div>

          <div className="mt-2 grid grid-cols-4 text-center">
            <span className="text-[9px] font-bold text-[#94A3B8]">{isRTL ? "نحافة" : "Underweight"}</span>
            <span className="text-[9px] font-bold text-[#94A3B8]">{isRTL ? "طبيعي" : "Normal"}</span>
            <span className="text-[9px] font-bold text-[#94A3B8]">{isRTL ? "زيادة" : "Overweight"}</span>
            <span className="text-[9px] font-bold text-[#94A3B8]">{isRTL ? "سمنة" : "Obese"}</span>
          </div>
        </section>

        {records.length > 0 && (
          <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-[#E5EAF1]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[17px] font-black text-[#020617]">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FFF0F2] text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                  <Heart className="h-4 w-4" />
                </span>
                {isRTL ? "آخر تحاليل الدم" : "Latest blood work"}
              </h3>
              <button
                type="button"
                onClick={() => navigate("/health/blood-work/results")}
                className="flex h-9 items-center gap-1 rounded-full bg-[#F6F8FB] px-3 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1]"
              >
                {isRTL ? "الكل" : "View"}
                <ChevronRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
              </button>
            </div>
            {Object.entries(grouped).slice(0, 4).map(([cat, markers]) => (
              <div key={cat} className="mb-4 last:mb-0">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                  {categoryIcon(cat as MarkerCategory)}{" "}
                  {language === "ar" ? categoryLabelAr(cat as MarkerCategory) : categoryLabel(cat as MarkerCategory)}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {markers.slice(0, 5).map((marker) => (
                    <span
                      key={marker.id}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#020617]",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", statusColor(marker.status))} />
                      {language === "ar" && marker.marker_name_ar ? marker.marker_name_ar : marker.marker_name}
                      <span className="text-[#94A3B8]">{marker.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.055)] ring-1 ring-[#E5EAF1]">
          <h3 className="mb-4 flex items-center gap-2 text-[17px] font-black text-[#020617]">
            <span className={cn("grid h-9 w-9 place-items-center rounded-full ring-1", toneClasses[scoreTone])}>
              <Brain className="h-4 w-4" />
            </span>
            {isRTL ? "توصيات ذكية" : "Smart recommendations"}
          </h3>
          <div className="space-y-2.5">
            {recommendations.map((rec) => (
              <div key={rec.title} className={cn("rounded-[22px] p-3 ring-1", toneClasses[rec.tone])}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/80">
                    <Brain className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-black">{rec.title}</p>
                    <p className="mt-0.5 text-[12px] font-semibold leading-relaxed text-[#64748B]">{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-14 z-20 bg-gradient-to-t from-[#F6F8FB] via-[#F6F8FB] to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-8">
        <button
          type="button"
          onClick={() => navigate("/health/blood-work")}
          className="mx-auto flex h-14 w-full max-w-[398px] items-center justify-center gap-2 rounded-full bg-[#020617] text-[15px] font-black text-white active:scale-[0.98]"
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
  compact = false,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  value: string | number;
  suffix?: string;
  helper?: string;
  helperIcon?: React.ReactNode;
  helperClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-[24px] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.055)] ring-1 ring-[#E5EAF1]",
      compact && "flex min-h-[82px] items-center gap-3",
    )}>
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", !compact && "mb-3", iconClassName)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[24px] font-black leading-none text-[#020617]">
          {value}
          {suffix ? <span className="ml-1 text-[12px] font-black text-[#94A3B8]">{suffix}</span> : null}
        </p>
        <p className="mt-1 text-[11px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{label}</p>
        {helper ? (
          <p className={cn("mt-2 flex items-center gap-1 text-[10px] font-black", compact && "mt-1", helperClassName)}>
            {helperIcon}
            {helper}
          </p>
        ) : null}
      </div>
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
