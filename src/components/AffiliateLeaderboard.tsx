import { useState, useEffect } from "react";
import { Trophy, Medal, Users, TrendingUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";

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
      // Fetch top 10 by earnings using an edge function or RPC
      // Since we can't directly query other users' profiles, we use aggregate data
      const { data: earningsData, error: earningsError } = await supabase
        .rpc('get_affiliate_leaderboard_earnings', { limit_count: 10 });

      if (earningsError) {
        console.error("Error fetching earnings leaderboard:", earningsError);
      } else {
        setTopEarners(earningsData || []);
      }

      // Fetch top 10 by referral count
      const { data: referralsData, error: referralsError } = await supabase
        .rpc('get_affiliate_leaderboard_referrals', { limit_count: 10 });

      if (referralsError) {
        console.error("Error fetching referrals leaderboard:", referralsError);
      } else {
        setTopReferrers(referralsData || []);
      }

      // Get current user's rank
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
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'diamond':
        return 'from-cyan-400 to-blue-500';
      case 'platinum':
        return 'from-slate-300 to-slate-500';
      case 'gold':
        return 'from-yellow-400 to-amber-500';
      case 'silver':
        return 'from-gray-300 to-gray-400';
      default:
        return 'from-orange-400 to-orange-600';
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "??";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const maskName = (name: string | null) => {
    if (!name) return "Anonymous";
    const parts = name.split(" ");
    if (parts.length === 1) {
      return name[0] + "***";
    }
    return parts[0][0] + "*** " + parts[parts.length - 1][0] + "***";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const renderLeaderboardList = (entries: LeaderboardEntry[], type: 'earnings' | 'referrals') => {
    if (entries.length === 0) {
      return (
        <div className="py-8 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground">No leaderboard data yet</p>
          <p className="text-sm text-muted-foreground">Be the first to climb the ranks!</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {entries.map((entry, index) => {
          const isCurrentUser = user && entry.id === user.id;
          return (
            <div
              key={entry.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                isCurrentUser ? "bg-primary/10 border border-primary/20" : "bg-muted/50 hover:bg-muted"
              }`}
            >
              <div className="w-8 flex justify-center">
                {getRankIcon(index + 1)}
              </div>
              
              <Avatar className="h-10 w-10">
                <AvatarImage src={entry.avatar_url || undefined} />
                <AvatarFallback className={`bg-gradient-to-br ${getTierColor(entry.affiliate_tier)} text-white text-xs`}>
                  {getInitials(entry.full_name)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${isCurrentUser ? "text-primary" : ""}`}>
                  {isCurrentUser ? entry.full_name || "You" : maskName(entry.full_name)}
                  {isCurrentUser && <span className="text-xs text-primary ml-1">(You)</span>}
                </p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={`text-xs bg-gradient-to-r ${getTierColor(entry.affiliate_tier)} text-white border-0`}
                  >
                    {entry.affiliate_tier || "Bronze"}
                  </Badge>
                </div>
              </div>
              
              <div className="text-right">
                {type === 'earnings' ? (
                  <p className="font-bold text-green-600">{formatCurrency(entry.total_affiliate_earnings)}</p>
                ) : (
                  <p className="font-bold">{entry.referral_count} <span className="text-xs text-muted-foreground">referrals</span></p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
          {userRank && (
            <Badge variant="outline" className="text-xs">
              Your rank: #{userRank.earnings}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full">
          {/* iOS-style segment tabs */}
          <div className="bg-muted rounded-2xl p-1 flex gap-1 mb-4">
            {([
              { id: "earnings", label: "Top Earners", icon: TrendingUp },
              { id: "referrals", label: "Top Referrers", icon: Users },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === id
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {activeTab === "earnings" && renderLeaderboardList(topEarners, "earnings")}
          {activeTab === "referrals" && renderLeaderboardList(topReferrers, "referrals")}
        </div>
      </CardContent>
    </Card>
  );
}
