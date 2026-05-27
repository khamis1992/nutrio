import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, DollarSign, Info, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachPricing } from "@/hooks/useCoachPricing";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function CoachPricingSection() {
  const { user } = useAuth();
  const coachId = user?.id;
  const { pricing, loading, saving, savePricing } = useCoachPricing(coachId);
  const { toast } = useToast();

  const [weeklyPrice, setWeeklyPrice] = useState(200);
  const [monthlyPrice, setMonthlyPrice] = useState(600);
  const [isActive, setIsActive] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (pricing && !initialized) {
      setWeeklyPrice(Number(pricing.price_per_week) || 200);
      setMonthlyPrice(Number(pricing.price_per_month) || 600);
      setIsActive(pricing.is_active);
      setInitialized(true);
    }
  }, [pricing, initialized]);

  const handleSave = async () => {
    const result = await savePricing(weeklyPrice, monthlyPrice, isActive);
    if (result.success) {
      toast({ title: "Pricing updated", description: "Your coaching prices have been saved." });
    } else {
      toast({ title: "Failed to save", description: result.error?.message || "Please try again.", variant: "destructive" });
    }
  };

  const monthlyDiscount = weeklyPrice > 0 ? Math.round(((weeklyPrice * 4 - monthlyPrice) / (weeklyPrice * 4)) * 100) : 0;

  if (loading) {
    return (
      <div className="h-[120px] animate-pulse rounded-[24px] bg-slate-100" />
    );
  }

  return (
    <div className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-emerald-600" />
        <h2 className="text-[14px] font-extrabold text-slate-800">Your Pricing</h2>
      </div>

      {/* Weekly */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-slate-600">Weekly Price</label>
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-4 h-[48px] focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
          <span className="text-[12px] font-bold text-slate-400 shrink-0">QAR</span>
          <input
            type="number"
            value={weeklyPrice}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value));
              setWeeklyPrice(val);
              setMonthlyPrice(Math.round(val * 4 * 0.75));
            }}
            min={0}
            step={50}
            className="flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      {/* Monthly */}
      <div className="space-y-1.5">
        <label className="text-[12px] font-semibold text-slate-600">
          Monthly Price
          {monthlyDiscount > 0 && (
            <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
              Save {monthlyDiscount}%
            </span>
          )}
        </label>
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-4 h-[48px] focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
          <span className="text-[12px] font-bold text-slate-400 shrink-0">QAR</span>
          <input
            type="number"
            value={monthlyPrice}
            onChange={(e) => setMonthlyPrice(Math.max(0, Number(e.target.value)))}
            min={0}
            step={50}
            className="flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>

      <p className="text-[10px] text-slate-400 flex items-center gap-1">
        <Info className="w-3 h-3" />
        Suggested range: QAR 150-500 per week
      </p>

      {/* Active toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <span className="text-[13px] font-semibold text-slate-700">Accepting new clients</span>
          <p className="text-[10px] text-slate-400">Turn off to pause new subscriptions</p>
        </div>
        <button
          onClick={() => setIsActive(!isActive)}
          className={cn(
            "relative w-[44px] h-[26px] rounded-full transition-colors",
            isActive ? "bg-emerald-500" : "bg-slate-300"
          )}
        >
          <motion.div
            animate={{ x: isActive ? 18 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow-md"
          />
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Platform commission is <span className="font-bold">{pricing ? 'set by admin' : '20%'}</span>. Your earnings are held for 7 days before becoming available for withdrawal.
        </p>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={handleSave}
        disabled={saving || weeklyPrice === 0}
        className="w-full h-[44px] rounded-[16px] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Save Pricing
      </motion.button>
    </div>
  );
}
