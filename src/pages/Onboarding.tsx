import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Dumbbell,
  Scale,
  ArrowRight,
  ArrowLeft,
  Check,
  User,
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
  const { profile, loading: profileLoading, updateProfile } = useProfile();
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
    age: "25",
    height: "170",
    weight: "80",
    targetWeight: "70",
    activityLevel: null,
    trainingDaysPerWeek: "3",
    foodPreferences: [],
    allergies: [],
  });

  const totalSteps = 5;
  const progressPercent = Math.round((step / totalSteps) * 100);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!profileLoading && profile?.onboarding_completed) {
      navigate("/dashboard");
    }
  }, [authLoading, navigate, profile?.onboarding_completed, profileLoading, user]);

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

  const handleQuickStart = async () => {
    const quickStartData: OnboardingData = {
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
    };
    setData(quickStartData);
    saveDraft(quickStartData, 1);
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
    sessionStorage.setItem("nutrio_onboarding_done", "true");
    await completeOnboarding(quickStartData);
    setStep(7);
  };

  const completeOnboarding = async (overrideData?: OnboardingData) => {
    const onboardingData = overrideData ?? data;
    const age = parseInt(onboardingData.age) || 30;
    const height = parseInt(onboardingData.height) || 170;
    const weight = parseFloat(onboardingData.weight) || 75;
    const bmr = calculateBMR(onboardingData.gender || "male", weight, height, age);
    const tdee = calculateTDEE(bmr, onboardingData.activityLevel || "moderate");
    const dailyCalories = calculateTargetCalories(tdee, onboardingData.goal || "maintain");
    const macros = calculateMacros(dailyCalories, onboardingData.goal || "maintain", onboardingData.foodPreferences);
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
    if (!user) return;
    setSaving(true);
    try {
      const goalType = onboardingData.goal === "lose" ? "weight_loss" : onboardingData.goal === "gain" ? "muscle_gain" : "maintenance";
      const profileResult = await updateProfile({
        health_goal: onboardingData.goal || "maintain",
        gender: onboardingData.gender || "male",
        age: parseInt(onboardingData.age) || 30,
        height_cm: parseInt(onboardingData.height) || 170,
        current_weight_kg: parseFloat(onboardingData.weight) || 75,
        target_weight_kg: parseFloat(onboardingData.targetWeight) || 75,
        activity_level: onboardingData.activityLevel || "moderate",
        daily_calorie_target: dailyCalories,
        protein_target_g: macros.protein,
        carbs_target_g: macros.carbs,
        fat_target_g: macros.fat,
        onboarding_completed: true,
      });
      if (profileResult.error) {
        console.error("updateProfile failed:", profileResult.error);
        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" });
        if (upsertError) {
          console.error("Fallback upsert also failed:", upsertError);
        }
      }
      const { error: goalsError } = await supabase.from("nutrition_goals").insert({
        user_id: user.id,
        goal_type: goalType,
        target_weight_kg: parseFloat(onboardingData.targetWeight) || null,
        daily_calorie_target: dailyCalories,
        protein_target_g: macros.protein,
        carbs_target_g: macros.carbs,
        fat_target_g: macros.fat,
        is_active: true,
      });
      if (goalsError) {
        console.error("nutrition_goals insert failed:", goalsError);
      }
    } catch (err) {
      console.error("Failed to save onboarding profile:", err);
      try {
        await supabase
          .from("profiles")
          .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: "user_id" });
      } catch { /* last resort */ }
    } finally {
      setSaving(false);
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
      title: t("lose_weight"), 
      description: t("lose_weight_desc"),
      color: "text-[#FB6B7A]",
      bg: "bg-[#FFF0F2]",
    },
    { 
      id: "gain" as Goal, 
      icon: Dumbbell, 
      title: t("build_muscle"), 
      description: t("build_muscle_desc"),
      color: "text-[#7C83F6]",
      bg: "bg-[#F3F4FF]",
    },
    { 
      id: "maintain" as Goal, 
      icon: Target, 
      title: t("maintain"), 
      description: t("maintain_desc"),
      color: "text-[#22C7A1]",
      bg: "bg-[#EFFFFA]",
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
      <div className="fixed inset-0 mx-auto flex max-w-[430px] flex-col bg-[#F6F8FB] text-[#020617]">
        {/* X button */}
        <div className="flex-shrink-0 px-5 pt-[calc(env(safe-area-inset-top)+16px)]">
          <button type="button" data-testid="onboarding-close-btn" onClick={() => navigate("/dashboard")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E5EAF1] bg-white text-[#020617] shadow-[0_8px_20px_rgba(2,6,23,0.05)] transition-opacity hover:opacity-70">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8">
          {/* Title */}
          <h1 className="mb-14 text-center text-[26px] font-extrabold leading-tight text-[#020617]">
            Personalizing your Nutrio experience...
          </h1>

          {/* Circular progress ring */}
          <div className="relative" style={{ width: 240, height: 240 }}>
            <svg width="240" height="240" viewBox="0 0 240 240">
              {/* Background track */}
              <circle cx="120" cy="120" r={RADIUS} fill="none" stroke="#E5EAF1" strokeWidth="14" />
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
                  <stop offset="0%" stopColor="#22C7A1" />
                  <stop offset="55%" stopColor="#7C83F6" />
                  <stop offset="100%" stopColor="#F97316" />
                </linearGradient>
              </defs>
            </svg>
            {/* Percentage text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[40px] font-extrabold text-[#020617]">{Math.round(loadingProgress)}%</span>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <div className="flex-shrink-0 px-8 pb-[calc(env(safe-area-inset-bottom)+28px)] text-center">
          <p className="text-sm leading-relaxed text-[#64748B]">
            Hang tight! We're crafting a personalized plan just for you.
          </p>
        </div>

        {/* Auto-advance effect */}
        <LoadingAdvancer
          progress={loadingProgress}
          setProgress={setLoadingProgress}
          onComplete={async () => {
            sessionStorage.setItem("nutrio_onboarding_done", "true");
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
        onViewDashboard={() => navigate("/dashboard", { state: { onboardingDone: true } })}
      />
    );
  }

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
    // Step 5 → step 6 (loading screen): must bypass Math.min cap
    if (step === totalSteps) {
      setStep(totalSteps + 1);
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
      <div role="status" aria-label="Loading account setup" className="min-h-[100dvh] flex items-center justify-center bg-[#F6F8FB]">
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-[#22C7A1]" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[430px] flex-col overflow-hidden bg-[#F6F8FB] text-[#020617]">
      {/* Header */}
      <header className="shrink-0 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+14px)]">
        <div className="flex items-center justify-between">
          <Logo size="lg" className="!h-14" />
          <Badge
            aria-label={`Step ${step} of ${totalSteps}`}
            className="rounded-full border border-[#E5EAF1] bg-white px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-[#020617] shadow-[0_8px_20px_rgba(2,6,23,0.05)] hover:bg-white"
          >
            {step}/{totalSteps}
          </Badge>
        </div>
      </header>

      {/* Progress Bar with Percentage */}
      <div className="shrink-0 px-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#64748B]">Account setup</span>
          <span className="text-sm font-extrabold text-[#F97316]">{progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Account setup progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          className="h-2 rounded-full bg-[#E5EAF1]"
        >
          <div
            className="h-full rounded-full bg-[#22C7A1] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-4 flex justify-between rounded-[24px] border border-[#E5EAF1] bg-white p-2 shadow-[0_10px_28px_rgba(2,6,23,0.05)]">
          {ONBOARDING_STEPS.map((stepInfo, idx) => {
            const StepIcon = stepInfo.icon;
            const isDone = idx < step - 1;
            const isActive = idx === step - 1;
            return (
              <div key={stepInfo.id} className="flex flex-1 flex-col items-center">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-all ${
                  isDone ? "bg-[#020617] text-white" :
                  isActive ? "bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#FED7AA]" :
                  "bg-[#F6F8FB] text-[#94A3B8]"
                }`}>
                  {isDone ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <span className={`mt-1 hidden text-[10px] font-bold sm:block ${isActive ? "text-[#020617]" : "text-[#94A3B8]"}`}>{stepInfo.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content - Native Mobile Centered Design */}
      <main className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(192px+env(safe-area-inset-bottom))] pt-5 [-webkit-overflow-scrolling:touch]">
        <div className="w-full animate-fade-in" key={step}>
          {/* Step 1: Goal Selection */}
          {step === 1 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="mb-3 text-[28px] font-extrabold leading-tight text-[#020617]">
                  What's your <span className="text-[#F97316]">main goal</span>?
                </h1>
                <p className="text-sm leading-6 text-[#64748B]">
                  This helps us create a personalized nutrition plan for you
                </p>
              </div>

              <div className="grid gap-4">
                {goals.map((goal) => (
                  <Card
                    key={goal.id}
                    className={`cursor-pointer rounded-[28px] border bg-white shadow-[0_12px_30px_rgba(2,6,23,0.05)] transition-all active:scale-[0.99] ${
                      data.goal === goal.id 
                        ? "border-[#020617] ring-2 ring-[#020617]/10" 
                        : "border-[#E5EAF1]"
                    }`}
                    onClick={() => setData({ ...data, goal: goal.id })}
                  >
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className={`flex h-14 w-14 items-center justify-center rounded-[20px] ${goal.bg} ${goal.color}`}>
                        <goal.icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-extrabold text-[#020617]">{goal.title}</h3>
                        <p className="text-sm leading-5 text-[#64748B]">{goal.description}</p>
                      </div>
                      {data.goal === goal.id && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#020617]">
                          <Check className="h-5 w-5 text-white" />
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
                <h1 className="mb-3 text-[28px] font-extrabold leading-tight text-[#020617]">
                  Tell us about <span className="text-[#7C83F6]">yourself</span>
                </h1>
                <p className="text-sm leading-6 text-[#64748B]">
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
                    className={`cursor-pointer rounded-[28px] border bg-white shadow-[0_12px_30px_rgba(2,6,23,0.05)] transition-all active:scale-[0.99] ${
                      data.gender === option.id 
                        ? "border-[#020617] ring-2 ring-[#020617]/10" 
                        : "border-[#E5EAF1]"
                    }`}
                    onClick={() => setData({ ...data, gender: option.id })}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#F3F4FF]">
                        <option.icon className="h-8 w-8 text-[#7C83F6]" />
                      </div>
                      <h3 className="text-lg font-extrabold text-[#020617]">{option.title}</h3>
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
                    label={<>How old are <span className="text-[#F97316]">you?</span></>}
                    ariaLabel="Age"
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
                      className="h-14 w-full rounded-[20px] bg-[#020617] font-extrabold text-white hover:bg-[#020617]/90"
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
                    label={<>What's your <span className="text-[#38BDF8]">height?</span></>}
                    ariaLabel="Height"
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
                    <Button variant="outline" onClick={handleBack} className="h-14 w-14 flex-shrink-0 rounded-[20px] border-[#E5EAF1] bg-white p-0 text-[#020617]">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={handleNext} className="h-14 flex-1 rounded-[20px] bg-[#020617] font-extrabold text-white hover:bg-[#020617]/90" disabled={!data.height}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {metricsSubStep === 'weight' && (
                <div>
                  <AccessibleStepper
                    label={<>What's your current <span className="text-[#22C7A1]">weight?</span></>}
                    ariaLabel="Current weight"
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
                    <Button variant="outline" onClick={handleBack} className="h-14 w-14 flex-shrink-0 rounded-[20px] border-[#E5EAF1] bg-white p-0 text-[#020617]">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={handleNext} className="h-14 flex-1 rounded-[20px] bg-[#020617] font-extrabold text-white hover:bg-[#020617]/90" disabled={!data.weight}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {metricsSubStep === 'targets' && (
                <div>
                  <AccessibleStepper
                    label={<>What's your <span className="text-[#FB6B7A]">target weight?</span></>}
                    ariaLabel="Target weight"
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
                    <Button variant="outline" onClick={handleBack} className="h-14 w-14 flex-shrink-0 rounded-[20px] border-[#E5EAF1] bg-white p-0 text-[#020617]">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={handleNext} className="h-14 flex-1 rounded-[20px] bg-[#020617] font-extrabold text-white hover:bg-[#020617]/90" disabled={!data.targetWeight}>
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
                <h1 className="mb-3 text-[28px] font-extrabold leading-tight text-[#020617]">
                  Your <span className="text-[#22C7A1]">activity level</span>
                </h1>
                <p className="text-sm leading-6 text-[#64748B]">
                  How active are you on a typical week?
                </p>
              </div>

              <div className="space-y-3">
                {activityLevels.map((level) => (
                  <Card
                    key={level.id}
                    className={`cursor-pointer rounded-[24px] border bg-white shadow-[0_10px_26px_rgba(2,6,23,0.045)] transition-all active:scale-[0.99] ${
                      data.activityLevel === level.id 
                        ? "border-[#020617] ring-2 ring-[#020617]/10" 
                        : "border-[#E5EAF1]"
                    }`}
                    onClick={() => setData({ ...data, activityLevel: level.id })}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#EFFFFA]">
                        <Activity className="h-6 w-6 text-[#22C7A1]" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-extrabold text-[#020617]">{level.title}</h3>
                        <p className="text-sm leading-5 text-[#64748B]">{level.description}</p>
                      </div>
                      {data.activityLevel === level.id && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#020617]">
                          <Check className="h-4 w-4 text-white" />
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
              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#FFF7ED]">
                  <Utensils className="h-10 w-10 text-[#F97316]" />
                </div>
                <h1 className="mb-2 text-[26px] font-extrabold text-[#020617]">
                  Dietary Preferences
                </h1>
                <p className="px-4 text-sm leading-6 text-[#64748B]">
                  Select your food preferences and allergies
                </p>
              </div>

              {/* Scrollable Content */}
              <div className="-mx-1 flex-1 space-y-5 overflow-y-auto px-1">
                {/* Food Preferences Section */}
                <div>
                  <h3 className="mb-3 flex items-center gap-2 px-1 text-base font-extrabold text-[#020617]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#EFFFFA]">
                      <Leaf className="h-3.5 w-3.5 text-[#22C7A1]" />
                    </span>
                    Food Preferences
                  </h3>

                  {dietTagsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 animate-pulse rounded-2xl bg-[#E5EAF1]" />
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
                              flex min-h-[56px] w-full items-center gap-3 rounded-[20px] border p-3.5 text-left
                              transition-all duration-200 active:scale-[0.99]
                              ${isSelected
                                ? "border-[#22C7A1] bg-[#EFFFFA]"
                                : "border-[#E5EAF1] bg-white"
                              }
                            `}
                          >
                            <div className={`
                              flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2
                              ${isSelected ? "border-[#22C7A1] bg-[#22C7A1]" : "border-[#CBD5E1]"}
                            `}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm font-extrabold text-[#020617]">{tag.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[20px] bg-white p-4 text-center">
                      <p className="text-sm text-[#64748B]">{t("onboarding_no_preferences")}</p>
                    </div>
                  )}
                </div>

                {/* Allergies Section */}
                <div>
                  <h3 className="mb-3 flex items-center gap-2 px-1 text-base font-extrabold text-[#020617]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FFF0F2]">
                      <AlertTriangle className="h-3.5 w-3.5 text-[#FB6B7A]" />
                    </span>
                    Allergies
                  </h3>

                  {dietTagsLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 animate-pulse rounded-2xl bg-[#E5EAF1]" />
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
                              flex min-h-[56px] w-full items-center gap-3 rounded-[20px] border p-3.5 text-left
                              transition-all duration-200 active:scale-[0.99]
                              ${isSelected
                                ? "border-[#FB6B7A] bg-[#FFF0F2]"
                                : "border-[#E5EAF1] bg-white"
                              }
                            `}
                          >
                            <div className={`
                              flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2
                              ${isSelected ? "border-[#FB6B7A] bg-[#FB6B7A]" : "border-[#CBD5E1]"}
                            `}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm font-extrabold text-[#020617]">{tag.name}</span>
                            {isSelected && (
                              <span className="ml-auto text-xs font-extrabold text-[#FB6B7A]">Avoid</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-[20px] bg-white p-4 text-center">
                      <p className="text-sm text-[#64748B]">{t("onboarding_no_allergies")}</p>
                    </div>
                  )}
                </div>

                {/* Spacer for scroll */}
                <div className="h-4" />
              </div>

              {/* Summary - Fixed at bottom */}
              {(data.foodPreferences.length > 0 || data.allergies.length > 0) && (
                <div className="mt-4 border-t border-[#E5EAF1] pt-4">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Selected:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.foodPreferences.map((pref) => (
                      <Badge key={pref} variant="secondary" className="bg-[#EFFFFA] text-xs text-[#047857]">
                        {pref}
                      </Badge>
                    ))}
                    {data.allergies.map((allergy) => (
                      <Badge key={allergy} variant="secondary" className="bg-[#FFF0F2] text-xs text-[#BE123C]">
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
      {step !== 3 && (
        <footer className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[430px] border-t border-[#E5EAF1] bg-white/95 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-4 shadow-[0_-14px_34px_rgba(2,6,23,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="lg"
            data-testid="onboarding-back-btn"
            onClick={handleBack}
            disabled={step === 1 || saving}
            className="h-14 min-h-[56px] flex-1 rounded-[20px] border-[#E5EAF1] bg-white font-extrabold text-[#020617] disabled:opacity-40"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>
          <Button
            size="lg"
            data-testid="onboarding-continue-btn"
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="h-14 min-h-[56px] flex-1 rounded-[20px] bg-[#020617] font-extrabold text-white shadow-none hover:bg-[#020617]/90 disabled:bg-[#CBD5E1]"
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
        <div className="mt-3 text-center">
          <Button
            variant="ghost"
            data-testid="onboarding-quick-start-btn"
            onClick={handleQuickStart}
            className="h-9 text-xs font-extrabold text-[#F97316] hover:bg-[#FFF7ED] hover:text-[#F97316]"
          >
            Quick Start — apply recommended defaults for me
          </Button>
          <br />
          <Button
            variant="ghost"
            data-testid="onboarding-skip-btn"
            onClick={handleSkip}
            className="h-8 text-xs font-bold text-[#64748B] hover:bg-[#F6F8FB] hover:text-[#020617]"
          >
            Skip for now — I&apos;ll set up later
          </Button>
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            You can always update your preferences in Settings
          </p>
        </div>
        </footer>
      )}
    </div>
  );
};

export default Onboarding;
