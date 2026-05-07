import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import flamAvatar from "@/assets/flam.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Utensils,
  Bell,
  Plus,
  Crown,
  Flame,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdaptiveGoals } from "@/hooks/useAdaptiveGoals";
import { LogMealDialog } from "@/components/LogMealDialog";
import { useFavoriteRestaurants } from "@/hooks/useFavoriteRestaurants";
import { useFeaturedRestaurants } from "@/hooks/useFeaturedRestaurants";
import { AdaptiveGoalCard } from "@/components/AdaptiveGoalCard";
import { DailyNutritionCard } from "@/components/DailyNutritionCard";
import { ActiveOrderBanner } from "@/components/ActiveOrderBanner";
import { BehaviorPredictionWidget } from "@/components/BehaviorPredictionWidget";
import { DashboardErrorBoundary } from "@/components/DashboardErrorBoundary";
import { OrderAgainRow } from "@/components/OrderAgainRow";
import { useLanguage } from "@/contexts/LanguageContext";
import { getQatarNow, getWeekStartDay, WEEK_DAYS_SATURDAY, WEEK_DAYS_MONDAY } from "@/lib/dateUtils";
import { spring, springBouncy, fadeInUp, staggerContainer, pageVariants } from "@/lib/animations";
import { useNotifications } from "@/hooks/useNotifications";
import { useDashboardRolloverCredits } from "@/hooks/useDashboardRolloverCredits";
import { useTodayProgress } from "@/hooks/useTodayProgress";
import { useHasRestaurant } from "@/hooks/useHasRestaurant";

const Dashboard = () => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const { profile, loading: profileLoading, error: profileError } = useProfile();
  const { hasActiveSubscription, remainingMeals, isUnlimited, isVip, subscription } = useSubscription();
  const { rolloverCredits } = useDashboardRolloverCredits(user?.id);
  const { 
    recommendation, 
    hasUnviewedAdjustment, 
    loading: adaptiveLoading, 
    applyAdjustment, 
    dismissAdjustment,
    edgeFunctionAvailable,
    adjustmentHistory
  } = useAdaptiveGoals();
  const { t, language } = useLanguage();

  const { isFavorite, toggleFavorite } = useFavoriteRestaurants();
  const { featuredRestaurants, loading: restaurantsLoading } = useFeaturedRestaurants();
  const [logMealOpen, setLogMealOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [progressKey, setProgressKey] = useState(0);
  const { todayProgress } = useTodayProgress(user?.id, selectedDate, progressKey);
  const { hasRestaurant } = useHasRestaurant(user?.id);
  const { unreadCount } = useNotifications(user?.id);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedToggleFavorite = useCallback((restaurantId: string, restaurantName: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      toggleFavorite(restaurantId, restaurantName);
    }, 300);
  }, [toggleFavorite]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = () => setProgressKey((k) => k + 1);
    window.addEventListener("nutrio:meal-progress-changed", handler);
    return () => window.removeEventListener("nutrio:meal-progress-changed", handler);
  }, []);

  useEffect(() => {
    if (!profileLoading && profile && profile.onboarding_completed === false) {
      navigate("/onboarding");
    }
  }, [profile, profileLoading, navigate]);

  const userStats = {
    dailyCalories: profile?.daily_calorie_target || 2000,
    consumedCalories: todayProgress.calories,
    protein: { target: profile?.protein_target_g || 150, consumed: todayProgress.protein },
    carbs: { target: profile?.carbs_target_g || 200, consumed: todayProgress.carbs },
    fat: { target: profile?.fat_target_g || 65, consumed: todayProgress.fat },
  };

  const userName = profile?.full_name?.split(" ")[0] || t("guest_greeting") || "there";

  const effectiveMealsLeft = isUnlimited ? Infinity : remainingMeals + rolloverCredits;
  const canOrder = hasActiveSubscription && (isUnlimited || (Number.isFinite(effectiveMealsLeft) && effectiveMealsLeft > 0));
  const weekTarget = canOrder ? 7 : 5;
  const streakDays = profile?.streak_days || 0;
  const isMultiWeekStreak = streakDays >= weekTarget * 2;
  const completedThisWeek = isMultiWeekStreak ? weekTarget : streakDays % weekTarget;
  const weekStartDay = getWeekStartDay(language);
  const dayOrder = weekStartDay === 6 ? WEEK_DAYS_SATURDAY : WEEK_DAYS_MONDAY;
  const dayKeys = ["day_sun", "day_mon", "day_tue", "day_wed", "day_thu", "day_fri", "day_sat"] as const;
  const weekDays = dayOrder.map(d => ({ label: t(dayKeys[d]) }));

  const containerRef = useRef<HTMLDivElement>(null);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-primary/5 gap-4 px-5">
        <div className="w-full max-w-[480px] space-y-4">
          <div className="h-14 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
          <div className="h-32 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
          <div className="h-24 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
          <div className="h-12 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
        </div>
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#ECFDF5]/30 gap-4 px-5">
        <div className="w-full max-w-[400px] text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">We couldn&#39;t load your profile. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = getQatarNow().getHours();
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
      className="min-h-screen bg-background"
      style={{ overscrollBehaviorY: "contain" }}
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-white focus:text-primary focus:text-sm focus:rounded">
        {t("skip_to_main") || "Skip to main content"}
      </a>
      {/* Profile sync warning — stale data with error */}
      {profileError && profile && (
        <div className="bg-warning/10 border-b border-warning/20 px-5 py-1.5 text-center" role="alert">
          <p className="text-[10px] font-medium text-warning">{t("profile_sync_warning") || "Some data may be outdated. Refresh to update."}</p>
        </div>
      )}

      {/* Header - Clean, iOS-style */}
      <motion.header 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 pt-2"
      >
        <div className="max-w-[480px] mx-auto px-5 h-14 flex items-center justify-between">
          <motion.div whileTap={prefersReducedMotion ? undefined : { scale: 0.97, transition: springBouncy }}>
            <Link to="/profile" className="flex items-center gap-3 transition-transform" data-testid="header-avatar-link">
              <div className={`relative w-10 h-10 rounded-full overflow-hidden border-2 ${
                isVip ? "border-warning/80" : "border-border"
              }`}>
                <img
                  src={profile?.avatar_url || flamAvatar}
                  alt={userName}
                  loading="eager"
                  className="w-full h-full object-cover"
                  data-testid="user-avatar-image"
                />
                {isVip && (
                  <motion.div 
                    className="absolute -bottom-0.5 -right-0.5 bg-gradient-to-br from-warning to-warning/80 rounded-full p-0.5 shadow-sm"
                  >
                    <Crown className="w-3 h-3 text-warning-foreground" />
                  </motion.div>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground leading-tight">
                  {getGreeting()}
                </p>
                <p className="font-semibold text-sm text-foreground leading-tight">{userName}</p>
              </div>
            </Link>
          </motion.div>
          <div className="flex items-center gap-2">
            {/* Subscription pill - compact */}
            {hasActiveSubscription && subscription && (
              <Link to="/subscription" aria-label={t("subscription")}>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary">
                  <Flame className="w-3 h-3" />
                  {isUnlimited ? "∞" : effectiveMealsLeft}
                </span>
              </Link>
            )}
            {!hasActiveSubscription && (
              <Link to="/subscription/plans" aria-label={t("subscribe_cta_title") || "Subscribe"}>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/10 border border-warning/20 text-[10px] font-bold text-warning">
                  <Crown className="w-3 h-3" />
                  {t("subscribe") || "Subscribe"}
                </span>
              </Link>
            )}
            <Link to="/notifications" className="relative" aria-live="polite">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9, transition: springBouncy }}
              >
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="w-11 h-11 rounded-full hover:bg-primary/10 transition-transform"
                  aria-label={unreadCount > 0 ? t("notifications_unread") || `Notifications (${unreadCount})` : t("notifications") || "Notifications"}
                >
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
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
        id="main-content"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-[480px] md:max-w-lg mx-auto px-5 py-4 space-y-5 pb-24"
      >
        {/* All used warning — compact, appears when meals exhausted */}
        {hasActiveSubscription && subscription && !isUnlimited && effectiveMealsLeft === 0 && (
          <motion.div variants={fadeInUp}>
            <Link to="/subscription">
              <div className="rounded-2xl bg-warning/10 border border-warning/20 px-4 py-2.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-warning/20 flex items-center justify-center shrink-0">
                  <Utensils className="w-4 h-4 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-warning">{t("plan_card_all_used_title")}</p>
                  <p className="text-[10px] text-warning/70">
                    {subscription?.end_date
                      ? t("plan_card_all_used_reset").replace("{date}", new Date(subscription.end_date).toLocaleDateString())
                      : t("plan_card_all_used_next_renewal")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-warning shrink-0" />
              </div>
            </Link>
          </motion.div>
        )}

        {/* PRIORITY 1: Nutrition Progress (with streak inline) */}
        <DashboardErrorBoundary name="nutrition card">
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
              streakDays={streakDays}
              weekTarget={weekTarget}
              completedThisWeek={completedThisWeek}
              weekDays={weekDays}
            />
          </motion.div>
        </DashboardErrorBoundary>

        {/* PRIORITY 2: Log Meal Button - Primary CTA */}
        <motion.div variants={fadeInUp}>
          <motion.button
            data-testid="log-meal-button"
            onClick={() => setLogMealOpen(true)}
            aria-label={t("log_meal")}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97, transition: springBouncy }}
            whileHover={prefersReducedMotion ? undefined : { boxShadow: "0 4px 12px hsl(var(--primary) / 0.3)" }}
            className="w-full rounded-2xl h-12 font-semibold text-sm text-primary-foreground shadow-sm transition-shadow bg-primary hover:bg-primary/90"
          >
            <Plus className="w-5 h-5 mr-2 inline-block" />
            {t("log_meal")}
          </motion.button>
        </motion.div>

        {/* PRIORITY 3: Active Orders (compact) + Order Again */}
        {user && (
          <>
            <DashboardErrorBoundary name="active orders">
              <motion.div variants={fadeInUp}>
                <ActiveOrderBanner userId={user.id} compact />
              </motion.div>
            </DashboardErrorBoundary>

            <DashboardErrorBoundary name="order again">
              <motion.div variants={fadeInUp}>
                <OrderAgainRow />
              </motion.div>
            </DashboardErrorBoundary>
          </>
        )}

        {/* PRIORITY 4: Restaurants */}
        <motion.div variants={fadeInUp} className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground">{t("top_rated")} {t("restaurants")}</h2>
            <Link to="/meals">
              <span className="text-xs font-medium text-primary">{t("view_all") || "View all"}</span>
            </Link>
          </div>

          <div className="relative -mx-5 px-5 overflow-x-auto scrollbar-hide" role="region" aria-label={t("top_rated") + " " + t("restaurants")}>
            <div className="flex gap-4 pb-2 snap-x snap-mandatory">
              {restaurantsLoading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex-shrink-0 w-[240px]">
                      <div className="h-[148px] rounded-2xl bg-muted animate-pulse" />
                    </div>
                  ))}
                </>
              ) : featuredRestaurants.length === 0 ? (
                <Card className="w-full min-w-[240px] rounded-2xl shadow-sm border border-border bg-card">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-semibold mb-2 text-foreground">{t("no_featured_restaurants")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t("check_back_restaurants")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                featuredRestaurants.map((restaurant) => (
                  <motion.div
                    key={restaurant.id}
                    variants={fadeInUp}
                    className="flex-shrink-0 w-[240px] snap-start"
                    whileTap={prefersReducedMotion ? undefined : { scale: 0.98, transition: springBouncy }}
                  >
                    <Link to={`/restaurant/${restaurant.id}`} className="block group">
                      <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200 border border-border bg-card rounded-2xl shadow-sm">
                        <div className="relative h-24 bg-primary/5">
                          {restaurant.logo_url ? (
                            <img 
                              src={restaurant.logo_url} 
                              alt={`${restaurant.name} logo`}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                              <Utensils className="w-8 h-8 text-primary/30" />
                            </div>
                          )}
                          <motion.div whileTap={prefersReducedMotion ? undefined : { scale: 0.9, transition: springBouncy }}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 w-8 h-8 bg-background/90 hover:bg-background rounded-full shadow-sm"
                              aria-label={isFavorite(restaurant.id) ? t("remove_from_favorites") : t("add_to_favorites")}
                              onClick={(e) => {
                                e.preventDefault();
                                debouncedToggleFavorite(restaurant.id, restaurant.name);
                              }}
                            >
                              <svg 
                                className={`w-4 h-4 ${isFavorite(restaurant.id) ? 'fill-destructive text-destructive' : 'text-muted-foreground'}`}
                                viewBox="0 0 24 24" 
                                fill={isFavorite(restaurant.id) ? 'currentColor' : 'none'} 
                                stroke="currentColor" 
                                strokeWidth="2"
                              >
                                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                              </svg>
                            </Button>
                          </motion.div>
                          <Badge className="absolute top-2 left-2 bg-warning/95 text-warning-foreground border-0 text-[10px] font-semibold px-2 py-0.5 shadow-sm">
                            {t("featured_badge")}
                          </Badge>
                        </div>
                        
                        <CardContent className="p-3">
                          <h3 className="font-bold text-sm text-foreground mb-0.5 group-hover:text-primary transition-colors line-clamp-1">
                            {restaurant.name}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {restaurant.description || t("delicious_healthy_meals") || "Delicious healthy meals"}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {restaurant.rating > 0 ? (
                                <>
                                  <svg className="w-3.5 h-3.5 text-warning fill-warning" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                  </svg>
                                  <span className="text-xs font-medium text-foreground">{restaurant.rating.toFixed(1)}</span>
                                </>
                              ) : (
                                <span className="text-xs font-medium text-muted-foreground italic">{t("new_restaurant") || "New"}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{restaurant.meal_count} {t("meals_label")}</span>
                              <span className="text-border">•</span>
                              <span>{restaurant.total_orders} {t("orders_count_label")}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
            <div className="pointer-events-none absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent" aria-hidden="true" />
          </div>
        </motion.div>

        {/* PRIORITY 5: AI Widgets - Collapsible insights section */}
        <details className="group">
          <summary className="cursor-pointer flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
            {t("ai_insights") || "AI Insights"}
          </summary>
          <motion.div className="mt-3 space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
            {edgeFunctionAvailable === false ? (
              <p className="text-xs text-muted-foreground text-center py-2">{t("ai_suggestions_unavailable") || "AI suggestions temporarily unavailable"}</p>
            ) : edgeFunctionAvailable === null && adaptiveLoading ? (
              <div className="h-16 rounded-2xl bg-gradient-to-r from-muted via-muted/50 to-muted animate-[shimmer_1.5s_infinite]" style={{ backgroundSize: "200% 100%" }} />
            ) : (
              <DashboardErrorBoundary name="AI insight">
                <BehaviorPredictionWidget />
              </DashboardErrorBoundary>
            )}

            {edgeFunctionAvailable !== false && hasUnviewedAdjustment && recommendation && (
              <DashboardErrorBoundary name="adaptive goals">
                <AdaptiveGoalCard
                  recommendation={recommendation}
                  currentCalories={profile?.daily_calorie_target || 2000}
                  currentProtein={profile?.protein_target_g || 150}
                  currentCarbs={profile?.carbs_target_g || 200}
                  currentFat={profile?.fat_target_g || 65}
                  adjustmentId={adjustmentHistory.length > 0 ? adjustmentHistory.find(h => !h.applied)?.id : undefined}
                  onApply={applyAdjustment}
                  onDismiss={dismissAdjustment}
                  loading={adaptiveLoading}
                />
              </DashboardErrorBoundary>
            )}
          </motion.div>
        </details>
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