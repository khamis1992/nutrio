import { Lock, Zap } from "lucide-react";
import { motion } from "framer-motion";
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
  halo: string;
  ring: string;
  xpBg: string;
  xpText: string;
  dot: string;
}> = {
  common: {
    label: "Common",
    labelColor: "text-slate-600",
    bg: "from-slate-50 via-white to-slate-100",
    border: "border-slate-200",
    glow: "",
    halo: "bg-[radial-gradient(circle_at_center,rgba(100,116,139,0.18)_0%,rgba(100,116,139,0.05)_50%,transparent_75%)]",
    ring: "ring-slate-200/60",
    xpBg: "bg-slate-100",
    xpText: "text-slate-600",
    dot: "bg-slate-400",
  },
  rare: {
    label: "Rare",
    labelColor: "text-emerald-700",
    bg: "from-emerald-50 via-white to-teal-50",
    border: "border-emerald-200",
    glow: "shadow-[0_8px_24px_-6px_rgba(16,185,129,0.36)]",
    halo: "bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.26)_0%,rgba(20,184,166,0.08)_50%,transparent_75%)]",
    ring: "ring-emerald-200/70",
    xpBg: "bg-emerald-100",
    xpText: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  epic: {
    label: "Epic",
    labelColor: "text-purple-700",
    bg: "from-purple-50 via-white to-purple-100",
    border: "border-purple-200",
    glow: "shadow-[0_8px_28px_-6px_rgba(147,51,234,0.45)]",
    halo: "bg-[radial-gradient(circle_at_center,rgba(147,51,234,0.34)_0%,rgba(147,51,234,0.08)_50%,transparent_75%)]",
    ring: "ring-purple-200/60",
    xpBg: "bg-purple-100",
    xpText: "text-purple-700",
    dot: "bg-purple-500",
  },
  legendary: {
    label: "Legendary",
    labelColor: "text-amber-700",
    bg: "from-amber-50 via-white to-amber-100",
    border: "border-amber-300",
    glow: "shadow-[0_10px_32px_-6px_rgba(245,158,11,0.55)]",
    halo: "bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.4)_0%,rgba(245,158,11,0.12)_50%,transparent_75%)]",
    ring: "ring-amber-300/70",
    xpBg: "bg-amber-100",
    xpText: "text-amber-700",
    dot: "bg-amber-500",
  },
};

const springIn = {
  initial: { opacity: 0, y: 12, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring", stiffness: 300, damping: 24, mass: 0.6 },
};

export function BadgeCard({ badge, variant = "full", className }: BadgeCardProps) {
  const cfg = RARITY_CONFIG[badge.rarity];
  const isCompact = variant === "compact";

  // ── Size scale per variant ──
  // Compact: ~175px wide cell, ~265px tall card → hero 170px (64%), image 150px
  // Full:    wider container → hero 220px (65%), image 195px
  const heroH = isCompact ? "h-[170px]" : "h-[220px]";
  const imgBox = isCompact ? "h-[150px] w-[150px]" : "h-[195px] w-[195px]";
  const lockIc = isCompact ? "h-8 w-8" : "h-10 w-10";
  const title = isCompact ? "text-[13px]" : "text-[16px]";
  const desc = isCompact ? "text-[11px]" : "text-[13px]";
  const xpPill = isCompact ? "text-[11px] px-2.5 py-1" : "text-[12px] px-3 py-1.5";
  const iconSz = isCompact ? "h-3 w-3" : "h-3.5 w-3.5";

  if (isCompact) {
    return (
      <motion.div
        {...springIn}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "relative min-h-[132px] overflow-hidden rounded-[18px] border bg-white p-3 shadow-[0_10px_22px_rgba(15,23,42,0.05)]",
          badge.unlocked ? cfg.border : "border-slate-200",
          className,
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1", badge.unlocked ? cfg.dot : "bg-slate-200")} />
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl",
              badge.unlocked ? cfg.halo : "bg-slate-50",
            )}
          >
            <img
              src={badge.image}
              alt={badge.name}
              className={cn(
                "h-[50px] w-[50px] object-contain drop-shadow-[0_5px_10px_rgba(15,23,42,0.18)]",
                !badge.unlocked && "grayscale opacity-50",
              )}
              loading="lazy"
            />
            {!badge.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/55 backdrop-blur-[2px]">
                <Lock className="h-5 w-5 text-slate-500" strokeWidth={2.5} />
              </div>
            )}
          </div>

          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]",
              badge.unlocked ? `${cfg.xpBg} ${cfg.labelColor}` : "bg-slate-100 text-slate-400",
            )}
          >
            {cfg.label}
          </span>
        </div>

        <p
          className={cn(
            "mt-2 line-clamp-1 text-[12px] font-black leading-tight",
            badge.unlocked ? "text-slate-900" : "text-slate-400",
          )}
        >
          {badge.name}
        </p>
        <p
          className={cn(
            "mt-1 line-clamp-2 min-h-[28px] text-[10px] font-medium leading-snug",
            badge.unlocked ? "text-slate-500" : "text-slate-400",
          )}
        >
          {badge.description}
        </p>

        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black",
            badge.unlocked ? cfg.xpBg : "bg-slate-100",
            badge.unlocked ? cfg.xpText : "text-slate-400",
          )}
        >
          <Zap className="h-2.5 w-2.5" strokeWidth={2.5} />
          {badge.xpReward} XP
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...springIn}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b ring-1",
        cfg.bg, cfg.border, cfg.ring,
        badge.unlocked ? cfg.glow : "",
        className,
      )}
    >
      {/* ── HEADER: rarity chip, pinned top-left, minimal top padding ── */}
      <div className="relative z-20 flex justify-start px-2 pt-1.5">
        <div className={cn(
          "flex items-center gap-1 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] backdrop-blur",
          badge.unlocked ? cfg.labelColor : "text-slate-400",
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", badge.unlocked ? cfg.dot : "bg-slate-300")} />
          {cfg.label}
        </div>
      </div>

      {/* ── HERO ZONE: 60-70% of card height, badge as primary focal point ── */}
      <div className={cn(
        "relative flex w-full items-center justify-center overflow-hidden -mt-0.5",
        heroH,
      )}>
        {/* Radial halo behind badge */}
        <div className={cn(
          "absolute inset-0",
          badge.unlocked ? cfg.halo : "opacity-25",
        )} />
        {/* Bottom vignette for grounding */}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/50 to-transparent" />

        <div className={cn("relative flex items-center justify-center", imgBox)}>
          <img
            src={badge.image}
            alt={badge.name}
            className={cn(
              "h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.22)]",
              !badge.unlocked && "grayscale blur-[1.5px] opacity-60",
            )}
            loading="lazy"
          />
          {!badge.unlocked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/50 backdrop-blur-[3px]">
              <Lock className={cn(lockIc, "text-slate-500")} strokeWidth={2.5} />
            </div>
          )}
        </div>
      </div>

      {/* ── INFO ZONE: tight 4px title→desc, 12px desc→xp ── */}
      <div className={cn(
        "flex flex-1 flex-col items-center px-3 text-center",
        isCompact ? "pb-3 pt-1" : "pb-4 pt-1.5",
      )}>
        {/* Title */}
        <p className={cn(
          "font-extrabold leading-tight",
          title,
          badge.unlocked ? "text-slate-800" : "text-slate-400",
        )}>
          {badge.name}
        </p>

        {/* Description — 4px gap from title */}
        <p className={cn(
          "mt-1 line-clamp-2 font-medium leading-snug",
          desc,
          badge.unlocked ? "text-slate-500" : "text-slate-400",
        )}>
          {badge.description}
        </p>

        {/* XP pill — 12px gap from description */}
        <div className={cn(
          "mt-3 flex items-center gap-1 rounded-full font-bold",
          xpPill,
          badge.unlocked ? cfg.xpBg : "bg-slate-100",
          badge.unlocked ? cfg.xpText : "text-slate-400",
        )}>
          <Zap className={iconSz} strokeWidth={2.5} />
          {badge.xpReward} XP
        </div>
      </div>
    </motion.div>
  );
}
