import { useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  CloudOff,
  Dumbbell,
  Flame,
  Clock3,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMealRecommendations } from "@/hooks/useMealRecommendations";
import { trackEvent } from "@/lib/analytics";
import type { MealExplanationCode, RankedMeal } from "@/lib/mealRanking";
import { cn } from "@/lib/utils";

const reasonCopy: Record<"en" | "ar", Record<MealExplanationCode, string>> = {
  en: {
    calorie_fit: "Fits your calories",
    protein_gap: "Helps close protein gap",
    macro_balance: "Balanced for today",
    preference_match: "Matches your taste",
    variety: "Adds variety",
    high_rating: "Highly rated kitchen",
    delivery_fit: "Good delivery fit",
    good_value: "Good value",
    micronutrient_fit: "Supports micronutrients",
    health_context_fit: "Fits your recent health check-in",
    meal_response_history: "Matched your past meal responses",
    stale_activity: "Activity data may be old",
    missing_safety_data: "Confirm dietary safety",
  },
  ar: {
    calorie_fit: "مناسب لسعراتك",
    protein_gap: "يساعد في إكمال البروتين",
    macro_balance: "متوازن ليومك",
    preference_match: "يناسب ذوقك",
    variety: "يضيف تنوعاً",
    high_rating: "مطبخ عالي التقييم",
    delivery_fit: "توصيل مناسب",
    good_value: "قيمة جيدة",
    micronutrient_fit: "يدعم المغذيات الدقيقة",
    health_context_fit: "يناسب تسجيلك الصحي الأخير",
    meal_response_history: "يناسب استجاباتك السابقة للوجبات",
    stale_activity: "بيانات النشاط قديمة",
    missing_safety_data: "تحقق من ملاءمة المكونات",
  },
};

const text = {
  en: {
    title: "Meals picked for your day",
    subtitle: "Ranked from your goals, progress, preferences and available meals.",
    eyebrow: "EXPLAINABLE PICKS",
    remaining: "remaining today",
    protein: "protein",
    calories: "calories",
    filters: "Refine results",
    maximumCalories: "Maximum calories",
    minimumProtein: "Minimum protein",
    matches: "matches",
    updated: "Updated just now",
    offline: "Showing your last saved ranking. Availability is confirmed when you open a meal.",
    incomplete: "Some profile or safety data is incomplete. Review ingredients before ordering.",
    noMatches: "No safe matches fit these filters",
    noMatchesHint: "Widen the nutrition filters or refresh the available menu.",
    failed: "We could not rank meals right now",
    retry: "Try again",
    why: "Why this meal",
    score: "match",
    openMeal: "View meal",
    breakdown: "Score breakdown",
    nutrition: "Nutrition",
    preference: "Taste",
    quality: "Quality",
    variety: "Variety",
    delivery: "Delivery",
    value: "Value",
    micronutrients: "Micros",
    healthContext: "Health check-in",
    mealResponse: "Past responses",
    availability: "Confirmed orderable",
    minuteUnit: "min delivery",
  },
  ar: {
    title: "وجبات مختارة ليومك",
    subtitle: "مرتبة حسب أهدافك وتقدمك وتفضيلاتك والوجبات المتاحة.",
    eyebrow: "ترشيحات قابلة للتفسير",
    remaining: "متبقي اليوم",
    protein: "بروتين",
    calories: "سعرة",
    filters: "تخصيص النتائج",
    maximumCalories: "الحد الأعلى للسعرات",
    minimumProtein: "الحد الأدنى للبروتين",
    matches: "وجبات مناسبة",
    updated: "تم التحديث الآن",
    offline: "نعرض آخر ترتيب محفوظ. يتم تأكيد التوفر عند فتح الوجبة.",
    incomplete: "بعض بيانات الملف أو السلامة غير مكتملة. راجع المكونات قبل الطلب.",
    noMatches: "لا توجد وجبات آمنة تطابق هذه المرشحات",
    noMatchesHint: "وسّع مرشحات التغذية أو حدّث قائمة الوجبات المتاحة.",
    failed: "تعذر ترتيب الوجبات الآن",
    retry: "إعادة المحاولة",
    why: "لماذا هذه الوجبة",
    score: "تطابق",
    openMeal: "عرض الوجبة",
    breakdown: "تفاصيل النتيجة",
    nutrition: "التغذية",
    preference: "الذوق",
    quality: "الجودة",
    variety: "التنوع",
    delivery: "التوصيل",
    value: "القيمة",
    micronutrients: "المغذيات",
    healthContext: "التسجيل الصحي",
    mealResponse: "الاستجابات السابقة",
    availability: "توفر مباشر",
    minuteUnit: "دقيقة للتوصيل",
  },
} as const;

function LoadingState() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f8fb] px-4 py-6">
      <div className="h-28 animate-pulse rounded-[24px] bg-white" />
      <div className="mt-4 h-24 animate-pulse rounded-[22px] bg-white" />
      {[1, 2, 3].map((item) => <div key={item} className="mt-4 h-72 animate-pulse rounded-[24px] bg-white" />)}
    </main>
  );
}

function ScoreBreakdown({ meal, copy }: { meal: RankedMeal; copy: typeof text.en | typeof text.ar }) {
  const items = [
    [copy.nutrition, meal.componentScores.nutrition],
    [copy.preference, meal.componentScores.preference],
    [copy.quality, meal.componentScores.quality],
    [copy.variety, meal.componentScores.variety],
    [copy.delivery, meal.componentScores.delivery],
    [copy.value, meal.componentScores.value],
    [copy.micronutrients, meal.componentScores.micronutrients],
    [copy.healthContext, meal.componentScores.healthContext],
    [copy.mealResponse, meal.componentScores.mealResponse ?? 50],
  ] as const;

  return (
    <details className="group border-t border-slate-100 px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[12px] font-extrabold text-slate-600">
        {copy.breakdown}
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 pb-2 pt-1">
        {items.map(([label, value]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-[10px] font-bold text-slate-500"><span>{label}</span><span>{value}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#11b995]" style={{ width: `${value}%` }} /></div>
          </div>
        ))}
      </div>
    </details>
  );
}

export default function SmartMealRecommendations() {
  const navigate = useNavigate();
  const { language, isRTL } = useLanguage();
  const copy = text[language];
  const reasons = reasonCopy[language];
  const { ranking, recommendations, engine, loading, error, refresh } = useMealRecommendations();
  const [showFilters, setShowFilters] = useState(false);
  const [maxCalories, setMaxCalories] = useState(900);
  const [minProtein, setMinProtein] = useState(0);

  const meals = useMemo(() => (ranking?.ranked ?? []).filter((meal) => (
    (meal.calories ?? 0) <= maxCalories && (meal.protein_g ?? 0) >= minProtein
  )), [maxCalories, minProtein, ranking]);
  const legacyMeals = useMemo(() => recommendations.forYou.filter((meal) => (
    (meal.calories ?? 0) <= maxCalories && (meal.protein_g ?? 0) >= minProtein
  )), [maxCalories, minProtein, recommendations.forYou]);
  const availabilityLabel = ranking?.offline
    ? language === "ar" ? "\u062a\u0631\u0634\u064a\u062d\u0627\u062a \u0645\u062d\u0641\u0648\u0638\u0629" : "Saved recommendations"
    : language === "ar" ? "\u0645\u062a\u0627\u062d \u0644\u0644\u0637\u0644\u0628" : copy.availability;

  if (loading) return <LoadingState />;

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;
  const staleSafety = ranking?.inputFreshness.safety !== "fresh";

  return (
    <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f8fb] pb-[calc(28px+env(safe-area-inset-bottom))]" dir={isRTL ? "rtl" : "ltr"}>
      <header className="px-4 pb-3 pt-[calc(20px+env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#08152f] ring-1 ring-slate-200 active:scale-95">
            <BackIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase text-[#0cae8e]">{copy.eyebrow}</p>
            <h1 className="mt-0.5 text-[22px] font-black leading-tight text-[#08152f]">{copy.title}</h1>
          </div>
          <button type="button" onClick={() => void refresh()} aria-label={copy.retry} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#08152f] text-white active:scale-95">
            <RefreshCw className="h-[18px] w-[18px]" />
          </button>
        </div>
        <p className="mt-3 text-[13px] font-medium leading-5 text-slate-500">{copy.subtitle}</p>
      </header>

      {error && !ranking ? (
        <section className="mx-4 mt-3 rounded-[24px] bg-white p-6 text-center ring-1 ring-slate-200">
          <CircleAlert className="mx-auto h-8 w-8 text-rose-500" />
          <h2 className="mt-3 text-[16px] font-black text-[#08152f]">{copy.failed}</h2>
          <button type="button" onClick={() => void refresh()} className="mt-4 min-h-11 rounded-full bg-[#08152f] px-6 text-[13px] font-black text-white">{copy.retry}</button>
        </section>
      ) : null}

      {engine === "legacy" && !error ? (
        <>
          <div className="flex items-center justify-between px-5 pb-2 pt-3">
            <h2 className="text-[16px] font-black text-[#08152f]">{legacyMeals.length} {copy.matches}</h2>
            <span className="text-[10px] font-extrabold text-slate-400">legacy</span>
          </div>
          <section className="space-y-3 px-4" aria-live="polite">
            {legacyMeals.map((meal) => (
              <Link key={meal.id} to={`/meals/${meal.id}`} className="flex min-h-28 overflow-hidden rounded-[8px] bg-white ring-1 ring-slate-200">
                <div className="h-28 w-28 shrink-0 bg-slate-100">
                  {meal.image_url ? <img src={meal.image_url} alt={meal.name} loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><UtensilsCrossed className="h-7 w-7 text-slate-300" /></div>}
                </div>
                <div className="min-w-0 flex-1 p-3">
                  <p className="truncate text-[10px] font-bold text-[#0cae8e]">{meal.restaurant_name}</p>
                  <h2 className="mt-1 line-clamp-2 text-[14px] font-black leading-5 text-[#08152f]">{meal.name}</h2>
                  <div className="mt-2 flex gap-3 text-[10px] font-bold text-slate-500"><span>{Math.round(meal.calories ?? 0)} cal</span><span>{Math.round(meal.protein_g ?? 0)}g {copy.protein}</span></div>
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : null}

      {engine === "v2" && ranking ? (
        <>
          <section className="mx-4 rounded-[24px] bg-[#08152f] p-4 text-white shadow-[0_14px_32px_rgba(8,21,47,0.16)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#11b995]/15 px-2.5 py-1 text-[10px] font-black text-[#52dfbd]"><ShieldCheck className="h-3.5 w-3.5" />{availabilityLabel}</span>
                <p className="mt-3 text-[12px] font-bold text-slate-300">{copy.remaining}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-extrabold text-slate-200">{copy.updated}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 divide-x divide-white/10 rtl:divide-x-reverse">
              <div className="flex items-center gap-3 pe-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-orange-500/15 text-orange-400"><Flame className="h-5 w-5" /></span>
                <div><strong className="block text-[24px] font-black leading-none">{Math.round(ranking.remainingNutrition.calories)}</strong><span className="text-[11px] font-bold text-slate-400">{copy.calories}</span></div>
              </div>
              <div className="flex items-center gap-3 ps-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-sky-500/15 text-sky-400"><Dumbbell className="h-5 w-5" /></span>
                <div><strong className="block text-[24px] font-black leading-none">{Math.round(ranking.remainingNutrition.protein)}g</strong><span className="text-[11px] font-bold text-slate-400">{copy.protein}</span></div>
              </div>
            </div>
          </section>

          {ranking.offline || staleSafety ? (
            <aside className={cn("mx-4 mt-3 flex gap-3 rounded-[18px] p-3 text-[11px] font-bold leading-4", ranking.offline ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-sky-50 text-sky-900 ring-1 ring-sky-200")}>
              {ranking.offline ? <CloudOff className="h-5 w-5 shrink-0" /> : <CircleAlert className="h-5 w-5 shrink-0" />}
              <p>{ranking.offline ? copy.offline : copy.incomplete}</p>
            </aside>
          ) : null}

          <section className="mx-4 mt-3 overflow-hidden rounded-[22px] bg-white ring-1 ring-slate-200">
            <button type="button" onClick={() => setShowFilters((current) => !current)} className="flex min-h-14 w-full items-center justify-between px-4 text-[13px] font-black text-[#08152f]" aria-expanded={showFilters}>
              <span className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#0cae8e]" />{copy.filters}</span>
              <ChevronDown className={cn("h-4 w-4 transition", showFilters && "rotate-180")} />
            </button>
            {showFilters ? (
              <div className="space-y-5 border-t border-slate-100 px-4 pb-5 pt-4">
                <label className="block text-[12px] font-extrabold text-slate-600"><span className="mb-2 flex justify-between"><span>{copy.maximumCalories}</span><strong className="text-[#0cae8e]">{maxCalories}</strong></span><input type="range" min="300" max="1200" step="50" value={maxCalories} onChange={(event) => setMaxCalories(Number(event.target.value))} className="w-full accent-[#11b995]" /></label>
                <label className="block text-[12px] font-extrabold text-slate-600"><span className="mb-2 flex justify-between"><span>{copy.minimumProtein}</span><strong className="text-[#0cae8e]">{minProtein}g</strong></span><input type="range" min="0" max="80" step="5" value={minProtein} onChange={(event) => setMinProtein(Number(event.target.value))} className="w-full accent-[#11b995]" /></label>
              </div>
            ) : null}
          </section>

          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <h2 className="text-[16px] font-black text-[#08152f]">{meals.length} {copy.matches}</h2>
            <span className="text-[10px] font-extrabold text-slate-400">{ranking.engineVersion}</span>
          </div>

          <section className="space-y-4 px-4" aria-live="polite">
            {meals.map((meal, index) => (
              <article key={meal.id} className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200">
                <Link to={`/meals/${meal.id}`} onClick={() => trackEvent("meal_ranking_result_opened", { engine_version: ranking.engineVersion, meal_id: meal.id, rank: index + 1, score: meal.finalScore })} className="group block">
                  <div className="relative h-[178px] overflow-hidden bg-slate-100">
                    {meal.image_url ? <img src={meal.image_url} alt={meal.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center text-slate-300"><UtensilsCrossed className="h-12 w-12" /></div>}
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#08152f]/80 to-transparent" />
                    <span className="absolute start-3 top-3 inline-flex h-12 min-w-12 flex-col items-center justify-center rounded-[16px] bg-white/95 px-2 text-[#08152f] shadow-sm"><strong className="text-[17px] font-black leading-none">{meal.finalScore}%</strong><small className="mt-1 text-[8px] font-black uppercase text-slate-500">{copy.score}</small></span>
                    <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3 text-white"><div className="min-w-0"><p className="truncate text-[11px] font-bold text-[#67e4c6]">{meal.restaurant_name}</p><h3 className="mt-0.5 line-clamp-2 text-[17px] font-black leading-5">{meal.name}</h3></div><ArrowRight className="h-5 w-5 shrink-0 rtl:rotate-180" /></div>
                  </div>
                </Link>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-4 text-[11px] font-extrabold text-slate-600"><span className="flex items-center gap-1.5"><Flame className="h-4 w-4 text-orange-500" />{Math.round(meal.calories ?? 0)} cal</span><span className="flex items-center gap-1.5"><Dumbbell className="h-4 w-4 text-sky-500" />{Math.round(meal.protein_g ?? 0)}g</span><span className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-violet-500" />{meal.meal_type || "meal"}</span>{meal.deliveryMinutes !== null && meal.deliveryMinutes !== undefined ? <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-[#22C7A1]" />{meal.deliveryMinutes} {copy.minuteUnit}</span> : null}</div>
                  <p className="mt-4 text-[10px] font-black uppercase text-slate-400">{copy.why}</p>
                  <div className="mt-2 flex flex-wrap gap-2">{meal.explanationCodes.slice(0, 3).map((code) => <span key={code} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold", code === "missing_safety_data" || code === "stale_activity" ? "bg-amber-50 text-amber-800" : "bg-[#e8faf5] text-[#087f69]")}><Sparkles className="h-3 w-3" />{reasons[code]}</span>)}</div>
                </div>
                <ScoreBreakdown meal={meal} copy={copy} />
              </article>
            ))}
            {meals.length === 0 ? <div className="rounded-[24px] bg-white px-6 py-12 text-center ring-1 ring-slate-200"><UtensilsCrossed className="mx-auto h-9 w-9 text-slate-300" /><h2 className="mt-3 text-[15px] font-black text-[#08152f]">{copy.noMatches}</h2><p className="mt-1 text-[12px] font-medium leading-5 text-slate-500">{copy.noMatchesHint}</p></div> : null}
          </section>
        </>
      ) : null}
    </main>
  );
}
