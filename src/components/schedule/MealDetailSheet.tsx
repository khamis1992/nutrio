import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  X,
  Flame,
  Beef,
  Leaf,
  Clock,
  Loader2,
  CheckCircle2,
  Circle,
  Utensils,
  Calendar as CalendarIcon,
  Trash2,
} from "lucide-react";

interface ScheduledMeal {
  id: string;
  scheduled_date: string;
  meal_type: string;
  is_completed: boolean;
  delivery_time_slot: string | null;
  order_status: string;
  meal: {
    id: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    image_url: string | null;
  };
}

type MealTypeConfig = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  gradient: string;
  bgGradient: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  ringColor: string;
  shadowColor: string;
  nutritionBg: string;
  nutritionBorder: string;
};

interface MealDetailSheetProps {
  showMealSheet: boolean;
  onClose: () => void;
  selectedMeal: ScheduledMeal | null;
  togglingMealId: string | null;
  mealTypeConfig: Record<string, MealTypeConfig>;
  t: (key: string) => string;
  onTimeSlotOpen: (scheduleId: string) => void;
  onToggleCompletion: (scheduleId: string, isCompleted: boolean) => void;
  onReschedule: () => void;
  onDelete: (scheduleId: string) => void;
}

const MealDetailSheet = ({
  showMealSheet,
  onClose,
  selectedMeal,
  togglingMealId,
  mealTypeConfig,
  t: _t,
  onTimeSlotOpen,
  onToggleCompletion,
  onReschedule,
  onDelete,
}: MealDetailSheetProps) => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {showMealSheet && selectedMeal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 380 }}
            className="fixed left-0 right-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-[38px] border-t border-white/80 bg-white/95 backdrop-blur-2xl safe-bottom"
            style={{ bottom: "max(0px, env(safe-area-inset-bottom))" }}
          >
            <div className="sticky top-0 z-10 flex justify-center bg-transparent pt-2 pb-1">
              <div className="h-[5px] w-9 rounded-full bg-slate-200" />
            </div>

            <div className="p-4" style={{ paddingBottom: "max(100px, calc(env(safe-area-inset-bottom) + 20px))" }}
              dir={isRTL ? "rtl" : "ltr"}
            >
              {/* Title row */}
              <div className="mb-4 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  {(() => {
                    const cfg = mealTypeConfig[selectedMeal.meal_type];
                    const Icon = cfg.icon;
                    return (
                      <span className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${cfg.bgGradient} ${cfg.textColor}`}>
                        <Icon className="h-3 w-3" />
                        {t(cfg.label)}
                      </span>
                    );
                  })()}
                  <h2 className="text-[26px] font-black tracking-[-0.02em] text-slate-900 leading-tight">
                    {selectedMeal.meal.name}
                  </h2>
                </div>
                  <button
                    onClick={onClose}
                    className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200/50 transition-all active:scale-95"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4 text-slate-600" />
                </button>
              </div>

              {/* Hero image */}
              {selectedMeal.meal.image_url ? (
                <motion.img
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  src={selectedMeal.meal.image_url}
                  alt={selectedMeal.meal.name}
                  className="mb-4 h-48 w-full rounded-[24px] object-cover"
                />
              ) : (
                <div className="mb-4 flex h-48 w-full items-center justify-center rounded-[24px] bg-slate-50">
                  {(() => {
                    const cfg = mealTypeConfig[selectedMeal.meal_type];
                    const Icon = cfg.icon;
                    return <Icon className="h-14 w-14 text-slate-300" />;
                  })()}
                </div>
              )}

              {/* Nutrition section */}
              <p className="mb-2 px-1 text-[13px] font-bold text-slate-500">
                {isRTL ? "التغذية" : "Nutrition"}
              </p>
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                <div className="flex flex-col items-center rounded-[20px] border border-white/80 bg-white/90 backdrop-blur-xl p-3">
                  <Flame className="mb-0.5 h-4 w-4 text-amber-500" />
                  <p className="text-[19px] font-black tabular-nums leading-tight text-slate-900">{selectedMeal.meal.calories}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">kcal</p>
                </div>
                <div className="flex flex-col items-center rounded-[20px] border border-white/80 bg-white/90 backdrop-blur-xl p-3">
                  <Beef className="mb-0.5 h-4 w-4 text-rose-500" />
                  <p className="text-[19px] font-black tabular-nums leading-tight text-slate-900">{selectedMeal.meal.protein_g}g</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("protein_label")}</p>
                </div>
                <div className="flex flex-col items-center rounded-[20px] border border-white/80 bg-white/90 backdrop-blur-xl p-3">
                  <Leaf className="mb-0.5 h-4 w-4 text-blue-500" />
                  <p className="text-[19px] font-black tabular-nums leading-tight text-slate-900">{selectedMeal.meal.carbs_g}g</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("carbs")}</p>
                </div>
              </div>

              {/* Delivery section */}
              <p className="mb-2 px-1 text-[13px] font-bold text-slate-500">
                {isRTL ? "التوصيل" : "Delivery"}
              </p>
              <div className="mb-4 overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-emerald-500 shadow-lg shadow-emerald-500/25">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-emerald-700/60">{t("delivery_time_label")}</p>
                      <p className="text-[16px] font-bold text-emerald-900">
                        {selectedMeal.delivery_time_slot || (isRTL ? "غير مجدول" : "Not scheduled")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onTimeSlotOpen(selectedMeal.id)}
                    className="flex h-8 items-center rounded-full bg-white px-4 text-[14px] font-bold text-emerald-600 shadow-sm transition-all active:scale-95"
                  >
                    {isRTL ? "تغيير" : "Change"}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2.5">
                <motion.button
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  disabled={togglingMealId === selectedMeal.id}
                  onClick={() => { onToggleCompletion(selectedMeal.id, selectedMeal.is_completed); onClose(); }}
                  className={`flex w-full items-center justify-center gap-2 rounded-[24px] py-4 text-[16px] font-bold transition-all active:scale-[0.97] disabled:opacity-60 ${
                    selectedMeal.is_completed
                      ? "border border-slate-200 bg-white text-slate-700"
                      : "bg-emerald-500 text-white shadow-xl shadow-emerald-500/30"
                  }`}
                >
                  {togglingMealId === selectedMeal.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : selectedMeal.is_completed ? (
                    <>
                      <Circle className="h-5 w-5" />
                      Mark as Incomplete
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Mark as Completed
                    </>
                  )}
                </motion.button>

                <div className="grid grid-cols-2 gap-2">
                  <motion.button
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    onClick={() => navigate(`/meals/${selectedMeal.meal.id}`)}
                    className="flex items-center justify-center gap-2 rounded-[24px] border border-slate-200 bg-white py-3.5 text-[15px] font-bold text-slate-700 transition-all active:scale-[0.97]"
                  >
                    <Utensils className="h-4 w-4" />
                    {isRTL ? "التفاصيل" : "Details"}
                  </motion.button>
                  <motion.button
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => { onClose(); onReschedule(); }}
                    className="flex items-center justify-center gap-2 rounded-[24px] border border-slate-200 bg-white py-3.5 text-[15px] font-bold text-slate-700 transition-all active:scale-[0.97]"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {isRTL ? "إعادة" : "Reschedule"}
                  </motion.button>
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  onClick={() => onDelete(selectedMeal.id)}
                  className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-red-50 py-3 text-[15px] font-bold text-red-500 transition-all active:scale-[0.97]"
                >
                  <Trash2 className="h-4 w-4" />
                  {isRTL ? "إزالة من الجدول" : "Remove from Schedule"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MealDetailSheet;