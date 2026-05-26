import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { getQatarDay } from "@/lib/dateUtils";
import { withRetry } from "@/lib/retry";
import { useLanguage } from "@/contexts/LanguageContext";
import { fadeInUp } from "@/lib/animations";

const DISMISS_KEY = "rollover_expiry_nudge_dismissed";
const EXPIRY_WINDOW_DAYS = 7;

function getDismissedThreshold(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function setDismissed(expiryDate: string): void {
  try {
    localStorage.setItem(DISMISS_KEY, expiryDate);
  } catch {
    // localStorage unavailable
  }
}

interface RolloverRecord {
  id: string;
  rollover_credits: number;
  expiry_date: string;
}

export function RolloverExpiryNudge({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const [nudge, setNudge] = useState<{
    totalCredits: number;
    daysUntilExpiry: number;
    expiryDate: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchRollovers = async () => {
      try {
        const today = getQatarDay();
        const dismissedUntil = getDismissedThreshold();

        const { data } = await withRetry(async () => {
          const result = await supabase
            .from("subscription_rollovers")
            .select("id, rollover_credits, expiry_date")
            .eq("user_id", userId)
            .eq("status", "active")
            .gte("expiry_date", today);
          if (result.error) throw result.error;
          return result;
        }, { maxAttempts: 2, delayMs: 500 });

        if (cancelled || !data || data.length === 0) {
          if (!cancelled) setNudge(null);
          return;
        }

        const records = data as RolloverRecord[];

        const totalCredits = records.reduce(
          (sum, r) => sum + (r.rollover_credits || 0),
          0
        );

        if (totalCredits <= 0) {
          if (!cancelled) setNudge(null);
          return;
        }

        const earliestExpiry = records
          .map((r) => r.expiry_date)
          .sort()[0];

        if (dismissedUntil && earliestExpiry <= dismissedUntil) {
          if (!cancelled) setNudge(null);
          return;
        }

        const expiryDate = new Date(earliestExpiry);
        const now = new Date(today);
        const diffMs = expiryDate.getTime() - now.getTime();
        const daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

        if (daysUntilExpiry > EXPIRY_WINDOW_DAYS) {
          if (!cancelled) setNudge(null);
          return;
        }

        if (!cancelled) {
          setNudge({ totalCredits, daysUntilExpiry, expiryDate: earliestExpiry });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("RolloverExpiryNudge fetch error:", err);
          setNudge(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRollovers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleDismiss = () => {
    if (nudge) {
      setDismissed(nudge.expiryDate);
      setNudge(null);
    }
  };

  if (loading || !nudge || nudge.totalCredits <= 0) return null;

  return (
    <motion.div variants={fadeInUp}>
      <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3 relative group">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
          <Clock className="w-4 h-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-800">
            {nudge.totalCredits} {t("rollover_credits_count", { count: nudge.totalCredits })} {t("rollover_expires_in_days", { days: nudge.daysUntilExpiry })}
          </p>
          <p className="text-[10px] text-amber-600 mt-0.5">
            {t("rollover_expiry_nudge_subtitle") || "Use them before they expire!"}
          </p>
        </div>
        <Link
          to="/meals"
          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
        >
          {t("rollover_use_credits") || "Use Credits Now"}
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={handleDismiss}
          aria-label={t("dismiss") || "Dismiss"}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
