import { differenceInDays, format, differenceInHours } from "date-fns";
import { AlertTriangle, Clock, CalendarX, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpiryBannerProps {
  status: string;
  endDate: string | null;
  onRenew?: () => void;
  onSeePlans?: () => void;
}

export function ExpiryBanner({ status, endDate, onRenew, onSeePlans }: ExpiryBannerProps) {
  if (status !== "cancelled" || !endDate) return null;

  const now = new Date();
  const end = new Date(endDate);
  if (end <= now) return null;

  const daysLeft = differenceInDays(end, now);
  const hoursLeft = differenceInHours(end, now);
  const isUrgent = daysLeft <= 3;
  const isCritical = daysLeft <= 1;

  if (daysLeft > 7) return null;

  const bannerStyles = isCritical
    ? "bg-[#FFF1F3] border-[#FFD3DA]"
    : isUrgent
    ? "bg-[#FFF1F3] border-[#FFD3DA]"
    : "bg-[#E0F7FE] border-[#BAE6FD]";

  const iconBg = isCritical
    ? "bg-[#FB6B7A]"
    : isUrgent
    ? "bg-[#FB6B7A]"
    : "bg-[#38BDF8]";

  const timeDisplay = daysLeft >= 1
    ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
    : `${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}`;

  return (
    <div className={cn("rounded-2xl border-2 p-4 space-y-3", bannerStyles)}>
      <div className="flex items-start gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          {isCritical ? (
            <CalendarX className="h-5 w-5 text-white" />
          ) : isUrgent ? (
            <AlertTriangle className="h-5 w-5 text-white" />
          ) : (
            <Clock className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-[#020617]">
            {isCritical
              ? "Your subscription ends today!"
              : isUrgent
              ? `Only ${timeDisplay} left!`
              : `Ending in ${timeDisplay}`}
          </p>
          <p className="mt-0.5 text-sm font-medium text-[#94A3B8]">
            Your plan expires on {format(end, "MMM dd, yyyy")}. Reactivate to keep your meals coming without interruption.
          </p>
        </div>
      </div>

      <div className="flex gap-2.5">
        {onRenew && (
          <button
            onClick={onRenew}
            className={cn(
              "flex-1 rounded-xl bg-[#020617] py-2.5 text-sm font-extrabold text-white transition-transform active:scale-95"
            )}
          >
            <Sparkles className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Reactivate Now
          </button>
        )}
        {onSeePlans && (
          <button
            onClick={onSeePlans}
            className="flex-1 rounded-xl bg-white py-2.5 text-sm font-bold text-[#020617] ring-1 ring-[#E5EAF1] transition-transform active:scale-95"
          >
            See Plans
          </button>
        )}
      </div>
    </div>
  );
}
