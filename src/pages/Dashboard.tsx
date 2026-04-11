import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, Variants, AnimatePresence, useScroll, useTransform } from "framer-motion";
import flamAvatar from "@/assets/flam.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Utensils,
  Bell,
  Plus,
  Crown,
  Flame,
  BarChart3,
  ChevronRight,
  Crown as SubscriptionIcon,
  Heart,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdaptiveGoals } from "@/hooks/useAdaptiveGoals";
import { supabase } from "@/integrations/supabase/client";
import { LogMealDialog } from "@/components/LogMealDialog";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useFeaturedRestaurants } from "@/hooks/useFeaturedRestaurants";
import { RoleIndicator } from "@/components/RoleIndicator";
import { AdaptiveGoalCard } from "@/components/AdaptiveGoalCard";
import { DailyNutritionCard } from "@/components/DailyNutritionCard";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";
import { BehaviorPredictionWidget } from "@/components/BehaviorPredictionWidget";
import { useLanguage } from "@/contexts/LanguageContext";

const spring = { type: "spring" as const, stiffness: 300, damping: 25, mass: 0.8 };
const springBouncy = { type: "spring" as const, stiffness: 400, damping: 17, mass: 0.6 };
const springGentle = { type: "spring" as const, stiffness: 200, damping: 30, mass: 1 };

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: spring
  }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const pageVariants: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: spring
  }
};

const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.1, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
  }
};

const glowVariants: Variants = {
  glow: {
    boxShadow: [
      "0 0 0px rgba(251, 146, 60, 0)",
      "0 0 8px rgba(251, 146, 60, 0.4)",
      "0 0 0px rgba(251, 146, 60, 0)"
    ],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" }
  }
};

const breatheVariants: Variants = {
  breathe: {
    opacity: [1, 0.85, 1],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  }
};

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  rating: number;
  total_orders: number;
  meal_count: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { hasActiveSubscription, remainingMeals, isUnlimited, isVip, subscription } = useSubscription();
  const { 
    recommendation, 
    hasUnviewedAdjustment, 
    loading: adaptiveLoading, 
    applyAdjustment, 
    dismissAdjustment 
  } = useAdaptiveGoals();
  const { t } = useLanguage();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { featuredRestaurants, loading: featuredLoading } = useFeaturedRestaurants();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [todayProgress, setTodayProgress] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [progressKey, setProgressKey] = useState(0);
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "unread");
      setUnreadCount(count ?? 0);
    };
    fetchUnread();
  }, [user]);

  useEffect(() => {
    const checkRestaurant = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      setHasRestaurant(!!data);
    };
    checkRestaurant();
  }, [user]);

  useEffect(() => {
    if (!profileLoading && profile && !profile.onboarding_completed) {
      navigate("/onboarding");
    }
  }, [profile, profileLoading, navigate]);

  useEffect(() => {
    const fetchTodayProgress = async () => {
      if (!user) return;

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      try {
        const { data, error } = await supabase
          .from("progress_logs")
          .select("calories_consumed, protein_consumed_g, carbs_consumed_g, fat_consumed_g")
          .eq("user_id", user.id)
          .eq("log_date", dateStr)
          .maybeSingle();

        if (error) throw error;

        setTodayProgress({
          calories: data?.calories_consumed || 0,
          protein: data?.protein_consumed_g || 0,
          carbs: data?.carbs_consumed_g || 0,
          fat: data?.fat_consumed_g || 0,
        });
      } catch (err) {
        console.error("Error fetching progress:", err);
      }
    };

    fetchTodayProgress();
  }, [user, progressKey, selectedDate]);

  useEffect(() => {
    if (!featuredLoading) {
      const mappedRestaurants: Restaurant[] = featuredRestaurants.map((fr) => ({
        id: fr.id,
        name: fr.name,
        description: fr.description,
        logo_url: fr.logo_url,
        rating: fr.rating,
        total_orders: fr.total_orders,
        meal_count: fr.meal_count,
      }));
      setRestaurants(mappedRestaurants);
      setRestaurantsLoading(false);
    }
  }, [featuredRestaurants, featuredLoading]);

  const userStats = {
    dailyCalories: profile?.daily_calorie_target || 2000,
    consumedCalories: todayProgress.calories,
    protein: { target: profile?.protein_target_g || 150, consumed: todayProgress.protein },
    carbs: { target: profile?.carbs_target_g || 200, consumed: todayProgress.carbs },
    fat: { target: profile?.fat_target_g || 65, consumed: todayProgress.fat },
  };

  const userName = profile?.full_name?.split(" ")[0] || "there";

  // Streak week data
  const weekTarget = hasActiveSubscription ? 7 : 5;
  const completedThisWeek = Math.min((profile?.streak_days || 0) % weekTarget, weekTarget);
  const weekDays = [
    { label: "Sat" }, { label: "Sun" }, { label: "Mon" }, { label: "Tue" },
    { label: "Wed" }, { label: "Thu" }, { label: "Fri" },
  ];

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const subscriptionY = useTransform(scrollY, [0, 200], [0, -10]);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#ECFDF5]/30 gap-4 px-5">
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div className="w-full max-w-[480px] space-y-4">
          <div className="h-14 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
          <div className="h-32 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
          <div className="h-24 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
          <div className="h-12 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("good_morning");
    if (hour < 18) return t("good_afternoon");
    return t("good_evening");
  };

  return (
    <motion.div 
      ref={containerRef}
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-white"
      style={{ overscrollBehaviorY: "contain" }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {/* Header - Clean, iOS-style */}
      <motion.header 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#E1F2ED]/50 pt-2"
      >
        <div className="max-w-[480px] mx-auto px-5 h-14 flex items-center justify-between">
          <motion.div whileTap={{ scale: 0.97, transition: springBouncy }}>
            <Link to="/profile" className="flex items-center gap-3 transition-transform">
              <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 ${
                isVip ? "border-amber-400/80" : "border-[#E1F2ED]"
              }`}>
                <img
                  src={profile?.avatar_url || flamAvatar}
                  alt={userName}
                  loading="eager"
                  className="w-full h-full object-cover"
                />
                {isVip && (
                  <motion.div 
                    variants={pulseVariants}
                    animate="pulse"
                    className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-0.5 shadow-sm"
                  >
                    <Crown className="w-3 h-3 text-white" />
                  </motion.div>
                )}
              </div>
              <div>
                <p className="text-xs text-[#64748B] leading-tight">
                  {getGreeting()}
                </p>
                <p className="font-semibold text-sm text-[#0F172A] leading-tight">{userName}</p>
              </div>
            </Link>
          </motion.div>
          <div className="flex items-center gap-1">
            {hasRestaurant && <RoleIndicator role="customer" />}
            <Link to="/notifications" className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9, transition: springBouncy }}
                animate={unreadCount > 0 ? { x: [0, -2, 2, -2, 2, 0] } : {}}
                transition={{ duration: 0.5, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 3 }}
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-11 h-11 rounded-full hover:bg-[#059669]/10 transition-transform"
                >
                  <Bell className="w-5 h-5 text-[#64748B]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-[#DC2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>
              </motion.div>
            </Link>
          </div>
        </div>
      </motion.header>

      <motion.main 
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-[480px] mx-auto px-5 py-4 space-y-6 pb-24"
      >
        {/* PRIORITY 1: Subscription Status - Simplified */}
        <AnimatePresence mode="wait">
          {hasActiveSubscription && subscription && (
            <motion.div 
              key={subscription.id}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -20, transition: spring }}
            >
              <motion.div 
                whileTap={{ scale: 0.98, transition: springBouncy }}
                style={{ y: subscriptionY }}
              >
                <Link to="/subscription">
                  {(() => {
                    const allUsed = !isUnlimited && remainingMeals === 0;
                    const resetDate = subscription?.end_date ? format(new Date(subscription.end_date), "MMM d") : null;
                    
                    return (
                      <motion.div
                        layout
                        transition={spring}
                        className={`relative overflow-hidden rounded-2xl border-0 shadow-sm ${
                          allUsed
                            ? "bg-gradient-to-br from-amber-50 to-orange-50"
                            : "bg-gradient-to-br from-[#059669] to-[#10B981]"
                        }`}
                      >
                        <CardContent className="relative p-4">
                          <AnimatePresence mode="wait">
                            {allUsed ? (
                              <motion.div 
                                key="allUsed"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={spring}
                                className="flex items-center gap-3"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                  <Utensils className="w-5 h-5 text-amber-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm text-amber-900">{t("plan_card_all_used_title")}</p>
                                  <p className="text-xs text-amber-700 mt-0.5">
                                    {resetDate
                                      ? t("plan_card_all_used_reset").replace("{date}", resetDate)
                                      : t("plan_card_all_used_next_renewal")}
                                  </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-amber-600 shrink-0" />
                              </motion.div>
                            ) : (
                              <motion.div 
                                key="active"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={spring}
                                className="flex items-center gap-3"
                              >
                                <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                                  {isVip ? <Crown className="w-5 h-5 text-white" /> : <Flame className="w-5 h-5 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-semibold text-sm text-white/90 capitalize">{subscription?.plan}</p>
                                    <Badge variant="outline" className="bg-white/20 text-white border-white/30 text-[10px] px-2 py-0.5">
                                      {t("plan_card_active")}
                                    </Badge>
                                  </div>
                                  <div className="flex items-baseline gap-1.5 mt-1">
                                    <span className="text-3xl font-black text-white leading-none">
                                      {isUnlimited ? "∞" : remainingMeals}
                                    </span>
                                    <span className="text-sm font-medium text-white/80">
                                      {isUnlimited ? t("plan_card_unlimited") : t("plan_card_meals_left")}
                                    </span>
                                  </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-white/60 shrink-0" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </motion.div>
                    );
                  })()}
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PRIORITY 2: Nutrition Progress */}
        <motion.div variants={fadeInUp}>
          <DailyNutritionCard
            totalCalories={Math.round(userStats.consumedCalories)}
            totalProtein={userStats.protein.consumed}
            totalCarbs={userStats.carbs.consumed}
            totalFat={userStats.fat.consumed}
            focusCalories={userStats.dailyCalories}
            targetProtein={userStats.protein.target}
            targetCarbs={userStats.carbs.target}
            targetFat={userStats.fat.target}
            dayLabel={t("todays_progress")}
            onDateChange={setSelectedDate}
          />
        </motion.div>

        {/* Active Order - after nutrition, before quick actions */}
        {user && (
          <motion.div variants={fadeInUp}>
            <motion.div variants={breatheVariants} animate="breathe">
              <ActiveOrderBanner userId={user.id} />
            </motion.div>
          </motion.div>
        )}

        {/* PRIORITY 4: Log Meal Button - Primary CTA */}
        <motion.div variants={fadeInUp}>
          <motion.button
            onClick={() => setLogMealOpen(true)}
            whileTap={{ scale: 0.97, transition: springBouncy }}
            whileHover={{ boxShadow: "0 4px 12px rgba(234, 88, 12, 0.3)" }}
            className="w-full rounded-2xl h-12 font-semibold text-sm text-white shadow-sm transition-shadow"
            style={{ background: "linear-gradient(135deg, #EA580C 0%, #F97316 100%)" }}
          >
            <Plus className="w-5 h-5 mr-2 inline-block" />
            {t("log_meal")}
          </motion.button>
        </motion.div>

        {/* PRIORITY 4: Quick Actions - Simple icon row */}
        <motion.div variants={fadeInUp} className="grid grid-cols-4 gap-3">
          {[
            { to: "/tracker", icon: BarChart3, label: t("tracker"), color: "text-[#059669]" },
            { to: "/subscription", icon: SubscriptionIcon, label: t("subscription"), color: "text-violet-600" },
            { to: "/favorites", icon: Heart, label: t("favorites"), color: "text-rose-500" },
            { to: "/progress", icon: TrendingUp, label: t("progress"), color: "text-emerald-600" },
          ].map((action) => (
            <Link 
              key={action.to} 
              to={action.to}
              className="flex flex-col items-center gap-1.5 group"
            >
              <motion.div 
                whileHover={{ scale: 1.05, transition: spring }}
                whileTap={{ scale: 0.9, transition: springBouncy }}
                className="w-12 h-12 rounded-2xl bg-white border border-[#E1F2ED] flex items-center justify-center shadow-sm"
              >
                <action.icon className={`w-5 h-5 ${action.color}`} />
              </motion.div>
              <span className="text-[11px] font-medium text-[#64748B]">{action.label}</span>
            </Link>
          ))}
        </motion.div>

        {/* PRIORITY 5: AI Widgets - Subtle, helpful suggestions */}
        <motion.div variants={fadeInUp}>
          <BehaviorPredictionWidget />
        </motion.div>

        {hasUnviewedAdjustment && recommendation && (
          <motion.div variants={fadeInUp}>
            <AdaptiveGoalCard
              recommendation={recommendation}
              currentCalories={profile?.daily_calorie_target || 2000}
              currentProtein={profile?.protein_target_g || 150}
              currentCarbs={profile?.carbs_target_g || 200}
              currentFat={profile?.fat_target_g || 65}
              onApply={applyAdjustment}
              onDismiss={dismissAdjustment}
              loading={adaptiveLoading}
            />
          </motion.div>
        )}

        {/* PRIORITY 6: Streak - Compact pill */}
        <motion.div 
          variants={fadeInUp}
          className="bg-white rounded-2xl p-4 shadow-sm border border-[#E1F2ED]"
        >
          {/* Streak Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <motion.div 
                variants={glowVariants}
                animate="glow"
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm"
              >
                <Flame className="w-4.5 h-4.5 text-white" />
              </motion.div>
              <div>
                <p className="text-sm font-bold text-[#0F172A]">{profile?.streak_days || 0} {t("day")} {t("streak")}</p>
                <p className="text-[11px] text-[#64748B]">{t("keep_going") || "Keep it up!"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-[#059669]">{completedThisWeek}<span className="text-xs font-normal text-[#64748B]">/{weekTarget}</span></p>
              <p className="text-[10px] text-[#64748B]">{t("this_week")}</p>
            </div>
          </div>

          {/* 7-Day Visual Row — Duolingo style */}
          <div className="flex justify-between gap-1">
            {weekDays.map((day, i) => {
              const isCompleted = i < completedThisWeek;
              const isToday = i === completedThisWeek;
              return (
                <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <motion.div 
                    whileTap={{ scale: 0.85, transition: springBouncy }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm"
                        : isToday
                        ? "border-2 border-dashed border-amber-400 bg-amber-50"
                        : "bg-[#F0F8F6]"
                    }`}
                  >
                    {isCompleted ? (
                      <motion.span 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        transition={{ type: "spring" as const, stiffness: 500, damping: 15 }}
                        className="text-white text-xs"
                      >✓</motion.span>
                    ) : isToday ? (
                      <span className="text-amber-500 text-[10px] font-bold">{i + 1}</span>
                    ) : (
                      <span className="text-[#64748B]/40 text-[10px]">{i + 1}</span>
                    )}
                  </motion.div>
                  <span className={`text-[10px] font-medium ${isToday ? "text-amber-600" : "text-[#64748B]/60"}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* PRIORITY 7: Restaurants - Last on home */}
        <motion.section variants={fadeInUp} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0F172A]">{t("top_rated")} {t("restaurants")}</h2>
          </div>

          <div className="relative -mx-5 px-5 overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 pb-2 snap-x snap-mandatory">
              {restaurantsLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-shrink-0 w-[240px]">
                      <div 
                        className="h-[148px] rounded-2xl"
                        style={{
                          background: "linear-gradient(90deg, rgb(241 245 249) 0%, rgb(241 245 249/0.5) 50%, rgb(241 245 249) 100%)",
                          backgroundSize: "200% 100%",
                          animation: "shimmer 1.5s infinite"
                        }}
                      />
                    </div>
                  ))}
                </>
              ) : restaurants.length === 0 ? (
                <Card className="w-full min-w-[240px] rounded-2xl shadow-sm border border-[#E1F2ED]">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-semibold mb-2 text-[#0F172A]">{t("no_featured_restaurants")}</h3>
                    <p className="text-sm text-[#64748B]">
                      {t("check_back_restaurants")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                restaurants.map((restaurant) => (
                  <motion.div
                    key={restaurant.id}
                    variants={fadeInUp}
                    className="flex-shrink-0 w-[240px] snap-start"
                    whileTap={{ scale: 0.98, transition: springBouncy }}
                  >
                    <Link to={`/restaurant/${restaurant.id}`} className="block group">
                      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200 border border-[#E1F2ED] bg-white rounded-2xl shadow-sm">
                        <div className="relative h-24 bg-[#F0F8F6]">
                          {restaurant.logo_url ? (
                            <img 
                              src={restaurant.logo_url} 
                              alt={restaurant.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#059669]/5 to-[#10B981]/5">
                              <Utensils className="w-8 h-8 text-[#059669]/30" />
                            </div>
                          )}
                          <motion.div whileTap={{ scale: 0.9, transition: springBouncy }}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-sm"
                              onClick={(e) => {
                                e.preventDefault();
                                toggleFavorite(restaurant.id, restaurant.name);
                              }}
                            >
                              <svg 
                                className={`w-4 h-4 ${isFavorite(restaurant.id) ? 'fill-rose-500 text-rose-500' : 'text-[#64748B]'}`}
                                viewBox="0 0 24 24" 
                                fill={isFavorite(restaurant.id) ? 'currentColor' : 'none'} 
                                stroke="currentColor" 
                                strokeWidth="2"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                              </svg>
                            </Button>
                          </motion.div>
                          <Badge className="absolute top-2 left-2 bg-amber-500/95 text-white border-0 text-[10px] font-semibold px-2 py-0.5 shadow-sm">
                            {t("featured_badge")}
                          </Badge>
                        </div>
                        
                        <CardContent className="p-3">
                          <h3 className="font-bold text-sm text-[#0F172A] mb-0.5 group-hover:text-[#059669] transition-colors line-clamp-1">
                            {restaurant.name}
                          </h3>
                          <p className="text-xs text-[#64748B] line-clamp-2 mb-2">
                            {restaurant.description || t("delicious_healthy_meals") || "Delicious healthy meals"}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-amber-500 fill-amber-500" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              <span className="text-xs font-medium text-[#0F172A]">{restaurant.rating.toFixed(1)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[#64748B]">
                              <span>{restaurant.meal_count} {t("meals_label")}</span>
                              <span className="text-[#E1F2ED]">•</span>
                              <span>{restaurant.total_orders} {t("orders_label")}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.section>
      </motion.main>

      {user && (
        <LogMealDialog
          open={logMealOpen}
          onOpenChange={setLogMealOpen}
          userId={user.id}
          onMealLogged={() => setProgressKey((k) => k + 1)}
        />
      )}
    </motion.div>
  );
};

export default Dashboard;