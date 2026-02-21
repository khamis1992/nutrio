import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Crown, Zap, Star, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  mealsPerWeek: number;
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
    period: "week",
    mealsPerWeek: 5,
    tier: 'basic',
    description: "Perfect for getting started with healthy eating",
    icon: Star,
    features: [
      "5 meals per week",
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
    period: "week",
    mealsPerWeek: 10,
    tier: 'standard',
    description: "Most popular choice for health enthusiasts",
    icon: Zap,
    features: [
      "10 meals per week",
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
    period: "week",
    mealsPerWeek: 15,
    tier: 'premium',
    description: "Ultimate plan for serious fitness goals",
    icon: Crown,
    features: [
      "15 meals per week",
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
    period: "week",
    mealsPerWeek: 0,
    tier: 'vip',
    description: "Unlimited meals for the ultimate experience",
    icon: Sparkles,
    features: [
      "♾️ Unlimited meals per week",
      "Everything in Premium",
      "🚀 Priority delivery (always first)",
      "🌟 Exclusive VIP-only meals",
      "👨‍⚕️ Personal nutrition coach",
      "📱 1-on-1 weekly coaching calls",
      "🏷️ Free delivery on all orders",
      "⚡ Early access to new restaurants",
      "💎 Dedicated VIP support line",
      "🎁 Monthly wellness perks & gifts",
      "👥 Family sharing (up to 6)",
    ],
    popular: false,
    isVip: true,
    color: "from-violet-500 to-purple-600",
  },
];

export default function Subscription() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loadingPricing, setLoadingPricing] = useState(true);
  const [pricing, setPricing] = useState<SubscriptionPricing>({
    basic_price: 49.99,
    premium_price: 99.99,
    family_price: 149.99,
    vip_price: 199.99,
  });
  const [selectedPlan, setSelectedPlan] = useState<ReturnType<typeof getPlans>[0] | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvc: "",
    name: "",
  });

  useEffect(() => {
    // Use default pricing - skip database query to avoid errors
    setPricing({
      basic_price: 49.99,
      premium_price: 99.99,
      family_price: 149.99,
      vip_price: 199.99,
    });
    setLoadingPricing(false);
  }, []);

  const plans = getPlans(pricing);

  const handleSelectPlan = (plan: typeof plans[0]) => {
    setSelectedPlan(plan);
    setIsPaymentOpen(true);
  };

  const handleDemoPayment = async () => {
    if (!user || !selectedPlan) return;

    setIsProcessing(true);

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Create subscription in database
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // Weekly subscription

    // Map plan id to subscription plan enum
    const planMapping: Record<string, "weekly" | "monthly"> = {
      basic: "weekly",
      standard: "weekly",
      premium: "weekly",
      vip: "weekly",
    };

    const { error } = await supabase.from("subscriptions").insert({
      user_id: user.id,
      plan: planMapping[selectedPlan.id],
      price: selectedPlan.price,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: "active",
      stripe_subscription_id: `demo_${Date.now()}`, // Demo ID
      meals_per_week: selectedPlan.mealsPerWeek,
      meals_used_this_week: 0,
      week_start_date: startDate.toISOString().split('T')[0],
      tier: selectedPlan.tier,
    });

    setIsProcessing(false);
    setIsPaymentOpen(false);

    if (error) {
      toast({
        title: "Subscription failed",
        description: "There was an error processing your subscription.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Subscription successful!",
        description: `You're now subscribed to the ${selectedPlan.name} plan with ${selectedPlan.mealsPerWeek === 0 ? 'unlimited' : selectedPlan.mealsPerWeek} meals per week.`,
      });
      navigate("/dashboard");
    }
  };

  if (loadingPricing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

      <main className="container px-4 py-8 md:py-12">{/* Hero */}
        <div className="mx-auto max-w-3xl text-center mb-12">
          <Badge variant="secondary" className="mb-4">
            🎉 Demo Mode - No Real Charges
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Fuel Your Health Journey
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the perfect plan that fits your lifestyle and health goals.
            All plans include free delivery and no commitment.
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
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center mb-4`}
                  >
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
                      {plan.mealsPerWeek === 0 ? "♾️ Unlimited meals" : `🍽️ ${plan.mealsPerWeek} meals per week`}
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
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {plan.isVip ? "Go VIP" : "Get Started"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-2xl mx-auto text-center">
          <h3 className="text-xl font-semibold mb-4">Questions?</h3>
          <p className="text-muted-foreground">
            All plans include a 7-day money-back guarantee. Cancel anytime with
            no hidden fees. Contact our support team for any questions.
          </p>
        </div>
      </main>

      {/* Demo Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demo Payment</DialogTitle>
            <DialogDescription>
              This is a demo checkout. No real charges will be made.
              Enter any card details to simulate the payment.
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">{selectedPlan.name} Plan</span>
                <span className="font-bold">{formatCurrency(selectedPlan.price)}/week</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedPlan.mealsPerWeek === 0 ? "Unlimited meals" : `${selectedPlan.mealsPerWeek} meals per week`}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Cardholder Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={cardDetails.name}
                onChange={(e) =>
                  setCardDetails({ ...cardDetails, name: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="card">Card Number</Label>
              <Input
                id="card"
                placeholder="4242 4242 4242 4242"
                value={cardDetails.number}
                onChange={(e) =>
                  setCardDetails({ ...cardDetails, number: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={cardDetails.expiry}
                  onChange={(e) =>
                    setCardDetails({ ...cardDetails, expiry: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cvc">CVC</Label>
                <Input
                  id="cvc"
                  placeholder="123"
                  value={cardDetails.cvc}
                  onChange={(e) =>
                    setCardDetails({ ...cardDetails, cvc: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsPaymentOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleDemoPayment} disabled={isProcessing}>
              {isProcessing ? "Processing..." : "Pay Now (Demo)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
