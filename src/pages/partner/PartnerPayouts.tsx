import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Calendar, TrendingUp, Clock, CheckCircle, Wallet, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { formatCurrency } from "@/lib/currency";

interface PartnerPayout {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  week_start: string;
  week_end: string;
  meals_prepared: number;
  payout_rate: number;
  processed_at: string | null;
  created_at: string;
}

interface WeeklyEarning {
  week_start: string;
  week_end: string;
  meals_prepared: number;
  payout_rate: number;
  amount: number;
}

const PartnerPayouts = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [weeklyEarnings, setWeeklyEarnings] = useState<WeeklyEarning[]>([]);
  const [payoutRate, setPayoutRate] = useState<number>(0);
  const [summary, setSummary] = useState({ 
    totalEarnings: 0, 
    pendingAmount: 0, 
    lastPayout: 0, 
    thisMonthEarnings: 0,
    totalMealsPrepared: 0
  });

  useEffect(() => {
    if (user) fetchPayoutData();
  }, [user]);

  const fetchPayoutData = async () => {
    if (!user) return;
    try {
      // Fetch restaurant to get payout rate
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("payout_rate")
        .eq("owner_id", user.id)
        .maybeSingle();
      
      const rate = restaurant?.payout_rate || 0;
      setPayoutRate(rate);

      // Fetch completed payouts from partner_payouts table
      const { data: payoutsData } = await supabase
        .from("partner_payouts")
        .select("*")
        .eq("partner_id", user.id)
        .order("created_at", { ascending: false });

      setPayouts(payoutsData || []);

      // Calculate weekly earnings from partner_earnings table
      const { data: earningsData } = await supabase
        .from("partner_earnings")
        .select("amount, created_at")
        .eq("partner_id", user.id)
        .order("created_at", { ascending: false });

      // Calculate summary
      const completed = (payoutsData || []).filter((p) => p.status === "completed");
      const pending = (payoutsData || []).filter((p) => p.status === "pending" || p.status === "processing");
      
      // Calculate this month's earnings
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthEarnings = (earningsData || [])
        .filter(e => new Date(e.created_at) >= thisMonthStart)
        .reduce((sum, e) => sum + e.amount, 0);

      // Calculate total meals prepared (earnings / payout_rate)
      const totalEarnings = (earningsData || []).reduce((sum, e) => sum + e.amount, 0);
      const totalMealsPrepared = rate > 0 ? Math.round(totalEarnings / rate) : 0;

      setSummary({
        totalEarnings: completed.reduce((sum, p) => sum + p.amount, 0),
        pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
        lastPayout: completed.length > 0 ? completed[0].amount : 0,
        thisMonthEarnings,
        totalMealsPrepared
      });

      // Group earnings by week for display
      const weeklyMap = new Map<string, WeeklyEarning>();
      (earningsData || []).forEach(earning => {
        const date = new Date(earning.created_at);
        const weekStart = getWeekStart(date);
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyMap.has(weekKey)) {
          weeklyMap.set(weekKey, {
            week_start: weekKey,
            week_end: getWeekEnd(date).toISOString().split('T')[0],
            meals_prepared: 0,
            payout_rate: rate,
            amount: 0
          });
        }
        
        const week = weeklyMap.get(weekKey)!;
        week.amount += earning.amount;
        week.meals_prepared = rate > 0 ? Math.round(week.amount / rate) : 0;
      });

      setWeeklyEarnings(Array.from(weeklyMap.values()).slice(0, 10));
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  };

  const getWeekEnd = (date: Date): Date => {
    const start = getWeekStart(date);
    return new Date(start.setDate(start.getDate() + 6));
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
    <PartnerLayout title="Payouts" subtitle="Track your earnings from meal preparation">
      <div className="space-y-6">
        {/* Payout Rate Info */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Payout Rate</p>
                <p className="text-2xl font-bold">{formatCurrency(payoutRate)} <span className="text-sm font-normal text-muted-foreground">per meal</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(summary.totalEarnings)}</p>
                  <p className="text-xs text-muted-foreground">Total Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(summary.pendingAmount)}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(summary.thisMonthEarnings)}</p>
                  <p className="text-xs text-muted-foreground">This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <UtensilsCrossed className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalMealsPrepared}</p>
                  <p className="text-xs text-muted-foreground">Meals Prepared</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payout History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payouts.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No payouts yet</p>
              </div>
            ) : payouts.map((payout) => (
              <div key={payout.id} className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                      {getStatusIcon(payout.status)}
                    </div>
                    <div>
                      <p className="font-semibold">{formatCurrency(payout.amount)}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(payout.week_start).toLocaleDateString()} - {new Date(payout.week_end).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={getStatusColor(payout.status)}>
                      {payout.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">{payout.meals_prepared} meals</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Weekly Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {weeklyEarnings.length === 0 ? (
              <div className="text-center py-8">
                <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No meal data yet</p>
              </div>
            ) : weeklyEarnings.map((week, index) => (
              <div key={index} className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{formatCurrency(week.amount)}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(week.week_start).toLocaleDateString()} - {new Date(week.week_end).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{week.meals_prepared} meals</p>
                    <p className="text-xs text-muted-foreground">× {formatCurrency(week.payout_rate)}/meal</p>
                  </div>
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
