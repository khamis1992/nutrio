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
import {
  User,
  ArrowLeft,
  Loader2,
  LogOut,
  Trash2,
  Calendar,
  ShieldAlert,
  Camera,
  Flame,
  Target,
  Activity,
  Dumbbell,
  CreditCard,
  Tag,
  MessageCircle,
  Lock,
  Power,
  Leaf,
  ChevronRight,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
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

/* ─── Leaf decoration SVG ─── */
const LeafDecoration = () => (
  <svg
    className="absolute right-4 top-1/2 -translate-y-1/2 w-28 h-28 text-white/10 pointer-events-none"
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
    <motion.button
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
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
        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
      )}
    </motion.button>
    {showDivider && <div className="h-px bg-slate-100 ml-16" />}
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
  const { toast } = useToast();
  const { isApprovedAffiliate } = useAffiliateApplication();
  const { t } = useLanguage();

  const userId = user?.id;
  const { goals } = useNutritionGoals(userId);
  const { streaks } = useStreak(userId);

  const activeGoal = goals.find((g) => g.is_active) || goals[0];
  const calorieTarget = activeGoal?.daily_calorie_target ?? 0;
  const currentStreak = streaks?.logging?.currentStreak ?? 0;

  /* Points = streak-based for visual appeal */
  const points = currentStreak > 0 ? currentStreak * 10 : 40;

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
  }, [profile]);

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

  const handleDeactivate = () => {
    toast({
      title: t("coming_soon"),
      description: t("deactivate_coming_soon"),
    });
  };

  const formatMemberDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FA]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
          <p className="text-slate-500 animate-pulse">{t("loading_profile")}</p>
        </motion.div>
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

      <main className="max-w-[480px] md:max-w-lg mx-auto pb-28">
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
            <div className="relative shrink-0">
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-white border-[3px] border-white/30 shadow-lg">
                {avatarUrl || profile?.avatar_url ? (
                  <img
                    src={avatarUrl || profile?.avatar_url || undefined}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-emerald-100">
                    <User className="w-8 h-8 text-emerald-600" />
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate("/personal-info")}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center border border-emerald-100"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
              </button>
            </div>

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
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
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
                    {calorieTarget > 0 ? `${calorieTarget} Cal` : "—"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
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
              icon={<Dumbbell className="w-full h-full" />}
              iconBg="bg-indigo-500"
              label={t("activity_lifestyle")}
              subtitle={t("activity_lifestyle_subtitle")}
              onClick={() => navigate("/tracker")}
              showDivider={false}
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
              icon={<Tag className="w-full h-full" />}
              iconBg="bg-emerald-500"
              label={t("offers_coupons")}
              subtitle={t("offers_coupons_subtitle")}
              onClick={() => navigate("/wallet")}
              showDivider={false}
            />
          </CardSection>

          {/* ─── Support & Account ─── */}
          <SectionLabel>{t("support_account")}</SectionLabel>
          <CardSection>
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
              iconBg="bg-slate-100"
              iconColor="text-slate-500"
              label={t("delete_account")}
              subtitle={t("delete_account_subtitle")}
              onClick={() => {}}
              right={
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center">
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl mx-4">
                    <AlertDialogHeader>
                      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-2">
                        <Trash2 className="w-6 h-6 text-red-500" />
                      </div>
                      <AlertDialogTitle className="text-center">
                        {t("delete_account")}?
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
            <MenuRow
              icon={<Power className="w-full h-full" />}
              iconBg="bg-red-50"
              iconColor="text-red-500"
              label={t("deactivate_account")}
              subtitle={t("deactivate_account_subtitle")}
              labelColor="text-red-500"
              onClick={handleDeactivate}
              showDivider={false}
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
    </div>
  );
};

export default Profile;
