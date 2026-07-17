import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, Wallet } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";

interface WalletBalanceProps {
  balance: number;
  totalCredits: number;
  totalDebits: number;
  loading?: boolean;
}

export function WalletBalance({ balance, totalCredits, totalDebits, loading }: WalletBalanceProps) {
  const { t } = useLanguage();
  const [balanceVisible, setBalanceVisible] = useState(true);

  if (loading) {
    return (
      <section className="animate-pulse overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#DDE5EF]">
        <div className="h-1 bg-[#22C7A1]" />
        <div className="p-5">
          <div className="h-4 w-28 rounded bg-[#E9EEF4]" />
          <div className="mt-4 h-10 w-44 rounded bg-[#E9EEF4]" />
          <div className="mt-6 h-20 rounded-[20px] bg-[#F4F7FA]" />
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.07)] ring-1 ring-[#DDE5EF]">
      <div className="h-1 bg-[#22C7A1]" />
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[#71809C]">
              <Wallet className="h-4 w-4 text-[#16A98A]" />
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]">{t("available_balance")}</p>
            </div>
            <div className="mt-3 flex min-h-11 items-center gap-2">
              {balanceVisible ? (
                <p className="truncate text-[34px] font-extrabold leading-none text-[#07152F] tabular-nums">{formatCurrency(balance)}</p>
              ) : (
                <p className="text-[34px] font-extrabold leading-none tracking-[0.12em] text-[#07152F]">••••••</p>
              )}
            </div>
            <p className="mt-2 text-[11px] font-medium text-[#8A98AF]">{t("available_for_orders")}</p>
          </div>

          <button
            type="button"
            onClick={() => setBalanceVisible((current) => !current)}
            aria-label={balanceVisible ? "Hide wallet balance" : "Show wallet balance"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4F7FA] text-[#596982] ring-1 ring-[#DDE5EF] transition active:scale-95"
          >
            {balanceVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 divide-x divide-[#DDE5EF] rounded-[20px] bg-[#F7F9FC] py-3.5 ring-1 ring-[#E5EAF1] rtl:divide-x-reverse">
          <BalanceMetric
            icon={<ArrowDownLeft className="h-4 w-4" />}
            label={t("total_credits")}
            value={totalCredits}
            tone="text-[#0E9F83]"
          />
          <BalanceMetric
            icon={<ArrowUpRight className="h-4 w-4" />}
            label={t("total_spent")}
            value={totalDebits}
            tone="text-[#E45F58]"
          />
        </div>
      </div>
    </section>
  );
}

function BalanceMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="min-w-0 px-3">
      <div className={`flex items-center gap-1.5 ${tone}`}>
        {icon}
        <span className="truncate text-[9px] font-extrabold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="mt-2 truncate text-[14px] font-extrabold text-[#07152F] tabular-nums">{formatCurrency(value)}</p>
    </div>
  );
}
