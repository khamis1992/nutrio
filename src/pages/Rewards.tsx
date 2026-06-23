import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  Loader2,
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRewards();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#020617]">
      <header className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-[#F6F8FB]/90 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[430px] items-center gap-3 px-4">
          <button
            type="button"
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
            onClick={() => navigate("/wallet")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#020617] text-white active:scale-95"
            aria-label={t("wallet")}
          >
            <WalletCards className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[430px] px-4 pb-6 pt-4">
        <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-5 text-[#020617] shadow-[0_16px_34px_rgba(2,6,23,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">{t("current_level")}</p>
              <h2 className="mt-2 text-[38px] font-black leading-none">{t("level_format", { level: currentLevel })}</h2>
              <p className="mt-2 text-[13px] font-bold text-[#64748B]">
                {t("xp_to_next_level", { current: currentXp, total: xpToNextLevel })}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#F3F4FF] text-[#7C83F6]">
              <Trophy className="h-7 w-7" strokeWidth={2.4} />
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="h-full rounded-full bg-[#22C7A1]"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("lifetime_xp")}</p>
              <p className="mt-1 text-[20px] font-black">{lifetimeXp}</p>
            </div>
            <div className="rounded-[18px] border border-[#E5EAF1] bg-[#F6F8FB] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{t("rewards")}</p>
              <p className="mt-1 text-[20px] font-black">{rewardTransactions.length}</p>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{t("unlocked_rewards")}</h2>
            <span className="text-[11px] font-black text-[#7C83F6]">{rewardTransactions.length}</span>
          </div>
          <div className="space-y-2">
            {loading ? (
              <LoadingRows />
            ) : rewardTransactions.length > 0 ? (
              rewardTransactions.map((reward) => (
                <RewardRow
                  key={reward.id}
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title={rewardLabel(reward.reward_type, reward.reward_value, t)}
                  subtitle={`${t(`reward_status_${reward.status}`)} - ${formatDate(reward.created_at, language)}`}
                  tone="bg-[#EFFFFA] text-[#22C7A1]"
                />
              ))
            ) : (
              <EmptyState title={t("no_rewards_yet")} subtitle={t("keep_logging_unlock_rewards")} />
            )}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{t("coming_next")}</h2>
          <div className="space-y-2">
            {loading ? (
              <LoadingRows />
            ) : upcomingRewards.length > 0 ? (
              upcomingRewards.map((reward) => {
                const progress = getRewardProgress(reward);
                return (
                  <div key={reward.id} className="rounded-[22px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.05)]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3F4FF] text-[#7C83F6]">
                        <Gift className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-black text-[#020617]">{reward.title}</p>
                        <p className="mt-0.5 truncate text-[12px] font-bold text-[#94A3B8]">
                          {rewardLabel(reward.reward_type, reward.reward_value, t)}
                        </p>
                      </div>
                      <span className="text-[12px] font-black text-[#7C83F6]">{progress}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
                      <div className="h-full rounded-full bg-[#7C83F6]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState title={t("all_caught_up")} subtitle={t("all_rewards_unlocked")} />
            )}
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">{t("xp_history")}</h2>
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
                />
              ))
            ) : (
              <EmptyState title={t("no_xp_history")} subtitle={t("next_xp_transaction_hint")} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const RewardRow = ({
  icon,
  title,
  subtitle,
  value,
  tone,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  value?: string;
  tone: string;
}) => (
  <div className="flex min-h-[68px] items-center gap-3 rounded-[22px] border border-[#E5EAF1] bg-white px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.05)]">
    <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", tone)}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[13px] font-black text-[#020617]">{title}</p>
      <p className="mt-1 truncate text-[11px] font-bold text-[#94A3B8]">{subtitle}</p>
    </div>
    {value && <span className="shrink-0 text-[12px] font-black text-[#22C7A1]">{value}</span>}
  </div>
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
