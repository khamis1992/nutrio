import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Pause,
  Shuffle,
  Gift,
  CheckCircle2,
  AlertCircle,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useCancellationOffers,
  type SalvageReason,
  type SalvageOffer,
} from "@/hooks/useCancellationOffers";

interface CancellationSalvageSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptOffer: (offer: SalvageOffer, reason: SalvageReason, reasonDetails: string) => void;
  onProceedToCancel: (reason: SalvageReason, reasonDetails: string) => void;
}

const REASONS: { value: SalvageReason; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "too_expensive", labelKey: "reason_too_expensive", icon: BadgePercent },
  { value: "not_using_enough", labelKey: "reason_not_using", icon: Pause },
  { value: "dietary_changes", labelKey: "reason_dietary", icon: Shuffle },
  { value: "found_alternative", labelKey: "reason_alternative", icon: ArrowRight },
  { value: "other", labelKey: "reason_other", icon: AlertCircle },
];

const OFFER_ICON: Record<SalvageOffer["type"], React.ComponentType<{ className?: string }>> = {
  discount: BadgePercent,
  pause: Pause,
  switch_plan: Shuffle,
  free_meal_credit: Gift,
};

const OFFER_BG: Record<SalvageOffer["type"], string> = {
  discount: "from-green-50 to-emerald-50 border-green-200",
  pause: "from-blue-50 to-indigo-50 border-blue-200",
  switch_plan: "from-purple-50 to-violet-50 border-purple-200",
  free_meal_credit: "from-amber-50 to-orange-50 border-amber-200",
};

const OFFER_ICON_BG: Record<SalvageOffer["type"], string> = {
  discount: "bg-green-500",
  pause: "bg-blue-500",
  switch_plan: "bg-purple-500",
  free_meal_credit: "bg-amber-500",
};

export function CancellationSalvageSheet({
  isOpen,
  onClose,
  onAcceptOffer,
  onProceedToCancel,
}: CancellationSalvageSheetProps) {
  const { t } = useLanguage();
  const {
    step,
    reason,
    reasonDetails,
    offer,
    setReason,
    setReasonDetails,
    goToStep,
    reset,
  } = useCancellationOffers();
  const [otherText, setOtherText] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);

  const handleClose = () => {
    reset();
    setOtherText("");
    onClose();
  };

  const handleReasonSelect = (selected: SalvageReason) => {
    setReason(selected);
    if (selected === "other") {
      setOtherText("");
    }
  };

  const handleContinueFromReason = () => {
    if (!reason) return;
    if (reason === "other" && otherText.trim()) {
      setReasonDetails(otherText.trim());
    }
    goToStep(2);
  };

  const handleAccept = async () => {
    if (!offer || !reason) return;
    setIsAccepting(true);
    try {
      onAcceptOffer(offer, reason, reason === "other" ? otherText.trim() : reasonDetails);
      handleClose();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleProceedToCancel = () => {
    if (!reason) return;
    onProceedToCancel(reason, reason === "other" ? otherText.trim() : reasonDetails);
    handleClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto safe-bottom"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            <div className="px-6 pt-3 pb-6">
              {step === 1 && (
                <div className="space-y-5">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                      <Heart className="h-7 w-7 text-rose-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">
                      {t("why_are_you_leaving")}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t("feedback_helps_improve")}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {REASONS.map((r) => {
                      const Icon = r.icon;
                      const isSelected = reason === r.value;
                      return (
                        <motion.button
                          key={r.value}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleReasonSelect(r.value)}
                          className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-colors text-left ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="font-semibold text-sm flex-1">{t(r.labelKey)}</span>
                          {isSelected && (
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {reason === "other" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="space-y-2"
                    >
                      <Textarea
                        placeholder={t("feedback_placeholder")}
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        className="min-h-[80px] rounded-xl"
                      />
                    </motion.div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      className="flex-1 rounded-2xl h-12 font-bold"
                    >
                      {t("keep_subscription")}
                    </Button>
                    <Button
                      onClick={handleContinueFromReason}
                      disabled={!reason || (reason === "other" && !otherText.trim())}
                      className="flex-1 rounded-2xl h-12 font-bold"
                    >
                      {t("continue")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && offer && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <button
                      onClick={() => goToStep(1)}
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium">{t("special_offer")}</span>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border-2 bg-gradient-to-br ${OFFER_BG[offer.type]} p-5`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full ${OFFER_ICON_BG[offer.type]} flex items-center justify-center shrink-0`}>
                        {(() => {
                          const Icon = OFFER_ICON[offer.type];
                          return <Icon className="h-6 w-6 text-white" />;
                        })()}
                      </div>
                      <div className="flex-1 space-y-2">
                        <h3 className="font-bold text-lg text-foreground">{offer.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {offer.description}
                        </p>
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/50 border border-white/80">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            {t("no_commitment_cancel_anytime")}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={handleAccept}
                      disabled={isAccepting}
                      className="w-full mt-5 rounded-2xl h-12 font-bold"
                    >
                      {offer.primaryAction}
                    </Button>
                  </motion.div>

                  <button
                    onClick={() => goToStep(3)}
                    className="w-full py-3 rounded-2xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {offer.dismissAction}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <button
                      onClick={() => goToStep(2)}
                      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium">{t("final_step_cancel")}</span>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center space-y-3"
                  >
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center">
                      <AlertCircle className="h-7 w-7 text-rose-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">{t("sorry_to_see_you_go")}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t("access_continues_until_end")}
                    </p>
                  </motion.div>

                  <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{t("remaining_benefits_until_expiry")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{t("no_further_charges")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{t("reactivate_anytime")}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleProceedToCancel}
                      variant="outline"
                      className="flex-1 rounded-2xl h-12 font-bold border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    >
                      <X className="mr-2 h-4 w-4" />
                      {t("continue_cancellation")}
                    </Button>
                    <Button
                      onClick={handleClose}
                      className="flex-1 rounded-2xl h-12 font-bold"
                    >
                      {t("keep_my_plan")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
