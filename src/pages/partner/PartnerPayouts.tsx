import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Calendar, TrendingUp, Clock, CheckCircle, AlertCircle, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { formatCurrency } from "@/lib/currency";

interface Payout {
  id: string;
  amount: number;
  status: string;
  period_start: string;
  period_end: string;
  order_count: number;
  payout_method: string;
  processed_at: string | null;
  created_at: string;
  commission_rate: number;
  total_order_value: number;
  commission_deducted: number;
}

const PartnerPayouts = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState({ totalEarnings: 0, pendingAmount: 0, lastPayout: 0, thisMonthEarnings: 0 });

  useEffect(() => {
    if (user) fetchPayouts();
  }, [user]);

  const fetchPayouts = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from("payouts").select("*").eq("partner_id", user.id).order("created_at", { ascending: false });
      setPayouts(data || []);
      const completed = (data || []).filter((p) => p.status === "completed");
      const pending = (data || []).filter((p) => p.status === "pending" || p.status === "processing");
      setSummary({
        totalEarnings: completed.reduce((sum, p) => sum + p.amount, 0),
        pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
        lastPayout: completed.length > 0 ? completed[0].amount : 0,
        thisMonthEarnings: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing": return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "processing": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  if (loading) return <PartnerLayout title="Payouts"><Skeleton className="h-64 w-full" /></PartnerLayout>;

  return (
    <PartnerLayout title="Payouts" subtitle="Track your earnings">
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-green-500" /></div><div><p className="text-2xl font-bold">{formatCurrency(summary.totalEarnings)}</p><p className="text-xs text-muted-foreground">Total Earnings</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Clock className="h-5 w-5 text-amber-500" /></div><div><p className="text-2xl font-bold">{formatCurrency(summary.pendingAmount)}</p><p className="text-xs text-muted-foreground">Pending</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{formatCurrency(summary.thisMonthEarnings)}</p><p className="text-xs text-muted-foreground">This Month</p></div></div></CardContent></Card>
          <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center"><Wallet className="h-5 w-5 text-blue-500" /></div><div><p className="text-2xl font-bold">{formatCurrency(summary.lastPayout)}</p><p className="text-xs text-muted-foreground">Last Payout</p></div></div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Payout History</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {payouts.length === 0 ? (
              <div className="text-center py-8"><Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" /><p className="text-muted-foreground">No payouts yet</p></div>
            ) : payouts.map((payout) => (
              <div key={payout.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">{getStatusIcon(payout.status)}</div><div><p className="font-semibold">{formatCurrency(payout.amount)}</p><div className="flex items-center gap-2 text-xs text-muted-foreground mt-1"><Calendar className="h-3 w-3" /><span>{new Date(payout.period_start).toLocaleDateString()} - {new Date(payout.period_end).toLocaleDateString()}</span></div></div></div>
                  <div className="text-right"><Badge variant="outline" className={getStatusColor(payout.status)}>{payout.status}</Badge><p className="text-xs text-muted-foreground mt-1">{payout.order_count} orders</p></div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PartnerLayout>
  );
};

export default PartnerPayouts;
