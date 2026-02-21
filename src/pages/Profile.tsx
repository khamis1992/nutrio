import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Slider } from "@/components/ui/slider";

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
  Target,
  Utensils,
  Settings,
  ArrowLeft,
  Check,
  Loader2,
  Scale,
  Ruler,
  Activity,
  Flame,
  Beef,
  Wheat,
  Droplets,
  LogOut,
  Trash2,
  Lock,
  Mail,
  RefreshCw,
  Receipt,
  Crown,
  Wallet,
  FileText,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Calendar,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { AffiliateApplicationCard } from "@/components/AffiliateApplicationCard";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateNutritionTargets,
  activityLevelLabels,
  goalLabels,
  type Goal,
  type ActivityLevel,
  type Gender,
} from "@/lib/nutrition-calculator";
import { cn } from "@/lib/utils";

interface DietTag {
  id: string;
  name: string;
  description: string | null;
  category?: string;
}

type TabValue = "profile" | "targets" | "preferences" | "account";

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { value: "profile", label: "Profile", icon: User },
  { value: "targets", label: "Health Goals", icon: Target },
  { value: "preferences", label: "Diet", icon: Utensils },
  { value: "account", label: "Account", icon: Settings },
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



// Circular progress component
const CircularProgress = ({
  value,
  max,
  label,
  sublabel,
  color,
  icon: Icon,
}: {
  value: number;
  max: number;
  label: string;
  sublabel: string;
  color: string;
  icon: React.ElementType;
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/50"
          />
          <motion.circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className={color}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={cn("w-5 h-5", color.replace("text-", "text-"))} />
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-lg font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/60">{sublabel}</p>
      </div>
    </div>
  );
};

// Gender card component
const GenderCard = ({
  gender,
  selected,
  onClick,
}: {
  gender: Gender;
  selected: boolean;
  onClick: () => void;
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
            {gender}
          </p>
          <p className="text-sm text-muted-foreground">
            {isMale ? "He/Him" : "She/Her"}
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

// Goal card component
const GoalCard = ({
  goal,
  selected,
  onClick,
}: {
  goal: Goal;
  selected: boolean;
  onClick: () => void;
}) => {
  const icons = {
    lose: TrendingUp,
    maintain: Activity,
    gain: Sparkles,
  };
  const colors = {
    lose: "from-blue-500/20 to-cyan-500/20 text-blue-600",
    maintain: "from-green-500/20 to-emerald-500/20 text-green-600",
    gain: "from-amber-500/20 to-orange-500/20 text-amber-600",
  };
  const Icon = icons[goal];

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
        "border-2 text-left",
        selected
          ? "border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg shadow-primary/10"
          : "border-border bg-card hover:border-primary/30 hover:shadow-md"
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br",
          colors[goal]
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <p className="font-semibold text-foreground mb-1">
        {goalLabels[goal].title}
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {goalLabels[goal].description}
      </p>
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
          >
            <Check className="w-4 h-4 text-primary-foreground" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// Activity level card
const ActivityCard = ({
  level,
  selected,
  onClick,
}: {
  level: ActivityLevel;
  selected: boolean;
  onClick: () => void;
}) => {
  const intensityDots = {
    sedentary: 1,
    light: 2,
    moderate: 3,
    active: 4,
    very_active: 5,
  };

  return (
    <motion.button
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "relative w-full text-left p-4 rounded-xl transition-all duration-300",
        "border-2 flex items-center gap-4",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/20 hover:bg-muted/50"
      )}
    >
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i < intensityDots[level]
                ? selected
                  ? "bg-primary"
                  : "bg-primary/40"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
      <div className="flex-1">
        <p className={cn("font-medium", selected && "text-primary")}>
          {activityLevelLabels[level].title}
        </p>
        <p className="text-sm text-muted-foreground">
          {activityLevelLabels[level].description}
        </p>
      </div>
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            <Check className="w-5 h-5 text-primary" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// Diet tag component
const DietTagCard = ({
  tag,
  selected,
  onClick,
  color,
}: {
  tag: DietTag;
  selected: boolean;
  onClick: () => void;
  color: string;
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 transition-all duration-300 text-left",
        "border-2",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/20 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200 mt-0.5",
            selected ? "bg-primary" : "border-2 border-muted-foreground/30"
          )}
        >
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Check className="w-3 h-3 text-primary-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium text-sm", selected && "text-primary")}>
            {tag.name}
          </p>
          {tag.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {tag.description}
            </p>
          )}
        </div>
      </div>
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
          selected ? color : "bg-transparent"
        )}
      />
    </motion.button>
  );
};

// Animated number counter
const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-block"
    >
      {value}
      {suffix}
    </motion.span>
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
  const { toast } = useToast();

  // Profile tab state
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState("");

  // Targets tab state
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [height, setHeight] = useState("");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [healthGoal, setHealthGoal] = useState<Goal | null>(null);
  const [dailyCalories, setDailyCalories] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(150);
  const [carbsTarget, setCarbsTarget] = useState(200);
  const [fatTarget, setFatTarget] = useState(65);
  const [manualOverride, setManualOverride] = useState(false);

  // Preferences tab state
  const [dietTags, setDietTags] = useState<DietTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  // Account tab state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // General state
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("profile");

  // Load profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setGender(profile.gender);
      setAge(profile.age?.toString() || "");
      setCurrentWeight(profile.current_weight_kg?.toString() || "");
      setTargetWeight(profile.target_weight_kg?.toString() || "");
      setHeight(profile.height_cm?.toString() || "");
      setActivityLevel(profile.activity_level);
      setHealthGoal(profile.health_goal);
      setDailyCalories(profile.daily_calorie_target || 2000);
      setProteinTarget(profile.protein_target_g || 150);
      setCarbsTarget(profile.carbs_target_g || 200);
      setFatTarget(profile.fat_target_g || 65);
    }
  }, [profile]);

  // Fetch diet tags and user preferences
  useEffect(() => {
    const fetchDietTagsAndPreferences = async () => {
      try {
        const { data: tags, error: tagsError } = await supabase
          .from("diet_tags")
          .select("*")
          .order("name");

        if (tagsError) throw tagsError;
        setDietTags(tags || []);

        if (user) {
          const { data: prefs, error: prefsError } = await supabase
            .from("user_dietary_preferences")
            .select("diet_tag_id")
            .eq("user_id", user.id);

          if (prefsError) throw prefsError;
          setSelectedTags(prefs?.map((p) => p.diet_tag_id) || []);
        }
      } catch (err) {
        console.error("Error fetching diet tags:", err);
      } finally {
        setTagsLoading(false);
      }
    };

    fetchDietTagsAndPreferences();
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

  const recalculateTargets = () => {
    if (!gender || !activityLevel || !healthGoal || !currentWeight || !height || !age) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields to recalculate targets.",
        variant: "destructive",
      });
      return;
    }

    const targets = calculateNutritionTargets(
      gender,
      parseFloat(currentWeight),
      parseFloat(height),
      parseInt(age),
      activityLevel,
      healthGoal
    );

    setDailyCalories(targets.dailyCalories);
    setProteinTarget(targets.protein);
    setCarbsTarget(targets.carbs);
    setFatTarget(targets.fat);
    setManualOverride(false);

    toast({
      title: "Targets recalculated",
      description: `New daily target: ${targets.dailyCalories} cal`,
    });
  };

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
        title: "Profile updated",
        description: "Your personal information has been saved.",
      });
    } catch (err) {
      toast({
        title: "Error saving profile",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveTargetsTab = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({
        current_weight_kg: currentWeight ? parseFloat(currentWeight) : null,
        target_weight_kg: targetWeight ? parseFloat(targetWeight) : null,
        height_cm: height ? parseFloat(height) : null,
        activity_level: activityLevel,
        health_goal: healthGoal,
        daily_calorie_target: dailyCalories,
        protein_target_g: proteinTarget,
        carbs_target_g: carbsTarget,
        fat_target_g: fatTarget,
      });

      if (error) throw error;

      toast({
        title: "Targets updated",
        description: "Your nutrition targets have been saved.",
      });
    } catch (err) {
      toast({
        title: "Error saving targets",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDietPreference = async (tagId: string) => {
    if (!user) return;

    const isSelected = selectedTags.includes(tagId);

    try {
      if (isSelected) {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);

        if (error) throw error;
        setSelectedTags((prev) => prev.filter((id) => id !== tagId));
      } else {
        const { error } = await supabase
          .from("user_dietary_preferences")
          .insert({ user_id: user.id, diet_tag_id: tagId });

        if (error) throw error;
        setSelectedTags((prev) => [...prev, tagId]);
      }
    } catch (err) {
      toast({
        title: "Error updating preferences",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
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
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (err) {
      toast({
        title: "Error updating password",
        description: "Please try again.",
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
      title: "Contact support",
      description: "Please contact support to delete your account.",
    });
  };

  // Get tag colors based on category
  const getTagColor = (index: number) => {
    const colors = [
      "bg-green-500",
      "bg-emerald-500",
      "bg-teal-500",
      "bg-cyan-500",
      "bg-sky-500",
      "bg-blue-500",
      "bg-indigo-500",
      "bg-violet-500",
    ];
    return colors[index % colors.length];
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
          <p className="text-muted-foreground animate-pulse">Loading profile...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-lg font-bold">Profile & Settings</h1>
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
              {/* Avatar with gradient ring */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="relative"
              >
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary via-accent to-primary blur-sm opacity-70" />
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-4xl text-primary-foreground font-bold shadow-xl">
                  {fullName
                    ? fullName.charAt(0).toUpperCase()
                    : user?.email?.charAt(0).toUpperCase()}
                </div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                </motion.div>
              </motion.div>

              {/* User info */}
              <div className="flex-1 text-center sm:text-left">
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl sm:text-3xl font-bold mb-1"
                >
                  {fullName || "Your Name"}
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
                    <span>Free Plan</span>
                  </div>
                  {profile?.created_at && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm">
                      <Calendar className="w-4 h-4" />
                      <span>Joined {formatDate(profile.created_at)}</span>
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
                    <span className="font-medium">{item.label}</span>
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
                    {item.label}
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

                  {/* Personal Information */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Personal Information</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Update your basic profile details
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Full Name */}
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="text-sm font-medium">
                          Full Name
                        </Label>
                        <div className="relative">
                          <Input
                            id="fullName"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Enter your full name"
                            className="h-12 rounded-xl border-border focus:border-primary focus:ring-primary/20"
                          />
                          <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>

                      {/* Gender Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Gender</Label>
                        <div className="grid grid-cols-2 gap-4">
                          {(["male", "female"] as Gender[]).map((g) => (
                            <GenderCard
                              key={g}
                              gender={g}
                              selected={gender === g}
                              onClick={() => setGender(g)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Age */}
                      <div className="space-y-2">
                        <Label htmlFor="age" className="text-sm font-medium">
                          Age
                        </Label>
                        <div className="relative">
                          <Input
                            id="age"
                            type="number"
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            placeholder="25"
                            min={13}
                            max={120}
                            className="h-12 rounded-xl border-border focus:border-primary focus:ring-primary/20"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            years
                          </span>
                        </div>
                      </div>

                      {/* Save Button */}
                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          onClick={saveProfileTab}
                          disabled={saving}
                          className="w-full h-12 rounded-xl text-base font-medium"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="w-5 h-5 mr-2" />
                              Save Changes
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </CardContent>
                  </SectionCard>
                </motion.div>
              )}

              {activeTab === "targets" && (
                <motion.div
                  key="targets"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Health Profile Summary */}
                  {(currentWeight || height || age) && (
                    <motion.div
                      variants={itemVariants}
                      className="bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 rounded-2xl p-6 border border-primary/20"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">Health Profile</h3>
                          <p className="text-sm text-muted-foreground">
                            Based on your current metrics
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {currentWeight && (
                          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-2xl font-bold text-foreground">
                              {currentWeight}
                            </p>
                            <p className="text-xs text-muted-foreground">kg current</p>
                          </div>
                        )}
                        {targetWeight && (
                          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-2xl font-bold text-foreground">
                              {targetWeight}
                            </p>
                            <p className="text-xs text-muted-foreground">kg target</p>
                          </div>
                        )}
                        {height && (
                          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-2xl font-bold text-foreground">
                              {height}
                            </p>
                            <p className="text-xs text-muted-foreground">cm height</p>
                          </div>
                        )}
                        {age && (
                          <div className="bg-card/50 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-2xl font-bold text-foreground">{age}</p>
                            <p className="text-xs text-muted-foreground">years old</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Body Metrics */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Scale className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Body Metrics</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Used to calculate your nutrition targets
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Current Weight (kg)</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={currentWeight}
                              onChange={(e) => setCurrentWeight(e.target.value)}
                              placeholder="75"
                              className="h-12 rounded-xl"
                            />
                            <Scale className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Target Weight (kg)</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={targetWeight}
                              onChange={(e) => setTargetWeight(e.target.value)}
                              placeholder="70"
                              className="h-12 rounded-xl"
                            />
                            <Target className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Height (cm)</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            placeholder="175"
                            className="h-12 rounded-xl"
                          />
                          <Ruler className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </SectionCard>

                  {/* Health Goal */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Health Goal</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            What do you want to achieve?
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(Object.keys(goalLabels) as Goal[]).map((g) => (
                          <GoalCard
                            key={g}
                            goal={g}
                            selected={healthGoal === g}
                            onClick={() => setHealthGoal(g)}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </SectionCard>

                  {/* Activity Level */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Activity Level</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            How active are you on a typical week?
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {(Object.keys(activityLevelLabels) as ActivityLevel[]).map((a) => (
                        <ActivityCard
                          key={a}
                          level={a}
                          selected={activityLevel === a}
                          onClick={() => setActivityLevel(a)}
                        />
                      ))}
                    </CardContent>
                  </SectionCard>

                  {/* Nutrition Targets */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                            <Flame className="w-5 h-5 text-orange-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Nutrition Targets</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              Your daily nutrition goals
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={recalculateTargets}
                          disabled={!gender || !activityLevel || !healthGoal}
                          className="rounded-lg"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Recalculate
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Circular Progress Indicators */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-4">
                        <CircularProgress
                          value={dailyCalories}
                          max={4000}
                          label="Calories"
                          sublabel="daily target"
                          color="text-orange-500"
                          icon={Flame}
                        />
                        <CircularProgress
                          value={proteinTarget}
                          max={300}
                          label="Protein"
                          sublabel="grams/day"
                          color="text-red-500"
                          icon={Beef}
                        />
                        <CircularProgress
                          value={carbsTarget}
                          max={400}
                          label="Carbs"
                          sublabel="grams/day"
                          color="text-amber-500"
                          icon={Wheat}
                        />
                        <CircularProgress
                          value={fatTarget}
                          max={150}
                          label="Fat"
                          sublabel="grams/day"
                          color="text-cyan-500"
                          icon={Droplets}
                        />
                      </div>

                      {/* Sliders */}
                      <div className="space-y-6 pt-4 border-t border-border">
                        {/* Calories Slider */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Flame className="w-5 h-5 text-orange-500" />
                              <Label className="font-medium">Daily Calories</Label>
                            </div>
                            <span className="text-lg font-bold text-orange-500">
                              <AnimatedNumber value={dailyCalories} /> cal
                            </span>
                          </div>
                          <Slider
                            value={[dailyCalories]}
                            onValueChange={([v]) => {
                              setDailyCalories(v);
                              setManualOverride(true);
                            }}
                            min={1200}
                            max={4000}
                            step={50}
                            className="cursor-pointer"
                          />
                        </div>

                        {/* Protein Slider */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Beef className="w-5 h-5 text-red-500" />
                              <Label className="font-medium">Protein</Label>
                            </div>
                            <span className="text-lg font-bold text-red-500">
                              <AnimatedNumber value={proteinTarget} />g
                            </span>
                          </div>
                          <Slider
                            value={[proteinTarget]}
                            onValueChange={([v]) => {
                              setProteinTarget(v);
                              setManualOverride(true);
                            }}
                            min={50}
                            max={300}
                            step={5}
                            className="cursor-pointer"
                          />
                        </div>

                        {/* Carbs Slider */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Wheat className="w-5 h-5 text-amber-500" />
                              <Label className="font-medium">Carbohydrates</Label>
                            </div>
                            <span className="text-lg font-bold text-amber-500">
                              <AnimatedNumber value={carbsTarget} />g
                            </span>
                          </div>
                          <Slider
                            value={[carbsTarget]}
                            onValueChange={([v]) => {
                              setCarbsTarget(v);
                              setManualOverride(true);
                            }}
                            min={50}
                            max={400}
                            step={5}
                            className="cursor-pointer"
                          />
                        </div>

                        {/* Fat Slider */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Droplets className="w-5 h-5 text-cyan-500" />
                              <Label className="font-medium">Fat</Label>
                            </div>
                            <span className="text-lg font-bold text-cyan-500">
                              <AnimatedNumber value={fatTarget} />g
                            </span>
                          </div>
                          <Slider
                            value={[fatTarget]}
                            onValueChange={([v]) => {
                              setFatTarget(v);
                              setManualOverride(true);
                            }}
                            min={20}
                            max={150}
                            step={5}
                            className="cursor-pointer"
                          />
                        </div>
                      </div>

                      {manualOverride && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-muted-foreground text-center bg-muted/50 rounded-lg py-2"
                        >
                          Manual values set. Click "Recalculate" to reset based on your profile.
                        </motion.p>
                      )}

                      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                        <Button
                          onClick={saveTargetsTab}
                          disabled={saving}
                          className="w-full h-12 rounded-xl text-base font-medium"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="w-5 h-5 mr-2" />
                              Save Targets
                            </>
                          )}
                        </Button>
                      </motion.div>
                    </CardContent>
                  </SectionCard>
                </motion.div>
              )}

              {activeTab === "preferences" && (
                <motion.div
                  key="preferences"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                          <Utensils className="w-5 h-5 text-teal-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Dietary Preferences</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Select the diets and preferences that match your lifestyle
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {tagsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                      ) : dietTags.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <Utensils className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <p className="text-muted-foreground">
                            No dietary preferences available yet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {dietTags.map((tag, index) => (
                            <DietTagCard
                              key={tag.id}
                              tag={tag}
                              selected={selectedTags.includes(tag.id)}
                              onClick={() => toggleDietPreference(tag.id)}
                              color={getTagColor(index)}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </SectionCard>

                  {/* Info Card */}
                  <motion.div
                    variants={itemVariants}
                    className="bg-gradient-to-br from-teal-500/10 to-cyan-500/5 rounded-2xl p-6 border border-teal-500/20"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-6 h-6 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">Personalized Recommendations</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Your selected preferences will be used to recommend meals that match
                          your diet. We&apos;ll prioritize recipes that fit your lifestyle and
                          nutritional goals.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === "account" && (
                <motion.div
                  key="account"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  {/* Quick Links */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        to: "/subscription",
                        icon: Crown,
                        title: "Subscription Plans",
                        desc: "Manage your plan & billing",
                        color: "amber",
                      },
                      {
                        to: "/wallet",
                        icon: Wallet,
                        title: "Wallet",
                        desc: "Top-up & manage balance",
                        color: "green",
                      },
                      {
                        to: "/invoices",
                        icon: FileText,
                        title: "Invoice History",
                        desc: "View & download invoices",
                        color: "blue",
                      },
                      {
                        to: "/orders",
                        icon: Receipt,
                        title: "Order History",
                        desc: "View past orders & reorder",
                        color: "orange",
                      },
                    ].map((item) => {
                      const Icon = item.icon;
                      const colorClasses: Record<string, string> = {
                        amber: "bg-amber-500/10 text-amber-500",
                        green: "bg-green-500/10 text-green-500",
                        blue: "bg-blue-500/10 text-blue-500",
                        orange: "bg-orange-500/10 text-orange-500",
                      };
                      return (
                        <motion.div
                          key={item.to}
                          variants={itemVariants}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Link to={item.to}>
                            <Card className="cursor-pointer hover:shadow-md transition-all duration-300 border-border hover:border-primary/20">
                              <CardContent className="p-4 flex items-center gap-4">
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                    colorClasses[item.color]
                                  )}
                                >
                                  <Icon className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold">{item.title}</p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {item.desc}
                                  </p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                              </CardContent>
                            </Card>
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Email Display */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Email Address</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Your account email cannot be changed
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <p className="font-medium">{user?.email}</p>
                      </div>
                    </CardContent>
                  </SectionCard>

                  {/* Password Change */}
                  <SectionCard>
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                          <Lock className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Change Password</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Update your account password
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">New Password</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="h-12 rounded-xl pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="w-5 h-5" />
                            ) : (
                              <Eye className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                        {/* Password Strength */}
                        {newPassword && (
                          <div className="flex gap-1 mt-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "h-1 flex-1 rounded-full transition-all duration-300",
                                  i < passwordStrength
                                    ? passwordStrength >= 3
                                      ? "bg-green-500"
                                      : passwordStrength >= 2
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                    : "bg-muted"
                                )}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Confirm Password</Label>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="h-12 rounded-xl"
                          />
                          <Shield
                            className={cn(
                              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors",
                              confirmPassword && newPassword === confirmPassword
                                ? "text-green-500"
                                : "text-muted-foreground"
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
                            <>
                              <Loader2 className="w-5 h-5 animate-spin mr-2" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <Lock className="w-5 h-5 mr-2" />
                              Update Password
                            </>
                          )}
                        </Button>
                      </motion.div>
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
                          <CardTitle className="text-lg">Account Actions</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Manage your account status
                          </p>
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
                          <span>Sign Out</span>
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
                              <span>Delete Account</span>
                            </Button>
                          </motion.div>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl">
                          <AlertDialogHeader>
                            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                              <Trash2 className="w-6 h-6 text-destructive" />
                            </div>
                            <AlertDialogTitle className="text-center">
                              Delete Account?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-center">
                              This action cannot be undone. All your data including meal
                              schedules, progress logs, and preferences will be permanently
                              deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="rounded-xl h-11">
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteAccount}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-11"
                            >
                              Delete Account
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
