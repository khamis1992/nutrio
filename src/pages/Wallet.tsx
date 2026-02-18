import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  Wallet as WalletIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useWallet, type TopUpPackage } from "@/hooks/useWallet";
import { WalletBalance } from "@/components/wallet/WalletBalance";
import { TopUpPackages } from "@/components/wallet/TopUpPackages";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { initiateSadadPayment, sadadService } from "@/lib/sadad";
import { formatCurrency } from "@/lib/currency";

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

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
        title: "Payment Successful!",
        description: "Your wallet has been credited.",
      });
      refresh();
      navigate('/wallet', { replace: true });
    } else if (paymentParam === 'failed') {
      setPaymentStatus('failed');
      toast({
        title: "Payment Failed",
        description: "Please try again or contact support.",
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

    try {
      if (!sadadService.isConfigured()) {
        // For demo/development, simulate successful payment
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast({
          title: "Demo Mode",
          description: "Payment gateway not configured. Simulating successful top-up.",
        });
        
        // Refresh wallet data
        refresh();
        setProcessingId(null);
        setSelectedPackage(null);
        return;
      }

      const result = await initiateSadadPayment({
        amount: selectedPackage.amount,
        bonusAmount: selectedPackage.bonus_amount,
        packageId: selectedPackage.id,
        userId: user.id,
        userEmail: user.email,
      });

      // Redirect to Sadad payment page
      window.location.href = result.paymentUrl;
    } catch (error: any) {
      console.error('Payment initiation failed:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Could not initiate payment. Please try again.",
        variant: "destructive",
      });
      setProcessingId(null);
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  const totalAmount = selectedPackage 
    ? selectedPackage.amount + selectedPackage.bonus_amount 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerNavigation />
      
      <main className="container max-w-md mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wallet</h1>
            <p className="text-muted-foreground">Manage your balance</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <WalletIcon className="h-6 w-6 text-green-600" />
          </div>
        </div>

        {paymentStatus === 'success' && (
          <Alert className="mb-4 bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">
              Payment successful! Your wallet has been credited.
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === 'failed' && (
          <Alert className="mb-4 bg-red-50 border-red-200" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Payment failed. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {!sadadService.isConfigured() && (
          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700">
              Payment gateway not configured. Top-ups will be simulated in demo mode.
            </AlertDescription>
          </Alert>
        )}

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
            processingId={processingId}
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
            <DialogTitle>Confirm Top-up</DialogTitle>
            <DialogDescription>
              Review your top-up details before proceeding to payment.
            </DialogDescription>
          </DialogHeader>

          {selectedPackage && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Package</span>
                      <span className="font-medium">{selectedPackage.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Top-up Amount</span>
                      <span>{formatCurrency(selectedPackage.amount)}</span>
                    </div>
                    {selectedPackage.bonus_amount > 0 && (
                      <div className="flex justify-between text-purple-600">
                        <span>Bonus Credit</span>
                        <span>+{formatCurrency(selectedPackage.bonus_amount)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total Credit</span>
                      <span className="text-green-600">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground text-center">
                You will be redirected to Sadad to complete the payment securely.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} className="bg-green-600 hover:bg-green-700">
              <CreditCard className="h-4 w-4 mr-2" />
              Pay {formatCurrency(selectedPackage?.amount || 0)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
