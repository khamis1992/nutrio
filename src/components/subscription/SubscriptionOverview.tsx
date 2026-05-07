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
    active: { label: t("status_active"), className: "bg-primary/10 text-primary" },
    cancelled: { label: t("cancelled_active"), className: "bg-destructive/10 text-destructive" },
    pending: { label: t("paused"), className: "bg-warning/10 text-warning" },
  };
  const statusInfo = statusLabels[status] || statusLabels.active;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-[24px] border border-border/60 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3 border-b border-border/40">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-bold text-foreground">{t("subscription_details")}</h3>
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
              idx < arr.length - 1 ? "border-b border-border/30" : ""
            }`}
          >
            <span className="text-sm text-muted-foreground">{label}</span>
            {value}
          </div>
        ))}
      </div>

      <div className="bg-muted/40 rounded-[20px] px-4 py-3 flex items-start gap-3">
        <Shield className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your subscription automatically renews each billing cycle. You can manage, freeze, or cancel anytime from the Settings tab.
        </p>
      </div>
    </div>
  );
}
