import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { TrendingUp, Wallet, Users, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Commission {
  id: string;
  tier: number;
  commission_amount: number;
  created_at: string;
  status: string;
}

export function AffiliateEarningsWidget() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [recentCommissions, setRecentCommissions] = useState<Commission[]>([]);
  const [referralCount, setReferralCount] = useState(0);

  const fetchAffiliateData = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("affiliate_balance, total_affiliate_earnings")
        .eq("user_id", user!.id)
        .single();

      if (profile) {
        setBalance(Number(profile.affiliate_balance) || 0);
        setTotalEarnings(Number(profile.total_affiliate_earnings) || 0);
      }

      const { data: commissions } = await supabase
        .from("affiliate_commissions")
        .select("id, tier, commission_amount, created_at, status")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (commissions) setRecentCommissions(commissions);

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
  }, [user]);

  useEffect(() => {
    if (user) fetchAffiliateData();
  }, [fetchAffiliateData, user]);

  if (loading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  if (totalEarnings === 0 && referralCount === 0 && recentCommissions.length === 0) return null;

  const stats = [
    { icon: Wallet, color: "text-violet-500", label: t("available"), value: formatCurrency(balance) },
    { icon: TrendingUp, color: "text-green-500", label: t("total_earned"), value: formatCurrency(totalEarnings) },
    { icon: Users, color: "text-blue-500", label: t("referrals"), value: String(referralCount) },
  ];

  return (
    <>
      {/* Stats Row */}
      <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <p className="text-sm font-semibold">{t("affiliate_earnings")}</p>
          </div>
          <button
            onClick={() => navigate("/affiliate")}
            className="flex items-center gap-0.5 text-xs text-violet-600 font-medium"
          >
            {t("view_all")}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border/50">
          {stats.map(({ icon: Icon, color, label, value }) => (
            <div key={label} className="flex flex-col items-center py-3 px-2">
              <Icon className={cn("w-4 h-4 mb-1", color)} />
              <p className="text-sm font-bold leading-tight">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Commissions */}
      {recentCommissions.length > 0 && (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1">{t("recent_commissions")}</p>
          <div className="bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50">
            {recentCommissions.map((commission, idx, arr) => (
              <div key={commission.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t(`affiliate_tier${commission.tier}_label` as string)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(commission.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">+{formatCurrency(commission.commission_amount)}</span>
                </div>
                {idx < arr.length - 1 && <div className="h-px bg-border/60 ml-[52px]" />}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
