import { motion, AnimatePresence } from "framer-motion";
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
  t,
  onTimeSlotOpen,
  onToggleCompletion,
  onReschedule,
  onDelete,
}: MealDetailSheetProps) => {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {showMealSheet && selectedMeal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto safe-bottom"
            style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            <div className="p-6" style={{ paddingBottom: "max(112px, calc(env(safe-area-inset-bottom) + 24px))" }}>
              <div className="flex items-start justify-between mb-5">
                <div className="flex-1 min-w-0">
                  {(() => {
                    const cfg = mealTypeConfig[selectedMeal.meal_type];
                    const Icon = cfg.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold mb-3 ${cfg.bgGradient} ${cfg.textColor}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {t(cfg.label)}
                      </span>
                    );
                  })()}
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">{selectedMeal.meal.name}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-11 h-11 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 ml-3 cursor-pointer active:scale-95 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {selectedMeal.meal.image_url ? (
                <motion.img
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  src={selectedMeal.meal.image_url}
                  alt={selectedMeal.meal.name}
                  className="w-full h-52 object-cover rounded-3xl mb-6 shadow-xl"
                />
              ) : (
                <div className="w-full h-52 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-3xl flex items-center justify-center mb-6">
                  {(() => {
                    const cfg = mealTypeConfig[selectedMeal.meal_type];
                    const Icon = cfg.icon;
                    return <Icon className="h-16 w-16 text-gray-400" />;
                  })()}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl p-4 text-center border border-amber-100 dark:border-amber-800/50"
                >
                  <Flame className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                  <p className="text-xl font-black text-gray-900 dark:text-white">{selectedMeal.meal.calories}</p>
                  <p className="text-[10px] text-amber-500 font-semibold uppercase tracking-wide">Calories</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-900/30 dark:to-pink-900/30 rounded-2xl p-4 text-center border border-rose-100 dark:border-rose-800/50"
                >
                  <Beef className="h-5 w-5 text-rose-500 mx-auto mb-1" />
                  <p className="text-xl font-black text-gray-900 dark:text-white">{selectedMeal.meal.protein_g}g</p>
                  <p className="text-[10px] text-rose-500 font-semibold uppercase tracking-wide">Protein</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-2xl p-4 text-center border border-blue-100 dark:border-blue-800/50"
                >
                  <Leaf className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xl font-black text-gray-900 dark:text-white">{selectedMeal.meal.carbs_g}g</p>
                  <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Carbs</p>
                </motion.div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Delivery Time</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {selectedMeal.delivery_time_slot || "Not scheduled"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onTimeSlotOpen(selectedMeal.id)}
                    className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-900 text-emerald-600 text-xs font-bold active:scale-95 transition-all shadow-sm cursor-pointer border border-emerald-100 dark:border-emerald-800"
                  >
                    Change
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  disabled={togglingMealId === selectedMeal.id}
                  onClick={() => { onToggleCompletion(selectedMeal.id, selectedMeal.is_completed); onClose(); }}
                  className={`w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 ${
                    selectedMeal.is_completed
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                      : "bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-xl shadow-emerald-500/25"
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

                <div className="flex gap-3">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => navigate(`/meals/${selectedMeal.meal.id}`)}
                    className="flex-1 py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl"
                  >
                    <Utensils className="h-4 w-4" />
                    Details
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    onClick={() => { onClose(); onReschedule(); }}
                    className="flex-1 py-4 rounded-2xl font-bold text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    Reschedule
                  </motion.button>
                </div>

                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  onClick={() => onDelete(selectedMeal.id)}
                  className="w-full py-3 rounded-2xl text-sm font-semibold text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove from Schedule
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
