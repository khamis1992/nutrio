import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Shield, X, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getQatarNow, getQatarDay } from "@/lib/dateUtils";
import { withRetry } from "@/lib/retry";
import { useLanguage } from "@/contexts/LanguageContext";
import { fadeInUp, springBouncy } from "@/lib/animations";

const FREEZE_KEY = "streak_freeze_used_month";
const STREAK_AT_RISK_HOURS = 23;

function getFreezeMonth(): string {
  try {
    return localStorage.getItem(FREEZE_KEY) || "";
  } catch {
    return "";
  }
}

function setFreezeMonth(monthKey: string): void {
  try {
    localStorage.setItem(FREEZE_KEY, monthKey);
  } catch {
    // localStorage unavailable
  }
}

function getCurrentMonthKey(): string {
  const now = getQatarNow();
  return `${now.getFullYear()}-${now.getMonth()}`;
}

export function StreakRecoveryBanner({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const [showBanner, setShowBanner] = useState(false);
  const [freezeAvailable, setFreezeAvailable] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [hoursSinceLastLog, setHoursSinceLastLog] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const checkStreakStatus = async () => {
      try {
        const currentMonth = getCurrentMonthKey();
        const freezeUsed = getFreezeMonth() === currentMonth;

        const { data: streakData } = await withRetry(async () => {
          const result = await supabase
            .from("user_streaks")
            .select("current_streak, last_log_date")
            .eq("user_id", userId)
            .eq("streak_type", "logging")
            .maybeSingle();
          if (result.error) throw result.error;
          return result;
        }, { maxAttempts: 2, delayMs: 500 });

        if (cancelled) return;

        const currentStreak = streakData?.current_streak || 0;
        const lastLogDate = streakData?.last_log_date || null;

        if (currentStreak === 0) {
          setShowBanner(false);
          setLoading(false);
          return;
        }

        const now = getQatarNow();
        const todayStr = getQatarDay();

        let hoursSince = 0;

        if (lastLogDate) {
          const lastLog = new Date(lastLogDate);
          hoursSince = Math.floor((now.getTime() - lastLog.getTime()) / (1000 * 60 * 60));
        } else {
          const { data: progressData } = await supabase
            .from("progress_logs")
            .select("created_at")
            .eq("user_id", userId)
            .eq("log_date", todayStr)
            .order("created_at", { ascending: false })
            .limit(1);

          if (progressData && progressData.length > 0) {
            const lastLog = new Date(progressData[0].created_at);
            hoursSince = Math.floor((now.getTime() - lastLog.getTime()) / (1000 * 60 * 60));
          } else {
            // Check yesterday if no today log
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split("T")[0];

            const { data: yesterdayData } = await supabase
              .from("progress_logs")
              .select("created_at")
              .eq("user_id", userId)
              .eq("log_date", yesterdayStr)
              .order("created_at", { ascending: false })
              .limit(1);

            if (yesterdayData && yesterdayData.length > 0) {
              const lastLog = new Date(yesterdayData[0].created_at);
              hoursSince = Math.floor((now.getTime() - lastLog.getTime()) / (1000 * 60 * 60));
            }
          }
        }

        if (cancelled) return;

        setStreakDays(currentStreak);
        setHoursSinceLastLog(hoursSince);
        setFreezeAvailable(!freezeUsed);

        if (hoursSince >= STREAK_AT_RISK_HOURS && freezeAvailable) {
          setShowBanner(true);
        } else if (hoursSince >= STREAK_AT_RISK_HOURS && !freezeAvailable) {
          setShowBanner(true);
        } else {
          setShowBanner(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("StreakRecoveryBanner fetch error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    checkStreakStatus();

    return () => {
      cancelled = true;
    };
  }, [userId, freezeAvailable]);

  const handleFreeze = async () => {
    try {
      const currentMonth = getCurrentMonthKey();
      setFreezeMonth(currentMonth);
      setFreezeAvailable(false);

      const { error } = await supabase
        .from("user_streaks")
        .update({
          last_log_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("streak_type", "logging");

      if (error) throw error;

      setShowBanner(false);
    } catch (err) {
      console.error("Streak freeze failed:", err);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
  };

  const hoursRemaining = 24 - hoursSinceLastLog;

  if (loading || !showBanner) return null;

  return (
    <motion.div variants={fadeInUp}>
      <div className="rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 px-4 py-3 flex items-center gap-3 relative group shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shrink-0 shadow-sm">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-orange-800">
            {freezeAvailable
              ? t("streak_at_risk_banner") || `Your ${streakDays}-day streak is at risk! Log a meal soon to keep it.`
              : t("streak_freeze_used") || `Streak freeze already used this month. Log now to save your ${streakDays}-day streak!`}
          </p>
          <p className="text-[10px] text-orange-600 mt-0.5">
            {freezeAvailable
              ? hoursRemaining > 0
                ? (t("streak_hours_remaining") || `${hoursRemaining}h remaining — or use streak freeze`)
                  .replace("{hours}", String(hoursRemaining))
                  .replace("{streak}", String(streakDays))
                : t("streak_about_to_break") || "Your streak is about to break! Act now."
              : t("streak_log_now") || "Log a meal now to keep your streak alive!"}
          </p>
        </div>
        {freezeAvailable ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleFreeze}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-semibold hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm"
          >
            <Shield className="w-3.5 h-3.5" />
            {t("streak_freeze") || "Freeze"}
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleDismiss}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors"
          >
            {t("log_now") || "Log Now"}
            <ChevronRight className="w-3.5 h-3.5" />
          </motion.button>
        )}
        <button
          onClick={handleDismiss}
          aria-label={t("dismiss") || "Dismiss"}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-orange-400 hover:text-orange-600 hover:bg-orange-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
