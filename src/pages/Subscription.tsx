import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Crown, 
  Zap, 
  Star, 
  ArrowLeft, 
  Loader2, 
  Sparkles,
  Calendar,
  Utensils,
  RotateCcw,
  Snowflake,
  Check,
  X,
  AlertCircle,
  Shield,
  Clock,
  RefreshCcw
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useRolloverCredits } from "@/hooks/useRolloverCredits";
import { useFreezeDaysRemaining } from "@/hooks/useSubscriptionFreeze";
import { supabase } from "@/integrations/supabase/client";
import { RolloverCreditsWidget } from "@/components/RolloverCreditsWidget";
import { FreezeSubscriptionModal } from "@/components/subscription/FreezeSubscriptionModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { format, differenceInDays, addDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SubscriptionPricing {
  basic_price: number;
  premium_price: number;
  family_price: number;
  vip_price: number;
}

interface PlanType {
  id: string;
  name: string;
  price: number;
  period: string;
  mealsPerMonth: number;
  tier: 'basic' | 'standard' | 'premium' | 'vip';
  description: string;
  icon: typeof Star;
  features: string[];
  popular: boolean;
  isVip: boolean;
  color: string;
}

const getPlans = (pricing: SubscriptionPricing): PlanType[] => [
  {
    id: "basic",
    name: "Basic",
    price: pricing.basic_price,
    period: "month",
    mealsPerMonth: 22,
    tier: 'basic',
    description: "Perfect for getting started",
    icon: Star,
    features: [
      "22 meals per month",
      "Basic nutrition tracking",
      "Email support",
      "Access to 50+ restaurants",
      "Weekly meal planning",
    ],
    popular: false,
    isVip: false,
    color: "from-slate-500 to-slate-600",
  },
  {
    id: "standard",
    name: "Standard",
    price: pricing.premium_price,
    period: "month",
    mealsPerMonth: 43,
    tier: 'standard',
    description: "Most popular choice",
    icon: Zap,
    features: [
      "43 meals per month",
      "Advanced nutrition analytics",
      "Priority support",
      "Access to all restaurants",
      "Custom meal planning",
      "Dietitian consultations",
      "Exclusive recipes",
    ],
    popular: true,
    isVip: false,
    color: "from-primary to-primary/80",
  },
  {
    id: "premium",
    name: "Premium",
    price: pricing.family_price,
    period: "month",
    mealsPerMonth: 65,
    tier: 'premium',
    description: "For serious fitness goals",
    icon: Crown,
    features: [
      "65 meals per month",
      "Real-time nutrition coaching",
      "24/7 priority support",
      "All restaurants + premium partners",
      "AI-powered meal recommendations",
      "Weekly dietitian sessions",
      "Personalized meal prep guides",
      "Family sharing (up to 4)",
    ],
    popular: false,
    isVip: false,
    color: "from-amber-500 to-amber-600",
  },
  {
    id: "vip",
    name: "VIP",
    price: pricing.vip_price,
    period: "month",
    mealsPerMonth: 0,
    tier: 'vip',
    description: "Unlimited meals",
    icon: Sparkles,
    features: [
      "♾️ Unlimited meals",
      "Everything in Premium",
      "🚀 Priority delivery",
      "🌟 Exclusive VIP-only meals",
      "👨‍⚕️ Personal nutrition coach",
      "📱 1-on-1 weekly coaching",
      "🏷️ Free delivery on all orders",
      "⚡ Early access to new restaurants",
      "💎 Dedicated VIP support",
      "🎁 Monthly wellness perks",
    ],
    popular: false,
    isVip: true,
    color: "from-violet-500 to-purple-600",
  },
];

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { 
    subscription, 
    loading, 
    hasActiveSubscription, 
    remainingMeals, 
    totalMeals, 
    mealsUsed,
    isUnlimited, 
    isVip,
    refetch 
  } = useSubscription();

  const [activeTab, setActiveTab] = useState("overview");
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch rollover credits
  const { data: rolloverInfo } = useRolloverCredits(subscription?.id);
  
  // Fetch freeze info
  const { data: freezeDays } = useFreezeDaysRemaining(subscription?.id);

  // Unified pricing - showing both weekly and monthly for transparency
  const pricing: SubscriptionPricing = {
    basic_price: 215, // ~49.99 * 4.3 (weekly to monthly conversion)
    premium_price: 430, // ~99.99 * 4.3
    family_price: 645, // ~149.99 * 4.3
    vip_price: 860, // ~199.99 * 4.3
  };

  const plans = getPlans(pricing);

  const handleUpgrade = async () => {
    if (!selectedPlan || !user || !subscription?.id) return;
    setIsProcessing(true);

    try {
      console.log("Updating subscription:", {
        subscriptionId: subscription.id,
        currentPlan: subscription.plan,
        newPlan: selectedPlan.tier,
        newMealsPerMonth: selectedPlan.mealsPerMonth,
      });

      // Update subscription plan in database
      const { data, error } = await supabase
        .from("subscriptions")
        .update({
          plan: selectedPlan.tier,
          tier: selectedPlan.tier,
          meals_per_month: selectedPlan.mealsPerMonth,
        })
        .eq("id", subscription.id)
        .select();

      console.log("Update result:", { data, error });

      if (error) {
        console.error("Error updating subscription:", error);
        toast({
          title: "Error",
          description: `Failed to update subscription: ${error.message}`,
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      if (data && data.length > 0) {
        toast({
          title: "Plan Updated",
          description: `Your subscription has been updated to ${selectedPlan.name} plan.`,
        });
        // Refresh subscription data without page reload
        await refetch();
        setShowUpgradeDialog(false);
        setSelectedPlan(null);
      } else {
        toast({
          title: "Error",
          description: "No rows were updated. Please check your permissions.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error in handleUpgrade:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    
    setIsProcessing(false);
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    
    // Cancel subscription in database
    if (subscription?.id) {
      // Calculate end of current billing period
      const currentEndDate = subscription.end_date 
        ? new Date(subscription.end_date)
        : addDays(new Date(), 30);
      
      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          status: "cancelled",
          active: false,
        })
        .eq("id", subscription.id);

      if (error) {
        console.error("Cancel error:", error);
        toast({
          title: "Error",
          description: `Failed to cancel subscription: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Subscription Cancelled",
          description: `Your subscription will remain active until ${format(currentEndDate, "MMM dd, yyyy")}. You can resubscribe anytime before then.`,
        });
        await refetch();
      }
    }
    
    setIsProcessing(false);
    setShowCancelDialog(false);
  };

  const handleReactivate = async () => {
    setIsProcessing(true);
    
    if (subscription?.id) {
      const { error } = await supabase
        .from("subscriptions")
        .update({ 
          status: "active",
          active: true,
        })
        .eq("id", subscription.id);

      if (error) {
        console.error("Reactivate error:", error);
        toast({
          title: "Error",
          description: `Failed to reactivate subscription: ${error.message}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Subscription Reactivated",
          description: "Your subscription has been successfully reactivated!",
        });
        await refetch();
      }
    }
    
    setIsProcessing(false);
  };

  // Calculate days remaining in cycle
  const daysRemaining = subscription?.month_start_date 
    ? 30 - differenceInDays(new Date(), new Date(subscription.month_start_date))
    : 30;

  const percentageUsed = totalMeals > 0 ? (mealsUsed / totalMeals) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If no active subscription, show plan selection
  if (!hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center px-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-4 text-xl font-semibold">Choose Your Plan</h1>
          </div>
        </header>

        <main className="container px-4 py-8 md:py-12">
          {/* Hero */}
          <div className="mx-auto max-w-3xl text-center mb-12">
            <Badge variant="secondary" className="mb-4">
              🎉 Start Your Journey
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Fuel Your Health Journey
            </h2>
            <p className="text-lg text-muted-foreground">
              Choose the perfect plan that fits your lifestyle and health goals.
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {plans.map((plan) => {
              const Icon = plan.icon;
              return (
                <Card
                  key={plan.id}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                    plan.popular
                      ? "border-primary shadow-lg scale-105 z-10"
                      : plan.isVip
                      ? "border-violet-500 shadow-lg shadow-violet-500/20"
                      : "hover:scale-102"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-bl-lg">
                      Most Popular
                    </div>
                  )}
                  {plan.isVip && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-3 py-1 text-xs font-semibold rounded-bl-lg flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      VIP Elite
                    </div>
                  )}

                  <CardHeader className="pb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="pb-4">
                    <div className="mb-4">
                      <span className="text-3xl sm:text-4xl font-bold">{formatCurrency(plan.price)}</span>
                      <span className="text-muted-foreground">/{plan.period}</span>
                    </div>
                    
                    <div className={`mb-6 p-3 rounded-lg ${plan.isVip ? 'bg-violet-500/10' : 'bg-primary/10'}`}>
                      <p className={`text-sm font-medium ${plan.isVip ? 'text-violet-600 dark:text-violet-400' : 'text-primary'}`}>
                        {plan.mealsPerMonth === 0 ? "♾️ Unlimited meals" : `🍽️ ${plan.mealsPerMonth} meals per month`}
                      </p>
                    </div>

                    <ul className="space-y-3">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Check className={`h-5 w-5 shrink-0 mt-0.5 ${plan.isVip ? 'text-violet-500' : 'text-primary'}`} />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className={`w-full ${plan.isVip ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700' : ''}`}
                      variant={plan.popular || plan.isVip ? "default" : "outline"}
                      size="lg"
                      onClick={() => navigate("/subscription/plans")}
                    >
                      Get Started
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="container flex h-16 items-center px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-4 text-xl font-semibold">My Subscription</h1>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-5xl mx-auto">
        {/* Current Plan Overview Card */}
        <Card className={`mb-6 ${isVip ? 'border-violet-500 shadow-lg shadow-violet-500/20' : ''}`}>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  isVip 
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600' 
                    : 'bg-gradient-to-br from-primary to-primary/80'
                }`}>
                  {isVip ? <Crown className="h-8 w-8 text-white" /> : <Zap className="h-8 w-8 text-white" />}
                </div>
                <div>
                  <CardTitle className="text-2xl capitalize">{subscription?.plan || 'Standard'} Plan</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span className="capitalize">{subscription?.tier || 'Standard'}</span>
                    <span className="text-muted-foreground">•</span>
                    {subscription?.status === 'cancelled' ? (
                      <Badge variant="destructive" className="text-xs">
                        Cancelled (until {subscription?.end_date ? format(new Date(subscription.end_date), "MMM dd") : 'end date'})
                      </Badge>
                    ) : (
                      <span className="capitalize">{subscription?.status}</span>
                    )}
                    {isVip && (
                      <Badge className="ml-2 bg-violet-100 text-violet-800">
                        <Sparkles className="w-3 h-3 mr-1" />
                        VIP
                      </Badge>
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">
                  {isUnlimited ? '∞' : remainingMeals}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isUnlimited ? 'Unlimited' : 'meals left'}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Usage Progress */}
            {!isUnlimited && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Meal Usage</span>
                  <span className="font-medium">{mealsUsed} of {totalMeals} used</span>
                </div>
                <Progress value={percentageUsed} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{Math.round(percentageUsed)}% used</span>
                  <span>{daysRemaining} days until reset</span>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{daysRemaining}</p>
                <p className="text-xs text-muted-foreground">Days Left</p>
              </div>
              
              <div className="p-3 bg-muted rounded-lg text-center">
                <Utensils className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{isUnlimited ? '∞' : totalMeals}</p>
                <p className="text-xs text-muted-foreground">Monthly Meals</p>
              </div>

              {rolloverInfo && rolloverInfo.rollover_credits > 0 && (
                <div className="p-3 bg-amber-50 rounded-lg text-center border border-amber-200">
                  <RotateCcw className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                  <p className="text-lg font-bold text-amber-600">{rolloverInfo.rollover_credits}</p>
                  <p className="text-xs text-amber-600">Rollover</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Different Sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Rollover Credits Widget */}
            <RolloverCreditsWidget />

            {/* Subscription Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Subscription Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium capitalize">{subscription?.plan || 'Standard'}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Status</span>
                  <Badge 
                    variant={subscription?.status === 'cancelled' ? "destructive" : (hasActiveSubscription ? "default" : "secondary")} 
                    className="capitalize"
                  >
                    {subscription?.status === 'cancelled' ? 'Cancelled (Active)' : subscription?.status}
                  </Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="font-medium">
                    {subscription?.start_date ? format(new Date(subscription.start_date), 'MMM dd, yyyy') : '-'}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">End Date</span>
                  <span className="font-medium">
                    {subscription?.end_date ? format(new Date(subscription.end_date), 'MMM dd, yyyy') : '-'}
                  </span>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Controls</CardTitle>
                <CardDescription>Manage your subscription status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Freeze Subscription */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-5 w-5 text-blue-600" />
                      <span className="font-medium">Freeze Subscription</span>
                    </div>
                    {freezeDays && (
                      <span className="text-2xl font-bold text-blue-600">
                        {freezeDays.remaining}/{freezeDays.total}
                      </span>
                    )}
                  </div>
                  {freezeDays && (
                    <>
                      <Progress 
                        value={((freezeDays.total - freezeDays.remaining) / freezeDays.total) * 100} 
                        className="h-2 mb-2"
                      />
                      <p className="text-xs text-muted-foreground mb-4">
                        {freezeDays.remaining} days remaining this cycle
                      </p>
                    </>
                  )}
                  {subscription?.id && (
                    <FreezeSubscriptionModal 
                      subscriptionId={subscription.id}
                      trigger={
                        <Button 
                          className="w-full" 
                          disabled={!freezeDays || freezeDays.remaining === 0}
                        >
                          <Snowflake className="h-4 w-4 mr-2" />
                          Schedule Freeze
                        </Button>
                      }
                    />
                  )}
                </div>

                <Separator />

                {/* Cancel / Reactivate */}
                {subscription?.status === 'cancelled' ? (
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <div className="flex items-start gap-3">
                      <RefreshCcw className="h-5 w-5 text-emerald-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-emerald-900">Reactivate Subscription</p>
                        <p className="text-sm text-emerald-700 mt-1">
                          Your subscription was cancelled. Reactivate to keep your plan and benefits.
                        </p>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleReactivate}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Reactivating...
                        </>
                      ) : (
                        <>
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Retrieve Plan
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-red-900">Cancel Subscription</p>
                        <p className="text-sm text-red-700 mt-1">
                          Cancel anytime. You'll keep access until the end of your billing period.
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 border-red-300 text-red-700 hover:bg-red-100"
                      onClick={() => setShowCancelDialog(true)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel Subscription
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Available Plans</h3>
              <p className="text-muted-foreground">Upgrade or change your plan anytime</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
               {plans.map((plan) => {
                const Icon = plan.icon;
                const isCurrentPlan = subscription?.tier === plan.tier;
                
                // Define tier order for comparison
                const tierOrder = { 'basic': 1, 'standard': 2, 'premium': 3, 'vip': 4 };
                const currentTier = subscription?.tier || 'basic';
                const currentTierRank = tierOrder[currentTier as keyof typeof tierOrder] || 1;
                const planTierRank = tierOrder[plan.tier];
                
                let buttonText = 'Upgrade';
                let buttonVariant: "default" | "outline" | "secondary" = "outline";
                
                if (isCurrentPlan) {
                  buttonText = 'Current Plan';
                  buttonVariant = "secondary";
                } else if (planTierRank < currentTierRank) {
                  buttonText = 'Downgrade';
                  buttonVariant = "outline";
                } else if (planTierRank > currentTierRank) {
                  buttonText = 'Upgrade';
                  buttonVariant = "default";
                }
                
                return (
                  <Card 
                    key={plan.id} 
                    className={`${isCurrentPlan ? 'border-primary ring-2 ring-primary/20' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                            <CardDescription>{plan.mealsPerMonth === 0 ? 'Unlimited' : `${plan.mealsPerMonth} meals/month`}</CardDescription>
                          </div>
                        </div>
                        {isCurrentPlan && (
                          <Badge>Current</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{formatCurrency(plan.price)}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                    </CardContent>
                    <CardFooter>
                      <Button 
                        variant={buttonVariant} 
                        className="w-full"
                        disabled={isCurrentPlan}
                        onClick={() => {
                          setSelectedPlan(plan);
                          setShowUpgradeDialog(true);
                        }}
                      >
                        {buttonText}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Upgrade/Downgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {(() => {
                if (!selectedPlan || !subscription) return 'Change Plan';
                const tierOrder = { 'basic': 1, 'standard': 2, 'premium': 3, 'vip': 4 };
                const currentRank = tierOrder[subscription.tier as keyof typeof tierOrder] || 1;
                const selectedRank = tierOrder[selectedPlan.tier];
                return selectedRank > currentRank ? 'Upgrade Subscription' : 'Downgrade Subscription';
              })()}
            </DialogTitle>
            <DialogDescription>
              {selectedPlan ? (() => {
                const tierOrder = { 'basic': 1, 'standard': 2, 'premium': 3, 'vip': 4 };
                const currentRank = tierOrder[subscription?.tier as keyof typeof tierOrder] || 1;
                const selectedRank = tierOrder[selectedPlan.tier];
                const action = selectedRank > currentRank ? 'Upgrade' : 'Downgrade';
                return `${action} to ${selectedPlan.name} plan`;
              })() : 'Select a plan to change'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="bg-muted rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{selectedPlan.name} Plan</span>
                <span className="font-bold">{formatCurrency(selectedPlan.price)}/month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedPlan.mealsPerMonth === 0 ? "Unlimited meals" : `${selectedPlan.mealsPerMonth} meals per month`}
              </p>
            </div>
          )}

          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Your plan change will take effect on your next billing cycle. You'll be charged the new rate starting then.
            </AlertDescription>
          </Alert>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={isProcessing || !selectedPlan}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                (() => {
                  if (!selectedPlan || !subscription) return 'Confirm';
                  const tierOrder = { 'basic': 1, 'standard': 2, 'premium': 3, 'vip': 4 };
                  const currentRank = tierOrder[subscription.tier as keyof typeof tierOrder] || 1;
                  const selectedRank = tierOrder[selectedPlan.tier];
                  return selectedRank > currentRank ? 'Confirm Upgrade' : 'Confirm Downgrade';
                })()
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel your subscription?
            </DialogDescription>
          </DialogHeader>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You'll lose access to all subscription benefits after your current billing period ends.
            </AlertDescription>
          </Alert>

          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">What happens when you cancel:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Your subscription remains active until {subscription?.end_date ? format(new Date(subscription.end_date), 'MMM dd, yyyy') : 'end of period'}</li>
              <li>You won't be charged again</li>
              <li>You can resubscribe anytime</li>
            </ul>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Keep Subscription
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
