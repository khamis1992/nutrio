import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Wallet } from "lucide-react";

interface MealActionBarProps {
  meal: { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; price: number | null };
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  isSuccess: boolean;
  hasActiveSubscription: boolean;
  isUnlimited: boolean;
  remainingMeals: number;
}

export const MealActionBar = ({
  meal,
  onClick,
  loading,
  disabled,
  isSuccess,
  hasActiveSubscription,
  isUnlimited,
  remainingMeals,
}: MealActionBarProps) => {
  const { t } = useLanguage();
  const noMealsLeft = hasActiveSubscription && !isUnlimited && remainingMeals <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="bg-card rounded-3xl shadow-lg border border-border/50 p-6"
    >
      <div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{t("selected")}</p>
            <p className="font-semibold text-foreground">{meal.name}</p>
            {noMealsLeft && (
              <p className="text-xs text-warning font-medium mt-0.5">{t("no_meals_left_buy")}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {hasActiveSubscription && (isUnlimited || remainingMeals > 0) && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("label_meals_left")}</p>
                <p className="text-sm font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
                  {isUnlimited ? "\u221E" : remainingMeals}
                </p>
              </div>
            )}
            <motion.button
              onClick={onClick}
              disabled={disabled || loading}
              whileTap={{ scale: 0.95 }}
              className={`
                w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all
                ${disabled
                  ? "bg-muted text-muted-foreground"
                  : isSuccess
                    ? "bg-primary hover:bg-primary/90"
                    : noMealsLeft
                      ? "bg-gradient-to-br from-amber-500 to-orange-500 hover:shadow-amber-500/40"
                      : "bg-gradient-to-br from-green-500 to-teal-500 hover:shadow-green-500/40"
                }
              `}
              style={{
                boxShadow: !disabled && !isSuccess
                  ? noMealsLeft
                    ? "0 8px 32px rgba(245, 158, 11, 0.4)"
                    : "0 8px 32px rgba(34, 197, 94, 0.4)"
                  : undefined
              }}
            >
              <AnimatePresence mode="wait">
                {loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0, rotate: -180 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 180 }}
                    className="text-white"
                  >
                    <svg className="w-7 h-7 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                    </svg>
                  </motion.span>
                ) : isSuccess ? (
                  <motion.span
                    key="success"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-white"
                  >
                    <Check className="w-7 h-7" />
                  </motion.span>
                ) : noMealsLeft ? (
                  <motion.span
                    key="wallet"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="text-white"
                  >
                    <Wallet className="w-7 h-7" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="add"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className="text-white"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">{t("tap_to_add_schedule")}</p>
      </div>
    </motion.div>
  );
};
