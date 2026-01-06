import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp, Wallet, ChevronRight, Users } from "lucide-react";

interface Commission {
  id: string;
  tier: number;
  commission_amount: number;
  created_at: string;
  status: string;
}

export function AffiliateEarningsWidget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [recentCommissions, setRecentCommissions] = useState<Commission[]>([]);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchAffiliateData();
    }
  }, [user]);

  const fetchAffiliateData = async () => {
    try {
      // Fetch profile for balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("affiliate_balance, total_affiliate_earnings")
        .eq("user_id", user!.id)
        .single();

      if (profile) {
        setBalance(Number(profile.affiliate_balance) || 0);
        setTotalEarnings(Number(profile.total_affiliate_earnings) || 0);
      }

      // Fetch recent commissions
      const { data: commissions } = await supabase
        .from("affiliate_commissions")
        .select("id, tier, commission_amount, created_at, status")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (commissions) {
        setRecentCommissions(commissions);
      }

      // Fetch referral count
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("tier1_referrer_id", user!.id);

      setReferralCount(count || 0);
    } catch (error) {
      console.error("Error fetching affiliate data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  // Don't show widget if user has no affiliate activity
  if (totalEarnings === 0 && referralCount === 0 && recentCommissions.length === 0) {
    return null;
  }

  return (
    <Card className="animate-fade-in border-violet-500/30 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <p className="font-semibold">Affiliate Earnings</p>
              <p className="text-xs text-muted-foreground">Your commission balance</p>
            </div>
          </div>
          <Link to="/affiliate">
            <Button variant="ghost" size="sm" className="text-violet-500">
              View All <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-violet-500 mb-1">
              <Wallet className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold">{formatCurrency(balance)}</p>
            <p className="text-xs text-muted-foreground">Available</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-green-500 mb-1">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold">{formatCurrency(totalEarnings)}</p>
            <p className="text-xs text-muted-foreground">Total Earned</p>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-blue-500 mb-1">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold">{referralCount}</p>
            <p className="text-xs text-muted-foreground">Referrals</p>
          </div>
        </div>

        {/* Recent Commissions */}
        {recentCommissions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Commissions</p>
            <div className="space-y-2">
              {recentCommissions.map((commission) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-violet-500/10 text-violet-600 border-violet-500/30">
                      Tier {commission.tier}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(commission.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-semibold text-green-600">
                    +{formatCurrency(commission.commission_amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
