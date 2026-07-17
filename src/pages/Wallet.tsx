import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
    document.title = `${t("wallet_title")} - Nutrio`;
  }, [t]);

  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    const orderParam = searchParams.get("order");

    if (paymentParam === "success" && orderParam) {
      toast({
        title: t("payment_successful"),
        description: t("wallet_credited"),
      });
      refresh();
      navigate("/wallet", { replace: true });
    } else if (paymentParam === "failed") {
      toast({
        title: t("payment_failed"),
        description: t("payment_failed_description"),
        variant: "destructive",
      });
      navigate("/wallet", { replace: true });
    }
  }, [searchParams, toast, refresh, navigate, t]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-[#F4F7FA] pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-safe text-[#07152F]">
      <div className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[430px] items-center gap-3 px-4 rtl:flex-row-reverse">
          <button
            data-testid="wallet-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F4F7FA] text-[#07152F] ring-1 ring-[#DDE5EF] transition-all active:scale-95"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-extrabold text-[#07152F]">{t("wallet_title")}</h1>
            <p className="truncate text-[11px] font-semibold text-[#71809C]">{t("wallet_subtitle")}</p>
          </div>
          <div className="ms-auto flex h-10 items-center gap-1.5 rounded-full bg-[#E9FBF7] px-3 text-[10px] font-extrabold text-[#087B67] ring-1 ring-[#BCECDF]">
            <ShieldCheck className="h-4 w-4" /> SADAD
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] px-3.5 py-4">
        <WalletTopUpFlow />
      </main>
    </div>
  );
}
