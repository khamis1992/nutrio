import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  User,
  ArrowLeft,
  ArrowRight,
  Loader2,
  LogOut,
  Trash2,
  Calendar,
  ShieldAlert,
  Flame,
  Target,
  Activity,
  CreditCard,
  Tag,
  MessageCircle,
  Lock,
  Globe,
  Leaf,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  HelpCircle,
  Users,
  ShoppingBag,
  Receipt,
  Bell,
  Settings,
  Clock,
  Crown,
  Heart,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/useSubscription";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { useNutritionGoals } from "@/hooks/useNutritionGoals";
import { useStreak } from "@/hooks/useStreak";
import { AffiliateApplicationCard } from "@/components/AffiliateApplicationCard";
import { FamilyPlansCard } from "@/components/family/FamilyPlansCard";
import { AddFamilyMemberSheet } from "@/components/family/AddFamilyMemberSheet";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBadges } from "@/hooks/useBadges";
import { BadgeCard } from "@/components/BadgeCard";
import { AvatarUpload } from "@/components/AvatarUpload";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/* ─── Leaf decoration SVG ─── */
const LeafDecoration = () => (
  <svg
    className="absolute end-4 top-1/2 -translate-y-1/2 w-28 h-28 text-white/10 pointer-events-none"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M85 15c-15 5-30 20-35 40-5-5-10-5-15-5 5-15 20-30 35-35 0 5-5 10-5 15 10-5 15-10 20-15z"
      fill="currentColor"
    />
    <path
      d="M70 30c-10 5-20 15-25 25-3-3-7-3-10-3 3-10 12-20 22-25 0 3-3 7-3 10 7-3 10-7 16-7z"
      fill="currentColor"
      opacity="0.5"
    />
  </svg>
);

/* ─── Menu Row ─── */
const MenuRow = ({
  icon,
  iconBg,
  iconColor = "text-white",
  label,
  subtitle,
  right,
  onClick,
  showDivider = true,
  labelColor = "text-slate-900",
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  showDivider?: boolean;
  labelColor?: string;
}) => (
  <>
    <motion.div
      role="button"
      tabIndex={onClick ? 0 : undefined}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className="w-full flex items-center gap-3.5 px-4 py-3.5 active:bg-slate-50 transition-colors text-start"
    >
      <div
        className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
          iconBg
        )}
      >
        <span className={cn("w-4 h-4", iconColor)}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[15px] font-semibold leading-tight", labelColor)}>
          {label}
        </p>
        {subtitle && (
          <p className="text-[13px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {right ?? (
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 rtl-flip" />
      )}
    </motion.div>
    {showDivider && <div className="h-px bg-slate-100 ms-16" />}
  </>
);

/* ─── Card Section ─── */
const CardSection = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100",
      className
    )}
  >
    {children}
  </div>
);

/* ─── Section Label ─── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-4 mb-2 mt-6 first:mt-0">
    {children}
  </p>
);

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { isVip } = useSubscription();
  const { members, loading: familyLoading, addMember, removeMember } = useFamilyMembers();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [showAddFamilySheet, setShowAddFamilySheet] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const { toast } = useToast();
  const { isApprovedAffiliate } = useAffiliateApplication();
  const { t, isRTL, language, setLanguage } = useLanguage();
  useEffect(() => { document.title = `${t("profile_tab")} — Nutrio`; }, [t]);
  const [coachDialogOpen, setCoachDialogOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [coachConnecting, setCoachConnecting] = useState(false);
  const [currentCoach, setCurrentCoach] = useState<{ id: string; full_name: string | null; assignmentId: string | null } | null>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const [removeCoachOpen, setRemoveCoachOpen] = useState(false);
  const [removingCoach, setRemovingCoach] = useState(false);

  const userId = user?.id;
  const { goals } = useNutritionGoals(userId);
  const { streaks } = useStreak(userId);

  const activeGoal = goals.find((g) => g.is_active) || goals[0];
  const calorieTarget = activeGoal?.daily_calorie_target ?? 0;
  const currentStreak = streaks?.logging?.currentStreak ?? 0;
  const { badges, unlockedCount, totalCount } = useBadges(userId);

  /* Points = streak-based for visual appeal */
  const points = currentStreak > 0 ? currentStreak * 10 : 40;

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
  }, [profile]);

  useEffect(() => {
    if (!userId) { setCoachLoading(false); return; }
    const fetchCoach = async () => {
      const { data } = await supabase
        .from("coach_client_assignments")
        .select("id, coach_id, status")
        .eq("status", "active")
        .eq("client_id", userId)
        .maybeSingle();

      if (data?.coach_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", data.coach_id).single();
        setCurrentCoach({ id: data.coach_id, full_name: profile?.full_name || null, assignmentId: data.id || null });
      }
      setCoachLoading(false);
    };
    fetchCoach();
  }, [userId]);

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
        toast.error(t("invalid_invite_code"), { description: t("invalid_invite_code_desc") });
        return;
      }

      await supabase
        .from("coach_client_assignments")
        .update({ client_id: userId, status: "active" })
        .eq("id", assignment.id);

      const { data: coachProfile } = await supabase.from("profiles").select("full_name").eq("user_id", assignment.coach_id).single();
      setCurrentCoach({ id: assignment.coach_id, full_name: coachProfile?.full_name || null, assignmentId: assignment.id });
      setInviteCode("");
      setCoachDialogOpen(false);
      toast.success(t("coach_connected"), { description: t("coach_connected_desc") });
    } catch (err) {
      toast.error(t("coach_connection_failed"), { description: t("coach_connection_failed_desc") });
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
    } catch (err) {
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
    toast({
      title: t("contact_support"),
      description: t("contact_support_delete_account"),
    });
  };


  const formatMemberDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(isRTL ? "ar-QA" : "en-US", {
      month: "short",
      year: "numeric",
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#F7F9FA]">
        <div className="container max-w-md mx-auto px-4 py-8 space-y-4">
          {/* Profile header skeleton */}
          <div className="bg-card rounded-2xl border p-5 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
          {/* Menu items skeleton */}
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FA]">
      {/* ─── Header ─── */}
      <motion.header
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100 pt-safe"
      >
        <div className="flex items-center gap-3 px-4 h-14 max-w-[480px] md:max-w-lg mx-auto">
            <button
              onClick={() => navigate(-1)}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"
            >
              <ArrowLeft className="w-4 h-4 text-slate-700" />
          </button>
          <h1 className="text-[17px] font-bold flex-1 text-slate-900">
            {t("profile_settings")}
          </h1>
        </div>
      </motion.header>

      <main className="max-w-[480px] md:max-w-lg mx-auto pb-20">
        {/* ─── Profile Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-4 mt-4 relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 px-4 pt-5 pb-5 shadow-md"
        >
          <LeafDecoration />
          <div className="relative flex items-center gap-4">
            {/* Avatar */}
            <AvatarUpload
              currentAvatarUrl={profile?.avatar_url || null}
              onAvatarUpdate={(url) => setAvatarUrl(url)}
              size="lg"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-[20px] font-bold text-white truncate leading-tight">
                {fullName || t("your_name")}
              </h2>
              <p className="text-white/80 text-[13px] truncate flex items-center gap-1 mt-0.5">
                <Leaf className="w-3.5 h-3.5 shrink-0" />
                {t("eat_healthy_live_better")}
              </p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="flex items-center gap-1 bg-white/20 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  <Flame className="w-3 h-3" />
                  {points} {t("points_label")}
                </span>
                {profile?.created_at && (
                  <span className="flex items-center gap-1 bg-white/15 text-white/80 text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm">
                    <Calendar className="w-3 h-3" />
                    {t("member_since")} {formatMemberDate(profile.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="px-4 mt-4">
          <article className="rounded-[18px] border border-slate-100 bg-white p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-black text-slate-800">{t("profile_achievements")}</h3>
              <span className="text-[11px] font-bold text-emerald-600">{unlockedCount}/{totalCount} Unlocked</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[...badges].sort((a, b) => (b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0)).slice(0, showAllBadges ? totalCount : 4).map((badge) => (
                <BadgeCard key={badge.id} badge={badge} variant="compact" />
              ))}
            </div>
            <button
              onClick={() => setShowAllBadges(!showAllBadges)}
              className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
            >
              {showAllBadges ? (
                <>{t("profile_show_less")}<ChevronUp className="h-3 w-3" /></>
              ) : (
                <>View All ({totalCount}) <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }} />
            </div>
          </article>
        </div>

        <div className="px-4">
          {/* ─── Security Warning ─── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 rounded-2xl bg-[#FEF2F2] border border-red-100 p-4 flex items-start gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-red-600 leading-tight">
                {t("account_security_recommended")}
              </p>
              <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
                {t("weak_password_warning")}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-2 rtl-flip" />
          </motion.div>

          <div className="mt-4">
            <AffiliateApplicationCard />
          </div>

          {isVip && (
            <div className="mb-4">
              <FamilyPlansCard
                members={members}
                loading={familyLoading}
                isVip={isVip}
                onAddClick={() => setShowAddFamilySheet(true)}
                onRemoveMember={removeMember}
              />
            </div>
          )}

          {/* ─── For Your Health ─── */}
          <SectionLabel>{t("for_your_health")}</SectionLabel>
          <CardSection>
            <MenuRow
              icon={<User className="w-full h-full" />}
              iconBg="bg-emerald-500"
              label={t("personal_info")}
              subtitle={t("personal_info_desc")}
              onClick={() => navigate("/personal-info")}
            />
            <MenuRow
              icon={<Target className="w-full h-full" />}
              iconBg="bg-emerald-500"
              label={t("goals")}
              subtitle={t("goals_subtitle")}
              onClick={() => navigate("/nutrition-goals")}
              right={
                <div className="flex items-center gap-1">
                  <span className="text-[13px] font-semibold text-emerald-600">
                    {calorieTarget > 0 ? `${calorieTarget} ${t("cal_unit")}` : "—"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 rtl-flip" />
                </div>
              }
            />
            <MenuRow
              icon={<Activity className="w-full h-full" />}
              iconBg="bg-rose-500"
              label={t("health_info")}
              subtitle={t("health_info_subtitle")}
              onClick={() => navigate("/body-metrics")}
            />
            <MenuRow
              icon={<ShieldAlert className="w-full h-full" />}
              iconBg="bg-blue-500"
              label={t("dietary_preferences")}
              subtitle={t("dietary_preferences_subtitle")}
              onClick={() => navigate("/dietary")}
            />
            <MenuRow
              icon={<Users className="w-full h-full" />}
              iconBg="bg-violet-500"
              label={currentCoach ? t("your_coach") : t("connect_with_coach")}
              subtitle={coachLoading ? t("coach_loading") : currentCoach ? currentCoach.full_name || t("coach_default_name") : t("coach_invite_hint")}
              onClick={() => {
                if (currentCoach) {
                  setRemoveCoachOpen(true);
                } else {
                  setCoachDialogOpen(true);
                }
              }}
              right={
                currentCoach ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-semibold text-violet-600">{t("coach_active")}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 rtl-flip" />
                  </div>
                ) : coachLoading ? undefined : (
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 rtl-flip" />
                )
              }
            />


            <MenuRow
              icon={<Heart className="w-full h-full" />}
              iconBg="bg-rose-500"
              label={t("health_dashboard_menu")}
              subtitle={t("health_dashboard_desc")}
              onClick={() => navigate("/health/dashboard")}
            />
            <MenuRow
              icon={<MapPin className="w-full h-full" />}
              iconBg="bg-slate-500"
              label={t("addresses")}
              subtitle={t("addresses_desc")}
              onClick={() => navigate("/addresses")}
            />

          </CardSection>

          {/* ─── Finance ─── */}
          <SectionLabel>{t("finance")}</SectionLabel>
          <CardSection>
            <MenuRow
              icon={<CreditCard className="w-full h-full" />}
              iconBg="bg-orange-500"
              label={t("payments")}
              subtitle={t("payments_subtitle")}
              onClick={() => navigate("/wallet")}
            />
            <MenuRow
              icon={<ShoppingBag className="w-full h-full" />}
              iconBg="bg-blue-500"
              label={t("order_history_menu")}
              subtitle={t("order_history_subtitle")}
              onClick={() => navigate("/orders")}
            />
            <MenuRow
              icon={<Receipt className="w-full h-full" />}
              iconBg="bg-violet-500"
              label={t("invoice_history_menu")}
              subtitle={t("invoice_history_subtitle")}
              onClick={() => navigate("/invoices")}
            />
            <MenuRow
              icon={<Crown className="w-full h-full" />}
              iconBg="bg-amber-500"
              label={t("subscription_menu")}
              subtitle={t("subscription_subtitle")}
              onClick={() => navigate("/subscription")}
              showDivider={false}
            />
          </CardSection>

          {/* ─── Discover ─── */}
          <SectionLabel>{t("discover")}</SectionLabel>
          <CardSection>
            <MenuRow
              icon={<Heart className="w-full h-full" />}
              iconBg="bg-red-500"
              label={t("favorites_menu")}
              subtitle={t("favorites_desc")}
              onClick={() => navigate("/favorites")}
            />
            <MenuRow
              icon={<Users className="w-full h-full" />}
              iconBg="bg-purple-500"
              label={t("community_menu")}
              subtitle={t("community_desc")}
              onClick={() => navigate("/community")}
              showDivider={false}
            />
          </CardSection>

          {/* ─── Support & Account ─── */}
          <SectionLabel>{t("support_account")}</SectionLabel>
          <CardSection>
            <MenuRow
              icon={<Globe className="w-full h-full" />}
              iconBg="bg-indigo-500"
              label={t("language_label")}
              subtitle={language === "ar" ? "العربية" : "English"}
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              right={
                <span className="text-[13px] font-semibold text-indigo-600">
                  {language === "ar" ? "EN" : "عربي"}
                </span>
              }
            />
            <MenuRow
              icon={<HelpCircle className="w-full h-full" />}
              iconBg="bg-slate-500"
              label={t("help_center")}
              subtitle={t("help_center_subtitle")}
              onClick={() => navigate("/faq")}
            />
            <MenuRow
              icon={<MessageCircle className="w-full h-full" />}
              iconBg="bg-cyan-500"
              label={t("contact_us")}
              subtitle={t("contact_us_subtitle")}
              onClick={() => navigate("/support")}
            />
            <MenuRow
              icon={<Lock className="w-full h-full" />}
              iconBg="bg-slate-500"
              label={t("privacy_security")}
              subtitle={t("privacy_security_subtitle")}
              onClick={() => navigate("/privacy")}
            />
            <MenuRow
              icon={<Bell className="w-full h-full" />}
              iconBg="bg-sky-500"
              label={t("notifications_menu")}
              subtitle={t("notifications_subtitle")}
              onClick={() => navigate("/notifications")}
            />
            <MenuRow
              icon={<Settings className="w-full h-full" />}
              iconBg="bg-slate-500"
              label={t("settings_menu")}
              subtitle={t("settings_subtitle")}
              onClick={() => navigate("/settings")}
            />
            <MenuRow
              icon={<LogOut className="w-full h-full" />}
              iconBg="bg-slate-500"
              label={t("logout")}
              subtitle={t("logout_subtitle")}
              onClick={handleSignOut}
              showDivider={false}
            />
          </CardSection>

          {/* ─── Dangerous Zone ─── */}
          <SectionLabel>{t("dangerous_zone")}</SectionLabel>
          <CardSection>
            <MenuRow
              icon={<Trash2 className="w-full h-full" />}
              iconBg="bg-red-50"
              iconColor="text-red-500"
              label={t("delete_account")}
              subtitle={t("delete_account_subtitle")}
              labelColor="text-red-500"
              onClick={() => {}}
              right={
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center">
                      <ChevronRight className="w-4 h-4 text-slate-400 rtl-flip" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl mx-4">
                    <AlertDialogHeader>
                      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-2">
                        <Trash2 className="w-6 h-6 text-red-500" />
                      </div>
                      <AlertDialogTitle className="text-center">
                        {t("delete_account_confirm_title")}
                      </AlertDialogTitle>
                      <AlertDialogDescription className="text-center">
                        {t("delete_account_warning")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl h-11">
                        {t("cancel")}
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-red-500 text-white hover:bg-red-600 rounded-xl h-11"
                      >
                        {t("delete_account")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              }
            />

          </CardSection>

          <div className="h-6" />
        </div>
      </main>

      <AddFamilyMemberSheet
        open={showAddFamilySheet}
        onClose={() => setShowAddFamilySheet(false)}
        onAdd={addMember}
      />

      <AlertDialog open={removeCoachOpen} onOpenChange={setRemoveCoachOpen}>
        <AlertDialogContent className="rounded-2xl mx-4 max-w-sm">
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-violet-500" />
            </div>
            <AlertDialogTitle className="text-center text-lg">
              {t("remove_coach_title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {currentCoach?.full_name ? (
                <>{t("remove_coach_confirm_named", { name: currentCoach.full_name })}</>
              ) : (
                t("remove_coach_confirm_generic")
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-11">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveCoach}
              disabled={removingCoach}
              className="bg-violet-600 text-white hover:bg-violet-700 rounded-xl h-11"
            >
              {removingCoach ? (
                <Loader2 className="w-4 h-4 animate-spin ms-1" />
              ) : null}
              {removingCoach ? t("removing_coach") : t("remove_coach_btn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={coachDialogOpen} onOpenChange={setCoachDialogOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-lg font-extrabold">{t("coach_dialog_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 text-center mb-4">
            {t("coach_dialog_desc")}
          </p>
          <Input
            placeholder={t("coach_invite_placeholder")}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="h-12 rounded-xl text-center text-lg font-mono font-bold tracking-wider"
            maxLength={14}
          />
          <Button
            onClick={handleConnectCoach}
            disabled={coachConnecting || !inviteCode.trim()}
            className="w-full mt-4 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold text-sm shadow-lg shadow-violet-600/20"
          >
            {coachConnecting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t("connect_btn")
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
