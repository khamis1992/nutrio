import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Flame, Clock, Dumbbell, RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMealRecommendations } from "@/hooks/useMealRecommendations";
import { ScoredMeal } from "@/lib/recommendation-engine";
import { useLanguage } from "@/contexts/LanguageContext";

const spring = { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.8 };

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: spring },
};

function RecommendationCard({
  meal,
  index,
  badge,
  badgeColor,
}: {
  meal: ScoredMeal;
  index: number;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      className="flex-shrink-0 w-40"
    >
      <Link to={`/meals/${meal.id}`} className="block group">
        <div className="bg-card dark:bg-gray-900 rounded-2xl overflow-hidden shadow-sm border border-border/50 dark:border-gray-800 hover:shadow-md transition-all">
          <div className="relative h-28 bg-gradient-to-br from-primary/5 to-accent/10 overflow-hidden">
            {meal.image_url ? (
              <img
                src={meal.image_url}
                alt={meal.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-3xl">🍽️</span>
              </div>
            )}
            {badge && (
              <span
                className={cn(
                  "absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm",
                  badgeColor || "bg-primary/90 text-primary-foreground"
                )}
              >
                {badge}
              </span>
            )}
          </div>

          <div className="p-2.5">
            <h3 className="font-semibold text-xs text-foreground dark:text-gray-200 line-clamp-1 leading-tight">
              {meal.name}
            </h3>
            <p className="text-[10px] text-muted-foreground dark:text-gray-400 line-clamp-1 mt-0.5">
              {meal.restaurant_name}
            </p>

            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                <Flame className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold">{meal.calories ?? 0}</span>
              </div>
              {meal.protein_g !== null && meal.protein_g > 0 && (
                <span className="text-[10px] text-emerald-600 font-medium">
                  P {Math.round(meal.protein_g)}g
                </span>
              )}
            </div>

            {meal.reason && (
              <p className="text-[10px] text-muted-foreground/80 mt-1 truncate">
                💡 {meal.reason}
              </p>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  onRefresh,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor?: string;
  onRefresh?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
            iconColor || "bg-primary/10 text-primary"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground dark:text-gray-200">{title}</h3>
          <p className="text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
  {/* ── Refresh Button ── */}
      {onRefresh && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onRefresh}
          className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </motion.button>
      )}
    </div>
  );
}

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="-mx-4 overflow-x-auto px-4 scrollbar-hide pb-2"
      style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
    >
      <div className="flex gap-3 pr-4">
        {children}
      </div>
    </div>
  );
}

export function SmartRecommendations() {
  const { recommendations, loading, refresh } = useMealRecommendations();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="space-y-5 py-2">
        {[1, 2].map((section) => (
          <div key={section}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-7 h-7 rounded-lg bg-muted animate-pulse" />
              <div className="space-y-1">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-2.5 w-32 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-shrink-0 w-40 rounded-2xl overflow-hidden">
                  <div className="h-28 bg-muted animate-pulse" />
                  <div className="p-2.5 space-y-2 bg-card border border-border/50">
                    <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-2.5 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (
    recommendations.forYou.length === 0 &&
    recommendations.byTime.length === 0 &&
    recommendations.forProtein.length === 0
  ) {
    return null;
  }

  const mealTypeLabels: Record<string, string> = {
    breakfast: t("meal_type_breakfast"),
    lunch: t("meal_type_lunch"),
    snacks: t("meal_type_snacks"),
    dinner: t("meal_type_dinner"),
  };

  const currentLabel =
    mealTypeLabels[recommendations.currentMealType] || t("meal_type_default");

  return (
    <motion.div
      className="space-y-5 py-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <SectionHeader
        title={t("smart_rec_for_you_title")}
        subtitle={t("smart_rec_for_you_subtitle")}
        icon={Star}
        iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        onRefresh={refresh}
      />
      <HorizontalScroll>
        {recommendations.forYou.map((meal, i) => (
          <RecommendationCard
            key={meal.id}
            meal={meal}
            index={i}
            badge={i < 3 ? t("smart_rec_top_badge") : undefined}
            badgeColor="bg-amber-500/90 text-white"
          />
        ))}
      </HorizontalScroll>

      {recommendations.byTime.length > 0 && (
        <>
          <SectionHeader
            title={t("smart_rec_time_title", { mealType: currentLabel })}
            subtitle={t("smart_rec_time_subtitle")}
            icon={Clock}
            iconColor="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          />
          <HorizontalScroll>
            {recommendations.byTime.map((meal, i) => (
              <RecommendationCard
                key={meal.id}
                meal={meal}
                index={i}
                badge={meal.meal_type === recommendations.currentMealType ? t("smart_rec_ideal_badge") : undefined}
                badgeColor="bg-emerald-500/90 text-white"
              />
            ))}
          </HorizontalScroll>
        </>
      )}

      {recommendations.forProtein.length > 0 && (
        <>
          <SectionHeader
            title={t("smart_rec_protein_title")}
            subtitle={
              recommendations.proteinRemaining > 0
                ? t("smart_rec_protein_remaining", { remaining: String(Math.round(recommendations.proteinRemaining)) })
                : t("smart_rec_protein_complete")
            }
            icon={Dumbbell}
            iconColor="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
          <HorizontalScroll>
            {recommendations.forProtein.map((meal, i) => (
              <RecommendationCard
                key={meal.id}
                meal={meal}
                index={i}
                badge={
                  meal.protein_g && meal.protein_g >= 30
                    ? t("smart_rec_protein_badge", { grams: String(Math.round(meal.protein_g)) })
                    : undefined
                }
                badgeColor="bg-emerald-600/90 text-white"
              />
            ))}
          </HorizontalScroll>
        </>
      )}
    </motion.div>
  );
}
