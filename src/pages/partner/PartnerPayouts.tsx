import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PartnerNavigation } from "@/components/PartnerNavigation";

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

interface PayoutSummary {
  totalEarnings: number;
  pendingAmount: number;
  lastPayout: number;
  thisMonthEarnings: number;
  totalCommission: number;
}

const PartnerPayouts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary>({
    totalEarnings: 0,
    pendingAmount: 0,
    lastPayout: 0,
    thisMonthEarnings: 0,
    totalCommission: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPayouts();
    }
  }, [user]);

  const fetchPayouts = async () => {
    if (!user) return;

    try {
      // Get payouts
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("partner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPayouts(data || []);

      // Calculate summary
      const completed = (data || []).filter((p) => p.status === "completed");
      const pending = (data || []).filter((p) => p.status === "pending" || p.status === "processing");
      
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const thisMonthStr = thisMonth.toISOString().split("T")[0];
      
      const thisMonthPayouts = completed.filter((p) => p.period_start >= thisMonthStr);

      setSummary({
        totalEarnings: completed.reduce((sum, p) => sum + p.amount, 0),
        pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
        lastPayout: completed.length > 0 ? completed[0].amount : 0,
        thisMonthEarnings: thisMonthPayouts.reduce((sum, p) => sum + p.amount, 0),
        totalCommission: (data || []).reduce((sum, p) => sum + (p.commission_deducted || 0), 0),
      });
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "processing":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "pending":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "failed":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/partner")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Payouts</h1>
              <p className="text-sm text-muted-foreground">Track your earnings</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${summary.totalEarnings.toFixed(0)}</p>
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
                  <p className="text-2xl font-bold">${summary.pendingAmount.toFixed(0)}</p>
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
                  <p className="text-2xl font-bold">${summary.thisMonthEarnings.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">This Month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${summary.lastPayout.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Last Payout</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payout History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payout History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {payouts.length === 0 ? (
              <div className="text-center py-8">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No payouts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Payouts will appear here when processed
                </p>
              </div>
            ) : (
              payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="p-4 rounded-lg bg-muted/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                        {getStatusIcon(payout.status)}
                      </div>
                      <div>
                        <p className="font-semibold">${payout.amount.toFixed(2)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(payout.period_start).toLocaleDateString()} -{" "}
                            {new Date(payout.period_end).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={getStatusColor(payout.status)}>
                        {payout.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {payout.order_count} orders
                      </p>
                    </div>
                  </div>
                  
                  {/* Commission breakdown */}
                  {payout.total_order_value > 0 && (
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-xs">
                      <div>
                        <p className="text-muted-foreground">Total Orders</p>
                        <p className="font-medium">${payout.total_order_value.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Commission ({payout.commission_rate.toFixed(1)}%)</p>
                        <p className="font-medium text-destructive">-${payout.commission_deducted.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Your Earnings</p>
                        <p className="font-medium text-green-600">${payout.amount.toFixed(2)}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Payout Information</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Payouts are processed weekly on Mondays. You'll receive your earnings
                  via bank transfer within 2-3 business days after processing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <PartnerNavigation />
    </div>
  );
};

export default PartnerPayouts;