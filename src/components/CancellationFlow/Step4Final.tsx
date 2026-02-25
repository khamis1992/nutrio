import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, Wallet, TrendingDown, X } from "lucide-react";
import { format } from "date-fns";
import type { WinBackOffer } from "@/hooks/useSubscriptionManagement";
import { useSubscription } from "@/hooks/useSubscription";
import { formatCurrency } from "@/lib/currency";

interface Step4FinalProps {
  offers: WinBackOffer[];
  onConfirmCancel: () => void;
  onAcceptDowngrade: (offerCode: string) => void;
  onBack: () => void;
  onClose: () => void;
}

export function Step4Final({
  offers,
  onConfirmCancel,
  onAcceptDowngrade,
  onBack,
  onClose,
}: Step4FinalProps) {
  const { subscription, remainingMeals } = useSubscription();
  const [isConfirming, setIsConfirming] = useState(false);

  const downgradeOffers = offers.filter((o) => o.offer_type === "downgrade");
  const bonusOffers = offers.filter((o) => o.offer_type === "bonus");

  const endDate = subscription?.end_date
    ? new Date(subscription.end_date)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const handleConfirmCancel = () => {
    setIsConfirming(true);
    onConfirmCancel();
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <span className="text-sm font-medium">Step 4 of 4</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-full bg-primary rounded-full" />
          </div>
        </div>
        <CardTitle className="text-xl text-red-600">Final Step: Cancel Subscription</CardTitle>
        <CardDescription>
          We're sorry to see you go. Here are your final options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Downgrade Options */}
        {downgradeOffers.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Consider a downgrade instead:</h3>
            {downgradeOffers.map((offer) => (
              <div
                key={offer.offer_code}
                className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500 text-white">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{offer.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {offer.description}
                    </p>
                    <Button
                      onClick={() => onAcceptDowngrade(offer.offer_code)}
                      variant="outline"
                      className="mt-3 w-full"
                      size="sm"
                    >
                      Switch to {offer.target_tier} Plan
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bonus Credits Option */}
        {bonusOffers.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Or take bonus credits:</h3>
            {bonusOffers.map((offer) => (
              <div
                key={offer.offer_code}
                className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{offer.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {offer.description}
                    </p>
                    <Button
                      onClick={() => onAcceptDowngrade(offer.offer_code)}
                      variant="outline"
                      className="mt-3 w-full border-amber-500 text-amber-700 hover:bg-amber-100"
                      size="sm"
                    >
                      Accept {offer.bonus_credits} QAR Bonus
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Final Cancellation */}
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-red-900">Confirm Cancellation</h4>
              <div className="text-sm text-red-700 mt-2 space-y-1">
                <p>You'll lose access to:</p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li>Your remaining {remainingMeals} meals this cycle</li>
                  <li>All subscription benefits</li>
                  <li>Discounted meal pricing</li>
                  <li>Priority delivery</li>
                </ul>
                <p className="mt-2">
                  Your access continues until{" "}
                  <strong>{format(endDate, "MMM dd, yyyy")}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Keep Subscription
          </Button>
          <Button
            onClick={handleConfirmCancel}
            disabled={isConfirming}
            variant="destructive"
            className="flex-1"
          >
            {isConfirming ? (
              "Cancelling..."
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
