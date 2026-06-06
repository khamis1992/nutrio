import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Wallet as WalletIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/useWallet";
import { WalletTopUpFlow } from "@/components/wallet/WalletTopUpFlow";

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { refresh } = useWallet();

  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    const orderParam = searchParams.get('order');
    
    if (paymentParam === 'success' && orderParam) {
      toast({
        title: t("payment_successful"),
        description: t("wallet_credited"),
      });
      refresh();
      navigate('/wallet', { replace: true });
    } else if (paymentParam === 'failed') {
      toast({
        title: t("payment_failed"),
        description: t("payment_failed_description"),
        variant: "destructive",
      });
      navigate('/wallet', { replace: true });
    }
  }, [searchParams, toast, refresh, navigate, t]);

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-md mx-auto px-4 py-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("wallet_title")}</h1>
            <p className="text-muted-foreground">{t("wallet_subtitle")}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <WalletIcon className="h-6 w-6 text-success" />
          </div>
        </div>

        <WalletTopUpFlow hideSimulationAlert={!import.meta.env.DEV} />
      </main>
    </div>
  );
}
