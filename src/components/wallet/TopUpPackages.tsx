import { Check, Gift, Loader2, Plus } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import type { TopUpPackage } from "@/hooks/useWallet";
import { formatCurrency, formatCurrencyCompact } from "@/lib/currency";
import { cn } from "@/lib/utils";

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
  processingId,
}: TopUpPackagesProps) {
  const { t, isRTL } = useLanguage();
  const copy = isRTL
    ? { eyebrow: "إضافة رصيد", title: "اختر مبلغ الشحن", subtitle: "سترى الرصيد الكامل قبل الانتقال للدفع", bonus: "مكافأة", total: "يصل إلى محفظتك", choose: "اختيار", empty: "لا توجد باقات شحن متاحة حالياً" }
    : { eyebrow: "Add funds", title: "Choose a top-up", subtitle: "See the exact wallet credit before checkout", bonus: "Bonus", total: "Added to wallet", choose: "Choose", empty: "No top-up packages are available right now" };

  if (loading) {
    return (
      <section className="rounded-[28px] bg-white p-4 ring-1 ring-[#DDE5EF]">
        <div className="h-5 w-40 animate-pulse rounded bg-[#E9EEF4]" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-[174px] animate-pulse rounded-[22px] bg-[#F4F7FA]" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)] ring-1 ring-[#DDE5EF]">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#0E9F83]">{copy.eyebrow}</p>
          <h2 className="mt-1 text-[19px] font-extrabold text-[#07152F]">{copy.title}</h2>
          <p className="mt-1 text-[11px] font-medium text-[#71809C]">{copy.subtitle}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#E9FBF7] text-[#16A98A] ring-1 ring-[#BCECDF]">
          <Plus className="h-5 w-5" />
        </span>
      </div>

      {packages.length === 0 ? (
        <div className="mt-4 rounded-[20px] bg-[#F7F9FC] px-4 py-8 text-center text-[12px] font-semibold text-[#71809C] ring-1 ring-[#E5EAF1]">{copy.empty}</div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {packages.map((pkg) => {
            const selected = selectedPackageId === pkg.id;
            const processing = processingId === pkg.id;
            const total = pkg.amount + pkg.bonus_amount;
            const featured = pkg.bonus_amount === Math.max(...packages.map((item) => item.bonus_amount));

            return (
              <button
                key={pkg.id}
                type="button"
                onClick={() => onSelectPackage(pkg)}
                disabled={processing}
                className={cn(
                  "relative flex min-h-[176px] flex-col rounded-[22px] border p-3.5 text-start transition active:scale-[0.98]",
                  selected ? "border-[#22C7A1] bg-[#F1FBF8] ring-2 ring-[#22C7A1]/15" : "border-[#E1E7EF] bg-[#F8FAFC]",
                )}
              >
                <div className="flex min-h-6 items-start justify-between gap-2">
                  <span className="line-clamp-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#71809C]">{pkg.name}</span>
                  {featured && pkg.bonus_amount > 0 && (
                    <span className="shrink-0 rounded-full bg-[#FFF1D9] px-2 py-1 text-[8px] font-extrabold uppercase text-[#B66C16]">{t("best_value")}</span>
                  )}
                </div>

                <p className="mt-3 text-[24px] font-extrabold leading-none text-[#07152F] tabular-nums">{formatCurrencyCompact(pkg.amount)}</p>

                {pkg.bonus_amount > 0 ? (
                  <div className="mt-3 flex items-center gap-1.5 text-[#0E9F83]">
                    <Gift className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-extrabold">+{formatCurrencyCompact(pkg.bonus_amount)} {copy.bonus}</span>
                  </div>
                ) : (
                  <div className="mt-3 h-3.5" />
                )}

                <div className="mt-auto border-t border-[#DDE5EF] pt-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.07em] text-[#8A98AF]">{copy.total}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-extrabold text-[#07152F]">{formatCurrency(total)}</span>
                    <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", selected ? "bg-[#22C7A1] text-white" : "bg-white text-[#16A98A] ring-1 ring-[#BCECDF]")}>
                      {processing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                </div>
                <span className="sr-only">{copy.choose} {pkg.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
