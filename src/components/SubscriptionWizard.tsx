import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const QUESTIONS = [
  {
    id: "meals_per_day",
    question: "How many meals do you want delivered per day?",
    options: [
      { value: "1", label: "1 meal", plan: "basic" },
      { value: "2", label: "2 meals", plan: "standard" },
      { value: "3", label: "3 meals", plan: "premium" },
      { value: "unlimited", label: "Varies / Flexible", plan: "vip" },
    ],
  },
  {
    id: "commitment",
    question: "How committed are you to your health goals?",
    options: [
      { value: "exploring", label: "Just exploring", plan: "basic" },
      { value: "moderate", label: "Moderately committed", plan: "standard" },
      { value: "serious", label: "Very committed", plan: "premium" },
      { value: "all_in", label: "All in - I want a coach", plan: "vip" },
    ],
  },
  {
    id: "features",
    question: "What matters most to you?",
    options: [
      { value: "price", label: "Best value for money", plan: "basic" },
      { value: "variety", label: "Wide restaurant variety", plan: "standard" },
      { value: "coaching", label: "Personal coaching & support", plan: "premium" },
      { value: "premium", label: "Premium experience & priority", plan: "vip" },
    ],
  },
];

const PLAN_DETAILS = {
  basic: { name: "Basic", price: 215, meals: 22, highlight: "Best for trying out" },
  standard: { name: "Standard", price: 430, meals: 43, highlight: "Most popular" },
  premium: { name: "Premium", price: 645, meals: 65, highlight: "Best value" },
  vip: { name: "VIP", price: 860, meals: "Unlimited", highlight: "Premium experience" },
};

type PlanType = keyof typeof PLAN_DETAILS;

export function SubscriptionWizard() {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  // Calculate recommended plan
  const getRecommendedPlan = (): PlanType => {
    const planScores: Record<string, number> = { basic: 0, standard: 0, premium: 0, vip: 0 };

    Object.entries(answers).forEach(([questionId, answer]) => {
      const question = QUESTIONS.find((q) => q.id === questionId);
      const option = question?.options.find((o) => o.value === answer);
      if (option) {
        planScores[option.plan]++;
      }
    });

    const maxScore = Math.max(...Object.values(planScores));
    const recommendedPlan =
      Object.entries(planScores).find(([_, score]) => score === maxScore)?.[0] || "standard";

    return recommendedPlan as PlanType;
  };

  const currentQ = QUESTIONS[currentQuestion];
  const isLastQuestion = currentQuestion === QUESTIONS.length - 1;
  const recommendedPlan = getRecommendedPlan();

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            Question {currentQuestion + 1} of {QUESTIONS.length}
          </span>
          <div className="flex gap-1">
            {QUESTIONS.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-2 w-6 rounded-full",
                  idx <= currentQuestion ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
        <CardTitle className="text-lg">{currentQ.question}</CardTitle>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={answers[currentQ.id] || ""}
          onValueChange={(value) => handleAnswer(currentQ.id, value)}
          className="space-y-3"
        >
          {currentQ.options.map((option) => (
            <div key={option.value} className="flex items-center space-x-3">
              <RadioGroupItem value={option.value} id={option.value} />
              <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={handleBack} disabled={currentQuestion === 0}>
          <ArrowLeft className="mr-2 h-4 w-4 rtl-flip-back" /> Back
        </Button>
        {isLastQuestion ? (
          <Button onClick={() => navigate(`/subscription?recommended=${recommendedPlan}`)}>
            See My Plan <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleNext} disabled={!answers[currentQ.id]}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Result component to show on subscription page
interface RecommendedPlanBannerProps {
  plan: PlanType;
}

export function RecommendedPlanBanner({ plan }: RecommendedPlanBannerProps) {
  const details = PLAN_DETAILS[plan];

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-medium">Recommended for You</span>
        <Badge variant="secondary">{details.highlight}</Badge>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{details.name}</p>
          <p className="text-sm text-muted-foreground">
            {details.meals} meals/month • {details.price} QAR
          </p>
        </div>
        <Button>Select This Plan</Button>
      </div>
    </div>
  );
}
