import { CalendarClock, Snowflake } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { PartnerCustomerRetentionStatus } from "@/lib/partner-customer-retention";

interface FreezeNotificationCenterProps {
  statuses: PartnerCustomerRetentionStatus[];
}

export function FreezeNotificationCenter({ statuses }: FreezeNotificationCenterProps) {
  const freezes = statuses
    .filter((status) => status.activeFreeze)
    .sort((a, b) =>
      String(a.activeFreeze?.startDate).localeCompare(String(b.activeFreeze?.startDate)),
    )
    .slice(0, 4);

  if (freezes.length === 0) return null;

  return (
    <Card className="border-sky-100 bg-sky-50/70 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm">
            <Snowflake className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-slate-950">Freeze-aware prep</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  Customers with active or upcoming freezes in today&apos;s queue.
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-sky-700">
                {freezes.length}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {freezes.map((status) => (
                <div
                  key={status.userId}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CalendarClock className="h-4 w-4 shrink-0 text-sky-500" />
                    <span className="truncate font-bold text-slate-800">
                      {status.tier ?? status.planType ?? "Customer plan"}
                    </span>
                  </div>
                  <span className="shrink-0 font-black text-sky-700">
                    {status.activeFreeze?.startDate} - {status.activeFreeze?.endDate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
