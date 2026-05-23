import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { AccessibleStepper } from "@/components/onboarding/AccessibleStepper";
import { PlanRevealAnimation } from "@/components/onboarding/PlanRevealAnimation";
import { debounce } from "@/lib/debounce";
import { useLanguage } from "@/contexts/LanguageContext";

type Goal = "lose" | "gain" | "maintain";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Gender = "male" | "female";
type MetricsSubStep = "age" | "height" | "weight" | "targets";

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

// Calculate macro targets — dietary preferences override goal-based ratios when relevant
const calculateMacros = (calories: number, goal: Goal, foodPreferences: string[] = []) => {
  const prefsLower = foodPreferences.map((p) => p.toLowerCase());

  // Keto: very low carb, high fat
  if (prefsLower.some((p) => p.includes("keto"))) {
    return {
      protein: Math.round((calories * 0.30) / 4),
      carbs: Math.round((calories * 0.05) / 4),
      fat: Math.round((calories * 0.65) / 9),
    };
  }

  // High protein / bodybuilding
  if (prefsLower.some((p) => p.includes("high protein") || p.includes("high-protein") || p.includes("bodybuilding"))) {
    return {
      protein: Math.round((calories * 0.40) / 4),
      carbs: Math.round((calories * 0.35) / 4),
      fat: Math.round((calories * 0.25) / 9),
    };
  }

  // Low carb (but not keto)
  if (prefsLower.some((p) => p.includes("low carb") || p.includes("low-carb") || p.includes("paleo"))) {
    return {
      protein: Math.round((calories * 0.35) / 4),
      carbs: Math.round((calories * 0.20) / 4),
      fat: Math.round((calories * 0.45) / 9),
    };
  }

  // Goal-based defaults
  let proteinRatio: number, carbsRatio: number, fatRatio: number;
  switch (goal) {
    case "lose":
      proteinRatio = 0.35; carbsRatio = 0.35; fatRatio = 0.30;
      break;
    case "gain":
      proteinRatio = 0.30; carbsRatio = 0.45; fatRatio = 0.25;
      break;
    case "maintain":
    default:
      proteinRatio = 0.30; carbsRatio = 0.40; fatRatio = 0.30;
  }

  return {
    protein: Math.round((calories * proteinRatio) / 4),
    carbs: Math.round((calories * carbsRatio) / 4),
    fat: Math.round((calories * fatRatio) / 9),
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

// Tiny helper: runs the loading animation and calls onComplete when done
const LoadingAdvancer = ({
  progress, setProgress, onComplete,
}: {
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  onComplete: () => void;
}) => {
  const completedRef = useRef(false);
  useEffect(() => {
    if (progress >= 100) {
      if (!completedRef.current) { completedRef.current = true; onComplete(); }
      return;
    }
    const id = setTimeout(() => setProgress((p) => Math.min(100, p + 1.5)), 30);
    return () => clearTimeout(id);
  }, [progress, onComplete, setProgress]);
  return null;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const { dietTags, allergyTags, loading: dietTagsLoading } = useDietTags();
  const { t } = useLanguage();
  
  const [step, setStep] = useState(1);
  const [metricsSubStep, setMetricsSubStep] = useState<MetricsSubStep>("age");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ft">("cm");
  const [saving, setSaving] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [computedPlan, setComputedPlan] = useState<{
    calories: number; protein: number; carbs: number; fat: number;
    carbsPct: number; proteinPct: number; fatPct: number;
  } | null>(null);
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
  }, [toast]);

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
  const saveDraft = useMemo(
    () => debounce((currentData: OnboardingData, currentStep: number) => {
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
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    navigate("/dashboard");
  };

  const handleQuickStart = () => {
    setData({
      goal: "maintain",
      gender: "male",
      age: "30",
      height: "170",
      weight: "75",
      targetWeight: "75",
      activityLevel: "moderate",
      trainingDaysPerWeek: "3",
      foodPreferences: [],
      allergies: [],
    });
    saveDraft({
      goal: "maintain", gender: "male", age: "30", height: "170", weight: "75",
      targetWeight: "75", activityLevel: "moderate", trainingDaysPerWeek: "3",
      foodPreferences: [], allergies: [],
    }, 1);
    const age = 30;
    const height = 170;
    const weight = 75;
    const bmr = calculateBMR("male", weight, height, age);
    const tdee = calculateTDEE(bmr, "moderate");
    const dailyCalories = calculateTargetCalories(tdee, "maintain");
    const macros = calculateMacros(dailyCalories, "maintain", []);
    setComputedPlan({
      calories: dailyCalories,
      carbsPct: Math.round((macros.carbs * 4 / dailyCalories) * 100),
      proteinPct: Math.round((macros.protein * 4 / dailyCalories) * 100),
      fatPct: Math.round((macros.fat * 9 / dailyCalories) * 100),
      carbs: macros.carbs,
      protein: macros.protein,
      fat: macros.fat,
    });
    setStep(7);
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
      title: t("lose_weight"), 
      description: t("lose_weight_desc"),
      color: "text-destructive"
    },
    { 
      id: "gain" as Goal, 
      icon: Dumbbell, 
      title: t("build_muscle"), 
      description: t("build_muscle_desc"),
      color: "text-primary"
    },
    { 
      id: "maintain" as Goal, 
      icon: Target, 
      title: t("maintain"), 
      description: t("maintain_desc"),
      color: "text-accent"
    },
  ];

  const activityLevels = [
    { id: "sedentary" as ActivityLevel, title: t("sedentary"), description: t("sedentary_desc") },
    { id: "light" as ActivityLevel, title: t("lightly_active"), description: t("lightly_active_desc") },
    { id: "moderate" as ActivityLevel, title: t("moderately_active"), description: t("moderately_active_desc") },
    { id: "active" as ActivityLevel, title: t("very_active"), description: t("very_active_desc") },
    { id: "very_active" as ActivityLevel, title: t("extra_active"), description: t("extra_active_desc") },
  ];

  // ── Step 6: Personalizing loading screen ──────────────────────
  if (step === 6) {
    const RADIUS = 100;
    const CIRC = 2 * Math.PI * RADIUS;
    const offset = CIRC * (1 - loadingProgress / 100);

    return (
      <div className="fixed inset-0 flex flex-col bg-background dark:bg-gray-950" style={{ maxWidth: 430, margin: "0 auto" }}>
        {/* X button */}
        <div className="px-5 pt-12 flex-shrink-0">
          <button type="button" onClick={() => navigate("/dashboard")}
            className="hover:opacity-70 transition-opacity">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" className="stroke-foreground dark:stroke-gray-300" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Title */}
          <h1 className="text-[26px] font-extrabold text-foreground dark:text-gray-100 leading-tight text-center mb-16">
            Personalizing your Nutrio experience...
          </h1>

          {/* Circular progress ring */}
          <div className="relative" style={{ width: 240, height: 240 }}>
            <svg width="240" height="240" viewBox="0 0 240 240">
              {/* Background track */}
              <circle cx="120" cy="120" r={RADIUS} fill="none" className="stroke-muted dark:stroke-gray-700" strokeWidth="14" />
              {/* Progress arc */}
              <circle
                cx="120" cy="120" r={RADIUS} fill="none"
                stroke="url(#ringGrad)" strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={offset}
                transform="rotate(-90 120 120)"
                style={{ transition: "stroke-dashoffset 0.05s linear" }}
              />
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(90,65%,55%)" />
                  <stop offset="100%" stopColor="hsl(90,65%,42%)" />
                </linearGradient>
              </defs>
            </svg>
            {/* Percentage text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[40px] font-extrabold text-foreground dark:text-gray-100">{Math.round(loadingProgress)}%</span>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <div className="px-8 pb-12 text-center flex-shrink-0">
          <p className="text-sm text-muted-foreground dark:text-gray-400 leading-relaxed">
            Hang tight! We're crafting a personalized plan just for you.
          </p>
        </div>

        {/* Auto-advance effect */}
        <LoadingAdvancer
          progress={loadingProgress}
          setProgress={setLoadingProgress}
          onComplete={async () => {
            await completeOnboarding();
            setStep(7);
          }}
        />
      </div>
    );
  }

  // ── Step 7: Plan ready screen ──────────────────────────────────
  if (step === 7) {
    const plan = computedPlan ?? { calories: 2000, carbsPct: 40, proteinPct: 30, fatPct: 30, carbs: 200, protein: 150, fat: 67 };
    return (
      <PlanRevealAnimation
        calories={plan.calories}
        carbsPct={plan.carbsPct}
        proteinPct={plan.proteinPct}
        fatPct={plan.fatPct}
        carbs={plan.carbs}
        protein={plan.protein}
        fat={plan.fat}
        onViewDashboard={() => navigate("/dashboard")}
      />
    );
  }

  const completeOnboarding = async () => {
    const age = parseInt(data.age) || 30;
    const height = parseInt(data.height) || 170;
    const weight = parseFloat(data.weight) || 75;
    const bmr = calculateBMR(data.gender || "male", weight, height, age);
    const tdee = calculateTDEE(bmr, data.activityLevel || "moderate");
    const dailyCalories = calculateTargetCalories(tdee, data.goal || "maintain");
    const macros = calculateMacros(dailyCalories, data.goal || "maintain", data.foodPreferences);
    setComputedPlan({
      calories: dailyCalories,
      carbsPct: Math.round((macros.carbs * 4 / dailyCalories) * 100),
      proteinPct: Math.round((macros.protein * 4 / dailyCalories) * 100),
      fatPct: Math.round((macros.fat * 9 / dailyCalories) * 100),
      carbs: macros.carbs,
      protein: macros.protein,
      fat: macros.fat,
    });
    clearSavedProgress();
    try {
      if (!user) return;
      await updateProfile({
        goal: data.goal || "maintain",
        gender: data.gender || "male",
        age: parseInt(data.age) || 30,
        height: parseInt(data.height) || 170,
        weight: parseFloat(data.weight) || 75,
        target_weight: parseFloat(data.targetWeight) || 75,
        activity_level: data.activityLevel || "moderate",
        training_days_per_week: parseInt(data.trainingDaysPerWeek) || 3,
        food_preferences: data.foodPreferences,
        allergies: data.allergies,
        daily_calories: dailyCalories,
        daily_protein: macros.protein,
        daily_carbs: macros.carbs,
        daily_fat: macros.fat,
      });
    } catch (err) {
      console.error("Failed to save onboarding profile:", err);
    }
  };

  const handleNext = () => {
    if (step === 3) {
      if (metricsSubStep === "age") {
        setMetricsSubStep("height");
        return;
      }
      if (metricsSubStep === "height") {
        setMetricsSubStep("weight");
        return;
      }
      if (metricsSubStep === "weight") {
        setMetricsSubStep("targets");
        return;
      }
      if (metricsSubStep === "targets") {
        setMetricsSubStep("age");
        setStep(4);
        return;
      }
      return;
    }
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  const handleBack = () => {
    if (step === 3) {
      if (metricsSubStep === "height") {
        setMetricsSubStep("age");
        return;
      }
      if (metricsSubStep === "weight") {
        setMetricsSubStep("height");
        return;
      }
      if (metricsSubStep === "targets") {
        setMetricsSubStep("weight");
        return;
      }
      if (metricsSubStep === "age") {
        setStep(2);
        return;
      }
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const convertHeightToCm = (ft: number, inches: number) => Math.round((ft * 30.48 + inches * 2.54));
  const convertCmToFt = (cm: number) => {
    const totalInches = cm / 2.54;
    const ft = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { ft, inches: inches === 12 ? 0 : inches };
  };
  const formatHeightDisplay = (cm: number) => {
    if (heightUnit === "cm") return cm.toString();
    const { ft, inches } = convertCmToFt(cm);
    return `${ft}′${inches}″`;
  };

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
      <main className="flex-1 container mx-auto px-4 py-4 flex items-center justify-center overflow-y-auto pb-32">
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
                  { id: "male" as Gender, icon: User, title: t("male") },
                  { id: "female" as Gender, icon: User, title: t("female") },
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

          {/* Step 3: Body Metrics with accessible steppers */}
          {step === 3 && (
            <div className="space-y-8">
              {metricsSubStep === 'age' && (
                <div>
                  <AccessibleStepper
                    label={<>How old are <span className="text-gradient">you?</span></>}
                    subtitle="We use this to personalise your calorie targets"
                    value={parseInt(data.age) || 25}
                    onChange={(v) => setData((prev) => ({ ...prev, age: v.toString() }))}
                    min={13}
                    max={120}
                    step={1}
                    unit="yrs"
                    displayValue={(parseInt(data.age) || 25).toString()}
                    warnAtMin={14}
                    warnAtMax={110}
                    inputMode="numeric"
                  />
                  <div className="mt-6">
                    <Button
                      className="w-full"
                      onClick={() => { handleNext(); }}
                      disabled={!data.age}
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {metricsSubStep === 'height' && (
                <div>
                  <AccessibleStepper
                    label={<>What's your <span className="text-gradient">height?</span></>}
                    subtitle="Used to calculate your daily calorie target"
                    value={heightUnit === "cm" ? (parseInt(data.height) || 170) : convertCmToFt(parseInt(data.height) || 170).ft}
                    onChange={(v) => {
                      if (heightUnit === "cm") {
                        setData((prev) => ({ ...prev, height: v.toString() }));
                      } else {
                        const cm = Math.round(v * 30.48);
                        setData((prev) => ({ ...prev, height: cm.toString() }));
                      }
                    }}
                    min={heightUnit === "cm" ? 100 : 3}
                    max={heightUnit === "cm" ? 250 : 8}
                    step={1}
                    unit={heightUnit}
                    displayValue={formatHeightDisplay(parseInt(data.height) || 170)}
                    unitToggle={{
                      options: ["cm", "ft"] as const,
                      current: heightUnit,
                      onToggle: (u: string) => {
                        const cm = parseInt(data.height) || 170;
                        setHeightUnit(u as "cm" | "ft");
                        if (u === "ft") {
                          setData((prev) => ({ ...prev, height: Math.round(cm).toString() }));
                        }
                      },
                    }}
                    warnAtMin={heightUnit === "cm" ? 110 : 4}
                    warnAtMax={heightUnit === "cm" ? 230 : 7}
                    inputMode="numeric"
                  />
                  <div className="flex gap-2 mt-6">
                    <Button variant="outline" onClick={handleBack} className="w-12 h-12 flex-shrink-0 p-0">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={handleNext} className="flex-1" disabled={!data.height}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {metricsSubStep === 'weight' && (
                <div>
                  <AccessibleStepper
                    label={<>What's your current <span className="text-gradient">weight?</span></>}
                    subtitle="Used to calculate your daily calorie target"
                    value={(() => {
                      const v = parseFloat(data.weight) || 80;
                      return weightUnit === "kg" ? v : Math.round(v * 2.20462 * 10) / 10;
                    })()}
                    onChange={(v) => {
                      const kg = weightUnit === "kg" ? v : Math.round(v / 2.20462 * 10) / 10;
                      setData((prev) => ({ ...prev, weight: kg.toString() }));
                    }}
                    min={weightUnit === "kg" ? 30 : 66}
                    max={weightUnit === "kg" ? 250 : 551}
                    step={0.1}
                    unit={weightUnit}
                    displayValue={(() => {
                      const v = parseFloat(data.weight) || 80;
                      return weightUnit === "kg"
                        ? v.toFixed(1)
                        : (v * 2.20462).toFixed(1);
                    })()}
                    unitToggle={{
                      options: ["kg", "lb"] as const,
                      current: weightUnit,
                      onToggle: (u: string) => {
                        setWeightUnit(u as "kg" | "lb");
                      },
                    }}
                    warnAtMin={weightUnit === "kg" ? 40 : 88}
                    warnAtMax={weightUnit === "kg" ? 220 : 485}
                    inputMode="decimal"
                  />
                  <div className="flex gap-2 mt-6">
                    <Button variant="outline" onClick={handleBack} className="w-12 h-12 flex-shrink-0 p-0">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={handleNext} className="flex-1" disabled={!data.weight}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {metricsSubStep === 'targets' && (
                <div>
                  <AccessibleStepper
                    label={<>What's your <span className="text-gradient">target weight?</span></>}
                    subtitle={
                      data.goal === 'lose' ? 'We recommend losing 0.5–1 kg per week' :
                      data.goal === 'gain' ? 'Healthy weight gain takes time and consistency' :
                      'Maintain your current weight and improve health'
                    }
                    value={(() => {
                      const v = parseFloat(data.targetWeight) || 70;
                      return weightUnit === "kg" ? v : Math.round(v * 2.20462 * 10) / 10;
                    })()}
                    onChange={(v) => {
                      const kg = weightUnit === "kg" ? v : Math.round(v / 2.20462 * 10) / 10;
                      setData((prev) => ({ ...prev, targetWeight: kg.toString() }));
                    }}
                    min={weightUnit === "kg" ? 30 : 66}
                    max={weightUnit === "kg" ? 250 : 551}
                    step={0.1}
                    unit={weightUnit}
                    displayValue={(() => {
                      const v = parseFloat(data.targetWeight) || 70;
                      return weightUnit === "kg"
                        ? v.toFixed(1)
                        : (v * 2.20462).toFixed(1);
                    })()}
                    unitToggle={{
                      options: ["kg", "lb"] as const,
                      current: weightUnit,
                      onToggle: (u: string) => {
                        setWeightUnit(u as "kg" | "lb");
                      },
                    }}
                    warnAtMin={weightUnit === "kg" ? 40 : 88}
                    warnAtMax={weightUnit === "kg" ? 220 : 485}
                    inputMode="decimal"
                  />
                  <div className="flex gap-2 mt-6">
                    <Button variant="outline" onClick={handleBack} className="w-12 h-12 flex-shrink-0 p-0">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={handleNext} className="flex-1" disabled={!data.targetWeight}>
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
                {t("saving")}
              </>
            ) : (
              <>
                {step === totalSteps ? t("complete") : t("continue")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
        {/* Skip for now button */}
        <div className="container mx-auto max-w-md mt-4 text-center">
          <Button
            variant="ghost"
            onClick={handleQuickStart}
            className="text-primary hover:text-primary/80 font-medium"
          >
            Quick Start — apply recommended defaults for me
          </Button>
          <br />
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
