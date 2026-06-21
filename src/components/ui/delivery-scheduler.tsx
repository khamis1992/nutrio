import { useState } from "react";
import { Clock, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLocaleDate } from "@/lib/dateUtils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DeliverySchedulerProps {
  initialDate?: Date | string | null;
  timeSlots?: string[];
  timeZone?: string;
  onSchedule: (result: { date: Date; time: string }) => void;
  onCancel?: () => void;
}

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
  const { language } = useLanguage();
  const formatDate = (date: Date) => formatLocaleDate(date, language, { weekday: "long", month: "long", day: "numeric" });
  const parseInitial = () => {
    if (!initialDate) return new Date();
    if (initialDate instanceof Date) return initialDate;
    const d = new Date(initialDate);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(parseInitial());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const initDate = parseInitial();
  const diffDays = Math.floor((initDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const initialWeekOffset = Math.floor(diffDays / 7);

  const [weekOffset, setWeekOffset] = useState<number>(initialWeekOffset);

  // Build 7-day week starting from today + weekOffset*7
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
    <div className="flex h-full min-h-0 flex-col bg-[#F8FAFC]">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-3">
        <section className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">Delivery</p>
              <h2 className="mt-0.5 text-[22px] font-black leading-tight text-slate-950">Choose time</h2>
              <p className="mt-1 text-[13px] font-semibold leading-snug text-slate-500">{timeZone}</p>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#E2F8EB] text-[#0B9B59]">
              <Calendar className="h-5 w-5" strokeWidth={2.4} />
            </div>
          </div>

          <div className="mt-3 rounded-[18px] bg-slate-50 p-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-black text-slate-950">Select date</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-35"
                  onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                  disabled={weekOffset === 0}
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  aria-label="Next week"
                >
                  <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-7 gap-1">
              {weekDays.map((day) => {
                const isPast = day < today;
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={isPast}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "flex min-h-[46px] flex-col items-center justify-center rounded-[13px] text-center transition-all",
                      isPast && "cursor-not-allowed opacity-30",
                      isSelected && "bg-slate-950 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]",
                      !isSelected && !isPast && "bg-white text-slate-800 active:scale-95",
                      isToday && !isSelected && "ring-2 ring-emerald-200"
                    )}
                  >
                    <span className="text-[9px] font-extrabold uppercase leading-none opacity-70">
                      {formatLocaleDate(day, language, { weekday: "short" })}
                    </span>
                    <span className="mt-1 text-[14px] font-black leading-none">{day.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-2.5 text-center text-[12px] font-bold text-slate-500">
              {formatDate(selectedDate)}
            </p>
          </div>
        </section>

        <section className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-black text-slate-950">Select time</p>
              <p className="mt-1 text-[12px] font-semibold text-slate-500">Available delivery windows</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <Clock className="h-5 w-5" strokeWidth={2.4} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {timeSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedTime(slot)}
                className={cn(
                  "flex min-h-[44px] items-center justify-center rounded-[15px] border px-2 text-[13px] font-black transition-all active:scale-95",
                  selectedTime === slot
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_20px_rgba(15,23,42,0.18)]"
                    : "border-slate-100 bg-slate-50 text-slate-700"
                )}
              >
                {slot}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white/95 px-4 pt-3 backdrop-blur-2xl"
        style={{ paddingBottom: "max(5.75rem, calc(env(safe-area-inset-bottom) + 5.25rem))" }}
      >
        <div className="mb-2.5 flex items-center justify-between rounded-[16px] bg-slate-50 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-slate-950">{formatDate(selectedDate)}</p>
            <p className="mt-0.5 text-[12px] font-semibold text-slate-500">{selectedTime || "Select a time"}</p>
          </div>
          {selectedTime && (
            <span className="rounded-full bg-[#E2F8EB] px-3 py-1.5 text-[11px] font-black text-[#0B9B59]">
              Ready
            </span>
          )}
        </div>

        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              className="flex min-h-[50px] flex-1 items-center justify-center rounded-[17px] bg-slate-100 px-4 text-[14px] font-black text-slate-600 active:scale-95"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="flex min-h-[50px] flex-[1.4] items-center justify-center rounded-[17px] bg-slate-950 px-4 text-[14px] font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition disabled:bg-slate-300 disabled:text-white disabled:shadow-none"
            disabled={!selectedTime}
            onClick={handleConfirm}
          >
            Confirm time
          </button>
        </div>
      </div>
    </div>
  );
};
