import { useState, useEffect } from "react";
import { Trophy, Medal, Users, TrendingUp, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface LeaderboardEntry {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  total_affiliate_earnings: number;
  affiliate_tier: string;
  referral_count: number;
}

export function AffiliateLeaderboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"earnings" | "referrals">("earnings");
  const [topEarners, setTopEarners] = useState<LeaderboardEntry[]>([]);
  const [topReferrers, setTopReferrers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRank, setUserRank] = useState<{ earnings: number; referrals: number } | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [user]);

  const fetchLeaderboard = async () => {
    try {
      const { data: earningsData, error: earningsError } = await supabase
        .rpc('get_affiliate_leaderboard_earnings', { limit_count: 10 });
      if (earningsError) {
        console.error("Error fetching earnings leaderboard:", earningsError);
      } else {
        setTopEarners(earningsData || []);
      }

      const { data: referralsData, error: referralsError } = await supabase
        .rpc('get_affiliate_leaderboard_referrals', { limit_count: 10 });
      if (referralsError) {
        console.error("Error fetching referrals leaderboard:", referralsError);
      } else {
        setTopReferrers(referralsData || []);
      }

      if (user) {
        const { data: rankData } = await supabase
          .rpc('get_user_affiliate_rank', { user_uuid: user.id });
        if (rankData && rankData.length > 0) {
          setUserRank(rankData[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-4 h-4 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-4 h-4 text-slate-400" />;
    if (rank === 3) return <Medal className="w-4 h-4 text-amber-600" />;
    return (
      <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-muted-foreground">
        {rank}
      </span>
    );
  };

  const getTierGradient = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case "diamond": return "from-cyan-400 to-blue-500";
      case "platinum": return "from-slate-300 to-slate-500";
      case "gold": return "from-yellow-400 to-amber-500";
      case "silver": return "from-gray-300 to-gray-400";
      default: return "from-orange-400 to-orange-600";
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const maskName = (name: string | null) => {
    if (!name) return t("affiliate_anonymous");
    const parts = name.split(" ");
    if (parts.length === 1) return name[0] + "***";
    return parts[0][0] + "*** " + parts[parts.length - 1][0] + "***";
  };

  const renderList = (entries: LeaderboardEntry[], type: "earnings" | "referrals") => {
    if (entries.length === 0) {
      return (
        <div className="flex flex-col items-center py-10 gap-3">
          <div className="w-14 h-14 rounded-3xl bg-muted flex items-center justify-center">
            <Users className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground">{t("affiliate_no_leaderboard_data")}</p>
          <p className="text-sm text-muted-foreground">{t("affiliate_be_first_climb")}</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {entries.map((entry, index) => {
          const isCurrentUser = user && entry.id === user.id;
          const rank = index + 1;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all ${
                isCurrentUser
                  ? "bg-primary/8 border border-primary/20"
                  : rank <= 3
                  ? "bg-amber-500/5 border border-amber-500/10"
                  : "bg-muted/40 border border-transparent"
              }`}
            >
              {/* Rank */}
              <div className="w-6 flex justify-center shrink-0">{getRankIcon(rank)}</div>

              {/* Avatar */}
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={entry.avatar_url || undefined} />
                <AvatarFallback
                  className={`bg-gradient-to-br ${getTierGradient(entry.affiliate_tier)} text-white text-xs font-bold`}
                >
                  {getInitials(entry.full_name)}
                </AvatarFallback>
              </Avatar>

              {/* Name + tier */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate ${isCurrentUser ? "text-primary" : "text-foreground"}`}>
                  {isCurrentUser ? entry.full_name || t("you") : maskName(entry.full_name)}
                  {isCurrentUser && (
                    <span className="text-xs text-primary/70 ml-1">({t("you")})</span>
                  )}
                </p>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${getTierGradient(entry.affiliate_tier)} text-white`}
                >
                  {entry.affiliate_tier || "Bronze"}
                </span>
              </div>

              {/* Value */}
              <div className="text-right shrink-0">
                {type === "earnings" ? (
                  <p className="font-bold text-sm text-green-600">
                    {formatCurrency(entry.total_affiliate_earnings)}
                  </p>
                ) : (
                  <p className="font-bold text-sm text-foreground">
                    {entry.referral_count}{" "}
                    <span className="text-xs text-muted-foreground font-normal">{t("referrals")}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-card/95 rounded-3xl border border-border/70 shadow-md p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Trophy className="h-4.5 w-4.5 text-amber-500" />
          </div>
          <p className="font-bold text-foreground">{t("affiliate_leaderboard")}</p>
        </div>
        {userRank && (
          <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-full">
            #{userRank.earnings} {t("affiliate_your_rank")}
          </span>
        )}
      </div>

      {/* Segmented control */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="bg-muted/80 rounded-2xl p-1 flex gap-1">
            {([
              { id: "earnings" as const, label: t("affiliate_top_earners"), icon: TrendingUp },
              { id: "referrals" as const, label: t("affiliate_top_referrers"), icon: Users },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all touch-manipulation ${
                  activeTab === id
                    ? "bg-card text-foreground shadow-sm ring-1 ring-black/5"
                    : "text-muted-foreground active:bg-muted/70"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "earnings" && renderList(topEarners, "earnings")}
          {activeTab === "referrals" && renderList(topReferrers, "referrals")}
        </>
      )}
    </div>
  );
}
