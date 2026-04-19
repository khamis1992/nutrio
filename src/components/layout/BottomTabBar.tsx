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
    labelKey: "restaurants",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/>
        <line x1="10" y1="1" x2="10" y2="4"/>
        <line x1="14" y1="1" x2="14" y2="4"/>
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
  const { t } = useLanguage();

  const activeIndex = tabs.findIndex((tab) => tab.path === location.pathname);

  return (
    <nav
      data-testid="bottom-tab-bar"
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Subtle top border with fade */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

      <div className="bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex items-center justify-around h-16 max-w-[480px] px-2">
          {tabs.map((tab, i) => {
            const active = i === activeIndex;
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className="relative flex flex-col items-center justify-center w-full h-full gap-1"
                aria-current={active ? "page" : undefined}
              >
                {/* Icon container with subtle active background */}
                <div className="relative">
                  {active && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute -inset-2 bg-primary/10 rounded-2xl"
                      transition={{
                        type: "spring" as const,
                        stiffness: 400,
                        damping: 30,
                        mass: 0.8,
                      }}
                    />
                  )}
                  <span
                    className={`relative z-10 transition-all duration-300 ${
                      active ? "text-primary scale-110" : "text-gray-400"
                    }`}
                  >
                    {tab.icon(active)}
                  </span>
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] font-semibold tracking-wide transition-all duration-300 ${
                    active ? "text-primary" : "text-gray-400"
                  }`}
                >
                  {t(tab.labelKey)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
