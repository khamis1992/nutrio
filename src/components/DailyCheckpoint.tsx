import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Flame,
  TrendingUp,
  Target,
  Utensils,
  ChevronRight,
  CheckCircle2,
  Coffee,
  Moon,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface DailyCheckpointProps {
  calConsumed: number;
  calBurned: number;
  dailyCalories: number;
  dailyStreak: number;
  proteinRemaining: number;
  carbsRemaining: number;
  fatRemaining: number;
  scheduledMealsCount: number;
  hasActiveSubscription: boolean;
  isUnlimited: boolean;
  mealsRemaining: number;
  hourNow: number;
  onLogMeal: () => void;
}

type Checkpoint =
  | { kind: "first_time"; streak: number }
  | { kind: "streak_risk"; streak: number; mealsNeeded: number }
  | { kind: "on_track"; streak: number; mealsLeft: number }
  | { kind: "macro_gap"; macro: "protein" | "carbs" | "fat"; remaining: number; target: number }
  | { kind: "perfect_day"; streak: number }
  | { kind: "done_for_today" }
  | { kind: "evening_wind_down" }
  | { kind: "morning_start" };

interface CheckpointConfig {
  icon: LucideIcon;
  iconBg: string;
  title: string;
  subtitle: string;
  action: string;
  actionIcon: LucideIcon;
  actionColor: string;
  gradient: string;
  border: string;
  onClick?: () => void;
  to?: string;
}

function computeCheckpoint(p: DailyCheckpointProps): Checkpoint {
  const { calConsumed, calBurned, dailyCalories, dailyStreak, proteinRemaining, carbsRemaining, fatRemaining, scheduledMealsCount, hasActiveSubscription, isUnlimited, mealsRemaining, hourNow } = p;
  const hasLogged = calConsumed > 0 || calBurned > 0;
  const calLeft = Math.max(0, dailyCalories - Math.max(0, calConsumed - calBurned));
  const mealsLeft = isUnlimited ? Infinity : mealsRemaining;

  if (!hasLogged && dailyStreak > 0) {
    return { kind: "streak_risk", streak: dailyStreak, mealsNeeded: 1 };
  }

  if (!hasLogged && dailyStreak === 0) {
    if (hourNow < 10) return { kind: "morning_start" };
    return { kind: "first_time", streak: 0 };
  }

  if (calLeft > 0 && calConsumed > 0 && mealsLeft > 0) {
    if (proteinRemaining >= proteinRemaining * 0.5 && proteinRemaining > 30) {
      return { kind: "macro_gap", macro: "protein", remaining: proteinRemaining, target: proteinRemaining + (calConsumed > 0 ? 0 : 0) };
    }
    if (carbsRemaining >= carbsRemaining * 0.5 && carbsRemaining > 30) {
      return { kind: "macro_gap", macro: "carbs", remaining: carbsRemaining, target: carbsRemaining + (calConsumed > 0 ? 0 : 0) };
    }
    if (fatRemaining > 20) {
      return { kind: "macro_gap", macro: "fat", remaining: fatRemaining, target: fatRemaining };
    }
    if (scheduledMealsCount === 0 && mealsLeft > 0) {
      return { kind: "on_track", streak: dailyStreak, mealsLeft: 1 };
    }
    return { kind: "on_track", streak: dailyStreak, mealsLeft: 0 };
  }

  if (calLeft <= 0 && hasLogged) {
    if (hourNow >= 20) return { kind: "evening_wind_down" };
    if (dailyStreak > 0) return { kind: "perfect_day", streak: dailyStreak };
    return { kind: "done_for_today" };
  }

  if (!hasActiveSubscription || mealsLeft <= 0) {
    if (dailyStreak > 0 && !hasLogged) {
      return { kind: "streak_risk", streak: dailyStreak, mealsNeeded: 1 };
    }
    return { kind: "done_for_today" };
  }

  if (hourNow >= 20) return { kind: "evening_wind_down" };

  return { kind: "on_track", streak: dailyStreak, mealsLeft: 0 };
}

export function DailyCheckpoint(props: DailyCheckpointProps) {
  const cp = computeCheckpoint(props);

  const config: Record<Checkpoint["kind"], CheckpointConfig> = {
    first_time: {
      icon: Utensils,
      iconBg: "bg-gradient-to-br from-emerald-400 to-teal-500",
      title: "Start your streak today",
      subtitle: "Log your first meal to begin building momentum",
      action: "Log Your First Meal" as const,
      actionIcon: Utensils,
      actionColor: "bg-emerald-500 text-white",
      gradient: "from-emerald-50 via-teal-50 to-emerald-50/50",
      border: "ring-emerald-100/60",
      onClick: props.onLogMeal,
    },
    streak_risk: {
      icon: Flame,
      iconBg: "bg-gradient-to-br from-amber-400 to-orange-500",
      title: `${cp.kind === "streak_risk" ? cp.mealsNeeded : 1} meal away from a ${cp.kind === "streak_risk" ? cp.streak : props.dailyStreak}-day streak`,
      subtitle: "Don't break it — log now to keep the fire alive",
      action: "Log Meal to Keep Streak" as const,
      actionIcon: Flame,
      actionColor: "bg-amber-500 text-white",
      gradient: "from-amber-50 via-orange-50 to-amber-50/50",
      border: "ring-amber-100/60",
      onClick: props.onLogMeal,
    },
    on_track: {
      icon: TrendingUp,
      iconBg: "bg-gradient-to-br from-blue-400 to-indigo-500",
      title: `${cp.kind === "on_track" ? cp.streak : props.dailyStreak}-day streak — keep going`,
      subtitle: "You're building momentum. Another meal keeps your streak alive.",
      action: "Log Meal" as const,
      actionIcon: Utensils,
      actionColor: "bg-blue-500 text-white",
      gradient: "from-blue-50 via-sky-50 to-blue-50/50",
      border: "ring-blue-100/60",
      onClick: props.onLogMeal,
    },
    macro_gap: {
      icon: Target,
      iconBg: "bg-gradient-to-br from-violet-400 to-purple-500",
      title: `${cp.kind === "macro_gap" ? cp.remaining : 0}g ${cp.kind === "macro_gap" ? cp.macro : "macro"} remaining`,
      subtitle: "Find a meal that fits your macros",
      action: "Browse Meals" as const,
      actionIcon: Utensils,
      actionColor: "bg-violet-500 text-white",
      gradient: "from-violet-50 via-purple-50 to-violet-50/50",
      border: "ring-violet-100/60",
      onClick: undefined,
      to: "/meals",
    },
    perfect_day: {
      icon: Trophy,
      iconBg: "bg-gradient-to-br from-amber-400 to-yellow-500",
      title: `Perfect day! ${cp.kind === "perfect_day" ? cp.streak : props.dailyStreak}-day streak`,
      subtitle: "All targets hit. Tomorrow starts fresh.",
      action: "View Progress" as const,
      actionIcon: TrendingUp,
      actionColor: "bg-amber-500 text-white",
      gradient: "from-amber-50 via-yellow-50 to-amber-50/50",
      border: "ring-amber-100/60",
      onClick: undefined,
      to: "/progress",
    },
    done_for_today: {
      icon: CheckCircle2,
      iconBg: "bg-gradient-to-br from-emerald-400 to-green-500",
      title: "You've crushed it today",
      subtitle: "All calories logged. See you tomorrow!",
      action: "View Progress" as const,
      actionIcon: TrendingUp,
      actionColor: "bg-emerald-500 text-white",
      gradient: "from-emerald-50 via-green-50 to-emerald-50/50",
      border: "ring-emerald-100/60",
      onClick: undefined,
      to: "/progress",
    },
    evening_wind_down: {
      icon: Moon,
      iconBg: "bg-gradient-to-br from-indigo-400 to-slate-600",
      title: "Time to wind down",
      subtitle: "Great job today. Plan tomorrow's meals while you relax.",
      action: "Plan Tomorrow" as const,
      actionIcon: Utensils,
      actionColor: "bg-indigo-500 text-white",
      gradient: "from-indigo-50 via-slate-50 to-indigo-50/50",
      border: "ring-indigo-100/60",
      onClick: undefined,
      to: "/schedule",
    },
    morning_start: {
      icon: Coffee,
      iconBg: "bg-gradient-to-br from-sky-400 to-blue-500",
      title: "Good morning! Ready to fuel up?",
      subtitle: "Log your breakfast to start the day right",
      action: "Log Breakfast" as const,
      actionIcon: Utensils,
      actionColor: "bg-sky-500 text-white",
      gradient: "from-sky-50 via-blue-50 to-sky-50/50",
      border: "ring-sky-100/60",
      onClick: props.onLogMeal,
    },
  };

  const c = config[cp.kind];
  const Icon = c.icon;
  const ActionIcon = c.actionIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`mt-4 rounded-2xl bg-gradient-to-br ${c.gradient} p-4 ring-1 ${c.border}`}
    >
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.iconBg} text-white shadow-[0_6px_14px_rgba(0,0,0,0.08)]`}>
          <Icon className="h-6 w-6" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-extrabold text-slate-900 leading-tight">
            {c.title}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            {c.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-3">
        {c.to ? (
          <Link
            to={c.to}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold ${c.actionColor} shadow-[0_6px_14px_rgba(0,0,0,0.08)] transition active:scale-[0.98]`}
          >
            <ActionIcon className="h-4 w-4" strokeWidth={2.25} />
            {c.action}
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </Link>
        ) : (
          <button
            onClick={c.onClick}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold ${c.actionColor} shadow-[0_6px_14px_rgba(0,0,0,0.08)] transition active:scale-[0.98]`}
          >
            <ActionIcon className="h-4 w-4" strokeWidth={2.25} />
            {c.action}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default DailyCheckpoint;
