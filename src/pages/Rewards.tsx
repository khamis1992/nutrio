import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Gift,
  History,
  Sparkles,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { recordSportHubClick } from "@/lib/partnerTracking";

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

const rewardBadgeModules = import.meta.glob<string>("../assets/Badge/*.png", {
  eager: true,
  import: "default",
  query: "?url",
});

const rewardBadgeImages = Object.entries(rewardBadgeModules)
  .sort(([first], [second]) => {
    const firstNumber = Number(first.match(/Badge (\d+)/)?.[1] ?? 0);
    const secondNumber = Number(second.match(/Badge (\d+)/)?.[1] ?? 0);
    return firstNumber - secondNumber;
  })
  .map(([, source]) => source);

const rewardLabel = (type: string, value: number, t: (key: string, params?: Record<string, string | number>) => string) => {
  if (type === "wallet_credit") return t("reward_wallet_credit", { value });
  if (type === "discount") return t("reward_discount", { value });
  if (type === "free_snack") return t("reward_free_snack");
  if (type === "free_delivery") return t("reward_free_delivery");
  return t("reward_badge_only");
};

const formatDate = (value: string, language: "en" | "ar") =>
  new Date(value).toLocaleDateString(language === "ar" ? "ar-QA" : "en-US", {
    month: "short",
    day: "numeric",
  });

const Rewards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [activeTab, setActiveTab] = useState<"earn" | "unlocked" | "activity">("earn");
  const [xpTransactions, setXpTransactions] = useState<XpTransaction[]>([]);
  const [rewardDefinitions, setRewardDefinitions] = useState<RewardDefinition[]>([]);
  const [rewardTransactions, setRewardTransactions] = useState<RewardTransaction[]>([]);
  const [lifetimeXp, setLifetimeXp] = useState(0);

  const currentXp = Math.max(0, profile?.xp ?? 0);
  const currentLevel = Math.max(1, profile?.level ?? 1);
  const xpToNextLevel = Math.max(100, currentLevel * 100);
  const xpProgress = Math.min(100, Math.round((currentXp / xpToNextLevel) * 100));

  useEffect(() => {
    document.title = `${t("rewards")} - Nutrio`;
  }, [t]);

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
        const [
          xpLedgerResult,
          recentXpResult,
          rewardDefinitionsResult,
          rewardTransactionsResult,
        ] = await Promise.all([
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

    fetchRewards();

    return () => {
      cancelled = true;
    };
  }, [refreshToken, user?.id]);

  const grantedRewardIds = useMemo(
    () => new Set(rewardTransactions.map((reward) => reward.reward_definition_id).filter(Boolean)),
    [rewardTransactions],
  );

  const upcomingRewards = useMemo(
    () =>
      rewardDefinitions
        .filter((reward) => !grantedRewardIds.has(reward.id))
        .slice(0, 4),
    [grantedRewardIds, rewardDefinitions],
  );

  const getRewardProgress = (reward: RewardDefinition) => {
    if (reward.xp_required) return Math.min(100, Math.round((lifetimeXp / reward.xp_required) * 100));
    if (reward.level_required) return Math.min(100, Math.round((currentLevel / reward.level_required) * 100));
    return 0;
  };

  const getRewardRequirement = (reward: RewardDefinition) => {
    if (reward.xp_required) {
      return {
        current: Math.min(lifetimeXp, reward.xp_required),
        target: reward.xp_required,
        remaining: Math.max(0, reward.xp_required - lifetimeXp),
        unit: "XP",
      };
    }

    const target = reward.level_required ?? currentLevel;
    return {
      current: Math.min(currentLevel, target),
      target,
      remaining: Math.max(0, target - currentLevel),
      unit: t("rewards_levels_unit"),
    };
  };

  const currentBadgeImage = rewardBadgeImages[(currentLevel - 1) % Math.max(1, rewardBadgeImages.length)];

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#020617]">
      <header className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-[#F6F8FB]/90 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[430px] items-center gap-3 px-4">
          <button
            type="button"
            data-testid="rewards-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-sm ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("rewards")}</p>
            <h1 className="truncate text-[18px] font-black">{t("xp_wallet")}</h1>
          </div>
          <button
            type="button"
            data-testid="rewards-wallet-btn"
            onClick={() => navigate("/wallet")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#020617] text-white active:scale-95"
            aria-label={t("wallet")}
          >
            <WalletCards className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] px-4 pb-[calc(28px+env(safe-area-inset-bottom,0px))] pt-4">
        <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white text-[#020617] shadow-[0_16px_36px_rgba(15,23,42,0.07)]">
          <div className="flex min-h-[154px] items-center gap-3 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("current_level")}</p>
              <h2 className="mt-1.5 text-[32px] font-black leading-none tracking-[-0.05em]">{t("level_format", { level: currentLevel })}</h2>
              <p className="mt-2 text-[12px] font-bold text-[#64748B]">
                {t("rewards_xp_balance", { current: currentXp, total: xpToNextLevel })}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#E5EAF1]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={xpProgress}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${xpProgress}%` }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="h-full rounded-full bg-[#22C7A1]"
                  />
                </div>
                <span className="shrink-0 text-[11px] font-black text-[#22C7A1]">{xpProgress}%</span>
              </div>
            </div>

            <div className="grid h-[122px] w-[122px] shrink-0 place-items-center">
              {currentBadgeImage ? (
                <img src={currentBadgeImage} alt="" className="h-full w-full object-contain drop-shadow-[0_12px_16px_rgba(15,23,42,0.14)]" aria-hidden="true" />
              ) : (
                <Trophy className="h-16 w-16 text-[#F7B731]" strokeWidth={1.8} />
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-[#E5EAF1] bg-[#FAFBFD] py-3">
            {[
              { label: t("rewards_current_xp"), value: currentXp.toLocaleString() },
              { label: t("lifetime_xp"), value: lifetimeXp.toLocaleString() },
              { label: t("unlocked_rewards"), value: rewardTransactions.length.toLocaleString() },
            ].map((stat, index) => (
              <div key={stat.label} className={cn("min-w-0 px-2 text-center", index > 0 && "border-s border-[#E5EAF1]")}>
                <p className="truncate text-[16px] font-black text-[#020617]">{stat.value}</p>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="sticky top-[64px] z-20 mt-4 grid h-14 grid-cols-3 rounded-[20px] border border-white/90 bg-[#EAF0F6]/95 p-1.5 shadow-[0_10px_26px_rgba(15,23,42,0.08)] backdrop-blur-xl" role="tablist" aria-label={t("rewards")}>
          {[
            { key: "earn", label: t("rewards_tab_earn"), Icon: Award, accent: "#22C7A1" },
            { key: "unlocked", label: t("rewards_tab_unlocked"), Icon: CheckCircle2, accent: "#7C83F6" },
            { key: "activity", label: t("rewards_tab_activity"), Icon: History, accent: "#F97316" },
          ].map((tab) => {
            const tabKey = tab.key as "earn" | "unlocked" | "activity";
            const selected = activeTab === tabKey;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tabKey)}
                className={cn(
                  "relative flex min-w-0 items-center justify-center gap-1.5 rounded-[15px] px-1.5 text-[11px] font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C83F6]/40",
                  selected ? "bg-white text-[#020617] shadow-[0_5px_14px_rgba(15,23,42,0.10)] ring-1 ring-[#E5EAF1]" : "text-[#64748B] active:bg-white/70",
                )}
              >
                <tab.Icon className="h-4 w-4 shrink-0" strokeWidth={selected ? 2.6 : 2.2} style={{ color: selected ? tab.accent : "#94A3B8" }} aria-hidden="true" />
                <span className="truncate">{tab.label}</span>
                {selected && <span className="absolute bottom-1 h-0.5 w-5 rounded-full" style={{ backgroundColor: tab.accent }} aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {loadError && (
          <ErrorState
            title={t("rewards_load_failed")}
            subtitle={t("rewards_load_failed_desc")}
            action={t("Try again")}
            onRetry={() => setRefreshToken((value) => value + 1)}
          />
        )}

        {activeTab === "earn" && !loadError && (
          <section className="mt-5">
            <SectionHeading title={t("next_reward")} subtitle={t("rewards_next_reward_desc")} />
            {loading ? (
              <div className="h-[176px] animate-pulse rounded-[24px] bg-white ring-1 ring-[#E5EAF1]" />
            ) : upcomingRewards[0] ? (() => {
              const reward = upcomingRewards[0];
              const progress = getRewardProgress(reward);
              const requirement = getRewardRequirement(reward);
              return (
                <article className="rounded-[24px] border border-[#DDDFFF] bg-white p-4 shadow-[0_14px_30px_rgba(124,131,246,0.10)]">
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#F3F4FF] text-[#7C83F6]">
                      <Gift className="h-6 w-6" strokeWidth={2.3} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#7C83F6]">{t("rewards_closest_reward")}</p>
                        <span className="shrink-0 text-[12px] font-black text-[#7C83F6]">{progress}%</span>
                      </div>
                      <h2 className="mt-1 text-[16px] font-black leading-tight text-[#020617]">{reward.title}</h2>
                      <p className="mt-1 text-[12px] font-bold text-[#64748B]">{rewardLabel(reward.reward_type, reward.reward_value, t)}</p>
                    </div>
                  </div>
                  {reward.description && <p className="mt-3 line-clamp-2 text-[11px] font-semibold leading-5 text-[#64748B]">{reward.description}</p>}
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9EAFB]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full rounded-full bg-[#7C83F6]" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-bold">
                    <span className="text-[#64748B]">{requirement.current.toLocaleString()} / {requirement.target.toLocaleString()} {requirement.unit}</span>
                    <span className="text-[#7C83F6]">
                      {requirement.remaining === 0
                        ? t("rewards_ready")
                        : reward.xp_required
                          ? t("rewards_xp_remaining", { count: requirement.remaining })
                          : t("rewards_levels_remaining", { count: requirement.remaining })}
                    </span>
                  </div>
                </article>
              );
            })() : (
              <EmptyState title={t("all_caught_up")} subtitle={t("all_rewards_unlocked")} />
            )}
          </section>
        )}

        {activeTab === "earn" && !loadError && (
          <button
            type="button"
            onClick={() => {
              trackEvent("sporthub_cta_clicked", {
                partner: "sporthub",
                campaign: "rewards_shared_challenge",
                referral_code: "NUTRIO15",
              });
              recordSportHubClick({
                userId: user?.id,
                campaign: "rewards_shared_challenge",
                eventType: "sporthub_cta_clicked",
              });
              navigate("/partners/sporthub");
            }}
            className="mt-4 flex min-h-[92px] w-full items-center gap-3 rounded-[22px] border border-[#CDEFE7] bg-white p-3 text-start shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition active:scale-[0.99]"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[#EFFFFA] text-[#22C7A1]">
              <Dumbbell className="h-7 w-7" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">{t("rewards_partner_eyebrow")}</p>
              <h2 className="mt-0.5 text-[15px] font-black text-[#020617]">{t("rewards_partner_title")}</h2>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-[#64748B]">{t("rewards_partner_desc")}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-[#22C7A1] rtl-flip" strokeWidth={2.6} />
          </button>
        )}

        {activeTab === "unlocked" && !loadError && (
        <section className="mt-5">
          <SectionHeading title={t("unlocked_rewards")} subtitle={t("rewards_unlocked_desc")} count={rewardTransactions.length} />
          <div className="space-y-2">
            {loading ? (
              <LoadingRows />
            ) : rewardTransactions.length > 0 ? (
              rewardTransactions.map((reward) => (
                <RewardRow
                  key={reward.id}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title={rewardLabel(reward.reward_type, reward.reward_value, t)}
                  subtitle={formatDate(reward.created_at, language)}
                  value={t(`reward_status_${reward.status}`)}
                  tone="bg-[#EFFFFA] text-[#22C7A1]"
                />
              ))
            ) : (
              <EmptyState title={t("no_rewards_yet")} subtitle={t("keep_logging_unlock_rewards")} />
            )}
          </div>
        </section>
        )}

        {activeTab === "earn" && !loadError && upcomingRewards.length > 1 && (
        <section className="mt-5">
          <SectionHeading title={t("rewards_more_to_unlock")} subtitle={t("rewards_more_to_unlock_desc")} />
          <div className="space-y-2">
            {loading ? (
              <LoadingRows />
            ) : (
              upcomingRewards.slice(1).map((reward) => {
                const progress = getRewardProgress(reward);
                const requirement = getRewardRequirement(reward);
                return (
                  <article key={reward.id} className="rounded-[20px] border border-[#E5EAF1] bg-white p-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.045)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#F3F4FF] text-[#7C83F6]">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-[#020617]">{reward.title}</p>
                        <p className="mt-0.5 truncate text-[12px] font-bold text-[#94A3B8]">
                          {rewardLabel(reward.reward_type, reward.reward_value, t)}
                        </p>
                      </div>
                      <div className="text-end">
                        <span className="block text-[12px] font-black text-[#7C83F6]">{progress}%</span>
                        <span className="mt-0.5 block text-[9px] font-bold text-[#94A3B8]">{requirement.remaining.toLocaleString()} {requirement.unit}</span>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E5EAF1]">
                      <div className="h-full rounded-full bg-[#7C83F6]" style={{ width: `${progress}%` }} />
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
        )}

        {activeTab === "activity" && !loadError && (
        <section className="mt-5">
          <SectionHeading title={t("xp_history")} subtitle={t("rewards_activity_desc")} count={xpTransactions.length} />
          <div className="space-y-2">
            {loading ? (
              <LoadingRows />
            ) : xpTransactions.length > 0 ? (
              xpTransactions.map((transaction) => (
                <RewardRow
                  key={transaction.id}
                  icon={<Zap className="h-5 w-5" />}
                  title={transaction.reason}
                  subtitle={`${t(`xp_action_${transaction.action_type}`)} - ${formatDate(transaction.created_at, language)}`}
                  value={`${transaction.xp_amount > 0 ? "+" : ""}${transaction.xp_amount} XP`}
                  tone={transaction.xp_amount >= 0 ? "bg-[#FFF7ED] text-[#F97316]" : "bg-[#FFF0F2] text-[#FB6B7A]"}
                  valueTone={transaction.xp_amount >= 0 ? "bg-[#EFFFFA] text-[#0F9F7D]" : "bg-[#FFF0F2] text-[#FB6B7A]"}
                />
              ))
            ) : (
              <EmptyState title={t("no_xp_history")} subtitle={t("next_xp_transaction_hint")} />
            )}
          </div>
        </section>
        )}
      </main>
    </div>
  );
};

const SectionHeading = ({ title, subtitle, count }: { title: string; subtitle: string; count?: number }) => (
  <div className="mb-3 flex items-end justify-between gap-3 px-1">
    <div className="min-w-0">
      <h2 className="text-[16px] font-black tracking-[-0.03em] text-[#020617]">{title}</h2>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-[#64748B]">{subtitle}</p>
    </div>
    {typeof count === "number" && (
      <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-[#F3F4FF] px-2 text-[10px] font-black text-[#7C83F6]">{count}</span>
    )}
  </div>
);

const ErrorState = ({ title, subtitle, action, onRetry }: { title: string; subtitle: string; action: string; onRetry: () => void }) => (
  <section className="mt-5 rounded-[22px] border border-[#FFE4E8] bg-white p-5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
    <div className="mx-auto grid h-11 w-11 place-items-center rounded-[15px] bg-[#FFF0F2] text-[#FB6B7A]">
      <Sparkles className="h-5 w-5" />
    </div>
    <h2 className="mt-3 text-[15px] font-black text-[#020617]">{title}</h2>
    <p className="mt-1 text-[12px] font-semibold leading-5 text-[#64748B]">{subtitle}</p>
    <button type="button" onClick={onRetry} className="mt-4 min-h-11 w-full rounded-[14px] bg-[#020617] px-4 text-[12px] font-black text-white active:scale-[0.98]">
      {action}
    </button>
  </section>
);

const RewardRow = ({
  icon,
  title,
  subtitle,
  value,
  tone,
  valueTone = "bg-[#EFFFFA] text-[#0F9F7D]",
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value?: string;
  tone: string;
  valueTone?: string;
}) => (
  <article className="flex min-h-[72px] items-center gap-3 rounded-[20px] border border-[#E5EAF1] bg-white px-3.5 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.045)]">
    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px]", tone)}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-black text-[#020617]">{title}</p>
      <p className="mt-1 truncate text-[11px] font-bold text-[#94A3B8]">{subtitle}</p>
    </div>
    {value && <span className={cn("shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-black", valueTone)}>{value}</span>}
  </article>
);

const EmptyState = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="rounded-[22px] border border-dashed border-[#E5EAF1] bg-white/70 p-5 text-center">
    <Sparkles className="mx-auto h-5 w-5 text-[#7C83F6]" />
    <p className="mt-2 text-[13px] font-black text-[#020617]">{title}</p>
    <p className="mt-1 text-[12px] font-bold text-[#94A3B8]">{subtitle}</p>
  </div>
);

const LoadingRows = () => (
  <>
    {[0, 1, 2].map((item) => (
      <div key={item} className="h-[68px] animate-pulse rounded-[22px] bg-white ring-1 ring-[#E5EAF1]" />
    ))}
  </>
);

export default Rewards;
