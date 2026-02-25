import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

type Goal = "lose" | "gain" | "maintain";
type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type Gender = "male" | "female";

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

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
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

  const totalSteps = 6;

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
        training_days_per_week: parseInt(data.trainingDaysPerWeek) || 0,
        food_preferences: data.foodPreferences,
        allergies: data.allergies,
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
        return data.trainingDaysPerWeek !== "";
      case 6:
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

      {/* Progress Bar */}
      <div className="container mx-auto px-4 mt-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full gradient-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-2xl animate-fade-in" key={step}>
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

          {/* Step 3: Body Metrics */}
          {step === 3 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Your <span className="text-gradient">body metrics</span>
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
                  </div>
                </CardContent>
              </Card>
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
        </div>
          {/* Step 5: Training Days */}
          {step === 5 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Your <span className="text-gradient">training schedule</span>
                </h1>
                <p className="text-muted-foreground">
                  How many days per week do you exercise?
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {["0", "1", "2", "3", "4", "5", "6", "7"].map((days) => (
                  <Card
                    key={days}
                    variant="interactive"
                    className={`cursor-pointer transition-all ${
                      data.trainingDaysPerWeek === days 
                        ? "border-2 border-primary shadow-glow" 
                        : ""
                    }`}
                    onClick={() => setData({ ...data, trainingDaysPerWeek: days })}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold">{days}</div>
                      <div className="text-xs text-muted-foreground">days</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Food Preferences & Allergies */}
          {step === 6 && (
            <div className="space-y-8">
              <div className="text-center">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  Dietary <span className="text-gradient">preferences</span>
                </h1>
                <p className="text-muted-foreground">
                  Help us personalize your meal recommendations
                </p>
              </div>

              <Card variant="elevated">
                <CardContent className="p-6 space-y-6">
                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      Food Preferences (Optional)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {["Halal", "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Low-Carb"].map((pref) => (
                        <Badge
                          key={pref}
                          variant={data.foodPreferences.includes(pref) ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5 text-sm"
                          onClick={() => {
                            const newPrefs = data.foodPreferences.includes(pref)
                              ? data.foodPreferences.filter((p) => p !== pref)
                              : [...data.foodPreferences, pref];
                            setData({ ...data, foodPreferences: newPrefs });
                          }}
                        >
                          {data.foodPreferences.includes(pref) && <Check className="w-3 h-3 mr-1" />}
                          {pref}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-base font-semibold mb-3 block">
                      Allergies (Optional)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {["Nuts", "Dairy", "Shellfish", "Eggs", "Wheat", "Soy", "Fish"].map((allergy) => (
                        <Badge
                          key={allergy}
                          variant={data.allergies.includes(allergy) ? "destructive" : "outline"}
                          className="cursor-pointer px-3 py-1.5 text-sm"
                          onClick={() => {
                            const newAllergies = data.allergies.includes(allergy)
                              ? data.allergies.filter((a) => a !== allergy)
                              : [...data.allergies, allergy];
                            setData({ ...data, allergies: newAllergies });
                          }}
                        >
                          {data.allergies.includes(allergy) && <Check className="w-3 h-3 mr-1" />}
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

      </main>

      {/* Footer Navigation */}
      <footer className="p-4 border-t border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            disabled={step === 1 || saving}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            variant="gradient"
            onClick={handleNext}
            disabled={!canProceed() || saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {step === totalSteps ? "Complete Setup" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Onboarding;
