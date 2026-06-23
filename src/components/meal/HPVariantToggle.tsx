import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";

interface HPVariantToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  proteinIncrease: number;
  caloriesIncrease: number;
  priceAdjustment: number;
}

export function HPVariantToggle({
  enabled,
  onChange,
  proteinIncrease,
  caloriesIncrease,
  priceAdjustment,
}: HPVariantToggleProps) {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      aria-pressed={enabled}
      className={`flex w-full items-center justify-between rounded-[22px] border-2 px-3.5 py-3 text-left transition-all ${
        enabled
          ? "border-[#020617] bg-[#020617] text-white shadow-[0_10px_24px_rgba(2,6,23,0.18)]"
          : "border-slate-200 bg-white text-slate-950 shadow-[0_8px_18px_rgba(15,23,42,0.04)]"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Badge className={`shrink-0 border-0 px-2 py-0.5 text-xs font-black ${enabled ? "bg-white text-[#020617]" : "bg-[#020617] text-white"}`}>
          HP
        </Badge>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{t("customization_high_protein")}</p>
          <p className={`truncate text-[10px] font-bold ${enabled ? "text-white/65" : "text-slate-400"}`}>
            +{proteinIncrease}g {t("protein", "protein")} · +{caloriesIncrease} kcal · +{formatCurrency(priceAdjustment)}
          </p>
        </div>
      </div>

      <span
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-white/20 ring-1 ring-white/20" : "bg-slate-100"
        }`}
      >
        <motion.span
          animate={{ x: enabled ? 25 : 3 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`absolute top-1 h-6 w-6 rounded-full shadow-sm ${enabled ? "bg-white" : "bg-slate-300"}`}
        />
      </span>
    </button>
  );
}
