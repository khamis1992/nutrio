import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Clock,
  DollarSign,
  Loader2,
  Save,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";

const C = {
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
};

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 24 },
  },
};

type CoachEarningRow = {
  id?: string;
  coach_id: string;
  amount?: number | string | null;
  commission_amount?: number | string | null;
  net_amount?: number | string | null;
  status?: string | null;
  created_at?: string | null;
};

type CoachStat = {
  coachId: string;
  coachName: string;
  avgPrice: number;
  totalRevenue: number;
  commission: number;
  net: number;
  clientCount: number;
};

type PendingPayout = {
  coachId: string;
  coachName: string;
  amount: number;
  earningIds: string[];
};

const toNumber = (value: number | string | null | undefined) => Number(value || 0);

export default function AdminCoachCommission() {
  const { toast } = useToast();
  const [commissionPct, setCommissionPct] = useState(20);
  const [minPayout, setMinPayout] = useState(100);
  const [configId, setConfigId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [coachStats, setCoachStats] = useState<CoachStat[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);

  const fetchConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("platform_commission_config")
        .select("*")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setConfigId(data.id);
        setCommissionPct(toNumber(data.commission_pct));
        setMinPayout(toNumber(data.min_payout_threshold));
      }
    } catch (error) {
      console.error("Error fetching coach commission config:", error);
      toast({
        title: "Failed",
        description: "Could not load commission settings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchCoachStats = useCallback(async () => {
    try {
      const { data: earnings, error } = await supabase
        .from("coach_earnings")
        .select("coach_id, amount, commission_amount, net_amount, status, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!earnings) return;

      const coachMap = new Map<
        string,
        { total: number; commission: number; net: number; count: number }
      >();
      let total = 0;
      let monthly = 0;
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      for (const earning of earnings as CoachEarningRow[]) {
        const coach = coachMap.get(earning.coach_id) || {
          total: 0,
          commission: 0,
          net: 0,
          count: 0,
        };

        coach.total += toNumber(earning.amount);
        coach.commission += toNumber(earning.commission_amount);
        coach.net += toNumber(earning.net_amount);
        coach.count += 1;
        coachMap.set(earning.coach_id, coach);

        total += toNumber(earning.commission_amount);
        if (earning.created_at && earning.created_at >= thisMonthStart) {
          monthly += toNumber(earning.commission_amount);
        }
      }

      const coachIds = [...coachMap.keys()];
      if (coachIds.length === 0) {
        setCoachStats([]);
        setTotalRevenue(total);
        setMonthlyRevenue(monthly);
        return;
      }

      const [{ data: profiles }, { data: pricing }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", coachIds),
        supabase.from("coach_pricing").select("coach_id, price_per_week").in("coach_id", coachIds),
      ]);

      const nameMap = new Map(
        (profiles || []).map((profile: { user_id: string; full_name: string | null }) => [
          profile.user_id,
          profile.full_name,
        ]),
      );
      const priceMap = new Map(
        (pricing || []).map((price: { coach_id: string; price_per_week: number | null }) => [
          price.coach_id,
          price.price_per_week,
        ]),
      );

      setCoachStats(
        [...coachMap.entries()]
          .map(([coachId, stat]) => ({
            coachId,
            coachName: nameMap.get(coachId) || "Coach",
            avgPrice: toNumber(priceMap.get(coachId)),
            totalRevenue: stat.total,
            commission: stat.commission,
            net: stat.net,
            clientCount: stat.count,
          }))
          .sort((a, b) => b.commission - a.commission),
      );
      setTotalRevenue(total);
      setMonthlyRevenue(monthly);
    } catch (error) {
      console.error("Error fetching coach stats:", error);
      toast({
        title: "Failed",
        description: "Could not load coach earnings.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const fetchPendingPayouts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("coach_earnings")
        .select("coach_id, net_amount, id")
        .eq("status", "pending");

      if (error) throw error;
      if (!data) return;

      const coachMap = new Map<string, { total: number; ids: string[] }>();
      for (const earning of data as CoachEarningRow[]) {
        if (!earning.id) continue;
        const coach = coachMap.get(earning.coach_id) || { total: 0, ids: [] };
        coach.total += toNumber(earning.net_amount);
        coach.ids.push(earning.id);
        coachMap.set(earning.coach_id, coach);
      }

      const coachIds = [...coachMap.keys()];
      if (coachIds.length === 0) {
        setPendingPayouts([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", coachIds);

      const nameMap = new Map(
        (profiles || []).map((profile: { user_id: string; full_name: string | null }) => [
          profile.user_id,
          profile.full_name,
        ]),
      );

      setPendingPayouts(
        [...coachMap.entries()]
          .map(([coachId, stat]) => ({
            coachId,
            coachName: nameMap.get(coachId) || "Coach",
            amount: stat.total,
            earningIds: stat.ids,
          }))
          .filter((payout) => payout.amount >= minPayout),
      );
    } catch (error) {
      console.error("Error fetching coach pending payouts:", error);
      toast({
        title: "Failed",
        description: "Could not load pending payouts.",
        variant: "destructive",
      });
    }
  }, [minPayout, toast]);

  useEffect(() => {
    void fetchConfig();
    void fetchCoachStats();
    void fetchPendingPayouts();
  }, [fetchCoachStats, fetchConfig, fetchPendingPayouts]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        id: configId,
        commission_pct: commissionPct,
        min_payout_threshold: minPayout,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("platform_commission_config")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;

      toast({
        title: "Commission updated",
        description: `Platform commission set to ${commissionPct}%`,
      });
      await Promise.all([fetchCoachStats(), fetchPendingPayouts()]);
    } catch (error) {
      console.error("Error saving coach commission settings:", error);
      toast({
        title: "Failed",
        description: "Could not save commission settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (earningIds: string[]) => {
    try {
      const { error } = await supabase
        .from("coach_earnings")
        .update({ status: "settled", settled_at: new Date().toISOString() })
        .in("id", earningIds);

      if (error) throw error;

      toast({
        title: "Marked as paid",
        description: `${earningIds.length} earnings settled.`,
      });
      await Promise.all([fetchPendingPayouts(), fetchCoachStats()]);
    } catch (error) {
      console.error("Error marking coach earnings as paid:", error);
      toast({
        title: "Failed",
        description: "Could not mark as paid.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Coach Revenue" subtitle="Manage coaching platform commission and payouts">
        <div className="flex min-h-[360px] items-center justify-center rounded-[28px] bg-white ring-1 ring-[#E5EAF1]">
          <Loader2 className="h-8 w-8 animate-spin text-[#7C83F6]" />
        </div>
      </AdminLayout>
    );
  }

  const payoutReadyCount = pendingPayouts.length;

  return (
    <AdminLayout title="Coach Revenue" subtitle="Manage coaching platform commission and payouts">
      <div className="space-y-5 bg-[#F6F8FB] pb-8 text-[#020617]">
        <section className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#7C83F6]">
                <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                <Wallet className="h-3.5 w-3.5" />
                Coach finance
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[#020617] sm:text-3xl">
                Commission command center
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#64748B]">
                Tune platform take-rate, monitor coach revenue, and settle payout batches once they cross threshold.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="rounded-2xl bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#94A3B8]">Commission</p>
                <p className="mt-2 text-xl font-black text-[#22C7A1]">{commissionPct}%</p>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1]">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#94A3B8]">Ready payouts</p>
                <p className="mt-2 text-xl font-black text-[#7C83F6]">{payoutReadyCount}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div variants={fadeInUp} initial="hidden" animate="visible">
            <Card className="h-full rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                      Platform settings
                    </p>
                    <h3 className="mt-1 text-xl font-black text-[#020617]">
                      Commission rate
                    </h3>
                  </div>
                  <div className="rounded-2xl bg-[#22C7A1]/10 px-4 py-2 text-2xl font-black text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                    {commissionPct}%
                  </div>
                </div>

                <div className="space-y-3">
                  <input
                    type="range"
                    min={5}
                    max={50}
                    value={commissionPct}
                    onChange={(event) => setCommissionPct(Number(event.target.value))}
                    className="h-2 w-full cursor-pointer accent-[#22C7A1]"
                    aria-label="Platform commission rate"
                  />
                  <div className="flex justify-between text-xs font-bold text-[#94A3B8]">
                    <span>5%</span>
                    <span>50%</span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-2">
                    <label htmlFor="min-payout" className="text-sm font-black text-[#020617]">
                      Minimum payout threshold
                    </label>
                    <div className="relative">
                      <Input
                        id="min-payout"
                        type="number"
                        value={minPayout}
                        onChange={(event) =>
                          setMinPayout(Math.max(0, Number(event.target.value)))
                        }
                        className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pr-16 font-semibold text-[#020617]"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#94A3B8]">
                        QAR
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="min-h-[48px] rounded-full bg-[#020617] px-5 font-black text-white shadow-none hover:bg-[#020617]/90"
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"
          >
            <Card className="rounded-[24px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                      This month
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#020617]">
                      {formatCurrency(monthlyRevenue)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#22C7A1]">
                      Platform commission
                    </p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#22C7A1]/10">
                    <DollarSign className="h-6 w-6" style={{ color: C.progress }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                      All-time revenue
                    </p>
                    <p className="mt-2 text-2xl font-black text-[#020617]">
                      {formatCurrency(totalRevenue)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#7C83F6]">
                      Coach channel
                    </p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7C83F6]/10">
                    <TrendingUp className="h-6 w-6" style={{ color: C.protein }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.95fr]">
          <motion.div variants={fadeInUp} initial="hidden" animate="visible">
            <Card className="overflow-hidden rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-[#E5EAF1] px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                      Leaderboard
                    </p>
                    <h3 className="text-lg font-black text-[#020617]">Per-coach breakdown</h3>
                  </div>
                  <Users className="h-5 w-5 text-[#38BDF8]" />
                </div>

                {coachStats.length === 0 ? (
                  <div className="py-14 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                      <Users className="h-8 w-8 text-[#94A3B8]" />
                    </div>
                    <p className="text-sm font-semibold text-[#94A3B8]">
                      No coach earnings yet
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5EAF1]">
                    {coachStats.map((coach) => (
                      <div
                        key={coach.coachId}
                        className="grid gap-4 px-5 py-4 transition-colors hover:bg-[#F6F8FB] sm:grid-cols-[1fr_auto]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                            <Users className="h-5 w-5" style={{ color: C.water }} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#020617]">
                              {coach.coachName}
                            </p>
                            <p className="text-xs font-semibold text-[#94A3B8]">
                              {coach.clientCount} subscriptions / Avg {formatCurrency(coach.avgPrice)}/wk
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-right sm:min-w-[310px]">
                          <div>
                            <p className="text-xs font-bold text-[#94A3B8]">Gross</p>
                            <p className="text-sm font-black text-[#020617]">
                              {formatCurrency(coach.totalRevenue)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#94A3B8]">Commission</p>
                            <p className="text-sm font-black text-[#7C83F6]">
                              {formatCurrency(coach.commission)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#94A3B8]">Coach net</p>
                            <p className="text-sm font-black text-[#22C7A1]">
                              {formatCurrency(coach.net)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={fadeInUp} initial="hidden" animate="visible">
            <Card className="overflow-hidden rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-[#E5EAF1] px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                      Settlement queue
                    </p>
                    <h3 className="text-lg font-black text-[#020617]">Pending coach payouts</h3>
                  </div>
                  <Clock className="h-5 w-5" style={{ color: C.protein }} />
                </div>

                {pendingPayouts.length === 0 ? (
                  <div className="py-14 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                      <Check className="h-8 w-8 text-[#22C7A1]" />
                    </div>
                    <p className="text-sm font-semibold text-[#94A3B8]">
                      No payouts above threshold
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5EAF1]">
                    {pendingPayouts.map((payout) => (
                      <div
                        key={payout.coachId}
                        className="grid gap-3 px-5 py-4 transition-colors hover:bg-[#F6F8FB] sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                            <Clock className="h-5 w-5" style={{ color: C.protein }} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#020617]">
                              {payout.coachName}
                            </p>
                            <p className="text-xs font-semibold text-[#94A3B8]">
                              {payout.earningIds.length} earnings / {formatCurrency(payout.amount)} available
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => markPaid(payout.earningIds)}
                          className="min-h-[44px] rounded-full bg-[#020617] px-4 font-black text-white shadow-none hover:bg-[#020617]/90"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Mark Paid
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
}
