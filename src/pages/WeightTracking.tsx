import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowDown, ArrowUp, Trash2,
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
import { useLanguage } from "@/contexts/LanguageContext";
import { NavChevronLeft, NavChevronRight } from "@/components/ui/nav-chevron";

interface WeightEntry {
  id: string;
  weight_kg: number;
  log_date: string;
}

function formatEntryDate(dateStr: string, t: (key: string) => string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return `${t('today')}, ${format(d, "MMM d, yyyy")}`;
  if (isYesterday(d)) return `${t('yesterday')}, ${format(d, "MMM d, yyyy")}`;
  return format(d, "MMM d, yyyy");
}


export default function WeightTracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { t } = useLanguage();

  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showAll, setShowAll] = useState(false);

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
      toast.success(t('weight_updated'));
      setSheetOpen(false);
      fetchEntries();
    } catch {
      toast.error(t('failed_to_update'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm(t('confirm_delete_weight'))) return;
    const { error } = await supabase.from("body_measurements").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      toast.error(t('failed_to_delete'));
    } else {
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success(t('delete_success'));
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const displayed = showAll ? entries : entries.slice(0, 7);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4 rtl:flex-row-reverse">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('weight_tracker')}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Current weight card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 mb-1">{t('current')}</p>

          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-5xl font-black text-gray-900">{currentWeight?.toFixed(1) ?? "--"}</span>
            <span className="text-lg font-semibold text-gray-400">{t('kg')}</span>
            {change != null && (
              <span className={cn("flex items-center gap-1.5 text-sm font-semibold", change <= 0 ? "text-emerald-600" : "text-red-500")}>
                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center", change <= 0 ? "bg-emerald-500" : "bg-red-500")}>
                  {change <= 0 ? <ArrowDown className="w-3 h-3 text-white" /> : <ArrowUp className="w-3 h-3 text-white" />}
                </span>
                {change > 0 ? "+" : ""}{change.toFixed(1)} {t('kg')}
              </span>
            )}
          </div>

          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-1.5">
            <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-5">
            <span>{t('starting')}: {startWeight?.toFixed(1) ?? "--"} {t('kg')}</span>
            <span>{t('goal')}: {goalWeight?.toFixed(1) ?? "--"} {t('kg')}</span>
          </div>

          <button
            onClick={openSheet}
            className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-bold text-base transition-all"
          >
            {t('update')}
          </button>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-bold text-gray-900">{t('history')}</h2>
            {entries.length > 7 && (
              <button onClick={() => setShowAll((p) => !p)} className="text-sm text-orange-500 font-semibold flex items-center gap-1">
                {showAll ? t('show_less') : t('view_all')} →
              </button>
            )}
          </div>

          {displayed.length === 0 ? (
            <p className="text-sm text-gray-400 px-5 pb-5">{t('no_entries_yet')}</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayed.map((entry, i) => {
                const next = entries[i + 1];
                const diff = next?.weight_kg != null ? entry.weight_kg - next.weight_kg : null;
                return (
                  <div key={entry.id} className="flex items-center px-5 py-3.5 relative">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{entry.weight_kg.toFixed(1)} {t('kg')}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatEntryDate(entry.log_date, t)}</p>
                    </div>

                    {diff != null && (
                      <span className={cn("flex items-center gap-1.5 text-sm font-semibold mr-3", diff <= 0 ? "text-emerald-600" : "text-red-500")}>
                        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0", diff <= 0 ? "bg-emerald-500" : "bg-red-500")}>
                          {diff <= 0 ? <ArrowDown className="w-3.5 h-3.5 text-white" /> : <ArrowUp className="w-3.5 h-3.5 text-white" />}
                        </span>
                        {diff > 0 ? "+" : ""}{diff.toFixed(1)} {t('kg')}
                      </span>
                    )}

                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Update Weight Bottom Sheet ── */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheetOpen(false)} />

          <div className="relative bg-white rounded-t-3xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh", marginBottom: 84 }}>
            {/* Handle */}
            <div className="flex-none flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            {/* Title */}
            <h2 className="flex-none text-center text-lg font-bold text-gray-900 py-3">{t('update_weight')}</h2>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pb-2">
              {/* Week date selector */}
              <div className="pb-4">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setWeekStart(subWeeks(weekStart, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                    <NavChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <span className="font-semibold text-gray-900 text-sm">{format(sheetDate, "MMMM yyyy")}</span>
                  <button onClick={() => setWeekStart(addWeeks(weekStart, 1))} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
                    <NavChevronRight className="w-5 h-5 text-gray-600" />
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
              <div className="bg-gray-50 rounded-2xl flex items-center justify-center gap-3 py-6">
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
                <span className="text-2xl font-semibold text-gray-400">{t('kg')}</span>
              </div>
            </div>

            {/* Cancel / Save — pinned to bottom with safe space */}
            <div className="flex-none flex gap-3 px-4 pt-3 pb-5 bg-white border-t border-gray-100">
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-1 rounded-full border-2 border-orange-500 text-orange-500 font-bold text-base hover:bg-orange-50 transition-all"
                style={{ height: 52 }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={submitting || !sheetWeight || parseFloat(sheetWeight) <= 0}
                className="flex-1 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-base transition-all active:scale-[0.98]"
                style={{ height: 52 }}
              >
                {submitting ? t('saving') : t('save')}
              </button>
            </div>

          </div>
        </div>
      )}

      <CustomerNavigation />
    </div>
  );
}
