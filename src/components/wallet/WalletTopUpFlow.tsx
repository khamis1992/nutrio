import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CreditCard,
  History,
  Plus,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { TopUpPackages } from "@/components/wallet/TopUpPackages";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";
import { WalletBalance } from "@/components/wallet/WalletBalance";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWallet, type TopUpPackage } from "@/hooks/useWallet";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type WalletView = "topup" | "activity";

export function WalletTopUpFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { wallet, transactions, topUpPackages, loading, packagesLoading, transactionsLoading } = useWallet();
  const [activeView, setActiveView] = useState<WalletView>("topup");
  const [selectedPackage, setSelectedPackage] = useState<TopUpPackage | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const copy = isRTL
    ? {
        addFunds: "إضافة رصيد",
        activity: "النشاط",
        meals: "الوجبات",
        invoices: "الفواتير",
        quickActions: "إجراءات سريعة",
        paymentTitle: "دفع محمي",
        paymentBody: "تتم عملية الدفع عبر SADAD، ويُضاف الرصيد بعد تأكيد العملية.",
        neverExpires: "الرصيد لا تنتهي صلاحيته",
        package: "الباقة",
        payNow: "المبلغ المدفوع",
        bonus: "الرصيد الإضافي",
        walletGets: "سيصل إلى المحفظة",
        continue: "المتابعة إلى SADAD",
        cancel: "إلغاء",
      }
    : {
        addFunds: "Add funds",
        activity: "Activity",
        meals: "Meals",
        invoices: "Invoices",
        quickActions: "Quick actions",
        paymentTitle: "Protected payment",
        paymentBody: "Checkout is handled by SADAD. Credit is added after payment confirmation.",
        neverExpires: "Wallet credit never expires",
        package: "Package",
        payNow: "You pay",
        bonus: "Bonus credit",
        walletGets: "Wallet receives",
        continue: "Continue to SADAD",
        cancel: "Cancel",
      };

  const handleSelectPackage = (pkg: TopUpPackage) => {
    setSelectedPackage(pkg);
    setConfirmOpen(true);
  };

  const handleConfirmPayment = () => {
    if (!selectedPackage || !user) return;
    setProcessingId(selectedPackage.id);
    setConfirmOpen(false);
    navigate(`/checkout?type=wallet&packageId=${selectedPackage.id}`);
  };

  return (
    <div className="space-y-4">
      <WalletBalance
        balance={wallet?.balance || 0}
        totalCredits={wallet?.total_credits || 0}
        totalDebits={wallet?.total_debits || 0}
        loading={loading}
      />

      <section className="rounded-[24px] bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-[#DDE5EF]">
        <div className="flex items-center justify-between px-1 pb-2.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8A98AF]">{copy.quickActions}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <QuickAction icon={<Plus className="h-5 w-5" />} label={copy.addFunds} tone="mint" onClick={() => setActiveView("topup")} />
          <QuickAction icon={<ShoppingBag className="h-5 w-5" />} label={copy.meals} tone="blue" onClick={() => navigate("/meals")} />
          <QuickAction icon={<ReceiptText className="h-5 w-5" />} label={copy.invoices} tone="coral" onClick={() => navigate("/invoices")} />
        </div>
      </section>

      <nav aria-label="Wallet sections" className="grid grid-cols-2 rounded-[20px] bg-[#E9EEF4] p-1.5">
        <WalletTab active={activeView === "topup"} icon={<WalletCards className="h-4 w-4" />} label={copy.addFunds} onClick={() => setActiveView("topup")} />
        <WalletTab active={activeView === "activity"} icon={<History className="h-4 w-4" />} label={copy.activity} count={transactions.length} onClick={() => setActiveView("activity")} />
      </nav>

      <AnimatePresence mode="wait" initial={false}>
        {activeView === "topup" ? (
          <motion.div key="topup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="space-y-4">
            <TopUpPackages
              packages={topUpPackages}
              loading={packagesLoading}
              onSelectPackage={handleSelectPackage}
              selectedPackageId={selectedPackage?.id}
              processingId={processingId ?? undefined}
            />

            <section className="flex items-start gap-3 rounded-[22px] bg-[#F1FBF8] p-4 ring-1 ring-[#BCECDF]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-white text-[#16A98A] ring-1 ring-[#DDE5EF]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-extrabold text-[#07152F]">{copy.paymentTitle}</h3>
                <p className="mt-1 text-[10px] font-medium leading-5 text-[#596982]">{copy.paymentBody}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-extrabold text-[#0E9F83]">
                  <Check className="h-3.5 w-3.5" /> {copy.neverExpires}
                </div>
              </div>
            </section>
          </motion.div>
        ) : (
          <motion.div key="activity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
            <TransactionHistory transactions={transactions} loading={transactionsLoading} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmOpen && selectedPackage && (
          <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-900/35 backdrop-blur-sm sm:items-center sm:p-4">
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-confirm-title"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 36 }}
              className="w-full max-w-[430px] rounded-t-[30px] bg-white px-5 pb-[calc(24px+env(safe-area-inset-bottom,0px))] pt-5 shadow-2xl sm:rounded-[30px]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#0E9F83]">{t("wallet_confirm_topup")}</p>
                  <h2 id="wallet-confirm-title" className="mt-1 text-[22px] font-extrabold text-[#07152F]">{formatCurrency(selectedPackage.amount)}</h2>
                  <p className="mt-1 text-[11px] font-medium text-[#71809C]">{t("wallet_confirm_topup_description")}</p>
                </div>
                <button type="button" onClick={() => setConfirmOpen(false)} aria-label={copy.cancel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F4F7FA] text-[#596982] ring-1 ring-[#DDE5EF]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 overflow-hidden rounded-[22px] bg-[#F8FAFC] ring-1 ring-[#E1E7EF]">
                <div className="flex items-center gap-3 border-b border-[#E1E7EF] p-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#E9FBF7] text-[#16A98A] ring-1 ring-[#BCECDF]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A98AF]">{copy.package}</p>
                    <p className="mt-1 truncate text-[14px] font-extrabold text-[#07152F]">{selectedPackage.name}</p>
                  </div>
                </div>
                <div className="space-y-3 p-4 text-[11px] font-semibold">
                  <SummaryRow label={copy.payNow} value={formatCurrency(selectedPackage.amount)} />
                  {selectedPackage.bonus_amount > 0 && <SummaryRow label={copy.bonus} value={`+${formatCurrency(selectedPackage.bonus_amount)}`} accent />}
                  <div className="border-t border-[#DDE5EF] pt-3">
                    <SummaryRow label={copy.walletGets} value={formatCurrency(selectedPackage.amount + selectedPackage.bonus_amount)} strong accent />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmPayment}
                className="mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#22C7A1] text-[13px] font-extrabold text-white shadow-[0_12px_26px_rgba(34,199,161,0.26)] transition active:scale-[0.98]"
              >
                <CreditCard className="h-5 w-5" /> {copy.continue} <ArrowRight className={cn("h-4 w-4", isRTL && "rotate-180")} />
              </button>
              <button type="button" onClick={() => setConfirmOpen(false)} className="mt-2 min-h-11 w-full text-[11px] font-bold text-[#71809C]">{copy.cancel}</button>
            </motion.section>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickAction({ icon, label, tone, onClick }: { icon: React.ReactNode; label: string; tone: "mint" | "blue" | "coral"; onClick: () => void }) {
  const styles = {
    mint: "bg-[#E9FBF7] text-[#087B67] ring-[#BCECDF]",
    blue: "bg-[#EDF7FF] text-[#338DCE] ring-[#CFE8FA]",
    coral: "bg-[#FFF1EF] text-[#E45F58] ring-[#F7D4D0]",
  };
  return (
    <button type="button" onClick={onClick} className={cn("flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-[18px] px-2 text-[10px] font-extrabold ring-1 transition active:scale-95", styles[tone])}>
      {icon}<span className="line-clamp-1">{label}</span>
    </button>
  );
}

function WalletTab({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex min-h-11 items-center justify-center gap-2 rounded-[15px] px-3 text-[11px] font-extrabold transition", active ? "bg-white text-[#07152F] shadow-sm ring-1 ring-[#DDE5EF]" : "text-[#71809C]")}>
      {icon}<span>{label}</span>{typeof count === "number" && <span className={cn("rounded-full px-1.5 py-0.5 text-[8px]", active ? "bg-[#E9FBF7] text-[#087B67]" : "bg-white/70")}>{count}</span>}
    </button>
  );
}

function SummaryRow({ label, value, accent = false, strong = false }: { label: string; value: string; accent?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={cn("text-[#71809C]", strong && "font-extrabold text-[#07152F]")}>{label}</span>
      <span className={cn("text-end font-extrabold text-[#07152F] tabular-nums", accent && "text-[#0E9F83]", strong && "text-[14px]")}>{value}</span>
    </div>
  );
}
