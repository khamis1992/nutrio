import { motion, AnimatePresence } from "framer-motion";
import { X, Flame, Dumbbell, Wheat, Droplets, DollarSign, CheckCircle2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface CompareMeal {
  id: string;
  name: string;
  image: string;
  calories: number;
  protein: number;
  carbs?: number | null;
  fat?: number | null;
  price?: number | null;
  restaurant: string;
}

interface MealCompareDrawerProps {
  open: boolean;
  onClose: () => void;
  meals: [CompareMeal, CompareMeal] | null;
}

function winnerBadge(label: string) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
      <CheckCircle2 className="h-3 w-3" />
      {label}
    </span>
  );
}

function MacroRow({
  label,
  leftValue,
  rightValue,
  unit,
  lowerBetter = true,
  t,
  highlightThreshold = 0,
}: {
  label: string;
  leftValue: number;
  rightValue: number;
  unit: string;
  lowerBetter?: boolean;
  t: (key: string) => string;
  highlightThreshold?: number;
}) {
  const diff = leftValue - rightValue;
  const percentDiff = Math.max(rightValue, 1) > 0 ? Math.abs(diff) / Math.max(rightValue, 1) : 0;

  // Only show winner if difference is > threshold
  const showWinner = percentDiff > highlightThreshold;
  const leftWinner = lowerBetter ? diff < 0 : diff > 0;
  const rightWinner = lowerBetter ? diff > 0 : diff < 0;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100">
      <span className="w-20 shrink-0 text-[13px] font-semibold text-slate-500">{label}</span>

      <div className="flex-1 flex items-center justify-end gap-2">
        <span className={cn("text-[15px] font-extrabold text-slate-900", showWinner && leftWinner && "text-emerald-600")}>
          {leftValue}
        </span>
        {showWinner && leftWinner && winnerBadge(lowerBetter ? t("compare_winner_calories") : t("compare_winner_protein"))}
      </div>

      <span className="w-8 text-center text-[10px] font-bold text-slate-400">{t("compare_vs")}</span>

      <div className="flex-1 flex items-center gap-2">
        <span className={cn("text-[15px] font-extrabold text-slate-900", showWinner && rightWinner && "text-emerald-600")}>
          {rightValue}
        </span>
        {showWinner && rightWinner && winnerBadge(lowerBetter ? t("compare_winner_calories") : t("compare_winner_protein"))}
      </div>

      <span className="w-8 text-[10px] font-medium text-slate-400 text-right">{unit}</span>
    </div>
  );
}

export function MealCompareDrawer({ open, onClose, meals }: MealCompareDrawerProps) {
  const { t } = useLanguage();
  if (!meals) return null;

  const [left, right] = meals;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-[24px] bg-white pb-8 shadow-[0_-8px_40px_rgba(0,0,0,0.15)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-[18px] font-extrabold text-slate-900">{t("compare_title")}</h2>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 pt-4">
              {/* Meal headers */}
              <div className="flex gap-4">
                {/* Left meal */}
                <div className="flex-1 text-center">
                  <div className="mx-auto h-28 w-full max-w-[140px] overflow-hidden rounded-2xl">
                    <img src={left.image} alt={left.name} className="h-full w-full object-cover" />
                  </div>
                  <h3 className="mt-2 text-[14px] font-extrabold text-slate-900 leading-tight line-clamp-2">{left.name}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{left.restaurant}</p>
                </div>

                {/* VS */}
                <div className="flex shrink-0 items-center justify-center w-12">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase">{t("compare_vs")}</span>
                </div>

                {/* Right meal */}
                <div className="flex-1 text-center">
                  <div className="mx-auto h-28 w-full max-w-[140px] overflow-hidden rounded-2xl">
                    <img src={right.image} alt={right.name} className="h-full w-full object-cover" />
                  </div>
                  <h3 className="mt-2 text-[14px] font-extrabold text-slate-900 leading-tight line-clamp-2">{right.name}</h3>
                  <p className="text-[11px] font-medium text-slate-500">{right.restaurant}</p>
                </div>
              </div>

              {/* Macro comparison */}
              <div className="mt-5">
                <MacroRow
                  label={t("compare_calories")}
                  leftValue={left.calories || 0}
                  rightValue={right.calories || 0}
                  unit="kcal"
                  lowerBetter={true}
                  t={t}
                />
                <MacroRow
                  label={t("compare_protein")}
                  leftValue={left.protein || 0}
                  rightValue={right.protein || 0}
                  unit="g"
                  lowerBetter={false}
                  t={t}
                  highlightThreshold={0.05}
                />
                {left.carbs != null && right.carbs != null && (
                  <MacroRow
                    label={t("compare_carbs")}
                    leftValue={left.carbs}
                    rightValue={right.carbs}
                    unit="g"
                    lowerBetter={true}
                    t={t}
                  />
                )}
                {left.fat != null && right.fat != null && (
                  <MacroRow
                    label={t("compare_fat")}
                    leftValue={left.fat}
                    rightValue={right.fat}
                    unit="g"
                    lowerBetter={true}
                    t={t}
                  />
                )}
                {left.price != null && right.price != null && (
                  <MacroRow
                    label={t("compare_price")}
                    leftValue={left.price}
                    rightValue={right.price}
                    unit="SAR"
                    lowerBetter={true}
                    t={t}
                  />
                )}

                {/* Summary verdict */}
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <h4 className="text-[13px] font-extrabold text-slate-700 mb-2">
                    {(() => {
                      const leftScore =
                        (left.calories || 0) * 0.25 +
                        (right.protein || 0) * 1.5 -
                        (left.protein || 0) * 1.5 +
                        (left.carbs || 0) * 0.1 -
                        (right.carbs || 0) * 0.1 +
                        (left.fat || 0) * 0.1 -
                        (right.fat || 0) * 0.1;
                      if (leftScore > 0) return left.name;
                      return right.name;
                    })()} {t("compare_vs")} {leftScore > 0 ? right.name : left.name}
                  </h4>
                  <p className="text-[12px] font-medium text-slate-500">Based on lower calories, higher protein, and overall macro balance</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="mt-4 w-full rounded-full bg-[#009F63] py-3.5 text-[14px] font-extrabold text-white shadow-[0_8px_20px_rgba(0,159,99,0.25)] transition active:scale-95"
              >
                {t("compare_done")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
