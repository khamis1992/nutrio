import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, Gift, History, ReceiptText, RotateCcw } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import type { WalletTransaction } from "@/hooks/useWallet";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface TransactionHistoryProps {
  transactions: WalletTransaction[];
  loading?: boolean;
}

type TransactionFilter = "all" | "in" | "out";

const transactionConfig: Record<WalletTransaction["type"], { icon: typeof ArrowDownLeft; color: string; background: string; labelKey: string }> = {
  credit: { icon: ArrowDownLeft, color: "text-[#0E9F83]", background: "bg-[#E9FBF7]", labelKey: "credit" },
  debit: { icon: ArrowUpRight, color: "text-[#E45F58]", background: "bg-[#FFF1EF]", labelKey: "debit" },
  refund: { icon: RotateCcw, color: "text-[#338DCE]", background: "bg-[#EDF7FF]", labelKey: "refund" },
  bonus: { icon: Gift, color: "text-[#7C83F6]", background: "bg-[#F1EEFF]", labelKey: "bonus" },
  cashback: { icon: Gift, color: "text-[#C77B1C]", background: "bg-[#FFF8EC]", labelKey: "cashback" },
};

export function TransactionHistory({ transactions, loading }: TransactionHistoryProps) {
  const { t, isRTL } = useLanguage();
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const copy = isRTL
    ? { eyebrow: "النشاط", subtitle: "كل عمليات الإضافة والشراء والاسترداد", all: "الكل", moneyIn: "إيداع", spent: "مصروف", entries: "حركة", balance: "الرصيد", emptyTitle: "لا توجد حركات في هذا القسم", emptyBody: "ستظهر معاملات المحفظة هنا فور حدوثها." }
    : { eyebrow: "Activity", subtitle: "Every top-up, purchase, and refund", all: "All", moneyIn: "Money in", spent: "Spent", entries: "entries", balance: "Balance", emptyTitle: "No activity in this view", emptyBody: "Wallet transactions will appear here as they happen." };

  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    if (filter === "all") return true;
    if (filter === "out") return transaction.type === "debit";
    return transaction.type !== "debit";
  }), [filter, transactions]);

  if (loading) {
    return (
      <section className="rounded-[28px] bg-white p-4 ring-1 ring-[#DDE5EF]">
        <div className="flex items-center gap-2"><History className="h-5 w-5 text-[#16A98A]" /><div className="h-5 w-40 animate-pulse rounded bg-[#E9EEF4]" /></div>
        <div className="mt-5 space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-[16px]" />
              <div className="flex-1"><Skeleton className="mb-2 h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)] ring-1 ring-[#DDE5EF]">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#7C83F6]">{copy.eyebrow}</p>
          <h2 className="mt-1 text-[19px] font-extrabold text-[#07152F]">{t("transaction_history")}</h2>
          <p className="mt-1 text-[11px] font-medium text-[#71809C]">{copy.subtitle}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F1EEFF] text-[#7C83F6] ring-1 ring-[#DDD8FF]">
          <ReceiptText className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 rounded-[17px] bg-[#F4F7FA] p-1 ring-1 ring-[#E1E7EF]">
        {([
          ["all", copy.all],
          ["in", copy.moneyIn],
          ["out", copy.spent],
        ] as Array<[TransactionFilter, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "min-h-10 rounded-[13px] px-2 text-[10px] font-extrabold transition",
              filter === value ? "bg-white text-[#07152F] shadow-sm ring-1 ring-[#DDE5EF]" : "text-[#71809C]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between px-1">
        <span className="text-[10px] font-bold text-[#8A98AF]">{filteredTransactions.length} {copy.entries}</span>
      </div>

      {filteredTransactions.length === 0 ? (
        <div className="py-9 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[19px] bg-[#F4F7FA] text-[#8A98AF] ring-1 ring-[#E1E7EF]">
            <History className="h-6 w-6" />
          </div>
          <p className="mt-4 text-[13px] font-extrabold text-[#07152F]">{copy.emptyTitle}</p>
          <p className="mx-auto mt-1 max-w-[260px] text-[11px] font-medium leading-5 text-[#8A98AF]">{copy.emptyBody}</p>
        </div>
      ) : (
        <div className="mt-2 divide-y divide-[#E8EDF3]">
          {filteredTransactions.map((transaction) => {
            const config = transactionConfig[transaction.type];
            const Icon = config.icon;
            const isCredit = transaction.type !== "debit";
            return (
              <article key={transaction.id} className="flex min-h-[76px] items-center gap-3 py-3">
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]", config.background, config.color)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-extrabold text-[#07152F]">{transaction.description || t(config.labelKey)}</p>
                  <p className="mt-1 text-[9px] font-semibold text-[#8A98AF]">{format(new Date(transaction.created_at), "dd MMM yyyy · HH:mm")}</p>
                </div>
                <div className="max-w-[112px] shrink-0 text-end">
                  <p className={cn("truncate text-[12px] font-extrabold tabular-nums", isCredit ? "text-[#0E9F83]" : "text-[#E45F58]")}>{isCredit ? "+" : "-"}{formatCurrency(transaction.amount)}</p>
                  <p className="mt-1 truncate text-[8px] font-semibold text-[#8A98AF]">{copy.balance} {formatCurrency(transaction.balance_after)}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
