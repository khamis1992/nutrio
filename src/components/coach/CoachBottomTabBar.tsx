import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, BarChart3, MessageSquare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/coach", label: "Clients", Icon: Users },
  { path: "/coach/insights", label: "Insights", Icon: BarChart3 },
  { path: "/coach/chat", label: "Chat", Icon: MessageSquare },
  { path: "/coach/settings", label: "Settings", Icon: Settings },
];

export function CoachBottomTabBar() {
  const location = useLocation();

  const activeIndex = tabs.findIndex(
    (tab) => location.pathname === tab.path
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[1000] px-4"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 16px) + 8px)",
      }}
    >
      <div className="mx-auto max-w-[420px]">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative rounded-[28px] border border-white/50 bg-white/80 shadow-[0_-2px_20px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-[24px]"
          style={{ minHeight: "78px" }}
        >
          <div className="flex items-center justify-around px-4 py-3">
            {tabs.map((tab, i) => {
              const active = i === activeIndex;
              const IconComponent = tab.Icon;

              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className="relative flex flex-col items-center justify-center gap-1 outline-none"
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <motion.div
                      layoutId="coach-tab-pill"
                      className="absolute inset-0 rounded-[20px] bg-emerald-50/80"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <IconComponent
                    className={cn(
                      "relative z-10 h-[22px] w-[22px] transition-colors",
                      active ? "text-emerald-600" : "text-slate-400"
                    )}
                    strokeWidth={active ? 2.5 : 1.75}
                  />
                  <span
                    className={cn(
                      "relative z-10 text-[10px] font-semibold transition-colors",
                      active ? "text-emerald-600" : "text-slate-400"
                    )}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </nav>
  );
}
