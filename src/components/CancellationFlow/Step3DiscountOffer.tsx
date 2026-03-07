import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgePercent, ArrowRight, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import type { WinBackOffer } from "@/hooks/useSubscriptionManagement";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/contexts/LanguageContext";

interface Step3DiscountOfferProps {
  offers: WinBackOffer[];
  onNext: () => void;
  onAccept: (offerCode: string) => void;
  onBack: () => void;
}

export function Step3DiscountOffer({ offers, onNext, onAccept, onBack }: Step3DiscountOfferProps) {
  const { t } = useLanguage();
  const { subscription } = useSubscription();
  const discountOffers = offers.filter((o) => o.offer_type === "discount");

  // Calculate savings
  const currentPrice = subscription?.price || 0;

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <span className="text-sm font-medium">{t("step_3_of_4")}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-3/4 bg-primary rounded-full" />
          </div>
        </div>
        <CardTitle className="text-xl">{t("how_about_discount")}</CardTitle>
        <CardDescription>
          {t("special_discount_for_you")}
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
                    {t("save_percent").replace("{percent}", String(offer.discount_percent || 0))}
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
                          /{offer.discount_duration_months} {t("month")}
                        </span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        {t("you_save_amount").replace("{amount}", formatCurrency(savings))}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => onAccept(offer.offer_code)}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    {t("apply_discount")}
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border bg-muted/50 p-6 text-center">
              <BadgePercent className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="font-medium text-muted-foreground">{t("no_discount_offers")}</h3>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            <strong>{t("limited_time_offer")}</strong> {t("discount_only_now")}
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4 rtl-flip-back" />
            {t("back")}
          </Button>
          <Button variant="outline" onClick={onNext} className="flex-1">
            {t("continue_to_cancel")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
