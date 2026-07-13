import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, type TopUpPackage } from "@/hooks/useWallet";
import { useLanguage } from "@/contexts/LanguageContext";
import { WalletBalance } from "@/components/wallet/WalletBalance";
import { TopUpPackages } from "@/components/wallet/TopUpPackages";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

export function WalletTopUpFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    wallet,
    transactions,
    topUpPackages,
    loading,
    transactionsLoading,
  } = useWallet();

  const [selectedPackage, setSelectedPackage] = useState<TopUpPackage | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSelectPackage = (pkg: TopUpPackage) => {
    setSelectedPackage(pkg);
    setShowConfirmDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPackage || !user) return;
    setProcessingId(selectedPackage.id);
    setShowConfirmDialog(false);
    navigate(`/checkout?type=wallet&packageId=${selectedPackage.id}`);
  };

  const totalAmount = selectedPackage
    ? selectedPackage.amount + selectedPackage.bonus_amount
    : 0;

  return (
    <div className="space-y-4">
      <WalletBalance
        balance={wallet?.balance || 0}
        totalCredits={wallet?.total_credits || 0}
        totalDebits={wallet?.total_debits || 0}
        loading={loading}
      />

      <TopUpPackages
        packages={topUpPackages}
        loading={loading}
        onSelectPackage={handleSelectPackage}
        selectedPackageId={selectedPackage?.id}
        processingId={processingId ?? undefined}
      />

      <TransactionHistory transactions={transactions} loading={transactionsLoading} />

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-emerald-950">{t("wallet_confirm_topup")}</DialogTitle>
            <DialogDescription className="font-medium text-emerald-950/55">{t("wallet_confirm_topup_description")}</DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <Card className="rounded-3xl border-emerald-200 bg-[#f8fbf9] shadow-none">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-emerald-950/55">{t("wallet_package_label")}</span>
                      <span className="font-extrabold text-emerald-950">{selectedPackage.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-emerald-950/55">{t("wallet_topup_amount")}</span>
                      <span className="font-bold text-emerald-950">{formatCurrency(selectedPackage.amount)}</span>
                    </div>
                    {selectedPackage.bonus_amount > 0 && (
                      <div className="flex justify-between text-[#12785f]">
                        <span>{t("wallet_bonus_credit")}</span>
                        <span>+{formatCurrency(selectedPackage.bonus_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-emerald-900/10 pt-2 font-black">
                      <span>{t("wallet_total_credit")}</span>
                      <span className="text-[#12785f]">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <p className="text-center text-sm font-medium text-emerald-950/50">
                {t("wallet_redirect_notice")}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" className="h-12 rounded-2xl font-extrabold" onClick={() => setShowConfirmDialog(false)}>
              {t("button_cancel")}
            </Button>
            <Button onClick={handleConfirmPayment} className="h-12 rounded-2xl bg-[#103f32] font-extrabold text-white hover:bg-[#103f32]/95">
              <CreditCard className="mr-2 h-4 w-4" />
              {t("button_pay")} {formatCurrency(selectedPackage?.amount ?? 0)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
