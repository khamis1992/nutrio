import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, AlertCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type CancellationReason =
  | "too_expensive"
  | "not_using_enough"
  | "moving_away"
  | "dietary_changes"
  | "quality_issues"
  | "delivery_issues"
  | "found_alternative"
  | "temporary_break"
  | "other";

interface Step1SurveyProps {
  onNext: (reason: CancellationReason, details: string) => void;
  onClose: () => void;
}

export function Step1Survey({ onNext, onClose }: Step1SurveyProps) {
  const { t } = useLanguage();
  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [details, setDetails] = useState("");

  const reasons: { value: CancellationReason; labelKey: string; descriptionKey: string }[] = [
    {
      value: "too_expensive",
      labelKey: "reason_too_expensive",
      descriptionKey: "reason_too_expensive_desc",
    },
    {
      value: "not_using_enough",
      labelKey: "reason_not_using",
      descriptionKey: "reason_not_using_desc",
    },
    {
      value: "moving_away",
      labelKey: "reason_moving",
      descriptionKey: "reason_moving_desc",
    },
    {
      value: "dietary_changes",
      labelKey: "reason_dietary",
      descriptionKey: "reason_dietary_desc",
    },
    {
      value: "quality_issues",
      labelKey: "reason_quality",
      descriptionKey: "reason_quality_desc",
    },
    {
      value: "delivery_issues",
      labelKey: "reason_delivery",
      descriptionKey: "reason_delivery_desc",
    },
    {
      value: "found_alternative",
      labelKey: "reason_alternative",
      descriptionKey: "reason_alternative_desc",
    },
    {
      value: "temporary_break",
      labelKey: "reason_temporary",
      descriptionKey: "reason_temporary_desc",
    },
    {
      value: "other",
      labelKey: "reason_other",
      descriptionKey: "reason_other_desc",
    },
  ];

  const handleNext = () => {
    if (selectedReason) {
      onNext(selectedReason, details);
    }
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <span className="text-sm font-medium">{t("step_1_of_4")}</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-primary rounded-full" />
          </div>
        </div>
        <CardTitle className="text-xl">{t("why_are_you_leaving")}</CardTitle>
        <CardDescription>
          {t("feedback_helps_improve")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={selectedReason || ""}
          onValueChange={(value) => setSelectedReason(value as CancellationReason)}
          className="space-y-3"
        >
          {reasons.map((reason) => (
            <div
              key={reason.value}
              className={`flex items-start space-x-3 space-y-0 rounded-lg border p-4 transition-colors cursor-pointer hover:bg-muted/50 ${
                selectedReason === reason.value ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => setSelectedReason(reason.value)}
            >
              <RadioGroupItem value={reason.value} id={reason.value} className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label htmlFor={reason.value} className="font-medium cursor-pointer">
                  {t(reason.labelKey)}
                </Label>
                <p className="text-sm text-muted-foreground">{t(reason.descriptionKey)}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-2">
          <Label htmlFor="details">{t("tell_us_more_optional")}</Label>
          <Textarea
            id="details"
            placeholder={t("feedback_placeholder")}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            {t("before_you_go_options")}
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t("keep_subscription")}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedReason}
            className="flex-1"
          >
            {t("continue")}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
