import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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
      <DialogContent className="sm:max-w-[400px] max-h-[95vh] p-0 overflow-hidden rounded-2xl gap-0">
        <div className="flex flex-col h-full max-h-[95vh]">

          {/* Native-style hero header */}
          <div className="relative bg-gradient-to-br from-primary to-accent px-6 pt-8 pb-6 text-white">
            <DialogTitle className="sr-only">Freeze Your Subscription</DialogTitle>
            <DialogDescription className="sr-only">Pause your subscription for up to {daysRemaining} days.</DialogDescription>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-white/20 rounded-full p-1.5">
                    <Snowflake className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-white/80 text-xs font-medium uppercase tracking-widest">Subscription</span>
                </div>
                <h2 className="text-xl font-bold text-white mt-2">Freeze Your Plan</h2>
                <p className="text-white/70 text-sm mt-0.5">Pause delivery for up to 7 days</p>
              </div>
              {/* Days pill */}
              <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-3 py-2 text-center border border-white/20">
                <span className="text-2xl font-bold text-white">{daysRemaining}</span>
                <p className="text-white/70 text-[10px] font-medium leading-tight">days<br/>left</p>
              </div>
            </div>

            {/* Step pills */}
            {canFreeze && (
              <div className="flex gap-2 mt-4">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  step === "start"
                    ? "bg-white text-primary"
                    : "bg-white/20 text-white"
                }`}>
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step !== "start" ? "bg-white text-primary" : "bg-primary/10 text-primary"
                  }`}>1</span>
                  Start
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  step === "end"
                    ? "bg-white text-primary"
                    : "bg-white/20 text-white"
                }`}>
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step === "end" ? "bg-primary/10 text-primary" : "bg-white/20 text-white"
                  }`}>2</span>
                  End
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {!canFreeze ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="bg-destructive/10 rounded-full p-4">
                  <Info className="h-6 w-6 text-destructive" />
                </div>
                <p className="font-semibold text-foreground">No Freeze Days Left</p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                  You've used all 7 freeze days this billing cycle. They reset at your next renewal.
                </p>
              </div>
            ) : (
              <>
                {/* Selected date summary card */}
                {(startDate || endDate) && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        {startDate && (
                          <p className="text-xs text-muted-foreground">
                            Start: <span className="font-semibold text-foreground">{format(startDate, "MMM dd")}</span>
                          </p>
                        )}
                        {endDate && (
                          <p className="text-xs text-muted-foreground">
                            End: <span className="font-semibold text-foreground">{format(endDate, "MMM dd")}</span>
                            <span className="ml-1.5 text-primary font-semibold">· {freezeDaysSelected}d</span>
                          </p>
                        )}
                        {!endDate && startDate && (
                          <p className="text-xs text-primary font-medium">Now pick an end date</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Calendar label */}
                <div>
                  <Label className="text-sm font-semibold text-foreground">
                    {step === "start" ? "When should it start?" : "When should it end?"}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step === "start"
                      ? "Tap a date to begin your freeze"
                      : `Pick an end date — max ${daysRemaining} days`}
                  </p>
                </div>

                {/* Calendar */}
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <Calendar
                    mode="single"
                    selected={step === "start" ? startDate : endDate}
                    onSelect={handleDateSelect}
                    disabled={isDateDisabled}
                    className="mx-auto"
                  />
                </div>
              </>
            )}
          </div>

          {/* Native-style bottom action bar */}
          <div className="px-5 pb-5 pt-3 border-t border-border space-y-2.5">
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isPending}
              className="w-full h-12 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white border-0 shadow-md shadow-primary/20"
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
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="w-full h-10 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FreezeSubscriptionModal;
