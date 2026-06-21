import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Home, UtensilsCrossed, Calendar, User } from "lucide-react";

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

  const visibleNavItems = isRTL ? [...navItems].reverse() : navItems;

  // Track which item is active based on path, not position
  const activeTab = navItems.find(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/")
  )?.key ?? null;

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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[1000]"
      style={{
        opacity: keyboardOpen ? 0 : 1,
        transition: "opacity 0.15s ease",
        pointerEvents: keyboardOpen ? "none" : "auto",
      }}
    >
      {/* Dock bar — fixed 56px, no extra padding below */}
      <div
        className="pointer-events-auto w-full"
        style={{
          height: "56px",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div className="mx-auto flex h-full max-w-[430px] items-center justify-around px-2">
          {visibleNavItems.map((tab) => {
            const active = isActiveTab(tab);
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
                  className="flex flex-col items-center justify-center"
                  style={{ gap: "3px" }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 400, damping: 24 }}
                >
                  {/* Icon container — fixed 32×32, no layout shift */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{ width: 32, height: 32 }}
                  >
                    {active && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute inset-0 rounded-[10px] bg-[#020617]"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <IconComponent
                      className="relative z-10 transition-colors duration-150"
                      style={{
                        width: 20,
                        height: 20,
                        color: active ? "#FFFFFF" : "#9CA3AF",
                        strokeWidth: active ? 2.25 : 1.75,
                      }}
                    />
                  </div>

                  {/* Label — always visible, same size */}
                  <span
                    className="text-[10px] font-semibold leading-none transition-colors duration-150"
                    style={{ color: active ? "#020617" : "#9CA3AF" }}
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
