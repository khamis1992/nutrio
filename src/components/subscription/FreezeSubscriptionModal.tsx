import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Pause, Calendar as CalendarIcon, Info, Snowflake, RotateCcw } from "lucide-react";
import { format, addDays } from "date-fns";
import { CalendarDate } from "@internationalized/date";
import { RangeCalendar, CalendarGrid, CalendarGridBody, CalendarGridHeader, CalendarHeaderCell, CalendarHeading, CalendarCell } from "@/components/ui/range-calendar";
import { useRequestFreeze, useFreezeDaysRemaining } from "@/hooks/useSubscriptionFreeze";

interface FreezeSubscriptionModalProps {
  subscriptionId: string;
  trigger?: React.ReactNode;
}

export function FreezeSubscriptionModal({ 
  subscriptionId, 
  trigger 
}: FreezeSubscriptionModalProps) {
  const [open, setOpen] = useState(false);
  
  // Use react-aria CalendarDate for the range calendar
  const [range, setRange] = useState<{ start: CalendarDate | null; end: CalendarDate | null }>({
    start: null,
    end: null
  });

  // Real freeze days from DB
  const { data: freezeDaysData } = useFreezeDaysRemaining(subscriptionId);
  const requestFreeze = useRequestFreeze();

  const daysRemaining = freezeDaysData?.remaining ?? 7;
  const canFreeze = daysRemaining > 0;
  const isPending = requestFreeze.isPending;

  // Get today's date in local timezone
  const today = new CalendarDate(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    new Date().getDate()
  );

  // Minimum start date is tomorrow
  const minDate = today.add({ days: 1 });

  // Helper to convert CalendarDate to Date
  const calendarDateToDate = (cd: CalendarDate): Date => {
    return new Date(cd.year, cd.month - 1, cd.day);
  };

  // Helper to calculate days between two CalendarDates
  const getDaysBetween = (start: CalendarDate, end: CalendarDate): number => {
    const startJs = calendarDateToDate(start);
    const endJs = calendarDateToDate(end);
    const diffTime = Math.abs(endJs.getTime() - startJs.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const freezeDaysSelected = (() => {
    if (!range.start || !range.end) return 0;
    return getDaysBetween(range.start, range.end);
  })();

  const isValid = Boolean(range.start && range.end && freezeDaysSelected > 0 && freezeDaysSelected <= daysRemaining);

  const handleRangeChange = (newRange: { start: CalendarDate; end: CalendarDate } | null) => {
    if (newRange) {
      // maxValue on the calendar already prevents selecting beyond daysRemaining
      setRange({ start: newRange.start, end: newRange.end });
    } else {
      setRange({ start: null, end: null });
    }
  };

  const handleReset = () => {
    setRange({ start: null, end: null });
  };

  const handleSubmit = async () => {
    if (!range.start || !range.end || !isValid) return;

    const startDate = calendarDateToDate(range.start);
    const endDate = calendarDateToDate(range.end);

    // The RPC uses exclusive end dates (end - start = freeze days),
    // so we add 1 day to make a single-day selection send start=Mar5, end=Mar6 (= 1 freeze day).
    const result = await requestFreeze.mutateAsync({
      subscription_id: subscriptionId,
      freeze_start_date: format(startDate, "yyyy-MM-dd"),
      freeze_end_date: format(addDays(endDate, 1), "yyyy-MM-dd"),
    });

    if (result.success) {
      setOpen(false);
      setRange({ start: null, end: null });
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
                {(range.start || range.end) && (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-lg p-2">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        {range.start && (
                          <p className="text-xs text-muted-foreground">
                            Start: <span className="font-semibold text-foreground">{format(calendarDateToDate(range.start), "MMM dd")}</span>
                          </p>
                        )}
                        {range.end && (
                          <p className="text-xs text-muted-foreground">
                            End: <span className="font-semibold text-foreground">{format(calendarDateToDate(range.end), "MMM dd")}</span>
                            <span className="ml-1.5 text-primary font-semibold">· {freezeDaysSelected}d</span>
                          </p>
                        )}
                        {!range.end && range.start && (
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
                    Select freeze dates
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose up to {daysRemaining} days to freeze
                  </p>
                </div>

                {/* Range Calendar */}
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <RangeCalendar 
                    value={range.start && range.end ? { start: range.start, end: range.end } : null}
                    onChange={handleRangeChange}
                    minValue={minDate}
                    maxValue={range.start ? range.start.add({ days: daysRemaining - 1 }) : undefined}
                    className="mx-auto"
                  >
                    <CalendarHeading />
                    <CalendarGrid>
                      <CalendarGridHeader>
                        {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
                      </CalendarGridHeader>
                      <CalendarGridBody>
                        {(date) => <CalendarCell date={date} />}
                      </CalendarGridBody>
                    </CalendarGrid>
                  </RangeCalendar>
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
