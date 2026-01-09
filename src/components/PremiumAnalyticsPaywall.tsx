import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown, TrendingUp, Users, BarChart3, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePremiumAnalyticsPrices } from "@/hooks/usePremiumAnalytics";
import { formatCurrency } from "@/lib/currency";

interface PremiumAnalyticsPaywallProps {
  restaurantId: string;
  partnerId: string;
  onPurchase: () => void;
}

const features = [
  { icon: TrendingUp, text: "30/60/90 day revenue trends" },
  { icon: Users, text: "Customer retention & repeat order analysis" },
  { icon: BarChart3, text: "Peak hours & day-of-week insights" },
  { icon: Crown, text: "Competitor benchmarking" },
];

export function PremiumAnalyticsPaywall({
  restaurantId,
  partnerId,
  onPurchase,
}: PremiumAnalyticsPaywallProps) {
  const { toast } = useToast();
  const { prices, loading: pricesLoading } = usePremiumAnalyticsPrices();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handlePurchase = async (packageType: "monthly" | "quarterly" | "yearly") => {
    setPurchasing(packageType);

    try {
      const price = prices[packageType];
      const now = new Date();
      let endsAt: Date;

      switch (packageType) {
        case "monthly":
          endsAt = new Date(now.setMonth(now.getMonth() + 1));
          break;
        case "quarterly":
          endsAt = new Date(now.setMonth(now.getMonth() + 3));
          break;
        case "yearly":
          endsAt = new Date(now.setFullYear(now.getFullYear() + 1));
          break;
      }

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from("premium_analytics_purchases")
        .insert({
          restaurant_id: restaurantId,
          partner_id: partnerId,
          package_type: packageType,
          price_paid: price,
          ends_at: endsAt.toISOString(),
        });

      if (purchaseError) throw purchaseError;

      // Update restaurant premium status
      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ premium_analytics_until: endsAt.toISOString() })
        .eq("id", restaurantId);

      if (updateError) throw updateError;

      toast({
        title: "Premium Analytics Activated!",
        description: `Your subscription is active until ${endsAt.toLocaleDateString()}`,
      });

      onPurchase();
    } catch (error) {
      console.error("Error purchasing premium:", error);
      toast({
        title: "Error",
        description: "Failed to process purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  const getDiscount = (packageType: "quarterly" | "yearly") => {
    const monthlyTotal = prices.monthly * (packageType === "quarterly" ? 3 : 12);
    const discount = ((monthlyTotal - prices[packageType]) / monthlyTotal) * 100;
    return Math.round(discount);
  };

  return (
    <div className="space-y-6">
      {/* Locked State Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Unlock Premium Analytics</h2>
              <p className="text-muted-foreground">
                Get deeper insights to grow your business
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Premium Features
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <feature.icon className="h-4 w-4 text-primary" />
              </div>
              <span>{feature.text}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pricing */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative">
          <CardHeader>
            <CardTitle className="text-lg">Monthly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-3xl font-bold">
                {formatCurrency(prices.monthly)}
              </span>
              <span className="text-muted-foreground">/month</span>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handlePurchase("monthly")}
              disabled={purchasing !== null || pricesLoading}
            >
              {purchasing === "monthly" ? "Processing..." : "Subscribe"}
            </Button>
          </CardContent>
        </Card>

        <Card className="relative border-primary">
          <Badge className="absolute -top-2 right-4">Popular</Badge>
          <CardHeader>
            <CardTitle className="text-lg">Quarterly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-3xl font-bold">
                {formatCurrency(prices.quarterly)}
              </span>
              <span className="text-muted-foreground">/3 months</span>
              <Badge variant="secondary" className="ml-2">
                Save {getDiscount("quarterly")}%
              </Badge>
            </div>
            <Button
              className="w-full"
              onClick={() => handlePurchase("quarterly")}
              disabled={purchasing !== null || pricesLoading}
            >
              {purchasing === "quarterly" ? "Processing..." : "Subscribe"}
            </Button>
          </CardContent>
        </Card>

        <Card className="relative">
          <Badge className="absolute -top-2 right-4" variant="secondary">
            Best Value
          </Badge>
          <CardHeader>
            <CardTitle className="text-lg">Yearly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-3xl font-bold">
                {formatCurrency(prices.yearly)}
              </span>
              <span className="text-muted-foreground">/year</span>
              <Badge variant="secondary" className="ml-2">
                Save {getDiscount("yearly")}%
              </Badge>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => handlePurchase("yearly")}
              disabled={purchasing !== null || pricesLoading}
            >
              {purchasing === "yearly" ? "Processing..." : "Subscribe"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
