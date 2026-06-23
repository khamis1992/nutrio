import { motion } from "framer-motion";

import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";

export type PortionSize = "standard" | "large";

interface PortionSelectorProps {
  value: PortionSize;
  onChange: (size: PortionSize) => void;
  baseCalories: number;
  largeCaloriesIncrease: number;
  largeProteinIncrease: number;
  largePriceAdjustment: number;
}

export function PortionSelector({
  value,
  onChange,
  baseCalories,
  largeCaloriesIncrease,
  largeProteinIncrease,
  largePriceAdjustment,
}: PortionSelectorProps) {
  const { t } = useLanguage();
  const isLarge = value === "large";

  const options: { id: PortionSize; label: string; sublabel: string }[] = [
    {
      id: "standard",
      label: t("customization_standard"),
      sublabel: `${baseCalories} kcal`,
    },
    {
      id: "large",
      label: t("customization_large"),
      sublabel: `${baseCalories + largeCaloriesIncrease} kcal + ${formatCurrency(largePriceAdjustment)}`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <motion.button
              key={opt.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onChange(opt.id)}
              className={`flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-[22px] border-2 p-3 text-center transition-all ${
                isSelected
                  ? "border-[#020617] bg-[#020617] text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)]"
                  : "border-slate-200 bg-white text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
              }`}
              aria-pressed={isSelected}
            >
              <span className="text-sm font-black">{opt.label}</span>
              <span className={`text-[10px] font-bold ${isSelected ? "text-white/65" : "text-slate-400"}`}>
                {opt.sublabel}
              </span>
            </motion.button>
          );
        })}
      </div>

      {isLarge && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-3 overflow-hidden rounded-[18px] bg-slate-950 px-3 py-2 text-xs font-bold text-white/70"
        >
          <span className="font-black text-white">Large</span>
          <span>+{largeCaloriesIncrease} kcal</span>
          <span>P: +{largeProteinIncrease}g</span>
          <span className="ml-auto font-black text-white">+{formatCurrency(largePriceAdjustment)}</span>
        </motion.div>
      )}
    </div>
  );
}
