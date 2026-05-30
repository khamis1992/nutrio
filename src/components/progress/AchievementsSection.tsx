import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Lock, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserBadge } from "@/lib/badges";

interface AchievementsSectionProps {
  badges: UserBadge[];
  unlockedCount: number;
  totalCount: number;
  className?: string;
}

export function AchievementsSection({
  badges,
  unlockedCount,
  totalCount,
  className,
}: AchievementsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sorted = [...badges].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0));
  const featured = sorted.find((b) => b.unlocked);

  const cardWidth = 140;
  const gap = 12;

  useEffect(() => {
    if (featured && scrollRef.current) {
      scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
    }
  }, [featured]);

  return (
    <section className={cn(className)}>
      {/* ── Header ── */}
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-[0_6px_14px_rgba(139,92,246,0.3)]">
          <Trophy className="h-6 w-6 text-white" strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[16px] font-black tracking-[-0.03em] text-slate-900">Achievements</h3>
          <p className="text-[11px] font-medium text-slate-500">
            {unlockedCount > 0
              ? `${unlockedCount} of ${totalCount} unlocked — keep going!`
              : "Celebrate your progress and stay motivated"}
          </p>
        </div>
        <div className="ml-auto shrink-0 rounded-full bg-violet-50 px-3 py-1.5">
          <span className="text-[12px] font-black text-violet-600">{unlockedCount}/{totalCount}</span>
        </div>
      </div>

      {/* ── Horizontal scroll ── */}
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-1 px-1 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className="flex gap-3"
          style={{ minWidth: sorted.length * (cardWidth + gap) }}
        >
          {sorted.map((badge, idx) => {
            const isFeatured = featured?.id === badge.id && badge.unlocked;
            const isUnlocked = badge.unlocked;

            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={cn(
                  "shrink-0 snap-start rounded-3xl p-4 flex flex-col items-center text-center transition-all duration-200",
                  isFeatured
                    ? "w-[152px] bg-gradient-to-b from-violet-50 to-white ring-2 ring-violet-200 shadow-[0_4px_20px_rgba(139,92,246,0.15)]"
                    : isUnlocked
                    ? "w-[140px] bg-white border border-emerald-100 shadow-[0_4px_14px_rgba(16,185,129,0.08)]"
                    : "w-[140px] bg-white border border-slate-100 shadow-[0_2px_8px_rgba(15,23,42,0.04)] opacity-80",
                )}
              >
                {/* Badge image */}
                <div className={cn("relative mb-2", isFeatured ? "h-16 w-16" : "h-14 w-14")}>
                  {isFeatured && (
                    <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-violet-400" />
                  )}
                  <img
                    src={badge.image}
                    alt={badge.name}
                    className={cn(
                      "h-full w-full object-contain transition-all duration-300",
                      isUnlocked ? "scale-105" : "grayscale opacity-45",
                    )}
                  />
                  {!isUnlocked && (
                    <Lock className="absolute inset-0 m-auto h-5 w-5 text-slate-300" />
                  )}
                </div>

                {/* Badge name */}
                <p
                  className={cn(
                    "text-[11px] font-bold leading-tight line-clamp-2",
                    isUnlocked ? "text-slate-800" : "text-slate-400",
                  )}
                >
                  {badge.name}
                </p>

                {/* Description — only for featured */}
                {isFeatured && (
                  <p className="mt-0.5 text-[9px] text-slate-400 line-clamp-2">{badge.description}</p>
                )}

                {/* Progress bar */}
                <div className="mt-2 w-full">
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        isUnlocked
                          ? "bg-gradient-to-r from-violet-400 to-purple-500"
                          : "bg-slate-200",
                      )}
                      style={{ width: isUnlocked ? "100%" : "12%" }}
                    />
                  </div>
                  <p className={cn("mt-1 text-[9px] font-semibold", isUnlocked ? "text-violet-500" : "text-slate-400")}>
                    {isUnlocked ? "Unlocked" : "Locked"}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── View All toggle ── */}
      <button
        onClick={() => setShowAll(!showAll)}
        className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-2xl bg-violet-50 py-2.5 text-[13px] font-bold text-violet-600 hover:bg-violet-100 transition-colors"
      >
        {showAll ? (
          <>Show Less <ChevronUp className="h-4 w-4" /></>
        ) : (
          <>View All ({totalCount}) <ChevronDown className="h-4 w-4" /></>
        )}
      </button>

      {/* ── Expanded grid ── */}
      {showAll && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 grid grid-cols-4 gap-2 overflow-hidden"
        >
          {sorted.map((badge) => (
            <div
              key={badge.id}
              className={cn(
                "rounded-2xl p-2.5 flex flex-col items-center text-center border",
                badge.unlocked
                  ? "bg-white border-emerald-100"
                  : "bg-white border-slate-100 opacity-70",
              )}
            >
              <div className="relative h-10 w-10">
                <img
                  src={badge.image}
                  alt={badge.name}
                  className={cn(
                    "h-full w-full object-contain",
                    badge.unlocked ? "" : "grayscale opacity-40",
                  )}
                />
                {!badge.unlocked && (
                  <Lock className="absolute inset-0 m-auto h-4 w-4 text-slate-300" />
                )}
              </div>
              <p className="mt-1 text-[9px] font-semibold text-slate-600 line-clamp-2">{badge.name}</p>
            </div>
          ))}
        </motion.div>
      )}
    </section>
  );
}
