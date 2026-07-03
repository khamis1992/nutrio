import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, ShieldCheck, Wallet as WalletIcon } from "lucide-react";
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
    <div className="min-h-screen bg-[#f6fbf7] pb-24 pt-safe">
      <div className="sticky top-0 z-20 border-b border-emerald-900/5 bg-[#f6fbf7]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3 rtl:flex-row-reverse">
          <button
            data-testid="wallet-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-emerald-950 shadow-sm transition-all active:scale-95"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-emerald-950">{t("wallet_title")}</h1>
            <p className="truncate text-xs font-medium text-emerald-900/55">{t("wallet_subtitle")}</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[28px] bg-[#103f32] p-5 text-white shadow-[0_18px_45px_rgba(16,63,50,0.20)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-emerald-100">
                <WalletIcon className="h-3.5 w-3.5" />
                Wallet
              </div>
              <h2 className="text-2xl font-black leading-tight tracking-tight">Ready to spend</h2>
              <p className="mt-2 max-w-[15rem] text-sm font-medium leading-relaxed text-white/75">
                Top up once and use your balance for meals, plans, and extras.
              </p>
            </div>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#24b893] text-white shadow-lg shadow-black/10">
              <CreditCard className="h-7 w-7" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-100">
                <ShieldCheck className="h-4 w-4 text-[#6de3c4]" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Secure</span>
              </div>
              <p className="mt-1 text-sm font-extrabold">SADAD checkout</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2 text-emerald-100">
                <WalletIcon className="h-4 w-4 text-amber-300" />
                <span className="text-[11px] font-bold uppercase tracking-wide">Credits</span>
              </div>
              <p className="mt-1 text-sm font-extrabold">Never expire</p>
            </div>
          </div>
        </section>

        <WalletTopUpFlow hideSimulationAlert={!import.meta.env.DEV} />
      </main>
    </div>
  );
}
