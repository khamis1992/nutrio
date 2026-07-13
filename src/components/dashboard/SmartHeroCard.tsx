import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import {
  Flame,
  ShoppingBag,
  Bike,
  Dumbbell,
  ChevronRight,
  Crown,
} from "lucide-react";
import { Link } from "react-router-dom";

interface SmartHeroCardProps {
  hourNow: number;
  calLeft: number;
  animatedCalories: number;
  animatedBurned: number;
  totalBurned: number;
  workoutCount: number;
  activeOrdersCount: number;
  todayMealsCount: number;
  remainingMeals: number;
  totalMeals: number;
  isUnlimited: boolean;
  deliveryEta: number | null;
  planName: string;
  joinedLabel: string;
  onLogMeal: () => void;
}

type HeroState = "morning-meals" | "evening-order" | "post-workout" | "delivery" | "default";

function getHeroState(props: SmartHeroCardProps): HeroState {
  const { hourNow, totalBurned, activeOrdersCount, deliveryEta } = props;

  if (deliveryEta !== null && deliveryEta > 0) return "delivery";
  if (props.workoutCount > 0 && totalBurned > 300 && hourNow >= 6 && hourNow < 12) return "post-workout";
  if (activeOrdersCount > 0) return "default";
  if (hourNow >= 17 && props.calLeft > 0) return "evening-order";
  if (hourNow >= 5 && hourNow < 12) return "morning-meals";

  return "default";
}

export function SmartHeroCard(props: SmartHeroCardProps) {
  const { t } = useLanguage();
  const state = useMemo(() => getHeroState(props), [
    props.hourNow, props.workoutCount, props.totalBurned, props.activeOrdersCount, props.deliveryEta, props.calLeft
  ]);

  const {
    calLeft,
    todayMealsCount,
    deliveryEta,
    remainingMeals,
    totalMeals,
    isUnlimited,
    planName,
    joinedLabel,
    onLogMeal,
  } = props;

  const balanceDisplay = isUnlimited ? "∞" : Number.isFinite(remainingMeals) ? remainingMeals : 0;

  const config = {
    "morning-meals": {
      title: todayMealsCount > 0
        ? `${todayMealsCount} meals planned today`
        : "Plan your meals today",
      subtitle: todayMealsCount > 0
        ? "You're set for the day — view schedule"
        : t("healthy_breakfast_message"),
      primaryValue: todayMealsCount.toString(),
      primaryLabel: "meals",
      accent: "from-emerald-500 to-teal-500",
      icon: ShoppingBag,
      action: { label: t("action_view_schedule"), to: "/schedule" },
    },
    "evening-order": {
      title: `${calLeft.toLocaleString()} cal remaining`,
      subtitle: "Order dinner now to hit your goal",
      primaryValue: calLeft.toLocaleString(),
      primaryLabel: "cal",
      accent: "from-violet-500 to-fuchsia-500",
      icon: Flame,
      action: { label: t("action_order_dinner"), to: "/meals" },
    },
    "post-workout": {
      title: `Great workout!`,
      subtitle: `You burned ${props.totalBurned} cal — treat yourself`,
      primaryValue: `+${props.totalBurned}`,
      primaryLabel: "earned",
      accent: "from-amber-500 to-orange-500",
      icon: Dumbbell,
      action: { label: t("action_log_meal"), to: undefined as string | undefined },
    },
    delivery: {
      title: "Your order is on the way",
      subtitle: deliveryEta !== null && deliveryEta > 0 ? `Arrives in ~${deliveryEta} min` : "Track your delivery",
      primaryValue: deliveryEta !== null ? `${deliveryEta}` : "—",
      primaryLabel: "min",
      accent: "from-sky-400 to-blue-500",
      icon: Bike,
      action: { label: t("action_track_order"), to: "/orders" },
    },
    default: {
      title: `${balanceDisplay} meals remaining`,
      subtitle: `${isUnlimited ? "Unlimited plan" : `${balanceDisplay} of ${totalMeals}`} · ${planName}`,
      primaryValue: balanceDisplay.toString(),
      primaryLabel: "meals",
      accent: "from-emerald-500 to-teal-500",
      icon: Crown,
      action: { label: t("action_view_plan"), to: "/subscription" },
    },
  };

  const c = config[state];

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="mt-6 overflow-hidden rounded-[28px] shadow-[0_14px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/80"
    >
      <div className={`relative bg-gradient-to-br ${c.accent} px-5 py-6 overflow-hidden`}>
        {/* Background decorations */}
        <div className="absolute -top-8 -right-8 w-[140px] h-[140px] rounded-full bg-white/8 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 w-[100px] h-[100px] rounded-full bg-white/6 blur-2xl" />

        <div className="relative z-10">
          {/* Header row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white/20 shadow-[0_4px_10px_rgba(0,0,0,0.08)]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state}
                    initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.6, opacity: 0, rotate: 20 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  >
                    <c.icon className="h-[20px] w-[20px] text-white" strokeWidth={2} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`title-${state}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 24 }}
                    className="text-[14px] font-bold leading-snug text-white"
                  >
                    {c.title}
                  </motion.p>
                </AnimatePresence>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`sub-${state}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: 0.03, type: "spring", stiffness: 300, damping: 24 }}
                    className="mt-0.5 text-[11px] font-medium text-white/80"
                  >
                    {c.subtitle}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
            {isUnlimited && (
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur-sm">
                PREMIUM
              </span>
            )}
          </div>

          {/* Primary value */}
          <div className="mt-4 flex items-baseline gap-1.5">
            <AnimatePresence mode="wait">
              <motion.span
                key={`value-${state}`}
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                className="text-[48px] font-extrabold leading-none tracking-[-0.04em] text-white"
              >
                {c.primaryValue}
              </motion.span>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.span
                key={`label-${state}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: 0.02, type: "spring", stiffness: 300, damping: 24 }}
                className="text-[16px] font-semibold text-white/70"
              >
                {c.primaryLabel}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Action button */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 24 }}
            className="mt-4"
          >
            {c.action.to ? (
              <Link
                to={c.action.to}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_10px_rgba(0,0,0,0.08)] backdrop-blur-sm transition hover:bg-white/25"
              >
                {c.action.label}
                <ChevronRight className="h-[14px] w-[14px]" strokeWidth={2.5} />
              </Link>
            ) : (
              <button
                type="button"
                onClick={onLogMeal}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_4px_10px_rgba(0,0,0,0.08)] backdrop-blur-sm transition hover:bg-white/25"
              >
                {c.action.label}
              </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Compact secondary stats row */}
      <div className="flex items-center gap-1 border-t border-slate-100 bg-white px-4 py-2.5">
        <div className="flex-1 text-center">
          <p className="text-[10px] font-medium text-slate-500">{t("plan_label")}</p>
          <p className="text-[13px] font-extrabold text-slate-900">{planName}</p>
        </div>
        <div className="h-[24px] w-px bg-slate-200" />
        <div className="flex-1 text-center">
          <p className="text-[10px] font-medium text-slate-500">{t("meals_label")}</p>
          <p className="text-[13px] font-extrabold text-slate-900">{balanceDisplay}/{totalMeals}</p>
        </div>
        <div className="h-[24px] w-px bg-slate-200" />
        <div className="flex-1 text-center">
          <p className="text-[10px] font-medium text-slate-500">{t("joined")}</p>
          <p className="text-[11px] font-extrabold text-slate-700">{joinedLabel}</p>
        </div>
      </div>
    </motion.section>
  );
}
