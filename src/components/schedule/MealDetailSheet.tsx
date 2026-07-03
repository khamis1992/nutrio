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
  PencilLine,
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
  onOpenManualLog: () => void;
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
  onOpenManualLog,
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
            className="fixed left-0 right-0 z-[70] mx-auto flex max-w-[430px] flex-col overflow-hidden rounded-t-[34px] border-t border-[#E5EAF1] bg-[#F6F8FB] shadow-[0_-24px_70px_rgba(2,6,23,0.24)]"
            style={{
              bottom: "calc(56px + env(safe-area-inset-bottom, 0px))",
              maxHeight: "calc(100dvh - 82px - env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div className="flex shrink-0 justify-center bg-[#F6F8FB] pb-1 pt-2">
              <div className="h-[5px] w-9 rounded-full bg-[#E5EAF1]" />
            </div>

            <div
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-5 pt-2 [-webkit-overflow-scrolling:touch]"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.08)]">
                <div className="relative h-[210px] overflow-hidden bg-[#E5EAF1]">
                  {selectedMeal.meal.image_url ? (
                    <motion.img
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
                      animate={{ opacity: 1, scale: 1 }}
                      src={selectedMeal.meal.image_url}
                      alt={selectedMeal.meal.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#F6F8FB]">
                      {(() => {
                        const cfg = mealTypeConfig[selectedMeal.meal_type];
                        const Icon = cfg.icon;
                        return <Icon className="h-14 w-14 text-[#94A3B8]" />;
                      })()}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#020617]/78 via-[#020617]/28 to-transparent" />
                  <button
                    onClick={onClose}
                    className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/92 text-[#020617] shadow-[0_10px_24px_rgba(2,6,23,0.16)] backdrop-blur-xl transition-all active:scale-95"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-4 left-4 right-4">
                    {(() => {
                      const cfg = mealTypeConfig[selectedMeal.meal_type];
                      const Icon = cfg.icon;
                      return (
                        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-black text-[#F97316] shadow-sm backdrop-blur-xl">
                          <Icon className="h-3 w-3" />
                          {t(cfg.label)}
                        </span>
                      );
                    })()}
                    <h2 className="line-clamp-2 text-[26px] font-black leading-[1.02] tracking-[-0.03em] text-white">
                      {selectedMeal.meal.name}
                    </h2>
                  </div>
                </div>
              </section>

              {/* Nutrition section */}
              <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.055)]">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    {isRTL ? "التغذية" : "Nutrition"}
                  </p>
                  <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[11px] font-black text-[#64748B]">
                    {selectedMeal.is_completed ? (isRTL ? "تم التسجيل" : "Logged") : (isRTL ? "مجدولة" : "Planned")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-[20px] border border-[#FB6B7A]/20 bg-[#FFF4F5] p-3">
                    <Flame className="mb-2 h-4 w-4 text-[#FB6B7A]" />
                    <p className="text-[22px] font-black tabular-nums leading-none text-[#020617]">{selectedMeal.meal.calories}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">kcal</p>
                  </div>
                  <div className="rounded-[20px] border border-[#7C83F6]/20 bg-[#F3F4FF] p-3">
                    <Beef className="mb-2 h-4 w-4 text-[#7C83F6]" />
                    <p className="text-[22px] font-black tabular-nums leading-none text-[#020617]">{selectedMeal.meal.protein_g}g</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">{t("protein_label")}</p>
                  </div>
                  <div className="rounded-[20px] border border-[#22C7A1]/20 bg-[#EFFFFA] p-3">
                    <Leaf className="mb-2 h-4 w-4 text-[#22C7A1]" />
                    <p className="text-[22px] font-black tabular-nums leading-none text-[#020617]">{selectedMeal.meal.carbs_g}g</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-wide text-[#94A3B8]">{t("carbs")}</p>
                  </div>
                </div>
              </section>

              {/* Delivery section */}
              <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.055)]">
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  {isRTL ? "التوصيل" : "Delivery"}
                </p>
                <div className="flex items-center gap-3 rounded-[22px] bg-[#F6F8FB] p-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[#020617] shadow-[0_12px_22px_rgba(2,6,23,0.18)]">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-[#94A3B8]">{t("delivery_time_label")}</p>
                    <p className="truncate text-[18px] font-black text-[#020617]">
                        {selectedMeal.delivery_time_slot || (isRTL ? "غير مجدول" : "Not scheduled")}
                    </p>
                  </div>
                  <button
                    onClick={() => onTimeSlotOpen(selectedMeal.id)}
                    className="flex h-11 shrink-0 items-center rounded-full bg-white px-4 text-[13px] font-black text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] transition-all active:scale-95"
                  >
                    {isRTL ? "تغيير" : "Change"}
                  </button>
                </div>
              </section>

              {/* Actions */}
              <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-3.5 shadow-[0_12px_30px_rgba(2,6,23,0.055)]">
                <motion.button
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  disabled={togglingMealId === selectedMeal.id}
                  onClick={() => { onToggleCompletion(selectedMeal.id, selectedMeal.is_completed); onClose(); }}
                  className={`flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[24px] text-[16px] font-black transition-all active:scale-[0.98] disabled:opacity-60 ${
                    selectedMeal.is_completed
                      ? "border border-[#DDE5EF] bg-[#F6F8FB] text-[#020617]"
                      : "bg-[#22C7A1] text-white shadow-[0_16px_30px_rgba(34,199,161,0.28)]"
                  }`}
                >
                  {togglingMealId === selectedMeal.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : selectedMeal.is_completed ? (
                    <>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
                        <Circle className="h-4 w-4" />
                      </span>
                      Undo log
                    </>
                  ) : (
                    <>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      Log this meal
                    </>
                  )}
                </motion.button>

                <div className="mt-3 grid grid-cols-3 gap-2.5">
                  <motion.button
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    onClick={() => navigate(`/meals/${selectedMeal.meal.id}`)}
                    className="flex h-[76px] min-w-0 flex-col items-center justify-center gap-2 rounded-[22px] bg-[#F6F8FB] px-1.5 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition-all active:scale-[0.97]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#22C7A1] shadow-sm">
                      <Utensils className="h-4 w-4" />
                    </span>
                    {isRTL ? "التفاصيل" : "Details"}
                  </motion.button>
                  <motion.button
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    onClick={onOpenManualLog}
                    className="flex h-[76px] min-w-0 flex-col items-center justify-center gap-2 rounded-[22px] bg-[#F6F8FB] px-1.5 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition-all active:scale-[0.97]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#7C83F6] shadow-sm">
                      <PencilLine className="h-4 w-4" />
                    </span>
                    Manual
                  </motion.button>
                  <motion.button
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => { onClose(); onReschedule(); }}
                    className="flex h-[76px] min-w-0 flex-col items-center justify-center gap-2 rounded-[22px] bg-[#F6F8FB] px-1.5 text-[12px] font-black text-[#020617] ring-1 ring-[#E5EAF1] transition-all active:scale-[0.97]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#38BDF8] shadow-sm">
                      <CalendarIcon className="h-4 w-4" />
                    </span>
                    {isRTL ? "إعادة" : "Reschedule"}
                  </motion.button>
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  onClick={() => onDelete(selectedMeal.id)}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-[20px] border border-[#FB6B7A]/15 bg-white text-[14px] font-black text-[#FB6B7A] transition-all active:scale-[0.98]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FFF0F2]">
                    <Trash2 className="h-4 w-4" />
                  </span>
                  {isRTL ? "إزالة من الجدول" : "Remove from Schedule"}
                </motion.button>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MealDetailSheet;

