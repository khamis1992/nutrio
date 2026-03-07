import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    color: "text-green-600",
    bgColor: "bg-green-100",
    labelKey: "credit",
  },
  debit: {
    icon: ArrowUpRight,
    color: "text-red-600",
    bgColor: "bg-red-100",
    labelKey: "debit",
  },
  refund: {
    icon: RotateCcw,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    labelKey: "refund",
  },
  bonus: {
    icon: Gift,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
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
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            {t("transaction_history")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            {t("transaction_history")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">{t("no_transactions_yet")}</p>
            <p className="text-sm text-muted-foreground">
              {t("top_up_wallet_start")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <History className="h-5 w-5" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y">
            {transactions.map((tx) => {
              const config = transactionConfig[tx.type];
              const Icon = config.icon;
              const isCredit = ["credit", "refund", "bonus", "cashback"].includes(tx.type);

              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {tx.description || t(config.labelKey)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm")}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`font-semibold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                      {isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Balance: {formatCurrency(tx.balance_after)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
