import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { formatCurrency } from "@/lib/currency";

export type PortionSize = "standard" | "large";

interface PortionSelectorProps {
  value: PortionSize;
  onChange: (size: PortionSize) => void;
  basePrice: number | null;
  baseCalories: number;
  baseProtein: number;
  baseCarbs: number;
  baseFat: number;
}

export function PortionSelector({
  value,
  onChange,
  basePrice,
  baseCalories,
  baseProtein,
  baseCarbs,
  baseFat,
}: PortionSelectorProps) {
  const { t } = useLanguage();
  const isLarge = value === "large";

  const priceDiff = basePrice ? basePrice * 0.5 : 0;
  const calDiff = Math.round(baseCalories * 0.5);
  const proteinDiff = Math.round(baseProtein * 0.5);
  const carbsDiff = Math.round(baseCarbs * 0.5);
  const fatDiff = Math.round(baseFat * 0.5);

  const options: { id: PortionSize; label: string; sublabel: string }[] = [
    {
      id: "standard",
      label: t("customization_standard", "Standard"),
      sublabel: `${baseCalories} kcal`,
    },
    {
      id: "large",
      label: t("customization_large", "Large"),
      sublabel: `${baseCalories + calDiff} kcal · +${formatCurrency(priceDiff)}`,
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
              className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${
                isSelected
                  ? "border-primary bg-primary/8 text-primary"
                  : "border-border/50 bg-card text-foreground"
              }`}
            >
              <span className={`text-sm font-semibold ${isSelected ? "text-primary" : ""}`}>
                {opt.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{opt.sublabel}</span>
            </motion.button>
          );
        })}
      </div>

      {isLarge && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-primary/5 rounded-xl px-3 py-2 flex items-center gap-3 text-xs text-muted-foreground overflow-hidden"
        >
          <span className="font-medium text-primary">+50%</span>
          <span>P: +{proteinDiff}g</span>
          <span>C: +{carbsDiff}g</span>
          <span>F: +{fatDiff}g</span>
          <span className="ml-auto font-semibold text-foreground">
            +{formatCurrency(priceDiff)}
          </span>
        </motion.div>
      )}
    </div>
  );
}
