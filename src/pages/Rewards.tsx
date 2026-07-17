import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Gift,
  History,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  TicketPercent,
  WalletCards,
  Zap,
} from "lucide-react";

import { AchievementsProgressCard } from "@/components/rewards/AchievementsProgressCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBadges } from "@/hooks/useBadges";
import { useProfile } from "@/hooks/useProfile";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import type { BadgeRarity, UserBadge } from "@/lib/badges";
import { cn } from "@/lib/utils";

type HubTab = "earn" | "badges" | "redeem" | "activity";

type XpTransaction = {
  id: string;
  action_type: string;
  source_id: string | null;
  xp_amount: number;
  reason: string;
  created_at: string;
};

type RewardDefinition = {
  id: string;
  title: string;
  description: string | null;
  xp_required: number | null;
  level_required: number | null;
  badge_id: string | null;
  reward_type: string;
  reward_value: number;
};

type RewardTransaction = {
  id: string;
  reward_definition_id: string | null;
  badge_id: string | null;
  reward_type: string;
  reward_value: number;
  status: string;
  created_at: string;
};

type QueryResult = {
  data: unknown[] | null;
  error: Error | null;
};

type UntypedQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: unknown) => UntypedQuery;
  order: (column: string, options?: { ascending?: boolean; nullsLast?: boolean }) => UntypedQuery;
  limit: (count: number) => UntypedQuery;
};

type UntypedSupabase = {
  from: (table: string) => {
    select: (columns: string) => UntypedQuery;
  };
};

const db = supabase as unknown as UntypedSupabase;

const rarityStyle: Record<BadgeRarity, { label: string; ring: string; bg: string; text: string; glow: string }> = {
  common: {
    label: "Common",
    ring: "ring-[#E5EAF1]",
    bg: "bg-[#F6F8FC]",
    text: "text-[#6E7689]",
    glow: "shadow-[#E5EAF1]/70",
  },
  rare: {
    label: "Rare",
    ring: "ring-[#2BB9F3]/25",
    bg: "bg-[#2BB9F3]/10",
    text: "text-[#1687BD]",
    glow: "shadow-[#2BB9F3]/16",
  },
  epic: {
    label: "Epic",
    ring: "ring-[#6674F4]/25",
    bg: "bg-[#6674F4]/10",
    text: "text-[#4F46E5]",
    glow: "shadow-[#6674F4]/16",
  },
  legendary: {
    label: "Legendary",
    ring: "ring-[#FF7900]/25",
    bg: "bg-[#FF7900]/10",
    text: "text-[#E66000]",
    glow: "shadow-[#FF7900]/18",
  },
};

const formatDate = (value: string, language: "en" | "ar") =>
  new Date(value).toLocaleDateString(language === "ar" ? "ar-QA" : "en-US", {
    month: "short",
    day: "numeric",
  });

function rewardLabel(type: string, value: number, t: (key: string, params?: Record<string, string | number>) => string) {
  if (type === "wallet_credit") return t("reward_wallet_credit", { value });
  if (type === "discount") return t("reward_discount", { value });
  if (type === "free_snack") return t("reward_free_snack");
  if (type === "free_delivery") return t("reward_free_delivery");
  return t("reward_badge_only");
}

function copy() {
  return {
    title: "Rewards Hub",
    subtitle: "Achievements, badges, and wallet perks",
    market: "Earn",
    badges: "Badges",
    redeem: "Redeem",
    activity: "Activity",
    heroEyebrow: "Nutrio achievements",
    heroTitle: "Your progress shelf",
    heroBody: "Earn XP from healthy actions and turn consistency into visible rewards.",
    lifetime: "Lifetime XP",
    current: "Current XP",
    wallet: "Wallet",
    unlocked: "Unlocked",
    nextReward: "Closest reward",
    nextRewardBody: "Your nearest unlock based on real progress.",
    badgeMarket: "Badge marketplace",
    badgeMarketBody: "See requirements, rarity, and unlock status.",
    ready: "Ready",
    locked: "Locked",
    earned: "Earned",
    xpLeft: "XP left",
    levelsLeft: "levels left",
    rewardStore: "Redeemable perks",
    rewardStoreBody: "Perks unlocked by XP or badge milestones.",
    noRewards: "No rewards unlocked yet",
    noRewardsBody: "Keep logging meals and water to unlock your first perk.",
    noDefinitions: "No active rewards right now",
    noDefinitionsBody: "Active reward definitions will appear here once configured.",
    noActivity: "No XP history",
    noActivityBody: "Your first XP event will appear here.",
    viewWallet: "Open wallet",
    refresh: "Refresh",
    allBadges: "All badges",
    startEarning: "Start earning",
    waysTitle: "Ways to earn",
    waysBody: "Actions already connected to your Nutrio account.",
    logMeal: "Log a meal",
    logMealBody: "Build XP through completed meals.",
    hydrate: "Track water",
    hydrateBody: "Keep hydration progress visible.",
    visitMeals: "Open meals",
    currentPass: "Current pass",
    common: "Common",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
  };
}

export default function Rewards() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { profile } = useProfile();
  const { wallet } = useWallet();
  const { badges, loading: badgesLoading, unlockedCount, totalCount } = useBadges(user?.id);
  const labels = copy();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState<HubTab>("earn");
  const [xpTransactions, setXpTransactions] = useState<XpTransaction[]>([]);
  const [rewardDefinitions, setRewardDefinitions] = useState<RewardDefinition[]>([]);
  const [rewardTransactions, setRewardTransactions] = useState<RewardTransaction[]>([]);
  const [lifetimeXp, setLifetimeXp] = useState(0);

  const currentXp = Math.max(0, profile?.xp ?? 0);
  const currentLevel = Math.max(1, profile?.level ?? 1);
  const xpToNextLevel = Math.max(100, currentLevel * 100);
  const xpProgress = Math.min(100, Math.round((currentXp / xpToNextLevel) * 100));
  const walletBalance = Number(wallet?.balance ?? 0);

  useEffect(() => {
    document.title = `${labels.title} - Nutrio`;
  }, [labels.title]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchRewards = async () => {
      setLoading(true);
      setLoadError(false);

      try {
        const [xpLedgerResult, recentXpResult, rewardDefinitionsResult, rewardTransactionsResult] =
          await Promise.all([
            db.from("xp_transactions").select("xp_amount").eq("user_id", user.id),
            db
              .from("xp_transactions")
              .select("id, action_type, source_id, xp_amount, reason, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(25),
            db
              .from("reward_definitions")
              .select("id, title, description, xp_required, level_required, badge_id, reward_type, reward_value")
              .eq("is_active", true)
              .order("xp_required", { ascending: true, nullsLast: true }),
            db
              .from("reward_transactions")
              .select("id, reward_definition_id, badge_id, reward_type, reward_value, status, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(25),
          ]);

        if (xpLedgerResult.error) throw xpLedgerResult.error;
        if (recentXpResult.error) throw recentXpResult.error;
        if (rewardDefinitionsResult.error) throw rewardDefinitionsResult.error;
        if (rewardTransactionsResult.error) throw rewardTransactionsResult.error;
        if (cancelled) return;

        const ledger = (xpLedgerResult.data ?? []) as Array<{ xp_amount: number }>;
        setLifetimeXp(ledger.reduce((sum, item) => sum + Math.max(0, item.xp_amount || 0), 0));
        setXpTransactions((recentXpResult.data ?? []) as XpTransaction[]);
        setRewardDefinitions((rewardDefinitionsResult.data ?? []) as RewardDefinition[]);
        setRewardTransactions((rewardTransactionsResult.data ?? []) as RewardTransaction[]);
      } catch (error) {
        console.error("Rewards fetch error:", error);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchRewards();

    return () => {
      cancelled = true;
    };
  }, [refreshToken, user?.id]);

  const grantedRewardIds = useMemo(
    () => new Set(rewardTransactions.map((reward) => reward.reward_definition_id).filter(Boolean)),
    [rewardTransactions],
  );

  const sortedRewards = useMemo(
    () =>
      rewardDefinitions
        .map((reward) => ({
          reward,
          progress: getRewardProgress(reward, lifetimeXp, currentLevel),
          requirement: getRewardRequirement(reward, lifetimeXp, currentLevel, labels),
          unlocked: grantedRewardIds.has(reward.id),
        }))
        .sort((a, b) => Number(a.unlocked) - Number(b.unlocked) || b.progress - a.progress),
    [currentLevel, grantedRewardIds, labels, lifetimeXp, rewardDefinitions],
  );

  const nextReward = sortedRewards.find((item) => !item.unlocked) ?? sortedRewards[0];
  const featuredBadges = useMemo(
    () => [...badges].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.xpReward - a.xpReward),
    [badges],
  );

  const isBusy = loading || badgesLoading;

  return (
    <div className="min-h-[100dvh] bg-[#F6F8FC] pb-[calc(28px+env(safe-area-inset-bottom,0px))] pt-safe text-[#0C1222]">
      <header className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-[#F6F8FC]/92 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[68px] max-w-[430px] items-center gap-3 px-4">
          <button
            type="button"
            data-testid="rewards-back-btn"
            onClick={() => navigate(-1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#0C1222] ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-black tracking-[-0.03em] text-[#0C1222]">{labels.title}</h1>
            <p className="truncate text-[11px] font-bold text-[#6E7689]">{labels.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#20C7A5] ring-1 ring-[#E5EAF1] transition active:scale-95"
            aria-label={labels.refresh}
          >
            <RefreshCw className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] px-3.5 py-4">
        <AchievementsProgressCard
          currentLevel={currentLevel}
          currentXp={currentXp}
          lifetimeXp={lifetimeXp}
          walletBalance={walletBalance}
          unlockedAchievements={unlockedCount}
          totalAchievements={totalCount}
          redeemedRewards={rewardTransactions.length}
          levelProgressPercentage={xpProgress}
          loading={isBusy}
        />

        <nav
          aria-label={labels.title}
          className="sticky top-[76px] z-20 mt-4 grid h-14 grid-cols-4 rounded-[22px] border border-white bg-white/92 p-1.5 shadow-[0_10px_24px_rgba(12,18,34,0.08)] backdrop-blur-xl"
          role="tablist"
        >
          {[
            { key: "earn", label: labels.market, Icon: Award, color: "#20C7A5" },
            { key: "badges", label: labels.badges, Icon: BadgeCheck, color: "#6A61F6" },
            { key: "redeem", label: labels.redeem, Icon: TicketPercent, color: "#F97316" },
            { key: "activity", label: labels.activity, Icon: History, color: "#38BDF8" },
          ].map((tab) => {
            const key = tab.key as HubTab;
            const selected = activeTab === key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center rounded-[16px] text-[10px] font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22C7A1]/40",
                  selected ? "bg-[#0C1222] text-white shadow-[0_7px_16px_rgba(12,18,34,0.18)]" : "text-[#6E7689] active:bg-[#F6F8FC]",
                )}
              >
                <tab.Icon className="h-4 w-4" style={{ color: selected ? "#FFFFFF" : tab.color }} aria-hidden="true" />
                <span className="mt-0.5 truncate px-1">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {loadError && (
          <ErrorState
            title={t("rewards_load_failed")}
            subtitle={t("rewards_load_failed_desc")}
            action={t("Try again")}
            onRetry={() => setRefreshToken((value) => value + 1)}
          />
        )}

        {!loadError && activeTab === "earn" && (
          <div className="mt-5 space-y-5">
            <SectionHeading title={labels.nextReward} subtitle={labels.nextRewardBody} />
            {isBusy ? (
              <LoadingBlock />
            ) : nextReward ? (
              <RewardFeatureCard
                reward={nextReward.reward}
                progress={nextReward.progress}
                requirement={nextReward.requirement}
                unlocked={nextReward.unlocked}
                labels={labels}
                t={t}
              />
            ) : (
              <EmptyState title={labels.noDefinitions} subtitle={labels.noDefinitionsBody} />
            )}

            <section>
              <SectionHeading title={labels.waysTitle} subtitle={labels.waysBody} />
              <div className="grid grid-cols-2 gap-3">
                <EarnActionCard
                  icon={<Award className="h-5 w-5" />}
                  title={labels.logMeal}
                  body={labels.logMealBody}
                  tone="mint"
                  onClick={() => navigate("/meals")}
                />
                <EarnActionCard
                  icon={<Zap className="h-5 w-5" />}
                  title={labels.hydrate}
                  body={labels.hydrateBody}
                  tone="sky"
                  onClick={() => navigate("/water-tracker")}
                />
              </div>
            </section>

            <SectionHeading title={labels.badgeMarket} subtitle={labels.badgeMarketBody} count={featuredBadges.length} />
            {isBusy ? (
              <LoadingRows />
            ) : featuredBadges.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {featuredBadges.slice(0, 6).map((badge) => (
                  <BadgeMarketCard key={badge.id} badge={badge} compact labels={labels} />
                ))}
              </div>
            ) : (
              <EmptyState title={labels.noDefinitions} subtitle={labels.noDefinitionsBody} />
            )}
          </div>
        )}

        {!loadError && activeTab === "badges" && (
          <section className="mt-5">
            <SectionHeading title={labels.allBadges} subtitle={labels.badgeMarketBody} count={badges.length} />
            {isBusy ? (
              <LoadingRows />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {badges.map((badge) => (
                  <BadgeMarketCard key={badge.id} badge={badge} labels={labels} />
                ))}
              </div>
            )}
          </section>
        )}

        {!loadError && activeTab === "redeem" && (
          <section className="mt-5 space-y-4">
            <SectionHeading title={labels.rewardStore} subtitle={labels.rewardStoreBody} count={rewardTransactions.length} />
            <button
              type="button"
              onClick={() => navigate("/wallet")}
              className="flex min-h-[76px] w-full items-center gap-3 rounded-[24px] border border-[#E5EAF1] bg-white p-3.5 text-start shadow-[0_12px_26px_rgba(12,18,34,0.055)] active:scale-[0.99]"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[18px] bg-[#20C7A5]/10 text-[#20C7A5]">
                <WalletCards className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-[#0C1222]">QAR {walletBalance.toFixed(2)}</p>
                <p className="mt-0.5 text-[11px] font-bold text-[#6E7689]">{labels.viewWallet}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[#20C7A5] rtl-flip" />
            </button>

            {isBusy ? (
              <LoadingRows />
            ) : rewardTransactions.length > 0 ? (
              <div className="space-y-2.5">
                {rewardTransactions.map((reward) => (
                  <RewardRow
                    key={reward.id}
                    icon={<Gift className="h-5 w-5" />}
                    title={rewardLabel(reward.reward_type, reward.reward_value, t)}
                    subtitle={formatDate(reward.created_at, language)}
                    value={t(`reward_status_${reward.status}`)}
                    tone="bg-[#20C7A5]/10 text-[#20C7A5]"
                    valueTone="bg-[#F3F4FF] text-[#6A61F6]"
                  />
                ))}
              </div>
            ) : (
              <EmptyState title={labels.noRewards} subtitle={labels.noRewardsBody} />
            )}
          </section>
        )}

        {!loadError && activeTab === "activity" && (
          <section className="mt-5">
            <SectionHeading title={t("xp_history")} subtitle={t("rewards_activity_desc")} count={xpTransactions.length} />
            {isBusy ? (
              <LoadingRows />
            ) : xpTransactions.length > 0 ? (
              <div className="space-y-2.5">
                {xpTransactions.map((transaction) => (
                  <RewardRow
                    key={transaction.id}
                    icon={<Zap className="h-5 w-5" />}
                    title={transaction.reason}
                    subtitle={`${t(`xp_action_${transaction.action_type}`)} - ${formatDate(transaction.created_at, language)}`}
                    value={`${transaction.xp_amount > 0 ? "+" : ""}${transaction.xp_amount} XP`}
                    tone={transaction.xp_amount >= 0 ? "bg-[#FF7900]/10 text-[#FF7900]" : "bg-[#FF5368]/10 text-[#FF5368]"}
                    valueTone={transaction.xp_amount >= 0 ? "bg-[#20C7A5]/10 text-[#138C76]" : "bg-[#FF5368]/10 text-[#FF5368]"}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title={labels.noActivity} subtitle={labels.noActivityBody} />
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function getRewardProgress(reward: RewardDefinition, lifetimeXp: number, currentLevel: number) {
  if (reward.xp_required) return Math.min(100, Math.round((lifetimeXp / reward.xp_required) * 100));
  if (reward.level_required) return Math.min(100, Math.round((currentLevel / reward.level_required) * 100));
  return 100;
}

function getRewardRequirement(
  reward: RewardDefinition,
  lifetimeXp: number,
  currentLevel: number,
  labels: ReturnType<typeof copy>,
) {
  if (reward.xp_required) {
    return {
      current: Math.min(lifetimeXp, reward.xp_required),
      target: reward.xp_required,
      remaining: Math.max(0, reward.xp_required - lifetimeXp),
      unit: "XP",
      remainingLabel: labels.xpLeft,
    };
  }

  const target = reward.level_required ?? currentLevel;
  return {
    current: Math.min(currentLevel, target),
    target,
    remaining: Math.max(0, target - currentLevel),
    unit: labels.levelsLeft,
    remainingLabel: labels.levelsLeft,
  };
}

function SectionHeading({ title, subtitle, count }: { title: string; subtitle: string; count?: number }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-[18px] font-black tracking-[-0.035em] text-[#0C1222]">{title}</h2>
        <p className="mt-0.5 truncate text-[12px] font-semibold text-[#6E7689]">{subtitle}</p>
      </div>
      {typeof count === "number" && (
        <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-white px-2 text-[11px] font-black text-[#20C7A5] shadow-sm ring-1 ring-[#E5EAF1]">
          {count}
        </span>
      )}
    </div>
  );
}

function RewardFeatureCard({
  reward,
  progress,
  requirement,
  unlocked,
  labels,
  t,
}: {
  reward: RewardDefinition;
  progress: number;
  requirement: ReturnType<typeof getRewardRequirement>;
  unlocked: boolean;
  labels: ReturnType<typeof copy>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white shadow-[0_16px_34px_rgba(12,18,34,0.06)]">
      <div className="relative p-4">
        <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[48px] bg-[#20C7A5]/8" aria-hidden="true" />
        <div className="relative flex items-start gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] bg-[#FF7900]/10 text-[#FF7900] shadow-[0_12px_22px_rgba(255,121,0,0.12)] ring-1 ring-[#FF7900]/18">
            {unlocked ? <ShieldCheck className="h-7 w-7 text-[#20C7A5]" /> : <Gift className="h-7 w-7" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#20C7A5]">{labels.nextReward}</p>
              <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black", unlocked ? "bg-[#20C7A5]/10 text-[#138C76]" : "bg-[#FF7900]/10 text-[#D95F00]")}>
                {unlocked ? labels.earned : `${progress}%`}
              </span>
            </div>
            <h3 className="mt-1.5 text-[18px] font-black leading-tight tracking-[-0.035em] text-[#0C1222]">{reward.title}</h3>
            <p className="mt-1 text-[12px] font-bold text-[#6E7689]">{rewardLabel(reward.reward_type, reward.reward_value, t)}</p>
          </div>
        </div>
        {reward.description && <p className="relative mt-4 text-[12px] font-semibold leading-5 text-[#6E7689]">{reward.description}</p>}
        <div className="relative mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-[#E5EAF1]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full rounded-full bg-gradient-to-r from-[#20C7A5] via-[#2BB9F3] to-[#6674F4]"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-black">
            <span className="text-[#6E7689]">
              {requirement.current.toLocaleString()} / {requirement.target.toLocaleString()} {requirement.unit}
            </span>
            <span className="text-[#20C7A5]">
              {requirement.remaining === 0 ? labels.ready : `${requirement.remaining.toLocaleString()} ${requirement.remainingLabel}`}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function EarnActionCard({
  icon,
  title,
  body,
  tone,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  tone: "mint" | "sky";
  onClick: () => void;
}) {
  const tones = {
    mint: {
      shell: "border-[#20C7A5]/20 bg-[#20C7A5]/8",
      icon: "bg-white text-[#20C7A5] ring-[#20C7A5]/18",
      action: "text-[#138C76]",
    },
    sky: {
      shell: "border-[#2BB9F3]/20 bg-[#2BB9F3]/8",
      icon: "bg-white text-[#2BB9F3] ring-[#2BB9F3]/18",
      action: "text-[#167FB0]",
    },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("min-h-[132px] rounded-[24px] border p-3.5 text-start shadow-[0_12px_24px_rgba(12,18,34,0.045)] active:scale-[0.99]", tones.shell)}
    >
      <div className={cn("grid h-11 w-11 place-items-center rounded-[16px] ring-1", tones.icon)}>
        {icon}
      </div>
      <h3 className="mt-3 text-[14px] font-black leading-tight text-[#0C1222]">{title}</h3>
      <p className="mt-1 text-[11px] font-bold leading-4 text-[#6E7689]">{body}</p>
      <span className={cn("mt-3 inline-flex items-center gap-1 text-[11px] font-black", tones.action)}>
        {title}
        <ChevronRight className="h-3.5 w-3.5 rtl-flip" />
      </span>
    </button>
  );
}

function BadgeMarketCard({ badge, labels, compact = false }: { badge: UserBadge; labels: ReturnType<typeof copy>; compact?: boolean }) {
  const style = rarityStyle[badge.rarity];
  const rarityLabel = labels[badge.rarity];

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[24px] border border-[#E5EAF1] bg-white p-3.5 shadow-[0_12px_26px_rgba(12,18,34,0.055)]",
        !badge.unlocked && "bg-white/80",
      )}
    >
      {!badge.unlocked && <div className="absolute inset-0 bg-white/38 backdrop-grayscale-[0.55]" aria-hidden="true" />}
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className={cn("grid h-[76px] w-[76px] place-items-center rounded-[24px] shadow-lg ring-1", style.bg, style.ring, style.glow)}>
            <img src={badge.image} alt="" className={cn("h-[68px] w-[68px] object-contain", !badge.unlocked && "opacity-45 grayscale")} aria-hidden="true" />
          </div>
          <span className={cn("rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em]", style.bg, style.text)}>
            {rarityLabel}
          </span>
        </div>
        <div className="mt-3 min-h-[74px]">
          <h3 className="line-clamp-2 text-[14px] font-black leading-tight tracking-[-0.025em] text-[#0C1222]">{badge.name}</h3>
          <p className={cn("mt-1 text-[11px] font-semibold leading-4 text-[#6E7689]", compact ? "line-clamp-2" : "line-clamp-3")}>{badge.description}</p>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-black", badge.unlocked ? "bg-[#20C7A5]/10 text-[#138C76]" : "bg-[#F6F8FC] text-[#6E7689]")}>
            {badge.unlocked ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            {badge.unlocked ? labels.earned : labels.locked}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#FF7900]">
            <Zap className="h-3.5 w-3.5" />
            {badge.xpReward}
          </span>
        </div>
      </div>
    </article>
  );
}

function RewardRow({
  icon,
  title,
  subtitle,
  value,
  tone,
  valueTone = "bg-[#E9FBF7] text-[#0F9F83]",
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value?: string;
  tone: string;
  valueTone?: string;
}) {
  return (
    <article className="flex min-h-[78px] items-center gap-3 rounded-[22px] border border-[#E5EAF1] bg-white px-3.5 py-3 shadow-[0_10px_22px_rgba(12,18,34,0.05)]">
      <div className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-[17px]", tone)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-black text-[#0C1222]">{title}</p>
        <p className="mt-1 truncate text-[11px] font-bold text-[#6E7689]">{subtitle}</p>
      </div>
      {value && <span className={cn("shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-black", valueTone)}>{value}</span>}
    </article>
  );
}

function ErrorState({ title, subtitle, action, onRetry }: { title: string; subtitle: string; action: string; onRetry: () => void }) {
  return (
    <section className="mt-5 rounded-[24px] border border-[#FF5368]/20 bg-white p-5 text-center shadow-[0_12px_26px_rgba(12,18,34,0.06)]">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-[18px] bg-[#FF5368]/10 text-[#FF5368]">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-[15px] font-black text-[#0C1222]">{title}</h2>
      <p className="mt-1 text-[12px] font-semibold leading-5 text-[#6E7689]">{subtitle}</p>
      <button type="button" onClick={onRetry} className="mt-4 min-h-11 w-full rounded-[16px] bg-[#20C7A5] px-4 text-[12px] font-black text-white active:scale-[0.98]">
        {action}
      </button>
    </section>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[#E5EAF1] bg-white/78 p-5 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-[18px] bg-[#20C7A5]/10 text-[#20C7A5]">
        <Star className="h-5 w-5" />
      </div>
      <p className="mt-3 text-[14px] font-black text-[#0C1222]">{title}</p>
      <p className="mt-1 text-[12px] font-bold leading-5 text-[#6E7689]">{subtitle}</p>
    </div>
  );
}

function LoadingBlock() {
  return <div className="h-[198px] animate-pulse rounded-[28px] bg-white ring-1 ring-[#E5EAF1]" />;
}

function LoadingRows() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-[78px] animate-pulse rounded-[22px] bg-white ring-1 ring-[#E5EAF1]" />
      ))}
    </div>
  );
}
