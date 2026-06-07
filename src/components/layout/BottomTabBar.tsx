import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Home, UtensilsCrossed, Calendar, User } from "lucide-react";

const tabs = [
  { path: "/dashboard", labelKey: "home", Icon: Home },
  { path: "/meals", labelKey: "meals", Icon: UtensilsCrossed },
  { path: "/schedule", labelKey: "schedule", Icon: Calendar },
  { path: "/profile", labelKey: "profile", Icon: User },
];

interface BottomTabBarProps {
  keyboardOpen?: boolean;
}

export function BottomTabBar({ keyboardOpen = false }: BottomTabBarProps) {
  const location = useLocation();
  const { t, isRTL } = useLanguage();

  const activeIndex = tabs.findIndex(
    (tab) => location.pathname === tab.path || location.pathname.endsWith(tab.path)
  );
  const displayTabs = isRTL ? [...tabs].reverse() : tabs;
  const rtlActiveIndex = isRTL
    ? displayTabs.findIndex(
        (tab) => location.pathname === tab.path || location.pathname.endsWith(tab.path)
      )
    : activeIndex;

  return (
    <nav
      data-testid="bottom-tab-bar"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000]"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        opacity: keyboardOpen ? 0 : 1,
        transition: "opacity 0.15s ease",
        pointerEvents: keyboardOpen ? "none" : "auto",
      }}
    >
      <div
        className="pointer-events-auto w-full"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 -1px 0 rgba(0,0,0,0.05)",
        }}
      >
        <div className="mx-auto flex max-w-[430px] items-center justify-around px-2"
          style={{ height: "56px" }}
        >
          {displayTabs.map((tab, i) => {
            const active = i === rtlActiveIndex;
            const IconComponent = tab.Icon;

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="flex flex-1 flex-col items-center justify-center outline-none"
                style={{ minWidth: 0 }}
                aria-current={active ? "page" : undefined}
              >
                <motion.div
                  className="flex flex-col items-center justify-center gap-[3px]"
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 400, damping: 24 }}
                >
                  <div className="relative flex items-center justify-center">
                    {active && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute inset-0 rounded-full bg-emerald-50"
                        style={{ width: 36, height: 36, margin: "auto" }}
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <IconComponent
                      className={`relative z-10 h-[22px] w-[22px] transition-colors duration-150 ${
                        active ? "text-[#10B981]" : "text-[#8E9AAB]"
                      }`}
                      strokeWidth={active ? 2.25 : 1.75}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-medium leading-none transition-colors duration-150 ${
                      active ? "text-[#10B981]" : "text-[#8E9AAB]"
                    }`}
                  >
                    {t(tab.labelKey)}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
