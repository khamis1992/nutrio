import { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";
import { posthog } from "posthog-js";

import { Step1Survey, type CancellationReason } from "./Step1Survey";
import { Step2PauseOffer } from "./Step2PauseOffer";
import { Step3DiscountOffer } from "./Step3DiscountOffer";
import { Step4Final } from "./Step4Final";
import type { WinBackOffer } from "@/hooks/useSubscriptionManagement";

interface CancellationFlowProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId: string | null;
  onCancelled?: () => void;
}

type FlowStep = 1 | 2 | 3 | 4;

export function CancellationFlow({
  isOpen,
  onClose,
  subscriptionId,
  onCancelled,
}: CancellationFlowProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>(1);
  const [reason, setReason] = useState<CancellationReason | null>(null);
  const [reasonDetails, setReasonDetails] = useState("");
  const [offers, setOffers] = useState<WinBackOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Track cancellation flow start
  useEffect(() => {
    if (isOpen && user) {
      posthog.capture("cancellation_flow_start", {
        user_id: user.id,
        subscription_id: subscriptionId,
      });
    }
  }, [isOpen, user, subscriptionId]);

  // Fetch win-back offers for the current/next step
  const fetchOffers = useCallback(
    async (step: number) => {
      if (!subscriptionId || !user) return;

      try {
        const { data, error } = await (supabase.rpc as any)("get_win_back_offers", {
          p_user_id: user.id,
          p_subscription_id: subscriptionId,
          p_step: step,
        });

        if (error) throw error;
        setOffers(data || []);
      } catch (err) {
        console.error("Error fetching win-back offers:", err);
        captureError(err instanceof Error ? err : new Error("Failed to fetch win-back offers"), {
          context: "CancellationFlow.fetchOffers",
          step,
        });
      }
    },
    [subscriptionId, user]
  );

  // Fetch offers when step changes
  useEffect(() => {
    if (isOpen) {
      fetchOffers(currentStep);
    }
  }, [isOpen, currentStep, fetchOffers]);

  const handleStep1Next = (selectedReason: CancellationReason, details: string) => {
    setReason(selectedReason);
    setReasonDetails(details);

    // Track step 1 completion
    posthog.capture("cancellation_step_1_complete", {
      user_id: user?.id,
      reason: selectedReason,
    });

    setCurrentStep(2);
  };

  const handleStep2Next = () => {
    posthog.capture("cancellation_step_2_skip", {
      user_id: user?.id,
    });
    setCurrentStep(3);
  };

  const handleStep2Accept = async (offerCode: string) => {
    if (!subscriptionId || !user) return;

    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("process_cancellation", {
        p_subscription_id: subscriptionId,
        p_step: 2,
        p_reason: reason,
        p_reason_details: reasonDetails,
        p_offer_code: offerCode,
        p_accept_offer: true,
      });

      if (error) throw error;

      const result = data as { success: boolean; action?: string; message?: string };

      if (result.success) {
        posthog.capture("win_back_offer_accepted", {
          user_id: user.id,
          offer_code: offerCode,
          offer_type: "pause",
          step: 2,
        });

        toast.success(result.message || "Subscription paused successfully!");
        onClose();
      } else {
        throw new Error("Failed to accept pause offer");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to pause subscription";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "CancellationFlow.handleStep2Accept",
        offerCode,
      });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep3Next = () => {
    posthog.capture("cancellation_step_3_skip", {
      user_id: user?.id,
    });
    setCurrentStep(4);
  };

  const handleStep3Accept = async (offerCode: string) => {
    if (!subscriptionId || !user) return;

    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("process_cancellation", {
        p_subscription_id: subscriptionId,
        p_step: 3,
        p_reason: reason,
        p_reason_details: reasonDetails,
        p_offer_code: offerCode,
        p_accept_offer: true,
      });

      if (error) throw error;

      const result = data as { success: boolean; action?: string; message?: string };

      if (result.success) {
        posthog.capture("win_back_offer_accepted", {
          user_id: user.id,
          offer_code: offerCode,
          offer_type: "discount",
          step: 3,
        });

        toast.success(result.message || "Discount applied successfully!");
        onClose();
      } else {
        throw new Error("Failed to apply discount");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply discount";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "CancellationFlow.handleStep3Accept",
        offerCode,
      });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep4Confirm = async () => {
    if (!subscriptionId || !user) return;

    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("process_cancellation", {
        p_subscription_id: subscriptionId,
        p_step: 4,
        p_reason: reason,
        p_reason_details: reasonDetails,
        p_offer_code: null,
        p_accept_offer: false,
      });

      if (error) throw error;

      const result = data as { success: boolean; action?: string; message?: string };

      if (result.success) {
        posthog.capture("subscription_cancelled", {
          user_id: user.id,
          reason: reason,
          steps_completed: 4,
        });

        toast.success(result.message || "Subscription cancelled successfully");
        onCancelled?.();
        onClose();
      } else {
        throw new Error(result.action || "Cancellation failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel subscription";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "CancellationFlow.handleStep4Confirm",
        reason,
      });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStep4AcceptDowngrade = async (offerCode: string) => {
    if (!subscriptionId || !user) return;

    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("process_cancellation", {
        p_subscription_id: subscriptionId,
        p_step: 4,
        p_reason: reason,
        p_reason_details: reasonDetails,
        p_offer_code: offerCode,
        p_accept_offer: true,
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        action?: string;
        message?: string;
        new_tier?: string;
      };

      if (result.success) {
        posthog.capture("win_back_offer_accepted", {
          user_id: user.id,
          offer_code: offerCode,
          offer_type: result.action === "downgraded" ? "downgrade" : "bonus",
          step: 4,
        });

        toast.success(result.message || "Plan updated successfully!");
        onClose();
      } else {
        throw new Error("Failed to process offer");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process offer";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "CancellationFlow.handleStep4AcceptDowngrade",
        offerCode,
      });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as FlowStep);
    }
  };

  const handleClose = () => {
    // Track flow abandonment
    if (currentStep < 4 && user) {
      posthog.capture("cancellation_flow_abandoned", {
        user_id: user.id,
        step: currentStep,
      });
    }

    // Reset state
    setCurrentStep(1);
    setReason(null);
    setReasonDetails("");
    setOffers([]);
    onClose();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Survey onNext={handleStep1Next} onClose={handleClose} />;
      case 2:
        return (
          <Step2PauseOffer
            offers={offers}
            onNext={handleStep2Next}
            onAccept={handleStep2Accept}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <Step3DiscountOffer
            offers={offers}
            onNext={handleStep3Next}
            onAccept={handleStep3Accept}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <Step4Final
            offers={offers}
            onConfirmCancel={handleStep4Confirm}
            onAcceptDowngrade={handleStep4AcceptDowngrade}
            onBack={handleBack}
            onClose={handleClose}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Cancel Subscription</DialogTitle>
        </DialogHeader>
        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}

export { Step1Survey, Step2PauseOffer, Step3DiscountOffer, Step4Final };
export type { CancellationReason };
