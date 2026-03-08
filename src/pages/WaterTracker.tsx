import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useWaterEntries } from "@/hooks/useWaterEntries";
import { format, subDays, isSameDay, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isToday } from "date-fns";
import { CustomerNavigation } from "@/components/CustomerNavigation";
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
        !isCurrentMonth && "text-gray-300",
        isCurrentMonth && !isSelected && !isToday && "text-gray-700",
        isSelected && "text-blue-600 font-bold",
        isToday && !isSelected && "text-gray-700"
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
        <span className="absolute inset-0 rounded-full border border-gray-200 pointer-events-none" />
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
  const { t } = useLanguage();
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
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
        >
          <NavChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-base font-bold text-gray-900">
          {format(calendarMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
        >
          <NavChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {dayHeaders.map((h) => (
          <div key={h} className="text-center text-xs font-medium text-gray-500 py-1">
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
        className="flex justify-center w-full mt-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <ChevronUp className="w-5 h-5" />
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
  // Glass: top y=20, bottom y=140, height=120
  const waterTopY = 140 - (fillHeight / 100) * 120;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-4 rtl:flex-row-reverse">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{t('water_title')}</h1>
          <div className="w-10 h-10" />
        </div>

        {/* Date selector / Calendar */}
        <div className="px-4 pb-4">
          {!calendarOpen ? (
            <>
              <div className="flex items-center justify-between gap-2 overflow-x-auto">
                {weekDates.map((d) => (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      "flex-shrink-0 flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all",
                      isSameDay(d, selectedDate)
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <span className="text-xs font-medium">{format(d, "EEE")}</span>
                    <span className="text-sm font-bold">{format(d, "d")}</span>
                    {isSameDay(d, selectedDate) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    )}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setCalendarMonth(selectedDate);
                  setCalendarOpen(true);
                }}
                className="flex justify-center w-full mt-2 p-2 text-gray-400 hover:text-gray-600 transition-colors"
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

      <div className="container mx-auto px-4 py-6">
        {/* Water glass + progress */}
        <div className="flex flex-col items-center py-8">
          <div className="relative w-44 h-52 mb-4">
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
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{totalMl.toLocaleString()} {t('water_ml')}</p>
              <div className="flex items-center gap-3 mt-2">
                <p className="text-sm text-gray-500">{t('water_daily_goal')}: {goalMl.toLocaleString()} {t('water_ml')}</p>
                <button
                  onClick={() => {
                    setGoalInput(String(goalMl));
                    setGoalDialogOpen(true);
                  }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom action bar - above nav */}
      <div className="fixed bottom-20 left-0 right-0 bg-background border-t border-gray-100 p-4 z-40" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <div className="container mx-auto flex items-center gap-3">
          <button
            onClick={() => setAddWaterSheetOpen(true)}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-blue-600 hover:bg-gray-200 transition-colors"
          >
            <Droplets className="w-5 h-5" />
          </button>
          <Button
            onClick={() => handleDrink(DEFAULT_DRINK_ML)}
            disabled={adding}
            className="flex-1 h-12 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : `${t('water_drink')} (${DEFAULT_DRINK_ML} ${t('water_ml')})`}
          </Button>
        </div>
      </div>

      <CustomerNavigation />

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
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <div className="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                  <WaterCupIcon fillPercent={(ml / MAX_PRESET) * 100} />
                </div>
                <span className="text-sm font-medium text-gray-700">{ml} {t('water_ml')}</span>
              </button>
            ))}
            <button
              onClick={openCustomDialog}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                <Plus className="w-6 h-6 text-blue-500" />
              </div>
              <span className="text-sm font-medium text-gray-700">{t('water_add_new')}</span>
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
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700"
            >
              {t('water_add')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
