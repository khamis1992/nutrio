import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Lock,
  Crown,
  TrendingUp,
  AlertTriangle,
  Check,
  X,
  Minus,
  ChevronRight,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePremiumAnalyticsPrices } from "@/hooks/usePremiumAnalytics";
import { formatCurrency } from "@/lib/currency";

interface PremiumAnalyticsPaywallProps {
  restaurantId: string;
  partnerId: string;
  onPurchase: () => void;
  hasPendingRequest?: boolean;
}

// ── Comparison table data ─────────────────────────────────────────────────────

const comparisonRows = [
  { feature: "Revenue & order totals", basic: true, premium: true },
  { feature: "Top meals ranking", basic: true, premium: true },
  { feature: "Meal type distribution", basic: true, premium: true },
  { feature: "7-day trend charts", basic: true, premium: true },
  { feature: "30-day revenue trend", basic: false, premium: true },
  { feature: "Revenue forecast (next 30 days)", basic: false, premium: true },
  { feature: "Churn Alert — at-risk customers", basic: false, premium: true },
  { feature: "Customer Segments (Champions / At Risk)", basic: false, premium: true },
  { feature: "Menu Performance Matrix", basic: false, premium: true },
  { feature: "Profitability per meal (net after fee)", basic: false, premium: true },
  { feature: "14-Day Demand Forecast Calendar", basic: false, premium: true },
  { feature: "Peak ordering hours", basic: false, premium: true },
  { feature: "Day-of-week patterns", basic: false, premium: true },
];

// ── Blurred preview mock data ─────────────────────────────────────────────────

const MockChurnCard = () => (
  <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-3">
    <div className="flex items-center gap-2 text-red-700">
      <AlertTriangle className="h-4 w-4" />
      <span className="text-sm font-semibold">Customer Churn Alert</span>
    </div>
    <p className="text-xs text-red-600">
      <span className="font-bold text-lg text-red-700">17</span> customers showing signs of churn
    </p>
    <div className="grid grid-cols-3 gap-2">
      {[["8", "At Risk"], ["6", "Likely Lost"], ["3", "Lost"]].map(([n, label]) => (
        <div key={label} className="rounded-md border border-red-200 bg-red-50 p-2 text-center">
          <p className="text-base font-bold text-red-700">{n}</p>
          <p className="text-xs text-red-600">{label}</p>
        </div>
      ))}
    </div>
  </div>
);

const MockForecastCard = () => (
  <div className="rounded-lg border p-4 space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp className="h-4 w-4 text-primary" />
        Revenue Forecast
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">Next month</p>
        <p className="font-bold text-emerald-600">QAR 4,230</p>
      </div>
    </div>
    <div className="h-16 flex items-end gap-0.5">
      {[30, 45, 40, 60, 55, 70, 65, 80, 75, 90, 85, 70].map((h, i) => (
        <div
          key={i}
          className={`flex-1 rounded-t ${i >= 9 ? "bg-primary/30 border-dashed border-t-2 border-primary/50" : "bg-primary/70"}`}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  </div>
);

// ── Package card ──────────────────────────────────────────────────────────────

interface PackageCardProps {
  type: "monthly" | "quarterly" | "yearly";
  price: number;
  period: string;
  popular?: boolean;
  bestValue?: boolean;
  discount?: number;
  selected: boolean;
  onSelect: () => void;
}

const PackageCard = ({ type, price, period, popular, bestValue, discount, selected, onSelect }: PackageCardProps) => (
  <button
    onClick={onSelect}
    className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
      selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
    }`}
  >
    <div className="flex items-start justify-between mb-2">
      <div>
        {popular && <Badge className="mb-1.5 text-xs">Most Popular</Badge>}
        {bestValue && <Badge variant="secondary" className="mb-1.5 text-xs">Best Value</Badge>}
        <p className="font-semibold capitalize">{type}</p>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
        selected ? "border-primary bg-primary" : "border-muted-foreground/30"
      }`}>
        {selected && <Check className="h-3 w-3 text-white" />}
      </div>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold">{formatCurrency(price)}</span>
      <span className="text-xs text-muted-foreground">/ {period}</span>
    </div>
    {discount && (
      <p className="text-xs text-emerald-600 mt-1 font-medium">Save {discount}% vs monthly</p>
    )}
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────

export function PremiumAnalyticsPaywall({
  restaurantId,
  partnerId,
  onPurchase,
  hasPendingRequest = false,
}: PremiumAnalyticsPaywallProps) {
  const { toast } = useToast();
  const { prices, loading: pricesLoading } = usePremiumAnalyticsPrices();

  const [selectedPackage, setSelectedPackage] = useState<"monthly" | "quarterly" | "yearly" | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getDiscount = (type: "quarterly" | "yearly") => {
    const monthlyTotal = prices.monthly * (type === "quarterly" ? 3 : 12);
    return Math.round(((monthlyTotal - prices[type]) / monthlyTotal) * 100);
  };

  const getEndsAt = (type: "monthly" | "quarterly" | "yearly"): Date => {
    const now = new Date();
    if (type === "monthly") return new Date(now.setMonth(now.getMonth() + 1));
    if (type === "quarterly") return new Date(now.setMonth(now.getMonth() + 3));
    return new Date(now.setFullYear(now.getFullYear() + 1));
  };

  const handleOpenDialog = (pkg: "monthly" | "quarterly" | "yearly") => {
    setSelectedPackage(pkg);
    setPaymentRef("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedPackage) return;
    setSubmitting(true);
    try {
      const endsAt = getEndsAt(selectedPackage);
      const { error } = await supabase
        .from("premium_analytics_purchases")
        .insert({
          restaurant_id: restaurantId,
          partner_id: partnerId,
          package_type: selectedPackage,
          price_paid: prices[selectedPackage],
          ends_at: endsAt.toISOString(),
          payment_reference: paymentRef.trim() || null,
        } as never);

      if (error) throw error;

      toast({
        title: "Request submitted!",
        description: "Access will be activated within 1–2 business days after payment confirmation.",
      });
      setDialogOpen(false);
      onPurchase();
    } catch (error) {
      console.error("Error submitting purchase:", error);
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Pending state ───────────────────────────────────────────────────────────
  if (hasPendingRequest) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-center text-center gap-4 max-w-sm mx-auto">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-7 w-7 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-800">Payment Pending Review</h3>
              <p className="text-sm text-amber-700 mt-1">
                Your request has been submitted. Our team will confirm your payment and activate Premium Insights within <strong>1–2 business days</strong>.
              </p>
            </div>
            <div className="w-full rounded-lg border border-amber-200 bg-white/60 px-4 py-3 text-sm text-amber-700">
              Questions? Contact us at <span className="font-medium">support@nutriofuel.qa</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Main paywall ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* Blurred preview with lock overlay */}
      <div className="relative overflow-hidden rounded-2xl">
        <div className="pointer-events-none select-none blur-sm opacity-70 space-y-3 p-1">
          <MockChurnCard />
          <MockForecastCard />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-bold text-lg">This is your data — unlock it</p>
              <p className="text-sm text-muted-foreground mt-0.5">Subscribe to see your real churn alerts and revenue forecast</p>
            </div>
          </div>
        </div>
      </div>

      {/* ROI Hook */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-4">
            <Crown className="h-8 w-8 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-lg">Restaurants with Premium Insights grow faster</h3>
              <p className="text-sm text-muted-foreground mt-1">
                By identifying at-risk customers and optimising your menu, partners recover lost revenue they didn't know they were losing. At {formatCurrency(prices.monthly)}/month, recovering just <strong>one churned customer</strong> pays for your entire subscription.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature comparison table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basic vs Premium</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-3 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="pb-3 text-center font-medium text-muted-foreground w-20">Basic</th>
                  <th className="pb-3 text-center font-medium text-primary w-24">
                    <span className="inline-flex items-center gap-1">
                      <Crown className="h-3.5 w-3.5" />
                      Premium
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {comparisonRows.map(({ feature, basic, premium }) => (
                  <tr key={feature}>
                    <td className="py-2.5 pr-4 text-sm">{feature}</td>
                    <td className="py-2.5 text-center">
                      {basic ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <Minus className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 text-center">
                      {premium ? (
                        <Check className="h-4 w-4 text-primary mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pricing packages */}
      <div>
        <h3 className="font-semibold text-base mb-3">Choose your plan</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <PackageCard
            type="monthly"
            price={prices.monthly}
            period="month"
            selected={selectedPackage === "monthly"}
            onSelect={() => setSelectedPackage("monthly")}
          />
          <PackageCard
            type="quarterly"
            price={prices.quarterly}
            period="3 months"
            popular
            discount={getDiscount("quarterly")}
            selected={selectedPackage === "quarterly"}
            onSelect={() => setSelectedPackage("quarterly")}
          />
          <PackageCard
            type="yearly"
            price={prices.yearly}
            period="year"
            bestValue
            discount={getDiscount("yearly")}
            selected={selectedPackage === "yearly"}
            onSelect={() => setSelectedPackage("yearly")}
          />
        </div>

        <Button
          className="w-full mt-4 h-12 text-base font-semibold"
          disabled={!selectedPackage || pricesLoading}
          onClick={() => selectedPackage && handleOpenDialog(selectedPackage)}
        >
          <Crown className="h-4 w-4 mr-2" />
          Unlock Premium Insights
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Payment via bank transfer · Access activates within 1–2 business days
        </p>
      </div>

      {/* Payment dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              Complete Your Subscription
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                {selectedPackage && (
                  <div className="rounded-xl bg-muted/50 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1 capitalize">{selectedPackage} plan</p>
                    <p className="text-3xl font-bold">{formatCurrency(prices[selectedPackage])}</p>
                  </div>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Bank transfer instructions */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground">Bank Transfer Details</p>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Bank</span>
                  <span className="font-medium text-foreground">Qatar National Bank</span>
                </div>
                <div className="flex justify-between">
                  <span>Account Name</span>
                  <span className="font-medium text-foreground">Nutrio Fuel LLC</span>
                </div>
                <div className="flex justify-between">
                  <span>IBAN</span>
                  <span className="font-mono text-foreground">QA57QNBA000000000000000000001</span>
                </div>
                <div className="flex justify-between">
                  <span>Reference</span>
                  <span className="font-medium text-foreground">PREM-{partnerId.slice(0, 8).toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Payment reference input */}
            <div className="space-y-1.5">
              <Label htmlFor="payment_ref">Your Payment Reference / Transaction ID</Label>
              <Input
                id="payment_ref"
                placeholder="e.g. TRN2024031400012345"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the reference number from your bank transfer so we can match and confirm it quickly.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
