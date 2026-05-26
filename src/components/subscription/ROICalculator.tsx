import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/currency";
import type { DbSubscriptionPlan } from "@/hooks/useSubscriptionPlans";

interface ROICalculatorProps {
  plans: DbSubscriptionPlan[];
}

export function ROICalculator({ plans }: ROICalculatorProps) {
  const { user } = useAuth();
  const [avgOrderQar, setAvgOrderQar] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchAvg = async () => {
      const { data } = await supabase
        .from("user_orders_view")
        .select("delivery_fee")
        .eq("user_id", user.id)
        .limit(20);

      if (data && data.length > 0) {
        const sum = data.reduce((s, o) => s + (o.delivery_fee || 45), 0);
        setAvgOrderQar(Math.round(sum / data.length));
      }
      setLoading(false);
    };

    fetchAvg();
  }, [user]);

  if (loading || !avgOrderQar || plans.length < 2) return null;

  const sorted = [...plans].sort((a, b) => a.price_qar - b.price_qar);
  const cheapest = sorted[0];
  const best = sorted[sorted.length - 1];

  const payPerMeal = avgOrderQar;
  const cheapestPerMeal = cheapest.meals_per_month > 0
    ? Math.round(cheapest.price_qar / cheapest.meals_per_month)
    : cheapest.price_qar;
  const bestPerMeal = best.meals_per_month > 0
    ? Math.round(best.price_qar / best.meals_per_month)
    : best.price_qar;

  const monthlySavings = (payPerMeal - bestPerMeal) * best.meals_per_month;
  if (monthlySavings <= 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
          <Calculator className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-emerald-900">Your Potential Savings</h3>
          <p className="text-[10px] text-emerald-700/70">Based on your average order of {formatCurrency(avgOrderQar)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/80 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-500 font-medium">Pay per meal</p>
          <p className="text-sm font-extrabold text-slate-700">{formatCurrency(payPerMeal)}</p>
          <p className="text-[9px] text-slate-400">per meal</p>
        </div>
        <div className="bg-white/80 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-500 font-medium">{cheapest.tier}</p>
          <p className="text-sm font-extrabold text-slate-700">{formatCurrency(cheapestPerMeal)}</p>
          <p className="text-[9px] text-slate-400">per meal</p>
        </div>
        <div className="bg-white/80 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-slate-500 font-medium">{best.tier}</p>
          <p className="text-sm font-extrabold text-emerald-700">{formatCurrency(bestPerMeal)}</p>
          <p className="text-[9px] text-emerald-600 font-semibold">per meal</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white/90 rounded-xl p-3">
        <TrendingDown className="w-5 h-5 text-emerald-600 shrink-0" />
        <div>
          <p className="text-xs font-extrabold text-emerald-800">
            You could save {formatCurrency(monthlySavings)} / month
          </p>
          <p className="text-[10px] text-emerald-700/70">
            That's {formatCurrency(monthlySavings * 12)} / year with the {best.tier} plan
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-700/60">
        Based on your past {Math.min((avgOrderQar > 0 ? 20 : 0), 20)} orders
      </div>
    </motion.div>
  );
}
