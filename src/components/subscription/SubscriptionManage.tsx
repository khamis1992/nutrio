import { useState } from "react";
import {
  Snowflake,
  X,
  RefreshCcw,
  Loader2,
  BellRing,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/sentry";
import { FreezeSubscriptionModal } from "@/components/subscription/FreezeSubscriptionModal";
import { CancellationFlow } from "@/components/CancellationFlow";
import { CancellationSalvageSheet } from "@/components/subscription/CancellationSalvageSheet";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SalvageReason, SalvageOffer } from "@/hooks/useCancellationOffers";

interface SubscriptionManageProps {
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
  rolloverCredits: number;
}

export function SubscriptionManage({
  subscriptionId,
  subscriptionStatus,
  freezeDays,
  isProcessing,
  onReactivate,
  onRefetch,
  rolloverCredits,
}: SubscriptionManageProps) {
  const { t } = useLanguage();
  const [showSalvageSheet, setShowSalvageSheet] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

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

      const { data, error } = await supabase.rpc("process_cancellation" as never, {
        p_subscription_id: subscriptionId,
        p_step: stepMap[offer.type],
        p_reason: reason,
        p_reason_details: reasonDetails,
        p_offer_code: offerCode,
        p_accept_offer: true,
      } as never);

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

  const handleSalvageProceedToCancel = () => {
    setShowSalvageSheet(false);
    setShowCancelDialog(true);
  };

  const isCancelled = subscriptionStatus === "cancelled";
  const renewalAvailable = subscriptionStatus === "expired";

  return (
    <div className="space-y-0 overflow-hidden rounded-[22px] border border-[#E5EAF1] bg-white shadow-sm">
      {/* Verified manual renewal */}
      <div className="flex items-center justify-between border-b border-[#E5EAF1] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6FBF5]">
            <BellRing className="h-5 w-5 text-[#22C7A1]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#020617]">{t("plan_management_title")}</p>
            <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">
              {renewalAvailable ? t("manual_renewal_desc") : t("plan_management_desc")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onReactivate()}
          disabled={isProcessing || !subscriptionId}
          className="h-9 shrink-0 rounded-full px-4 text-xs font-bold"
        >
          {isProcessing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : renewalAvailable ? t("renew_securely") : t("view_plans")}
        </Button>
      </div>

      {/* Rollover Credits */}
      <div className="flex items-center justify-between border-b border-[#E5EAF1] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6FBF5]">
            <RefreshCw className="h-5 w-5 text-[#22C7A1]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#020617]">{t("rollover_credits_title")}</p>
            <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">{t("rollover_carry_forward_desc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-extrabold text-[#22C7A1]">
            {rolloverCredits > 0 ? `${rolloverCredits} credits` : "All used"}
          </span>
          {rolloverCredits > 0 && (
            <span className="inline-flex items-center rounded-full bg-[#E6FBF5] px-2.5 py-1 text-xs font-extrabold text-[#22C7A1]">
              Active
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-[#94A3B8]" />
        </div>
      </div>

      {/* Freeze */}
      <div className="flex items-center justify-between border-b border-[#E5EAF1] px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50">
            <Snowflake className="h-5 w-5 text-sky-600" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#020617]">{t("freeze_subscription")}</p>
            <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">{t("freeze_desc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {freezeDays && (
            <span className="text-sm font-extrabold text-[#020617]">
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E6FBF5]">
              <RefreshCcw className="h-5 w-5 text-[#22C7A1]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#020617]">{t("reactivate_plan")}</p>
              <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">{t("reactivate_desc")}</p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 shrink-0 rounded-full bg-[#020617] px-4 text-xs font-bold hover:bg-[#020617]/90"
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
              <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">{t("cancel_desc")}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]" />
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
