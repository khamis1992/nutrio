import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Pause, Calendar as CalendarIcon, Info, Snowflake, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface FreezeSubscriptionModalProps {
  subscriptionId: string;
  trigger?: React.ReactNode;
}

export function FreezeSubscriptionModal({ 
  subscriptionId: _subscriptionId, 
  trigger 
}: FreezeSubscriptionModalProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"start" | "end">("start");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [isPending, setIsPending] = useState(false);

  const daysRemaining = 7;
  const canFreeze = daysRemaining > 0;

  const freezeDaysSelected = (() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  })();

  const isValid = Boolean(startDate && endDate && freezeDaysSelected > 0 && freezeDaysSelected <= daysRemaining);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    if (step === "start") {
      setStartDate(new Date(date));
      setStep("end");
    } else {
      if (startDate && date > startDate) {
        const daysDiff = Math.ceil((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff <= daysRemaining) {
          setEndDate(new Date(date));
        } else {
          toast.error(`You can only freeze for up to ${daysRemaining} days`);
        }
      }
    }
  };

  const handleReset = () => {
    setStep("start");
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate || !isValid) {
      toast.error("Please select both start and end dates");
      return;
    }

    setIsPending(true);
    
    setTimeout(() => {
      setIsPending(false);
      toast.success(
        `Freeze scheduled for ${freezeDaysSelected} days from ${format(startDate, "MMM dd")} to ${format(endDate, "MMM dd")}`
      );
      setOpen(false);
      setStep("start");
      setStartDate(undefined);
      setEndDate(undefined);
    }, 1500);
  };

  // Get tomorrow's date using local timezone (not UTC)
  const minStartDate = (() => {
    const now = new Date();
    // Create tomorrow in local timezone at midnight
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return tomorrow;
  })();

  // Helper to get YYYY-MM-DD string from a date (using local date components)
  const dateToString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDateDisabled = (date: Date) => {
    if (step === "start") {
      const checkDateStr = dateToString(date);
      const minDateStr = dateToString(minStartDate);
      return checkDateStr < minDateStr;
    } else {
      if (!startDate) return true;
      const checkDateStr = dateToString(date);
      const startDateStr = dateToString(startDate);
      
      if (checkDateStr <= startDateStr) return true;
      
      // Calculate days difference using local date components
      const checkDay = date.getDate();
      const startDay = startDate.getDate();
      const daysDiff = checkDay - startDay;
      return daysDiff > daysRemaining;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" disabled={!canFreeze} className="w-full sm:w-auto">
            <Pause className="mr-2 h-4 w-4" />
            Freeze Subscription
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] max-h-[95vh] p-0">
        <div className="flex flex-col h-full max-h-[95vh]">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Snowflake className="h-5 w-5 text-blue-600" />
              Freeze Your Subscription
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Pause your subscription for up to {daysRemaining} days.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {!canFreeze ? (
              <Alert variant="destructive">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  You have used all 7 freeze days for this billing cycle. 
                  Freeze days reset at the start of your next cycle.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-6">
                {/* Freeze days info */}
                <div className="flex items-center justify-between p-3 sm:p-4 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Freeze Days Available</span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">{daysRemaining} / 7</span>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-2 text-sm">
                  <div className={`h-2 w-2 rounded-full ${step === "start" ? "bg-primary" : "bg-primary"}`} />
                  <span className={step === "start" ? "font-medium" : "text-muted-foreground"}>
                    {step === "start" ? "Step 1: Select Start Date" : "Step 2: Select End Date"}
                  </span>
                </div>

                {/* Selected dates summary */}
                {(startDate || endDate) && (
                  <div className="p-3 bg-blue-50 rounded-lg space-y-1">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">
                        {startDate && endDate 
                          ? `Freezing for ${freezeDaysSelected} days`
                          : "Selected dates:"}
                      </span>
                    </div>
                    <div className="text-xs text-blue-600 pl-6 space-y-0.5">
                      {startDate && <p>Start: {format(startDate, "MMM dd, yyyy")}</p>}
                      {endDate && <p>End: {format(endDate, "MMM dd, yyyy")}</p>}
                    </div>
                    {(startDate || endDate) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleReset}
                        className="mt-2 h-7 text-xs"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset dates
                      </Button>
                    )}
                  </div>
                )}

                {/* Single Calendar */}
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base">
                    {step === "start" ? "Select Start Date" : "Select End Date"}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {step === "start" 
                      ? "Choose when to pause your subscription"
                      : `Choose end date (up to ${daysRemaining} days)`}
                  </p>
                  <div className="border rounded-lg p-2 sm:p-3 bg-background">
                    <Calendar
                      mode="single"
                      selected={step === "start" ? startDate : endDate}
                      onSelect={handleDateSelect}
                      disabled={isDateDisabled}
                      className="mx-auto"
                    />
                  </div>
                </div>

                {/* Validation messages */}
                {startDate && !endDate && step === "end" && (
                  <Alert className="bg-muted border-muted-foreground/20">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Now select your end date to complete the freeze request.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-col sm:flex-row gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!isValid || isPending}
              className="w-full sm:w-auto"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Snowflake className="mr-2 h-4 w-4" />
                  Confirm Freeze
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FreezeSubscriptionModal;
