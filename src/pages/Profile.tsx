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
  <div className="min-h-[92px] rounded-2xl border border-white/50 bg-white/78 p-3 shadow-[0_10px_28px_rgba(15,23,42,0.07)] backdrop-blur">
    <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-xl", tone)}>
      {icon}
    </div>
    <p className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
      {label}
    </p>
    <p className="mt-1 truncate text-[17px] font-black leading-none text-slate-900">
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
        className="flex min-h-[66px] w-full items-center gap-3 px-4 py-3 text-start transition-colors active:bg-slate-50"
      >
        <IconBadge className={iconClassName}>{icon}</IconBadge>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[14px] font-extrabold leading-tight",
              danger ? "text-red-500" : "text-slate-900"
            )}
          >
            {title}
          </p>
          {subtitle && (
            <p className="mt-1 truncate text-[12px] font-medium leading-tight text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
        {value && (
          <span className="max-w-[96px] truncate text-[12px] font-extrabold text-emerald-600">
            {value}
          </span>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 rtl-flip" />
      </motion.div>
      {divider && <div className="ms-[68px] h-px bg-slate-100" />}
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
    <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
      {title}
    </h2>
    <div className="overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
      {children}
    </div>
  </section>
);

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { isVip } = useSubscription();
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
  const points = currentStreak > 0 ? currentStreak * 10 : 40;
  const displayName =
    profile?.full_name?.trim() || user?.email?.split("@")[0] || t("your_name");
  const profileAvatarUrl = avatarUrl || profile?.avatar_url || null;
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
      <div className="min-h-screen bg-[#F4F7F4]">
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
    <div className="min-h-screen bg-[#F4F7F4] text-slate-900">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 border-b border-white/70 bg-[#F4F7F4]/88 pt-safe backdrop-blur-xl"
      >
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.08)] active:scale-95"
            aria-label={t("back")}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
              Nutrio
            </p>
            <h1 className="truncate text-[18px] font-black">{t("profile_settings")}</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.08)] active:scale-95"
            aria-label={t("notifications_menu")}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute end-3 top-3 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 pb-24">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative mt-4 overflow-hidden rounded-[30px] border border-white/60 bg-white/70 p-5 text-slate-950 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
        >
          <div className="relative z-10 flex items-start gap-4">
            <div className="rounded-[24px] bg-white/80 p-1.5 shadow-sm ring-1 ring-white/60">
              <AvatarUpload
                currentAvatarUrl={profileAvatarUrl}
                onAvatarUpdate={setAvatarUrl}
                size="lg"
              />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                <Sparkles className="h-3 w-3" />
                {isVip ? t("subscription_menu") : t("eat_healthy_live_better")}
              </div>
              <h2 className="truncate text-[25px] font-black leading-tight tracking-normal text-slate-950">
                {displayName}
              </h2>
              <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-relaxed text-slate-500">
                {currentCoach
                  ? `${t("your_coach")}: ${currentCoach.full_name || t("coach_default_name")}`
                  : t("eat_healthy_live_better")}
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl bg-emerald-50/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {t("points_label")}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[18px] font-black text-slate-950">
                <Flame className="h-4 w-4 text-amber-500" />
                {points}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {t("profile_achievements")}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[18px] font-black text-slate-950">
                <Trophy className="h-4 w-4 text-lime-500" />
                {unlockedCount}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {t("member_since")}
              </p>
              <p className="mt-1 truncate text-[15px] font-black text-slate-950">
                {profile?.created_at ? formatMemberDate(profile.created_at) : "-"}
              </p>
            </div>
          </div>
        </motion.section>

        <section className="mt-4 grid grid-cols-3 gap-3">
          <MetricCard
            icon={<Target className="h-4 w-4 text-emerald-700" />}
            label={t("goals")}
            value={calorieTarget > 0 ? `${calorieTarget}` : "-"}
            tone="bg-emerald-100"
          />
          <MetricCard
            icon={<Flame className="h-4 w-4 text-orange-700" />}
            label={t("streak")}
            value={`${currentStreak}`}
            tone="bg-orange-100"
          />
          <MetricCard
            icon={<Crown className="h-4 w-4 text-violet-700" />}
            label={t("subscription_menu")}
            value={isVip ? "VIP" : "Free"}
            tone="bg-violet-100"
          />
        </section>

        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-5 overflow-hidden rounded-[24px] border border-amber-100 bg-[#FFF8E8] shadow-[0_14px_34px_rgba(146,64,14,0.08)]"
        >
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="flex w-full items-center gap-3 p-4 text-start active:bg-amber-50"
          >
            <IconBadge className="bg-white text-amber-600 shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </IconBadge>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black text-amber-950">
                {t("account_security_recommended")}
              </p>
              <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-amber-800/70">
                {t("weak_password_warning")}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-amber-500 rtl-flip" />
          </button>
        </motion.section>

        <section className="mt-5 overflow-hidden rounded-[26px] border border-white/80 bg-white/80 shadow-[0_18px_38px_rgba(15,23,42,0.06)] backdrop-blur-xl">
          <div className="relative overflow-hidden border-b border-emerald-100/70 bg-white/55 px-4 pb-5 pt-4 text-slate-950 backdrop-blur-2xl">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(236,253,245,0.88),rgba(255,255,255,0.56)_48%,rgba(240,253,250,0.86))]" />
            <div className="absolute -right-12 -top-14 h-36 w-36 rounded-full bg-emerald-300/22 blur-3xl" />
            <div className="absolute -left-12 bottom-[-70px] h-36 w-36 rounded-full bg-cyan-200/18 blur-3xl" />
            <div className="relative flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 shadow-sm ring-1 ring-white/80 backdrop-blur-md">
                  <Trophy className="h-3 w-3" />
                  {t("profile_achievements")}
                </div>
                <h2 className="text-[20px] font-black leading-tight">
                  {t("achievements_unlocked_summary", { unlocked: unlockedCount, total: totalCount })}
                </h2>
                <p className="mt-1 text-[12px] font-semibold leading-relaxed text-slate-500">
                  {t("achievements_celebrate_progress")}
                </p>
              </div>
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_22px_rgba(16,185,129,0.12)] ring-1 ring-white/80 backdrop-blur-md"
                style={{
                  background: `conic-gradient(#10b981 ${achievementPercent * 3.6}deg, rgba(15,23,42,0.08) 0deg)`,
                }}
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white/78 text-[14px] font-black text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-md">
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
                className="w-[calc(100%_-_1.5rem)] shrink-0 snap-center"
              />
            ))}
          </div>
          <div className="mx-4 mb-4 flex items-center justify-center gap-1.5">
            {visibleBadges.slice(0, 5).map((badge) => (
              <span
                key={badge.id}
                className={cn(
                  "h-1.5 rounded-full",
                  badge.unlocked ? "w-5 bg-emerald-500" : "w-1.5 bg-slate-200"
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
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[13px] font-black text-white shadow-[0_12px_26px_rgba(5,150,105,0.22)] active:scale-[0.99]"
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
            iconClassName="bg-emerald-50 text-emerald-600"
            title={t("personal_info")}
            subtitle={t("personal_info_desc")}
            onClick={() => navigate("/personal-info")}
          />
          <ActionRow
            icon={<Target className="h-5 w-5" />}
            iconClassName="bg-lime-50 text-lime-700"
            title={t("goals")}
            subtitle={t("goals_subtitle")}
            value={calorieTarget > 0 ? `${calorieTarget} ${t("cal_unit")}` : "-"}
            onClick={() => navigate("/nutrition-goals")}
          />
          <ActionRow
            icon={<Activity className="h-5 w-5" />}
            iconClassName="bg-rose-50 text-rose-600"
            title={t("health_info")}
            subtitle={t("health_info_subtitle")}
            onClick={() => navigate("/body-metrics")}
          />
          <ActionRow
            icon={<ShieldAlert className="h-5 w-5" />}
            iconClassName="bg-sky-50 text-sky-600"
            title={t("dietary_preferences")}
            subtitle={t("dietary_preferences_subtitle")}
            onClick={() => navigate("/dietary")}
          />
          <ActionRow
            icon={<Users className="h-5 w-5" />}
            iconClassName="bg-violet-50 text-violet-600"
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
            iconClassName="bg-red-50 text-red-500"
            title={t("health_dashboard_menu")}
            subtitle={t("health_dashboard_desc")}
            onClick={() => navigate("/health/dashboard")}
          />
          <ActionRow
            icon={<MapPin className="h-5 w-5" />}
            iconClassName="bg-slate-100 text-slate-600"
            title={t("addresses")}
            subtitle={t("addresses_desc")}
            onClick={() => navigate("/addresses")}
            divider={false}
          />
        </ActionSection>

        <ActionSection title={t("finance")}>
          <ActionRow
            icon={<WalletCards className="h-5 w-5" />}
            iconClassName="bg-orange-50 text-orange-600"
            title={t("payments")}
            subtitle={t("payments_subtitle")}
            onClick={() => navigate("/wallet")}
          />
          <ActionRow
            icon={<ShoppingBag className="h-5 w-5" />}
            iconClassName="bg-blue-50 text-blue-600"
            title={t("order_history_menu")}
            subtitle={t("order_history_subtitle")}
            onClick={() => navigate("/orders")}
          />
          <ActionRow
            icon={<Receipt className="h-5 w-5" />}
            iconClassName="bg-violet-50 text-violet-600"
            title={t("invoice_history_menu")}
            subtitle={t("invoice_history_subtitle")}
            onClick={() => navigate("/invoices")}
          />
          <ActionRow
            icon={<CreditCard className="h-5 w-5" />}
            iconClassName="bg-amber-50 text-amber-600"
            title={t("subscription_menu")}
            subtitle={t("subscription_subtitle")}
            onClick={() => navigate("/subscription")}
            divider={false}
          />
        </ActionSection>

        <ActionSection title={t("discover")}>
          <ActionRow
            icon={<Heart className="h-5 w-5" />}
            iconClassName="bg-red-50 text-red-500"
            title={t("favorites_menu")}
            subtitle={t("favorites_desc")}
            onClick={() => navigate("/favorites")}
          />
          <ActionRow
            icon={<Users className="h-5 w-5" />}
            iconClassName="bg-purple-50 text-purple-600"
            title={t("community_menu")}
            subtitle={t("community_desc")}
            onClick={() => navigate("/community")}
            divider={false}
          />
        </ActionSection>

        <ActionSection title={t("support_account")}>
          <ActionRow
            icon={<Globe className="h-5 w-5" />}
            iconClassName="bg-indigo-50 text-indigo-600"
            title={t("language_label")}
            subtitle={language === "ar" ? "العربية" : "English"}
            value={language === "ar" ? "EN" : "عربي"}
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          />
          <ActionRow
            icon={<HelpCircle className="h-5 w-5" />}
            iconClassName="bg-slate-100 text-slate-600"
            title={t("help_center")}
            subtitle={t("help_center_subtitle")}
            onClick={() => navigate("/faq")}
          />
          <ActionRow
            icon={<MessageCircle className="h-5 w-5" />}
            iconClassName="bg-cyan-50 text-cyan-600"
            title={t("contact_us")}
            subtitle={t("contact_us_subtitle")}
            onClick={() => navigate("/support")}
          />
          <ActionRow
            icon={<Lock className="h-5 w-5" />}
            iconClassName="bg-slate-100 text-slate-600"
            title={t("privacy_security")}
            subtitle={t("privacy_security_subtitle")}
            onClick={() => navigate("/privacy")}
          />
          <ActionRow
            icon={<Bell className="h-5 w-5" />}
            iconClassName="bg-sky-50 text-sky-600"
            title={t("notifications_menu")}
            subtitle={t("notifications_subtitle")}
            onClick={() => navigate("/notifications")}
          />
          <ActionRow
            icon={<Settings className="h-5 w-5" />}
            iconClassName="bg-slate-100 text-slate-600"
            title={t("settings_menu")}
            subtitle={t("settings_subtitle")}
            onClick={() => navigate("/settings")}
          />
          <ActionRow
            icon={<LogOut className="h-5 w-5" />}
            iconClassName="bg-slate-100 text-slate-600"
            title={t("logout")}
            subtitle={t("logout_subtitle")}
            onClick={handleSignOut}
            divider={false}
          />
        </ActionSection>

        <section className="mt-5">
          <h2 className="mb-2 px-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            {t("dangerous_zone")}
          </h2>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex min-h-[66px] w-full items-center gap-3 rounded-[22px] border border-red-100 bg-white px-4 py-3 text-start shadow-[0_14px_32px_rgba(15,23,42,0.05)] active:bg-red-50"
              >
                <IconBadge className="bg-red-50 text-red-500">
                  <Trash2 className="h-5 w-5" />
                </IconBadge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-extrabold text-red-500">
                    {t("delete_account")}
                  </p>
                  <p className="mt-1 truncate text-[12px] font-medium text-slate-500">
                    {t("delete_account_subtitle")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 rtl-flip" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="mx-4 rounded-2xl">
              <AlertDialogHeader>
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                  <Trash2 className="h-6 w-6 text-red-500" />
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
                  className="h-11 rounded-xl bg-red-500 text-white hover:bg-red-600"
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
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
              <Users className="h-6 w-6 text-violet-500" />
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
              className="h-11 rounded-xl bg-violet-600 text-white hover:bg-violet-700"
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
          <p className="mb-4 text-center text-sm text-slate-500">{t("coach_dialog_desc")}</p>
          <Input
            placeholder={t("coach_invite_placeholder")}
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            className="h-12 rounded-xl text-center font-mono text-lg font-bold tracking-wider"
            maxLength={14}
          />
          <Button
            onClick={handleConnectCoach}
            disabled={coachConnecting || !inviteCode.trim()}
            className="mt-4 h-12 w-full rounded-xl bg-violet-600 text-sm font-bold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700"
          >
            {coachConnecting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("connect_btn")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
