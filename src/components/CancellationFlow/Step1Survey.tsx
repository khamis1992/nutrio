import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronRight, AlertCircle } from "lucide-react";

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

const reasons: { value: CancellationReason; label: string; description: string }[] = [
  {
    value: "too_expensive",
    label: "Too expensive",
    description: "The subscription costs are too high for my budget",
  },
  {
    value: "not_using_enough",
    label: "Not using enough",
    description: "I'm not ordering enough meals to justify the cost",
  },
  {
    value: "moving_away",
    label: "Moving away",
    description: "I'm relocating and won't be able to use the service",
  },
  {
    value: "dietary_changes",
    label: "Dietary changes",
    description: "My dietary needs have changed and don't match the menu",
  },
  {
    value: "quality_issues",
    label: "Quality issues",
    description: "I'm not satisfied with the food quality",
  },
  {
    value: "delivery_issues",
    label: "Delivery issues",
    description: "Having problems with delivery timing or reliability",
  },
  {
    value: "found_alternative",
    label: "Found alternative",
    description: "I've found another meal service that works better",
  },
  {
    value: "temporary_break",
    label: "Temporary break",
    description: "I just need a pause and plan to return",
  },
  {
    value: "other",
    label: "Other",
    description: "Something else not listed here",
  },
];

export function Step1Survey({ onNext, onClose }: Step1SurveyProps) {
  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [details, setDetails] = useState("");

  const handleNext = () => {
    if (selectedReason) {
      onNext(selectedReason, details);
    }
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <span className="text-sm font-medium">Step 1 of 4</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-1/4 bg-primary rounded-full" />
          </div>
        </div>
        <CardTitle className="text-xl">Why are you leaving?</CardTitle>
        <CardDescription>
          Your feedback helps us improve our service for everyone
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
                  {reason.label}
                </Label>
                <p className="text-sm text-muted-foreground">{reason.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>

        <div className="space-y-2">
          <Label htmlFor="details">Tell us more (optional)</Label>
          <Textarea
            id="details"
            placeholder="Your feedback is valuable to us..."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Before you go, we have some options that might help you stay on track with your health goals.
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Keep Subscription
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedReason}
            className="flex-1"
          >
            Continue
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
