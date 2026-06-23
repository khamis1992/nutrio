import { Lock, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { UserBadge, BadgeRarity } from "@/lib/badges";
import { useLanguage } from "@/contexts/LanguageContext";

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
    labelColor: "text-[#64748B]",
    bg: "from-[#F6F8FB] via-white to-[#F6F8FB]",
    border: "border-[#E5EAF1]",
    glow: "",
    halo: "bg-transparent",
    ring: "ring-[#E5EAF1]",
    xpBg: "bg-[#F6F8FB]",
    xpText: "text-[#64748B]",
    dot: "bg-[#94A3B8]",
  },
  rare: {
    label: "Rare",
    labelColor: "text-[#7C83F6]",
    bg: "from-[#F8FAFC] via-white to-[#F3F4FF]",
    border: "border-[#E5EAF1]",
    glow: "shadow-[0_14px_34px_rgba(2,6,23,0.07)]",
    halo: "bg-transparent",
    ring: "ring-[#E5EAF1]",
    xpBg: "bg-[#020617]",
    xpText: "text-white",
    dot: "bg-[#7C83F6]",
  },
  epic: {
    label: "Epic",
    labelColor: "text-[#F97316]",
    bg: "from-[#FFF7ED] via-white to-[#F6F8FB]",
    border: "border-[#E5EAF1]",
    glow: "shadow-[0_14px_34px_rgba(249,115,22,0.10)]",
    halo: "bg-transparent",
    ring: "ring-[#E5EAF1]",
    xpBg: "bg-[#FFF7ED]",
    xpText: "text-[#F97316]",
    dot: "bg-[#F97316]",
  },
  legendary: {
    label: "Legendary",
    labelColor: "text-[#020617]",
    bg: "from-[#F6F8FB] via-white to-[#FFF7ED]",
    border: "border-[#E5EAF1]",
    glow: "shadow-[0_16px_38px_rgba(2,6,23,0.10)]",
    halo: "bg-transparent",
    ring: "ring-[#E5EAF1]",
    xpBg: "bg-[#020617]",
    xpText: "text-white",
    dot: "bg-[#020617]",
  },
};

const springIn = {
  initial: { opacity: 0, y: 12, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring", stiffness: 300, damping: 24, mass: 0.6 },
};

export function BadgeCard({ badge, variant = "full", className }: BadgeCardProps) {
  const { t, isRTL } = useLanguage();
  const cfg = RARITY_CONFIG[badge.rarity];
  const isCompact = variant === "compact";
  const badgeName = t(`badge_${badge.id}`);
  const badgeDescription = t(`badge_${badge.id}_desc`);
  const rarityLabel = t(`rarity_${badge.rarity}`);
  const xpLabel = t("xp_amount_compact", { amount: badge.xpReward });

  // ── Size scale per variant ──
  // Compact: ~175px wide cell, ~265px tall card → hero 170px (64%), image 150px
  // Full:    wider container → hero 220px (65%), image 195px
  const heroH = isCompact ? "h-[170px]" : "h-[178px]";
  const imgBox = isCompact ? "h-[150px] w-[150px]" : "h-[170px] w-[250px]";
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
          "relative min-h-[132px] overflow-hidden rounded-[18px] border bg-white p-3 shadow-[0_10px_22px_rgba(2,6,23,0.05)]",
          badge.unlocked ? cfg.border : "border-[#E5EAF1]",
          className,
        )}
      >
        <div className={cn("absolute inset-x-0 top-0 h-1", badge.unlocked ? cfg.dot : "bg-[#E5EAF1]")} />
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-2xl",
              badge.unlocked ? cfg.halo : "bg-[#F6F8FB]",
            )}
          >
            <img
              src={badge.image}
              alt={badgeName}
              className={cn(
                "max-h-[50px] w-auto max-w-[54px] scale-x-[1.14] object-contain",
                !badge.unlocked && "grayscale opacity-50",
              )}
              loading="lazy"
            />
            {!badge.unlocked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/55 backdrop-blur-[2px]">
                <Lock className="h-5 w-5 text-[#64748B]" strokeWidth={2.5} />
              </div>
            )}
          </div>

          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]",
              badge.unlocked ? `${cfg.xpBg} ${cfg.labelColor}` : "bg-[#F6F8FB] text-[#94A3B8]",
            )}
          >
            {rarityLabel}
          </span>
        </div>

        <p
          className={cn(
            "mt-2 line-clamp-1 text-[12px] font-black leading-tight",
            badge.unlocked ? "text-[#020617]" : "text-[#94A3B8]",
          )}
        >
          {badgeName}
        </p>
        <p
          className={cn(
            "mt-1 line-clamp-2 min-h-[28px] text-[10px] font-medium leading-snug",
            badge.unlocked ? "text-[#64748B]" : "text-[#94A3B8]",
          )}
        >
          {badgeDescription}
        </p>

        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black",
            badge.unlocked ? cfg.xpBg : "bg-[#F6F8FB]",
            badge.unlocked ? cfg.xpText : "text-[#94A3B8]",
          )}
        >
          <Zap className="h-2.5 w-2.5" strokeWidth={2.5} />
          <span dir={isRTL ? "rtl" : "ltr"}>{xpLabel}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...springIn}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex min-h-[282px] flex-col overflow-hidden rounded-[26px] border bg-gradient-to-b ring-1",
        cfg.bg, cfg.border, cfg.ring,
        badge.unlocked ? cfg.glow : "",
        className,
      )}
    >
      {/* ── HEADER: rarity chip, pinned top-left, minimal top padding ── */}
      <div className="relative z-20 flex justify-start px-4 pt-3">
        <div className={cn(
          "flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] shadow-sm ring-1 ring-[#E5EAF1]",
          badge.unlocked ? cfg.labelColor : "text-[#94A3B8]",
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", badge.unlocked ? cfg.dot : "bg-[#CBD5E1]")} />
          {rarityLabel}
        </div>
      </div>

      {/* ── HERO ZONE: 60-70% of card height, badge as primary focal point ── */}
      <div className={cn(
        "relative flex w-full items-center justify-center overflow-hidden",
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
            alt={badgeName}
            className={cn(
              "h-full w-auto max-w-full scale-x-[1.24] object-contain",
              !badge.unlocked && "grayscale blur-[1.5px] opacity-60",
            )}
            loading="lazy"
          />
          {!badge.unlocked && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/50 backdrop-blur-[3px]">
              <Lock className={cn(lockIc, "text-[#64748B]")} strokeWidth={2.5} />
            </div>
          )}
        </div>
      </div>

      {/* ── INFO ZONE: tight 4px title→desc, 12px desc→xp ── */}
      <div className={cn(
        "flex flex-1 flex-col items-center px-3 text-center",
        isCompact ? "pb-3 pt-1" : "pb-5 pt-1",
      )}>
        {/* Title */}
        <p className={cn(
          "font-extrabold leading-tight",
          title,
          badge.unlocked ? "text-[#020617]" : "text-[#94A3B8]",
        )}>
          {badgeName}
        </p>

        {/* Description — 4px gap from title */}
        <p className={cn(
          "mt-1 line-clamp-2 font-medium leading-snug",
          desc,
          badge.unlocked ? "text-[#64748B]" : "text-[#94A3B8]",
        )}>
          {badgeDescription}
        </p>

        {/* XP pill — 12px gap from description */}
        <div className={cn(
          "mt-3 flex items-center gap-1 rounded-full font-bold",
          xpPill,
          badge.unlocked ? cfg.xpBg : "bg-[#F6F8FB]",
          badge.unlocked ? cfg.xpText : "text-[#94A3B8]",
        )}>
          <Zap className={iconSz} strokeWidth={2.5} />
          <span dir={isRTL ? "rtl" : "ltr"}>{xpLabel}</span>
        </div>
      </div>
    </motion.div>
  );
}
