import type { LucideIcon } from "lucide-react";
import { Award, BadgeCheck, History, TicketPercent } from "lucide-react";

import { cn } from "@/lib/utils";

export type RewardsTabKey = "earn" | "badges" | "redeem" | "activity";

type RewardsTabLabels = Record<RewardsTabKey, string>;

type RewardsTabBarProps = {
  activeTab: RewardsTabKey;
  labels: RewardsTabLabels;
  onTabChange: (tab: RewardsTabKey) => void;
  ariaLabel: string;
  className?: string;
};

type RewardsTabItem = {
  key: RewardsTabKey;
  Icon: LucideIcon;
  accent: string;
  tint: string;
  ring: string;
};

const tabs: RewardsTabItem[] = [
  { key: "earn", Icon: Award, accent: "#0CA891", tint: "#E9FBF7", ring: "rgba(12,168,145,0.18)" },
  { key: "badges", Icon: BadgeCheck, accent: "#6A61F6", tint: "#F0EFFF", ring: "rgba(106,97,246,0.18)" },
  { key: "redeem", Icon: TicketPercent, accent: "#F06400", tint: "#FFF3EA", ring: "rgba(240,100,0,0.18)" },
  { key: "activity", Icon: History, accent: "#1A86E8", tint: "#ECF6FF", ring: "rgba(26,134,232,0.18)" },
];

export function RewardsTabBar({ activeTab, labels, onTabChange, ariaLabel, className }: RewardsTabBarProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "sticky top-[76px] z-20 mt-4 grid h-[72px] grid-cols-4 gap-1 rounded-[20px] border border-[#E1E8EF] bg-white p-2 shadow-[0_12px_30px_rgba(24,48,72,0.08)]",
        className,
      )}
      role="tablist"
    >
      {tabs.map(({ key, Icon, accent, tint, ring }) => {
        const selected = activeTab === key;

        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            data-state={selected ? "active" : "inactive"}
            onClick={() => onTabChange(key)}
            className={cn(
              "group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[13px] px-1 transition-[background-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#20C7A5]/35 active:scale-[0.97]",
              selected ? "bg-[#F8FBFC]" : "hover:bg-[#F8FAFC]",
            )}
            style={{ color: selected ? accent : "#718096" }}
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200 group-active:scale-95"
              style={
                selected
                  ? {
                      backgroundColor: accent,
                      color: "#FFFFFF",
                      boxShadow: `0 7px 16px ${ring}`,
                    }
                  : {
                      backgroundColor: tint,
                      color: accent,
                    }
              }
            >
              <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
            </span>

            <span className={cn("truncate text-[10px] leading-none", selected ? "font-extrabold" : "font-bold")}>
              {labels[key]}
            </span>

            <span
              aria-hidden="true"
              className={cn(
                "absolute bottom-0 h-[3px] rounded-full transition-[width,opacity] duration-200",
                selected ? "w-5 opacity-100" : "w-0 opacity-0",
              )}
              style={{ backgroundColor: accent }}
            />
          </button>
        );
      })}
    </nav>
  );
}
