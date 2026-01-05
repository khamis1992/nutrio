import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Salad, 
  Target, 
  Dumbbell, 
  Scale, 
  Flame,
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  Ruler,
  Activity
} from "lucide-react";

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
}

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    goal: null,
    gender: null,
    age: "",
    height: "",
    weight: "",
    targetWeight: "",
    activityLevel: null,
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Complete onboarding
      navigate("/dashboard");
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

  return (
    <div className="min-h-screen gradient-hero flex flex-col">
      {/* Header */}
      <header className="p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
              <Salad className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">NUTRIO</span>
          </div>
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
      </main>

      {/* Footer Navigation */}
      <footer className="p-4 border-t border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex justify-between items-center">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            disabled={step === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            variant="gradient"
            onClick={handleNext}
            disabled={!canProceed()}
          >
            {step === totalSteps ? "Complete Setup" : "Continue"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default Onboarding;
