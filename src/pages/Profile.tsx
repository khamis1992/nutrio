import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
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

interface DietTag {
  id: string;
  name: string;
  description: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading, updateProfile, refetch } = useProfile();
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // General state
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

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
        // Fetch all diet tags
        const { data: tags, error: tagsError } = await supabase
          .from("diet_tags")
          .select("*")
          .order("name");

        if (tagsError) throw tagsError;
        setDietTags(tags || []);

        // Fetch user's preferences
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
      description: `New daily target: ${targets.dailyCalories} kcal`,
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
        // Remove preference
        const { error } = await supabase
          .from("user_dietary_preferences")
          .delete()
          .eq("user_id", user.id)
          .eq("diet_tag_id", tagId);

        if (error) throw error;
        setSelectedTags((prev) => prev.filter((id) => id !== tagId));
      } else {
        // Add preference
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

      setCurrentPassword("");
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
    // Note: Account deletion typically requires backend implementation
    toast({
      title: "Contact support",
      description: "Please contact support to delete your account.",
    });
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Profile & Settings</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 pb-24">
        {/* Profile Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-3xl text-primary-foreground font-bold">
            {fullName ? fullName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{fullName || "Your Name"}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 sm:grid-cols-4 w-full">
            <TabsTrigger value="profile" className="text-xs sm:text-sm">
              <User className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="targets" className="text-xs sm:text-sm">
              <Target className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Targets</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="text-xs sm:text-sm">
              <Utensils className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Diet</span>
            </TabsTrigger>
            <TabsTrigger value="account" className="text-xs sm:text-sm">
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            {/* Affiliate Application Card */}
            <AffiliateApplicationCard />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                    {(["male", "female"] as Gender[]).map((g) => (
                      <Card
                        key={g}
                        variant="interactive"
                        className={`cursor-pointer ${
                          gender === g ? "border-2 border-primary" : ""
                        }`}
                        onClick={() => setGender(g)}
                      >
                        <CardContent className="p-4 text-center">
                          <User className="w-6 h-6 mx-auto mb-2 text-primary" />
                          <p className="font-medium capitalize">{g}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="25"
                    min={13}
                    max={120}
                  />
                </div>

                <Button onClick={saveProfileTab} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Targets Tab */}
          <TabsContent value="targets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="w-5 h-5" />
                  Body Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentWeight">Current Weight (kg)</Label>
                    <Input
                      id="currentWeight"
                      type="number"
                      value={currentWeight}
                      onChange={(e) => setCurrentWeight(e.target.value)}
                      placeholder="75"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="targetWeight">Target Weight (kg)</Label>
                    <Input
                      id="targetWeight"
                      type="number"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(e.target.value)}
                      placeholder="70"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="175"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Health Goal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(goalLabels) as Goal[]).map((g) => (
                  <Card
                    key={g}
                    variant="interactive"
                    className={`cursor-pointer ${
                      healthGoal === g ? "border-2 border-primary" : ""
                    }`}
                    onClick={() => setHealthGoal(g)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{goalLabels[g].title}</p>
                        <p className="text-xs text-muted-foreground">
                          {goalLabels[g].description}
                        </p>
                      </div>
                      {healthGoal === g && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Activity Level
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(Object.keys(activityLevelLabels) as ActivityLevel[]).map((a) => (
                  <Card
                    key={a}
                    variant="interactive"
                    className={`cursor-pointer ${
                      activityLevel === a ? "border-2 border-primary" : ""
                    }`}
                    onClick={() => setActivityLevel(a)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{activityLevelLabels[a].title}</p>
                        <p className="text-xs text-muted-foreground">
                          {activityLevelLabels[a].description}
                        </p>
                      </div>
                      {activityLevel === a && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Flame className="w-5 h-5" />
                    Nutrition Targets
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={recalculateTargets}
                    disabled={!gender || !activityLevel || !healthGoal}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Recalculate
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-destructive" />
                      Daily Calories
                    </Label>
                    <span className="font-bold">{dailyCalories} kcal</span>
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
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Beef className="w-4 h-4 text-destructive" />
                      Protein
                    </Label>
                    <span className="font-bold">{proteinTarget}g</span>
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
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Wheat className="w-4 h-4 text-warning" />
                      Carbohydrates
                    </Label>
                    <span className="font-bold">{carbsTarget}g</span>
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
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-accent" />
                      Fat
                    </Label>
                    <span className="font-bold">{fatTarget}g</span>
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
                  />
                </div>

                {manualOverride && (
                  <p className="text-xs text-muted-foreground text-center">
                    Manual values set. Click "Recalculate" to reset based on your profile.
                  </p>
                )}

                <Button onClick={saveTargetsTab} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Targets
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dietary Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                {tagsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : dietTags.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No dietary preferences available yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {dietTags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.id);
                      return (
                        <Card
                          key={tag.id}
                          variant="interactive"
                          className={`cursor-pointer ${
                            isSelected ? "border-2 border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => toggleDietPreference(tag.id)}
                        >
                          <CardContent className="p-4 flex items-center gap-3">
                            <Checkbox checked={isSelected} />
                            <div>
                              <p className="font-medium text-sm">{tag.name}</p>
                              {tag.description && (
                                <p className="text-xs text-muted-foreground">
                                  {tag.description}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-muted-foreground">
                <Utensils className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  Your selected preferences will be used to recommend meals that match your diet.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-4">
            <Link to="/subscription">
              <Card variant="interactive">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Subscription Plans</p>
                      <p className="text-sm text-muted-foreground">Manage your plan & billing</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/wallet">
              <Card variant="interactive">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Wallet</p>
                      <p className="text-sm text-muted-foreground">Top-up & manage balance</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/invoices">
              <Card variant="interactive">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold">Invoice History</p>
                      <p className="text-sm text-muted-foreground">View & download invoices</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                </CardContent>
              </Card>
            </Link>

            <Link to="/orders">
              <Card variant="interactive">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="font-semibold">Order History</p>
                      <p className="text-sm text-muted-foreground">View past orders & reorder</p>
                    </div>
                  </div>
                  <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180" />
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{user?.email}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Change Password
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  onClick={handlePasswordChange}
                  disabled={saving || !newPassword || !confirmPassword}
                  variant="outline"
                  className="w-full"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Update Password
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Account
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. All your data including meal schedules,
                        progress logs, and preferences will be permanently deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Account
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <CustomerNavigation />
    </div>
  );
};

export default Profile;
