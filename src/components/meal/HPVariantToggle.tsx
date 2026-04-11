import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";

interface HPVariantToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  baseProtein: number;
  basePrice: number | null;
}

export function HPVariantToggle({ enabled, onChange, baseProtein, basePrice }: HPVariantToggleProps) {
  const { t } = useLanguage();
  const extraProtein = Math.round(baseProtein * 0.5);
  const extraPrice = 15; // QAR

  return (
    <div className="flex items-center justify-between px-3.5 py-3 rounded-xl border-2 border-border/50 bg-card transition-all">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 text-xs px-2 py-0.5 font-bold">
            HP
          </Badge>
          <div>
            <p className="text-sm font-semibold">{t("customization_high_protein", "High-Protein")}</p>
            <p className="text-[10px] text-muted-foreground">
              +{extraProtein}g {t("protein", "protein")} · +{formatCurrency(extraPrice)}
            </p>
          </div>
        </div>
      </div>

      {/* Toggle switch */}
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          enabled ? "bg-primary" : "bg-muted"
        }`}
      >
        <motion.div
          animate={{ x: enabled ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  );
}
