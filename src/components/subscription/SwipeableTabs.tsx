import { useState, useRef, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon: ReactNode;
}

interface SwipeableTabsProps {
  tabs: Tab[];
  children: (activeTab: string) => ReactNode;
  defaultTab?: string;
  className?: string;
}

export function SwipeableTabs({ tabs, children, defaultTab, className }: SwipeableTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const currentIndex = tabs.findIndex(t => t.id === activeTab);

  const goToTab = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, tabs.length - 1));
      setActiveTab(tabs[clamped].id);
    },
    [tabs]
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) { goToTab(currentIndex + 1); }
      else { goToTab(currentIndex - 1); }
    }
  };

  return (
    <div className={cn("flex flex-col min-h-0 flex-1", className)}>
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div className="animate-in slide-in-from-bottom-2 duration-200">
          {children(activeTab)}
        </div>
      </div>

      <nav className="sticky bottom-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full rounded-xl transition-all duration-200",
                "active:scale-95 touch-manipulation",
                activeTab === tab.id
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "w-6 h-6 flex items-center justify-center transition-transform duration-200",
                activeTab === tab.id && "scale-110"
              )}>
                {tab.icon}
              </div>
              <span className="text-[11px] font-semibold tracking-tight leading-none">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
