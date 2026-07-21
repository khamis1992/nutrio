import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Route, Store } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SupplierQualitySnapshot {
  id: string;
  branch_id: string;
  branch_name: string;
  restaurant_name: string;
  quality_score: number;
  quality_status: "excellent" | "healthy" | "watch" | "restricted";
  routing_adjustment: number;
  delivered_orders: number;
  on_time_orders: number;
  average_rating: number | null;
  weighted_incident_count: number;
  nutrition_sample_count: number;
  nutrition_pass_count: number;
  calculated_at: string;
}

type Rpc = <T>(name: string, args?: Record<string, unknown>) => Promise<{
  data: T | null;
  error: { message?: string } | null;
}>;
const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

const statusStyle: Record<SupplierQualitySnapshot["quality_status"], string> = {
  excellent: "bg-[#E9FBF6] text-[#0F8F75]",
  healthy: "bg-[#EEF9FF] text-[#0284C7]",
  watch: "bg-[#FFF7ED] text-[#EA580C]",
  restricted: "bg-[#FFF1F3] text-[#E5485A]",
};

export function SupplierQualityOperations() {
  const [items, setItems] = useState<SupplierQualitySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await rpc<unknown>("list_supplier_quality_snapshots");
      if (error) throw new Error(error.message || "Could not load supplier quality");
      setItems(Array.isArray(data) ? data as SupplierQualitySnapshot[] : []);
    } catch (error) {
      console.error("Failed to load supplier quality:", error);
      toast.error("Could not load supplier quality");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await rpc<number>("refresh_supplier_quality_snapshots", { p_window_days: 90 });
      if (error) throw new Error(error.message || "Could not refresh supplier quality");
      await load();
      toast.success("Supplier quality refreshed from the last 90 days");
    } catch (error) {
      console.error("Failed to refresh supplier quality:", error);
      toast.error("AAL2 admin verification is required to refresh quality");
    } finally {
      setRefreshing(false);
    }
  };

  const watchCount = useMemo(
    () => items.filter((item) => item.quality_status === "watch" || item.quality_status === "restricted").length,
    [items],
  );

  return (
    <section className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">Supplier operations</p>
          <h2 className="mt-1 text-lg font-black text-[#020617]">Branch quality and routing</h2>
          <p className="mt-1 max-w-xl text-xs font-semibold leading-5 text-[#64748B]">
            Delivery, preparation, verified reviews, incidents, and nutrition samples from the last 90 days.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="min-h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617]"
        >
          <RefreshCw className={cn("me-2 h-4 w-4", refreshing && "animate-spin")} />
          Recalculate
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Metric icon={Store} label="Measured branches" value={items.length} color="#38BDF8" />
        <Metric icon={AlertTriangle} label="Needs attention" value={watchCount} color="#FB6B7A" />
        <Metric icon={Route} label="Routing-aware" value={items.length ? "Active" : "Pending"} color="#7C83F6" className="col-span-2 sm:col-span-1" />
      </div>

      {loading ? (
        <div className="grid min-h-32 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#7C83F6]" /></div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-[16px] bg-[#F6F8FB] p-5 text-center">
          <CheckCircle2 className="mx-auto h-6 w-6 text-[#22C7A1]" />
          <p className="mt-2 text-sm font-black text-[#020617]">Ready to calculate</p>
          <p className="mt-1 text-xs font-semibold text-[#94A3B8]">Run the first 90-day quality snapshot.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {items.map((item) => {
            const onTime = item.delivered_orders ? Math.round(item.on_time_orders / item.delivered_orders * 100) : null;
            return (
              <article key={item.id} className="rounded-[16px] bg-[#F6F8FB] p-3 ring-1 ring-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-[#020617]">{item.branch_name}</p>
                    <p className="truncate text-[11px] font-bold text-[#94A3B8]">{item.restaurant_name}</p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black capitalize", statusStyle[item.quality_status])}>
                    {item.quality_status} {Math.round(item.quality_score)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1 text-center">
                  <MiniMetric label="On time" value={onTime === null ? "--" : `${onTime}%`} />
                  <MiniMetric label="Rating" value={item.average_rating?.toFixed(1) ?? "--"} />
                  <MiniMetric label="Incidents" value={item.weighted_incident_count} />
                  <MiniMetric label="Route" value={`${item.routing_adjustment > 0 ? "+" : ""}${item.routing_adjustment}`} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Metric({ icon: Icon, label, value, color, className }: { icon: typeof Store; label: string; value: string | number; color: string; className?: string }) {
  return (
    <div className={cn("rounded-[14px] bg-[#F6F8FB] p-3", className)}>
      <Icon className="h-4 w-4" style={{ color }} />
      <p className="mt-2 text-lg font-black text-[#020617]">{value}</p>
      <p className="text-[10px] font-bold text-[#94A3B8]">{label}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl bg-white px-1 py-2">
      <p className="truncate text-xs font-black text-[#020617]">{value}</p>
      <p className="truncate text-[8px] font-bold uppercase text-[#94A3B8]">{label}</p>
    </div>
  );
}
