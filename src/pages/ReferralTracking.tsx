import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  Award,
  Loader2,
  Search,
  Filter,
  ArrowUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { CustomerNavigation } from "@/components/CustomerNavigation";

interface ReferralDetail {
  id: string;
  user_id: string;
  full_name: string | null;
  created_at: string;
  tier: number;
  total_orders: number;
  total_spent: number;
  commissions_earned: number;
  last_order_date: string | null;
  is_active: boolean;
}

export default function ReferralTracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [referrals, setReferrals] = useState<ReferralDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [expandedReferral, setExpandedReferral] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeReferrals: 0,
    totalCommissions: 0,
    avgOrderValue: 0,
  });

  useEffect(() => {
    if (user) {
      fetchReferralDetails();
    }
  }, [user]);

  const fetchReferralDetails = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch tier 1 referrals
      const { data: tier1Data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, created_at")
        .eq("tier1_referrer_id", user.id);

      // Fetch tier 2 referrals
      const { data: tier2Data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, created_at")
        .eq("tier2_referrer_id", user.id);

      // Fetch tier 3 referrals
      const { data: tier3Data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, created_at")
        .eq("tier3_referrer_id", user.id);

      // Fetch commissions for earnings calculations
      const { data: commissionsData } = await supabase
        .from("affiliate_commissions")
        .select("source_user_id, commission_amount, order_amount, created_at")
        .eq("user_id", user.id);

      // Build detailed referral data
      const allReferrals = [
        ...(tier1Data || []).map(r => ({ ...r, tier: 1 })),
        ...(tier2Data || []).map(r => ({ ...r, tier: 2 })),
        ...(tier3Data || []).map(r => ({ ...r, tier: 3 })),
      ];

      // Aggregate commission data per referral
      const commissionsByUser = (commissionsData || []).reduce((acc, c) => {
        const userId = c.source_user_id;
        if (!acc[userId]) {
          acc[userId] = { 
            total: 0, 
            orderCount: 0, 
            totalSpent: 0, 
            lastOrderDate: null as string | null 
          };
        }
        acc[userId].total += Number(c.commission_amount);
        acc[userId].orderCount += 1;
        acc[userId].totalSpent += Number(c.order_amount);
        if (!acc[userId].lastOrderDate || c.created_at > acc[userId].lastOrderDate) {
          acc[userId].lastOrderDate = c.created_at;
        }
        return acc;
      }, {} as Record<string, { total: number; orderCount: number; totalSpent: number; lastOrderDate: string | null }>);

      // Create detailed referral objects
      const detailedReferrals: ReferralDetail[] = allReferrals.map(r => {
        const userCommissions = commissionsByUser[r.user_id] || { 
          total: 0, 
          orderCount: 0, 
          totalSpent: 0, 
          lastOrderDate: null 
        };
        
        // Consider active if ordered in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const isActive = userCommissions.lastOrderDate 
          ? new Date(userCommissions.lastOrderDate) > thirtyDaysAgo 
          : false;

        return {
          id: r.id,
          user_id: r.user_id,
          full_name: r.full_name,
          created_at: r.created_at,
          tier: r.tier,
          total_orders: userCommissions.orderCount,
          total_spent: userCommissions.totalSpent,
          commissions_earned: userCommissions.total,
          last_order_date: userCommissions.lastOrderDate,
          is_active: isActive,
        };
      });

      // Calculate stats
      const totalCommissions = detailedReferrals.reduce((sum, r) => sum + r.commissions_earned, 0);
      const totalSpent = detailedReferrals.reduce((sum, r) => sum + r.total_spent, 0);
      const totalOrders = detailedReferrals.reduce((sum, r) => sum + r.total_orders, 0);

      setStats({
        totalReferrals: detailedReferrals.length,
        activeReferrals: detailedReferrals.filter(r => r.is_active).length,
        totalCommissions,
        avgOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0,
      });

      setReferrals(detailedReferrals);
    } catch (err) {
      console.error("Error fetching referral details:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort referrals
  const filteredReferrals = referrals
    .filter(r => {
      const matchesSearch = !searchQuery || 
        (r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTier = tierFilter === "all" || r.tier === parseInt(tierFilter);
      return matchesSearch && matchesTier;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "most-orders":
          return b.total_orders - a.total_orders;
        case "highest-earnings":
          return b.commissions_earned - a.commissions_earned;
        case "most-spent":
          return b.total_spent - a.total_spent;
        default:
          return 0;
      }
    });

  const getTierBadgeColor = (tier: number) => {
    switch (tier) {
      case 1: return "bg-primary text-primary-foreground";
      case 2: return "bg-violet-500 text-white";
      case 3: return "bg-cyan-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 rtl:flex-row-reverse">
            <Button variant="ghost" size="icon" onClick={() => navigate("/affiliate")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Referral Tracking</h1>
              <p className="text-xs text-muted-foreground">Detailed stats for your referrals</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.totalReferrals}</p>
              <p className="text-xs text-muted-foreground">Total Referrals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{stats.activeReferrals}</p>
              <p className="text-xs text-muted-foreground">Active (30 days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{formatCurrency(stats.totalCommissions)}</p>
              <p className="text-xs text-muted-foreground">Total Earnings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ShoppingBag className="h-6 w-6 text-violet-500 mx-auto mb-2" />
              <p className="text-2xl font-bold">{formatCurrency(stats.avgOrderValue)}</p>
              <p className="text-xs text-muted-foreground">Avg Order Value</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="1">{t("affiliate_tier1_label")}</SelectItem>
                  <SelectItem value="2">{t("affiliate_tier2_label")}</SelectItem>
                  <SelectItem value="3">{t("affiliate_tier3_label")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="flex-1">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="most-orders">Most Orders</SelectItem>
                  <SelectItem value="highest-earnings">Highest Earnings</SelectItem>
                  <SelectItem value="most-spent">Most Spent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Referrals List */}
        <div className="space-y-3">
          {filteredReferrals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground font-medium">No referrals found</p>
                <p className="text-sm text-muted-foreground">
                  {referrals.length === 0 
                    ? "Start sharing your link to build your network!" 
                    : "Try adjusting your filters"}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredReferrals.map((referral) => (
              <Collapsible
                key={referral.id}
                open={expandedReferral === referral.id}
                onOpenChange={(open) => setExpandedReferral(open ? referral.id : null)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            referral.tier === 1 ? "bg-primary/20" : 
                            referral.tier === 2 ? "bg-violet-500/20" : "bg-cyan-500/20"
                          }`}>
                            <User className={`w-5 h-5 ${
                              referral.tier === 1 ? "text-primary" : 
                              referral.tier === 2 ? "text-violet-500" : "text-cyan-500"
                            }`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{referral.full_name || "Anonymous"}</p>
                              {referral.is_active && (
                                <span className="w-2 h-2 rounded-full bg-green-500" title="Active" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Joined {new Date(referral.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-bold text-green-600">
                              {formatCurrency(referral.commissions_earned)}
                            </p>
                            <Badge className={getTierBadgeColor(referral.tier)}>
                              Tier {referral.tier}
                            </Badge>
                          </div>
                          {expandedReferral === referral.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 border-t border-border">
                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <ShoppingBag className="h-4 w-4" />
                            <span>Total Orders</span>
                          </div>
                          <p className="font-semibold text-lg">{referral.total_orders}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <DollarSign className="h-4 w-4" />
                            <span>Total Spent</span>
                          </div>
                          <p className="font-semibold text-lg">{formatCurrency(referral.total_spent)}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Award className="h-4 w-4" />
                            <span>Your Earnings</span>
                          </div>
                          <p className="font-semibold text-lg text-green-600">
                            {formatCurrency(referral.commissions_earned)}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Clock className="h-4 w-4" />
                            <span>Last Order</span>
                          </div>
                          <p className="font-semibold text-lg">
                            {referral.last_order_date 
                              ? new Date(referral.last_order_date).toLocaleDateString()
                              : "Never"}
                          </p>
                        </div>
                      </div>
                      
                      {/* Status indicator */}
                      <div className="mt-4 p-3 rounded-lg bg-muted">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Status</span>
                          <Badge variant={referral.is_active ? "default" : "outline"}>
                            {referral.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {referral.is_active 
                            ? "This referral has ordered in the last 30 days"
                            : "No orders in the last 30 days"}
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))
          )}
        </div>

        {/* Summary by Tier */}
        {referrals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Breakdown by Tier</CardTitle>
              <CardDescription>Commission summary per tier level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3].map(tier => {
                const tierReferrals = referrals.filter(r => r.tier === tier);
                const tierEarnings = tierReferrals.reduce((sum, r) => sum + r.commissions_earned, 0);
                const tierOrders = tierReferrals.reduce((sum, r) => sum + r.total_orders, 0);
                
                return (
                  <div key={tier} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={getTierBadgeColor(tier)}>Tier {tier}</Badge>
                      <div>
                        <p className="font-medium">{tierReferrals.length} referrals</p>
                        <p className="text-xs text-muted-foreground">{tierOrders} orders</p>
                      </div>
                    </div>
                    <p className="font-bold text-green-600">{formatCurrency(tierEarnings)}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <CustomerNavigation />
    </div>
  );
}
