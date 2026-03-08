import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, ArrowRight, ArrowLeft, Pause } from "lucide-react";
import type { WinBackOffer } from "@/hooks/useSubscriptionManagement";
import { useLanguage } from "@/contexts/LanguageContext";

interface Step2PauseOfferProps {
  offers: WinBackOffer[];
  onNext: () => void;
  onAccept: (offerCode: string) => void;
  onBack: () => void;
}

export function Step2PauseOffer({ offers, onNext, onAccept, onBack }: Step2PauseOfferProps) {
  const { t } = useLanguage();
  const pauseOffers = offers.filter((o) => o.offer_type === "pause");

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <span className="text-sm font-medium">{t("step_2_of_4")}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-2/4 bg-primary rounded-full" />
          </div>
        </div>
        <CardTitle className="text-xl">{t("need_a_break")}</CardTitle>
        <CardDescription>
          {t("pause_keeps_benefits")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {pauseOffers.length > 0 ? (
            pauseOffers.map((offer) => (
              <div
                key={offer.offer_code}
                className="relative overflow-hidden rounded-lg border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Pause className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900">{offer.name}</h3>
                    <p className="text-sm text-blue-700 mt-1">{offer.description}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-blue-600">
                      <Calendar className="h-4 w-4" />
                      <span>{offer.pause_duration_days} {t("days")}</span>
                      <span className="text-blue-400">•</span>
                      <Clock className="h-4 w-4" />
                      <span>{t("resume_automatically")}</span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => onAccept(offer.offer_code)}
                  className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {t("pause_subscription")}
                </Button>
              </div>
            ))
          ) : (
            <div className="rounded-lg border bg-muted/50 p-6 text-center">
              <Pause className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
              <h3 className="font-medium text-muted-foreground">{t("no_pause_offers")}</h3>
            </div>
          )}
        </div>

        <div className="rounded-lg border bg-muted p-4">
          <h4 className="font-medium mb-2">{t("what_happens_when_pause")}</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>{t("subscription_remains_active")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>{t("billing_delayed")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>{t("meal_credits_safe")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>{t("favorite_meals_available")}</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
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
