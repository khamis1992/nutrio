import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgePercent, Gift, Clock, ArrowDown,
  CheckCircle2, Loader2, Sparkles, HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { RecoveryOffer } from "@/hooks/useSubscriptionRecovery";

interface RecoveryOfferSheetProps {
  isOpen: boolean;
  onClose: () => void;
  offers: RecoveryOffer[];
  daysSinceExpiry: number;
  subscriptionId: string | undefined;
  isApplying: boolean;
  onApplyOffer: (offerId: string) => Promise<void>;
  onDismiss: () => Promise<void>;
  onReactivateDirect: () => Promise<void>;
}

const OFFER_STYLES: Record<string, { gradient: string; icon: typeof BadgePercent; accent: string; badgeClass: string }> = {
  discount: {
    gradient: "from-emerald-50 to-green-50",
    icon: BadgePercent,
    accent: "bg-emerald-600",
    badgeClass: "bg-emerald-100 text-emerald-700",
  },
  bonus_credits: {
    gradient: "from-amber-50 to-yellow-50",
    icon: Gift,
    accent: "bg-amber-500",
    badgeClass: "bg-amber-100 text-amber-700",
  },
  free_week: {
    gradient: "from-sky-50 to-blue-50",
    icon: Clock,
    accent: "bg-sky-600",
    badgeClass: "bg-sky-100 text-sky-700",
  },
  downgrade_retention: {
    gradient: "from-violet-50 to-purple-50",
    icon: ArrowDown,
    accent: "bg-violet-600",
    badgeClass: "bg-violet-100 text-violet-700",
  },
};

function OfferSummary({ offer }: { offer: RecoveryOffer }) {
  switch (offer.offer_type) {
    case "discount":
      return (
        <p className="text-sm text-slate-600">
          <span className="font-extrabold text-emerald-600">{offer.discount_percent}% off</span> when you reactivate
        </p>
      );
    case "bonus_credits":
      return (
        <p className="text-sm text-slate-600">
          <span className="font-extrabold text-amber-600">{formatCurrency(offer.bonus_credits!)}</span> in bonus credits
        </p>
      );
    case "free_week":
      return (
        <p className="text-sm text-slate-600">
          <span className="font-extrabold text-sky-600">{offer.free_days} days free</span> — no charge
        </p>
      );
    case "downgrade_retention":
      return (
        <p className="text-sm text-slate-600">
          Restart at <span className="font-extrabold text-violet-600">{offer.downgrade_to_tier}</span> tier
        </p>
      );
  }
}

export function RecoveryOfferSheet({
  isOpen,
  onClose,
  offers,
  daysSinceExpiry,
  subscriptionId,
  isApplying,
  onApplyOffer,
  onDismiss,
  onReactivateDirect,
}: RecoveryOfferSheetProps) {
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  const handleApply = async () => {
    if (!selectedOffer || !subscriptionId) return;
    await onApplyOffer(selectedOffer);
  };

  const handleDismiss = async () => {
    setIsDismissing(true);
    await onDismiss();
    setIsDismissing(false);
    onClose();
  };

  const handleClose = () => {
    setSelectedOffer(null);
    onClose();
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
            className="fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-300 rounded-full" />
            </div>

            <div className="px-6 pt-2 pb-6 space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
                  <HeartHandshake className="h-8 w-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-black text-slate-900">We want you back!</h2>
                <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-xs mx-auto">
                  It's been {daysSinceExpiry} day{daysSinceExpiry !== 1 ? "s" : ""} since your subscription ended.
                  Here's something special to welcome you back.
                </p>
              </div>

              {/* Offers */}
              {offers.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-center ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-500">No special offers available right now</p>
                  <p className="text-xs text-slate-400 mt-1">You can still reactivate at your current plan price</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400 px-1">
                    Choose your welcome-back offer
                  </p>
                  {offers.map((offer) => {
                    const style = OFFER_STYLES[offer.offer_type] || OFFER_STYLES.discount;
                    const Icon = style.icon;
                    const isSelected = selectedOffer === offer.id;

                    return (
                      <motion.button
                        key={offer.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedOffer(offer.id)}
                        className={cn(
                          "w-full text-left rounded-2xl border-2 p-4 transition-all",
                          isSelected
                            ? "bg-gradient-to-br shadow-md border-emerald-400"
                            : "bg-gradient-to-br border-slate-200 hover:border-slate-300",
                          style.gradient
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                            isSelected ? style.accent : "bg-white ring-1 ring-slate-200"
                          )}>
                            <Icon className={cn("h-6 w-6", isSelected ? "text-white" : "text-slate-600")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-slate-900">{offer.name}</h3>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{offer.description}</p>
                            <OfferSummary offer={offer} />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {offers.length > 0 && (
                  <Button
                    onClick={handleApply}
                    disabled={!selectedOffer || isApplying}
                    className="w-full rounded-2xl h-14 text-base font-extrabold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200"
                  >
                    {isApplying ? (
                      <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Applying...</>
                    ) : selectedOffer ? (
                      <><Sparkles className="h-5 w-5 mr-2" />Apply Welcome Offer</>
                    ) : (
                      "Select an offer above"
                    )}
                  </Button>
                )}

                <Button
                  onClick={onReactivateDirect}
                  variant="outline"
                  disabled={isApplying}
                  className="w-full rounded-2xl h-12 text-sm font-bold"
                >
                  Just reactivate at my current price
                </Button>

                <button
                  onClick={handleDismiss}
                  disabled={isDismissing}
                  className="w-full py-3 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {isDismissing ? "Dismissing..." : "No thanks, I'm not interested"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
