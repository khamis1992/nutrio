import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Wallet as WalletIcon,
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useWallet, type TopUpPackage } from "@/hooks/useWallet";
import { WalletBalance } from "@/components/wallet/WalletBalance";
import { TopUpPackages } from "@/components/wallet/TopUpPackages";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";

import { formatCurrency } from "@/lib/currency";

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const {
    wallet,
    transactions,
    topUpPackages,
    loading,
    transactionsLoading,
    refresh,
  } = useWallet();

  const [selectedPackage, setSelectedPackage] = useState<TopUpPackage | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    const orderParam = searchParams.get('order');
    
    if (paymentParam === 'success' && orderParam) {
      setPaymentStatus('success');
      toast({
        title: t("payment_successful"),
        description: t("wallet_credited"),
      });
      refresh();
      navigate('/wallet', { replace: true });
    } else if (paymentParam === 'failed') {
      setPaymentStatus('failed');
      toast({
        title: t("payment_failed"),
        description: t("payment_failed_description"),
        variant: "destructive",
      });
      navigate('/wallet', { replace: true });
    }
  }, [searchParams, toast, refresh, navigate]);

  const handleSelectPackage = (pkg: TopUpPackage) => {
    setSelectedPackage(pkg);
    setShowConfirmDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPackage || !user) return;

    setProcessingId(selectedPackage.id);
    setShowConfirmDialog(false);

    // Navigate to checkout page with simulation mode
    navigate(`/checkout?amount=${selectedPackage.amount}&type=wallet&packageId=${selectedPackage.id}`);
    
    // Note: The actual wallet credit happens in the Checkout page after successful payment
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const totalAmount = selectedPackage 
    ? selectedPackage.amount + selectedPackage.bonus_amount 
    : 0;

  return (
    <div className="min-h-screen bg-background">      <main className="container max-w-md mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("wallet_title")}</h1>
            <p className="text-muted-foreground">{t("wallet_subtitle")}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <WalletIcon className="h-6 w-6 text-success" />
          </div>
        </div>

        {paymentStatus === 'success' && (
          <Alert className="mb-4 bg-success/10 border-success/20">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              {t("payment_success_alert")}
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === 'failed' && (
          <Alert className="mb-4 bg-destructive/10 border-destructive/20" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              {t("payment_failed_alert")}
            </AlertDescription>
          </Alert>
        )}

        {/* Simulation Mode Notice */}
        <Alert className="mb-4 bg-warning/10 border-warning/20">
          <AlertCircle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            {t("simulation_mode_notice")}
          </AlertDescription>
        </Alert>

        <div className="space-y-6">
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

          <TransactionHistory
            transactions={transactions}
            loading={transactionsLoading}
          />
        </div>
      </main>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet_confirm_topup")}</DialogTitle>
            <DialogDescription>
              {t("wallet_confirm_topup_description")}
            </DialogDescription>
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
