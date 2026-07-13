import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Salad, Utensils, Calendar, Users, User } from "lucide-react";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { hapticFeedback } from "@/lib/capacitor";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfWeek, addDays, format } from "date-fns";

function useScheduleCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    supabase
      .from("meal_schedules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"))
      .then(({ count: c }) => setCount(c || 0));
  }, [user]);

  return count;
}

export function CustomerNavigation() {
  const location = useLocation();
  const { isApprovedAffiliate } = useAffiliateApplication();
  const { settings: platformSettings } = usePlatformSettings();
  const { t, isRTL } = useLanguage();
  const scheduleCount = useScheduleCount();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    // Provide haptic feedback on tab switch
    hapticFeedback.tabSwitch();
  };

  // Only show affiliate tab if user is approved and program is enabled
  const showAffiliateTab = isApprovedAffiliate && platformSettings.features.referral_program;

  const navItems = [
    { key: "home", icon: Salad, label: t("nav_home"), to: "/dashboard" },
    { key: "meals", icon: Utensils, label: t("nav_meals"), to: "/meals" },
    { key: "schedule", icon: Calendar, label: t("nav_schedule"), to: "/schedule" },
    ...(showAffiliateTab ? [{ key: "affiliate", icon: Users, label: t("nav_affiliate"), to: "/affiliate" }] : []),
    { key: "profile", icon: User, label: t("nav_profile"), to: "/profile" },
  ];

  const visibleNavItems = isRTL ? [...navItems].reverse() : navItems;

  return (
    <nav
      dir="ltr"
      aria-label="Bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5EAF1]/80 bg-white/92 shadow-[0_-14px_34px_rgba(2,6,23,0.08)] backdrop-blur-xl safe-bottom-nav"
    >
      <div className="mx-auto w-full max-w-[480px] px-3">
        <div className="grid h-[62px] grid-flow-col auto-cols-fr items-center gap-1">
          {visibleNavItems.map((item) => {
            const isScheduleTab = item.to === "/schedule";
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                onClick={handleNavClick}
                className={`relative flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-1.5 text-center transition-colors duration-200 ${
                  active
                    ? "text-[#020617]"
                    : "text-[#94A3B8] hover:text-[#020617]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="customer-nav-active"
                    className="absolute inset-x-1 top-1 h-[42px] rounded-[16px] bg-[#020617] shadow-[0_10px_22px_rgba(2,6,23,0.16)]"
                    transition={{ type: "spring", stiffness: 430, damping: 34 }}
                  />
                )}
                <div className={`relative grid h-7 w-7 place-items-center rounded-[10px] transition-colors ${active ? "text-white" : ""}`}>
                  <item.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2.1} />
                  {isScheduleTab && scheduleCount > 0 && (
                    <span className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black ring-2 ring-white ${active ? "bg-white text-[#020617]" : "bg-[#020617] text-white"}`}>
                      {scheduleCount > 9 ? "9+" : scheduleCount}
                    </span>
                  )}
                </div>
                <span className={`relative max-w-full truncate text-[10px] font-black leading-none ${active ? "text-white" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
