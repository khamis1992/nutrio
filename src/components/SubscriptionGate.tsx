import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, ArrowRight, X } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

interface SubscriptionGateProps {
  onDismiss?: () => void;
  showDismiss?: boolean;
  context?: "meal" | "schedule" | "tracking";
  className?: string;
}

const VALUE_PROPS = {
  meal: {
    title: "Unlock This Meal",
    description: "Join thousands in Qatar achieving their health goals",
    benefits: [
      "Schedule this meal for delivery",
      "Track your nutrition automatically",
      "Get personalized meal recommendations",
    ],
  },
  schedule: {
    title: "Start Your Meal Plan",
    description: "Healthy eating made easy with scheduled deliveries",
    benefits: [
      "Flexible weekly meal scheduling",
      "Pause or skip anytime",
      "Unused meals roll over",
    ],
  },
  tracking: {
    title: "Track Your Progress",
    description: "See real results with our nutrition tracking",
    benefits: [
      "Daily calorie & macro tracking",
      "Weight progress visualization",
      "Weekly reports delivered to inbox",
    ],
  },
};

export function SubscriptionGate({
  onDismiss,
  showDismiss = true,
  context = "meal",
  className,
}: SubscriptionGateProps) {
  const navigate = useNavigate();
  const { hasActiveSubscription } = useSubscription();
  const props = VALUE_PROPS[context];

  if (hasActiveSubscription) return null;

  return (
    <Card className={cn("border-primary/20 shadow-lg relative", className)}>
      <CardHeader className="text-center pb-2">
        {showDismiss && onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.benefits.map((benefit, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-3 w-3 text-primary" />
            </div>
            <span className="text-sm">{benefit}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button className="w-full" onClick={() => navigate("/subscription")}>
          View Plans <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Plans start at <strong>215 QAR/month</strong> • Cancel anytime
        </p>
      </CardFooter>
    </Card>
  );
}
