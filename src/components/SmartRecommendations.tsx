import { motion } from "framer-motion";
import { CircleAlert, Clock, CloudOff, Dumbbell, Flame, RefreshCw, Sparkles, Star, Utensils } from "lucide-react";
import { Link } from "react-router-dom";

import { useLanguage } from "@/contexts/LanguageContext";
import { useMealRecommendations } from "@/hooks/useMealRecommendations";
import { trackEvent } from "@/lib/analytics";
import type { MealExplanationCode } from "@/lib/mealRanking";
import { ScoredMeal } from "@/lib/recommendation-engine";
import { cn } from "@/lib/utils";

type RecommendationGroup = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Star;
  meals: ScoredMeal[];
  badge: (meal: ScoredMeal, index: number) => string | undefined;
};

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const reasonCopy: Record<"en" | "ar", Partial<Record<MealExplanationCode, string>>> = {
  en: {
    calorie_fit: "Calorie fit",
    protein_gap: "Protein fit",
    macro_balance: "Balanced",
    preference_match: "Your taste",
    variety: "More variety",
    high_rating: "Highly rated",
    delivery_fit: "Delivery fit",
    good_value: "Good value",
    micronutrient_fit: "Micronutrient fit",
    health_context_fit: "Your health check-in",
  },
  ar: {
    calorie_fit: "مناسب للسعرات",
    protein_gap: "مناسب للبروتين",
    macro_balance: "متوازن",
    preference_match: "يناسب ذوقك",
    variety: "تنوع أكبر",
    high_rating: "عالي التقييم",
    delivery_fit: "توصيل مناسب",
    good_value: "قيمة جيدة",
    micronutrient_fit: "مغذيات مناسبة",
    health_context_fit: "تسجيلك الصحي",
  },
};

function MealTile({
  meal,
  badge,
  index,
  engineVersion,
  reasons,
}: {
  meal: ScoredMeal;
  badge?: string;
  index: number;
  engineVersion: string;
  reasons: Partial<Record<MealExplanationCode, string>>;
}) {
  return (
    <motion.div
      {...cardMotion}
      transition={{ duration: 0.24, delay: index * 0.04 }}
      className="snap-start"
    >
      <Link
        to={`/meals/${meal.id}`}
        onClick={() => trackEvent("meal_ranking_result_opened", {
          engine_version: engineVersion,
          meal_id: meal.id,
          rank: index + 1,
          score: meal.finalScore ?? meal.score,
          surface: "smart_picks",
        })}
        className="group block w-[164px] overflow-hidden rounded-[20px] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 transition active:scale-[0.98]"
      >
        <div className="relative h-[112px] overflow-hidden bg-slate-100">
          {meal.image_url ? (
            <img
              src={meal.image_url}
              alt={meal.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-950 text-white">
              <Utensils className="h-8 w-8" strokeWidth={1.8} />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-slate-950/72 to-transparent" />
          {badge && (
            <span className="absolute left-2 top-2 rounded-full bg-[#020617] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
              {badge}
            </span>
          )}
          <span className="absolute bottom-2 right-2 inline-flex h-7 items-center gap-1 rounded-full bg-white/95 px-2 text-[11px] font-black text-slate-950 shadow-sm">
            <Flame className="h-3.5 w-3.5 text-orange-500" strokeWidth={2.3} />
            {meal.calories ?? 0}
          </span>
        </div>

        <div className="p-3">
          <h3 className="truncate text-[13px] font-black leading-tight text-slate-950">{meal.name}</h3>
          <p className="mt-1 truncate text-[11px] font-bold text-slate-500">{meal.restaurant_name}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
              {meal.meal_type || "meal"}
            </span>
            {meal.protein_g ? (
              <span className="text-[11px] font-black text-slate-950">{Math.round(meal.protein_g)}g P</span>
            ) : null}
          </div>
          {meal.explanationCodes?.[0] && reasons[meal.explanationCodes[0]] ? (
            <p className="mt-2 truncate text-[10px] font-extrabold text-[#087f69]">
              {reasons[meal.explanationCodes[0]]}
            </p>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}

function SectionHeader({
  group,
  onRefresh,
}: {
  group: RecommendationGroup;
  onRefresh?: () => void;
}) {
  const Icon = group.icon;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.16)]">
          <Icon className="h-4.5 w-4.5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-black tracking-normal text-slate-950">{group.title}</h3>
          <p className="truncate text-[11px] font-bold text-slate-500">{group.subtitle}</p>
        </div>
      </div>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-600 ring-1 ring-slate-200 transition active:scale-95"
          aria-label="Refresh smart recommendations"
        >
          <RefreshCw className="h-4 w-4" strokeWidth={2.4} />
        </button>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <section className="rounded-[28px] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-[15px] bg-slate-100" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded-full bg-slate-100" />
          <div className="h-3 w-44 rounded-full bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 flex gap-3 overflow-hidden">
        {[1, 2].map((item) => (
          <div key={item} className="h-[184px] w-[164px] shrink-0 rounded-[20px] bg-slate-100" />
        ))}
      </div>
    </section>
  );
}

export function SmartMealPicks() {
  const { recommendations, ranking, loading, refresh } = useMealRecommendations();
  const { t, language, isRTL } = useLanguage();

  if (loading) return <LoadingState />;

  const mealTypeLabels: Record<string, string> = {
    breakfast: t("meal_type_breakfast"),
    lunch: t("meal_type_lunch"),
    snacks: t("meal_type_snacks"),
    dinner: t("meal_type_dinner"),
  };
  const currentMealType = mealTypeLabels[recommendations.currentMealType] || t("meal_type_default");

  const groupCandidates: RecommendationGroup[] = [
    {
      id: "for-you",
      title: t("smart_rec_for_you_title"),
      subtitle: t("smart_rec_for_you_subtitle"),
      icon: Sparkles,
      meals: recommendations.forYou,
      badge: (_meal, index) => (index < 3 ? t("smart_rec_top_badge") : undefined),
    },
    {
      id: "by-time",
      title: t("smart_rec_time_title", { mealType: currentMealType }),
      subtitle: t("smart_rec_time_subtitle"),
      icon: Clock,
      meals: recommendations.byTime,
      badge: (meal) =>
        meal.meal_type === recommendations.currentMealType ? t("smart_rec_ideal_badge") : undefined,
    },
    {
      id: "protein",
      title: t("smart_rec_protein_title"),
      subtitle:
        recommendations.proteinRemaining > 0
          ? t("smart_rec_protein_remaining", { remaining: String(Math.round(recommendations.proteinRemaining)) })
          : t("smart_rec_protein_complete"),
      icon: Dumbbell,
      meals: recommendations.forProtein,
      badge: (meal) =>
        meal.protein_g && meal.protein_g >= 30
          ? t("smart_rec_protein_badge", { grams: String(Math.round(meal.protein_g)) })
          : undefined,
    },
  ];
  const groups = groupCandidates.filter((group) => group.meals.length > 0);

  if (groups.length === 0) return null;

  const primaryGroup = groups[0];
  const secondaryGroups = groups.slice(1, 3);
  const staleSafety = ranking?.inputFreshness.safety !== "fresh";

  return (
    <section className="overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80" dir={isRTL ? "rtl" : "ltr"}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            {t("smart_next_meal")}
          </p>
          <h2 className="mt-1 text-[20px] font-black tracking-normal text-slate-950">{t("smart_picks")}</h2>
        </div>
        <span className="rounded-full bg-[#020617] px-3 py-2 text-[11px] font-black text-white">
          {t("picks_count", { count: primaryGroup.meals.length })}
        </span>
      </div>

      {ranking?.offline || staleSafety ? (
        <div className="mb-4 flex items-start gap-2 rounded-[16px] bg-amber-50 p-3 text-[10px] font-bold leading-4 text-amber-900 ring-1 ring-amber-200">
          {ranking?.offline ? <CloudOff className="mt-0.5 h-4 w-4 shrink-0" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>
            {language === "ar"
              ? ranking?.offline ? "نعرض آخر ترشيحات محفوظة؛ تحقق من توفر الوجبة." : "راجع المكونات لأن بعض بيانات السلامة غير مكتملة."
              : ranking?.offline ? "Showing saved picks; confirm meal availability." : "Review ingredients because some safety data is incomplete."}
          </span>
        </div>
      ) : null}

      <SectionHeader group={primaryGroup} onRefresh={refresh} />
      <div
        className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {primaryGroup.meals.slice(0, 6).map((meal, index) => (
          <MealTile
            key={`${primaryGroup.id}-${meal.id}`}
            meal={meal}
            badge={primaryGroup.badge(meal, index)}
            index={index}
            engineVersion={ranking?.engineVersion ?? "legacy"}
            reasons={reasonCopy[language]}
          />
        ))}
      </div>

      {secondaryGroups.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {secondaryGroups.map((group) => {
            const firstMeal = group.meals[0];
            const Icon = group.icon;

            return (
              <Link
                key={group.id}
                to={`/meals/${firstMeal.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/70 transition active:scale-[0.99]",
                  "hover:bg-white hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-slate-950 ring-1 ring-slate-200">
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.4} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-slate-950">{group.title}</p>
                  <p className="truncate text-[11px] font-bold text-slate-500">{firstMeal.name}</p>
                </div>
                <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" strokeWidth={0} />
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export const SmartRecommendations = SmartMealPicks;
