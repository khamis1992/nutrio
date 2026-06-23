import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
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
      <DialogContent className="max-w-[380px] overflow-hidden rounded-[30px] border border-slate-200/80 bg-white p-0 shadow-[0_28px_90px_rgba(2,6,23,0.22)]">
        <DialogHeader className="border-b border-slate-100 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="flex items-center gap-3 text-[19px] font-black text-[#020617]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-slate-100 text-[#020617] ring-1 ring-slate-200">
              <Wallet className="h-5 w-5" strokeWidth={2.3} />
            </span>
            Buy Extra Meal
          </DialogTitle>
          <DialogDescription className="ml-14 text-[13px] font-semibold text-slate-500">
            Add 1 credit to your plan
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          <div className="overflow-hidden rounded-[24px] bg-slate-50 ring-1 ring-slate-200/80">
            <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 text-sm">
              <span className="font-bold text-slate-500">Price per credit</span>
              <span className="text-[17px] font-black text-[#020617]">{formatCurrency(pricePerMeal)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-bold text-slate-500">Your wallet balance</span>
              <span className={`text-[15px] font-black ${canAfford ? "text-[#020617]" : "text-rose-500"}`}>
                {formatCurrency(walletBalance)}
              </span>
            </div>
          </div>
          <p className="text-center text-[12px] font-semibold leading-5 text-slate-500">
            1 meal will be added to your plan. You can then schedule this meal normally.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-12 rounded-full border-slate-200 bg-white text-[14px] font-black text-[#020617] shadow-none hover:bg-slate-50"
          >
            Cancel
          </Button>
          {canAfford ? (
            <Button
              onClick={onPurchase}
              disabled={loading}
              className="min-h-12 rounded-full bg-[#020617] text-[14px] font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] hover:bg-[#020617]/92"
            >
              {loading ? "Processing..." : `Pay ${formatCurrency(pricePerMeal)}`}
            </Button>
          ) : (
            <Button
              onClick={onTopUp}
              className="min-h-12 rounded-full bg-[#020617] text-[14px] font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.18)] hover:bg-[#020617]/92"
            >
              Top Up Wallet
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
