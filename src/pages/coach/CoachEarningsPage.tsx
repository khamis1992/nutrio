import { motion } from "framer-motion";
import { Loader2, DollarSign, Clock, CheckCircle2, TrendingUp, User, Calendar, ArrowUpRight, Download, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachEarnings } from "@/hooks/useCoachEarnings";
import { useCoachWithdrawal } from "@/hooks/useCoachWithdrawal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const statCard = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.05 } },
};

export default function CoachEarningsPage() {
  const { user } = useAuth();
  const coachId = user?.id;
  const { summary, subscriptions, earnings, loading, commissionPct, refresh } = useCoachEarnings(coachId);
  const { withdrawals, submitting, requestWithdrawal, refresh: refreshWithdrawals } = useCoachWithdrawal(coachId);
  const { toast } = useToast();
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[100px] animate-pulse rounded-[20px] bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) => `QAR ${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const stats = [
    { label: "Total Earned", value: formatCurrency(summary.totalEarned), sub: "Gross before commission", icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Available", value: formatCurrency(summary.availableToWithdraw), sub: "Ready to withdraw", icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Pending", value: formatCurrency(summary.pendingAmount), sub: `${commissionPct}% platform fee applies`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "This Month", value: formatCurrency(summary.thisMonthEarned), sub: "Net after commission", icon: Calendar, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Earnings</h1>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">
          {commissionPct}% platform commission · track your coaching income
        </p>
      </div>

      {/* Summary cards */}
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={statCard}
            className="bg-white rounded-[20px] p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ring-1 ring-slate-100/80"
          >
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <p className="text-lg font-extrabold text-slate-950">{stat.value}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mt-0.5">{stat.label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{stat.sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Active Subscribers */}
      {subscriptions.length > 0 && (
        <motion.div
          variants={statCard}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-slate-800">Active Subscribers</h2>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              {subscriptions.length} total
            </span>
          </div>
          <div className="space-y-2">
            {subscriptions.filter(s => s.status === "active").map((sub) => (
              <div key={sub.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
                  {sub.clientAvatar ? (
                    <img src={sub.clientAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 truncate">{sub.clientName}</p>
                  <p className="text-[10px] text-slate-500">
                    {sub.plan === "weekly" ? `${formatCurrency(sub.price)}/week` : `${formatCurrency(sub.price)}/month`}
                    {" · "}Started {new Date(sub.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                  Active
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Transaction History */}
      {earnings.length > 0 && (
        <motion.div
          variants={statCard}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <h2 className="text-[14px] font-extrabold text-slate-800 mb-3">Transaction History</h2>
          <div className="space-y-1">
            {earnings.slice(0, 10).map((earning) => {
              const isPositive = earning.transaction_type !== "refund";
              const typeLabel = {
                subscription: "New subscription",
                renewal: "Auto-renewal",
                refund: "Refund",
                bonus: "Bonus",
              }[earning.transaction_type];

              return (
                <div key={earning.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    isPositive ? "bg-emerald-50" : "bg-red-50"
                  )}>
                    <ArrowUpRight className={cn("w-4 h-4", isPositive ? "text-emerald-600" : "text-red-500")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900">{typeLabel}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(earning.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" · "}{earning.status === "settled" ? "Settled" : "Pending"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-[13px] font-bold", isPositive ? "text-emerald-600" : "text-red-500")}>
                      {isPositive ? "+" : "-"}{formatCurrency(Number(earning.net_amount))}
                    </p>
                    <p className="text-[9px] text-slate-400">Net after {earning.commission_pct}% fee</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Empty state */}
      {subscriptions.length === 0 && earnings.length === 0 && (
        <motion.div
          variants={statCard}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-12 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 mb-1">No earnings yet</h3>
          <p className="text-[12px] text-slate-500 max-w-[260px] mx-auto">
            Set your pricing and start coaching to earn income. Your earnings will appear here.
          </p>
        </motion.div>
      )}
      {/* Withdraw CTA */}
      {summary.availableToWithdraw > 0 && (
        <motion.div
          variants={statCard}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-extrabold text-slate-800">Withdraw Funds</h2>
              <p className="text-[10px] text-slate-400">Transfer available balance to your bank account</p>
            </div>
            <button
              onClick={() => {
                setWithdrawAmount(String(summary.availableToWithdraw));
                setWithdrawModalOpen(true);
              }}
              className="flex items-center gap-1.5 h-[38px] px-5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[13px] font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              Withdraw
            </button>
          </div>
        </motion.div>
      )}

      {/* Withdrawal Modal */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-extrabold text-slate-950">Withdraw to Bank</h2>
              <button onClick={() => setWithdrawModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Amount (QAR)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                {Number(withdrawAmount) > summary.availableToWithdraw && (
                  <p className="text-[10px] text-red-500 mt-1">Cannot exceed available balance ({formatCurrency(summary.availableToWithdraw)})</p>
                )}
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. QNB"
                  className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">IBAN</label>
                <input
                  type="text"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="QA12345678901234567890"
                  className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Account Holder Name</label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="e.g. Ahmed Ali"
                  className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <button
                onClick={async () => {
                  const amount = Number(withdrawAmount);
                  if (!amount || amount <= 0) {
                    toast({ title: "Invalid amount", description: "Please enter a valid withdrawal amount.", variant: "destructive" });
                    return;
                  }
                  if (amount > summary.availableToWithdraw) {
                    toast({ title: "Exceeds balance", description: `You can withdraw up to ${formatCurrency(summary.availableToWithdraw)}.`, variant: "destructive" });
                    return;
                  }
                  if (!bankName.trim()) {
                    toast({ title: "Missing bank", description: "Please enter your bank name.", variant: "destructive" });
                    return;
                  }
                  if (!iban.trim()) {
                    toast({ title: "Missing IBAN", description: "Please enter your IBAN.", variant: "destructive" });
                    return;
                  }
                  if (!accountHolder.trim()) {
                    toast({ title: "Missing name", description: "Please enter the account holder name.", variant: "destructive" });
                    return;
                  }
                  const result = await requestWithdrawal(amount, bankName, iban, accountHolder);
                  if (result.success) {
                    toast({ title: "Withdrawal requested", description: "Your withdrawal request has been submitted for admin approval." });
                    setWithdrawModalOpen(false);
                    setBankName("");
                    setIban("");
                    setAccountHolder("");
                    setWithdrawAmount("");
                    refreshWithdrawals();
                    refresh();
                  } else {
                    toast({ title: "Failed", description: result.error?.message || "Please try again.", variant: "destructive" });
                  }
                }}
                disabled={submitting}
                className="w-full h-[44px] rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[13px] font-bold shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Submit Request
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Withdrawal History */}
      {withdrawals.length > 0 && (
        <motion.div
          variants={statCard}
          initial="hidden"
          animate="visible"
          className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
        >
          <h2 className="text-[14px] font-extrabold text-slate-800 mb-3">Withdrawal History</h2>
          <div className="space-y-1">
            {withdrawals.map((w) => {
              const statusColors: Record<string, string> = {
                pending: "bg-amber-50 text-amber-700",
                approved: "bg-blue-50 text-blue-700",
                rejected: "bg-red-50 text-red-700",
                processed: "bg-emerald-50 text-emerald-700",
              };
              return (
                <div key={w.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold", statusColors[w.status])}>
                    {w.status === "pending" ? "⏳" : w.status === "approved" ? "✓" : w.status === "processed" ? "✓" : "✕"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-slate-900">QAR {w.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] text-slate-400">{w.bank_name} · {w.iban.slice(0, 4)}...{w.iban.slice(-4)} · {w.account_holder}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", statusColors[w.status])}>
                      {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                    </span>
                    <p className="text-[9px] text-slate-400 mt-0.5">
                      {new Date(w.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
