import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Save, TrendingUp, Users, DollarSign, Check, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function AdminCoachCommission() {
  const { toast } = useToast();
  const [commissionPct, setCommissionPct] = useState(20);
  const [minPayout, setMinPayout] = useState(100);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coachStats, setCoachStats] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);

  useEffect(() => {
    fetchConfig();
    fetchCoachStats();
    fetchPendingPayouts();
  }, []);

  const fetchConfig = async () => {
    const { data } = await supabase.from("platform_commission_config").select("*").single();
    if (data) {
      setConfigId(data.id);
      setCommissionPct(Number(data.commission_pct));
      setMinPayout(Number(data.min_payout_threshold));
    }
    setLoading(false);
  };

  const fetchCoachStats = async () => {
    const { data: earnings } = await supabase.from("coach_earnings").select("coach_id, amount, commission_amount, net_amount, status, created_at").order("created_at", { ascending: false });
    if (!earnings) return;

    const coachMap = new Map<string, { total: number; commission: number; net: number; count: number }>();
    let total = 0;
    let monthly = 0;
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    for (const e of earnings) {
      const c = coachMap.get(e.coach_id) || { total: 0, commission: 0, net: 0, count: 0 };
      c.total += Number(e.amount);
      c.commission += Number(e.commission_amount);
      c.net += Number(e.net_amount);
      c.count++;
      coachMap.set(e.coach_id, c);
      total += Number(e.commission_amount);
      if (e.created_at >= thisMonthStart) monthly += Number(e.commission_amount);
    }

    // Get coach names
    const coachIds = [...coachMap.keys()];
    if (coachIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", coachIds);
      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      const { data: pricing } = await supabase.from("coach_pricing").select("coach_id, price_per_week").in("coach_id", coachIds);
      const priceMap = new Map((pricing || []).map((p: any) => [p.coach_id, p.price_per_week]));

      setCoachStats(
        [...coachMap.entries()].map(([coachId, stat]) => ({
          coachId,
          coachName: nameMap.get(coachId) || "Coach",
          avgPrice: priceMap.get(coachId) || 0,
          totalRevenue: stat.total,
          commission: stat.commission,
          net: stat.net,
          clientCount: stat.count,
        })).sort((a, b) => b.commission - a.commission)
      );
    }

    setTotalRevenue(total);
    setMonthlyRevenue(monthly);
  };

  const fetchPendingPayouts = async () => {
    const { data } = await supabase.from("coach_earnings").select("coach_id, net_amount, id").eq("status", "pending");
    if (!data) return;
    const coachMap = new Map<string, { total: number; ids: string[] }>();
    for (const e of data) {
      const c = coachMap.get(e.coach_id) || { total: 0, ids: [] };
      c.total += Number(e.net_amount);
      c.ids.push(e.id);
      coachMap.set(e.coach_id, c);
    }
    const coachIds = [...coachMap.keys()];
    if (coachIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", coachIds);
      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
      setPendingPayouts(
        [...coachMap.entries()]
          .map(([coachId, stat]) => ({ coachId, coachName: nameMap.get(coachId) || "Coach", amount: stat.total, earningIds: stat.ids }))
          .filter(c => c.amount >= minPayout)
      );
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("platform_commission_config").upsert(
        { id: configId, commission_pct: commissionPct, min_payout_threshold: minPayout, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
      toast({ title: "Commission updated", description: `Platform commission set to ${commissionPct}%` });
      await fetchCoachStats();
    } catch {
      toast({ title: "Failed", description: "Could not save commission settings.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (earningIds: string[]) => {
    try {
      await supabase.from("coach_earnings").update({ status: "settled", settled_at: new Date().toISOString() }).in("id", earningIds);
      toast({ title: "Marked as paid", description: `${earningIds.length} earnings settled.` });
      await Promise.all([fetchPendingPayouts(), fetchCoachStats()]);
    } catch {
      toast({ title: "Failed", description: "Could not mark as paid.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (val: number) => `QAR ${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Coach Revenue</h1>
        <p className="text-sm text-gray-500 mt-1">Manage coaching platform commission and payouts</p>
      </div>

      {/* Commission Config */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-extrabold text-gray-700">Platform Commission Rate</h2>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={5}
            max={50}
            value={commissionPct}
            onChange={(e) => setCommissionPct(Number(e.target.value))}
            className="flex-1 accent-emerald-600"
          />
          <span className="text-2xl font-extrabold text-emerald-600 min-w-[60px] text-right">{commissionPct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Minimum payout threshold:</span>
          <input
            type="number"
            value={minPayout}
            onChange={(e) => setMinPayout(Math.max(0, Number(e.target.value)))}
            className="w-20 h-8 rounded-lg border border-gray-200 px-2 text-xs font-semibold"
          />
          <span className="text-xs text-gray-400">QAR</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </motion.div>

      {/* Revenue Overview */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <DollarSign className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-2xl font-extrabold text-gray-900">{formatCurrency(monthlyRevenue)}</p>
          <p className="text-xs text-gray-500">This month's revenue</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <TrendingUp className="w-8 h-8 text-blue-500 mb-2" />
          <p className="text-2xl font-extrabold text-gray-900">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-500">All-time revenue</p>
        </div>
      </motion.div>

      {/* Per-Coach Breakdown */}
      {coachStats.length > 0 && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-extrabold text-gray-700 mb-4">Per-Coach Breakdown</h2>
          <div className="space-y-3">
            {coachStats.map((coach) => (
              <div key={coach.coachId} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{coach.coachName}</p>
                  <p className="text-[11px] text-gray-500">
                    {coach.clientCount} subscriptions · Avg QAR {coach.avgPrice}/wk
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(coach.commission)}</p>
                  <p className="text-[10px] text-emerald-600">Your cut</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pending Payouts */}
      {pendingPayouts.length > 0 && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-extrabold text-gray-700 mb-4">Pending Coach Payouts</h2>
          <div className="space-y-3">
            {pendingPayouts.map((payout) => (
              <div key={payout.coachId} className="flex items-center gap-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <Clock className="w-8 h-8 text-amber-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-900">{payout.coachName}</p>
                  <p className="text-[11px] text-amber-600">{formatCurrency(payout.amount)} available</p>
                </div>
                <button
                  onClick={() => markPaid(payout.earningIds)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark as Paid
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
