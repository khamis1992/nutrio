import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AffiliateSettings {
  enabled: boolean;
  tier1_commission: number;
  tier2_commission: number;
  tier3_commission: number;
  min_payout_threshold: number;
  commission_type: string;
  bonus_first_referral: number;
  bonus_milestone_10: number;
  bonus_milestone_25: number;
  bonus_milestone_50: number;
}

interface AffiliateStats {
  totalEarnings: number;
  pendingBalance: number;
  availableBalance: number;
  tier1Referrals: number;
  tier2Referrals: number;
  tier3Referrals: number;
  currentTier: string;
  totalReferrals: number;
}

interface Commission {
  id: string;
  tier: number;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: string;
  created_at: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  requested_at: string;
  processed_at: string | null;
}

interface NetworkMember {
  id: string;
  full_name: string | null;
  created_at: string;
  tier: number;
  total_orders: number;
}

const defaultSettings: AffiliateSettings = {
  enabled: true,
  tier1_commission: 10,
  tier2_commission: 5,
  tier3_commission: 2,
  min_payout_threshold: 25,
  commission_type: "percentage",
  bonus_first_referral: 5,
  bonus_milestone_10: 20,
  bonus_milestone_25: 50,
  bonus_milestone_50: 100,
};

export function useAffiliateProgram() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AffiliateSettings>(defaultSettings);
  const [stats, setStats] = useState<AffiliateStats>({
    totalEarnings: 0,
    pendingBalance: 0,
    availableBalance: 0,
    tier1Referrals: 0,
    tier2Referrals: 0,
    tier3Referrals: 0,
    currentTier: "bronze",
    totalReferrals: 0,
  });
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [network, setNetwork] = useState<NetworkMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (user && settings.enabled) {
      fetchAffiliateData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, settings.enabled]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "affiliate_settings")
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        setSettings(data.value as unknown as AffiliateSettings);
      }
    } catch (err) {
      console.error("Error fetching affiliate settings:", err);
    }
  };

  const fetchAffiliateData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch profile with affiliate info
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("affiliate_balance, total_affiliate_earnings, affiliate_tier, referral_code")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch commissions
      const { data: commissionsData, error: commissionsError } = await supabase
        .from("affiliate_commissions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (commissionsError) throw commissionsError;

      // Fetch payouts
      const { data: payoutsData, error: payoutsError } = await supabase
        .from("affiliate_payouts")
        .select("*")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false });

      if (payoutsError) throw payoutsError;

      // Fetch referral network using RPC to bypass RLS
      const { data: networkData, error: networkError } = await supabase
        .rpc('get_affiliate_network', { p_referrer_id: user.id });

      if (networkError) {
        console.error("Error fetching network:", networkError);
      }

      // Calculate stats
      const pendingCommissions = commissionsData?.filter(c => c.status === "pending") || [];
      const approvedCommissions = commissionsData?.filter(c => c.status === "approved") || [];
      
      const pendingBalance = pendingCommissions.reduce((sum, c) => sum + Number(c.commission_amount), 0);
      const availableBalance = Number(profileData?.affiliate_balance || 0);

      // Build network
      const networkMembers: NetworkMember[] = (networkData || []).map(m => ({ 
        id: m.user_id,
        full_name: m.full_name,
        created_at: m.created_at,
        tier: m.tier,
        total_orders: 0 
      }));

      // Count referrals by tier
      const tier1Count = networkMembers.filter(m => m.tier === 1).length;
      const tier2Count = networkMembers.filter(m => m.tier === 2).length;
      const tier3Count = networkMembers.filter(m => m.tier === 3).length;

      setStats({
        totalEarnings: Number(profileData?.total_affiliate_earnings || 0),
        pendingBalance,
        availableBalance,
        tier1Referrals: tier1Count,
        tier2Referrals: tier2Count,
        tier3Referrals: tier3Count,
        currentTier: profileData?.affiliate_tier || "bronze",
        totalReferrals: networkMembers.length,
      });

      setCommissions(commissionsData || []);
      setPayouts(payoutsData || []);
      setNetwork(networkMembers);

    } catch (err) {
      console.error("Error fetching affiliate data:", err);
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async (amount: number, payoutMethod: string, payoutDetails: Record<string, string>) => {
    if (!user) return { success: false, error: "Not authenticated" };

    if (amount < settings.min_payout_threshold) {
      return { success: false, error: `Minimum payout is $${settings.min_payout_threshold}` };
    }

    if (amount > stats.availableBalance) {
      return { success: false, error: "Insufficient balance" };
    }

    try {
      const { error } = await supabase.from("affiliate_payouts").insert({
        user_id: user.id,
        amount,
        payout_method: payoutMethod,
        payout_details: payoutDetails,
      });

      if (error) throw error;

      // Deduct from balance
      await supabase
        .from("profiles")
        .update({ affiliate_balance: stats.availableBalance - amount })
        .eq("user_id", user.id);

      await fetchAffiliateData();
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
    }
  };

  const getTierInfo = (tier: string) => {
    const tiers = {
      bronze: { name: "Bronze", color: "from-amber-600 to-amber-700", minReferrals: 0, bonus: 0 },
      silver: { name: "Silver", color: "from-slate-400 to-slate-500", minReferrals: 5, bonus: 5 },
      gold: { name: "Gold", color: "from-yellow-400 to-yellow-500", minReferrals: 10, bonus: 10 },
      platinum: { name: "Platinum", color: "from-cyan-400 to-cyan-500", minReferrals: 25, bonus: 15 },
      diamond: { name: "Diamond", color: "from-violet-400 to-purple-500", minReferrals: 50, bonus: 20 },
    };
    return tiers[tier as keyof typeof tiers] || tiers.bronze;
  };

  const getNextTier = (currentTier: string) => {
    const tierOrder = ["bronze", "silver", "gold", "platinum", "diamond"];
    const currentIndex = tierOrder.indexOf(currentTier);
    return currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  };

  return {
    settings,
    stats,
    commissions,
    payouts,
    network,
    loading,
    requestPayout,
    getTierInfo,
    getNextTier,
    refetch: fetchAffiliateData,
  };
}
