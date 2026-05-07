import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar,
  BadgePercent,
  Loader2,
  X,
  AlertCircle,
  Wallet,
  CreditCard,
  Clock,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatCurrency } from "@/lib/currency";
import type { PlanCardData } from "@/components/subscription/PlanCard";

interface UpgradeBottomSheetProps {
  open: boolean;
  onClose: () => void;
  selectedPlan: PlanCardData | null;
  billingInterval: "monthly" | "annual";
  walletBalance: number;
  promoCode: string;
  promoLoading: boolean;
  promoError: string | null;
  appliedPromo: {
    id: string;
    name: string;
    discountType: "percentage" | "fixed";
    discountValue: number;
    maxDiscountAmount: number | null;
    discountAmount: number;
  } | null;
  onPromoCodeChange: (code: string) => void;
  onApplyPromo: () => Promise<void>;
  onClearPromo: () => void;
  selectedPaymentMethod: "card" | "wallet";
  onPaymentMethodChange: (method: "card" | "wallet") => void;
  isProcessing: boolean;
  onConfirm: () => Promise<void>;
  currentTier?: string;
}

export function UpgradeBottomSheet({
  open,
  onClose,
  selectedPlan,
  billingInterval,
  walletBalance,
  promoCode,
  promoLoading,
  promoError,
  appliedPromo,
  onPromoCodeChange,
  onApplyPromo,
  onClearPromo,
  selectedPaymentMethod,
  onPaymentMethodChange,
  isProcessing,
  onConfirm,
  currentTier,
}: UpgradeBottomSheetProps) {
  const { t } = useLanguage();

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) onClose();
  };

  const isUpgrade = selectedPlan && currentTier ? true : false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[24px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {selectedPlan && currentTier
              ? selectedPlan.price > 0
                ? `${t("upgrade")} ${t("subscription")}`
                : `${t("downgrade_btn")} ${t("subscription")}`
              : t("change_plan")}
          </DialogTitle>
          <DialogDescription>
            {selectedPlan
              ? `${isUpgrade ? t("upgrade") : t("downgrade_btn")} - ${selectedPlan.name}`
              : t("select_plan_to_change")}
          </DialogDescription>
        </DialogHeader>

        {selectedPlan && (
          <div className="bg-muted/60 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold">{selectedPlan.name} {t("plan_label")}</span>
              <span className="font-bold">{formatCurrency(selectedPlan.price)}/{selectedPlan.period}</span>
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {selectedPlan.mealsPerMonth === 0
                ? t("unlimited_meals")
                : `${selectedPlan.mealsPerMonth} ${t("meals_per_month")}
                   ${selectedPlan.snacksPerMonth > 0 ? ` · ${selectedPlan.snacksPerMonth} snacks` : ""}`}
            </p>
            <div className="pt-2 border-t border-border/30">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Billing:</span>
                <span className="font-bold capitalize">{billingInterval}</span>
                {billingInterval === "annual" && (
                  <span className="text-primary text-xs font-bold">(Save 17%)</span>
                )}
              </div>
              {billingInterval === "annual" && (
                <div className="mt-2 text-xs text-primary bg-primary/5 border border-primary/15 p-2.5 rounded-xl font-medium">
                  Pay for 10 months, get 2 months free — save{" "}
                  {Math.round(selectedPlan.price * 0.17).toLocaleString()} QAR/yr.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Promo Code */}
        {selectedPlan && (
          <div className="space-y-2">
            <p className="text-sm font-bold flex items-center gap-1.5">
              <BadgePercent className="h-4 w-4 text-primary" />
              {t("promo_code_label")}
            </p>
            <div className="flex gap-2">
              <Input
                value={promoCode}
                onChange={(e) => onPromoCodeChange(e.target.value)}
                placeholder={t("enter_promo_code")}
                className="rounded-xl flex-1"
                disabled={!!appliedPromo || promoLoading}
              />
              {appliedPromo ? (
                <Button
                  variant="outline"
                  className="rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={onClearPromo}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={onApplyPromo}
                  disabled={!promoCode.trim() || promoLoading}
                >
                  {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("apply_btn")}
                </Button>
              )}
            </div>

            {promoError && (
              <p className="text-xs text-destructive flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3" /> {promoError}
              </p>
            )}

            {appliedPromo && (
              <>
                <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm font-bold text-primary">{appliedPromo.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {appliedPromo.discountType === "percentage"
                        ? `${appliedPromo.discountValue}% off`
                        : `${formatCurrency(appliedPromo.discountValue)} off`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    −{formatCurrency(appliedPromo.discountAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-bold border-t pt-2">
                  <span>{t("total_after_discount")}</span>
                  <span className="text-primary">
                    {formatCurrency(Math.max(0, selectedPlan.price - appliedPromo.discountAmount))}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Payment Method */}
        {selectedPlan && (
          <div className="space-y-3">
            <p className="text-sm font-bold">{t("payment_method_label")}</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onPaymentMethodChange("card")}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                  selectedPaymentMethod === "card"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <CreditCard
                  className={`h-6 w-6 mb-2 ${
                    selectedPaymentMethod === "card" ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-sm font-bold ${
                    selectedPaymentMethod === "card" ? "text-primary" : "text-foreground"
                  }`}
                >
                  {t("card_label")}
                </span>
                <span className="text-[11px] text-muted-foreground">Credit/Debit</span>
              </button>

              <button
                onClick={() => onPaymentMethodChange("wallet")}
                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all active:scale-95 ${
                  selectedPaymentMethod === "wallet"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <Wallet
                  className={`h-6 w-6 mb-2 ${
                    selectedPaymentMethod === "wallet" ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <span
                  className={`text-sm font-bold ${
                    selectedPaymentMethod === "wallet" ? "text-primary" : "text-foreground"
                  }`}
                >
                  {t("wallet_label")}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {t("balance")}: {formatCurrency(walletBalance)}
                </span>
              </button>
            </div>

            {selectedPaymentMethod === "wallet" && selectedPlan && walletBalance < selectedPlan.price && (
              <Alert className="rounded-2xl bg-warning/5 border-warning/20">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning text-xs font-semibold">
                  {t("insufficient_wallet_balance")} {t("balance")}: {formatCurrency(walletBalance)}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Alert className="rounded-2xl">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Your plan change takes effect on the next billing cycle.
            {billingInterval === "annual"
              ? " Annual billing gives you 2 months free."
              : " You'll be charged the new rate from then."}
          </AlertDescription>
        </Alert>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="outline" className="rounded-2xl" onClick={onClose}>
            {t("cancel_btn")}
          </Button>
          <Button
            className="rounded-2xl"
            onClick={onConfirm}
            disabled={isProcessing || !selectedPlan}
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("processing")}</>
            ) : (
              t("confirm_upgrade")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
