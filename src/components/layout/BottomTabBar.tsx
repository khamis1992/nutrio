import { useLocation, Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Home, UtensilsCrossed, Calendar, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "home", path: "/dashboard", labelKey: "nav_home", Icon: Home },
  { key: "meals", path: "/meals", labelKey: "nav_meals", Icon: UtensilsCrossed },
  { key: "schedule", path: "/schedule", labelKey: "nav_schedule", Icon: Calendar },
  { key: "profile", path: "/profile", labelKey: "nav_profile", Icon: User },
];

interface BottomTabBarProps {
  keyboardOpen?: boolean;
}

export function BottomTabBar({ keyboardOpen = false }: BottomTabBarProps) {
  const location = useLocation();
  const { t, isRTL } = useLanguage();
  const prefersReducedMotion = useReducedMotion();

  const visibleNavItems = isRTL ? [...navItems].reverse() : navItems;

  const isActiveTab = (item: typeof navItems[0]) => {
    if (item.path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname === item.path || location.pathname.startsWith(item.path + "/");
  };

  return (
    <nav
      dir="ltr"
      data-testid="bottom-tab-bar"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000] flex justify-center"
      style={{
        opacity: keyboardOpen ? 0 : 1,
        transition: "opacity 0.15s ease",
        pointerEvents: keyboardOpen ? "none" : "auto",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="pointer-events-auto w-full max-w-[430px] mx-4">
        <div className="flex relative rounded-full bg-white p-1.5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 z-10">
          {visibleNavItems.map((tab) => {
            const active = isActiveTab(tab);
            const IconComponent = tab.Icon;

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="relative flex-1 flex flex-col items-center justify-center min-h-[56px] py-1.5 outline-none z-10 shrink-0"
                style={{ minWidth: 0 }}
                aria-current={active ? "page" : undefined}
              >
                {active && !prefersReducedMotion && (
                  <motion.div
                    layoutId="bottom-tab-indicator"
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute inset-0 bg-[#101A34] rounded-[26px] shadow-[0_16px_30px_rgba(16,26,52,0.28)] -z-10"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
                  />
                )}
                {active && prefersReducedMotion && (
                  <div className="absolute inset-0 bg-[#101A34] rounded-[26px] shadow-[0_16px_30px_rgba(16,26,52,0.28)] -z-10" />
                )}
                
                <motion.div
                  key={`icon-${active}`}
                  initial={!prefersReducedMotion && active ? { scale: 0.6 } : false}
                  animate={{ scale: 1 }}
                  transition={!prefersReducedMotion && active ? { type: "spring", bounce: 0.5, duration: 0.5 } : undefined}
                  className="relative z-10 flex items-center justify-center"
                >
                  <IconComponent
                    className={cn(
                      "transition-all duration-300",
                      active ? "text-[#2FE6A7] h-[22px] w-[22px]" : "text-[#22C7A1]/50 h-[20px] w-[20px]"
                    )}
                    strokeWidth={active ? 2.5 : 2}
                  />
                </motion.div>

                <motion.span
                  key={`label-${active}`}
                  initial={!prefersReducedMotion && active ? { opacity: 0.5, y: 2 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={!prefersReducedMotion && active ? { duration: 0.3 } : undefined}
                  className={cn(
                    "relative z-10 mt-1 capitalize transition-colors duration-300",
                    active ? "text-white font-extrabold text-[12px]" : "text-[#3A4358] font-semibold text-[12px]"
                  )}
                >
                  {t(tab.labelKey)}
                </motion.span>

                {active && (
                  <motion.div
                    initial={prefersReducedMotion ? undefined : { scaleX: 0 }}
                    animate={prefersReducedMotion ? undefined : { scaleX: 1 }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                    className="relative z-10 w-6 h-[3px] bg-[#2FE6A7] rounded-full mt-1"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
