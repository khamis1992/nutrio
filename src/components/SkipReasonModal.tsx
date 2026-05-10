import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { captureError } from "@/lib/sentry";
import { Utensils, UtensilsCrossed, Frown, Repeat, AlertCircle, MoreHorizontal } from "lucide-react";

interface SkipReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  mealId: string;
  scheduleId: string;
  mealName: string;
  mealType?: string;
  scheduledDate?: string;
  onSkipped?: () => void;
}

interface SkipOption {
  value: string;
  label: string;
  description: string;
  icon: typeof Utensils;
}

const SKIP_OPTIONS: SkipOption[] = [
  {
    value: "not_hungry",
    label: "Not Hungry",
    description: "I'm not feeling hungry right now",
    icon: UtensilsCrossed,
  },
  {
    value: "eating_out",
    label: "Eating Out",
    description: "I'll be eating at a restaurant",
    icon: Utensils,
  },
  {
    value: "dont_like",
    label: "Don't Like This Meal",
    description: "This meal doesn't appeal to me",
    icon: Frown,
  },
  {
    value: "tired_of_this",
    label: "Tired of This Meal",
    description: "I've had this too often recently",
    icon: Repeat,
  },
  {
    value: "dietary_restriction",
    label: "Dietary Restriction",
    description: "Doesn't fit my current diet",
    icon: AlertCircle,
  },
  {
    value: "other",
    label: "Other Reason",
    description: "Something else (please specify)",
    icon: MoreHorizontal,
  },
];

export function SkipReasonModal({
  isOpen,
  onClose,
  mealId,
  scheduleId,
  mealName,
  mealType,
  scheduledDate,
  onSkipped,
}: SkipReasonModalProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSkip = async () => {
    if (!user) {
      toast.error("Please sign in to skip meals");
      return;
    }

    if (!selectedReason) {
      toast.error("Please select a reason");
      return;
    }

    setIsSubmitting(true);

    try {
      // First, try to cancel the meal schedule (handles credit refund, addon refund, partner notification)
      // This will only succeed for pending/confirmed orders - others will throw an error
      const { data: cancelData, error: cancelError } = await supabase.rpc("cancel_meal_schedule", {
        p_schedule_id: scheduleId,
        p_reason: selectedReason || null,
      });

      if (cancelError) {
        // If cancellation failed (e.g., order already preparing), show specific error
        const errorMsg = cancelError.message || "";
        if (errorMsg.includes("preparing") || errorMsg.includes("delivering") || errorMsg.includes("Cannot cancel")) {
          toast.error("Cannot skip this meal", {
            description: "This meal is already being prepared or delivered. Please contact support.",
          });
          return;
        }
        throw cancelError;
      }

      const cancelResult = cancelData as { success?: boolean; error?: string };
      if (!cancelResult?.success) {
        throw new Error(cancelResult?.error || "Failed to skip meal");
      }

      // Record skip reason for analytics (after successful cancellation)
      await (supabase.rpc as unknown as (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>)("submit_skip_reason", {
        p_user_id: user.id,
        p_meal_id: mealId,
        p_schedule_id: scheduleId,
        p_reason_type: selectedReason,
        p_details: details || null,
        p_scheduled_date: scheduledDate || null,
        p_meal_type: mealType || null,
        p_ai_confidence_score: null,
      }).catch((err: unknown) => {
        // Don't fail the operation if reason submission fails
        console.warn("Could not submit skip reason:", err);
      });

      toast.success("Meal skipped", {
        description: "Your meal credit has been refunded.",
      });

      onSkipped?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to skip meal";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "SkipReasonModal.handleSkip",
      });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason("");
    setDetails("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skip {mealName}?</DialogTitle>
          <DialogDescription>
            Help us improve your recommendations by telling us why you're skipping this meal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={selectedReason}
            onValueChange={setSelectedReason}
            className="space-y-2"
          >
            {SKIP_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <div
                  key={option.value}
                  className={`flex items-start space-x-3 space-y-0 rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedReason === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedReason(option.value)}
                >
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <Label
                        htmlFor={option.value}
                        className="font-medium cursor-pointer"
                      >
                        {option.label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>

          {selectedReason === "other" && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="details">Please specify (optional)</Label>
              <Textarea
                id="details"
                placeholder="Tell us more about why you're skipping..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleSkip}
            disabled={!selectedReason || isSubmitting}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            {isSubmitting ? "Skipping..." : "Skip Meal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { SKIP_OPTIONS };
