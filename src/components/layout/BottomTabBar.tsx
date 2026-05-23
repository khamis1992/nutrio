import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const tabs = [
  {
    path: "/dashboard",
    labelKey: "home",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z"/>
      </svg>
    ),
  },
  {
    path: "/meals",
    labelKey: "meals",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2v20" />
        <path d="M4 2v7a2 2 0 004 0V2" />
        <path d="M17 2v20" />
        <path d="M17 2c2.2 1.7 3.3 4.2 3.3 7.5H17" />
      </svg>
    ),
  },
  {
    path: "/schedule",
    labelKey: "schedule",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
        <line x1="9" y1="2" x2="9" y2="6"/>
        <line x1="15" y1="2" x2="15" y2="6"/>
        <line x1="8" y1="14" x2="8" y2="14.01"/>
        <line x1="12" y1="14" x2="12" y2="14.01"/>
        <line x1="16" y1="14" x2="16" y2="14.01"/>
        <line x1="8" y1="18" x2="8" y2="18.01"/>
        <line x1="12" y1="18" x2="12" y2="18.01"/>
        <line x1="16" y1="18" x2="16" y2="18.01"/>
      </svg>
    ),
  },
  {
    path: "/profile",
    labelKey: "profile",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M20 21a8 8 0 10-16 0"/>
      </svg>
    ),
  },
];

export function BottomTabBar() {
  const location = useLocation();
  const { t, isRTL } = useLanguage();

  const activeIndex = tabs.findIndex((tab) => location.pathname === tab.path || location.pathname.endsWith(tab.path));
  const displayTabs = isRTL ? [...tabs].reverse() : tabs;
  // When RTL, the active tab is at a different index in the reversed array
  const rtlActiveIndex = isRTL
    ? displayTabs.findIndex((tab) => location.pathname === tab.path || location.pathname.endsWith(tab.path))
    : activeIndex;

  return (
    <nav
      data-testid="bottom-tab-bar"
      className="pointer-events-none fixed bottom-3 left-0 right-0 z-50 px-[18px]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="pointer-events-auto mx-auto h-[62px] max-w-[396px] rounded-full border border-white/80 bg-white/95 shadow-[0_14px_34px_rgba(15,23,42,0.10)] backdrop-blur-xl">
        <div className="flex h-full items-center justify-around px-3">
          {displayTabs.map((tab, i) => {
            const active = i === rtlActiveIndex;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="relative flex h-full flex-1 items-center justify-center"
                aria-current={active ? "page" : undefined}
              >
                {active ? (
                  <motion.div
                    layoutId="tab-pill"
                    className="absolute -top-[15px] flex h-[54px] w-[54px] flex-col items-center justify-center rounded-full bg-[#D8F8DE] text-[#059669] shadow-[0_8px_20px_rgba(16,185,129,0.16)]"
                    transition={{
                      type: "spring" as const,
                      stiffness: 420,
                      damping: 32,
                      mass: 0.85,
                    }}
                  >
                    <span className="mb-0.5 flex h-[25px] w-[25px] items-center justify-center rounded-[9px] bg-gradient-to-br from-[#25C878] to-[#08995A] text-white shadow-[0_6px_10px_rgba(16,185,129,0.22)]">
                      {tab.icon(true)}
                    </span>
                    <span className="text-[10px] font-bold leading-none">{t(tab.labelKey)}</span>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500 transition-colors duration-200">
                    <span className="text-slate-500">{tab.icon(false)}</span>
                    <span className="text-[10px] font-semibold leading-none text-slate-500">{t(tab.labelKey)}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="mx-auto mt-2 h-[4px] w-[72px] rounded-full bg-slate-400/50" />
    </nav>
  );
}
