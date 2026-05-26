import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface BuyMealCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pricePerMeal: number;
  walletBalance: number;
  loading: boolean;
  onPurchase: () => void;
  onTopUp: () => void;
}

export const BuyMealCreditDialog = ({
  open,
  onOpenChange,
  pricePerMeal,
  walletBalance,
  loading,
  onPurchase,
  onTopUp,
}: BuyMealCreditDialogProps) => {
  const canAfford = walletBalance >= pricePerMeal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-warning" />
            Buy Extra Meal Credit
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-2 space-y-4">
          <div className="rounded-xl bg-warning/10 dark:bg-warning/20 border border-warning/20 dark:border-warning/30 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Meal credit price</span>
              <span className="font-bold text-warning">{formatCurrency(pricePerMeal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Your wallet balance</span>
              <span className={`font-semibold ${canAfford ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(walletBalance)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            1 meal will be added to your plan. You can then schedule this meal normally.
          </p>
        </div>

        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-border/50">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          {canAfford ? (
            <Button
              onClick={onPurchase}
              disabled={loading}
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
            >
              {loading ? "Processing..." : `Pay ${formatCurrency(pricePerMeal)}`}
            </Button>
          ) : (
            <Button onClick={onTopUp} className="flex-1 bg-primary hover:bg-primary/90 text-white">
              Top Up Wallet
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
