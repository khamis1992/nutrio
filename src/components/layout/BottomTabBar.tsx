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
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-[1000] px-4"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 8px)",
        opacity: keyboardOpen ? 0 : 1,
        transition: "opacity 0.15s ease",
        pointerEvents: keyboardOpen ? "none" : undefined,
      }}
    >
      <div className="pointer-events-auto mx-auto max-w-[420px]">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative rounded-[28px] border border-white/50 bg-white/80 shadow-[0_-2px_20px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-[24px]"
          style={{ minHeight: "78px" }}
        >
          <div className="flex items-center justify-around px-4 py-3">
            {displayTabs.map((tab, i) => {
              const active = i === rtlActiveIndex;
              const IconComponent = tab.Icon;

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className="relative flex flex-col items-center justify-center outline-none"
                  aria-current={active ? "page" : undefined}
                >
                  <motion.div
                    className="relative flex flex-col items-center justify-center"
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 400, damping: 24 }}
                  >
                    {active ? (
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 28 }}
                        className="flex h-[46px] w-[46px] flex-col items-center justify-center"
                      >
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.05, type: "spring", stiffness: 500, damping: 28 }}
                          className="mb-1 h-[4px] w-[4px] rounded-full bg-[#10B981]"
                        />
                        <motion.div
                          layoutId="active-tab-circle"
                          className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-gradient-to-br from-[#25C878] to-[#08995A] shadow-[0_4px_12px_rgba(16,185,129,0.25)]"
                          style={{ scale: 1.04 }}
                        >
                          <IconComponent className="h-[18px] w-[18px] text-white" strokeWidth={2} />
                        </motion.div>
                        <span className="mt-1 text-[11px] font-medium leading-none text-[#111827]">
                          {t(tab.labelKey)}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center gap-1.5 py-1"
                        style={{ opacity: 0.85 }}
                        whileHover={{ opacity: 1 }}
                        whileTap={{ scale: 0.95, opacity: 0.7 }}
                        transition={{ type: "spring", stiffness: 400, damping: 24 }}
                      >
                        <IconComponent className="h-[22px] w-[22px] text-[#64748B]" strokeWidth={1.75} />
                        <span className="text-[11px] font-normal leading-none text-[#64748B]">
                          {t(tab.labelKey)}
                        </span>
                      </motion.div>
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </nav>
  );
}