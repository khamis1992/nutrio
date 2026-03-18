import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NavChevronRight } from "@/components/ui/nav-chevron";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import flamAvatar from "@/assets/flam.png"; // Default avatar



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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User,
  Settings,
  ArrowLeft,
  Check,
  Loader2,
  LogOut,
  Trash2,
  Lock,
  Mail,
  Wallet,
  Calendar,
  Shield,
  Eye,
  EyeOff,
  Crown,
  AlertCircle,
  CheckCircle,
  XCircle,
  CreditCard,
  Gift,
  TrendingUp,
  Flame,
  Crown as CrownIcon,
  Star,
  MapPin,
  Utensils,
  ShieldAlert,
  FileText,
  Bell,
  Globe,
  ChevronDown,
  HelpCircle,
  MessageCircle,
  Phone,
  Ticket,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDietTags } from "@/hooks/useDietTags";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useWallet, type TopUpPackage } from "@/hooks/useWallet";
import { usePlatformSettings } from "@/hooks/usePlatformSettings";
import { useAffiliateApplication } from "@/hooks/useAffiliateApplication";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { AffiliateApplicationCard } from "@/components/AffiliateApplicationCard";
import { WalletBalance } from "@/components/wallet/WalletBalance";
import { TopUpPackages } from "@/components/wallet/TopUpPackages";
import { TransactionHistory } from "@/components/wallet/TransactionHistory";
import { StreakRewardsWidget } from "@/components/StreakRewardsWidget";
import { AffiliateEarningsWidget } from "@/components/AffiliateEarningsWidget";
import { ReferralMilestones } from "@/components/ReferralMilestones";
import { AvatarUpload } from "@/components/AvatarUpload";
import { supabase } from "@/integrations/supabase/client";
import { type Gender } from "@/lib/nutrition-calculator";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { useLanguage } from "@/contexts/LanguageContext";

const dietTagTranslationKeys: Record<string, string> = {
  "High-Protein": "high_protein",
  "Low-Carb": "low_carb",
  "Gluten-Free": "gluten_free",
  "Dairy-Free": "dairy_free",
  "Nut-Free": "nut_free",
  "Organic": "organic",
  "Vegetarian": "vegetarian",
  "Vegan": "vegan",
  "Keto": "keto",
};

type TabValue = "profile" | "wallet" | "rewards" | "settings";

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { value: "profile",  label: "profile_tab",  icon: User },
  { value: "wallet",   label: "wallet",   icon: Wallet },
  { value: "rewards",  label: "rewards",  icon: Gift },
  { value: "settings", label: "settings", icon: Settings },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};



// Gender card component
const GenderCard = ({
  gender,
  selected,
  onClick,
  t,
}: {
  gender: Gender;
  selected: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) => {
  const isMale = gender === "male";

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
        "border-2 text-left w-full",
        selected
          ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10"
          : "border-border bg-card hover:border-primary/30 hover:shadow-md"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          <User className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <p
            className={cn(
              "font-semibold text-lg capitalize",
              selected ? "text-primary" : "text-foreground"
            )}
          >
            {gender === "male" ? t("male") : t("female")}
          </p>
          <p className="text-sm text-muted-foreground">
            {isMale ? t("he_him") : t("she_her")}
          </p>
        </div>
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
            >
              <Check className="w-4 h-4 text-primary-foreground" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
};

// Section card wrapper
const SectionCard = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  return (
    <motion.div
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={cn(
        "bg-card rounded-2xl border border-border shadow-sm overflow-hidden",
        className
      )}
    >
      {children}
    </motion.div>
  );
};

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, updateProfile } = useProfile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { settings: platformSettings } = usePlatformSettings();
  const { isApprovedAffiliate } = useAffiliateApplication();

  // Profile tab state
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState("");

  // Account tab state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // General state
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("profile");

  // Wallet state
  const {
    wallet,
    transactions,
    topUpPackages,
    loading: walletLoading,
    transactionsLoading,
    refresh,
  } = useWallet();

  const [selectedPackage, setSelectedPackage] = useState<TopUpPackage | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  // Profile accordion state
  const [openSection, setOpenSection] = useState<"personal" | "addresses" | "dietary" | "policies" | "support" | null>(null);
  const toggleSection = (s: typeof openSection) => setOpenSection(prev => prev === s ? null : s);

  // Settings state
  const [notifOrderUpdates, setNotifOrderUpdates] = useState(true);
  const [notifPromotions, setNotifPromotions] = useState(true);
  const [notifNewMeals, setNotifNewMeals] = useState(false);
  const [privacyAnalytics, setPrivacyAnalytics] = useState(true);
  const [privacyPersonalised, setPrivacyPersonalised] = useState(true);
  const { language, setLanguage, t } = useLanguage();

  const getTranslatedTagName = (tagName: string): string => {
    // Try the original name first (handles "High-Protein", "Low-Carb", etc.)
    if (dietTagTranslationKeys[tagName]) {
      const key = dietTagTranslationKeys[tagName];
      const translated = t(key as any);
      return translated !== key ? translated : tagName;
    }
    // Try normalized (spaces → Title-Case-Hyphenated) for names like "High Protein"
    if (tagName.includes(' ')) {
      const normalized = tagName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('-');
      if (dietTagTranslationKeys[normalized]) {
        const key = dietTagTranslationKeys[normalized];
        const translated = t(key as any);
        return translated !== key ? translated : tagName;
      }
    }
    // Fallback: try category_* key
    const categoryKey = `category_${tagName.toLowerCase()}`;
    const categoryTranslated = t(categoryKey as any);
    return categoryTranslated !== categoryKey ? categoryTranslated : tagName;
  };

  // Dietary state
  const { dietTags, allergyTags, loading: dietTagsLoading } = useDietTags();
  const [userDietPreferences, setUserDietPreferences] = useState<string[]>([]);
  const [dietaryLoading, setDietaryLoading] = useState(false);

  const fetchDietaryData = async () => {
    if (!user) return;
    setDietaryLoading(true);
    try {
      const { data: prefs } = await supabase
        .from("user_dietary_preferences")
        .select("diet_tag_id")
        .eq("user_id", user.id);
      setUserDietPreferences(prefs?.map((p: { diet_tag_id: string }) => p.diet_tag_id) || []);
    } catch {
      toast({ title: t("error"), description: t("failed_load_dietary_preferences"), variant: "destructive" });
    } finally {
      setDietaryLoading(false);
    }
  };

  const toggleDietPreference = async (tagId: string) => {
    if (!user) return;
    const isSelected = userDietPreferences.includes(tagId);
    try {
      if (isSelected) {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);
        if (error) throw error;
        setUserDietPreferences(prev => prev.filter(id => id !== tagId));
      } else {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .insert({ user_id: user.id, diet_tag_id: tagId });
        if (error) throw error;
        setUserDietPreferences(prev => [...prev, tagId]);
      }
      toast({ title: isSelected ? t("removed") : t("added"), description: isSelected ? t("dietary_preference_removed") : t("dietary_preference_added") });
    } catch {
      toast({ title: t("error"), description: t("failed_update_dietary_preference"), variant: "destructive" });
    }
  };

  const handleSelectPackage = (pkg: TopUpPackage) => {
    setSelectedPackage(pkg);
    setShowConfirmDialog(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPackage || !user) return;

    setProcessingId(selectedPackage.id);
    setShowConfirmDialog(false);

    // Navigate to checkout page with simulation mode
    navigate(`/checkout?amount=${selectedPackage.amount}&type=wallet&packageId=${selectedPackage.id}`);
  };

  const totalAmount = selectedPackage
    ? selectedPackage.amount + selectedPackage.bonus_amount
    : 0;

  // Load profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setGender(profile.gender);
      setAge(profile.age?.toString() || "");
    }
  }, [profile]);

  useEffect(() => {
    fetchDietaryData();
  }, [user]);

  // Calculate password strength
  useEffect(() => {
    let strength = 0;
    if (newPassword.length >= 8) strength += 1;
    if (/[A-Z]/.test(newPassword)) strength += 1;
    if (/[0-9]/.test(newPassword)) strength += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength += 1;
    setPasswordStrength(strength);
  }, [newPassword]);

  const saveProfileTab = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({
        full_name: fullName,
        gender,
        age: age ? parseInt(age) : null,
      });

      if (error) throw error;

      toast({
        title: t("profile_updated"),
        description: t("profile_updated_description"),
      });
    } catch (err) {
      toast({
        title: t("error_saving_profile"),
        description: t("please_try_again"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t("passwords_dont_match"),
        description: t("passwords_match_warning"),
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t("password_too_short"),
        description: t("password_must_be_at_least_6_characters"),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");

      toast({
        title: t("password_updated"),
        description: t("password_changed_success"),
      });
    } catch (err) {
      toast({
        title: t("error_updating_password"),
        description: t("please_try_again"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground animate-pulse">{t("loading_profile")}</p>
        </motion.div>
      </div>
    );
  }

  // Reusable native-style row component
  const NativeRow = ({
    icon,
    iconBg,
    label,
    subtitle,
    right,
    onClick,
    showDivider = true,
  }: {
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    subtitle?: string;
    right?: React.ReactNode;
    onClick?: () => void;
    showDivider?: boolean;
  }) => (
    <>
      <motion.button
        whileTap={{ scale: 0.985 }}
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 active:bg-muted/60 transition-colors text-start"
      >
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right ?? <NavChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />}
      </motion.button>
      {showDivider && <div className="h-px bg-border/60 ml-[52px]" />}
    </>
  );

  // Group label above sections
  const GroupLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-1 mt-5 first:mt-0">
      {children}
    </p>
  );

  // Grouped section card wrapper
  const NativeSection = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={cn("bg-card rounded-2xl overflow-hidden shadow-sm border border-border/50", className)}>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Fixed Header */}
      <motion.header
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/40 pt-safe"
      >
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-semibold flex-1">{t("profile_settings")}</h1>
        </div>
      </motion.header>

      {/* Scrollable Content */}
      <main className="pb-24">
        {/* Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/70 px-4 pt-6 pb-8"
        >
          {/* Background orbs */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />

          <div className="relative flex items-center gap-4">
            <AvatarUpload
              currentAvatarUrl={avatarUrl || profile?.avatar_url || null}
              onAvatarUpdate={(url) => setAvatarUrl(url)}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">
                {fullName || t("your_name")}
              </h2>
              <p className="text-white/70 text-sm truncate flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {user?.email}
              </p>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="flex items-center gap-1 bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  <Crown className="w-3 h-3" />
                  {t("free_plan")}
                </span>
                {profile?.created_at && (
                  <span className="flex items-center gap-1 bg-white/15 text-white/80 text-xs px-2.5 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    {t("joined")} {formatDate(profile.created_at)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tab Bar */}
        <div className="sticky top-14 z-40 bg-background/95 backdrop-blur-md border-b border-border/40 px-4 py-2">
          <div className="flex gap-1 bg-muted rounded-xl p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              return (
                <motion.button
                  key={item.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab(item.value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                    isActive
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] leading-tight">{t(item.label)}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-4 space-y-1"
            >
              {/* Affiliate Card */}
              <AffiliateApplicationCard />

              {/* MY INFO group */}
              <GroupLabel>{t("personal_info")}</GroupLabel>
              <NativeSection>
                {/* Personal Info accordion row */}
                <NativeRow
                  icon={<User className="w-4 h-4 text-white" />}
                  iconBg="bg-blue-500"
                  label={t("personal_info")}
                  subtitle={t("personal_info_desc")}
                  onClick={() => toggleSection("personal")}
                  right={
                    <motion.div animate={{ rotate: openSection === "personal" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </motion.div>
                  }
                />
                <AnimatePresence initial={false}>
                  {openSection === "personal" && (
                    <motion.div
                      key="personal-expand"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border/50">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("full_name_label")}</Label>
                          <div className="relative">
                            <Input
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder={t("enter_full_name")}
                              className="h-11 rounded-xl pr-10 text-sm"
                            />
                            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("gender" as any)}</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {(["male", "female"] as Gender[]).map((g) => (
                              <GenderCard key={g} gender={g} selected={gender === g} onClick={() => setGender(g)} t={t} />
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("age_label")}</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={age}
                              onChange={(e) => setAge(e.target.value)}
                              placeholder={t("age_default_placeholder")}
                              min={13}
                              max={120}
                              className="h-11 rounded-xl pr-14 text-sm"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{t("years_label")}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("email_address")}</Label>
                          <div className="flex items-center gap-2 p-3 bg-muted/60 rounded-xl">
                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                            <p className="text-sm font-medium truncate">{user?.email}</p>
                          </div>
                        </div>
                        <Button onClick={saveProfileTab} disabled={saving} className="w-full h-11 rounded-xl text-sm">
                          {saving
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("saving")}</>
                            : <><Check className="w-4 h-4 mr-2" />{t("save_changes")}</>}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Delivery Addresses */}
                <NativeRow
                  icon={<MapPin className="w-4 h-4 text-white" />}
                  iconBg="bg-green-500"
                  label={t("delivery_addresses")}
                  subtitle={t("manage_addresses")}
                  onClick={() => toggleSection("addresses")}
                  right={
                    <motion.div animate={{ rotate: openSection === "addresses" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </motion.div>
                  }
                />
                <AnimatePresence initial={false}>
                  {openSection === "addresses" && (
                    <motion.div
                      key="addresses-expand"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 border-t border-border/50">
                        <button
                          onClick={() => navigate("/addresses")}
                          className="flex items-center gap-3 w-full h-11 px-3 rounded-xl border border-border bg-muted/30 text-sm font-medium active:bg-muted transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1 text-start">{t("manage_addresses_action")}</span>
                          <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Dietary & Allergies */}
                <NativeRow
                  icon={<Utensils className="w-4 h-4 text-white" />}
                  iconBg="bg-orange-500"
                  label={t("dietary_and_allergies")}
                  subtitle={t("manage_dietary_preferences")}
                  onClick={() => toggleSection("dietary")}
                  showDivider={false}
                  right={
                    <motion.div animate={{ rotate: openSection === "dietary" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </motion.div>
                  }
                />
                <AnimatePresence initial={false}>
                  {openSection === "dietary" && (
                    <motion.div
                      key="dietary-expand"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border/50">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("dietary_preferences")}</p>
                          {(dietaryLoading || dietTagsLoading) ? (
                            <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
                          ) : dietTags.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("no_dietary_tags_available")}</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {dietTags.map(tag => {
                                const isSelected = userDietPreferences.includes(tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    onClick={() => toggleDietPreference(tag.id)}
                                    className={cn(
                                      "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200",
                                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/30 text-muted-foreground"
                                    )}
                                  >
                                    {isSelected && <Check className="w-3 h-3" />}
                                    {getTranslatedTagName(tag.name)}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {!dietTagsLoading && allergyTags.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("allergies_and_intolerances")}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {allergyTags.map(tag => {
                                const isSelected = userDietPreferences.includes(tag.id);
                                return (
                                  <button
                                    key={tag.id}
                                    onClick={() => toggleDietPreference(tag.id)}
                                    className={cn(
                                      "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200",
                                      isSelected ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-700"
                                    )}
                                  >
                                    {isSelected && <Check className="w-3 h-3" />}
                                    {getTranslatedTagName(tag.name)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </NativeSection>

              {/* LEGAL & SUPPORT group */}
              <GroupLabel>{t("policies")} & {t("support")}</GroupLabel>
              <NativeSection>
                <NativeRow
                  icon={<FileText className="w-4 h-4 text-white" />}
                  iconBg="bg-slate-500"
                  label={t("policies")}
                  subtitle={`${t("terms_and_conditions")}, ${t("privacy_policy_label")}`}
                  onClick={() => toggleSection("policies")}
                  right={
                    <motion.div animate={{ rotate: openSection === "policies" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </motion.div>
                  }
                />
                <AnimatePresence initial={false}>
                  {openSection === "policies" && (
                    <motion.div
                      key="policies-expand"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/50">
                        <button
                          onClick={() => navigate("/terms")}
                          className="flex items-center gap-3 w-full px-4 py-3 active:bg-muted/50 transition-colors text-sm"
                        >
                          <FileText className="w-4 h-4 text-muted-foreground ml-11" />
                          <span className="flex-1 text-start">{t("terms_and_conditions")}</span>
                          <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </button>
                        <div className="h-px bg-border/60 ml-[76px]" />
                        <button
                          onClick={() => navigate("/privacy")}
                          className="flex items-center gap-3 w-full px-4 py-3 active:bg-muted/50 transition-colors text-sm"
                        >
                          <ShieldAlert className="w-4 h-4 text-muted-foreground ml-11" />
                          <span className="flex-1 text-start">{t("privacy_policy_label")}</span>
                          <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <NativeRow
                  icon={<HelpCircle className="w-4 h-4 text-white" />}
                  iconBg="bg-sky-500"
                  label={t("support")}
                  subtitle={t("get_help_report_issues")}
                  onClick={() => toggleSection("support")}
                  showDivider={false}
                  right={
                    <motion.div animate={{ rotate: openSection === "support" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                    </motion.div>
                  }
                />
                <AnimatePresence initial={false}>
                  {openSection === "support" && (
                    <motion.div
                      key="support-expand"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/50">
                        {[
                          {
                            href: "https://wa.me/97412345678?text=Hi%2C%20I%20need%20help%20with%20Nutrio%20Fuel",
                            icon: <MessageCircle className="w-4 h-4 text-green-500" />,
                            label: t("chat_on_whatsapp"),
                            right: <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50" />,
                            isExternal: true,
                          },
                          {
                            href: "mailto:support@nutriofuel.com?subject=Support%20Request",
                            icon: <Mail className="w-4 h-4 text-sky-500" />,
                            label: t("email_support"),
                            right: <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50" />,
                            isExternal: true,
                          },
                          {
                            href: "tel:+97412345678",
                            icon: <Phone className="w-4 h-4 text-violet-500" />,
                            label: t("call_us"),
                            right: <span className="text-xs text-muted-foreground">{t("phone_number")}</span>,
                            isExternal: true,
                          },
                        ].map(({ href, icon, label, right: rowRight, isExternal }, idx, arr) => (
                          <div key={label}>
                            <a
                              href={href}
                              target={isExternal ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 w-full px-4 py-3 active:bg-muted/50 transition-colors text-sm font-medium"
                            >
                              <div className="ml-11">{icon}</div>
                              <span className="flex-1 text-start">{label}</span>
                              {rowRight}
                            </a>
                            {idx < arr.length - 1 && <div className="h-px bg-border/60 ml-[76px]" />}
                          </div>
                        ))}
                        <div className="h-px bg-border/60 ml-[76px]" />
                        <button
                          onClick={() => navigate("/support")}
                          className="flex items-center gap-3 w-full px-4 py-3 active:bg-muted/50 transition-colors text-sm font-medium"
                        >
                          <Ticket className="w-4 h-4 text-amber-500 ml-11" />
                          <span className="flex-1 text-start">{t("submit_a_ticket")}</span>
                          <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </button>
                        <div className="h-px bg-border/60 ml-[76px]" />
                        <button
                          onClick={() => navigate("/faq")}
                          className="flex items-center gap-3 w-full px-4 py-3 active:bg-muted/50 transition-colors text-sm font-medium"
                        >
                          <BookOpen className="w-4 h-4 text-primary ml-11" />
                          <span className="flex-1 text-start">{t("view_faq")}</span>
                          <NavChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        </button>
                        <p className="text-xs text-center text-muted-foreground py-3 border-t border-border/50">
                          {t("support_hours")}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </NativeSection>
            </motion.div>
          )}

          {activeTab === "wallet" && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-4 space-y-4"
            >
              {paymentStatus === "success" && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{t("payment_successful")}</AlertDescription>
                </Alert>
              )}
              {paymentStatus === "failed" && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{t("payment_failed")}</AlertDescription>
                </Alert>
              )}
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">{t("simulation_mode")}</AlertDescription>
              </Alert>

              <WalletBalance
                balance={wallet?.balance || 0}
                totalCredits={wallet?.total_credits || 0}
                totalDebits={wallet?.total_debits || 0}
                loading={walletLoading}
              />
              <TopUpPackages
                packages={topUpPackages}
                loading={walletLoading}
                onSelectPackage={handleSelectPackage}
                selectedPackageId={selectedPackage?.id}
                processingId={processingId ?? undefined}
              />
              <TransactionHistory transactions={transactions} loading={transactionsLoading} />

              <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("confirm_top_up")}</DialogTitle>
                    <DialogDescription>{t("review_top_up_details")}</DialogDescription>
                  </DialogHeader>
                  {selectedPackage && (
                    <div className="space-y-4">
                      <Card>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("package_label")}</span>
                            <span className="font-medium">{selectedPackage.name}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{t("top_up_amount")}</span>
                            <span>{formatCurrency(selectedPackage.amount)}</span>
                          </div>
                          {selectedPackage.bonus_amount > 0 && (
                            <div className="flex justify-between text-sm text-purple-600">
                              <span>{t("bonus_credit")}</span>
                              <span>+{formatCurrency(selectedPackage.bonus_amount)}</span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-semibold text-sm">
                            <span>{t("total_credit")}</span>
                            <span className="text-green-600">{formatCurrency(totalAmount)}</span>
                          </div>
                        </CardContent>
                      </Card>
                      <p className="text-xs text-muted-foreground text-center">{t("redirected_to_sadad")}</p>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>{t("cancel")}</Button>
                    <Button onClick={handleConfirmPayment} className="bg-green-600 hover:bg-green-700">
                      <CreditCard className="h-4 w-4 mr-2" />
                      {t("pay_with_amount")} {formatCurrency(selectedPackage?.amount ?? 0)}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </motion.div>
          )}

          {activeTab === "rewards" && (
            <motion.div
              key="rewards"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-4 space-y-3"
            >
              {/* Streak section */}
              <GroupLabel>{t("streakRewards")}</GroupLabel>
              <StreakRewardsWidget />

              {/* Affiliate earnings (approved affiliates only) */}
              {isApprovedAffiliate && platformSettings.features.referral_program && (
                <>
                  <GroupLabel>{t("affiliate_earnings")}</GroupLabel>
                  <AffiliateEarningsWidget />
                </>
              )}

              {/* Programs */}
              <GroupLabel>{t("affiliate_program")}</GroupLabel>
              <NativeSection>
                {platformSettings.features.referral_program && (
                  <NativeRow
                    icon={<CrownIcon className="w-4 h-4 text-white" />}
                    iconBg="bg-violet-500"
                    label={isApprovedAffiliate ? t("view_affiliate_dashboard") : t("affiliate_program")}
                    subtitle={isApprovedAffiliate ? t("commission_balance") : t("become_affiliate")}
                    onClick={() => navigate(isApprovedAffiliate ? "/affiliate" : "/profile")}
                    showDivider={true}
                  />
                )}
                <NativeRow
                  icon={<Flame className="w-4 h-4 text-white" />}
                  iconBg="bg-amber-500"
                  label={t("daily_streaks")}
                  subtitle={t("order_daily_earn_bonuses")}
                  right={<span />}
                  showDivider={true}
                />
                <NativeRow
                  icon={<Star className="w-4 h-4 text-white" />}
                  iconBg="bg-green-500"
                  label={t("wallet_bonuses")}
                  subtitle={t("get_bonus_credits")}
                  right={<span />}
                  showDivider={false}
                />
              </NativeSection>
            </motion.div>
          )}

          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="px-4 pt-4 space-y-1"
            >
              {/* Security */}
              <GroupLabel>{t("change_password")}</GroupLabel>
              <NativeSection>
                <div className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("new_password_label")}</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder={t("enter_new_password")}
                        className="h-11 rounded-xl pr-10 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPassword && (
                      <div className="flex gap-1">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1 flex-1 rounded-full transition-all duration-300",
                              i < passwordStrength
                                ? passwordStrength >= 3 ? "bg-green-500" : passwordStrength >= 2 ? "bg-amber-500" : "bg-red-500"
                                : "bg-muted"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("confirm_password")}</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t("confirm_new_password")}
                        className="h-11 rounded-xl pr-10 text-sm"
                      />
                      <Shield
                        className={cn(
                          "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                          confirmPassword && newPassword === confirmPassword ? "text-green-500" : "text-muted-foreground"
                        )}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={saving || !newPassword || !confirmPassword}
                    variant="outline"
                    className="w-full h-11 rounded-xl text-sm"
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{t("updating")}</>
                      : <><Lock className="w-4 h-4 mr-2" />{t("update_password_btn")}</>}
                  </Button>
                </div>
              </NativeSection>

              {/* Notifications */}
              <GroupLabel>{t("notification_settings")}</GroupLabel>
              <NativeSection>
                {[
                  { label: t("order_updates"), desc: t("status_changes_orders"), value: notifOrderUpdates, set: setNotifOrderUpdates },
                  { label: t("promotions_offers"), desc: t("discounts_special_deals"), value: notifPromotions, set: setNotifPromotions },
                  { label: t("new_meals_available"), desc: t("when_restaurants_add_items"), value: notifNewMeals, set: setNotifNewMeals },
                ].map(({ label, desc, value, set }, idx, arr) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch checked={value} onCheckedChange={set} />
                    </div>
                    {idx < arr.length - 1 && <div className="h-px bg-border/60 ml-4" />}
                  </div>
                ))}
              </NativeSection>

              {/* Privacy */}
              <GroupLabel>{t("privacy_settings")}</GroupLabel>
              <NativeSection>
                {[
                  { label: t("usage_analytics"), desc: t("help_improve_app"), value: privacyAnalytics, set: setPrivacyAnalytics },
                  { label: t("personalised_recommendations"), desc: t("tailor_meals_offers"), value: privacyPersonalised, set: setPrivacyPersonalised },
                ].map(({ label, desc, value, set }, idx, arr) => (
                  <div key={label}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                      <Switch checked={value} onCheckedChange={set} />
                    </div>
                    {idx < arr.length - 1 && <div className="h-px bg-border/60 ml-4" />}
                  </div>
                ))}
              </NativeSection>

              {/* Language */}
              <GroupLabel>{t("language")}</GroupLabel>
              <NativeSection>
                <div className="px-4 py-3">
                  <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "ar")}>
                    <SelectTrigger className="h-11 rounded-xl text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇬🇧 {t("english")}</SelectItem>
                      <SelectItem value="ar">🇶🇦 {t("arabic")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </NativeSection>

              {/* Account Actions */}
              <GroupLabel>{t("account_actions")}</GroupLabel>
              <NativeSection>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-4 py-3.5 active:bg-muted/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-500 flex items-center justify-center shrink-0">
                    <LogOut className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium flex-1 text-start">{t("sign_out")}</span>
                </button>
                <div className="h-px bg-border/60 ml-[52px]" />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-3 w-full px-4 py-3.5 active:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-destructive flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium flex-1 text-start text-destructive">{t("delete_account")}</span>
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl mx-4">
                    <AlertDialogHeader>
                      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                        <Trash2 className="w-6 h-6 text-destructive" />
                      </div>
                      <AlertDialogTitle className="text-center">{t("delete_account")}?</AlertDialogTitle>
                      <AlertDialogDescription className="text-center">{t("delete_account_warning")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl h-11">{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-11"
                      >
                        {t("delete_account")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </NativeSection>

              <div className="pb-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CustomerNavigation />
    </div>
  );
};

export default Profile;
