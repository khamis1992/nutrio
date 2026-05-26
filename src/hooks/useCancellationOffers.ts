import { useState, useCallback, useMemo } from "react";

export type SalvageReason =
  | "too_expensive"
  | "not_using_enough"
  | "dietary_changes"
  | "found_alternative"
  | "other";

export type SalvageStep = 1 | 2 | 3;

export interface SalvageOffer {
  type: "discount" | "pause" | "switch_plan" | "free_meal_credit";
  title: string;
  description: string;
  primaryAction: string;
  dismissAction: string;
}

interface UseCancellationOffersReturn {
  step: SalvageStep;
  reason: SalvageReason | null;
  reasonDetails: string;
  offer: SalvageOffer | null;
  setReason: (reason: SalvageReason) => void;
  setReasonDetails: (details: string) => void;
  goToStep: (step: SalvageStep) => void;
  reset: () => void;
}

export function useCancellationOffers(): UseCancellationOffersReturn {
  const [step, setStep] = useState<SalvageStep>(1);
  const [reason, setReasonInner] = useState<SalvageReason | null>(null);
  const [reasonDetails, setReasonDetails] = useState("");

  const setReason = useCallback((r: SalvageReason) => {
    setReasonInner(r);
    setStep(2);
  }, []);

  const goToStep = useCallback((s: SalvageStep) => {
    setStep(s);
  }, []);

  const reset = useCallback(() => {
    setStep(1);
    setReasonInner(null);
    setReasonDetails("");
  }, []);

  const offer = useMemo<SalvageOffer | null>(() => {
    if (!reason) return null;

    switch (reason) {
      case "too_expensive":
        return {
          type: "discount",
          title: "Get 30% off next month",
          description:
            "We'd hate to lose you over price. Stay with us and get 30% off your next billing cycle, or switch to a more affordable plan.",
          primaryAction: "Get 30% Off",
          dismissAction: "No thanks, continue",
        };
      case "not_using_enough":
        return {
          type: "pause",
          title: "Pause your plan for up to 14 days",
          description:
            "Take a break without losing your benefits. Your meal credits and plan perks will be waiting when you return.",
          primaryAction: "Pause My Plan",
          dismissAction: "No thanks, continue",
        };
      case "dietary_changes":
        return {
          type: "switch_plan",
          title: "Switch to a different meal plan",
          description:
            "Our plans are flexible! We can help you switch to a plan that better fits your new dietary needs.",
          primaryAction: "Explore Plans",
          dismissAction: "No thanks, continue",
        };
      case "found_alternative":
      case "other":
      default:
        return {
          type: "free_meal_credit",
          title: "Stay and get a free meal credit",
          description:
            "We'd love to keep serving you. Stay with us and receive a complimentary meal on your next order — no strings attached.",
          primaryAction: "Claim Free Meal",
          dismissAction: "No thanks, continue",
        };
    }
  }, [reason]);

  return {
    step,
    reason,
    reasonDetails,
    offer,
    setReason,
    setReasonDetails,
    goToStep,
    reset,
  };
}
