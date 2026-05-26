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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  CreditCard,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface WalletTopUpFlowProps {
  hideSimulationAlert?: boolean;
}

export function WalletTopUpFlow({ hideSimulationAlert = false }: WalletTopUpFlowProps) {
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
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "success" | "failed">("idle");

  const handleSelectPackage = (pkg: TopUpPackage) => {
    setSelectedPackage(pkg);
    setShowConfirmDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPackage || !user) return;
    setProcessingId(selectedPackage.id);
    setShowConfirmDialog(false);
    navigate(`/checkout?amount=${selectedPackage.amount}&type=wallet&packageId=${selectedPackage.id}`);
  };

  const totalAmount = selectedPackage
    ? selectedPackage.amount + selectedPackage.bonus_amount
    : 0;

  return (
    <div className="space-y-4">
      {paymentStatus === "success" && (
        <Alert className="bg-success/10 border-success/20">
          <CheckCircle className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">{t("payment_successful")}</AlertDescription>
        </Alert>
      )}

      {paymentStatus === "failed" && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{t("payment_failed")}</AlertDescription>
        </Alert>
      )}

      {!hideSimulationAlert && (
        <Alert className="bg-warning/10 border-warning/20">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">{t("simulation_mode")}</AlertDescription>
        </Alert>
      )}

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet_confirm_topup")}</DialogTitle>
            <DialogDescription>{t("wallet_confirm_topup_description")}</DialogDescription>
          </DialogHeader>
          {selectedPackage && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("wallet_package_label")}</span>
                      <span className="font-medium">{selectedPackage.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("wallet_topup_amount")}</span>
                      <span>{formatCurrency(selectedPackage.amount)}</span>
                    </div>
                    {selectedPackage.bonus_amount > 0 && (
                      <div className="flex justify-between text-primary">
                        <span>{t("wallet_bonus_credit")}</span>
                        <span>+{formatCurrency(selectedPackage.bonus_amount)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>{t("wallet_total_credit")}</span>
                      <span className="text-success">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <p className="text-sm text-muted-foreground text-center">
                {t("wallet_redirect_notice")}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              {t("button_cancel")}
            </Button>
            <Button onClick={handleConfirmPayment} className="bg-primary hover:bg-primary/90">
              <CreditCard className="h-4 w-4 mr-2" />
              {t("button_pay")} {formatCurrency(selectedPackage?.amount ?? 0)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
