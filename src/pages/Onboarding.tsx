import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target,
  Dumbbell,
  Scale,
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  Ruler,
  Activity,
  Loader2,
  Utensils,
  Leaf,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useDietTags } from "@/hooks/useDietTags";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { OnboardingRecoveryDialog } from "@/components/OnboardingRecoveryDialog";
import { debounce } from "@/lib/debounce";

type Goal = "lose" | "gain" | "maintain";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Gender = "male" | "female";
type MetricsSubStep = "basic" | "targets";

interface OnboardingData {
  goal: Goal | null;
  gender: Gender | null;
  age: string;
  height: string;
  weight: string;
  targetWeight: string;
  activityLevel: ActivityLevel | null;
  trainingDaysPerWeek: string;
  foodPreferences: string[];
  allergies: string[];
}

// Calculate BMR using Mifflin-St Jeor equation
const calculateBMR = (gender: Gender, weight: number, height: number, age: number): number => {
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
};

// Calculate TDEE based on activity level
const calculateTDEE = (bmr: number, activityLevel: ActivityLevel): number => {
  const multipliers: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round(bmr * multipliers[activityLevel]);
};

// Adjust calories based on goal
const calculateTargetCalories = (tdee: number, goal: Goal): number => {
  switch (goal) {
    case "lose":
      return Math.round(tdee * 0.8); // 20% deficit
    case "gain":
      return Math.round(tdee * 1.15); // 15% surplus
    case "maintain":
    default:
      return tdee;
  }
};

// Calculate macro targets
const calculateMacros = (calories: number, goal: Goal) => {
  let proteinRatio: number, carbsRatio: number, fatRatio: number;
  
  switch (goal) {
    case "lose":
      proteinRatio = 0.35;
      carbsRatio = 0.35;
      fatRatio = 0.30;
      break;
    case "gain":
      proteinRatio = 0.30;
      carbsRatio = 0.45;
      fatRatio = 0.25;
      break;
    case "maintain":
    default:
      proteinRatio = 0.30;
      carbsRatio = 0.40;
      fatRatio = 0.30;
  }

  return {
    protein: Math.round((calories * proteinRatio) / 4), // 4 cal per gram
    carbs: Math.round((calories * carbsRatio) / 4), // 4 cal per gram
    fat: Math.round((calories * fatRatio) / 9), // 9 cal per gram
  };
};

const ONBOARDING_STORAGE_KEY = 'nutrio_onboarding_progress';
const AUTOSAVE_KEY = 'nutrio_onboarding_draft';

const ONBOARDING_STEPS = [
  { id: 'goal', label: 'Your Goal', icon: Target },
  { id: 'gender', label: 'Gender', icon: User },
  { id: 'metrics', label: 'Body Metrics', icon: Scale },
  { id: 'activity', label: 'Activity Level', icon: Activity },
  { id: 'diet', label: 'Dietary Preferences', icon: Utensils },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const { dietTags, allergyTags, loading: dietTagsLoading } = useDietTags();
  
  const [step, setStep] = useState(1);
  const [metricsSubStep, setMetricsSubStep] = useState<MetricsSubStep>("basic");
  const [saving, setSaving] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [draftData, setDraftData] = useState<{ data: OnboardingData; step: number; savedAt: string } | null>(null);
  const [data, setData] = useState<OnboardingData>({
    goal: null,
    gender: null,
    age: "",
    height: "",
    weight: "",
    targetWeight: "",
    activityLevel: null,
    trainingDaysPerWeek: "",
    foodPreferences: [],
    allergies: [],
  });

  const totalSteps = 5;
  const progressPercent = Math.round((step / totalSteps) * 100);

  // Load saved progress from localStorage on mount
  useEffect(() => {
    const savedProgress = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        if (parsed.data) {
          setData(parsed.data);
        }
        if (parsed.step && parsed.step > 1 && parsed.step <= totalSteps) {
          setStep(parsed.step);
          toast({
            title: "Welcome back!",
            description: `Continuing from where you left off (Step ${parsed.step} of ${totalSteps})`,
          });
        }
      } catch (e) {
        console.error('Failed to parse saved onboarding progress:', e);
      }
    }
  }, []);

  // Save progress to localStorage whenever data or step changes
  useEffect(() => {
    if (step < totalSteps) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
        step,
        data,
        timestamp: new Date().toISOString(),
      }));
    }
  }, [step, data]);

  // Clear saved progress when onboarding is completed
  const clearSavedProgress = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    localStorage.removeItem(AUTOSAVE_KEY);
  };

  // Auto-save draft with debounce
  const saveDraft = useCallback(
    debounce((currentData: OnboardingData, currentStep: number) => {
      localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          data: currentData,
          step: currentStep,
          savedAt: new Date().toISOString(),
        })
      );
    }, 500),
    []
  );

  // Trigger auto-save whenever data or step changes
  useEffect(() => {
    if (step < totalSteps) {
      saveDraft(data, step);
    }
  }, [step, data, saveDraft]);

  // Load draft on mount and show recovery dialog if less than 24 hours old
  useEffect(() => {
    const draft = localStorage.getItem(AUTOSAVE_KEY);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        const hoursSinceSave = (Date.now() - new Date(parsed.savedAt).getTime()) / (1000 * 60 * 60);

        if (hoursSinceSave < 24 && parsed.step > 1) {
          setDraftData(parsed);
          setShowRecoveryDialog(true);
        }
      } catch (e) {
        console.error("Failed to parse onboarding draft:", e);
      }
    }
  }, []);

  const handleRecoveryContinue = () => {
    if (draftData) {
      setData(draftData.data);
      setStep(draftData.step);
      setShowRecoveryDialog(false);
    }
  };

  const handleRecoveryStartFresh = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
    setShowRecoveryDialog(false);
  };

  const handleSkip = async () => {
    // Save minimal profile data
    const { error } = await updateProfile({
      onboarding_completed: true,
      full_name: user?.user_metadata?.full_name || null,
    });

    if (!error) {
      clearSavedProgress();
      toast({
        title: "Onboarding skipped",
        description: "You can complete your profile anytime in Settings",
      });
      navigate("/dashboard");
    } else {
      toast({
        title: "Error skipping onboarding",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Redirect if not authenticated or if user is a partner
  useEffect(() => {
    const checkUserType = async () => {
      if (authLoading) return;
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has a restaurant (is a partner)
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      
      if (restaurant) {
        // Partners don't need customer onboarding
        navigate("/partner");
        return;
      }
    };

    checkUserType();
  }, [user, authLoading, navigate]);

  // Redirect if onboarding already completed
  useEffect(() => {
    if (profile?.onboarding_completed) {
      navigate("/dashboard");
    }
  }, [profile, navigate]);

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Complete onboarding and save to database
      await completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    if (!data.goal || !data.gender || !data.activityLevel) return;

    setSaving(true);
    try {
      const age = parseInt(data.age);
      const height = parseFloat(data.height);
      const weight = parseFloat(data.weight);
      const targetWeight = parseFloat(data.targetWeight) || weight;

      // Calculate nutrition targets
      const bmr = calculateBMR(data.gender, weight, height, age);
      const tdee = calculateTDEE(bmr, data.activityLevel);
      const dailyCalories = calculateTargetCalories(tdee, data.goal);
      const macros = calculateMacros(dailyCalories, data.goal);

      const { error } = await updateProfile({
        gender: data.gender,
        age,
        height_cm: height,
        current_weight_kg: weight,
        target_weight_kg: targetWeight,
        health_goal: data.goal,
        activity_level: data.activityLevel,
        daily_calorie_target: dailyCalories,
        protein_target_g: macros.protein,
        carbs_target_g: macros.carbs,
        fat_target_g: macros.fat,
        // Note: food_preferences, allergies, and training_days are stored in local state
        // but not in the profile table as those columns don't exist
        onboarding_completed: true,
      });

      if (error) throw error;

      // Clear saved progress on successful completion
      clearSavedProgress();

      toast({
        title: "Profile saved!",
        description: `Your daily target is ${dailyCalories} calories.`,
      });
      
      navigate("/dashboard");
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

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return data.goal !== null;
      case 2:
        return data.gender !== null;
      case 3:
        return data.age && data.height && data.weight;
      case 4:
        return data.activityLevel !== null;
      case 5:
        return true; // Food preferences and allergies are optional
      default:
        return false;
    }
  };

  const goals = [
    { 
      id: "lose" as Goal, 
      icon: Scale, 
      title: "Lose Weight", 
      description: "Reduce body fat while maintaining muscle",
      color: "text-destructive"
    },
    { 
      id: "gain" as Goal, 
      icon: Dumbbell, 
      title: "Build Muscle", 
      description: "Gain lean muscle mass with proper nutrition",
      color: "text-primary"
    },
    { 
      id: "maintain" as Goal, 
      icon: Target, 
      title: "Maintain", 
      description: "Keep your current weight and improve health",
      color: "text-accent"
    },
  ];

  const activityLevels = [
    { id: "sedentary" as ActivityLevel, title: "Sedentary", description: "Little or no exercise" },
    { id: "light" as ActivityLevel, title: "Lightly Active", description: "Light exercise 1-3 days/week" },
    { id: "moderate" as ActivityLevel, title: "Moderately Active", description: "Moderate exercise 3-5 days/week" },
    { id: "active" as ActivityLevel, title: "Very Active", description: "Hard exercise 6-7 days/week" },
    { id: "very_active" as ActivityLevel, title: "Extra Active", description: "Very hard exercise & physical job" },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Header */}
      <header className="p-4">
        <div className="container mx-auto flex items-center justify-between">
          <Logo size="md" />
          <Badge variant="soft">Step {step} of {totalSteps}</Badge>
        </div>
      </header>

      {/* Progress Bar with Percentage */}
      <div className="container mx-auto px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Step {step} of {totalSteps}</span>
          <span className="text-sm font-medium text-primary">{progressPercent}% Complete</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex justify-between mt-4">
          {ONBOARDING_STEPS.map((stepInfo, idx) => {
            const StepIcon = stepInfo.icon;
            return (
              <div key={stepInfo.id} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  idx < step ? "bg-primary text-primary-foreground" :
                  idx === step - 1 ? "bg-primary/20 text-primary border-2 border-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {idx < step ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <span className="text-xs mt-1 hidden sm:block">{stepInfo.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content - Native Mobile Centered Design */}
      <main className="flex-1 container mx-auto px-4 py-4 flex items-center justify-center overflow-y-auto">
        <div className="w-full max-w-md animate-fade-in" key={step}>
          {/* Step 1: Goal Selection */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  What's your <span className="text-gradient">main goal</span>?
                </h1>
                <p className="text-muted-foreground">
                  This helps us create a personalized nutrition plan for you
                </p>
              </div>

              <div className="grid gap-4">
                {goals.map((goal) => (
                  <Card
                    key={goal.id}
                    variant="interactive"
                    className={`cursor-pointer transition-all ${
                      data.goal === goal.id 
                        ? "border-2 border-primary shadow-glow" 
                        : ""
                    }`}
                    onClick={() => setData({ ...data, goal: goal.id })}
                  >
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center ${goal.color}`}>
                        <goal.icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{goal.title}</h3>
                        <p className="text-sm text-muted-foreground">{goal.description}</p>
                      </div>
                      {data.goal === goal.id && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-5 h-5 text-primary-foreground" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Gender Selection */}
          {step === 2 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Tell us about <span className="text-gradient">yourself</span>
                </h1>
                <p className="text-muted-foreground">
                  We'll use this to calculate your daily calorie needs
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "male" as Gender, icon: User, title: "Male" },
                  { id: "female" as Gender, icon: User, title: "Female" },
                ].map((option) => (
                  <Card
                    key={option.id}
                    variant="interactive"
                    className={`cursor-pointer transition-all ${
                      data.gender === option.id 
                        ? "border-2 border-primary shadow-glow" 
                        : ""
                    }`}
                    onClick={() => setData({ ...data, gender: option.id })}
                  >
                    <CardContent className="p-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <option.icon className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{option.title}</h3>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Body Metrics - Split into sub-steps */}
          {step === 3 && (
            <div className="space-y-8">
              {metricsSubStep === 'basic' && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-3">
                      Let's get to know you
                    </h1>
                    <p className="text-muted-foreground">
                      We'll calculate your ideal calorie and macro targets
                    </p>
                  </div>

                  <Card variant="elevated">
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="age" className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            Age
                          </Label>
                          <Input
                            id="age"
                            type="number"
                            placeholder="25"
                            value={data.age}
                            onChange={(e) => setData({ ...data, age: e.target.value })}
                            className="h-12"
                            min={13}
                            max={120}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="height" className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-muted-foreground" />
                            Height (cm)
                          </Label>
                          <Input
                            id="height"
                            type="number"
                            placeholder="175"
                            value={data.height}
                            onChange={(e) => setData({ ...data, height: e.target.value })}
                            className="h-12"
                            min={100}
                            max={250}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="weight" className="flex items-center gap-2">
                            <Scale className="w-4 h-4 text-muted-foreground" />
                            Current Weight (kg)
                          </Label>
                          <Input
                            id="weight"
                            type="number"
                            placeholder="75"
                            value={data.weight}
                            onChange={(e) => setData({ ...data, weight: e.target.value })}
                            className="h-12"
                            min={30}
                            max={300}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Button 
                    onClick={() => setMetricsSubStep('targets')}
                    className="w-full"
                    disabled={!data.age || !data.height || !data.weight}
                  >
                    Continue
                  </Button>
                </div>
              )}

              {metricsSubStep === 'targets' && (
                <div className="space-y-6 animate-in fade-in-50 duration-200">
                  <div className="text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-3">
                      What's your target weight?
                    </h1>
                    <p className="text-muted-foreground">
                      {data.goal === 'lose' ? 'We recommend losing 0.5-1kg per week' : 
                       data.goal === 'gain' ? 'Healthy weight gain takes time' : 
                       'Maintain your current weight'}
                    </p>
                  </div>

                  <Card variant="elevated">
                    <CardContent className="p-6">
                      <div className="space-y-2">
                        <Label htmlFor="targetWeight" className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-muted-foreground" />
                          Target Weight (kg)
                        </Label>
                        <Input
                          id="targetWeight"
                          type="number"
                          placeholder="70"
                          value={data.targetWeight}
                          onChange={(e) => setData({ ...data, targetWeight: e.target.value })}
                          className="h-12"
                          min={30}
                          max={300}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setMetricsSubStep('basic')} className="flex-1">
                      Back
                    </Button>
                    <Button 
                      onClick={handleNext}
                      className="flex-1"
                      disabled={!data.targetWeight}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Activity Level */}
          {step === 4 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Your <span className="text-gradient">activity level</span>
                </h1>
                <p className="text-muted-foreground">
                  How active are you on a typical week?
                </p>
              </div>

              <div className="space-y-3">
                {activityLevels.map((level) => (
                  <Card
                    key={level.id}
                    variant="interactive"
                    className={`cursor-pointer transition-all ${
                      data.activityLevel === level.id 
                        ? "border-2 border-primary shadow-glow" 
                        : ""
                    }`}
                    onClick={() => setData({ ...data, activityLevel: level.id })}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{level.title}</h3>
                        <p className="text-sm text-muted-foreground">{level.description}</p>
                      </div>
                      {data.activityLevel === level.id && (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 5: Food Preferences & Allergies - Native Mobile Design */}
          {step === 5 && (
            <div className="flex flex-col h-full">
              {/* Header - Centered */}
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Utensils className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">
                  Dietary Preferences
                </h1>
                <p className="text-muted-foreground text-sm px-4">
                  Select your food preferences and allergies
                </p>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto space-y-5 -mx-4 px-4">
                {/* Food Preferences Section */}
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2 px-1">
                    <span className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                    </span>
                    Food Preferences
                  </h3>

                  {dietTagsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : dietTags.length > 0 ? (
                    <div className="space-y-2">
                      {dietTags.map((tag) => {
                        const isSelected = data.foodPreferences.includes(tag.name);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => {
                              const newPrefs = isSelected
                                ? data.foodPreferences.filter((p) => p !== tag.name)
                                : [...data.foodPreferences, tag.name];
                              setData({ ...data, foodPreferences: newPrefs });
                            }}
                            className={`
                              w-full p-3.5 rounded-xl border-2 transition-all duration-200
                              flex items-center gap-3 min-h-[52px]
                              ${isSelected
                                ? "border-emerald-500 bg-emerald-50/50"
                                : "border-border/50 bg-card hover:border-emerald-200"
                              }
                            `}
                          >
                            <div className={`
                              w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                              ${isSelected ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/30"}
                            `}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-medium text-sm">{tag.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-xl text-center">
                      <p className="text-sm text-muted-foreground">No preferences available</p>
                    </div>
                  )}
                </div>

                {/* Allergies Section */}
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2 px-1">
                    <span className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    </span>
                    Allergies
                  </h3>

                  {dietTagsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : allergyTags.length > 0 ? (
                    <div className="space-y-2">
                      {allergyTags.map((tag) => {
                        const isSelected = data.allergies.includes(tag.name);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => {
                              const newAllergies = isSelected
                                ? data.allergies.filter((a) => a !== tag.name)
                                : [...data.allergies, tag.name];
                              setData({ ...data, allergies: newAllergies });
                            }}
                            className={`
                              w-full p-3.5 rounded-xl border-2 transition-all duration-200
                              flex items-center gap-3 min-h-[52px]
                              ${isSelected
                                ? "border-red-500 bg-red-50/50"
                                : "border-border/50 bg-card hover:border-red-200"
                              }
                            `}
                          >
                            <div className={`
                              w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                              ${isSelected ? "border-red-500 bg-red-500" : "border-muted-foreground/30"}
                            `}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-medium text-sm">{tag.name}</span>
                            {isSelected && (
                              <span className="ml-auto text-xs text-red-600 font-medium">Avoid</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-muted rounded-xl text-center">
                      <p className="text-sm text-muted-foreground">No allergies available</p>
                    </div>
                  )}
                </div>

                {/* Spacer for scroll */}
                <div className="h-4" />
              </div>

              {/* Summary - Fixed at bottom */}
              {(data.foodPreferences.length > 0 || data.allergies.length > 0) && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Selected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.foodPreferences.map((pref) => (
                      <Badge key={pref} variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                        {pref}
                      </Badge>
                    ))}
                    {data.allergies.map((allergy) => (
                      <Badge key={allergy} variant="secondary" className="bg-red-100 text-red-700 text-xs">
                        {allergy}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Recovery Dialog */}
      <OnboardingRecoveryDialog
        open={showRecoveryDialog}
        onOpenChange={setShowRecoveryDialog}
        draftData={draftData}
        onContinue={handleRecoveryContinue}
        onStartFresh={handleRecoveryStartFresh}
      />

      {/* Footer Navigation - Native Mobile Style */}
      <footer className="p-4 pb-8 border-t border-border bg-background/95 backdrop-blur-lg safe-bottom-nav">
        <div className="container mx-auto max-w-md flex justify-between items-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={handleBack}
            disabled={step === 1 || saving}
            className="flex-1 h-14 rounded-xl font-medium min-h-[56px]"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="flex-1 h-14 rounded-xl font-semibold min-h-[56px] shadow-lg"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                {step === totalSteps ? "Complete" : "Continue"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
        {/* Skip for now button */}
        <div className="container mx-auto max-w-md mt-4 text-center">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip for now — I&apos;ll set up later
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            You can always update your preferences in Settings
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Onboarding;
