import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TopUpPackage } from "@/hooks/useWallet";

interface TopUpPackagesProps {
  packages: TopUpPackage[];
  loading?: boolean;
  onSelectPackage: (pkg: TopUpPackage) => void;
  selectedPackageId?: string;
  processingId?: string;
}

export function TopUpPackages({ 
  packages, 
  loading, 
  onSelectPackage, 
  selectedPackageId,
  processingId 
}: TopUpPackagesProps) {
  const { t } = useLanguage();
  
  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="px-1 text-base font-black text-emerald-950">{t("top_up_packages")}</h2>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 w-[210px] flex-none animate-pulse rounded-3xl bg-white" />
          ))}
        </div>
      </section>
    );
  }

  const getPackageStyle = (pkg: TopUpPackage) => {
    if (pkg.bonus_amount >= 100) return "border-emerald-300 bg-[#e9f8f2]";
    if (pkg.bonus_amount >= 30) return "border-amber-300 bg-[#fff8ed]";
    if (pkg.bonus_amount >= 10) return "border-teal-200 bg-[#eff8fb]";
    return "border-emerald-200/80 bg-white";
  };

  const getPackageBadge = (pkg: TopUpPackage) => {
    if (pkg.bonus_amount >= 100) return { text: t("best_value"), color: "bg-[#24b893] text-white" };
    if (pkg.bonus_amount >= 30) return { text: t("popular"), color: "bg-amber-400 text-emerald-950" };
    return null;
  };

  const splitCurrency = (value: number) => {
    const formatted = formatCurrency(value);
    const match = formatted.match(/^([^\d-]+)\s*(.+)$/);
    return match
      ? { currency: match[1].trim(), amount: match[2] }
      : { currency: "", amount: formatted };
  };

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-base font-black text-emerald-950">{t("top_up_packages")}</h2>
          <p className="truncate text-xs font-medium text-emerald-950/50">{t("get_bonus_credits")}</p>
        </div>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
        {packages.map((pkg) => {
          const badge = getPackageBadge(pkg);
          const totalAmount = pkg.amount + pkg.bonus_amount;
          const isSelected = selectedPackageId === pkg.id;
          const isProcessing = processingId === pkg.id;
          const amountDisplay = splitCurrency(pkg.amount);
          const totalDisplay = splitCurrency(totalAmount);
          const bonusDisplay = splitCurrency(pkg.bonus_amount);

          return (
            <div
              key={pkg.id}
              role="button"
              tabIndex={0}
              className={`relative w-[210px] flex-none snap-start rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.98] ${
                getPackageStyle(pkg)
              } ${isSelected ? "ring-2 ring-[#24b893]" : ""}`}
              onClick={() => onSelectPackage(pkg)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPackage(pkg);
                }
              }}
            >
              {badge && (
                <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${badge.color}`}>
                  {badge.text}
                </span>
              )}

              <p className="mt-2 truncate pr-16 text-sm font-extrabold text-emerald-950">{pkg.name}</p>
              <p className="mt-1 flex items-baseline gap-1 whitespace-nowrap text-emerald-950">
                {amountDisplay.currency && <span className="text-sm font-black">{amountDisplay.currency}</span>}
                <span className="text-[26px] font-black leading-none tracking-tight tabular-nums">{amountDisplay.amount}</span>
              </p>

              {pkg.bonus_amount > 0 && (
                <p className="mt-2 truncate text-xs font-extrabold text-[#12785f]">
                  +{bonusDisplay.currency && `${bonusDisplay.currency} `}{bonusDisplay.amount} bonus
                </p>
              )}

              <p className="mt-1 text-xs font-medium leading-tight text-emerald-950/50">
                You get <span className="whitespace-nowrap">{totalDisplay.currency && `${totalDisplay.currency} `}{totalDisplay.amount}</span>
              </p>

              <Button
                className="mt-4 h-10 w-full rounded-2xl bg-[#103f32] text-sm font-extrabold text-white hover:bg-[#103f32]/95"
                disabled={isProcessing}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectPackage(pkg);
                }}
              >
                {isProcessing ? (
                  t("processing")
                ) : isSelected ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    {t("selected")}
                  </>
                ) : (
                  t("select")
                )}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="px-1 text-center text-xs font-medium text-emerald-950/50">
        {t("secure_payment_sadad_credits_never_expire")}
      </p>
    </section>
  );
}
