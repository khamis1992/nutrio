import type { ReactNode } from "react";
import { Award, Gift, Trophy, WalletCards, Zap } from "lucide-react";

import achievementCardArt from "@/assets/rewards/nutrio-achievements-progress-card.webp";
import { useLanguage } from "@/contexts/LanguageContext";
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
  const { language } = useLanguage();
  const labels = language === "ar" ? {
    card: "تقدم إنجازات نوتريو",
    level: "المستوى الحالي",
    currentXp: "نقاط الخبرة الحالية",
    lifetimeXp: "إجمالي نقاط الخبرة",
    wallet: "رصيد المحفظة",
    unlocked: "الإنجازات المفتوحة",
    redeemed: "المكافآت المستبدلة",
    progress: "تقدم المستوى",
  } : {
    card: "Nutrio achievements progress",
    level: "Current level",
    currentXp: "Current XP",
    lifetimeXp: "Lifetime XP",
    wallet: "Wallet balance",
    unlocked: "Unlocked achievements",
    redeemed: "Redeemed rewards",
    progress: "Level progress",
  };
  const progress = clampPercent(levelProgressPercentage);
  const unlockedValue =
    typeof unlockedAchievements === "number" && typeof totalAchievements === "number"
      ? `${Math.max(0, unlockedAchievements)}/${Math.max(0, totalAchievements)}`
      : "-";

  if (language === "ar") {
    return (
      <section
        dir="rtl"
        aria-label={labels.card}
        className={cn("overflow-hidden rounded-[30px] bg-white p-5 shadow-[0_24px_64px_rgba(12,18,34,0.08)]", className)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-[#0CA891]">{labels.card}</p>
            <h2 className="mt-2 text-[25px] font-black leading-tight text-[#0C1222]">تقدمك وإنجازاتك</h2>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-[#6E7689]">اكسب نقاط الخبرة من العادات الصحية وحوّل الاستمرارية إلى مكافآت واضحة.</p>
          </div>
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[#FFF3EA] text-[#F06400]">
            <Trophy className="h-8 w-8" />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-[0.8fr_1.2fr] gap-3">
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[22px] bg-[#E9FBF7] p-4 text-center">
            <Award className="h-7 w-7 text-[#0CA891]" />
            <p className="mt-3 text-[10px] font-black text-[#6E7689]">{labels.level}</p>
            <p className="mt-1 text-[30px] font-black text-[#0C1222]">{loading ? "-" : formatNumber(currentLevel)}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#20C7A5]" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="space-y-3">
            <ArabicStat icon={<Zap className="h-5 w-5" />} label={labels.currentXp} value={loading ? "-" : formatNumber(currentXp)} tone="text-[#0CA891] bg-[#E9FBF7]" />
            <ArabicStat icon={<Award className="h-5 w-5" />} label={labels.lifetimeXp} value={loading ? "-" : formatNumber(lifetimeXp)} tone="text-[#1A86E8] bg-[#ECF6FF]" />
            <ArabicStat icon={<WalletCards className="h-5 w-5" />} label={labels.wallet} value={loading ? "-" : formatArabicCurrency(walletBalance)} tone="text-[#F06400] bg-[#FFF3EA]" />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-[#E5EAF1] rounded-[22px] bg-[#F8FAFC] p-3 ring-1 ring-[#E5EAF1]">
          <ArabicSummary icon={<Award className="h-4 w-4" />} label={labels.unlocked} value={loading ? "-" : unlockedValue} />
          <ArabicSummary icon={<Gift className="h-4 w-4" />} label={labels.redeemed} value={loading ? "-" : formatNumber(redeemedRewards)} />
          <ArabicSummary icon={<Zap className="h-4 w-4" />} label={labels.progress} value={loading ? "-" : `${Math.round(progress)}%`} />
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "relative w-full overflow-hidden rounded-[30px] bg-white shadow-[0_24px_64px_rgba(12,18,34,0.08)]",
        className,
      )}
      aria-label={labels.card}
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
          label={labels.level}
          value={formatNumber(currentLevel)}
          loading={loading}
          className="left-[16.2%] top-[54.7%] z-10 grid h-[22.5%] w-[9.8%] place-items-center text-center text-[clamp(18px,5.5vw,24px)] font-black tracking-[-0.04em] text-[#0C1222] [text-shadow:0_1px_8px_rgba(255,255,255,0.95)]"
          skeletonClassName="h-6 w-8"
        />

        <DynamicValue
          label={labels.currentXp}
          value={formatNumber(currentXp)}
          loading={loading}
          className="right-[8%] top-[43.7%] w-[25%] text-right text-[clamp(18px,5.2vw,22px)] font-black tracking-[-0.03em] text-[#0CA891]"
          skeletonClassName="ml-auto h-6 w-20"
        />

        <DynamicValue
          label={labels.lifetimeXp}
          value={formatNumber(lifetimeXp)}
          loading={loading}
          className="right-[8%] top-[56.8%] w-[25%] text-right text-[clamp(18px,5.2vw,22px)] font-black tracking-[-0.03em] text-[#1A86E8]"
          skeletonClassName="ml-auto h-6 w-20"
        />

        <DynamicValue
          label={labels.wallet}
          value={formatCurrency(walletBalance)}
          loading={loading}
          className="right-[8%] top-[69.9%] w-[31%] text-right text-[clamp(15px,4.7vw,20px)] font-black tracking-[-0.02em] text-[#F06400]"
          skeletonClassName="ml-auto h-6 w-24"
        />

        <DynamicValue
          label={labels.unlocked}
          value={unlockedValue}
          loading={loading}
          className="left-[18.6%] top-[84.35%] w-[14.4%] text-center text-[clamp(14px,4.1vw,17px)] font-black tracking-[-0.03em] text-[#0C1222]"
          skeletonClassName="mx-auto h-5 w-12"
        />

        <DynamicValue
          label={labels.redeemed}
          value={formatNumber(redeemedRewards)}
          loading={loading}
          className="left-[48.5%] top-[84.35%] w-[12.6%] text-center text-[clamp(14px,4.1vw,17px)] font-black tracking-[-0.03em] text-[#0C1222]"
          skeletonClassName="mx-auto h-5 w-8"
        />

        <DynamicValue
          label={labels.progress}
          value={`${Math.round(progress)}%`}
          loading={loading}
          className="right-[8.2%] top-[84.35%] w-[16.2%] text-center text-[clamp(14px,4.1vw,17px)] font-black tracking-[-0.03em] text-[#F06400]"
          skeletonClassName="mx-auto h-5 w-10"
        />
      </div>
    </section>
  );
}

const formatArabicCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${Math.max(0, value).toLocaleString("ar-QA", { maximumFractionDigits: 0 })} ر.ق`;
};

function ArabicStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="flex min-h-[52px] items-center gap-2.5 rounded-[18px] bg-white p-2.5 ring-1 ring-[#E5EAF1]">
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[13px]", tone)}>{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[9px] font-bold text-[#6E7689]">{label}</span>
        <span className="mt-1 block truncate text-[14px] font-black text-[#0C1222]">{value}</span>
      </span>
    </div>
  );
}

function ArabicSummary({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 px-2 text-center">
      <span className="mx-auto grid h-8 w-8 place-items-center rounded-[12px] bg-white text-[#6674F4]">{icon}</span>
      <span className="mt-2 block text-[13px] font-black text-[#0C1222]">{value}</span>
      <span className="mt-1 block text-[8px] font-bold leading-3 text-[#6E7689]">{label}</span>
    </div>
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
