import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  X,
  Flame,
  Beef,
  Leaf,
  Clock,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Substitute {
  meal: {
    id: string;
    name: string;
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    prep_time_minutes: number | null;
    image_url: string | null;
  };
  score: number;
  matchReasons: string[];
}

interface UnavailableMeal {
  scheduleId: string;
  scheduledDate: string;
  mealType: string;
  mealId: string;
  mealName: string;
  substitutes: Substitute[];
}

interface SmartSubstitutionBannerProps {
  unavailableMeals: UnavailableMeal[];
  onDismiss: (scheduleId: string) => void;
  onSubstitute: (scheduleId: string, newMealId: string) => Promise<boolean>;
}

export const SmartSubstitutionBanner = ({
  unavailableMeals,
  onDismiss,
  onSubstitute,
}: SmartSubstitutionBannerProps) => {
  const [substitutingId, setSubstitutingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSubstitute = async (scheduleId: string, newMealId: string) => {
    setSubstitutingId(scheduleId);
    const success = await onSubstitute(scheduleId, newMealId);
    setSubstitutingId(null);

    if (success) {
      toast.success("Meal substituted!", {
        description: "Your schedule has been updated with the new meal.",
        duration: 4000,
      });
    } else {
      toast.error("Substitution failed", {
        description: "Could not update the meal. Please try again.",
      });
    }
  };

  if (unavailableMeals.length === 0) return null;

  return (
    <div className="space-y-3 px-4 max-w-lg mx-auto">
      {unavailableMeals.map((item, index) => {
        const isExpanded = expandedId === item.scheduleId;

        return (
          <motion.div
            key={item.scheduleId}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "rounded-2xl overflow-hidden shadow-sm border transition-all",
              isExpanded
                ? "border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900"
                : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <button
              onClick={() => {
                setExpandedId(isExpanded ? null : item.scheduleId);
              }}
              className="w-full flex items-center gap-3 p-4 text-left cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {item.mealName} is no longer available
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.substitutes.length} similar alternatives found
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss(item.scheduleId);
                }}
                className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">
                      Suggested replacements
                    </p>
                    {item.substitutes.map((sub) => (
                      <motion.div
                        key={sub.meal.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
                      >
                        {sub.meal.image_url ? (
                          <img
                            src={sub.meal.image_url}
                            alt={sub.meal.name}
                            className="w-14 h-14 rounded-xl object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center shrink-0">
                            <Utensils className="h-6 w-6 text-amber-400" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            {sub.meal.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            {sub.meal.calories && (
                              <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                                <Flame className="h-3 w-3" />
                                {sub.meal.calories} kcal
                              </span>
                            )}
                            {sub.meal.protein_g && (
                              <span className="text-[10px] font-semibold text-rose-600 flex items-center gap-0.5">
                                <Beef className="h-3 w-3" />
                                {sub.meal.protein_g}g
                              </span>
                            )}
                            {sub.meal.prep_time_minutes && (
                              <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                <Clock className="h-3 w-3" />
                                {sub.meal.prep_time_minutes}m
                              </span>
                            )}
                          </div>
                          {sub.matchReasons.length > 0 && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {sub.matchReasons.join(" · ")}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSubstitute(item.scheduleId, sub.meal.id);
                          }}
                          disabled={substitutingId === item.scheduleId}
                          className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-all disabled:opacity-60 shadow-md shadow-emerald-500/20"
                        >
                          {substitutingId === item.scheduleId ? (
                            <Loader2 className="h-4 w-4 text-white animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4 text-white" />
                          )}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};
