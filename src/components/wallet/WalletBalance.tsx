import { Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useLanguage } from "@/contexts/LanguageContext";

interface WalletBalanceProps {
  balance: number;
  totalCredits: number;
  totalDebits: number;
  loading?: boolean;
}

export function WalletBalance({ balance, totalCredits, totalDebits, loading }: WalletBalanceProps) {
  const { t } = useLanguage();
  
  if (loading) {
    return (
      <div className="rounded-[28px] bg-white p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-24 rounded bg-emerald-100" />
          <div className="h-10 w-32 rounded bg-emerald-100" />
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="h-16 rounded-2xl bg-emerald-50" />
            <div className="h-16 rounded-2xl bg-emerald-50" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-emerald-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-extrabold text-emerald-950/55">
            <Wallet className="h-4 w-4 text-[#24b893]" />
            {t("available_balance")}
          </p>
          <p className="mt-2 text-4xl font-black tracking-tight text-emerald-950">{formatCurrency(balance)}</p>
          <p className="mt-1 text-xs font-medium text-emerald-950/50">{t("available_for_orders")}</p>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#eefaf6] text-[#12785f]">
          <Wallet className="h-7 w-7" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#eefaf6] p-3">
          <div className="mb-2 flex items-center gap-2 text-[#12785f]">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wide">{t("total_credits")}</p>
          </div>
          <p className="text-sm font-black text-emerald-950">{formatCurrency(totalCredits)}</p>
        </div>
        <div className="rounded-2xl bg-[#fff8ed] p-3">
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wide">{t("total_spent")}</p>
          </div>
          <p className="text-sm font-black text-emerald-950">{formatCurrency(totalDebits)}</p>
        </div>
      </div>
    </section>
  );
}
