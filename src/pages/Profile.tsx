import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  ChevronRight,
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

  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-xl hover:bg-muted"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">{t("profile_settings")}</h1>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mb-8"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          </div>

          <div className="relative">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar with gradient ring - Clickable for upload */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="relative"
              >
                <AvatarUpload
                  currentAvatarUrl={avatarUrl || profile?.avatar_url || null}
                  onAvatarUpdate={(url) => {
                    // Update local state to reflect change immediately
                    setAvatarUrl(url);
                  }}
                  size="lg"
                />
              </motion.div>

              {/* User info */}
              <div className="flex-1 text-center sm:text-left">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl sm:text-3xl font-bold mb-1"
                >
                  {fullName || t("your_name")}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-muted-foreground flex items-center justify-center sm:justify-start gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {user?.email}
                </motion.p>

                {/* Quick stats */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center sm:justify-start gap-4 mt-4"
                >
                   <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                     <Crown className="w-4 h-4" />
                     <span>{t("free_plan")}</span>
                   </div>
                   {profile?.created_at && (
                     <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm">
                       <Calendar className="w-4 h-4" />
                       <span>{t("joined")} {formatDate(profile.created_at)}</span>
                     </div>
                   )}
                </motion.div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Navigation and Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar Navigation - Desktop */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="hidden lg:block lg:col-span-3"
          >
            <div className="sticky top-24 space-y-2">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                return (
                  <motion.button
                    key={item.value}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.1 }}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(item.value)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-300",
                      "border-2",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "border-transparent bg-card hover:bg-muted hover:border-border"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{t(item.label)}</span>
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="ml-auto"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.aside>

          {/* Mobile Navigation - Horizontal Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden col-span-1 -mx-4 px-4 overflow-x-auto scrollbar-thin"
          >
            <div className="flex gap-2 pb-2 min-w-max">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                return (
                  <motion.button
                    key={item.value}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab(item.value)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-card border border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {t(item.label)}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Content Area */}
          <div className="lg:col-span-9">
            <AnimatePresence mode="wait">
              {activeTab === "profile" && (
                <motion.div
                  key="profile"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Affiliate Card */}
                  <motion.div variants={itemVariants}>
                    <AffiliateApplicationCard />
                  </motion.div>

                  {/* Personal Information Accordion */}
                  <SectionCard>
                    <CardContent className="p-0">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSection("personal")}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors rounded-2xl text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                       <div className="flex-1 min-w-0">
                           <p className="font-semibold text-foreground">{t("personal_info")}</p>
                           <p className="text-sm text-muted-foreground">{t("personal_info_desc")}</p>
                         </div>
                        <motion.div animate={{ rotate: openSection === "personal" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </motion.div>
                      </motion.button>
                      <AnimatePresence initial={false}>
                        {openSection === "personal" && (
                          <motion.div
                            key="personal-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-1 space-y-5 border-t border-border/50">
                              {/* Full Name */}
                               <div className="space-y-2">
                                 <Label htmlFor="fullName" className="text-sm font-medium">{t("full_name_label")}</Label>
                                <div className="relative">
                                  <Input
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder={t("enter_full_name")}
                                    className="h-12 rounded-xl pr-12"
                                  />
                                  <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                </div>
                              </div>
                               {/* Gender */}
                               <div className="space-y-3">
                                  <Label className="text-sm font-medium">{t("gender" as any)}</Label>
                                <div className="grid grid-cols-2 gap-3">
                                   {(["male", "female"] as Gender[]).map((g) => (
                                     <GenderCard key={g} gender={g} selected={gender === g} onClick={() => setGender(g)} t={t} />
                                   ))}
                                 </div>
                              </div>
                               {/* Age */}
                               <div className="space-y-2">
                                 <Label htmlFor="age" className="text-sm font-medium">{t("age_label")}</Label>
                                 <div className="relative">
                                   <Input
                                     id="age"
                                     type="number"
                                     value={age}
                                     onChange={(e) => setAge(e.target.value)}
                                      placeholder={t("age_default_placeholder")}
                                     min={13}
                                     max={120}
                                     className="h-12 rounded-xl"
                                   />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{t("years_label")}</span>
                                 </div>
                               </div>
                              {/* Email */}
                              <div className="space-y-2">
                                 <Label className="text-sm font-medium">{t("email_address")}</Label>
                                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                                  <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                                  <p className="font-medium text-sm">{user?.email}</p>
                                </div>
                              </div>
                              {/* Save */}
                              <Button
                                onClick={saveProfileTab}
                                disabled={saving}
                                className="w-full h-12 rounded-xl"
                              >
                                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />t("saving")</> : <><Check className="w-4 h-4 mr-2" />{t("save_changes")}</>}
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </SectionCard>

                  {/* Delivery Addresses Accordion */}
                  <SectionCard>
                    <CardContent className="p-0">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSection("addresses")}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors rounded-2xl text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="font-semibold text-foreground">{t("delivery_addresses")}</p>
                          <p className="text-sm text-muted-foreground">{t("manage_addresses")}</p>
                        </div>
                        <motion.div animate={{ rotate: openSection === "addresses" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </motion.div>
                      </motion.button>
                      <AnimatePresence initial={false}>
                        {openSection === "addresses" && (
                          <motion.div
                            key="addresses-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-3 border-t border-border/50">
                              <Button
                                variant="outline"
                                className="w-full h-12 rounded-xl justify-start gap-3"
                                onClick={() => navigate("/addresses")}
                              >
                                <MapPin className="w-5 h-5 text-muted-foreground" />
                                 <span>{t("manage_addresses_action")}</span>
                                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </SectionCard>

                  {/* Dietary & Allergies Accordion */}
                  <SectionCard>
                    <CardContent className="p-0">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSection("dietary")}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors rounded-2xl text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Utensils className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="font-semibold text-foreground">{t("dietary_and_allergies")}</p>
                           <p className="text-sm text-muted-foreground">{t("manage_dietary_preferences")}</p>
                        </div>
                        <motion.div animate={{ rotate: openSection === "dietary" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </motion.div>
                      </motion.button>
                      <AnimatePresence initial={false}>
                        {openSection === "dietary" && (
                          <motion.div
                            key="dietary-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-3 space-y-4 border-t border-border/50">
                              {/* Diet tags */}
                              <div>
                                 <p className="text-sm font-medium mb-2">{t("dietary_preferences")}</p>
                                {(dietaryLoading || dietTagsLoading) ? (
                                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                                ) : dietTags.length === 0 ? (
                                   <p className="text-sm text-muted-foreground">{t("no_dietary_tags_available")}</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {dietTags.map(tag => {
                                      const isSelected = userDietPreferences.includes(tag.id);
                                      return (
                                        <button
                                          key={tag.id}
                                          onClick={() => toggleDietPreference(tag.id)}
                                          className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all duration-200",
                                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                                          )}
                                        >
                                          {isSelected && <Check className="w-3 h-3" />}
                                          {tag.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                              {/* Allergy tags */}
                              {!dietTagsLoading && allergyTags.length > 0 && (
                                <div>
                                   <p className="text-sm font-medium mb-2">{t("allergies_and_intolerances")}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {allergyTags.map(tag => {
                                      const isSelected = userDietPreferences.includes(tag.id);
                                      return (
                                        <button
                                          key={tag.id}
                                          onClick={() => toggleDietPreference(tag.id)}
                                          className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all duration-200",
                                            isSelected ? "border-amber-500 bg-amber-500 text-white" : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400"
                                          )}
                                        >
                                          {isSelected && <Check className="w-3 h-3" />}
                                          {tag.name}
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
                    </CardContent>
                  </SectionCard>

                  {/* Policies Accordion */}
                  <SectionCard>
                    <CardContent className="p-0">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSection("policies")}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors rounded-2xl text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="font-semibold text-foreground">{t("policies")}</p>
                           <p className="text-sm text-muted-foreground">{t("terms_and_conditions")}, {t("privacy_policy_label")}</p>
                        </div>
                        <motion.div animate={{ rotate: openSection === "policies" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </motion.div>
                      </motion.button>
                      <AnimatePresence initial={false}>
                        {openSection === "policies" && (
                          <motion.div
                            key="policies-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-3 space-y-2 border-t border-border/50">
                              <Button
                                variant="outline"
                                className="w-full h-12 rounded-xl justify-start gap-3"
                                onClick={() => navigate("/terms")}
                              >
                                <FileText className="w-5 h-5 text-muted-foreground" />
                                 <span>{t("terms_and_conditions")}</span>
                                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full h-12 rounded-xl justify-start gap-3"
                                onClick={() => navigate("/privacy")}
                              >
                                <ShieldAlert className="w-5 h-5 text-muted-foreground" />
                                 <span>{t("privacy_policy_label")}</span>
                                <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </SectionCard>

                  {/* Support Accordion */}
                  <SectionCard>
                    <CardContent className="p-0">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSection("support")}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors rounded-2xl text-left"
                      >
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                          <HelpCircle className="w-5 h-5 text-sky-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="font-semibold text-foreground">{t("support")}</p>
                           <p className="text-sm text-muted-foreground">{t("get_help_report_issues")}</p>
                        </div>
                        <motion.div animate={{ rotate: openSection === "support" ? 90 : 0 }} transition={{ duration: 0.2 }}>
                          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                        </motion.div>
                      </motion.button>
                      <AnimatePresence initial={false}>
                        {openSection === "support" && (
                          <motion.div
                            key="support-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-3 space-y-2 border-t border-border/50">
                              {/* WhatsApp */}
                              <a
                                href="https://wa.me/97412345678?text=Hi%2C%20I%20need%20help%20with%20Nutrio%20Fuel"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 w-full h-12 px-4 rounded-xl border border-border bg-transparent hover:bg-muted transition-colors text-sm font-medium"
                              >
                                <MessageCircle className="w-5 h-5 text-green-500 shrink-0" />
                                 <span className="flex-1 text-left">{t("chat_on_whatsapp")}</span>
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              </a>

                              {/* Email */}
                              <a
                                href="mailto:support@nutriofuel.com?subject=Support%20Request"
                                className="flex items-center gap-3 w-full h-12 px-4 rounded-xl border border-border bg-transparent hover:bg-muted transition-colors text-sm font-medium"
                              >
                                <Mail className="w-5 h-5 text-sky-500 shrink-0" />
                                 <span className="flex-1 text-left">{t("email_support")}</span>
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              </a>

                              {/* Phone */}
                              <a
                                href="tel:+97412345678"
                                className="flex items-center gap-3 w-full h-12 px-4 rounded-xl border border-border bg-transparent hover:bg-muted transition-colors text-sm font-medium"
                              >
                                <Phone className="w-5 h-5 text-violet-500 shrink-0" />
                                 <span className="flex-1 text-left">{t("call_us")}</span>
                                 <span className="text-xs text-muted-foreground">{t("phone_number")}</span>
                              </a>

                              {/* Submit a Ticket */}
                              <button
                                onClick={() => navigate("/support")}
                                className="flex items-center gap-3 w-full h-12 px-4 rounded-xl border border-border bg-transparent hover:bg-muted transition-colors text-sm font-medium"
                              >
                                <Ticket className="w-5 h-5 text-amber-500 shrink-0" />
                                 <span className="flex-1 text-left">{t("submit_a_ticket")}</span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </button>

                              {/* FAQ */}
                              <button
                                onClick={() => navigate("/faq")}
                                className="flex items-center gap-3 w-full h-12 px-4 rounded-xl border border-border bg-transparent hover:bg-muted transition-colors text-sm font-medium"
                              >
                                <BookOpen className="w-5 h-5 text-primary shrink-0" />
                                 <span className="flex-1 text-left">{t("view_faq")}</span>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </button>

                              {/* App version note */}
                               <p className="text-xs text-center text-muted-foreground pt-2">
                                 {t("support_hours")}
                               </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </SectionCard>
                </motion.div>
              )}

              {activeTab === "wallet" && (
                <motion.div
                  key="wallet"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Wallet Content */}
                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                         <h2 className="text-xl font-bold">{t("my_wallet")}</h2>
                         <p className="text-muted-foreground text-sm">{t("top_up_manage_balance")}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <Wallet className="h-6 w-6 text-green-600" />
                      </div>
                    </div>

                    {paymentStatus === 'success' && (
                      <Alert className="mb-4 bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                           <AlertDescription className="text-green-700">
                             {t("payment_successful")}
                           </AlertDescription>
                      </Alert>
                    )}

                    {paymentStatus === 'failed' && (
                      <Alert className="mb-4 bg-red-50 border-red-200" variant="destructive">
                        <XCircle className="h-4 w-4" />
                         <AlertDescription>
                           {t("payment_failed")}
                         </AlertDescription>
                      </Alert>
                    )}

                    <Alert className="mb-4 bg-amber-50 border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                         <AlertDescription className="text-amber-700">
                           {t("simulation_mode")}
                         </AlertDescription>
                    </Alert>

                    <div className="space-y-6">
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

                      <TransactionHistory
                        transactions={transactions}
                        loading={transactionsLoading}
                      />
                    </div>
                  </motion.div>

                  {/* Payment Confirmation Dialog */}
                  <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                    <DialogContent>
                      <DialogHeader>
                         <DialogTitle>{t("confirm_top_up")}</DialogTitle>
                         <DialogDescription>
                           {t("review_top_up_details")}
                         </DialogDescription>
                      </DialogHeader>

                      {selectedPackage && (
                        <div className="space-y-4">
                          <Card>
                            <CardContent className="p-4">
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                   <span className="text-muted-foreground">{t("package_label")}</span>
                                  <span className="font-medium">{selectedPackage.name}</span>
                                </div>
                                <div className="flex justify-between">
                                   <span className="text-muted-foreground">{t("top_up_amount")}</span>
                                  <span>{formatCurrency(selectedPackage.amount)}</span>
                                </div>
                                {selectedPackage.bonus_amount > 0 && (
                                  <div className="flex justify-between text-purple-600">
                                     <span>{t("bonus_credit")}</span>
                                    <span>+{formatCurrency(selectedPackage.bonus_amount)}</span>
                                  </div>
                                )}
                                <div className="border-t pt-2 flex justify-between font-semibold">
                                   <span>{t("total_credit")}</span>
                                  <span className="text-green-600">{formatCurrency(totalAmount)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          <p className="text-sm text-muted-foreground text-center">
                             {t("redirected_to_sadad")}
                          </p>
                        </div>
                      )}

                      <DialogFooter>
                           <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                             {t("cancel")}
                           </Button>
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
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Streak Rewards Widget */}
                  <motion.div variants={itemVariants}>
                    <StreakRewardsWidget />
                  </motion.div>

                  {/* Affiliate Earnings Widget - Only for approved affiliates */}
                  {isApprovedAffiliate && platformSettings.features.referral_program && (
                    <motion.div variants={itemVariants}>
                      <AffiliateEarningsWidget />
                    </motion.div>
                  )}


                  {/* Affiliate Program Card */}
                  {platformSettings.features.referral_program && (
                    <motion.div variants={itemVariants}>
                      <Card className="bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-background border-violet-500/20">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                              <CrownIcon className="h-6 w-6 text-violet-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                 <h3 className="font-semibold text-lg">{t("affiliate_program")}</h3>
                                 <Badge className="bg-violet-500 text-white">{t("earn_more")}</Badge>
                               </div>
                               <p className="text-sm text-muted-foreground mb-4">
                                 {t("become_affiliate")}
                               </p>
                              <Link to={isApprovedAffiliate ? "/affiliate" : "/profile"}>
                                <Button variant="outline" className="w-full border-violet-500/30 text-violet-600 hover:bg-violet-500/10">
                                  <TrendingUp className="h-4 w-4 mr-2" />
                                  {isApprovedAffiliate ? t("view_affiliate_dashboard") : t("apply_affiliate_program")}
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Rewards Info Cards */}
                  <motion.div variants={itemVariants}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                              <Flame className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                               <p className="font-medium">{t("daily_streaks")}</p>
                               <p className="text-xs text-muted-foreground">{t("order_daily_earn_bonuses")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Star className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                               <p className="font-medium">{t("wallet_bonuses")}</p>
                               <p className="text-xs text-muted-foreground">{t("get_bonus_credits")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </motion.div>
                </motion.div>
              )}
              {activeTab === "settings" && (
                <motion.div
                  key="settings"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Change Password */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                           <CardTitle className="text-lg">{t("change_password")}</CardTitle>
                           <p className="text-sm text-muted-foreground">{t("update_account_password")}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                         <Label className="text-sm font-medium">{t("new_password_label")}</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder={t("enter_new_password")}
                            className="h-12 rounded-xl pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {newPassword && (
                          <div className="flex gap-1 mt-2">
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
                      <div className="space-y-2">
                         <Label className="text-sm font-medium">{t("confirm_password")}</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t("confirm_new_password")}
                            className="h-12 rounded-xl"
                          />
                          <Shield
                            className={cn(
                              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors",
                              confirmPassword && newPassword === confirmPassword ? "text-green-500" : "text-muted-foreground"
                            )}
                          />
                        </div>
                      </div>
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          onClick={handlePasswordChange}
                          disabled={saving || !newPassword || !confirmPassword}
                          variant="outline"
                          className="w-full h-12 rounded-xl"
                        >
                           {saving ? (
                             <><Loader2 className="w-5 h-5 animate-spin mr-2" />{t("updating")}</>
                           ) : (
                             <><Lock className="w-5 h-5 mr-2" />{t("update_password_btn")}</>
                           )}
                        </Button>
                      </motion.div>
                    </CardContent>
                  </SectionCard>

                  {/* Notification Settings */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Bell className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{t("notification_settings")}</CardTitle>
                          <p className="text-sm text-muted-foreground">{t("choose_notifications")}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        { label: t("order_updates"), desc: t("status_changes_orders"), value: notifOrderUpdates, set: setNotifOrderUpdates },
                        { label: t("promotions_offers"), desc: t("discounts_special_deals"), value: notifPromotions, set: setNotifPromotions },
                        { label: t("new_meals_available"), desc: t("when_restaurants_add_items"), value: notifNewMeals, set: setNotifNewMeals },
                      ].map(({ label, desc, value, set }) => (
                        <div key={label} className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                          <Switch checked={value} onCheckedChange={set} />
                        </div>
                      ))}
                    </CardContent>
                  </SectionCard>

                  {/* Privacy Settings */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{t("privacy_settings")}</CardTitle>
                          <p className="text-sm text-muted-foreground">{t("control_data_usage")}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        { label: t("usage_analytics"), desc: t("help_improve_app"), value: privacyAnalytics, set: setPrivacyAnalytics },
                        { label: t("personalised_recommendations"), desc: t("tailor_meals_offers"), value: privacyPersonalised, set: setPrivacyPersonalised },
                      ].map(({ label, desc, value, set }) => (
                        <div key={label} className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{label}</p>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                          <Switch checked={value} onCheckedChange={set} />
                        </div>
                      ))}
                    </CardContent>
                  </SectionCard>

                  {/* Language Selection */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{t("language")}</CardTitle>
                          <p className="text-sm text-muted-foreground">{t("select_language")}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "ar")}>
                        <SelectTrigger className="h-12 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">🇬🇧 {t("english")}</SelectItem>
                          <SelectItem value="ar">🇶🇦 {t("arabic")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </SectionCard>

                  {/* Account Actions */}
                  <SectionCard className="border-destructive/20">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                          <Settings className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{t("account_actions")}</CardTitle>
                          <p className="text-sm text-muted-foreground">{t("manage_account_status")}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl justify-start gap-3 hover:bg-muted"
                          onClick={handleSignOut}
                        >
                          <LogOut className="w-5 h-5 text-muted-foreground" />
                          <span>{t("sign_out")}</span>
                        </Button>
                      </motion.div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                            <Button
                              variant="outline"
                              className="w-full h-12 rounded-xl justify-start gap-3 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                            >
                              <Trash2 className="w-5 h-5" />
                              <span>{t("delete_account")}</span>
                            </Button>
                          </motion.div>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                              <Trash2 className="w-6 h-6 text-destructive" />
                            </div>
                            <AlertDialogTitle className="text-center">{t("delete_account")}?</AlertDialogTitle>
                            <AlertDialogDescription className="text-center">
                              {t("delete_account_warning")}
                            </AlertDialogDescription>
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
                    </CardContent>
                  </SectionCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <CustomerNavigation />
    </div>
  );
};

export default Profile;
