import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserBadge } from "@/lib/badges";

interface BadgeCardProps {
  badge: UserBadge;
  variant?: "compact" | "full";
  className?: string;
}

export function BadgeCard({ badge, variant = "full", className }: BadgeCardProps) {
  const isCompact = variant === "compact";

  const imageSize = isCompact ? "h-14 w-14" : "h-16 w-16";
  const labelSize = isCompact ? "text-[10px]" : "text-[11px]";

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className={cn("relative", imageSize)}>
        <img
          src={badge.image}
          alt={badge.name}
          className={cn(
            "h-full w-full object-contain transition-all duration-300",
            badge.unlocked ? "scale-105" : "grayscale opacity-50",
          )}
        />

        {!badge.unlocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-5 w-5 text-slate-400 drop-shadow-sm" />
          </div>
        )}
      </div>

      <p
        className={cn(
          "mt-1.5 font-semibold leading-[1.15] text-slate-600 text-center max-w-[72px]",
          labelSize,
          !badge.unlocked && "text-slate-400",
        )}
      >
        {badge.name}
      </p>
    </div>
  );
}
