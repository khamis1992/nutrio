import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgePercent, ArrowRight, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type { WinBackOffer } from "@/hooks/useSubscriptionManagement";
import { useSubscription } from "@/hooks/useSubscription";

interface Step3DiscountOfferProps {
  offers: WinBackOffer[];
  onNext: () => void;
  onAccept: (offerCode: string) => void;
  onBack: () => void;
}

export function Step3DiscountOffer({ offers, onNext, onAccept, onBack }: Step3DiscountOfferProps) {
  const { subscription } = useSubscription();
  const discountOffers = offers.filter((o) => o.offer_type === "discount");

  // Calculate savings
  const currentPrice = subscription?.price || 0;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <span className="text-sm font-medium">Step 3 of 4</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-primary rounded-full" />
          </div>
        </div>
        <CardTitle className="text-xl">How about a discount?</CardTitle>
        <CardDescription>
          We've applied a special discount just for you. Stay and save!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {discountOffers.length > 0 ? (
            discountOffers.map((offer) => {
              const savings = currentPrice * (offer.discount_percent || 0) / 100;
              return (
                <div
                  key={offer.offer_code}
                  className="relative overflow-hidden rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-100 p-4"
                >
                  <div className="absolute -right-4 -top-4 bg-green-500 text-white text-xs font-bold px-4 py-1 rotate-12">
                    SAVE {offer.discount_percent}%
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500 text-white">
                      <BadgePercent className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-green-900">{offer.name}</h3>
                      <p className="text-sm text-green-700 mt-1">{offer.description}</p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-bold text-green-600">
                          {formatCurrency(currentPrice - savings)}
                        </span>
                        <span className="text-sm text-muted-foreground line-through">
                          {formatCurrency(currentPrice)}
                        </span>
                        <span className="text-sm text-green-600">
                          /{offer.discount_duration_months} month
                        </span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        You save {formatCurrency(savings)}!
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => onAccept(offer.offer_code)}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    Apply Discount
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border bg-muted/50 p-6 text-center">
              <BadgePercent className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="font-medium text-muted-foreground">No discount offers available</h3>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>Limited time offer:</strong> This discount is only available right now. 
            If you cancel, you won't be able to claim this rate when you resubscribe.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button variant="outline" onClick={onNext} className="flex-1">
            Continue to Cancel
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
