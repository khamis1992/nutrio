import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  ChevronRight,
  CreditCard,
  Crown,
  Flame,
  Gift,
  Globe,
  Heart,
  HelpCircle,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Receipt,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  User,
  Users,
  WalletCards,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AffiliateApplicationCard } from "@/components/AffiliateApplicationCard";
import { AvatarUpload } from "@/components/AvatarUpload";
import { BadgeCard } from "@/components/BadgeCard";
import { AddFamilyMemberSheet } from "@/components/family/AddFamilyMemberSheet";
import { FamilyPlansCard } from "@/components/family/FamilyPlansCard";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { useBadges } from "@/hooks/useBadges";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useProfile } from "@/hooks/useProfile";
import { useStreak } from "@/hooks/useStreak";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const IconBadge = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
      className
    )}
  >
    {children}
  </div>
);

const MetricCard = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: string;
}) => (
  <div className="flex min-h-[82px] min-w-0 flex-col items-center justify-center rounded-2xl border border-[#E5EAF1] bg-white p-2.5 text-center shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
    <div className={cn("mb-1.5 flex h-7 w-7 items-center justify-center rounded-full", tone)}>
      {icon}
    </div>
    <p className="w-full truncate text-[9px] font-black uppercase tracking-[0.06em] text-[#94A3B8]">
      {label}
    </p>
    <p className="mt-1 w-full truncate text-[16px] font-black leading-none text-[#020617]">
      {value}
    </p>
  </div>
);

const ActionRow = ({
  icon,
  iconClassName,
  title,
  subtitle,
  value,
  onClick,
  danger = false,
  divider = true,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  subtitle?: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  divider?: boolean;
}) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div>
      <motion.div
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        whileTap={onClick ? { scale: 0.99 } : undefined}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        className="flex min-h-[66px] w-full items-center gap-3 px-4 py-3 text-start transition-colors active:bg-[#F6F8FB]"
      >
        <IconBadge className={iconClassName}>{icon}</IconBadge>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[14px] font-extrabold leading-tight",
              danger ? "text-[#FB6B7A]" : "text-[#020617]"
            )}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mt-1 truncate text-[12px] font-medium leading-tight text-[#94A3B8]">
              {subtitle}
            </p>
          )}
        </div>
        {value && (
          <span className="max-w-[96px] truncate text-[12px] font-extrabold text-[#22C7A1]">
            {value}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]/60 rtl-flip" />
      </motion.div>
      {divider && <div className="ms-[68px] h-px bg-[#E5EAF1]" />}
    </div>
  );
};

const ActionSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="mt-5">
    <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
      {title}
    </h2>
    <div className="overflow-hidden rounded-[22px] border border-[#E5EAF1] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
      {children}
    </div>
  </section>
);

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const {
    subscription,
    loading: subscriptionLoading,
    isVip,
  } = useSubscription();
  const { members, loading: familyLoading, addMember, removeMember } = useFamilyMembers();
  const { toast: uiToast } = useToast();
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { isApprovedAffiliate } = useAffiliateApplication();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAddFamilySheet, setShowAddFamilySheet] = useState(false);
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [coachConnecting, setCoachConnecting] = useState(false);
  const [currentCoach, setCurrentCoach] = useState<{
    id: string;
    full_name: string | null;
    assignmentId: string | null;
  } | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const [removeCoachOpen, setRemoveCoachOpen] = useState(false);
  const [removingCoach, setRemovingCoach] = useState(false);

  const userId = user?.id;
  const { goals } = useNutritionGoals(userId);
  const { streaks } = useStreak(userId);
  const { badges, unlockedCount, totalCount } = useBadges(userId);

  const activeGoal = goals.find((goal) => goal.is_active) || goals[0];
  const calorieTarget = activeGoal?.daily_calorie_target ?? 0;
  const currentStreak = streaks?.logging?.currentStreak ?? 0;
  const currentXp = Math.max(0, profile?.xp ?? 0);
  const currentLevel = Math.max(1, profile?.level ?? 1);
  const xpToNextLevel = Math.max(100, currentLevel * 100);
  const xpProgressPercent = Math.min(100, Math.round((currentXp / xpToNextLevel) * 100));
  const nextRewardLabel = currentXp < 500
    ? t("reward_next_qar_5")
    : currentXp < 1000
      ? t("reward_next_qar_10")
      : currentLevel < 5
        ? t("reward_next_free_snack")
        : t("more_rewards_coming");
  const displayName =
    profile?.full_name?.trim() || user?.email?.split("@")[0] || t("your_name");
  const profileAvatarUrl = avatarUrl || profile?.avatar_url || null;
  const subscriptionPlanLabel = useMemo(() => {
    if (subscriptionLoading) return "...";

    const planName = subscription?.plan || subscription?.tier;
    if (!planName) return "Free";

    const normalized = planName.replace(/[_-]+/g, " ").trim();
    if (normalized.toLowerCase() === "vip") return "VIP";

    return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
  }, [subscription?.plan, subscription?.tier, subscriptionLoading]);
  const achievementPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const visibleBadges = useMemo(
    () =>
      [...badges]
        .sort((a, b) => Number(b.unlocked) - Number(a.unlocked))
        .slice(0, totalCount),
    [badges, totalCount]
  );

  useEffect(() => {
    document.title = `${t("profile_tab")} - Nutrio`;
  }, [t]);

  useEffect(() => {
    if (!userId) {
      setCoachLoading(false);
      return;
    }

    const fetchCoach = async () => {
      const { data } = await supabase
        .from("coach_client_assignments")
        .select("id, coach_id, status")
        .eq("status", "active")
        .eq("client_id", userId)
        .maybeSingle();

      if (data?.coach_id) {
        const { data: coachProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", data.coach_id)
          .single();
        setCurrentCoach({
          id: data.coach_id,
          full_name: coachProfile?.full_name || null,
          assignmentId: data.id || null,
        });
      }

      setCoachLoading(false);
    };

    fetchCoach();
  }, [userId]);

  const formatMemberDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString(isRTL ? "ar-QA" : "en-US", {
      month: "short",
      year: "numeric",
    });

  const handleConnectCoach = async () => {
    if (!inviteCode.trim() || !userId) return;

    setCoachConnecting(true);
    try {
      const { data: assignment, error } = await supabase
        .from("coach_client_assignments")
        .select("id, coach_id, status")
        .eq("invite_code", inviteCode.trim().toUpperCase())
        .eq("status", "pending")
        .maybeSingle();

      if (error || !assignment) {
        toast.error(t("invalid_invite_code"), {
          description: t("invalid_invite_code_desc"),
        });
        return;
      }

      await supabase
        .from("coach_client_assignments")
        .update({ client_id: userId, status: "active" })
        .eq("id", assignment.id);

      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", assignment.coach_id)
        .single();

      setCurrentCoach({
        id: assignment.coach_id,
        full_name: coachProfile?.full_name || null,
        assignmentId: assignment.id,
      });
      setInviteCode("");
      setCoachDialogOpen(false);
      toast.success(t("coach_connected"), { description: t("coach_connected_desc") });
    } catch (error) {
      console.error("Coach connection failed", error);
      toast.error(t("coach_connection_failed"), {
        description: t("coach_connection_failed_desc"),
      });
    } finally {
      setCoachConnecting(false);
    }
  };

  const handleRemoveCoach = async () => {
    if (!currentCoach) return;

    setRemovingCoach(true);
    try {
      const { error } = await supabase
        .from("coach_client_assignments")
        .update({ status: "revoked" })
        .eq("id", currentCoach.assignmentId);

      if (error) throw error;

      setCurrentCoach(null);
      setRemoveCoachOpen(false);
      toast.success(t("coach_removed"), { description: t("coach_removed_desc") });
    } catch (error) {
      console.error("Coach removal failed", error);
      toast.error(t("coach_remove_failed"), { description: t("coach_remove_failed_desc") });
    } finally {
      setRemovingCoach(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    uiToast({
      title: t("contact_support"),
      description: t("contact_support_delete_account"),
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB]">
        <div className="mx-auto max-w-lg px-4 py-6">
          <Skeleton className="mb-5 h-10 w-36 rounded-full" />
          <Skeleton className="h-56 rounded-[28px]" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} className="h-16 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#020617]">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b border-[#E5EAF1] bg-[#F6F8FB]/88 pt-safe backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">
              Nutrio
            </p>
            <h1 className="truncate text-[18px] font-black text-[#020617]">{t("profile_settings")}</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.08)] ring-1 ring-[#E5EAF1] active:scale-95"
            aria-label={t("notifications_menu")}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute end-3 top-3 h-2 w-2 rounded-full bg-[#FB6B7A] ring-2 ring-white" />
          </button>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 pb-24">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative mt-4 overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-4 text-[#020617] shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
        >
          <div className="relative z-10 flex items-center gap-3">
            <div className="shrink-0 rounded-[22px] bg-white p-1 shadow-sm ring-1 ring-[#E5EAF1]">
              <AvatarUpload
                currentAvatarUrl={profileAvatarUrl}
                onAvatarUpdate={setAvatarUrl}
                size="md"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F3F4FF] px-2.5 py-1 text-[10px] font-black text-[#7C83F6]">
                <Sparkles className="h-3 w-3" />
                <span className="truncate">
                  {subscription ? subscriptionPlanLabel : t("eat_healthy_live_better")}
                </span>
              </div>
              <h2 className="truncate text-[22px] font-black leading-none tracking-[-0.03em] text-[#020617]">
                {displayName}
              </h2>
              <p className="mt-1 truncate text-[12px] font-semibold text-[#94A3B8]">
                {currentCoach
                  ? `${t("your_coach")}: ${currentCoach.full_name || t("coach_default_name")}`
                  : t("eat_healthy_live_better")}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-4 grid grid-cols-3 gap-2">
            <div className="flex min-h-[72px] min-w-0 flex-col items-center justify-center rounded-2xl bg-[#FFF7ED] p-3 text-center ring-1 ring-[#F97316]/20">
              <p className="w-full truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                {t("points_label")}
              </p>
              <p className="mt-1 flex w-full items-center justify-center gap-1 text-[17px] font-black text-[#020617]">
                <Flame className="h-4 w-4 text-[#F97316]" />
                {currentXp}
              </p>
            </div>
            <div className="flex min-h-[72px] min-w-0 flex-col items-center justify-center rounded-2xl bg-[#F3F4FF] p-3 text-center ring-1 ring-[#7C83F6]/20">
              <p className="w-full truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                {t("profile_achievements")}
              </p>
              <p className="mt-1 flex w-full items-center justify-center gap-1 text-[17px] font-black text-[#020617]">
                <Trophy className="h-4 w-4 text-[#7C83F6]" />
                {unlockedCount}
              </p>
            </div>
            <div className="flex min-h-[72px] min-w-0 flex-col items-center justify-center rounded-2xl bg-[#F6F8FB] p-3 text-center ring-1 ring-[#E5EAF1]">
              <p className="w-full truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#94A3B8]">
                {t("member_since")}
              </p>
              <p className="mt-1 w-full truncate text-[13px] font-black text-[#020617]">
                {profile?.created_at ? formatMemberDate(profile.created_at) : "-"}
              </p>
            </div>
          </div>
        </motion.section>

        <section className="mt-4 grid grid-cols-3 gap-2">
          <MetricCard
            icon={<Target className="h-3.5 w-3.5 text-[#020617]" />}
            label={t("goals")}
            value={calorieTarget > 0 ? `${calorieTarget}` : "-"}
            tone="bg-[#EFFFFA] text-[#22C7A1]"
          />
          <MetricCard
            icon={<Flame className="h-3.5 w-3.5 text-[#F97316]" />}
            label={t("streak")}
            value={`${currentStreak}`}
            tone="bg-[#FFF7ED] text-[#F97316]"
          />
            <MetricCard
              icon={<Crown className="h-3.5 w-3.5 text-[#020617]" />}
            label={t("level_label")}
            value={`${currentLevel}`}
            tone="bg-[#F3F4FF] text-[#7C83F6]"
          />
        </section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="mt-4"
        >
          <button
            type="button"
            onClick={() => navigate("/rewards")}
            className="flex w-full items-center justify-between gap-3 rounded-[22px] border border-[#E5EAF1] bg-white p-4 text-start text-[#020617] shadow-[0_10px_24px_rgba(2,6,23,0.05)] transition active:scale-[0.99]"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7C83F6]">{t("rewards")}</p>
              <p className="mt-1 text-[17px] font-black leading-tight">{t("level_format", { level: currentLevel })}</p>
              <p className="mt-1 truncate text-[11px] font-bold text-[#64748B]">{nextRewardLabel}</p>
            </div>
            <div className="w-[118px] shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-[18px] font-black">{currentXp}</span>
                <span className="text-[10px] font-bold text-[#64748B]">/ {xpToNextLevel} XP</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5EAF1]">
                <div
                  className="h-full rounded-full bg-[#22C7A1]"
                  style={{ width: `${xpProgressPercent}%` }}
                />
              </div>
            </div>
          </button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-5 overflow-hidden rounded-[22px] border border-[#E5EAF1] bg-white shadow-[0_12px_28px_rgba(2,6,23,0.06)]"
        >
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="relative flex min-h-[82px] w-full items-center gap-3 px-4 py-3 text-start active:bg-[#F6F8FB]"
          >
            <span className="absolute bottom-4 top-4 w-1 rounded-full bg-[#F97316] ltr:left-0 rtl:right-0" />
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#F97316]/15">
              <AlertTriangle className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-[#020617]">
                {t("account_security_recommended")}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-[#64748B]">
                {t("weak_password_warning")}
              </p>
            </div>
            <div className="ms-1 flex shrink-0 items-center gap-1 rounded-full bg-[#020617] px-3 py-2 text-[11px] font-black text-white shadow-[0_8px_18px_rgba(2,6,23,0.18)]">
              <span>{t("update")}</span>
              <ChevronRight className="h-3.5 w-3.5 rtl-flip" />
            </div>
          </button>
        </motion.section>

        <section className="mt-5 overflow-hidden rounded-[26px] border border-[#E5EAF1] bg-white shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
          <div className="relative overflow-hidden border-b border-[#E5EAF1] bg-white px-4 pb-5 pt-4 text-[#020617]">
            <div className="relative flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#F3F4FF] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                  <Trophy className="h-3 w-3" />
                  {t("profile_achievements")}
                </div>
                <h2 className="text-[20px] font-black leading-tight">
                  {t("achievements_unlocked_summary", { unlocked: unlockedCount, total: totalCount })}
                </h2>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-[#94A3B8]">
                  {t("achievements_celebrate_progress")}
                </p>
              </div>
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white p-1 shadow-[0_10px_22px_rgba(2,6,23,0.08)] ring-1 ring-[#E5EAF1]"
                style={{
                  background: `conic-gradient(#7C83F6 ${achievementPercent * 3.6}deg, #E5EAF1 0deg)`,
                }}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[14px] font-black text-[#020617] shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
                  {achievementPercent}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleBadges.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                className="w-full shrink-0 snap-center"
              />
            ))}
          </div>
          <div className="mx-4 mb-4 flex items-center justify-center gap-1.5">
            {visibleBadges.slice(0, 5).map((badge) => (
              <span
                key={badge.id}
                className={cn(
                  "h-1.5 rounded-full",
                  badge.unlocked ? "w-5 bg-[#7C83F6]" : "w-1.5 bg-[#E5EAF1]"
                )}
              />
            ))}
          </div>
        </section>

        <div className="mt-5">
          <AffiliateApplicationCard />
        </div>

        {isApprovedAffiliate && (
          <button
            type="button"
            onClick={() => navigate("/affiliate/tracking")}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#020617] text-[13px] font-black text-white shadow-[0_12px_26px_rgba(2,6,23,0.20)] active:scale-[0.99]"
          >
            <Sparkles className="h-4 w-4" />
            {t("affiliate_tracking")}
          </button>
        )}

        {isVip && (
          <div className="mt-5">
            <FamilyPlansCard
              members={members}
              loading={familyLoading}
              isVip={isVip}
              onAddClick={() => setShowAddFamilySheet(true)}
              onRemoveMember={removeMember}
            />
          </div>
        )}

        <ActionSection title={t("for_your_health")}>
          <ActionRow
            icon={<User className="h-5 w-5" />}
            iconClassName="bg-[#EFFFFA] text-[#22C7A1]"
            title={t("personal_info")}
            subtitle={t("personal_info_desc")}
            onClick={() => navigate("/personal-info")}
          />
          <ActionRow
            icon={<Target className="h-5 w-5" />}
            iconClassName="bg-[#EFFFFA] text-[#22C7A1]"
            title={t("goals")}
            subtitle={t("goals_subtitle")}
            value={calorieTarget > 0 ? `${calorieTarget} ${t("cal_unit")}` : "-"}
            onClick={() => navigate("/nutrition-goals")}
          />
          <ActionRow
            icon={<Activity className="h-5 w-5" />}
            iconClassName="bg-[#FFF0F2] text-[#FB6B7A]"
            title={t("health_info")}
            subtitle={t("health_info_subtitle")}
            onClick={() => navigate("/body-metrics")}
          />
          <ActionRow
            icon={<ShieldAlert className="h-5 w-5" />}
            iconClassName="bg-[#EFF9FF] text-[#38BDF8]"
            title={t("dietary_preferences")}
            subtitle={t("dietary_preferences_subtitle")}
            onClick={() => navigate("/dietary")}
          />
          <ActionRow
            icon={<Users className="h-5 w-5" />}
            iconClassName="bg-[#F3F4FF] text-[#7C83F6]"
            title={currentCoach ? t("your_coach") : t("connect_with_coach")}
            subtitle={
              coachLoading
                ? t("coach_loading")
                : currentCoach
                  ? currentCoach.full_name || t("coach_default_name")
                  : t("coach_invite_hint")
            }
            value={currentCoach ? t("coach_active") : undefined}
            onClick={() => {
              if (currentCoach) setRemoveCoachOpen(true);
              else setCoachDialogOpen(true);
            }}
          />
          <ActionRow
            icon={<Heart className="h-5 w-5" />}
            iconClassName="bg-[#FFF0F2] text-[#FB6B7A]"
            title={t("health_dashboard_menu")}
            subtitle={t("health_dashboard_desc")}
            onClick={() => navigate("/health/dashboard")}
          />
          <ActionRow
            icon={<MapPin className="h-5 w-5" />}
            iconClassName="bg-[#F6F8FB] text-[#020617]"
            title={t("addresses")}
            subtitle={t("addresses_desc")}
            onClick={() => navigate("/addresses")}
            divider={false}
          />
        </ActionSection>

        <ActionSection title={t("finance")}>
          <ActionRow
            icon={<WalletCards className="h-5 w-5" />}
            iconClassName="bg-[#FFF7ED] text-[#F97316]"
            title={t("payments")}
            subtitle={t("payments_subtitle")}
            onClick={() => navigate("/wallet")}
          />
          <ActionRow
            icon={<Gift className="h-5 w-5" />}
            iconClassName="bg-[#F3F4FF] text-[#7C83F6]"
            title={t("rewards")}
            subtitle={t("rewards_profile_subtitle")}
            onClick={() => navigate("/rewards")}
          />
          <ActionRow
            icon={<ShoppingBag className="h-5 w-5" />}
            iconClassName="bg-[#F3F4FF] text-[#7C83F6]"
            title={t("order_history_menu")}
            subtitle={t("order_history_subtitle")}
            onClick={() => navigate("/orders")}
          />
          <ActionRow
            icon={<Receipt className="h-5 w-5" />}
            iconClassName="bg-[#F3F4FF] text-[#7C83F6]"
            title={t("invoice_history_menu")}
            subtitle={t("invoice_history_subtitle")}
            onClick={() => navigate("/invoices")}
          />
          <ActionRow
            icon={<CreditCard className="h-5 w-5" />}
            iconClassName="bg-[#FFF7ED] text-[#F97316]"
            title={t("subscription_menu")}
            subtitle={t("subscription_subtitle")}
            onClick={() => navigate("/subscription")}
            divider={false}
          />
        </ActionSection>

        <ActionSection title={t("discover")}>
          <ActionRow
            icon={<Heart className="h-5 w-5" />}
            iconClassName="bg-[#FFF0F2] text-[#FB6B7A]"
            title={t("favorites_menu")}
            subtitle={t("favorites_desc")}
            onClick={() => navigate("/favorites")}
          />
          <ActionRow
            icon={<Users className="h-5 w-5" />}
            iconClassName="bg-[#F3F4FF] text-[#7C83F6]"
            title={t("community_menu")}
            subtitle={t("community_desc")}
            onClick={() => navigate("/community")}
            divider={false}
          />
        </ActionSection>

        <ActionSection title={t("support_account")}>
          <ActionRow
            icon={<Globe className="h-5 w-5" />}
            iconClassName="bg-[#F3F4FF] text-[#7C83F6]"
            title={t("language_label")}
            subtitle={language === "ar" ? t("arabic") : t("english")}
            value={language === "ar" ? "EN" : t("arabic_short")}
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          />
          <ActionRow
            icon={<HelpCircle className="h-5 w-5" />}
            iconClassName="bg-[#F6F8FB] text-[#020617]"
            title={t("help_center")}
            subtitle={t("help_center_subtitle")}
            onClick={() => navigate("/faq")}
          />
          <ActionRow
            icon={<MessageCircle className="h-5 w-5" />}
            iconClassName="bg-[#EFF9FF] text-[#38BDF8]"
            title={t("contact_us")}
            subtitle={t("contact_us_subtitle")}
            onClick={() => navigate("/support")}
          />
          <ActionRow
            icon={<Lock className="h-5 w-5" />}
            iconClassName="bg-[#F6F8FB] text-[#020617]"
            title={t("privacy_security")}
            subtitle={t("privacy_security_subtitle")}
            onClick={() => navigate("/privacy")}
          />
          <ActionRow
            icon={<Bell className="h-5 w-5" />}
            iconClassName="bg-[#EFF9FF] text-[#38BDF8]"
            title={t("notifications_menu")}
            subtitle={t("notifications_subtitle")}
            onClick={() => navigate("/notifications")}
          />
          <ActionRow
            icon={<Settings className="h-5 w-5" />}
            iconClassName="bg-[#F6F8FB] text-[#020617]"
            title={t("settings_menu")}
            subtitle={t("settings_subtitle")}
            onClick={() => navigate("/settings")}
          />
          <ActionRow
            icon={<LogOut className="h-5 w-5" />}
            iconClassName="bg-[#F6F8FB] text-[#020617]"
            title={t("logout")}
            subtitle={t("logout_subtitle")}
            onClick={handleSignOut}
            divider={false}
          />
        </ActionSection>

        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
            {t("dangerous_zone")}
          </h2>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex min-h-[66px] w-full items-center gap-3 rounded-[22px] border border-[#FB6B7A]/20 bg-white px-4 py-3 text-start shadow-[0_14px_32px_rgba(15,23,42,0.05)] active:bg-[#FFF0F2]"
              >
                <IconBadge className="bg-[#FFF0F2] text-[#FB6B7A]">
                  <Trash2 className="h-5 w-5" />
                </IconBadge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold text-[#FB6B7A]">
                    {t("delete_account")}
                  </p>
                  <p className="mt-1 truncate text-[12px] font-medium text-[#94A3B8]">
                    {t("delete_account_subtitle")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#94A3B8]/60 rtl-flip" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="mx-4 rounded-2xl">
              <AlertDialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0F2]">
                  <Trash2 className="h-6 w-6 text-[#FB6B7A]" />
                </div>
                <AlertDialogTitle className="text-center">
                  {t("delete_account_confirm_title")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-center">
                  {t("delete_account_warning")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="h-11 rounded-xl">{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="h-11 rounded-xl bg-[#FB6B7A] text-white hover:bg-[#FB6B7A]/90"
                >
                  {t("delete_account")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>

      <AddFamilyMemberSheet
        open={showAddFamilySheet}
        onClose={() => setShowAddFamilySheet(false)}
        onAdd={addMember}
      />

      <AlertDialog open={removeCoachOpen} onOpenChange={setRemoveCoachOpen}>
        <AlertDialogContent className="mx-4 max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#F3F4FF]">
              <Users className="h-6 w-6 text-[#7C83F6]" />
            </div>
            <AlertDialogTitle className="text-center text-lg">
              {t("remove_coach_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {currentCoach?.full_name
                ? t("remove_coach_confirm_named", { name: currentCoach.full_name })
                : t("remove_coach_confirm_generic")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-11 rounded-xl">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveCoach}
              disabled={removingCoach}
              className="h-11 rounded-xl bg-[#020617] text-white hover:bg-[#020617]/90"
            >
              {removingCoach && <Loader2 className="ms-1 h-4 w-4 animate-spin" />}
              {removingCoach ? t("removing_coach") : t("remove_coach_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={coachDialogOpen} onOpenChange={setCoachDialogOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-extrabold">
              {t("coach_dialog_title")}
            </DialogTitle>
          </DialogHeader>
          <p className="mb-4 text-center text-sm text-[#94A3B8]">{t("coach_dialog_desc")}</p>
          <Input
            placeholder={t("coach_invite_placeholder")}
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            className="h-12 rounded-xl border-[#E5EAF1] bg-[#F6F8FB] text-center font-mono text-lg font-bold tracking-wider focus-visible:ring-[#020617]"
            maxLength={14}
          />
          <Button
            onClick={handleConnectCoach}
            disabled={coachConnecting || !inviteCode.trim()}
            className="mt-4 h-12 w-full rounded-xl bg-[#020617] text-sm font-bold text-white shadow-lg shadow-[#020617]/20 hover:bg-[#020617]/90"
          >
            {coachConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("connect_btn")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
