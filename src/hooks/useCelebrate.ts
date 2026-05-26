import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Milestone {
  id: string;
  emoji: string;
  title: string;
  message: string;
}

export function useCelebrate(conditions: {
  streakDays: number;
  proteinHit: boolean;
  carbsHit: boolean;
  fatHit: boolean;
  allMacrosHit: boolean;
  caloriesHit: boolean;
  enabled: boolean;
}) {
  const celebrated = useRef(new Set<string>());

  const checkMilestone = (id: string, check: boolean, milestone: Milestone) => {
    if (check && !celebrated.current.has(id)) {
      celebrated.current.add(id);
      toast.custom(
        (t) => (
          <motion.div
            initial={{ x: 50, opacity: 0, scale: 0.9 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="relative overflow-hidden rounded-2xl p-4 shadow-2xl border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          >
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: -20, x: Math.random() * 300 - 150, opacity: 0, scale: 0 }}
                  animate={{ y: [null, 80 + Math.random() * 40], x: [null, Math.random() * 100 - 50], opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                  transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 0.5, repeat: Infinity, repeatDelay: 0.5 }}
                  className="absolute top-1/2 left-1/2 text-lg pointer-events-none"
                >
                  {milestone.emoji}
                </motion.div>
              ))}
            </div>
            <div className="relative z-10 flex items-start gap-3">
              <motion.span
                animate={{ scale: [1, 1.3, 1], rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-2xl"
              >
                {milestone.emoji}
              </motion.span>
              <div>
                <p className="text-sm font-extrabold text-white">{milestone.title}</p>
                <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{milestone.message}</p>
              </div>
            </div>
          </motion.div>
        ),
        { duration: 4000, position: "top-center" }
      );
    }
  };

  useEffect(() => {
    if (!conditions.enabled) return;

    const streakMilestones = [7, 14, 30, 60, 100];
    for (const target of streakMilestones) {
      if (conditions.streakDays >= target) {
        checkMilestone(`streak-${target}`, true, {
          id: `streak-${target}`,
          emoji: target >= 30 ? "🏆" : "🔥",
          title: `${target}-Day Streak!`,
          message: target >= 30
            ? `${target} consecutive days of logging. You're unstoppable!`
            : `${target} days in a row. Keep the momentum going!`,
        });
      }
    }

    checkMilestone("protein-100", conditions.proteinHit, {
      id: "protein-100",
      emoji: "💪",
      title: "Protein Goal Hit!",
      message: "You reached your daily protein target. Your muscles thank you!",
    });

    checkMilestone("carbs-100", conditions.carbsHit, {
      id: "carbs-100",
      emoji: "🌾",
      title: "Carbs Goal Hit!",
      message: "You've met your carbohydrate target for the day.",
    });

    checkMilestone("fat-100", conditions.fatHit, {
      id: "fat-100",
      emoji: "🥑",
      title: "Fat Goal Hit!",
      message: "You've hit your fat target. Balanced nutrition wins!",
    });

    checkMilestone("all-macros", conditions.allMacrosHit, {
      id: "all-macros",
      emoji: "🎯",
      title: "Perfect Macro Day!",
      message: "All three macros hit their targets. That's elite-level nutrition discipline.",
    });

    checkMilestone("calories-90", conditions.caloriesHit && !conditions.allMacrosHit, {
      id: "calories-90",
      emoji: "⚡",
      title: "Calorie Target Reached!",
      message: "You've hit your daily calorie budget. Well balanced!",
    });
  }, [conditions.enabled, conditions.streakDays, conditions.proteinHit, conditions.carbsHit, conditions.fatHit, conditions.allMacrosHit, conditions.caloriesHit]);
}
