/* eslint-disable react-refresh/only-export-components */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Brain, Target, Heart, Lightbulb } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface MatchFactor {
  name: string;
  score: number; // 0-100
  description: string;
  icon: typeof Target;
}

interface AIMealExplanationProps {
  mealId: string;
  mealName: string;
  overallMatch: number; // 0-100
  factors: MatchFactor[];
  explanation: string;
  language?: string;
}

export function AIMealExplanation({
  mealName,
  overallMatch,
  factors,
  explanation,
  language = "en",
}: AIMealExplanationProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getMatchLabel = (score: number): string => {
    if (score >= 90) return "Excellent Match";
    if (score >= 75) return "Great Match";
    if (score >= 60) return "Good Match";
    if (score >= 40) return "Fair Match";
    return "Low Match";
  };

  const getMatchColor = (score: number): string => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 75) return "bg-green-500";
    if (score >= 60) return "bg-blue-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-orange-500";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            aria-label="Why this meal? AI explanation"
          >
            <Brain className="h-3 w-3" />
            <span>Why this meal?</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-80 p-0">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  AI Match Score
                </CardTitle>
                <Badge
                  variant={overallMatch >= 75 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {getMatchLabel(overallMatch)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overall Match */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Match Score</span>
                  <span className="font-semibold">{overallMatch}%</span>
                </div>
                <Progress
                  value={overallMatch}
                  className={`h-2 ${getMatchColor(overallMatch)}`}
                />
              </div>

              {/* Explanation */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {explanation}
              </p>

              {/* Factor Breakdown */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Match Breakdown
                </p>
                {factors.map((factor, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <factor.icon className="h-3 w-3 text-muted-foreground" />
                        <span>{factor.name}</span>
                      </div>
                      <span className="font-medium">{factor.score}%</span>
                    </div>
                    <Progress
                      value={factor.score}
                      className="h-1"
                    />
                    <p className="text-xs text-muted-foreground">
                      {factor.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Transparency Note */}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground italic">
                  <Info className="h-3 w-3 inline mr-1" />
                  This recommendation is based on your nutrition goals, 
                  dietary preferences, and meal history.
                </p>
              </div>
            </CardContent>
          </Card>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Predefined factor explanations for common scenarios
export const MEAL_MATCH_FACTORS = {
  nutrition: {
    name: "Nutrition Alignment",
    icon: Target,
    description: "Matches your daily macro targets",
  },
  preference: {
    name: "Taste Preferences",
    icon: Heart,
    description: "Based on your favorite cuisines and ingredients",
  },
  history: {
    name: "Meal History",
    icon: Brain,
    description: "Similar to meals you enjoyed before",
  },
  variety: {
    name: "Variety Balance",
    icon: Lightbulb,
    description: "Helps you maintain dietary variety",
  },
};

// Hook for fetching AI explanation
export function useAIMealExplanation(mealId: string, userId: string) {
  // This would normally fetch from an API/ML service
  // For now, return mock data structure
  return {
    overallMatch: 85,
    factors: [
      { ...MEAL_MATCH_FACTORS.nutrition, score: 90 },
      { ...MEAL_MATCH_FACTORS.preference, score: 80 },
      { ...MEAL_MATCH_FACTORS.history, score: 85 },
      { ...MEAL_MATCH_FACTORS.variety, score: 70 },
    ],
    explanation: "This meal is recommended because it perfectly aligns with your protein goals and includes ingredients from cuisines you frequently enjoy.",
  };
}
