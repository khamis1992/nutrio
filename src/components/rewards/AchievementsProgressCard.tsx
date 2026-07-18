import achievementCardArt from "@/assets/rewards/nutrio-achievements-progress-card.png";
import { cn } from "@/lib/utils";

type AchievementsProgressCardProps = {
  currentLevel?: number | null;
  currentXp?: number | null;
  lifetimeXp?: number | null;
  walletBalance?: number | null;
  unlockedAchievements?: number | null;
  totalAchievements?: number | null;
  redeemedRewards?: number | null;
  levelProgressPercentage?: number | null;
  loading?: boolean;
  className?: string;
};

const clampPercent = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
};

const formatNumber = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return Math.max(0, value).toLocaleString();
};

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `QAR ${Math.max(0, value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export function AchievementsProgressCard({
  currentLevel,
  currentXp,
  lifetimeXp,
  walletBalance,
  unlockedAchievements,
  totalAchievements,
  redeemedRewards,
  levelProgressPercentage,
  loading = false,
  className,
}: AchievementsProgressCardProps) {
  const progress = clampPercent(levelProgressPercentage);
  const unlockedValue =
    typeof unlockedAchievements === "number" && typeof totalAchievements === "number"
      ? `${Math.max(0, unlockedAchievements)}/${Math.max(0, totalAchievements)}`
      : "-";

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden rounded-[30px] bg-white shadow-[0_24px_64px_rgba(12,18,34,0.08)]",
        className,
      )}
      aria-label="Nutrio achievements progress"
    >
      <div className="relative aspect-[1122/1402] w-full">
        <img
          src={achievementCardArt}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-cover"
          draggable={false}
        />

        <div
          className="absolute left-[16.2%] top-[54.7%] z-[1] h-[22.5%] w-[9.8%] overflow-hidden rounded-full p-[2px]"
          aria-hidden="true"
        >
          <div
            className="absolute bottom-[2px] left-[1px] right-[2px] rounded-full bg-gradient-to-t from-[#7AD7C8] via-[#20C7A5] to-[#61E8C6] shadow-[0_-8px_22px_rgba(32,199,165,0.22)] transition-[height] duration-500"
            style={{ height: `${progress}%` }}
          />
        </div>

        <DynamicValue
          label="Current level"
          value={formatNumber(currentLevel)}
          loading={loading}
          className="left-[16.2%] top-[54.7%] z-10 grid h-[22.5%] w-[9.8%] place-items-center text-center text-[clamp(18px,5.5vw,24px)] font-black tracking-[-0.04em] text-[#0C1222] [text-shadow:0_1px_8px_rgba(255,255,255,0.95)]"
          skeletonClassName="h-6 w-8"
        />

        <DynamicValue
          label="Current XP"
          value={formatNumber(currentXp)}
          loading={loading}
          className="right-[8%] top-[43.7%] w-[25%] text-right text-[clamp(18px,5.2vw,22px)] font-black tracking-[-0.03em] text-[#0CA891]"
          skeletonClassName="ml-auto h-6 w-20"
        />

        <DynamicValue
          label="Lifetime XP"
          value={formatNumber(lifetimeXp)}
          loading={loading}
          className="right-[8%] top-[56.8%] w-[25%] text-right text-[clamp(18px,5.2vw,22px)] font-black tracking-[-0.03em] text-[#1A86E8]"
          skeletonClassName="ml-auto h-6 w-20"
        />

        <DynamicValue
          label="Wallet balance"
          value={formatCurrency(walletBalance)}
          loading={loading}
          className="right-[8%] top-[69.9%] w-[31%] text-right text-[clamp(15px,4.7vw,20px)] font-black tracking-[-0.02em] text-[#F06400]"
          skeletonClassName="ml-auto h-6 w-24"
        />

        <DynamicValue
          label="Unlocked achievements"
          value={unlockedValue}
          loading={loading}
          className="left-[18.6%] top-[84.35%] w-[14.4%] text-center text-[clamp(14px,4.1vw,17px)] font-black tracking-[-0.03em] text-[#0C1222]"
          skeletonClassName="mx-auto h-5 w-12"
        />

        <DynamicValue
          label="Redeemed rewards"
          value={formatNumber(redeemedRewards)}
          loading={loading}
          className="left-[48.5%] top-[84.35%] w-[12.6%] text-center text-[clamp(14px,4.1vw,17px)] font-black tracking-[-0.03em] text-[#0C1222]"
          skeletonClassName="mx-auto h-5 w-8"
        />

        <DynamicValue
          label="Level progress"
          value={`${Math.round(progress)}%`}
          loading={loading}
          className="right-[8.2%] top-[84.35%] w-[16.2%] text-center text-[clamp(14px,4.1vw,17px)] font-black tracking-[-0.03em] text-[#F06400]"
          skeletonClassName="mx-auto h-5 w-10"
        />
      </div>
    </section>
  );
}

function DynamicValue({
  label,
  value,
  loading,
  className,
  skeletonClassName,
}: {
  label: string;
  value: string;
  loading: boolean;
  className: string;
  skeletonClassName: string;
}) {
  return (
    <div className={cn("absolute leading-none", className)} aria-label={`${label}: ${value}`}>
      <span className="sr-only">{label}</span>
      {loading ? (
        <span className={cn("block animate-pulse rounded-full bg-[#DCE6F0]", skeletonClassName)} aria-hidden="true" />
      ) : (
        <span className="block truncate">{value}</span>
      )}
    </div>
  );
}
