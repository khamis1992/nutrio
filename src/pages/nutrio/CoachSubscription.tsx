import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowLeft, Loader2, Star, Users, Clock, CheckCircle2, CreditCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachSubscription } from "@/hooks/useCoachSubscription";
import { useCoachAvailability } from "@/hooks/useCoachAvailability";
import { useCoachReviews } from "@/hooks/useCoachReviews";
import { useToast } from "@/hooks/use-toast";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function CoachSubscription() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const coachId = searchParams.get("coachId") || "";
  const clientId = user?.id;
  const { pricing, existingSub, loading, cancelSubscription } = useCoachSubscription(clientId, coachId);
  const { availability } = useCoachAvailability(coachId);
  const { summary: ratingSummary } = useCoachReviews(coachId);
  const requestedPlan = searchParams.get("plan");
  const [selectedPlan, setSelectedPlan] = useState<"weekly" | "monthly">(
    requestedPlan === "weekly" ? "weekly" : "monthly",
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const formatCurrency = (val: number) => `QAR ${val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const handleSubscribe = () => {
    if (!pricing || !clientId) return;
    navigate(
      `/checkout?type=coach_subscription&coachId=${encodeURIComponent(coachId)}&plan=${selectedPlan}`,
    );
  };

  const handleCancel = async () => {
    const result = await cancelSubscription();
    if (result.success) {
      toast({ title: "Cancelled", description: "Your subscription has been cancelled." });
    } else {
      toast({ title: "Failed", description: "Could not cancel. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-[16px] font-extrabold text-slate-950">Subscribe to Coach</h1>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {pricing ? (
          <>
            {/* Coach Info Card */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mx-auto mb-3">
                {pricing.coachAvatar ? (
                  <img src={pricing.coachAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-xl font-bold text-emerald-700">{(pricing.coachName || "C")[0].toUpperCase()}</span>
                )}
              </div>
              <h2 className="text-[18px] font-extrabold text-slate-950">{pricing.coachName}</h2>
              <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-slate-500">
                {ratingSummary && (
                  <span className="flex items-center gap-1 font-medium">
                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                    {ratingSummary.average_rating} ({ratingSummary.total_reviews})
                  </span>
                )}
                {availability?.responseLabel && (
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {availability.responseLabel}
                  </span>
                )}
                <span className="flex items-center gap-1 font-medium">
                  <Users className="w-3.5 h-3.5" />
                  {availability?.activeClientRange || "0"} active
                </span>
              </div>
            </motion.div>

            {/* Existing subscription */}
            {existingSub && existingSub.status === "active" ? (
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 text-center"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <h3 className="text-[16px] font-extrabold text-slate-900 mb-1">You're subscribed!</h3>
                <p className="text-[12px] text-slate-500 mb-4">
                  {existingSub.plan === "weekly" ? `${formatCurrency(existingSub.price)} / week` : `${formatCurrency(existingSub.price)} / month`}
                  {" · "}Until {new Date(existingSub.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                </p>
                <button
                  onClick={handleCancel}
                  className="h-[40px] px-5 rounded-full bg-red-50 text-red-600 text-[13px] font-semibold hover:bg-red-100 active:scale-95 transition-all"
                >
                  Cancel Subscription
                </button>
              </motion.div>
            ) : (
              /* Plan Selection */
              <motion.div
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
              >
                <h3 className="text-[15px] font-extrabold text-slate-950 mb-3">Choose a Plan</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={() => setSelectedPlan("weekly")}
                    className={`p-4 rounded-2xl border-2 text-center transition-all ${selectedPlan === "weekly" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <p className="text-[24px] font-extrabold text-slate-900">{formatCurrency(pricing.pricePerWeek)}</p>
                    <p className="text-[11px] font-semibold text-slate-500">per week</p>
                  </button>
                  <button
                    onClick={() => setSelectedPlan("monthly")}
                    className={`p-4 rounded-2xl border-2 text-center transition-all ${selectedPlan === "monthly" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <div className="relative">
                      <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">SAVE</span>
                    </div>
                    <p className="text-[24px] font-extrabold text-slate-900">{formatCurrency(pricing.pricePerMonth)}</p>
                    <p className="text-[11px] font-semibold text-slate-500">per month</p>
                  </button>
                </div>
                <button
                  onClick={handleSubscribe}
                  disabled={!pricing.isActive}
                  className="w-full h-[44px] rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {`Continue - ${formatCurrency(selectedPlan === "weekly" ? pricing.pricePerWeek : pricing.pricePerMonth)}`}
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-3">Secure payment via Sadad</p>
              </motion.div>
            )}
          </>
        ) : (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-12 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">Unavailable</h3>
            <p className="text-[12px] text-slate-500">This coach hasn't set up their pricing yet.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
