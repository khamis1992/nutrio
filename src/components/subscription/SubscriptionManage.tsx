import { useState } from "react";
import {
  Snowflake,
  AlertCircle,
  X,
  RefreshCcw,
  Loader2,
  BellRing,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";
import { useAuth } from "@/contexts/AuthContext";
import { FreezeSubscriptionModal } from "@/components/subscription/FreezeSubscriptionModal";
import { CancellationFlow } from "@/components/CancellationFlow";
import { CancellationSalvageSheet } from "@/components/subscription/CancellationSalvageSheet";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SalvageReason, SalvageOffer } from "@/hooks/useCancellationOffers";

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
  autoRenew: boolean;
  autoRenewLoading: boolean;
  onToggleAutoRenew: (value: boolean) => void;
  rolloverCredits: number;
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
  autoRenew,
  autoRenewLoading,
  onToggleAutoRenew,
  rolloverCredits,
}: SubscriptionManageProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [showSalvageSheet, setShowSalvageSheet] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [salvageReason, setSalvageReason] = useState<SalvageReason | null>(null);
  const [salvageReasonDetails, setSalvageReasonDetails] = useState("");

  const handleCancelClick = () => {
    setShowSalvageSheet(true);
  };

  const handleSalvageAccept = async (offer: SalvageOffer, reason: SalvageReason, reasonDetails: string) => {
    if (!subscriptionId) return;
    try {
      const offerCode = `salvage_${offer.type}`;
      const stepMap: Record<SalvageOffer["type"], number> = {
        discount: 3,
        pause: 2,
        switch_plan: 4,
        free_meal_credit: 4,
      };

      const { data, error } = await supabase.rpc("process_cancellation", {
        p_subscription_id: subscriptionId,
        p_step: stepMap[offer.type],
        p_reason: reason,
        p_reason_details: reasonDetails,
        p_offer_code: offerCode,
        p_accept_offer: true,
      });

      if (error) throw error;

      const result = data as { success: boolean; action?: string; message?: string };

      if (result.success) {
        toast.success(result.message || t("offer_applied_success"));
        await onRefetch();
      } else {
        throw new Error(result.message || "Failed to apply offer");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply offer";
      captureError(err instanceof Error ? err : new Error(message), {
        context: "SubscriptionManage.handleSalvageAccept",
        offerType: offer.type,
      });
      toast.error(message);
    }
  };

  const handleSalvageProceedToCancel = (reason: SalvageReason, reasonDetails: string) => {
    setSalvageReason(reason);
    setSalvageReasonDetails(reasonDetails);
    setShowSalvageSheet(false);
    setShowCancelDialog(true);
  };

  const isCancelled = subscriptionStatus === "cancelled";

  return (
    <div className="space-y-0 rounded-[22px] border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Auto-Renewal */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <BellRing className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{t("auto_renewal_title")}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              {autoRenew ? t("auto_renewal_on_desc") : t("auto_renewal_off_desc")}
            </p>
          </div>
        </div>
        <Switch
          checked={autoRenew}
          onCheckedChange={onToggleAutoRenew}
          disabled={autoRenewLoading || isCancelled}
          className="shrink-0"
        />
      </div>

      {/* Rollover Credits */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
            <RefreshCw className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{t("rollover_credits_title")}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{t("rollover_carry_forward_desc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-extrabold text-emerald-600">
            {rolloverCredits > 0 ? `${rolloverCredits} credits` : "All used"}
          </span>
          {rolloverCredits > 0 && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-600">
              Active
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-slate-300" />
        </div>
      </div>

      {/* Freeze */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50">
            <Snowflake className="h-5 w-5 text-sky-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{t("freeze_subscription")}</p>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{t("freeze_desc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {freezeDays && (
            <span className="text-sm font-extrabold text-slate-700">
              {freezeDays.remaining}/{freezeDays.total}d
            </span>
          )}
          {subscriptionId && (
            <FreezeSubscriptionModal
              subscriptionId={subscriptionId}
              trigger={
                <button className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-sky-50 text-sky-600 active:scale-95 transition-transform">
                  <ChevronRight className="h-4 w-4" />
                </button>
              }
            />
          )}
        </div>
      </div>

      {/* Cancel / Reactivate */}
      {isCancelled ? (
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
              <RefreshCcw className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{t("reactivate_plan")}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{t("reactivate_desc")}</p>
            </div>
          </div>
          <Button
            size="sm"
            className="rounded-full h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 shrink-0"
            onClick={onReactivate}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Reactivating</>
            ) : (
              <><RefreshCcw className="h-3.5 w-3.5 mr-1.5" />Reactivate</>
            )}
          </Button>
        </div>
      ) : (
        <button
          className="flex w-full items-center justify-between px-5 py-4 active:bg-red-50/50 transition-colors"
          onClick={handleCancelClick}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
              <X className="h-5 w-5 text-red-500" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-bold text-red-500 truncate">{t("cancel_subscription")}</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">{t("cancel_desc")}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
        </button>
      )}

      <CancellationSalvageSheet
        isOpen={showSalvageSheet}
        onClose={() => setShowSalvageSheet(false)}
        onAcceptOffer={handleSalvageAccept}
        onProceedToCancel={handleSalvageProceedToCancel}
      />

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
