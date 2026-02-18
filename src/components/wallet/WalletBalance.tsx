import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface WalletBalanceProps {
  balance: number;
  totalCredits: number;
  totalDebits: number;
  loading?: boolean;
}

export function WalletBalance({ balance, totalCredits, totalDebits, loading }: WalletBalanceProps) {
  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-white/20 rounded w-24" />
            <div className="h-10 bg-white/20 rounded w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-green-100 text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Available Balance
            </p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(balance)}</p>
            <p className="text-green-100 text-xs mt-1">Available for orders</p>
          </div>
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
            <Wallet className="h-8 w-8" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <ArrowDownLeft className="h-4 w-4 text-green-200" />
            </div>
            <div>
              <p className="text-xs text-green-100">Total Credits</p>
              <p className="font-semibold">{formatCurrency(totalCredits)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-green-200" />
            </div>
            <div>
              <p className="text-xs text-green-100">Total Spent</p>
              <p className="font-semibold">{formatCurrency(totalDebits)}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
