import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Beef, Clock, Flame, Loader2, Utensils, X } from "lucide-react";
import { toast } from "sonner";

import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

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
  const { isRTL } = useLanguage();
  const [substitutingId, setSubstitutingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const copy = isRTL ? {
    unavailable: "لم تعد الوجبة متاحة",
    safeAlternatives: "بدائل آمنة ومتاحة",
    noAlternatives: "لا يوجد بديل آمن تلقائياً لهذه الوجبة",
    suggested: "اختر بديلاً",
    support: "حافظنا على جدولك دون تغيير. اختر وجبة أخرى يدوياً أو تواصل مع الدعم.",
    success: "تم استبدال الوجبة",
    successBody: "تم تحديث الجدول بعد إعادة فحص الأمان والتوصيل.",
    failed: "تعذر استبدال الوجبة",
    failedBody: "ربما تغير التوفر. أعد المحاولة لاختيار بديل آمن.",
    dismiss: "إخفاء التنبيه",
  } : {
    unavailable: "is no longer available",
    safeAlternatives: "safe, deliverable alternatives",
    noAlternatives: "No automatic safe alternative is available",
    suggested: "Choose a replacement",
    support: "Your schedule was left unchanged. Pick another meal manually or contact support.",
    success: "Meal replaced",
    successBody: "Your schedule was updated after fresh safety and delivery checks.",
    failed: "Meal replacement failed",
    failedBody: "Availability may have changed. Try again to choose a safe replacement.",
    dismiss: "Dismiss alert",
  };

  const handleSubstitute = async (scheduleId: string, newMealId: string) => {
    setSubstitutingId(scheduleId);
    const success = await onSubstitute(scheduleId, newMealId);
    setSubstitutingId(null);

    if (success) {
      toast.success(copy.success, { description: copy.successBody, duration: 4000 });
    } else {
      toast.error(copy.failed, { description: copy.failedBody });
    }
  };

  if (unavailableMeals.length === 0) return null;

  return (
    <div dir={isRTL ? "rtl" : "ltr"} className="mx-auto max-w-lg space-y-3 px-4">
      {unavailableMeals.map((item, index) => {
        const isExpanded = expandedId === item.scheduleId;

        return (
          <motion.section
            key={item.scheduleId}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "overflow-hidden rounded-lg border bg-white shadow-sm transition-colors",
              isExpanded ? "border-[#FB6B7A]" : "border-[#E5EAF1]",
            )}
          >
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFF0F2]">
                <AlertTriangle className="h-5 w-5 text-[#FB6B7A]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#020617]">
                  {item.mealName} {copy.unavailable}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-[#94A3B8]">
                  {item.substitutes.length > 0
                    ? `${item.substitutes.length} ${copy.safeAlternatives}`
                    : copy.noAlternatives}
                </p>
              </div>
              {item.substitutes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.scheduleId)}
                  className="flex h-11 min-w-11 items-center justify-center rounded-full bg-[#020617] px-3 text-white active:scale-95"
                  aria-expanded={isExpanded}
                  aria-label={copy.suggested}
                >
                  <ArrowRight className={cn("h-4 w-4 transition-transform", isRTL && "rotate-180", isExpanded && "rotate-90")} />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDismiss(item.scheduleId)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E5EAF1] bg-white active:scale-95"
                aria-label={copy.dismiss}
              >
                <X className="h-4 w-4 text-[#94A3B8]" />
              </button>
            </div>

            {item.substitutes.length === 0 && (
              <p className="border-t border-[#E5EAF1] bg-[#F6F8FB] px-4 py-3 text-xs font-semibold leading-5 text-[#64748B]">
                {copy.support}
              </p>
            )}

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 px-4 pb-4">
                    <p className="mb-2 text-xs font-bold text-[#64748B]">{copy.suggested}</p>
                    {item.substitutes.map((sub) => (
                      <motion.div
                        key={sub.meal.id}
                        initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 rounded-lg border border-[#E5EAF1] bg-[#F6F8FB] p-3"
                      >
                        {sub.meal.image_url ? (
                          <img src={sub.meal.image_url} alt={sub.meal.name} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white">
                            <Utensils className="h-6 w-6 text-[#7C83F6]" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-bold text-[#020617]">{sub.meal.name}</h4>
                          <div className="mt-1 flex items-center gap-2">
                            {sub.meal.calories !== null && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#FB6B7A]">
                                <Flame className="h-3 w-3" />{sub.meal.calories} kcal
                              </span>
                            )}
                            {sub.meal.protein_g !== null && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#7C83F6]">
                                <Beef className="h-3 w-3" />{sub.meal.protein_g}g
                              </span>
                            )}
                            {sub.meal.prep_time_minutes !== null && (
                              <span className="flex items-center gap-0.5 text-[10px] text-[#94A3B8]">
                                <Clock className="h-3 w-3" />{sub.meal.prep_time_minutes}m
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[10px] font-semibold text-[#22C7A1]">
                            {sub.matchReasons.slice(0, 2).join(" · ")}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleSubstitute(item.scheduleId, sub.meal.id)}
                          disabled={substitutingId === item.scheduleId}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white active:scale-95 disabled:opacity-60"
                          aria-label={`${copy.suggested}: ${sub.meal.name}`}
                        >
                          {substitutingId === item.scheduleId
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        );
      })}
    </div>
  );
};
