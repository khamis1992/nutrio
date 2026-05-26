import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface InsufficientBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addonsTotal: number;
  walletBalance: number;
  onTopUp: () => void;
}

export const InsufficientBalanceDialog = ({
  open,
  onOpenChange,
  addonsTotal,
  walletBalance,
  onTopUp,
}: InsufficientBalanceDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            Insufficient Balance
          </DialogTitle>
          <DialogDescription>
            Your wallet balance is too low to cover the add-ons you selected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
            <span className="text-sm text-muted-foreground">Add-ons total</span>
            <span className="font-bold">{formatCurrency(addonsTotal)}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
            <span className="text-sm text-muted-foreground">Your wallet balance</span>
            <span className="font-semibold text-destructive">{formatCurrency(walletBalance)}</span>
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onTopUp} className="flex-1 bg-primary">
            Top Up Wallet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
