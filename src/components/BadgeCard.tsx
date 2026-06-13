import { Lock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserBadge, BadgeRarity } from "@/lib/badges";

interface BadgeCardProps {
  badge: UserBadge;
  variant?: "compact" | "full";
  className?: string;
}

const RARITY_CONFIG: Record<BadgeRarity, {
  label: string;
  labelColor: string;
  bg: string;
  border: string;
  glow: string;
  xpBg: string;
  xpText: string;
  dot: string;
}> = {
  common:    { label: "Common",    labelColor: "text-slate-500",  bg: "from-slate-50 to-slate-100",   border: "border-slate-200",  glow: "",                                              xpBg: "bg-slate-100",  xpText: "text-slate-500",  dot: "bg-slate-400" },
  rare:      { label: "Rare",      labelColor: "text-blue-600",   bg: "from-blue-50 to-blue-100",     border: "border-blue-200",   glow: "shadow-[0_0_16px_rgba(59,130,246,0.25)]",       xpBg: "bg-blue-100",   xpText: "text-blue-600",   dot: "bg-blue-500" },
  epic:      { label: "Epic",      labelColor: "text-purple-600", bg: "from-purple-50 to-purple-100", border: "border-purple-200", glow: "shadow-[0_0_20px_rgba(147,51,234,0.3)]",        xpBg: "bg-purple-100", xpText: "text-purple-600", dot: "bg-purple-500" },
  legendary: { label: "Legendary", labelColor: "text-amber-600",  bg: "from-amber-50 to-amber-100",   border: "border-amber-300",  glow: "shadow-[0_0_24px_rgba(245,158,11,0.4)]",        xpBg: "bg-amber-100",  xpText: "text-amber-600",  dot: "bg-amber-500" },
};

export function BadgeCard({ badge, variant = "full", className }: BadgeCardProps) {
  const cfg = RARITY_CONFIG[badge.rarity];

  /* ── COMPACT: rich card used in Profile grid ── */
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b p-3 transition-all",
          cfg.bg, cfg.border,
          badge.unlocked ? cfg.glow : "opacity-55 grayscale",
          className,
        )}
      >
        {/* Rarity dot */}
        <div className={cn("absolute right-2 top-2 h-2 w-2 rounded-full", cfg.dot)} />

        {/* Badge image */}
        <div className="relative mx-auto mb-2 flex h-[56px] w-[56px] items-center justify-center">
          <img src={badge.image} alt={badge.name} className="h-full w-full object-contain drop-shadow-sm" />
          {!badge.unlocked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
              <Lock className="h-4 w-4 text-slate-500" strokeWidth={2.5} />
            </div>
          )}
        </div>

        {/* Name */}
        <p className={cn("text-center text-[11px] font-extrabold leading-tight", badge.unlocked ? "text-slate-800" : "text-slate-400")}>
          {badge.name}
        </p>

        {/* Description */}
        <p className={cn("mt-1 text-center text-[9.5px] font-medium leading-tight", badge.unlocked ? "text-slate-500" : "text-slate-400")}>
          {badge.description}
        </p>

        {/* XP pill */}
        <div className={cn(
          "mx-auto mt-2 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[9px] font-bold",
          badge.unlocked ? cfg.xpBg : "bg-slate-100",
          badge.unlocked ? cfg.xpText : "text-slate-400",
        )}>
          <Zap className="h-2.5 w-2.5" strokeWidth={2.5} />
          {badge.xpReward} XP
        </div>

        {/* Rarity label */}
        <p className={cn("mt-1.5 text-center text-[9px] font-bold uppercase tracking-[0.05em]", badge.unlocked ? cfg.labelColor : "text-slate-400")}>
          {cfg.label}
        </p>
      </div>
    );
  }

  /* ── FULL variant ── */
  return (
    <div
      className={cn(
        "relative flex flex-col items-center overflow-hidden rounded-2xl border bg-gradient-to-b p-4 transition-all",
        cfg.bg, cfg.border,
        badge.unlocked ? cfg.glow : "opacity-55 grayscale",
        className,
      )}
    >
      <div className={cn("absolute right-2 top-2 h-2 w-2 rounded-full", cfg.dot)} />
      <div className="relative mb-3 flex h-[72px] w-[72px] items-center justify-center">
        <img src={badge.image} alt={badge.name} className="h-full w-full object-contain drop-shadow-md" />
        {!badge.unlocked && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
            <Lock className="h-5 w-5 text-slate-500" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <p className={cn("text-[13px] font-extrabold text-center", badge.unlocked ? "text-slate-800" : "text-slate-400")}>{badge.name}</p>
      <p className={cn("mt-1 text-[11px] font-medium text-center leading-tight", badge.unlocked ? "text-slate-500" : "text-slate-400")}>{badge.description}</p>
      <div className={cn("mt-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold", badge.unlocked ? cfg.xpBg : "bg-slate-100", badge.unlocked ? cfg.xpText : "text-slate-400")}>
        <Zap className="h-3 w-3" strokeWidth={2.5} />
        {badge.xpReward} XP
      </div>
      <p className={cn("mt-1.5 text-[9px] font-bold uppercase tracking-[0.06em]", badge.unlocked ? cfg.labelColor : "text-slate-400")}>{cfg.label}</p>
    </div>
  );
}
