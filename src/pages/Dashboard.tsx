import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  BarChart2,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ConciergeBell,
  Crown,
  Droplet,
  Drumstick,
  Flame,
  Package,
  Plus,
  Bike,
  Heart,
  ShoppingBag,
  Target,
  Utensils,
  Wallet,
  Wheat,
} from "lucide-react";

import LogMealModal from "@/components/LogMealModal";
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
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import {
  progressRingVariants,
  staggerContainer,
  staggerItem,
  ambientGlow,
} from "@/lib/animations";

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
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, progressKey);

  const fetchActiveOrders = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data: schedules, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          order_status,
          meal_id,
          delivery_type
        `)
        .eq("user_id", user.id)
        .in("order_status", ["pending", "confirmed", "preparing", "ready", "out_for_delivery"])
        .order("scheduled_date", { ascending: true })
        .limit(3);

      if (schedulesError) throw schedulesError;
      if (!schedules || schedules.length === 0) {
        setActiveOrders([]);
        setOrdersLoading(false);
        return;
      }

      const mealIds = [...new Set(schedules.map(s => s.meal_id).filter(Boolean))];

      let mealsData: any[] = [];
      if (mealIds.length > 0) {
        const { data: meals, error: mealsError } = await supabase
          .from("meals")
          .select("id, name, restaurant_id")
          .in("id", mealIds);

        if (!mealsError && meals) {
          const restaurantIds = [...new Set(meals.map((m: any) => m.restaurant_id).filter(Boolean))] as string[];

          let restaurantsData: any[] = [];
          if (restaurantIds.length > 0) {
            const { data: restaurants, error: restaurantsError } = await supabase
              .from("restaurants")
              .select("id, name")
              .in("id", restaurantIds);

            if (!restaurantsError && restaurants) {
              restaurantsData = restaurants;
            }
          }

          mealsData = meals.map((meal: any) => ({
            ...meal,
            restaurant: restaurantsData.find(r => r.id === meal.restaurant_id) || { name: "Restaurant" },
          }));
        }
      }

      const orders = schedules.map((schedule: any) => {
        const meal = mealsData.find(m => m.id === schedule.meal_id);
        return {
          id: schedule.id,
          order_status: schedule.order_status,
          scheduled_date: schedule.scheduled_date,
          meal_name: meal?.name || "Meal",
          restaurant_name: meal?.restaurant?.name || "Restaurant",
          delivery_type: schedule.delivery_type || "pickup",
        };
      });

      setActiveOrders(orders);
    } catch (err) {
      console.error("Error fetching active orders:", err);
      setActiveOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchActiveOrders();
  }, [fetchActiveOrders]);

  const animatedCalories = useAnimatedCounter(Math.round(todayProgress.calories), 800);
  const animatedBurned = useAnimatedCounter(totalBurned, 800);
  const animatedBalance = useAnimatedCounter(
    isUnlimited ? 0 : Number.isFinite(remainingMeals + rolloverCredits) ? Number(remainingMeals + rolloverCredits) : 40,
    600
  );

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
            <AlertCircle className="h-8 w-8" />
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
      iconClass: "from-[#BDF6C6] to-[#79DB88] text-[#13A853]",
      dotClass: "bg-[#19B965]",
      pillClass: "bg-[#DDF8E7] text-[#11A85A]",
    },
    {
      label: "Protein",
      value: Math.round(todayProgress.protein),
      target: profile?.protein_target_g || 181,
      Icon: Drumstick,
      iconClass: "from-[#FFD6A7] to-[#FF914D] text-white",
      dotClass: "bg-[#FF820F]",
      pillClass: "bg-[#FFF0DA] text-[#E06E00]",
    },
    {
      label: "Fat",
      value: Math.round(todayProgress.fat),
      target: profile?.fat_target_g || 69,
      Icon: Droplet,
      iconClass: "from-[#B08CFF] to-[#7548F7] text-white",
      dotClass: "bg-[#7C4DFF]",
      pillClass: "bg-[#EEE5FF] text-[#744AE8]",
    },
  ];



  return (
    <motion.div
      initial={prefersReducedMotion ? undefined : { opacity: 0 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1 }}
      className="min-h-screen overflow-x-hidden text-slate-900 relative"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "linear-gradient(135deg, #FEFFFE 0%, #F8FDF9 50%, #F5FAF7 100%)",
            "radial-gradient(ellipse 120% 80% at -20% -10%, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0) 60%)",
            "radial-gradient(ellipse 100% 120% at 110% 105%, rgba(52, 211, 153, 0.04) 0%, rgba(52, 211, 153, 0) 50%)",
            "radial-gradient(ellipse 80% 100% at 105% -5%, rgba(251, 191, 36, 0.03) 0%, rgba(251, 191, 36, 0) 50%)",
            "radial-gradient(ellipse 140% 60% at 50% 95%, rgba(16, 185, 129, 0.02) 0%, rgba(16, 185, 129, 0) 40%)",
            "radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 255, 255, 0) 30%)",
          ].join(", "),
        }}
      />
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0.06 }}
        animate={prefersReducedMotion ? undefined : ambientGlow.animate}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 100% 100% at 50% 30%, rgba(16, 185, 129, 0.03) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.3]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
          backgroundRepeat: "repeat",
          mixBlendMode: "overlay",
        }}
      />
      <main className="relative mx-auto max-w-[430px] px-4 sm:px-6 pb-safe-offset-20 pt-safe-offset-4 pb-28 pt-6">
        <header className="flex items-center justify-between">
          <Link to="/profile" className="flex items-center gap-3">
            <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full border border-white bg-white shadow-[0_8px_16px_rgba(15,23,42,0.1)] overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[15px] font-bold text-[#10B981]">{userName.charAt(0)}</span>
              )}
            </div>
            <div>
              <p className="text-[12px] font-medium leading-tight text-slate-700">Good afternoon 🌥️</p>
              <h1 className="mt-0.5 text-[15px] font-extrabold leading-none tracking-[-0.03em] text-slate-950">{userName}</h1>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/notifications" className="relative flex h-[36px] w-[36px] items-center justify-center text-slate-950" aria-label="Notifications">
              <Bell className="h-[27px] w-[27px]" strokeWidth={2.15} />
              {displayedUnreadCount > 0 && (
                <span className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF1D25] px-1 text-[10px] font-extrabold leading-none text-white shadow-[0_4px_10px_rgba(255,29,37,0.22)] ring-2 ring-white">
                  {displayedUnreadCount > 9 ? "9+" : displayedUnreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        <motion.section 
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? undefined : { duration: 0.4, ease: "easeOut" }}
          className="mt-6 rounded-[24px] bg-white px-[14px] py-5 shadow-[0_14px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/80"
        >
          <div className="flex items-center">
            <div className="relative flex h-[96px] w-[96px] shrink-0 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 108 108" aria-hidden="true">
                <circle cx="54" cy="54" r={balanceRadius} fill="none" stroke="#CBEFD9" strokeWidth="9" />
                <motion.circle
                  cx="54"
                  cy="54"
                  r={balanceRadius}
                  fill="none"
                  stroke="#10A95F"
                  strokeLinecap="round"
                  strokeWidth="9"
                  strokeDasharray={balanceCirc}
                  strokeDashoffset={balanceOffset}
                  variants={progressRingVariants}
                  initial="hidden"
                  animate="visible"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[20px] font-extrabold leading-none tracking-[-0.04em] text-[#10A95F]">{isUnlimited ? "∞" : animatedBalance}</span>
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

            <button
              type="button"
              onClick={() => navigate("/subscription")}
              className="flex shrink-0 flex-col items-center justify-center gap-1.5 text-center rounded-2xl p-1.5 transition active:scale-95 hover:bg-slate-50"
              aria-label="View subscription"
            >
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-gradient-to-br from-[#FF8A2A] to-[#F97316] text-white shadow-[0_7px_14px_rgba(249,115,22,0.2)]">
                <Crown className="h-[18px] w-[18px]" />
              </div>
              <span className="text-[11px] font-semibold text-slate-700">Subscription</span>
              <span className="rounded-full bg-[#D8F5E0] px-2 py-0.5 text-[10px] font-extrabold text-[#0E9F59]">{planName}</span>
              <span className="text-[10px] font-medium text-slate-500">{joinedLabel}</span>
            </button>
          </div>
        </motion.section>

        <section className="mt-4 rounded-[24px] bg-white px-4 pb-5 pt-4 shadow-[0_14px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-5 w-5 text-slate-500" strokeWidth={2} />
              <span className="text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">{dateLabel}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <motion.button
                type="button"
                onClick={goToPrevDay}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_3px_8px_rgba(15,23,42,0.03)]"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </motion.button>
              <motion.button
                type="button"
                onClick={goToNextDay}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.9 }}
                disabled={isToday}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_3px_8px_rgba(15,23,42,0.03)] disabled:opacity-50"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </motion.button>
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

          <motion.div 
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={prefersReducedMotion ? undefined : { duration: 0.4, ease: "easeOut", delay: 0.1 }}
            className="mt-3 rounded-[20px] border border-slate-100 bg-white px-4 py-3 shadow-[inset_0_0_20px_rgba(15,23,42,0.012)]"
          >
            <div className="flex min-h-[100px] items-center justify-between">
              <div className="w-[62px] text-left">
                <p className="text-[12px] font-medium text-slate-600">Consumed</p>
                <div className="mt-0.5 flex items-end gap-1.5">
                  <span className="text-[22px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{animatedCalories}</span>
                  <Utensils className="mb-0.5 h-[18px] w-[18px] text-[#10A95F]" strokeWidth={2} />
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">Cal</p>
              </div>

              <div className="relative flex h-[140px] w-[140px] shrink-0 items-center justify-center">
                <div className="absolute inset-[-4px] rounded-full bg-[#FFF7ED] blur-[0.5px]" />
                <svg className="relative h-full w-full -rotate-90" viewBox="0 0 140 140" aria-hidden="true">
                  <circle cx="70" cy="70" r={ringRadius} fill="none" stroke="#FFE8CC" strokeWidth="9" />
                  <motion.circle
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
                    variants={progressRingVariants}
                    initial="hidden"
                    animate="visible"
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
                  <span className="text-[22px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{animatedBurned}</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500">Cal</p>
              </div>
            </div>
          </motion.div>

          <div className="mt-5">
            <motion.div 
              initial={prefersReducedMotion ? undefined : "hidden"}
              animate={prefersReducedMotion ? undefined : "visible"}
              variants={prefersReducedMotion ? undefined : staggerContainer}
              className="grid grid-cols-3 gap-2.5"
            >
              {macroCards.map(({ label, value, target, Icon, iconClass, dotClass, pillClass }) => {
                const percent = Math.round((value / (target || 1)) * 100);
                
                return (
                  <motion.div 
                    key={label}
                    variants={prefersReducedMotion ? undefined : staggerItem}
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
                    className="rounded-[18px] border border-slate-100 bg-white px-3 py-3 shadow-[0_9px_22px_rgba(15,23,42,0.055)]"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_8px_16px_rgba(15,23,42,0.08)] ${iconClass}`}>
                        <Icon className="h-[22px] w-[22px]" strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0 pt-1">
                        <p className="text-[12px] font-bold leading-tight text-slate-500">{label}</p>
                        <p className="mt-1 text-[20px] font-extrabold leading-none tracking-[-0.05em] text-slate-950">{value}g</p>
                      </div>
                    </div>

                    <div className="mt-4 flex h-[7px] items-center rounded-full bg-slate-200/80">
                      <span className={`h-[9px] w-[9px] shrink-0 rounded-full ${dotClass}`} />
                      <span className={`-ml-[2px] h-[4px] rounded-full ${dotClass}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-1.5">
                      <span className="text-[12px] font-bold tracking-[-0.03em] text-slate-500">/{target}g</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold leading-none ${pillClass}`}>{percent}%</span>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
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
              <motion.button
                type="button"
                onClick={() => setSheetOpen(true)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#20C978] to-[#059A5A] text-white shadow-[0_10px_20px_rgba(5,150,90,0.28)]"
                aria-label="Open log activity"
              >
                <Plus className="h-[22px] w-[22px]" strokeWidth={2} />
              </motion.button>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="mb-2.5 pl-1 text-[14px] font-extrabold tracking-[-0.02em] text-slate-950">Quick Actions</h3>
            <div className="grid grid-cols-3 gap-2">
              <motion.button
                type="button"
                onClick={() => navigate("/tracker")}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                className="flex items-center gap-1 rounded-full border border-[#CFEFE0] bg-[#F2FFF6] px-2 py-2 shadow-[0_4px_10px_rgba(15,23,42,0.04)]"
                aria-label="Open Tracker"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#20C978] to-[#059A5A] text-white shadow-[0_6px_12px_rgba(16,185,129,0.18)]">
                  <Target className="h-[12px] w-[12px]" />
                </span>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-900">Tracker</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => navigate("/favorites")}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                className="flex items-center gap-1 rounded-full border border-[#FFC7D3] bg-[#FFF1F4] px-2 py-2 shadow-[0_4px_10px_rgba(15,23,42,0.04)]"
                aria-label="Favorites"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF5C7A] to-[#E0364F] text-white shadow-[0_6px_12px_rgba(224,54,79,0.2)]">
                  <Heart className="h-[12px] w-[12px]" />
                </span>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-900">Favorite</span>
              </motion.button>

              <motion.button
                type="button"
                onClick={() => navigate("/progress")}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
                className="flex items-center gap-1 rounded-full border border-[#D6E6FF] bg-[#F3F8FF] px-2 py-2 shadow-[0_4px_10px_rgba(15,23,42,0.04)]"
                aria-label="Progress"
              >
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5D759A] to-[#354F73] text-white shadow-[0_6px_12px_rgba(53,79,115,0.2)]">
                  <BarChart2 className="h-[12px] w-[12px]" />
                </span>
                <span className="whitespace-nowrap text-[11px] font-semibold text-slate-900">Progress</span>
              </motion.button>
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

          {/* Active Orders section */}
          {activeOrders.length > 0 && (
            <>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="h-5 w-5 text-[#10A95F]" strokeWidth={2} />
                  <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-950">Active Orders ({activeOrders.length})</h2>
                </div>
                <Link to="/orders" className="flex items-center gap-1.5 text-[13px] font-semibold text-[#08A75F]">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <motion.div 
                initial={prefersReducedMotion ? undefined : "hidden"}
                animate={prefersReducedMotion ? undefined : "visible"}
                variants={prefersReducedMotion ? undefined : staggerContainer}
                className="mt-2.5 space-y-1.5"
              >
                {activeOrders.map((order) => {
                  const statusConfig: Record<string, { label: string; Icon: React.ElementType; badgeClass: string }> = {
                    pending: { label: "Pending", Icon: Clock, badgeClass: "bg-[#FFE8BF] text-[#D98105]" },
                    confirmed: { label: "Confirmed", Icon: CheckCircle2, badgeClass: "bg-[#CDEEDB] text-[#098A4F]" },
                    preparing: { label: "Preparing", Icon: Flame, badgeClass: "bg-[#FFE8BF] text-[#D98105]" },
                    ready: { label: "Ready", Icon: Package, badgeClass: "bg-[#CDEEDB] text-[#098A4F]" },
                    out_for_delivery: { label: "On The Way", Icon: Bike, badgeClass: "bg-[#CDEEDB] text-[#098A4F]" },
                  };
                  const config = statusConfig[order.order_status] || statusConfig.pending;
                  const IconComponent = config.Icon;
                  
                  return (
                    <motion.div
                      key={order.id}
                      variants={prefersReducedMotion ? undefined : staggerItem}
                      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                    >
                      <Link
                        to={`/live/${order.id}`}
                        className="flex h-[58px] items-center rounded-[15px] border border-[#D6F0DD] bg-white px-3.5 shadow-[0_6px_14px_rgba(16,185,129,0.03)]"
                      >
                        <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#23C878] to-[#07894F] text-white shadow-[0_8px_16px_rgba(5,150,90,0.2)]">
                          <IconComponent className="h-[18px] w-[18px]" />
                        </div>
                        <div className="ml-3 min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <p className="truncate text-[13px] font-extrabold tracking-[-0.02em] text-slate-950">{order.restaurant_name}</p>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${config.badgeClass}`}>{config.label}</span>
                          </div>
                          <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">{order.meal_name}</p>
                        </div>
                        <ChevronRight className="ml-2.5 h-5 w-5 shrink-0 text-slate-500" />
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </>
          )}

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
        <LogMealModal
          open={logMealOpen}
          onOpenChange={setLogMealOpen}
          onMealLogged={() => setProgressKey((key) => key + 1)}
        />
      )}

      <LogActivitySheet open={sheetOpen} onOpenChange={setSheetOpen} onBurnedUpdate={setTotalBurned} />
    </motion.div>
  );
};

export default Dashboard;
