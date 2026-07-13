import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns";
import { ArrowLeft, CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Droplets, Loader2, Pencil, Plus, Target, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavChevronLeft, NavChevronRight } from "@/components/ui/nav-chevron";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { cn } from "@/lib/utils";

const DEFAULT_DRINK_ML = 200;
const WEEK_DAYS = 7;
const PRESET_ML = [100, 125, 150, 200, 250, 300, 350, 400, 500, 600];
const MAX_PRESET = 600;

function WaterCupIcon({ fillPercent }: { fillPercent: number }) {
  const cupHeight = 20;
  const h = Math.max(4, Math.round((fillPercent / 100) * cupHeight));

  return (
    <svg viewBox="0 0 24 28" className="h-9 w-9">
      <path
        d="M5 4h14l-1.5 18H6.5L5 4z"
        fill="none"
        stroke="#38BDF8"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="7" y={22 - h} width="10" height={h} rx="1" fill="#38BDF8" />
    </svg>
  );
}

function CalendarDayCell({
  date,
  isCurrentMonth,
  isSelected,
  isToday: dayIsToday,
  progressPct,
  onClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
  progressPct: number;
  onClick: () => void;
}) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (progressPct / 100) * circ;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-2xl text-[13px] font-black transition-colors",
        !isCurrentMonth && "text-[#94A3B8]/60",
        isCurrentMonth && !isSelected && !dayIsToday && "bg-white text-[#020617] ring-1 ring-[#E5EAF1]",
        isSelected && "bg-[#020617] text-white shadow-[0_12px_24px_rgba(2,6,23,0.18)]",
        dayIsToday && !isSelected && "bg-[#E0F7FE] text-[#020617] ring-1 ring-[#BAE6FD]"
      )}
    >
      <span className="relative z-10">{format(date, "d")}</span>
      {isCurrentMonth && (progressPct > 0 || isSelected) && (
        <svg className="pointer-events-none absolute h-10 w-10 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r={r} fill="none" stroke="#E5EAF1" strokeWidth="2" />
          {progressPct > 0 && (
            <circle
              cx="16"
              cy="16"
              r={r}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={progressPct >= 100 ? `${circ} ${circ}` : `${dash} ${circ}`}
            />
          )}
        </svg>
      )}
    </button>
  );
}

function CalendarView({
  calendarMonth,
  setCalendarMonth,
  selectedDate,
  setSelectedDate,
  monthTotals,
  goalMl,
  onClose,
}: {
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  monthTotals: Record<string, number>;
  goalMl: number;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const dayHeaders = [t("water_mon"), t("water_tue"), t("water_wed"), t("water_thu"), t("water_fri"), t("water_sat"), t("water_sun")];
  const weekStartsOn = 1;
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });
  const days: Date[] = [];
  let d = calendarStart;

  while (d <= calendarEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  return (
    <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#020617]"
        >
          <NavChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-[15px] font-black text-[#020617]">{format(calendarMonth, "MMMM yyyy")}</span>
        <button
          type="button"
          onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#020617]"
        >
          <NavChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {dayHeaders.map((h) => (
          <div key={h} className="py-1 text-center text-[10px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">
            {h}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((date) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const total = monthTotals[dateStr] || 0;
          const progressPct = goalMl > 0 ? Math.min(100, Math.round((total / goalMl) * 100)) : 0;

          return (
            <div key={dateStr} className="flex justify-center">
              <CalendarDayCell
                date={date}
                isCurrentMonth={isSameMonth(date, calendarMonth)}
                isSelected={isSameDay(date, selectedDate)}
                isToday={isToday(date)}
                progressPct={progressPct}
                onClick={() => setSelectedDate(date)}
              />
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-4 flex w-full justify-center rounded-2xl bg-[#F6F8FB] p-2 text-[#94A3B8] transition-colors hover:text-[#020617]"
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function WaterTracker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const {
    entries,
    totalMl,
    goalMl,
    setGoalMl,
    percentage,
    loading,
    fetchEntries,
    fetchMonthTotals,
    addEntry,
    deleteEntry,
  } = useWaterEntries(user?.id);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [monthTotals, setMonthTotals] = useState<Record<string, number>>({});
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [addWaterSheetOpen, setAddWaterSheetOpen] = useState(false);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customMl, setCustomMl] = useState("");
  const [adding, setAdding] = useState(false);

  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");

  useEffect(() => {
    fetchEntries(selectedDateStr);
  }, [fetchEntries, selectedDateStr]);

  useEffect(() => {
    if (calendarOpen && user) {
      const y = calendarMonth.getFullYear();
      const m = calendarMonth.getMonth() + 1;
      fetchMonthTotals(y, m).then(setMonthTotals);
    }
  }, [calendarOpen, calendarMonth, fetchMonthTotals, user]);

  const weekDates = Array.from({ length: WEEK_DAYS }, (_, i) =>
    subDays(selectedDate, Math.floor(WEEK_DAYS / 2) - i)
  );

  const refreshMonthTotals = () => {
    if (!calendarOpen) return;
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth() + 1;
    fetchMonthTotals(y, m).then(setMonthTotals);
  };

  const handleDrink = async (ml: number) => {
    if (!user) {
      toast({ title: t("auth_sign_in_required"), description: t("water_sign_in_to_log"), variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      await addEntry(selectedDateStr, ml);
      toast({ title: t("water_logged"), description: `${ml} ${t("water_ml_added")}` });
      refreshMonthTotals();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err && typeof (err as { message: string }).message === "string"
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : t("water_failed_to_add");
      const isTableMissing = typeof msg === "string" && (msg.includes("relation") || msg.includes("does not exist"));
      toast({
        title: t("water_failed_to_add"),
        description: isTableMissing ? t("water_table_missing") : msg,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handlePresetDrink = async (ml: number) => {
    setAddWaterSheetOpen(false);
    await handleDrink(ml);
  };

  const openCustomDialog = () => {
    setAddWaterSheetOpen(false);
    setCustomMl("");
    setCustomDialogOpen(true);
  };

  const handleCustomDrink = async () => {
    const ml = parseInt(customMl, 10);
    if (isNaN(ml) || ml <= 0) return;
    setCustomDialogOpen(false);
    setCustomMl("");
    await handleDrink(ml);
  };

  const handleSaveGoal = async () => {
    const ml = parseInt(goalInput, 10);
    if (isNaN(ml) || ml <= 0) return;
    try {
      await setGoalMl(ml);
      setGoalDialogOpen(false);
      setGoalInput("");
      toast({ title: t("water_goal_updated"), description: `${t("water_daily_goal")}: ${ml.toLocaleString()} ${t("water_ml")}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("water_failed_to_add");
      toast({ title: t("water_failed_to_add"), description: message, variant: "destructive" });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteEntry(id);
      toast({ title: "Water log removed" });
      refreshMonthTotals();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("water_failed_to_add");
      toast({ title: t("water_failed_to_add"), description: msg, variant: "destructive" });
    }
  };

  const displayPercentage = Math.min(100, percentage);
  const remainingMl = Math.max(0, goalMl - totalMl);
  const selectedLabel = isToday(selectedDate) ? "Today" : format(selectedDate, "EEE, MMM d");
  const quickAmounts = [DEFAULT_DRINK_ML, 350, 500];

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-28 text-[#020617]">
      <div className="sticky top-0 z-20 border-b border-[#E5EAF1] bg-[#F6F8FB]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[430px] items-center justify-between px-4 py-4">
          <button
            data-testid="water-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_10px_24px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#38BDF8]">{selectedLabel}</p>
            <h1 className="text-[22px] font-black leading-tight text-[#020617]">{t("water_title")}</h1>
          </div>
          <button
            data-testid="water-goal-btn"
            onClick={() => {
              setGoalInput(String(goalMl));
              setGoalDialogOpen(true);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_14px_28px_rgba(2,6,23,0.2)]"
            aria-label={t("water_daily_goal")}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[32px] border border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#38BDF8]">{t("water_intake_label")}</p>
              <div className="mt-3 flex items-end gap-2">
                {loading ? (
                  <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#94A3B8]" />
                ) : (
                  <span className="text-[44px] font-black leading-none">{totalMl.toLocaleString()}</span>
                )}
                <span className="mb-1 text-[12px] font-extrabold text-[#94A3B8]">mL</span>
              </div>
              <p className="mt-2 text-[12px] font-semibold text-[#020617]">
                {remainingMl.toLocaleString()} mL remaining to {goalMl.toLocaleString()} mL
              </p>
            </div>
            <div className="relative h-[124px] w-[124px] shrink-0">
              <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
                <circle cx="64" cy="64" r="54" fill="none" stroke="#EEF3F8" strokeWidth="12" />
                <circle
                  cx="64"
                  cy="64"
                  r="54"
                  fill="none"
                  stroke="#38BDF8"
                  strokeLinecap="round"
                  strokeWidth="12"
                  strokeDasharray={`${(displayPercentage / 100) * 339.29} 339.29`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Droplets className="h-6 w-6 text-[#38BDF8]" />
                <span className="mt-1 text-[24px] font-black">{displayPercentage}%</span>
                <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">goal</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-[#E5EAF1] bg-[#F6F8FB]">
            <div className="px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">logged</p>
              <p className="mt-1 text-[15px] font-black">{entries.length}</p>
            </div>
            <div className="border-x border-[#E5EAF1] px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">goal</p>
              <p className="mt-1 text-[15px] font-black">{goalMl.toLocaleString()}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">status</p>
              <p className="mt-1 text-[15px] font-black">{displayPercentage >= 100 ? "Done" : "Active"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">quick log</p>
              <h2 className="text-[18px] font-black text-[#020617]">{t("water_add_water")}</h2>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E0F7FE] text-[#38BDF8]">
              <Droplets className="h-5 w-5" />
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => handleDrink(ml)}
                disabled={adding}
                className="min-h-[72px] rounded-[22px] border border-[#D9F3FD] bg-[#F6FCFF] px-2 text-center transition active:scale-[0.98] disabled:opacity-50"
              >
                <span className="block text-[19px] font-black text-[#020617]">{ml}</span>
                <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.08em] text-[#38BDF8]">mL</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAddWaterSheetOpen(true)}
              className="min-h-[72px] rounded-[22px] bg-[#020617] px-2 text-center text-white shadow-[0_12px_24px_rgba(2,6,23,0.18)] transition active:scale-[0.98]"
            >
              <Plus className="mx-auto h-5 w-5" />
              <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.08em]">more</span>
            </button>
          </div>
        </section>

        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
          {!calendarOpen ? (
            <>
              <div className="flex items-center justify-between px-1 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F6F8FB] text-[#020617]">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">date</p>
                    <p className="text-[14px] font-black text-[#020617]">{format(selectedDate, "MMMM d")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarMonth(selectedDate);
                    setCalendarOpen(true);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F8FB] text-[#94A3B8]"
                >
                  <ChevronDown className="h-5 w-5" />
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {weekDates.map((d) => (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      "flex min-h-[64px] min-w-[52px] flex-col items-center justify-center rounded-2xl transition-all",
                      isSameDay(d, selectedDate)
                        ? "bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.18)]"
                        : "bg-[#F6F8FB] text-[#94A3B8]"
                    )}
                  >
                    <span className="text-[10px] font-black uppercase">{format(d, "EEE")}</span>
                    <span className="mt-1 text-[18px] font-black">{format(d, "d")}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <CalendarView
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              monthTotals={monthTotals}
              goalMl={goalMl}
              onClose={() => setCalendarOpen(false)}
            />
          )}
        </section>

        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">today history</p>
              <h2 className="text-[18px] font-black text-[#020617]">{entries.length} logs</h2>
            </div>
            <span className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full",
              displayPercentage >= 100 ? "bg-[#E6FBF5] text-[#22C7A1]" : "bg-[#FFF1F3] text-[#FB6B7A]"
            )}>
              {displayPercentage >= 100 ? <CheckCircle2 className="h-5 w-5" /> : <Target className="h-5 w-5" />}
            </span>
          </div>

          {entries.length === 0 ? (
            <div className="rounded-[24px] bg-[#F6F8FB] px-4 py-6 text-center">
              <Droplets className="mx-auto h-7 w-7 text-[#38BDF8]" />
              <p className="mt-2 text-[13px] font-black text-[#020617]">No water logged yet</p>
              <p className="mt-1 text-[11px] font-semibold text-[#94A3B8]">Start with a quick amount above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-[22px] bg-[#F6F8FB] px-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E0F7FE] text-[#38BDF8]">
                      <Droplets className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[15px] font-black text-[#020617]">{entry.amount_ml.toLocaleString()} mL</p>
                      <p className="text-[10px] font-bold text-[#94A3B8]">{entry.created_at ? format(new Date(entry.created_at), "h:mm a") : "--"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#FB6B7A] ring-1 ring-[#E5EAF1]"
                    aria-label="Delete water log"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-[390px] rounded-[28px] border-[#E5EAF1] p-5">
          <DialogHeader>
            <DialogTitle className="text-center text-[20px] font-black text-[#020617]">{t("water_daily_goal")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-[12px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{t("water_goal_ml")}</Label>
              <Input
                type="number"
                min="500"
                max="10000"
                step="100"
                placeholder="2500"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="mt-2 h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-center text-[22px] font-black text-[#020617]"
              />
            </div>
            <Button onClick={handleSaveGoal} disabled={!goalInput} className="h-12 w-full rounded-full bg-[#020617] text-white hover:bg-[#020617]/90">
              {t("water_save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={addWaterSheetOpen} onOpenChange={setAddWaterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[78dvh] overflow-y-auto rounded-t-[32px] border-[#E5EAF1] bg-white px-4 pb-28">
          <SheetHeader className="sticky top-0 z-10 bg-white pb-5 pt-2">
            <SheetTitle className="text-center text-[20px] font-black text-[#020617]">{t("water_add_water")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-3 pb-2">
            {PRESET_ML.map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => handlePresetDrink(ml)}
                disabled={adding}
                className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-2 transition active:scale-[0.98] disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                  <WaterCupIcon fillPercent={(ml / MAX_PRESET) * 100} />
                </span>
                <span className="text-[12px] font-black text-[#020617]">{ml}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={openCustomDialog}
              className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[22px] bg-[#020617] p-2 text-white transition active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[11px] font-black">Custom</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="max-w-[390px] rounded-[28px] border-[#E5EAF1] p-5">
          <DialogHeader>
            <DialogTitle className="text-center text-[20px] font-black text-[#020617]">{t("water_add_water")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-[12px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{t("water_amount_ml")}</Label>
              <Input
                type="number"
                min="50"
                max="2000"
                step="50"
                placeholder="200"
                value={customMl}
                onChange={(e) => setCustomMl(e.target.value)}
                className="mt-2 h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-center text-[22px] font-black text-[#020617]"
              />
            </div>
            <Button
              onClick={handleCustomDrink}
              disabled={!customMl || parseInt(customMl, 10) <= 0}
              className="h-12 w-full rounded-full bg-[#020617] text-white hover:bg-[#020617]/90"
            >
              {t("water_add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
