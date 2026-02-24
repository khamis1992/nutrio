import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Snowflake, Calendar, AlertTriangle, Info, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, isBefore, isAfter, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface FreezeSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: {
    id: string;
    freeze_days_remaining: number;
    billing_cycle_end: string;
  } | null;
  onSuccess: () => void;
}

export function FreezeSubscriptionModal({ 
  isOpen, 
  onClose, 
  subscription, 
  onSuccess 
}: FreezeSubscriptionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [step, setStep] = useState<"select" | "confirm">("select");

  const maxDays = subscription?.freeze_days_remaining || 7;
  const minStartDate = addDays(new Date(), 1);
  const maxEndDate = subscription?.billing_cycle_end 
    ? parseISO(subscription.billing_cycle_end)
    : addDays(new Date(), 30);

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const days = calculateDays();
  const isValid = days > 0 && days <= maxDays && startDate && endDate;

  const handleSubmit = async () => {
    if (!isValid || !subscription) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to freeze subscription");
        return;
      }

      // Use the database function to handle freeze
      const { data, error } = await supabase.rpc("request_subscription_freeze", {
        p_user_id: user.id,
        p_subscription_id: subscription.id,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        if (error.message.includes("24 hours")) {
          toast.error("Freeze must be scheduled at least 24 hours in advance");
        } else if (error.message.includes("maximum")) {
          toast.error(`Maximum ${maxDays} days allowed per billing cycle`);
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Subscription frozen for ${days} days`);
      onSuccess();
      onClose();
      setStep("select");
      setStartDate("");
      setEndDate("");
    } catch (error) {
      console.error("Error freezing subscription:", error);
      toast.error("Failed to schedule freeze. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!subscription) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Freeze Subscription</DialogTitle>
          </DialogHeader>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No active subscription found. Subscribe to a plan to use this feature.
            </AlertDescription>
          </Alert>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-cyan-500" />
            Freeze Subscription
          </DialogTitle>
          <DialogDescription>
            Pause your subscription for up to 7 days per billing cycle
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-6">
            {/* Info Card */}
            <Card className="bg-cyan-50 border-cyan-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm text-cyan-800">
                      <strong>How it works:</strong>
                    </p>
                    <ul className="text-sm text-cyan-700 space-y-1 list-disc list-inside">
                      <li>Schedule at least 24 hours in advance</li>
                      <li>Maximum {maxDays} days remaining this cycle</li>
                      <li>Billing cycle extends by freeze duration</li>
                      <li>No meal deliveries during freeze period</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Days Remaining */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Days Available</span>
              <Badge 
                variant={maxDays > 0 ? "default" : "destructive"}
                className={cn(
                  "text-lg px-3 py-1",
                  maxDays > 0 && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                )}
              >
                {maxDays} / 7
              </Badge>
            </div>

            {maxDays === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You have used all available freeze days for this billing cycle. 
                  Your freeze allowance will reset on {format(parseISO(subscription.billing_cycle_end), "MMMM d, yyyy")}.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Date Selection */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Start Date
                    </Label>
                    <Input
                      id="startDate"
                      type="date"
                      min={format(minStartDate, "yyyy-MM-dd")}
                      max={format(maxEndDate, "yyyy-MM-dd")}
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        // Reset end date if it's before new start date
                        if (endDate && isBefore(parseISO(endDate), parseISO(e.target.value))) {
                          setEndDate("");
                        }
                      }}
                    />
                    <p className="text-xs text-slate-500">
                      Must be at least tomorrow
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="endDate" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      End Date
                    </Label>
                    <Input
                      id="endDate"
                      type="date"
                      min={startDate || format(minStartDate, "yyyy-MM-dd")}
                      max={format(maxEndDate, "yyyy-MM-dd")}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={!startDate}
                    />
                    <p className="text-xs text-slate-500">
                      Maximum {maxDays} days from start date
                    </p>
                  </div>
                </div>

                {/* Duration Preview */}
                {days > 0 && (
                  <Card className={cn(
                    "border-2",
                    days <= maxDays ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Selected Duration:</span>
                        <span className={cn(
                          "text-lg font-bold",
                          days <= maxDays ? "text-emerald-700" : "text-red-700"
                        )}>
                          {days} {days === 1 ? "day" : "days"}
                        </span>
                      </div>
                      {days > maxDays && (
                        <p className="text-sm text-red-600 mt-2">
                          Exceeds available freeze days ({maxDays} remaining)
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                    disabled={!isValid}
                    onClick={() => setStep("confirm")}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 mb-1">Confirm Freeze</p>
                    <p className="text-sm text-amber-800">
                      Your subscription will be frozen from{" "}
                      <strong>{format(parseISO(startDate), "MMMM d, yyyy")}</strong> to{" "}
                      <strong>{format(parseISO(endDate), "MMMM d, yyyy")}</strong> ({days} days).
                    </p>
                    <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                      <li>No meal credits will be deducted during this period</li>
                      <li>Your billing cycle will be extended by {days} days</li>
                      <li>This cannot be undone once confirmed</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("select")}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirm Freeze
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
