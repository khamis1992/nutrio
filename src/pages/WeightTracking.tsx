import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowDown, ArrowUp, MoreVertical, Trash2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  format, parseISO, isYesterday, isToday,
  startOfWeek, addDays, addWeeks, subWeeks, isSameDay,
} from "date-fns";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { cn } from "@/lib/utils";

interface WeightEntry {
  id: string;
  weight_kg: number;
  log_date: string;
}

function formatEntryDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return `Today, ${format(d, "MMM d, yyyy")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "MMM d, yyyy")}`;
  return format(d, "MMM d, yyyy");
}


export default function WeightTracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetWeight, setSheetWeight] = useState("");
  const [sheetDate, setSheetDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const goalWeight = profile?.target_weight_kg ?? null;
  const currentWeight = entries[0]?.weight_kg ?? null;
  const prevWeight = entries[1]?.weight_kg ?? null;
  const startWeight = entries.length > 0 ? entries[entries.length - 1].weight_kg : null;
  const change = currentWeight != null && prevWeight != null ? currentWeight - prevWeight : null;

  const progressPct =
    startWeight != null && goalWeight != null && currentWeight != null && startWeight !== goalWeight
      ? Math.min(100, Math.max(0, ((startWeight - currentWeight) / (startWeight - goalWeight)) * 100))
      : 0;

  const fetchEntries = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("body_measurements")
      .select("id, weight_kg, log_date")
      .eq("user_id", user.id)
      .not("weight_kg", "is", null)
      .order("log_date", { ascending: false });
    if (data) setEntries(data as WeightEntry[]);
  };

  useEffect(() => { fetchEntries(); }, [user]);

  const openSheet = () => {
    const today = new Date();
    setSheetDate(today);
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    setSheetWeight(currentWeight ? currentWeight.toFixed(1) : "");
    setSheetOpen(true);
  };

  const handleSave = async () => {
    const kg = parseFloat(sheetWeight);
    if (!user || isNaN(kg) || kg <= 0) return;
    setSubmitting(true);
    try {
      const dateStr = format(sheetDate, "yyyy-MM-dd");
      const { error } = await supabase
        .from("body_measurements")
        .upsert({ user_id: user.id, weight_kg: kg, log_date: dateStr }, { onConflict: "user_id,log_date" });
      if (error) throw error;
      if (isToday(sheetDate)) {
        await supabase.from("profiles").update({ current_weight_kg: kg }).eq("id", user.id);
      }
      toast.success("Weight updated");
      setSheetOpen(false);
      fetchEntries();
    } catch {
      toast.error("Failed to update weight");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("body_measurements").delete().eq("id", id).eq("user_id", user.id);
    if (!error) { toast.success("Entry deleted"); fetchEntries(); }
    setOpenMenuId(null);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayed = showAll ? entries : entries.slice(0, 7);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Weight Tracker</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Current weight card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-1">Current</p>

          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-5xl font-black text-gray-900">{currentWeight?.toFixed(1) ?? "--"}</span>
            <span className="text-lg font-semibold text-gray-400">kg</span>
            {change != null && (
              <span className={cn("flex items-center gap-1.5 text-sm font-semibold", change <= 0 ? "text-emerald-600" : "text-red-500")}>
                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center", change <= 0 ? "bg-emerald-500" : "bg-red-500")}>
                  {change <= 0 ? <ArrowDown className="w-3 h-3 text-white" /> : <ArrowUp className="w-3 h-3 text-white" />}
                </span>
                {change > 0 ? "+" : ""}{change.toFixed(1)} kg
              </span>
            )}
          </div>

          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-5">
            <span>Starting: {startWeight?.toFixed(1) ?? "--"} kg</span>
            <span>Goal: {goalWeight?.toFixed(1) ?? "--"} kg</span>
          </div>

          <button
            onClick={openSheet}
            className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base transition-all"
          >
            Update
          </button>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-bold text-gray-900">History</h2>
            {entries.length > 7 && (
              <button onClick={() => setShowAll((p) => !p)} className="text-sm text-orange-500 font-semibold flex items-center gap-1">
                {showAll ? "Show Less" : "View All"} →
              </button>
            )}
          </div>

          {displayed.length === 0 ? (
            <p className="text-sm text-gray-400 px-5 pb-5">No entries yet. Tap Update to log your first weight.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayed.map((entry, i) => {
                const next = entries[i + 1];
                const diff = next?.weight_kg != null ? entry.weight_kg - next.weight_kg : null;
                return (
                  <div key={entry.id} className="flex items-center px-5 py-3.5 relative">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{entry.weight_kg.toFixed(1)} kg</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatEntryDate(entry.log_date)}</p>
                    </div>

                    {diff != null && (
                      <span className={cn("flex items-center gap-1.5 text-sm font-semibold mr-3", diff <= 0 ? "text-emerald-600" : "text-red-500")}>
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", diff <= 0 ? "bg-emerald-500" : "bg-red-500")}>
                          {diff <= 0 ? <ArrowDown className="w-3.5 h-3.5 text-white" /> : <ArrowUp className="w-3.5 h-3.5 text-white" />}
                        </span>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                      </span>
                    )}

                    <div className="relative">
                      <button onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === entry.id && (
                        <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[120px]">
                          <button onClick={() => handleDelete(entry.id)} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {openMenuId && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}

      {/* ── Update Weight Bottom Sheet ── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />

          <div className="relative bg-white rounded-t-3xl flex flex-col" style={{ maxHeight: "92vh" }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Title */}
            <h2 className="text-center text-lg font-bold text-gray-900 py-4">Update Weight</h2>

            {/* Week date selector */}
            <div className="px-4 pb-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <span className="font-semibold text-gray-900 text-sm">{format(sheetDate, "MMMM yyyy")}</span>
                <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Day strip */}
              <div className="flex gap-1">
                {weekDays.map((d) => {
                  const selected = isSameDay(d, sheetDate);
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSheetDate(d)}
                      className={cn(
                        "flex-1 flex flex-col items-center py-2 rounded-xl transition-all",
                        selected ? "bg-orange-500" : "hover:bg-gray-50"
                      )}
                    >
                      <span className={cn("text-xs font-medium", selected ? "text-white/80" : "text-gray-400")}>
                        {format(d, "EEE")}
                      </span>
                      <span className={cn("text-base font-bold mt-0.5", selected ? "text-white" : "text-gray-800")}>
                        {format(d, "d")}
                      </span>
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-orange-200 mt-1" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weight input */}
            <div className="mx-4 bg-gray-50 rounded-2xl flex items-center justify-center gap-3 py-5 mb-4">
              <input
                type="number"
                min="20"
                max="300"
                step="0.1"
                autoFocus
                placeholder="0.0"
                value={sheetWeight}
                onChange={(e) => setSheetWeight(e.target.value)}
                className="text-6xl font-black text-gray-900 tracking-tight bg-transparent border-none outline-none w-40 text-center"
              />
              <span className="text-2xl font-semibold text-gray-400">kg</span>
            </div>

            {/* Cancel / Save */}
            <div className="flex gap-3 px-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-1 h-12 rounded-full border-2 border-orange-500 text-orange-500 font-bold text-base hover:bg-orange-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={submitting || !sheetWeight || parseFloat(sheetWeight) <= 0}
                className="flex-1 h-12 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.98]"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>

          </div>
        </div>
      )}

      <CustomerNavigation />
    </div>
  );
}
