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
  const { t } = useLanguage();
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
    { icon: Salad, label: t("nav_home"), to: "/dashboard" },
    { icon: Utensils, label: t("nav_restaurants"), to: "/meals" },
    { icon: Calendar, label: t("nav_schedule"), to: "/schedule" },
    ...(showAffiliateTab ? [{ icon: Users, label: t("nav_affiliate"), to: "/affiliate" }] : []),
    { icon: User, label: t("nav_profile"), to: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50 safe-bottom-nav">
      <div className="container mx-auto px-4">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isScheduleTab = item.to === "/schedule";
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={handleNavClick}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-4 min-w-[60px] min-h-[48px] rounded-xl transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <item.icon className={`w-6 h-6 ${active ? "fill-primary/20" : ""}`} />
                  {isScheduleTab && scheduleCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {scheduleCount > 9 ? "9+" : scheduleCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
