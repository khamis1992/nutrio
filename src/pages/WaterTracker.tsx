import { getNavArrows } from "@/lib/rtl";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { format, subDays, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns";

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
import { ArrowLeft, Droplets, ChevronDown, ChevronUp, Pencil, Loader2, Plus } from "lucide-react";
import { NavChevronLeft, NavChevronRight } from "@/components/ui/nav-chevron";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DEFAULT_DRINK_ML = 200;
const WEEK_DAYS = 7;

const PRESET_ML = [100, 125, 150, 200, 250, 300, 350, 400, 500, 600];
const MAX_PRESET = 600;

function WaterCupIcon({ fillPercent }: { fillPercent: number }) {
  const cupHeight = 20;
  const h = Math.max(4, Math.round((fillPercent / 100) * cupHeight));
  return (
    <svg viewBox="0 0 24 28" className="w-10 h-10">
      <path
        d="M5 4h14l-1.5 18H6.5L5 4z"
        fill="none"
        stroke="#93c5fd"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="7" y={22 - h} width="10" height={h} rx="1" fill="#60a5fa" />
    </svg>
  );
}

function CalendarDayCell({
  date,
  isCurrentMonth,
  isSelected,
  isToday,
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
        "relative flex items-center justify-center w-10 h-10 rounded-full transition-colors",
        !isCurrentMonth && "text-muted-foreground",
        isCurrentMonth && !isSelected && !isToday && "text-foreground",
        isSelected && "text-primary font-bold",
        isToday && !isSelected && "text-foreground"
      )}
    >
      <span className="relative z-10">{format(date, "d")}</span>
      {isCurrentMonth && (progressPct > 0 || isSelected) && (
        <svg className="absolute w-10 h-10 -rotate-90 pointer-events-none" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r={r} fill="none" stroke="#e5e7eb" strokeWidth="2" />
          {progressPct > 0 && (
            <circle
              cx="16"
              cy="16"
              r={r}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={progressPct >= 100 ? `${circ} ${circ}` : `${dash} ${circ}`}
            />
          )}
        </svg>
      )}
      {isCurrentMonth && progressPct === 0 && !isSelected && (
        <span className="absolute inset-0 rounded-full border border-border pointer-events-none" />
      )}
      {!isCurrentMonth && (
        <span className="absolute inset-0 rounded-full border border-transparent pointer-events-none" />
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
  const { t, isRTL } = useLanguage();
  const dayHeaders = [t('water_mon'), t('water_tue'), t('water_wed'), t('water_thu'), t('water_fri'), t('water_sat'), t('water_sun')];
  const weekStartsOn = 1; // Monday
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
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <NavChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-bold text-foreground">
          {format(calendarMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          className="p-2 rounded-full hover:bg-muted text-muted-foreground"
        >
          <NavChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-muted-foreground py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
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
                onClick={() => {
                  setSelectedDate(date);
                }}
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="flex justify-center w-full mt-4 p-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </div>
  );
}

export default function WaterTracker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const {
    totalMl,
    goalMl,
    setGoalMl,
    percentage,
    loading,
    fetchEntries,
    fetchMonthTotals,
    addEntry,
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

  const handleDrink = async (ml: number) => {
    if (!user) {
      toast({ title: t('auth_sign_in_required'), description: t('water_sign_in_to_log'), variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await addEntry(selectedDateStr, ml);
      toast({ title: t('water_logged'), description: `${ml} ${t('water_ml_added')}` });
      if (calendarOpen) {
        const y = calendarMonth.getFullYear();
        const m = calendarMonth.getMonth() + 1;
        fetchMonthTotals(y, m).then(setMonthTotals);
      }
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err && typeof (err as { message: string }).message === "string"
          ? (err as { message: string }).message
          : err instanceof Error
            ? err.message
            : t('water_failed_to_add');
      const isTableMissing = typeof msg === "string" && (msg.includes("relation") || msg.includes("does not exist"));
      toast({
        title: t('water_failed_to_add'),
        description: isTableMissing ? t('water_table_missing') : msg,
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleCustomDrink = async () => {
    const ml = parseInt(customMl, 10);
    if (isNaN(ml) || ml <= 0) return;
    setCustomDialogOpen(false);
    setCustomMl("");
    await handleDrink(ml);
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

  const handleSaveGoal = () => {
    const ml = parseInt(goalInput, 10);
    if (isNaN(ml) || ml <= 0) return;
    setGoalMl(ml);
    setGoalDialogOpen(false);
    setGoalInput("");
    toast({ title: t('water_goal_updated'), description: `${t('water_daily_goal')}: ${ml.toLocaleString()} ${t('water_ml')}` });
  };

  const fillHeight = Math.min(100, percentage);
  const waterTopY = 140 - (fillHeight / 100) * 120;

  return (
    <div className="min-h-screen bg-[#F7FAF8] pb-36">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-blue-50/90 bg-[#F7FAF8]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[430px] items-center justify-between px-4 py-4 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-500">
              {format(selectedDate, "EEE, MMM d")}
            </p>
            <h1 className="text-[22px] font-black leading-tight text-slate-950">{t('water_title')}</h1>
          </div>
          <button
            onClick={() => {
              setGoalInput(String(goalMl));
              setGoalDialogOpen(true);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-white shadow-[0_12px_24px_rgba(59,130,246,0.22)]"
            aria-label={t('water_daily_goal')}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>

        {/* Date selector / Calendar */}
        <div className="mx-auto max-w-[430px] px-4 pb-4">
          {!calendarOpen ? (
            <>
              <div className="flex items-center justify-between gap-2 overflow-x-auto">
                {weekDates.map((d) => (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      "flex min-h-[58px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-3 transition-all",
                      isSameDay(d, selectedDate)
                        ? "bg-blue-500 text-white shadow-[0_10px_20px_rgba(59,130,246,0.18)]"
                        : "bg-white text-slate-500 ring-1 ring-slate-100"
                    )}
                  >
                    <span className="text-[10px] font-extrabold uppercase">{format(d, "EEE")}</span>
                    <span className="text-base font-black">{format(d, "d")}</span>
                    {isSameDay(d, selectedDate) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setCalendarMonth(selectedDate);
                  setCalendarOpen(true);
                }}
                className="flex justify-center w-full mt-2 p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
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
        </div>
      </div>

      <div className="mx-auto max-w-[430px] px-4 py-5">
        {/* Water glass + progress */}
        <div className="flex flex-col items-center rounded-[32px] bg-white px-5 py-7 shadow-[0_18px_38px_rgba(15,23,42,0.07)] ring-1 ring-slate-100">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-500">
            <Droplets className="h-6 w-6" />
          </div>
          <div className="relative mb-4 h-52 w-44">
            <svg viewBox="0 0 120 160" className="water w-full h-full">
              <defs>
                <clipPath id="glassClip">
                  <path d="M35 20 L85 20 L80 140 L40 140 Z" />
                </clipPath>
                <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <filter id="waterShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="2" stdDeviation="1" floodOpacity="0.15" />
                </filter>
              </defs>
              {/* Glass outline — tapered shape */}
              <path
                d="M35 20 L85 20 L80 140 L40 140 Z"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="3"
              />
              {/* Water fill — from bottom y=140 */}
              <g clipPath="url(#glassClip)">
                <path
                  d={`M40 140 L40 ${waterTopY - 2} Q60 ${waterTopY + 2} 80 ${waterTopY - 2} L80 140 Z`}
                  fill="url(#waterGradient)"
                  filter="url(#waterShadow)"
                  opacity={fillHeight > 0 ? 1 : 0}
                />
              </g>
            </svg>
          </div>
          {loading ? (
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <p className="text-[38px] font-black leading-none text-slate-950">{totalMl.toLocaleString()}</p>
              <p className="mt-1 text-[13px] font-extrabold text-slate-400">{t('water_ml')}</p>
              <div className="mt-5 w-full rounded-2xl bg-blue-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12px] font-extrabold text-blue-600">{Math.min(100, percentage)}%</p>
                  <p className="text-[12px] font-bold text-slate-500">{goalMl.toLocaleString()} {t('water_ml')}</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom action bar - above nav */}
      <div className="fixed bottom-20 left-0 right-0 z-40 border-t border-blue-50/80 bg-white/92 px-4 py-3 shadow-[0_-16px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl" style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <div className="mx-auto flex max-w-[430px] items-center gap-3">
          <Button
            onClick={() => handleDrink(DEFAULT_DRINK_ML)}
            disabled={adding}
            className="h-14 flex-1 rounded-full bg-blue-500 px-4 text-white shadow-[0_14px_28px_rgba(59,130,246,0.24)] hover:bg-blue-600 disabled:opacity-50"
          >
            {adding ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex w-full items-center justify-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <Droplets className="h-5 w-5" />
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[15px] font-black">Add 200 mL</span>
                  <span className="text-[10px] font-bold text-blue-100">Quick drink</span>
                </span>
              </span>
            )}
          </Button>
          <button
            type="button"
            onClick={() => setAddWaterSheetOpen(true)}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-500 shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-blue-100"
            aria-label={t('water_add_water')}
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Goal edit dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('water_daily_goal')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t('water_goal_ml')}</Label>
              <Input
                type="number"
                min="500"
                max="10000"
                step="100"
                placeholder="2500"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="mt-2 rounded-xl h-12"
              />
            </div>
            <Button onClick={handleSaveGoal} disabled={!goalInput} className="w-full h-12 rounded-xl">
              {t('water_save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add water sheet — preset grid */}
      <Sheet open={addWaterSheetOpen} onOpenChange={setAddWaterSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-safe">
          <SheetHeader className="pb-6">
            <SheetTitle className="text-center">{t('water_add_water')}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-4">
            {PRESET_ML.map((ml) => (
              <button
                key={ml}
                onClick={() => handlePresetDrink(ml)}
                disabled={adding}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-background border border-border hover:bg-muted active:bg-muted transition-colors disabled:opacity-50"
              >
                <div className="w-14 h-14 rounded-full bg-background border border-border flex items-center justify-center">
                  <WaterCupIcon fillPercent={(ml / MAX_PRESET) * 100} />
                </div>
                <span className="text-sm font-medium text-foreground">{ml} {t('water_ml')}</span>
              </button>
            ))}
            <button
              onClick={openCustomDialog}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-background border border-border hover:bg-muted active:bg-muted transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-background border border-border flex items-center justify-center">
                <Plus className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{t('water_add_new')}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Custom amount dialog */}
      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{t('water_add_water')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t('water_amount_ml')}</Label>
              <Input
                type="number"
                min="50"
                max="2000"
                step="50"
                placeholder="200"
                value={customMl}
                onChange={(e) => setCustomMl(e.target.value)}
                className="mt-2 rounded-xl h-12"
              />
            </div>
            <Button
              onClick={handleCustomDrink}
              disabled={!customMl || parseInt(customMl, 10) <= 0}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90"
            >
              {t('water_add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
