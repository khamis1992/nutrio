import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Crown,
  Gift,
  Copy,
  Share2,
  Check,
  ChevronRight,
  Wallet,
  Clock,
  Network,
  Trophy,
  Star,
  Loader2,
  AlertTriangle,
  Building
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAffiliateProgram } from "@/hooks/useAffiliateProgram";
import { useProfile } from "@/hooks/useProfile";
import { formatCurrency } from "@/lib/currency";
import { CustomerNavigation } from "@/components/CustomerNavigation";

export default function Affiliate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { 
    settings, 
    stats, 
    commissions, 
    payouts, 
    network, 
    loading,
    requestPayout,
    getTierInfo,
    getNextTier 
  } = useAffiliateProgram();

  const [copied, setCopied] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank_transfer");
  const [payoutDetails, setPayoutDetails] = useState({ accountName: "", accountNumber: "", bankName: "" });
  const [processingPayout, setProcessingPayout] = useState(false);

  const referralCode = profile?.referral_code || "";
  const referralLink = `${window.location.origin}/auth?ref=${referralCode}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: "Copied!", description: "Referral link copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
    }
  };

  const shareReferral = async () => {
    const shareData = {
      title: "Join NUTRIO",
      text: `Join NUTRIO with my link and we both earn rewards!`,
      url: referralLink
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        copyToClipboard();
      }
    } catch (error) {
      // User cancelled
    }
  };

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    setProcessingPayout(true);
    const result = await requestPayout(amount, payoutMethod, payoutDetails);
    setProcessingPayout(false);

    if (result.success) {
      toast({ title: "Payout requested!", description: "Your payout request has been submitted." });
      setPayoutDialogOpen(false);
      setPayoutAmount("");
    } else {
      toast({ title: "Error", description: result.error, variant: "destructive" });
    }
  };

  const tierInfo = getTierInfo(stats.currentTier);
  const nextTier = getNextTier(stats.currentTier);
  const nextTierInfo = nextTier ? getTierInfo(nextTier) : null;

  const progressToNextTier = nextTierInfo 
    ? Math.min((stats.tier1Referrals / nextTierInfo.minReferrals) * 100, 100)
    : 100;

  if (!settings.enabled) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
          <div className="container max-w-2xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-semibold">Affiliate Program</h1>
            </div>
          </div>
        </header>
        <div className="container max-w-2xl mx-auto px-4 py-12">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Program Unavailable</h2>
              <p className="text-muted-foreground">The affiliate program is currently disabled.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Affiliate Program</h1>
              <p className="text-xs text-muted-foreground">Earn commissions from your network</p>
            </div>
            <Badge className={`bg-gradient-to-r ${tierInfo.color} border-0 text-white`}>
              <Crown className="w-3 h-3 mr-1" />
              {tierInfo.name}
            </Badge>
          </div>
        </div>
      </header>

      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Earnings Overview */}
        <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
              <p className="text-4xl font-bold text-primary">{formatCurrency(stats.totalEarnings)}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-background/80 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(stats.availableBalance)}</p>
              </div>
              <div className="bg-background/80 rounded-lg p-3 text-center">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-amber-600">{formatCurrency(stats.pendingBalance)}</p>
              </div>
            </div>

            <Button 
              className="w-full" 
              disabled={stats.availableBalance < settings.min_payout_threshold}
              onClick={() => setPayoutDialogOpen(true)}
            >
              <Wallet className="w-4 h-4 mr-2" />
              Request Payout
            </Button>
            {stats.availableBalance < settings.min_payout_threshold && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Minimum payout: {formatCurrency(settings.min_payout_threshold)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tier Progress */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Your Tier
              </CardTitle>
              <Badge className={`bg-gradient-to-r ${tierInfo.color} border-0 text-white`}>
                {tierInfo.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {nextTierInfo && (
              <>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progress to {nextTierInfo.name}</span>
                  <span className="font-medium">{stats.tier1Referrals}/{nextTierInfo.minReferrals} referrals</span>
                </div>
                <Progress value={progressToNextTier} className="h-2 mb-3" />
              </>
            )}
            
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-muted rounded-lg">
                <p className="font-bold text-lg">{stats.tier1Referrals}</p>
                <p className="text-muted-foreground">Tier 1</p>
                <p className="text-primary font-medium">{settings.tier1_commission}%</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="font-bold text-lg">{stats.tier2Referrals}</p>
                <p className="text-muted-foreground">Tier 2</p>
                <p className="text-primary font-medium">{settings.tier2_commission}%</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="font-bold text-lg">{stats.tier3Referrals}</p>
                <p className="text-muted-foreground">Tier 3</p>
                <p className="text-primary font-medium">{settings.tier3_commission}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Share & Earn
            </CardTitle>
            <CardDescription>
              Earn {settings.tier1_commission}% on direct referrals, {settings.tier2_commission}% on Tier 2, and {settings.tier3_commission}% on Tier 3
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 mb-4">
              <p className="text-sm text-muted-foreground mb-2">Your referral code</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-bold tracking-wider text-primary">
                  {referralCode}
                </span>
                <Button variant="ghost" size="icon" onClick={copyToClipboard} className="h-8 w-8">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Button variant="outline" className="flex-1" onClick={shareReferral}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="commissions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
          </TabsList>

          <TabsContent value="commissions" className="mt-4 space-y-3">
            {commissions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No commissions yet</p>
                  <p className="text-sm text-muted-foreground">Start sharing to earn!</p>
                </CardContent>
              </Card>
            ) : (
              commissions.map((commission) => (
                <Card key={commission.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          commission.tier === 1 ? "bg-primary/20" : 
                          commission.tier === 2 ? "bg-violet-500/20" : "bg-cyan-500/20"
                        }`}>
                          <Star className={`w-5 h-5 ${
                            commission.tier === 1 ? "text-primary" : 
                            commission.tier === 2 ? "text-violet-500" : "text-cyan-500"
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">Tier {commission.tier} Commission</p>
                          <p className="text-sm text-muted-foreground">
                            {commission.commission_rate}% of {formatCurrency(commission.order_amount)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">+{formatCurrency(commission.commission_amount)}</p>
                        <Badge variant={commission.status === "approved" ? "default" : "outline"} className="text-xs">
                          {commission.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="network" className="mt-4 space-y-3">
            {network.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No referrals in your network</p>
                  <p className="text-sm text-muted-foreground">Share your link to grow your network!</p>
                </CardContent>
              </Card>
            ) : (
              network.map((member) => (
                <Card key={member.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          member.tier === 1 ? "bg-primary/20" : 
                          member.tier === 2 ? "bg-violet-500/20" : "bg-cyan-500/20"
                        }`}>
                          <Users className={`w-5 h-5 ${
                            member.tier === 1 ? "text-primary" : 
                            member.tier === 2 ? "text-violet-500" : "text-cyan-500"
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">{member.full_name || "Anonymous"}</p>
                          <p className="text-sm text-muted-foreground">
                            Joined {new Date(member.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">Tier {member.tier}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="payouts" className="mt-4 space-y-3">
            {payouts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No payout history</p>
                  <p className="text-sm text-muted-foreground">Request your first payout when eligible!</p>
                </CardContent>
              </Card>
            ) : (
              payouts.map((payout) => (
                <Card key={payout.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-medium">{formatCurrency(payout.amount)}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {payout.payout_method.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          payout.status === "completed" ? "default" :
                          payout.status === "processing" ? "secondary" : "outline"
                        }>
                          {payout.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(payout.requested_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* How it Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How Multi-Tier Earning Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium">Tier 1 - Direct Referrals ({settings.tier1_commission}%)</p>
                <p className="text-sm text-muted-foreground">Earn on every order from people you directly refer</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-violet-500">2</span>
              </div>
              <div>
                <p className="font-medium">Tier 2 - Their Referrals ({settings.tier2_commission}%)</p>
                <p className="text-sm text-muted-foreground">Earn when your referrals refer others</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-cyan-500">3</span>
              </div>
              <div>
                <p className="font-medium">Tier 3 - Extended Network ({settings.tier3_commission}%)</p>
                <p className="text-sm text-muted-foreground">Earn from 3 levels deep in your network</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Payout</DialogTitle>
            <DialogDescription>
              Available balance: {formatCurrency(stats.availableBalance)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="method">Payout Method</Label>
              <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payoutMethod === "bank_transfer" && (
              <>
                <div>
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    value={payoutDetails.accountName}
                    onChange={(e) => setPayoutDetails({ ...payoutDetails, accountName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={payoutDetails.bankName}
                    onChange={(e) => setPayoutDetails({ ...payoutDetails, bankName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={payoutDetails.accountNumber}
                    onChange={(e) => setPayoutDetails({ ...payoutDetails, accountNumber: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestPayout} disabled={processingPayout}>
              {processingPayout ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Request Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerNavigation />
    </div>
  );
}
