import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Gift,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { useLanguage } from "@/contexts/LanguageContext";
import type { WalletTransaction } from "@/hooks/useWallet";

interface TransactionHistoryProps {
  transactions: WalletTransaction[];
  loading?: boolean;
}

const transactionConfig: Record<
  WalletTransaction["type"],
  { icon: typeof ArrowDownLeft; color: string; bgColor: string; labelKey: string }
> = {
  credit: {
    icon: ArrowDownLeft,
    color: "text-[#12785f]",
    bgColor: "bg-[#eefaf6]",
    labelKey: "credit",
  },
  debit: {
    icon: ArrowUpRight,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    labelKey: "debit",
  },
  refund: {
    icon: RotateCcw,
    color: "text-teal-700",
    bgColor: "bg-[#eff8fb]",
    labelKey: "refund",
  },
  bonus: {
    icon: Gift,
    color: "text-[#12785f]",
    bgColor: "bg-[#eefaf6]",
    labelKey: "bonus",
  },
  cashback: {
    icon: Gift,
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    labelKey: "cashback",
  },
};

export function TransactionHistory({ transactions, loading }: TransactionHistoryProps) {
  const { t } = useLanguage();
  
  if (loading) {
    return (
      <section className="rounded-[28px] border border-emerald-200/80 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-[#24b893]" />
          <h2 className="text-base font-black text-emerald-950">{t("transaction_history")}</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-2xl" />
              <div className="flex-1">
                <Skeleton className="mb-1 h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (transactions.length === 0) {
    return (
      <section className="rounded-[28px] border border-emerald-200/80 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <History className="h-5 w-5 text-[#24b893]" />
          <h2 className="text-base font-black text-emerald-950">{t("transaction_history")}</h2>
        </div>
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl bg-[#eefaf6]">
            <History className="h-7 w-7 text-[#24b893]" />
          </div>
          <p className="text-sm font-extrabold text-emerald-950">{t("no_transactions_yet")}</p>
          <p className="text-sm font-medium text-emerald-950/50">
            {t("top_up_wallet_start")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-emerald-200/80 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-black text-emerald-950">
            <History className="h-5 w-5 text-[#24b893]" />
            {t("transaction_history")}
          </h2>
          <p className="truncate text-xs font-medium text-emerald-950/50">{transactions.length} entries</p>
        </div>
      </div>

      <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {transactions.map((tx) => {
              const config = transactionConfig[tx.type];
              const Icon = config.icon;
              const isCredit = ["credit", "refund", "bonus", "cashback"].includes(tx.type);

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 rounded-2xl bg-[#f8fbf9] p-3 transition-colors"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${config.bgColor}`}
                  >
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-emerald-950">
                      {tx.description || t(config.labelKey)}
                    </p>
                    <p className="text-xs font-medium text-emerald-950/45">
                      {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-black ${isCredit ? "text-[#12785f]" : "text-rose-600"}`}>
                      {isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs font-medium text-emerald-950/45">
                      Balance: {formatCurrency(tx.balance_after)}
                    </p>
                  </div>
                </div>
              );
        })}
      </div>
    </section>
  );
}
