import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRightLeft,
  BarChart2,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ConciergeBell,
  Crown,
  Droplet,
  Dumbbell,
  Flame,
  Leaf,
  Plus,
  Heart,
  ShoppingBag,
  Target,
  Truck,
  Utensils,
  Wallet,
  Wheat,
} from "lucide-react";

import { LogMealDialog } from "@/components/LogMealDialog";
import { LogActivitySheet } from "@/components/LogActivitySheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { getQatarNow, formatLocaleDate } from "@/lib/dateUtils";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { subscription, remainingMeals, totalMeals, isUnlimited } = useSubscription();
  const { rolloverCredits } = useDashboardRolloverCredits(user?.id);
  const { t, language } = useLanguage();
  const { unreadCount } = useNotifications(user?.id);
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [progressKey, setProgressKey] = useState(0);
  const [totalBurned, setTotalBurned] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, progressKey);

  useEffect(() => {
    if (!profileLoading && profile && profile.onboarding_completed === false) {
      navigate("/onboarding");
    }
  }, [profile, profileLoading, navigate]);

  useEffect(() => {
    const handler = () => setProgressKey((key) => key + 1);
    window.addEventListener("nutrio:meal-progress-changed", handler);
    return () => window.removeEventListener("nutrio:meal-progress-changed", handler);
  }, []);

  const todayStr = selectedDate.toISOString().split("T")[0];
  const todayStart = getQatarNow();
  todayStart.setHours(0, 0, 0, 0);
  const isToday = selectedDate.toDateString() === todayStart.toDateString();

  useEffect(() => {
    if (!user) return;

    const loadWorkoutSummary = async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("calories_burned")
        .eq("user_id", user.id)
        .eq("session_date", todayStr);

      if (error) {
        console.error("Failed to load workout summary", error);
        return;
      }

      setTotalBurned(data.reduce((sum, session) => sum + (session.calories_burned ?? 0), 0));
      setWorkoutCount(data.length);
    };

    loadWorkoutSummary();
  }, [user, todayStr]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#F8FFFB] px-6 py-9">
        <div className="mx-auto max-w-[430px] space-y-6">
          <div className="h-16 rounded-full bg-emerald-100/60 animate-pulse" />
          <div className="h-36 rounded-[28px] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)] animate-pulse" />
          <div className="h-[520px] rounded-[28px] bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FFFB] gap-4 px-6">
        <div className="w-full max-w-[360px] text-center space-y-4 rounded-[28px] bg-white p-7 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
          <p className="text-sm text-slate-500">We couldn&#39;t load your profile. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#10B981] px-7 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(16,185,129,0.3)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const effectiveMealsLeft = isUnlimited ? Infinity : remainingMeals + rolloverCredits;
  const balanceDisplay = isUnlimited ? "∞" : Number.isFinite(effectiveMealsLeft) ? Number(effectiveMealsLeft) : 40;
  const totalMealsDisplay = isUnlimited ? "∞" : Number.isFinite(totalMeals) ? Number(totalMeals) : 40;
  const rawUserName = profile?.full_name?.split(" ")[0] || t("guest_greeting") || "Khamis";
  const userName = rawUserName.charAt(0).toUpperCase() + rawUserName.slice(1).toLowerCase();
  const dateLabel = formatLocaleDate(selectedDate, language, { weekday: "short", month: "short", day: "numeric" });
  const dailyCalories = profile?.daily_calorie_target || 2066;
  const calLeft = Math.max(0, dailyCalories - todayProgress.calories + totalBurned);
  const remainingPct = Math.min((calLeft / (dailyCalories || 1)) * 100, 100);
  const ringRadius = 62;
  const remainingPctColor = remainingPct > 60 ? "#10B981" : remainingPct > 50 ? "#F97316" : "#EF4444";
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (remainingPct / 100) * ringCirc;
  const balanceRadius = 40;
  const balanceCirc = 2 * Math.PI * balanceRadius;
  const balancePct = isUnlimited ? 100 : Math.min((Number(balanceDisplay) / (Number(totalMealsDisplay) || 1)) * 100, 100);
  const balanceOffset = balanceCirc - (balancePct / 100) * balanceCirc;
  const completedThisWeek = 7;
  const displayedUnreadCount = unreadCount > 99 ? 99 : unreadCount;

  const planName = subscription?.plan || "Free Plan";
  const joinedDate = subscription?.start_date ? new Date(subscription.start_date) : null;
  const joinedLabel = joinedDate
    ? `Joined ${joinedDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : "Joined recently";

  const goToPrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const goToNextDay = () => {
    if (isToday) return;
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  const macroCards = [
    {
      label: "Carbs",
      value: Math.round(todayProgress.carbs),
      target: profile?.carbs_target_g || 181,
      Icon: Wheat,
      cardClass: "border-[#D8F5E0] bg-gradient-to-br from-[#F2FFF6] to-[#EAF8EC]",
      iconClass: "bg-gradient-to-br from-[#21C66F] to-[#069A54] text-white shadow-[0_10px_18px_rgba(16,185,129,0.25)]",
      pillClass: "bg-[#D8F5E0] text-[#0E9F59]",
      lineClass: "bg-[#D9EEE0]",
    },
    {
      label: "Protein",
      value: Math.round(todayProgress.protein),
      target: profile?.protein_target_g || 181,
      Icon: Dumbbell,
      cardClass: "border-[#F8DEC9] bg-gradient-to-br from-[#FFF7F1] to-[#FCEFE4]",
      iconClass: "bg-gradient-to-br from-[#FF8A2A] to-[#F36A12] text-white shadow-[0_10px_18px_rgba(249,115,22,0.25)]",
      pillClass: "bg-[#FFE0C7] text-[#DE6B12]",
      lineClass: "bg-[#F6D8C6]",
    },
    {
      label: "Fat",
      value: Math.round(todayProgress.fat),
      target: profile?.fat_target_g || 69,
      Icon: Droplet,
      cardClass: "border-[#DCE8F6] bg-gradient-to-br from-[#F3F8FF] to-[#EAF1F9]",
      iconClass: "bg-gradient-to-br from-[#5D759A] to-[#354F73] text-white shadow-[0_10px_18px_rgba(53,79,115,0.2)]",
      pillClass: "bg-[#DFE9F6] text-[#455E82]",
      lineClass: "bg-[#DDE6F0]",
    },
  ];

  const orderRows = [
    {
      title: "Restaurant",
      detail: "Meal, Meal  •  Mar 13",
      status: "On The Way",
      Icon: Truck,
      badgeClass: "bg-[#CDEEDB] text-[#098A4F]",
    },
    {
      title: "Fitness Fuel Station",
      detail: "High-Protein Breakfast, High-Protein Bre...  •  Apr 25",
      status: "Pending",
      Icon: Flame,
      badgeClass: "bg-[#FFE8BF] text-[#D98105]",
    },
    {
      title: "Organic Harvest",
      detail: "Organic Acai Bowl  •  Apr 25",
      status: "Pending",
      Icon: Leaf,
      badgeClass: "bg-[#FFE8BF] text-[#D98105]",
    },
  ];

  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      className="min-h-screen overflow-x-hidden text-slate-900"
      style={{
        background:
          "radial-gradient(circle at 0% 6%, rgba(206, 247, 226, 0.68) 0, rgba(206, 247, 226, 0) 38%), radial-gradient(circle at 100% 96%, rgba(219, 247, 229, 0.56) 0, rgba(219, 247, 229, 0) 34%), linear-gradient(180deg, #FBFFFD 0%, #FFFFFF 48%, #F7FCF9 100%)",
      }}
    >
      <main className="mx-auto max-w-[430px] px-6 pb-28 pt-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white bg-white shadow-[0_8px_16px_rgba(15,23,42,0.1)]">
              <img src="/nutrio/logo.png" alt="Nutrio" className="h-[34px] w-[34px] object-contain" />
            </div>
            <div>
              <p className="text-[12px] font-medium leading-tight text-slate-700">Good afternoon 🌥️</p>
              <h1 className="mt-0.5 text-[15px] font-extrabold leading-none tracking-[-0.03em] text-slate-950">{userName}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/notifications" className="relative block text-slate-950" aria-label="Notifications">
              <Bell className="h-[24px] w-[24px]" strokeWidth={2.1} />
              {displayedUnreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                  {displayedUnreadCount > 9 ? "9+" : displayedUnreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        <section className="mt-6 rounded-[24px] bg-white px-[14px] py-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/80">
          <div className="flex items-center">
            <div className="relative flex h-[96px] w-[96px] shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 108 108" aria-hidden="true">
                <circle cx="54" cy="54" r={balanceRadius} fill="none" stroke="#CBEFD9" strokeWidth="9" />
                <circle
                  cx="54"
                  cy="54"
                  r={balanceRadius}
                  fill="none"
                  stroke="#10A95F"
                  strokeLinecap="round"
                  strokeWidth="9"
                  strokeDasharray={balanceCirc}
                  strokeDashoffset={balanceOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[20px] font-extrabold leading-none tracking-[-0.04em] text-[#10A95F]">{balanceDisplay}</span>
                <span className="mt-1.5 text-[9px] font-medium leading-[1.28] text-slate-500">Avail.<br />Balance</span>
              </div>
            </div>

            <div className="mx-3 h-[80px] w-px shrink-0 bg-slate-200" />

            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#EFFAF4] text-[#10A95F]">
                  <Calendar className="h-[13px] w-[13px]" />
                </div>
                <span className="flex-1 text-[11px] font-medium text-slate-500">Mo. Balance</span>
                <span className="text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">{balanceDisplay} / {totalMealsDisplay}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#EFFAF4] text-[#10A95F]">
                  <ArrowRightLeft className="h-[13px] w-[13px]" />
                </div>
                <span className="flex-1 text-[11px] font-medium text-slate-500">Transfer Bal.</span>
                <span className="text-[14px] font-extrabold tracking-[-0.02em] text-[#10A95F]">+0</span>
              </div>
              <div className="h-px bg-slate-200" />
              <div className="flex items-center gap-2.5">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#EFFAF4] text-[#10A95F]">
                  <Wallet className="h-[13px] w-[13px]" />
                </div>
                <span className="flex-1 text-[11px] font-medium text-slate-500">Total Avail.</span>
                <span className="text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">{balanceDisplay}</span>
              </div>
            </div>

            <div className="mx-3 h-[80px] w-px shrink-0 bg-slate-200" />

            <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 text-center">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-[#FF8A2A] to-[#F97316] text-white shadow-[0_7px_14px_rgba(249,115,22,0.2)]">
                <Crown className="h-[18px] w-[18px]" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Subscription</span>
              <span className="rounded-full bg-[#D8F5E0] px-2 py-0.5 text-[10px] font-extrabold text-[#0E9F59]">{planName}</span>
              <span className="text-[10px] font-medium text-slate-500">{joinedLabel}</span>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[24px] bg-white px-4 pb-5 pt-4 shadow-[0_14px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-slate-500" strokeWidth={2} />
              <span className="text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={goToPrevDay}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_3px_8px_rgba(15,23,42,0.03)]"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToNextDay}
                disabled={isToday}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_3px_8px_rgba(15,23,42,0.03)] disabled:opacity-50"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex h-[32px] items-center rounded-full border border-[#F8DDB5] bg-[#FFF9F1] px-3">
            <div className="flex items-center gap-2 text-[#7A4A18]">
              <Flame className="h-[15px] w-[15px] text-[#E98A05]" />
              <span className="whitespace-nowrap text-[12px] font-semibold">Daily Streak</span>
            </div>
            <div className="mx-3 flex flex-1 items-center justify-between gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[4px] flex-1 rounded-full bg-[#F59E0B]" />
              ))}
            </div>
            <span className="text-[13px] font-extrabold text-slate-900">{completedThisWeek}/7</span>
          </div>

          <div className="mt-3 rounded-[20px] border border-slate-100 bg-white px-4 py-3 shadow-[inset_0_0_20px_rgba(15,23,42,0.012)]">
            <div className="flex min-h-[100px] items-center justify-between">
              <div className="w-[62px] text-left">
                <p className="text-[12px] font-medium text-slate-600">Consumed</p>
                <div className="mt-0.5 flex items-end gap-1.5">
                  <span className="text-[22px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{Math.round(todayProgress.calories)}</span>
                  <Utensils className="mb-0.5 h-[18px] w-[18px] text-[#10A95F]" strokeWidth={2} />
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">Cal</p>
              </div>

              <div className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center">
                <div className="absolute inset-[-4px] rounded-full bg-[#FFF7ED] blur-[0.5px]" />
                <svg className="relative h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
                  <circle cx="70" cy="70" r={ringRadius} fill="none" stroke="#FFE8CC" strokeWidth="9" />
                  <circle
                    cx="70"
                    cy="70"
                    r={ringRadius}
                    fill="none"
                    stroke="#F97316"
                    strokeLinecap="round"
                    strokeWidth="9"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringOffset}
                    style={{ filter: "drop-shadow(0 6px 10px rgba(249,115,22,0.2))" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[20px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{calLeft}</span>
              <span className="mt-1.5 text-[11px] font-extrabold uppercase leading-none text-[#F97316]">CAL LEFT</span>
              <span className="mt-1.5 text-[10px] font-bold" style={{ color: remainingPctColor }}>{Math.round(remainingPct)}% Remaining</span>
                </div>
              </div>

              <div className="w-[62px] text-right">
                <p className="text-[12px] font-medium text-slate-600">Burned</p>
                <div className="mt-0.5 flex items-end justify-end gap-1.5">
                  <Flame className="mb-0.5 h-[22px] w-[22px] text-[#F97316]" strokeWidth={2} />
                  <span className="text-[22px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{totalBurned}</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">Cal</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {macroCards.map(({ label, value, target, Icon, cardClass, iconClass, pillClass, lineClass }) => {
              const percent = Math.round((value / (target || 1)) * 100);
              return (
                <div key={label} className={`rounded-[18px] border px-2.5 pb-2.5 pt-3 ${cardClass}`}>
                  <div className="flex items-start gap-1.5">
                    <div className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full ${iconClass}`}>
                      <Icon className="h-[14px] w-[14px]" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[12px] font-semibold leading-none text-slate-800">{label}</p>
                      <p className="mt-1.5 text-[16px] font-extrabold leading-none tracking-[-0.04em] text-slate-950">{value}g</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-700">/{target}g</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${pillClass}`}>{percent}%</span>
                  </div>
                  <div className={`mt-2 h-[3px] rounded-full ${lineClass}`} />
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-1.5">
              <Activity className="h-5 w-5 text-[#10A95F]" strokeWidth={2.1} />
              <h2 className="text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">Activity Details</h2>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div className="flex h-[48px] flex-1 items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 shadow-[0_6px_14px_rgba(15,23,42,0.03)]">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF8A2A] to-[#F97316] text-white shadow-[0_7px_14px_rgba(249,115,22,0.2)]">
                  <Flame className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-[11px] font-medium leading-tight text-slate-500">Total Burned</p>
                  <p className="text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-slate-950">{totalBurned} Cal</p>
                </div>
              </div>
              <div className="flex h-[48px] flex-1 items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 shadow-[0_6px_14px_rgba(15,23,42,0.03)]">
                <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#19C878] to-[#079A59] text-white shadow-[0_7px_14px_rgba(16,185,129,0.18)]">
                  <Activity className="h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-[11px] font-medium leading-tight text-slate-500">Sessions</p>
                  <p className="text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-slate-950">{workoutCount}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#20C978] to-[#059A5A] text-white shadow-[0_10px_20px_rgba(5,150,90,0.28)] active:scale-95"
                aria-label="Add activity"
              >
                <Plus className="h-[22px] w-[22px]" strokeWidth={2} />
              </button>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-2.5 pl-1 text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => navigate("/tracker")}
                className="flex items-center gap-1 rounded-full border border-[#CFEFE0] bg-[#F2FFF6] px-2 py-2 shadow-[0_4px_10px_rgba(15,23,42,0.04)] active:scale-95"
                aria-label="Open Tracker"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#20C978] to-[#059A5A] text-white shadow-[0_6px_12px_rgba(16,185,129,0.18)]">
                  <Target className="h-[12px] w-[12px]" />
                </span>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-900">Tracker</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/favorites")}
                className="flex items-center gap-1 rounded-full border border-[#FFC7D3] bg-[#FFF1F4] px-2 py-2 shadow-[0_4px_10px_rgba(15,23,42,0.04)] active:scale-95"
                aria-label="Favorites"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5C7A] to-[#E0364F] text-white shadow-[0_6px_12px_rgba(224,54,79,0.2)]">
                  <Heart className="h-[12px] w-[12px]" />
                </span>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-900">Favorite</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/progress")}
                className="flex items-center gap-1 rounded-full border border-[#D6E6FF] bg-[#F3F8FF] px-2 py-2 shadow-[0_4px_10px_rgba(15,23,42,0.04)] active:scale-95"
                aria-label="Progress"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5D759A] to-[#354F73] text-white shadow-[0_6px_12px_rgba(53,79,115,0.2)]">
                  <BarChart2 className="h-[12px] w-[12px]" />
                </span>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-900">Progress</span>
              </button>
            </div>
          </div>

          <motion.button
            data-testid="log-meal-button"
            type="button"
            onClick={() => setLogMealOpen(true)}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-3 rounded-[20px] bg-gradient-to-r from-[#12B969] to-[#079B5A] text-[15px] font-extrabold tracking-[-0.02em] text-white shadow-[0_12px_24px_rgba(6,150,88,0.24)]"
          >
            <ConciergeBell className="h-[24px] w-[24px]" strokeWidth={2.1} />
            Log Meal
          </motion.button>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="h-5 w-5 text-[#10A95F]" strokeWidth={2} />
              <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Active Orders (3)</h2>
            </div>
            <Link to="/orders" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#08A75F]">
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {orderRows.map(({ title, detail, status, Icon, badgeClass }) => (
              <Link
                key={title}
                to="/orders"
                className="flex h-[58px] items-center rounded-[15px] border border-[#D6F0DD] bg-white px-3.5 shadow-[0_6px_14px_rgba(16,185,129,0.03)]"
              >
                <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#23C878] to-[#07894F] text-white shadow-[0_8px_16px_rgba(5,150,90,0.2)]">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="ml-3 min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <p className="truncate text-[13px] font-extrabold tracking-[-0.02em] text-slate-950">{title}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badgeClass}`}>{status}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">{detail}</p>
                </div>
                <ChevronRight className="ml-2.5 h-5 w-5 shrink-0 text-slate-500" />
              </Link>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Top Rated</h2>
            <Link to="/meals" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#08A75F]">
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-3 flex min-h-[100px] items-center rounded-[17px] border border-[#BFEBCB] bg-[#F9FFFA] px-4 py-3">
            <div className="relative h-[78px] w-[100px] shrink-0">
              <span className="absolute left-4 top-0.5 text-[15px] text-[#56C17C]">★</span>
              <span className="absolute right-3.5 top-5 text-[10px] text-[#56C17C]">★</span>
              <div className="absolute bottom-0.5 left-2.5 h-[3px] w-[72px] rounded-full bg-[#8AD7A0]" />
              <div className="absolute bottom-2 left-7 h-[48px] w-[48px] rounded-t-[10px] bg-gradient-to-br from-[#A4E7B8] to-[#57BE7A] shadow-[inset_0_-6px_10px_rgba(7,137,79,0.1)]" />
              <div className="absolute bottom-[41px] left-[22px] h-[17px] w-[56px] rounded-t-[6px] bg-[#A8EABD]" />
              <div className="absolute bottom-[32px] left-[18px] flex h-3 w-[64px] overflow-hidden rounded-b-[6px] border border-[#67C98B] bg-white">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span key={index} className={`h-full flex-1 ${index % 2 === 0 ? "bg-[#36B76A]" : "bg-[#E6F8EB]"}`} />
                ))}
              </div>
              <div className="absolute bottom-[7px] left-[36px] h-[14px] w-[20px] rounded bg-[#DFF6E7]" />
              <div className="absolute bottom-[10px] left-[56px] h-[26px] w-[14px] rounded-t bg-[#2FAE62]/70" />
            </div>

            <div className="ml-2.5 min-w-0 flex-1">
              <h3 className="text-[13px] font-extrabold tracking-[-0.02em] text-slate-950">No featured restaurants yet</h3>
              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-slate-600 line-clamp-2">Check back soon for our highlighted partner restaurants!</p>
              <Link
                to="/meals"
                className="mt-2.5 inline-flex h-[34px] items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-900 shadow-[0_4px_10px_rgba(15,23,42,0.06)]"
              >
                Explore Restaurants
                <ChevronRight className="h-[14px] w-[14px]" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {user && (
        <LogMealDialog
          open={logMealOpen}
          onOpenChange={setLogMealOpen}
          userId={user.id}
          onMealLogged={() => setProgressKey((key) => key + 1)}
        />
      )}

      <LogActivitySheet open={sheetOpen} onOpenChange={setSheetOpen} onBurnedUpdate={setTotalBurned} />
    </motion.div>
  );
};

export default Dashboard;
