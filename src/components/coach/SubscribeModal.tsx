import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Check, X, User, CreditCard, Shield } from "lucide-react";
import { useCoachSubscription } from "@/hooks/useCoachSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SubscribeModalProps {
  coachId: string;
  open: boolean;
  onClose: () => void;
}

export function SubscribeModal({ coachId, open, onClose }: SubscribeModalProps) {
  const { user } = useAuth();
  const clientId = user?.id;
  const { pricing, existingSub, loading, cancelSubscription } = useCoachSubscription(clientId, coachId);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<"weekly" | "monthly">("monthly");
  const [step, setStep] = useState<"choose" | "confirm">("choose");

  if (!open) return null;

  const handleSubscribe = () => {
    onClose();
    navigate(
      `/checkout?type=coach_subscription&coachId=${encodeURIComponent(coachId)}&plan=${selectedPlan}`,
    );
  };

  const handleCancel = async () => {
    const result = await cancelSubscription();
    if (result.success) {
      toast({ title: "Cancelled", description: "Your coaching subscription has been cancelled." });
      onClose();
    } else {
      toast({ title: "Failed", description: "Could not cancel subscription.", variant: "destructive" });
    }
  };

  const formatCurrency = (val: number) => `QAR ${val}`;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative z-10 w-full max-w-[400px] mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (!pricing) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative z-10 w-full max-w-[400px] mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-xl border border-gray-100 p-8 text-center">
          <p className="text-sm text-gray-500">This coach hasn't set up pricing yet.</p>
          <button onClick={onClose} className="mt-4 w-full py-2.5 rounded-xl bg-gray-100 text-sm font-bold text-gray-600">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative z-10 w-full max-w-[400px] mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-lg font-extrabold text-gray-900">
            {existingSub ? "Your Subscription" : "Subscribe to Coach"}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Coach info */}
        <div className="flex items-center gap-3 px-6 pb-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
            {pricing.coachAvatar ? (
              <img src={pricing.coachAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-emerald-600" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{pricing.coachName}</p>
            <p className="text-[11px] text-gray-500">Nutrition Coach</p>
          </div>
        </div>

        {existingSub?.status === "active" ? (
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-800">
                  {existingSub.status === "active" ? "Active Subscription" : "Cancelled"}
                </p>
              </div>
              <p className="text-sm text-emerald-700">
                {existingSub.plan === "weekly" ? `${formatCurrency(existingSub.price)} per week` : `${formatCurrency(existingSub.price)} per month`}
              </p>
              <p className="text-xs text-emerald-600">
                Ends {new Date(existingSub.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {existingSub.status === "active" && (
              <button
                onClick={handleCancel}
                className="w-full py-2.5 rounded-xl bg-red-50 border border-red-200 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-4">
            {/* Plan selection */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setSelectedPlan("weekly"); setStep("confirm"); }}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all",
                  selectedPlan === "weekly" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <p className="text-xs font-semibold text-gray-500 uppercase">Weekly</p>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{formatCurrency(pricing.pricePerWeek)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">per week</p>
              </button>
              <button
                onClick={() => { setSelectedPlan("monthly"); setStep("confirm"); }}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all",
                  selectedPlan === "monthly" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center gap-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Monthly</p>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Save {Math.round(((pricing.pricePerWeek * 4 - pricing.pricePerMonth) / (pricing.pricePerWeek * 4)) * 100)}%</span>
                </div>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{formatCurrency(pricing.pricePerMonth)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">per month</p>
              </button>
            </div>

            {/* Confirm step */}
            {step === "confirm" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3 overflow-hidden"
              >
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Plan</span>
                    <span className="font-semibold text-gray-900">
                      {selectedPlan === "weekly" ? "Weekly" : "Monthly"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(selectedPlan === "weekly" ? pricing.pricePerWeek : pricing.pricePerMonth)}
                    </span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between text-sm">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-extrabold text-emerald-600">
                      {formatCurrency(selectedPlan === "weekly" ? pricing.pricePerWeek : pricing.pricePerMonth)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Shield className="w-3.5 h-3.5" />
                  Paid securely through SADAD
                </div>

                <button
                  onClick={handleSubscribe}
                  disabled={selectedPlan === "weekly" ? pricing.pricePerWeek <= 0 : pricing.pricePerMonth <= 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  Continue to SADAD
                </button>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
