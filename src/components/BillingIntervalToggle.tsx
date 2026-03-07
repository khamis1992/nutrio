import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BadgePercent, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type BillingInterval = "monthly" | "annual";

interface BillingIntervalToggleProps {
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
  savingsPercent?: number;
  disabled?: boolean;
  showSavingsBadge?: boolean;
}

export function BillingIntervalToggle({
  value,
  onChange,
  savingsPercent = 17,
  disabled = false,
  showSavingsBadge = true,
}: BillingIntervalToggleProps) {
  const { t } = useLanguage();
  const isAnnual = value === "annual";

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-2 ${isAnnual ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600"}`}>
          <Calendar className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Label htmlFor="billing-toggle" className="font-medium cursor-pointer">
              {t("annual_billing")}
            </Label>
            {showSavingsBadge && isAnnual && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <BadgePercent className="h-3 w-3" />
                {t("save_percent").replace("{percent}", String(savingsPercent))}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {isAnnual 
              ? t("annual_billing_pay_10_get_12").replace("{percent}", String(savingsPercent))
              : t("switch_annual_save")}
          </p>
        </div>
      </div>
      <Switch
        id="billing-toggle"
        checked={isAnnual}
        onCheckedChange={(checked) => onChange(checked ? "annual" : "monthly")}
        disabled={disabled}
        className="data-[state=checked]:bg-green-600"
      />
    </div>
  );
}

interface BillingSavingsDisplayProps {
  monthlyPrice: number;
  annualPrice: number;
  billingInterval: BillingInterval;
  className?: string;
}

export function BillingSavingsDisplay({
  monthlyPrice,
  annualPrice,
  billingInterval,
  className = "",
}: BillingSavingsDisplayProps) {
  const { t } = useLanguage();
  const annualEquivalent = monthlyPrice * 12;
  const savings = annualEquivalent - annualPrice;
  const savingsPercent = Math.round((savings / annualEquivalent) * 100);

  if (billingInterval === "monthly") {
    return (
      <div className={`text-sm text-muted-foreground ${className}`}>
        <span className="text-slate-500">
          {t("annual_equivalent")} {(annualPrice / 12).toFixed(0)} QAR/month
        </span>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-green-600">{annualPrice.toLocaleString()} QAR</span>
        <span className="text-sm text-muted-foreground line-through">
          {annualEquivalent.toLocaleString()} QAR
        </span>
      </div>
      <p className="text-sm text-green-600">
        {t("you_save_with_annual")
          .replace("{amount}", savings.toLocaleString())
          .replace("{percent}", String(savingsPercent))}
      </p>
      <p className="text-xs text-muted-foreground">
        {t("like_getting_free")}
      </p>
    </div>
  );
}

export function calculateAnnualPrice(monthlyPrice: number): number {
  // 10 months price = 2 months free (17% discount)
  return monthlyPrice * 10;
}

export function calculateSavings(monthlyPrice: number): {
  annualPrice: number;
  savings: number;
  savingsPercent: number;
  freeMonths: number;
} {
  const annualPrice = calculateAnnualPrice(monthlyPrice);
  const annualEquivalent = monthlyPrice * 12;
  const savings = annualEquivalent - annualPrice;
  const savingsPercent = Math.round((savings / annualEquivalent) * 100);
  
  return {
    annualPrice,
    savings,
    savingsPercent,
    freeMonths: 2,
  };
}
