import { Shield } from "lucide-react";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface SubscriptionOverviewProps {
  planName: string;
  status: string;
  startDate: string;
  endDate: string;
}

export function SubscriptionOverview({
  planName,
  status,
  startDate,
  endDate,
}: SubscriptionOverviewProps) {
  const { t } = useLanguage();

  const statusLabels: Record<string, { label: string; className: string }> = {
    active: { label: t("status_active"), className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" },
    cancelled: { label: t("cancelled_active"), className: "bg-red-50 text-red-600 ring-1 ring-red-100" },
    pending: { label: t("paused"), className: "bg-amber-50 text-amber-700 ring-1 ring-amber-100" },
  };
  const statusInfo = statusLabels[status] || statusLabels.active;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200/80">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 pb-3 pt-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-emerald-100">
            <Shield className="h-4 w-4 text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-950">{t("subscription_details")}</h3>
        </div>

        {[
          { label: t("plan_label"), value: <span className="font-bold capitalize">{planName}</span> },
          {
            label: t("status_label"),
            value: (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
            ),
          },
          {
            label: t("start_date_label"),
            value: <span className="font-semibold text-sm">{startDate ? format(new Date(startDate), "MMM dd, yyyy") : "—"}</span>,
          },
          {
            label: t("end_date_label"),
            value: <span className="font-semibold text-sm">{endDate ? format(new Date(endDate), "MMM dd, yyyy") : "—"}</span>,
          },
        ].map(({ label, value }, idx, arr) => (
          <div
            key={label}
            className={`flex items-center justify-between px-5 py-4 ${
              idx < arr.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="text-sm text-slate-500">{label}</span>
            {value}
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-[20px] bg-slate-50 px-4 py-3 ring-1 ring-slate-200/80">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          Your subscription automatically renews each billing cycle. You can manage, freeze, or cancel anytime from the Settings tab.
        </p>
      </div>
    </div>
  );
}
