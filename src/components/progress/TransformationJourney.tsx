import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDown, ArrowUp, Camera, ChevronRight, Scale, TrendingDown } from "lucide-react";

interface WeightLog {
  log_date: string;
  weight_kg: number;
}

function weightLossMetaphor(kg: number): { animal: string; emoji: string } {
  if (kg >= 15) return { animal: "a car tire", emoji: "🛞" };
  if (kg >= 10) return { animal: "a small dog", emoji: "🐕" };
  if (kg >= 6) return { animal: "a gallon of water", emoji: "🪣" };
  if (kg >= 3) return { animal: "a newborn baby", emoji: "👶" };
  if (kg >= 1) return { animal: "a bag of flour", emoji: "🎒" };
  return { animal: "a pineapple", emoji: "🍍" };
}

export function TransformationJourney({ userId }: { userId: string }) {
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setMonth(startDate.getMonth() - 6);
      const start = startDate.toISOString().split("T")[0];

      const { data: measurements } = await supabase
        .from("body_measurements")
        .select("log_date, weight_kg")
        .eq("user_id", userId)
        .gte("log_date", start)
        .not("weight_kg", "is", null)
        .order("log_date", { ascending: true });

      setWeightLogs(
        (measurements ?? [])
          .filter((measurement) => typeof measurement.weight_kg === "number")
          .map((measurement) => ({
            log_date: measurement.log_date,
            weight_kg: Number(measurement.weight_kg),
          }))
      );
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="rounded-[20px] bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] ring-1 ring-slate-200/60">
        <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (weightLogs.length === 0) {
    return (
      <div className="rounded-[20px] bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.03)] ring-1 ring-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Scale className="h-[16px] w-[16px]" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[14px] font-extrabold tracking-[-0.01em] text-slate-950">Transformation Journey</p>
            <p className="text-[11px] font-medium text-slate-500">Log body metrics to build your trend.</p>
          </div>
        </div>
      </div>
    );
  }

  const firstWeight = weightLogs[0]?.weight_kg ?? 0;
  const lastWeight = weightLogs[weightLogs.length - 1]?.weight_kg ?? 0;
  const lost = firstWeight - lastWeight;
  const metaphor = weightLossMetaphor(Math.abs(lost));

  const maxWeight = Math.max(...weightLogs.map(w => w.weight_kg));
  const minWeight = Math.min(...weightLogs.map(w => w.weight_kg));
  const range = maxWeight - minWeight || 10;

  // Calculate 7-day trend
  const recent = weightLogs.slice(-7);
  const recentTrend = recent.length >= 2 ? recent[recent.length - 1].weight_kg - recent[0].weight_kg : 0;

  return (
    <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.03)] ring-1 ring-slate-200/60">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-[0_6px_12px_rgba(16,185,129,0.15)]">
            <TrendingDown className="h-[16px] w-[16px] text-white" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[14px] font-extrabold tracking-[-0.01em] text-slate-950">Transformation Journey</p>
            <p className="text-[11px] font-medium text-slate-400">{weightLogs.length} months tracked</p>
          </div>
        </div>
        <button className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 transition-colors hover:bg-emerald-100">
          <Camera className="h-[13px] w-[13px]" />
          Photo
        </button>
      </div>

      {/* Milestone Banner */}
      {lost > 0 && (
        <div className="mx-5 mt-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 p-4 ring-1 ring-emerald-100/60">
          <p className="text-[13px] font-semibold text-slate-700 leading-relaxed">
            You've lost <span className="font-extrabold text-emerald-600">{Math.abs(lost).toFixed(1)}kg</span> since{" "}
            {new Date(weightLogs[0].log_date).toLocaleString("default", { month: "long" })}.
            That's the weight of {metaphor.animal}! {metaphor.emoji}
          </p>
          {recentTrend < 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500">
              <ArrowDown className="h-[13px] w-[13px]" strokeWidth={2.5} />
              Down {Math.abs(recentTrend).toFixed(1)}kg this week — keep going!
            </div>
          )}
          {recentTrend > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-amber-500">
              <ArrowUp className="h-[13px] w-[13px]" strokeWidth={2.5} />
              Up {recentTrend.toFixed(1)}kg — time to refocus!
            </div>
          )}
        </div>
      )}

      {/* Monthly Milestones Bar */}
      <div className="mt-4 px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400 mb-2">Monthly Progress</p>
        <div className="flex justify-between">
          {weightLogs.filter((_, i) => i % 30 === 0 || i === 0 || i === weightLogs.length - 1).map((log, i) => {
            const month = new Date(log.log_date);
            const monthLabel = month.toLocaleString("default", { month: "short" });
            const height = ((log.weight_kg - minWeight) / range) * 60 + 20;
            return (
              <div key={log.log_date} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-500">{log.weight_kg}kg</span>
                <div
                  className="w-3 rounded-t-md bg-gradient-to-t from-emerald-400 to-teal-400 transition-all"
                  style={{ height: `${height}px` }}
                />
                <span className="text-[10px] font-medium text-slate-400">{monthLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Start → Now comparison */}
      <div className="mx-5 mt-3 mb-5 flex items-center justify-between rounded-2xl bg-slate-50 p-3.5">
        <div className="text-center">
          <p className="text-[10px] font-medium text-slate-400">START</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-slate-700">{firstWeight}kg</p>
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="h-[2px] flex-1 bg-gradient-to-r from-slate-300 via-emerald-300 to-emerald-500" />
          <div className="mx-2 rounded-full bg-emerald-100 px-2.5 py-1">
            <p className="text-[11px] font-extrabold text-emerald-600">
              {lost > 0 ? `-${lost.toFixed(1)}kg` : lost < 0 ? `+${Math.abs(lost).toFixed(1)}kg` : "—"}
            </p>
          </div>
          <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-500 to-emerald-300" />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-medium text-slate-400">NOW</p>
          <p className="mt-0.5 text-[16px] font-extrabold text-emerald-600">{lastWeight}kg</p>
        </div>
      </div>
    </div>
  );
}
