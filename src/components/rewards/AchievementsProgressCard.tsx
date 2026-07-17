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
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
          draggable={false}
        />

        <div
          className="absolute left-[14.5%] top-[61.2%] h-[21.5%] w-[10.3%] overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div
            className="absolute inset-x-0 bottom-0 rounded-full bg-gradient-to-t from-[#7AD7C8] via-[#20C7A5] to-[#61E8C6] shadow-[0_-10px_28px_rgba(32,199,165,0.24)]"
            style={{ height: `${progress}%` }}
          />
        </div>

        <DynamicValue
          label="Current level"
          value={formatNumber(currentLevel)}
          loading={loading}
          className="left-[13.6%] top-[66.6%] grid h-[9.2%] w-[12.2%] place-items-center rounded-full bg-white/90 text-center text-[24px] font-black tracking-[-0.04em] text-[#0C1222] shadow-[0_8px_18px_rgba(12,18,34,0.08)] ring-1 ring-white/80 backdrop-blur"
          skeletonClassName="h-7 w-9"
        />

        <DynamicValue
          label="Current XP"
          value={formatNumber(currentXp)}
          loading={loading}
          className="right-[8.6%] top-[43.1%] w-[24%] text-right text-[22px] font-black tracking-[-0.03em] text-[#0CA891]"
          skeletonClassName="ml-auto h-6 w-20"
        />

        <DynamicValue
          label="Lifetime XP"
          value={formatNumber(lifetimeXp)}
          loading={loading}
          className="right-[8.6%] top-[56.2%] w-[24%] text-right text-[22px] font-black tracking-[-0.03em] text-[#1A86E8]"
          skeletonClassName="ml-auto h-6 w-20"
        />

        <DynamicValue
          label="Wallet balance"
          value={formatCurrency(walletBalance)}
          loading={loading}
          className="right-[7.2%] top-[69%] w-[31%] text-right text-[19px] font-black tracking-[-0.035em] text-[#F06400]"
          skeletonClassName="ml-auto h-6 w-24"
        />

        <DynamicValue
          label="Unlocked achievements"
          value={unlockedValue}
          loading={loading}
          className="left-[23.6%] top-[84.15%] w-[13%] text-center text-[18px] font-black tracking-[-0.03em] text-[#0C1222]"
          skeletonClassName="mx-auto h-5 w-12"
        />

        <DynamicValue
          label="Redeemed rewards"
          value={formatNumber(redeemedRewards)}
          loading={loading}
          className="left-[53.2%] top-[84.15%] w-[10%] text-center text-[18px] font-black tracking-[-0.03em] text-[#0C1222]"
          skeletonClassName="mx-auto h-5 w-8"
        />

        <DynamicValue
          label="Level progress"
          value={`${Math.round(progress)}%`}
          loading={loading}
          className="right-[5.8%] top-[84.15%] w-[15.5%] text-center text-[18px] font-black tracking-[-0.03em] text-[#F06400]"
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
