import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Users, Copy, Share2, Check, Trophy, Clock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface ReferralStats {
  totalInvites: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
}

interface Referral {
  id: string;
  referred_id: string | null;
  status: string;
  reward_earned: number;
  created_at: string;
  completed_at: string | null;
  referred_name?: string;
}

const REWARD_PER_REFERRAL = 10; // $10 credit per successful referral

const Referral = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats>({
    totalInvites: 0,
    completedReferrals: 0,
    pendingReferrals: 0,
    totalRewardsEarned: 0
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchReferralData();
    }
  }, [user]);

  const fetchReferralData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);

      // Fetch user's referral code from profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("referral_code, referral_rewards_earned")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      let code = profileData?.referral_code;
      
      // If no code exists, generate one
      if (!code) {
        code = generateCode();
        await supabase
          .from("profiles")
          .update({ referral_code: code })
          .eq("user_id", user.id);
      }
      
      setReferralCode(code);

      // Fetch referrals
      const { data: referralsData, error: referralsError } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      if (referralsError) throw referralsError;

      setReferrals(referralsData || []);

      // Calculate stats
      const completed = referralsData?.filter(r => r.status === "completed") || [];
      const pending = referralsData?.filter(r => r.status === "pending") || [];
      
      setStats({
        totalInvites: referralsData?.length || 0,
        completedReferrals: completed.length,
        pendingReferrals: pending.length,
        totalRewardsEarned: profileData?.referral_rewards_earned || 0
      });

    } catch (error) {
      console.error("Error fetching referral data:", error);
      toast({
        title: "Error",
        description: "Failed to load referral data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  };

  const getReferralLink = () => {
    return `${window.location.origin}/auth?ref=${referralCode}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getReferralLink());
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard"
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive"
      });
    }
  };

  const shareReferral = async () => {
    const shareData = {
      title: "Join NUTRIO",
      text: `Use my referral code ${referralCode} to get $${REWARD_PER_REFERRAL} off your first order on NUTRIO!`,
      url: getReferralLink()
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copyToClipboard();
      }
    } catch (error) {
      // User cancelled share
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Completed</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-500/30">Pending</Badge>;
      case "expired":
        return <Badge variant="outline" className="text-muted-foreground">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Refer Friends</h1>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Hero Section */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
              <Gift className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Give ${REWARD_PER_REFERRAL}, Get ${REWARD_PER_REFERRAL}</h2>
            <p className="text-muted-foreground mb-6">
              Invite friends to NUTRIO. They get ${REWARD_PER_REFERRAL} off their first order, 
              and you earn ${REWARD_PER_REFERRAL} credit when they subscribe!
            </p>

            {/* Referral Code Box */}
            <div className="bg-background rounded-lg p-4 border border-border mb-4">
              <p className="text-sm text-muted-foreground mb-2">Your referral code</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-bold tracking-wider text-primary">
                  {referralCode}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={copyToClipboard}
                  className="h-8 w-8"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex gap-3">
              <Button 
                className="flex-1"
                onClick={copyToClipboard}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={shareReferral}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{stats.completedReferrals}</p>
              <p className="text-sm text-muted-foreground">Friends Joined</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Trophy className="h-6 w-6 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold">${stats.totalRewardsEarned}</p>
              <p className="text-sm text-muted-foreground">Rewards Earned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.pendingReferrals}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <UserPlus className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.totalInvites}</p>
              <p className="text-sm text-muted-foreground">Total Invites</p>
            </CardContent>
          </Card>
        </div>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How it Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium">Share your code</p>
                <p className="text-sm text-muted-foreground">Send your unique referral link to friends</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium">Friend signs up</p>
                <p className="text-sm text-muted-foreground">They get ${REWARD_PER_REFERRAL} off their first order</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">3</span>
              </div>
              <div>
                <p className="font-medium">You earn rewards</p>
                <p className="text-sm text-muted-foreground">Get ${REWARD_PER_REFERRAL} credit when they subscribe</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral History */}
        {referrals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Referral History</CardTitle>
              <CardDescription>Track your invitations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {referrals.map((referral) => (
                <div 
                  key={referral.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {referral.referred_id ? "Friend Joined" : "Invite Sent"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(referral.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(referral.status)}
                    {referral.status === "completed" && (
                      <p className="text-sm text-green-600 mt-1">+${referral.reward_earned}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {referrals.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No referrals yet</p>
              <p className="text-sm text-muted-foreground">Share your code to start earning rewards!</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border">
        <div className="container max-w-2xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/dashboard")}>
              <Gift className="h-5 w-5" />
              <span className="text-xs mt-1">Home</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/meals")}>
              <Gift className="h-5 w-5" />
              <span className="text-xs mt-1">Meals</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2 text-primary" onClick={() => navigate("/referral")}>
              <Gift className="h-5 w-5" />
              <span className="text-xs mt-1">Refer</span>
            </Button>
            <Button variant="ghost" className="flex-col h-auto py-2" onClick={() => navigate("/profile")}>
              <Users className="h-5 w-5" />
              <span className="text-xs mt-1">Profile</span>
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Referral;
