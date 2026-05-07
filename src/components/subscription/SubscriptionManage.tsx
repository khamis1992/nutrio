import { useState } from "react";
import {
  Snowflake,
  AlertCircle,
  X,
  RefreshCcw,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FreezeSubscriptionModal } from "@/components/subscription/FreezeSubscriptionModal";
import { CancellationFlow } from "@/components/CancellationFlow";
import { RolloverCreditsWidget } from "@/components/RolloverCreditsWidget";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";

interface SubscriptionManageProps {
  hasActiveSubscription: boolean;
  endDate: string | null;
  subscriptionId: string | null;
  subscriptionStatus?: string;
  freezeDays?: {
    total: number;
    used: number;
    remaining: number;
  } | null;
  isProcessing: boolean;
  onReactivate: () => Promise<void>;
  onRefetch: () => Promise<void>;
}

export function SubscriptionManage({
  hasActiveSubscription,
  endDate,
  subscriptionId,
  subscriptionStatus,
  freezeDays,
  isProcessing,
  onReactivate,
  onRefetch,
}: SubscriptionManageProps) {
  const { t } = useLanguage();
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  return (
    <div className="space-y-3">
      <RolloverCreditsWidget
        hasActiveSubscription={hasActiveSubscription}
        subscriptionEndDate={endDate}
      />

      {/* Freeze card */}
      <div
        className={`bg-card rounded-[24px] border shadow-sm p-4 space-y-3 ${
          freezeDays?.remaining === 0 ? "border-muted" : "border-border/60"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                freezeDays?.remaining === 0 ? "bg-muted" : "bg-primary/10"
              }`}
            >
              <Snowflake
                className={`h-4 w-4 ${freezeDays?.remaining === 0 ? "text-muted-foreground" : "text-primary"}`}
              />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{t("freeze_subscription")}</p>
              <p className="text-xs text-muted-foreground">{t("freeze_desc")}</p>
            </div>
          </div>
          {freezeDays && (
            <span
              className={`text-sm font-bold px-2.5 py-1 rounded-full border ${
                freezeDays.remaining === 0
                  ? "text-muted-foreground bg-muted border-border/40"
                  : "text-primary bg-primary/5 border-primary/15"
              }`}
            >
              {freezeDays.remaining}/{freezeDays.total}d
            </span>
          )}
        </div>

        {freezeDays && (
          <div className="space-y-1">
            <div
              className={`h-2 rounded-full overflow-hidden ${
                freezeDays.remaining === 0 ? "bg-muted" : "bg-primary/10"
              }`}
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  freezeDays.remaining === 0 ? "bg-muted-foreground/20" : "bg-primary"
                }`}
                style={{ width: `${((freezeDays.total - freezeDays.remaining) / freezeDays.total) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              {freezeDays.remaining === 0
                ? t("all_freeze_days_used")
                : `${freezeDays.remaining} ${t("freeze_days_remaining")}`}
            </p>
          </div>
        )}

        {freezeDays?.remaining === 0 ? (
          <div className="flex items-start gap-3 bg-muted/40 rounded-2xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("no_freeze_days")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("all_freeze_days_used")}</p>
            </div>
          </div>
        ) : (
          subscriptionId && (
            <FreezeSubscriptionModal
              subscriptionId={subscriptionId}
              trigger={
                <Button className="w-full rounded-2xl h-11 font-bold">
                  <Snowflake className="h-4 w-4 mr-2" />
                  {t("schedule_freeze_btn")}
                </Button>
              }
            />
          )
        )}
      </div>

      {/* Cancel / Reactivate card */}
      {subscriptionStatus === "cancelled" ? (
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <RefreshCcw className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{t("reactivate_plan")}</p>
              <p className="text-xs text-muted-foreground">{t("reactivate_desc")}</p>
            </div>
          </div>
          <Button
            className="w-full rounded-2xl h-11 font-bold shadow-sm shadow-primary/15"
            onClick={onReactivate}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("reactivating")}</>
            ) : (
              <><RefreshCcw className="h-4 w-4 mr-2" />{t("reactivate_subscription")}</>
            )}
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-[24px] border border-border/60 shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">{t("cancel_subscription")}</p>
              <p className="text-xs text-muted-foreground">{t("cancel_desc")}</p>
            </div>
          </div>
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-destructive/20 text-destructive bg-destructive/5 text-sm font-bold active:scale-[0.98] transition-all hover:bg-destructive/10"
            onClick={() => setShowCancelDialog(true)}
          >
            <X className="h-4 w-4" />
            {t("cancel_subscription")}
          </button>
        </div>
      )}

      <CancellationFlow
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        subscriptionId={subscriptionId}
        onCancelled={async () => {
          await onRefetch();
          setShowCancelDialog(false);
        }}
      />
    </div>
  );
}
