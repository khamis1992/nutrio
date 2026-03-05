import { useState, useEffect, useCallback, useRef } from "react";
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
  }, [progress]);
  return null;
};

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const { dietTags, allergyTags, loading: dietTagsLoading } = useDietTags();
  
  const [step, setStep] = useState(1);
  const [metricsSubStep, setMetricsSubStep] = useState<MetricsSubStep>("age");
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">("kg");
  const rulerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const dragStartWeight = useRef<number>(80);
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
  // TEMP: auth check disabled for UI editing
  useEffect(() => {
    const checkUserType = async () => {
      if (authLoading) return;
      
      if (!user) {
        // navigate("/auth");
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
      // Compute plan for the summary screen, then show loading → plan-ready screens
      if (data.goal && data.gender && data.activityLevel) {
        const age = parseInt(data.age) || 25;
        const height = parseFloat(data.height) || 170;
        const weight = parseFloat(data.weight) || 70;
        const bmr = calculateBMR(data.gender, weight, height, age);
        const tdee = calculateTDEE(bmr, data.activityLevel);
        const calories = calculateTargetCalories(tdee, data.goal);
        const macros = calculateMacros(calories, data.goal, data.foodPreferences);
        const totalCal = macros.carbs * 4 + macros.protein * 4 + macros.fat * 9;
        setComputedPlan({
          calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          carbsPct: Math.round((macros.carbs * 4 / totalCal) * 100),
          proteinPct: Math.round((macros.protein * 4 / totalCal) * 100),
          fatPct: Math.round((macros.fat * 9 / totalCal) * 100),
        });
      }
      setLoadingProgress(0);
      setStep(6); // loading screen
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

      // Calculate nutrition targets (food preferences influence macro ratios)
      const bmr = calculateBMR(data.gender, weight, height, age);
      const tdee = calculateTDEE(bmr, data.activityLevel);
      const dailyCalories = calculateTargetCalories(tdee, data.goal);
      const macros = calculateMacros(dailyCalories, data.goal, data.foodPreferences);

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
        onboarding_completed: true,
      });

      if (error) throw error;

      // Save dietary preferences + allergies to user_dietary_preferences table
      if (user) {
        const allTags = [...dietTags, ...allergyTags];
        const selectedNames = [...data.foodPreferences, ...data.allergies];
        const selectedTagIds = selectedNames
          .map((name) => allTags.find((t) => t.name === name)?.id)
          .filter((id): id is string => Boolean(id));

        // Replace all existing preferences for this user
        await supabase.from("user_dietary_preferences").delete().eq("user_id", user.id);

        if (selectedTagIds.length > 0) {
          await supabase.from("user_dietary_preferences").insert(
            selectedTagIds.map((diet_tag_id) => ({ user_id: user.id, diet_tag_id }))
          );
        }
      }

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

  // ── Step 6: Personalizing loading screen ──────────────────────
  if (step === 6) {
    const RADIUS = 100;
    const CIRC = 2 * Math.PI * RADIUS;
    const offset = CIRC * (1 - loadingProgress / 100);

    return (
      <div className="fixed inset-0 flex flex-col bg-white" style={{ maxWidth: 430, margin: "0 auto" }}>
        {/* X button */}
        <div className="px-5 pt-12 flex-shrink-0">
          <button type="button" onClick={() => navigate("/dashboard")}
            className="hover:opacity-70 transition-opacity">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Title */}
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight text-center mb-16">
            Personalizing your Nutrio experience...
          </h1>

          {/* Circular progress ring */}
          <div className="relative" style={{ width: 240, height: 240 }}>
            <svg width="240" height="240" viewBox="0 0 240 240">
              {/* Background track */}
              <circle cx="120" cy="120" r={RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="14" />
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
              <span className="text-[40px] font-extrabold text-gray-900">{Math.round(loadingProgress)}%</span>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <div className="px-8 pb-12 text-center flex-shrink-0">
          <p className="text-sm text-gray-400 leading-relaxed">
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
    const DONUT_R = 90;
    const DONUT_CIRC = 2 * Math.PI * DONUT_R;
    const carbsDash = DONUT_CIRC * (plan.carbsPct / 100);
    const proteinDash = DONUT_CIRC * (plan.proteinPct / 100);
    const fatDash = DONUT_CIRC * (plan.fatPct / 100);
    // each segment starts where the previous ends
    const carbsOffset = 0;
    const proteinOffset = -carbsDash;
    const fatOffset = -(carbsDash + proteinDash);

    return (
      <div className="fixed inset-0 flex flex-col bg-white" style={{ maxWidth: 430, margin: "0 auto" }}>
        {/* X button */}
        <div className="px-5 pt-12 flex-shrink-0">
          <button type="button" onClick={() => navigate("/dashboard")}
            className="hover:opacity-70 transition-opacity">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8">
          {/* Title */}
          <h1 className="text-[26px] font-extrabold text-gray-900 leading-tight text-center mb-10">
            Your personalized calorie plan is ready!
          </h1>

          {/* Donut chart */}
          <div className="relative mb-8" style={{ width: 240, height: 240 }}>
            <svg width="240" height="240" viewBox="0 0 240 240">
              {/* Carbs — red */}
              <circle cx="120" cy="120" r={DONUT_R} fill="none" stroke="#EF4444" strokeWidth="22"
                strokeDasharray={`${carbsDash} ${DONUT_CIRC}`}
                strokeDashoffset={carbsOffset}
                transform="rotate(-90 120 120)" strokeLinecap="butt" />
              {/* Protein — orange */}
              <circle cx="120" cy="120" r={DONUT_R} fill="none" stroke="#F97316" strokeWidth="22"
                strokeDasharray={`${proteinDash} ${DONUT_CIRC}`}
                strokeDashoffset={proteinOffset}
                transform="rotate(-90 120 120)" strokeLinecap="butt" />
              {/* Fat — blue */}
              <circle cx="120" cy="120" r={DONUT_R} fill="none" stroke="#3B82F6" strokeWidth="22"
                strokeDasharray={`${fatDash} ${DONUT_CIRC}`}
                strokeDashoffset={fatOffset}
                transform="rotate(-90 120 120)" strokeLinecap="butt" />
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[36px] font-extrabold text-gray-900 leading-none">{plan.calories.toLocaleString()}</span>
              <span className="text-sm font-medium text-gray-400 mt-1">kcal</span>
            </div>

            {/* Floating percentage labels */}
            <div className="absolute" style={{ top: "14%", right: "-8%" }}>
              <div className="bg-white rounded-full shadow-md px-3 py-1 text-sm font-bold text-gray-700">
                {plan.proteinPct}%
              </div>
            </div>
            <div className="absolute" style={{ top: "38%", left: "-10%" }}>
              <div className="bg-white rounded-full shadow-md px-3 py-1 text-sm font-bold text-gray-700">
                {plan.carbsPct}%
              </div>
            </div>
            <div className="absolute" style={{ bottom: "6%", right: "-8%" }}>
              <div className="bg-white rounded-full shadow-md px-3 py-1 text-sm font-bold text-gray-700">
                {plan.fatPct}%
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6">
            {[
              { color: "#EF4444", label: "Carbs" },
              { color: "#F97316", label: "Protein" },
              { color: "#3B82F6", label: "Fat" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-sm text-gray-600 font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Start button */}
        <div className="px-6 pb-10 pt-4 flex-shrink-0">
          <Button variant="gradient" className="w-full rounded-2xl font-bold" style={{ height: 56, fontSize: 16 }}
            onClick={() => navigate("/dashboard")}>
            Start Your Plan Now
          </Button>
        </div>
      </div>
    );
  }

  // precompute ruler values used inside the main return for step 3
  const PX_PER_UNIT = 22;
  const MIN_KG = 30;
  const MAX_KG = 250;
  const currentKg = parseFloat(data.weight) || 80;
  const displayValue = weightUnit === 'kg'
    ? currentKg.toFixed(1)
    : (currentKg * 2.20462).toFixed(1);
  const tickMin = Math.max(MIN_KG, Math.floor(currentKg) - 20);
  const tickMax = Math.min(MAX_KG, Math.ceil(currentKg) + 20);
  const rulerTicks: number[] = [];
  for (let i = tickMin; i <= tickMax; i++) rulerTicks.push(i);

  const handleRulerPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX;
    dragStartWeight.current = currentKg;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleRulerPointerMove = (e: React.PointerEvent) => {
    if (dragStartX.current === null) return;
    const dx = dragStartX.current - e.clientX;
    const newKg = Math.min(MAX_KG, Math.max(MIN_KG,
      Math.round((dragStartWeight.current + dx / PX_PER_UNIT) * 10) / 10
    ));
    setData((prev) => ({ ...prev, weight: newKg.toString() }));
  };
  const handleRulerPointerUp = () => { dragStartX.current = null; };

  // TEMP: skip auth loading spinner so page is visible without login
  // if (authLoading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-background">
  //       <Loader2 className="w-8 h-8 animate-spin text-primary" />
  //     </div>
  //   );
  // }

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

          {/* Step 3: Weight picker */}
          {step === 3 && (
            <div className="space-y-8">
              {/* Age sub-step */}
              {metricsSubStep === 'age' && (() => {
                const currentAge = parseInt(data.age) || 25;
                const AGE_PX = 28;
                const MIN_AGE = 13, MAX_AGE = 100;
                const ageTickMin = Math.max(MIN_AGE, currentAge - 15);
                const ageTickMax = Math.min(MAX_AGE, currentAge + 15);
                const ageTicks: number[] = [];
                for (let i = ageTickMin; i <= ageTickMax; i++) ageTicks.push(i);
                const onAgeDown = (e: React.PointerEvent) => {
                  dragStartX.current = e.clientX;
                  dragStartWeight.current = currentAge;
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                };
                const onAgeMove = (e: React.PointerEvent) => {
                  if (dragStartX.current === null) return;
                  const newVal = Math.min(MAX_AGE, Math.max(MIN_AGE,
                    Math.round(dragStartWeight.current + (dragStartX.current - e.clientX) / AGE_PX)
                  ));
                  setData((prev) => ({ ...prev, age: newVal.toString() }));
                };
                return (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h1 className="text-3xl md:text-4xl font-bold mb-3">
                        How old are <span className="text-gradient">you?</span>
                      </h1>
                      <p className="text-muted-foreground">We use this to personalise your calorie targets</p>
                    </div>

                    <div className="flex items-baseline justify-center gap-2">
                      <span className="font-black text-foreground" style={{ fontSize: 72, lineHeight: 1, letterSpacing: "-2px" }}>
                        {currentAge}
                      </span>
                      <span className="text-2xl font-semibold text-muted-foreground">yrs</span>
                    </div>

                    <div className="relative w-full select-none cursor-grab active:cursor-grabbing"
                      style={{ height: 90, touchAction: "none" }}
                      onPointerDown={onAgeDown} onPointerMove={onAgeMove}
                      onPointerUp={() => { dragStartX.current = null; }} onPointerCancel={() => { dragStartX.current = null; }}>
                      {ageTicks.map((tick) => {
                        const offset = (tick - currentAge) * AGE_PX;
                        const isTen = tick % 10 === 0;
                        const isFive = tick % 5 === 0 && !isTen;
                        return (
                          <div key={tick} className="absolute top-0"
                            style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)" }}>
                            <div style={{
                              width: isTen ? 2 : 1,
                              height: isTen ? 32 : isFive ? 22 : 14,
                              background: isTen ? "hsl(var(--muted-foreground)/0.4)" : "hsl(var(--muted-foreground)/0.2)",
                              borderRadius: 2, margin: "0 auto",
                            }} />
                          </div>
                        );
                      })}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
                        style={{ width: 2, height: 48, background: "#7DC200", borderRadius: 2 }} />
                      {ageTicks.filter((t) => t % 10 === 0).map((tick) => {
                        const offset = (tick - currentAge) * AGE_PX;
                        return (
                          <span key={tick} className="absolute text-sm font-medium text-muted-foreground"
                            style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)", bottom: 4, userSelect: "none" }}>
                            {tick}
                          </span>
                        );
                      })}
                    </div>

                    <Button className="w-full" onClick={() => setMetricsSubStep('height')} disabled={!data.age}>
                      Continue
                    </Button>
                  </div>
                );
              })()}

              {/* Height sub-step */}
              {metricsSubStep === 'height' && (() => {
                const currentHeight = parseInt(data.height) || 170;
                const HEIGHT_PX = 14;
                const MIN_H = 100, MAX_H = 250;
                const hTickMin = Math.max(MIN_H, currentHeight - 20);
                const hTickMax = Math.min(MAX_H, currentHeight + 20);
                const hTicks: number[] = [];
                for (let i = hTickMin; i <= hTickMax; i++) hTicks.push(i);
                const onHeightDown = (e: React.PointerEvent) => {
                  dragStartX.current = e.clientX;
                  dragStartWeight.current = currentHeight;
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                };
                const onHeightMove = (e: React.PointerEvent) => {
                  if (dragStartX.current === null) return;
                  const newVal = Math.min(MAX_H, Math.max(MIN_H,
                    Math.round(dragStartWeight.current + (dragStartX.current - e.clientX) / HEIGHT_PX)
                  ));
                  setData((prev) => ({ ...prev, height: newVal.toString() }));
                };
                return (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h1 className="text-3xl md:text-4xl font-bold mb-3">
                        What's your <span className="text-gradient">height?</span>
                      </h1>
                      <p className="text-muted-foreground">Drag the ruler to set your height</p>
                    </div>

                    <div className="flex items-baseline justify-center gap-2">
                      <span className="font-black text-foreground" style={{ fontSize: 72, lineHeight: 1, letterSpacing: "-2px" }}>
                        {currentHeight}
                      </span>
                      <span className="text-2xl font-semibold text-muted-foreground">cm</span>
                    </div>

                    <div className="relative w-full select-none cursor-grab active:cursor-grabbing"
                      style={{ height: 90, touchAction: "none" }}
                      onPointerDown={onHeightDown} onPointerMove={onHeightMove}
                      onPointerUp={() => { dragStartX.current = null; }} onPointerCancel={() => { dragStartX.current = null; }}>
                      {hTicks.map((tick) => {
                        const offset = (tick - currentHeight) * HEIGHT_PX;
                        const isTen = tick % 10 === 0;
                        const isFive = tick % 5 === 0 && !isTen;
                        return (
                          <div key={tick} className="absolute top-0"
                            style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)" }}>
                            <div style={{
                              width: isTen ? 2 : 1,
                              height: isTen ? 32 : isFive ? 22 : 14,
                              background: isTen ? "hsl(var(--muted-foreground)/0.4)" : "hsl(var(--muted-foreground)/0.2)",
                              borderRadius: 2, margin: "0 auto",
                            }} />
                          </div>
                        );
                      })}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
                        style={{ width: 2, height: 48, background: "#7DC200", borderRadius: 2 }} />
                      {hTicks.filter((t) => t % 10 === 0).map((tick) => {
                        const offset = (tick - currentHeight) * HEIGHT_PX;
                        return (
                          <span key={tick} className="absolute text-sm font-medium text-muted-foreground"
                            style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)", bottom: 4, userSelect: "none" }}>
                            {tick}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setMetricsSubStep('age')} className="w-12 h-12 flex-shrink-0 p-0">
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                      <Button onClick={() => setMetricsSubStep('weight')} className="flex-1" disabled={!data.height}>
                        Continue
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Weight sub-step */}
              {metricsSubStep === 'weight' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h1 className="text-3xl md:text-4xl font-bold mb-3">
                      What's your current <span className="text-gradient">weight?</span>
                    </h1>
                    <p className="text-muted-foreground">Drag the ruler to set your weight</p>
                  </div>

                  {/* Unit toggle */}
                  <div className="flex justify-center">
                    <div className="flex gap-1 p-1 bg-muted rounded-full">
                      {(['kg', 'lb'] as const).map((u) => (
                        <button key={u} type="button" onClick={() => setWeightUnit(u)}
                          className="px-6 py-2 rounded-full font-semibold text-sm transition-all"
                          style={weightUnit === u
                            ? { background: "linear-gradient(135deg, hsl(90,65%,50%) 0%, hsl(90,65%,42%) 100%)", color: "#fff" }
                            : { color: "hsl(var(--muted-foreground))" }}>
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Large value */}
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="font-black text-foreground" style={{ fontSize: 72, lineHeight: 1, letterSpacing: "-2px" }}>
                      {displayValue}
                    </span>
                    <span className="text-2xl font-semibold text-muted-foreground">{weightUnit}</span>
                  </div>

                  {/* Ruler */}
                  <div ref={rulerRef} className="relative w-full select-none cursor-grab active:cursor-grabbing"
                    style={{ height: 90, touchAction: "none" }}
                    onPointerDown={handleRulerPointerDown} onPointerMove={handleRulerPointerMove}
                    onPointerUp={handleRulerPointerUp} onPointerCancel={handleRulerPointerUp}>
                    {rulerTicks.map((tick) => {
                      const offset = (tick - currentKg) * PX_PER_UNIT;
                      const isTen = tick % 10 === 0;
                      const isFive = tick % 5 === 0 && !isTen;
                      return (
                        <div key={tick} className="absolute top-0"
                          style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)" }}>
                          <div style={{
                            width: isTen ? 2 : 1,
                            height: isTen ? 32 : isFive ? 22 : 14,
                            background: isTen ? "hsl(var(--muted-foreground)/0.4)" : "hsl(var(--muted-foreground)/0.2)",
                            borderRadius: 2, margin: "0 auto",
                          }} />
                        </div>
                      );
                    })}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
                      style={{ width: 2, height: 48, background: "#7DC200", borderRadius: 2 }} />
                    {rulerTicks.filter((t) => t % 10 === 0).map((tick) => {
                      const offset = (tick - currentKg) * PX_PER_UNIT;
                      const label = weightUnit === 'kg' ? tick : Math.round(tick * 2.20462);
                      return (
                        <span key={tick} className="absolute text-sm font-medium text-muted-foreground"
                          style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)", bottom: 4, userSelect: "none" }}>
                          {label}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setMetricsSubStep('height')} className="w-12 h-12 flex-shrink-0 p-0">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button onClick={() => setMetricsSubStep('targets')} className="flex-1" disabled={!data.weight}>
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* Target weight sub-step — same ruler design */}
              {metricsSubStep === 'targets' && (() => {
                const targetKg = parseFloat(data.targetWeight) || 70;
                const targetDisplay = weightUnit === 'kg'
                  ? targetKg.toFixed(1)
                  : (targetKg * 2.20462).toFixed(1);
                const tMin = Math.max(MIN_KG, Math.floor(targetKg) - 20);
                const tMax = Math.min(MAX_KG, Math.ceil(targetKg) + 20);
                const targetTicks: number[] = [];
                for (let i = tMin; i <= tMax; i++) targetTicks.push(i);

                const onTargetDown = (e: React.PointerEvent) => {
                  dragStartX.current = e.clientX;
                  dragStartWeight.current = targetKg;
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                };
                const onTargetMove = (e: React.PointerEvent) => {
                  if (dragStartX.current === null) return;
                  const newKg = Math.min(MAX_KG, Math.max(MIN_KG,
                    Math.round((dragStartWeight.current + (dragStartX.current - e.clientX) / PX_PER_UNIT) * 10) / 10
                  ));
                  setData((prev) => ({ ...prev, targetWeight: newKg.toString() }));
                };

                return (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h1 className="text-3xl md:text-4xl font-bold mb-3">
                        What's your <span className="text-gradient">target weight?</span>
                      </h1>
                      <p className="text-muted-foreground">
                        {data.goal === 'lose' ? 'We recommend losing 0.5–1 kg per week' :
                         data.goal === 'gain' ? 'Healthy weight gain takes time and consistency' :
                         'Maintain your current weight and improve health'}
                      </p>
                    </div>

                    {/* Unit toggle */}
                    <div className="flex justify-center">
                      <div className="flex gap-1 p-1 bg-muted rounded-full">
                        {(['kg', 'lb'] as const).map((u) => (
                          <button key={u} type="button" onClick={() => setWeightUnit(u)}
                            className="px-6 py-2 rounded-full font-semibold text-sm transition-all"
                            style={weightUnit === u
                              ? { background: "linear-gradient(135deg, hsl(90,65%,50%) 0%, hsl(90,65%,42%) 100%)", color: "#fff" }
                              : { color: "hsl(var(--muted-foreground))" }}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Large value */}
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="font-black text-foreground" style={{ fontSize: 72, lineHeight: 1, letterSpacing: "-2px" }}>
                        {targetDisplay}
                      </span>
                      <span className="text-2xl font-semibold text-muted-foreground">{weightUnit}</span>
                    </div>

                    {/* Ruler */}
                    <div className="relative w-full select-none cursor-grab active:cursor-grabbing"
                      style={{ height: 90, touchAction: "none" }}
                      onPointerDown={onTargetDown} onPointerMove={onTargetMove}
                      onPointerUp={() => { dragStartX.current = null; }} onPointerCancel={() => { dragStartX.current = null; }}>
                      {targetTicks.map((tick) => {
                        const offset = (tick - targetKg) * PX_PER_UNIT;
                        const isTen = tick % 10 === 0;
                        const isFive = tick % 5 === 0 && !isTen;
                        return (
                          <div key={tick} className="absolute top-0"
                            style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)" }}>
                            <div style={{
                              width: isTen ? 2 : 1,
                              height: isTen ? 32 : isFive ? 22 : 14,
                              background: isTen ? "hsl(var(--muted-foreground)/0.4)" : "hsl(var(--muted-foreground)/0.2)",
                              borderRadius: 2, margin: "0 auto",
                            }} />
                          </div>
                        );
                      })}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
                        style={{ width: 2, height: 48, background: "#7DC200", borderRadius: 2 }} />
                      {targetTicks.filter((t) => t % 10 === 0).map((tick) => {
                        const offset = (tick - targetKg) * PX_PER_UNIT;
                        const label = weightUnit === 'kg' ? tick : Math.round(tick * 2.20462);
                        return (
                          <span key={tick} className="absolute text-sm font-medium text-muted-foreground"
                            style={{ left: `calc(50% + ${offset}px)`, transform: "translateX(-50%)", bottom: 4, userSelect: "none" }}>
                            {label}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setMetricsSubStep('weight')} className="w-12 h-12 flex-shrink-0 p-0">
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                      <Button onClick={handleNext} className="flex-1" disabled={!data.targetWeight}>
                        Continue
                      </Button>
                    </div>
                  </div>
                );
              })()}
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
