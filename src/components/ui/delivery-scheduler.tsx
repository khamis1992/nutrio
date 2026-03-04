import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeliverySchedulerProps {
  initialDate?: Date | string | null;
  timeSlots?: string[];
  timeZone?: string;
  onSchedule: (result: { date: Date; time: string }) => void;
  onCancel?: () => void;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const DeliveryScheduler = ({
  initialDate,
  timeSlots = [
    "7:00 AM", "8:00 AM", "9:00 AM",
    "11:00 AM", "12:00 PM", "1:00 PM",
    "5:00 PM", "6:00 PM", "7:00 PM",
  ],
  timeZone = "Qatar (GMT +3)",
  onSchedule,
  onCancel,
}: DeliverySchedulerProps) => {
  const parseInitial = () => {
    if (!initialDate) return new Date();
    if (initialDate instanceof Date) return initialDate;
    const d = new Date(initialDate);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(parseInitial());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Build 7-day week starting from today + weekOffset*7
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const handleConfirm = () => {
    if (!selectedTime) return;
    onSchedule({ date: selectedDate, time: selectedTime });
  };

  return (
    <div className="p-4 space-y-5">
      {/* Date picker */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="w-4 h-4 text-primary" />
            Select Date
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset(w => w + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const isPast = day < today;
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={day.toISOString()}
                disabled={isPast}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl py-2 text-xs font-medium transition-all",
                  isPast && "opacity-30 cursor-not-allowed",
                  isSelected && "bg-primary text-primary-foreground shadow-sm",
                  !isSelected && !isPast && "hover:bg-muted",
                  isToday && !isSelected && "border border-primary/40"
                )}
              >
                <span className="text-[10px] uppercase opacity-70">
                  {day.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="text-sm font-semibold">{day.getDate()}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {formatDate(selectedDate)} &bull; {timeZone}
        </p>
      </div>

      {/* Time slot picker */}
      <div>
        <div className="flex items-center gap-2 text-sm font-medium mb-3">
          <Clock className="w-4 h-4 text-primary" />
          Select Time
        </div>
        <div className="grid grid-cols-3 gap-2">
          {timeSlots.map((slot) => (
            <button
              key={slot}
              onClick={() => setSelectedTime(slot)}
              className={cn(
                "py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
                selectedTime === slot
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              )}
            >
              {slot}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          className="flex-1 rounded-xl"
          disabled={!selectedTime}
          onClick={handleConfirm}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
};
