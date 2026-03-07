import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Check, X, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AdaptiveGoalCardProps {
  recommendation: {
    new_calories: number;
    new_protein: number;
    new_carbs: number;
    new_fat: number;
    reason: string;
    confidence: number;
    plateau_detected: boolean;
    suggested_action: string;
  } | null;
  currentCalories: number;
  currentProtein: number;
  currentCarbs: number;
  currentFat: number;
  adjustmentId?: string;
  onApply: (adjustmentId: string) => void;
  onDismiss: () => void;
  loading: boolean;
}

export const AdaptiveGoalCard = ({
  recommendation,
  currentCalories,
  currentProtein,
  currentCarbs,
  currentFat,
  adjustmentId,
  onApply,
  onDismiss,
  loading
}: AdaptiveGoalCardProps) => {
  const { t } = useLanguage();

  if (!recommendation) return null;

  const calorieDiff = recommendation.new_calories - currentCalories;
  const proteinDiff = recommendation.new_protein - currentProtein;
  const carbsDiff = recommendation.new_carbs - currentCarbs;
  const fatDiff = recommendation.new_fat - currentFat;
  
  const hasChanges = calorieDiff !== 0 || proteinDiff !== 0 || carbsDiff !== 0 || fatDiff !== 0;
  
  if (!hasChanges) {
    return (
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">{t('adaptiveGoals_greatProgress')}</h3>
              <p className="text-sm text-green-700 mt-1">{recommendation.reason}</p>
              <p className="text-xs text-green-600 mt-2">{recommendation.suggested_action}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            </div>
            <div>
              <CardTitle className="text-lg">{t('adaptiveGoals_aiSuggestion')}</CardTitle>
              <CardDescription>
                {t('adaptiveGoals_basedOnProgress')}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {recommendation.plateau_detected && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('adaptiveGoals_plateauDetected')}
              </Badge>
            )}
            <Badge variant={recommendation.confidence > 0.8 ? "default" : "secondary"}>
              {Math.round(recommendation.confidence * 100)}{t('adaptiveGoals_confidence')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Main Calorie Change */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">{t('adaptiveGoals_dailyCalorieTarget')}</span>
            {calorieDiff !== 0 && (
              <Badge 
                variant={calorieDiff > 0 ? "default" : "destructive"}
                className="gap-1"
              >
                {calorieDiff > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {calorieDiff > 0 ? '+' : ''}{calorieDiff}
              </Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{recommendation.new_calories}</span>
            <span className="text-muted-foreground">{t('adaptiveGoals_caloriesPerDay')}</span>
            <span className="text-sm text-muted-foreground ml-2">
              ({t('adaptiveGoals_was')} {currentCalories})
            </span>
          </div>
        </div>

        {/* Macro Changes */}
        {(proteinDiff !== 0 || carbsDiff !== 0 || fatDiff !== 0) && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <p className="text-xs text-blue-600 mb-1">{t('adaptiveGoals_protein')}</p>
              <p className="text-lg font-semibold text-blue-700">
                {recommendation.new_protein}g
              </p>
              {proteinDiff !== 0 && (
                <p className={`text-xs ${proteinDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {proteinDiff > 0 ? '+' : ''}{proteinDiff}g
                </p>
              )}
            </div>
            <div className="bg-amber-50 p-3 rounded-lg text-center">
              <p className="text-xs text-amber-600 mb-1">{t('adaptiveGoals_carbs')}</p>
              <p className="text-lg font-semibold text-amber-700">
                {recommendation.new_carbs}g
              </p>
              {carbsDiff !== 0 && (
                <p className={`text-xs ${carbsDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {carbsDiff > 0 ? '+' : ''}{carbsDiff}g
                </p>
              )}
            </div>
            <div className="bg-rose-50 p-3 rounded-lg text-center">
              <p className="text-xs text-rose-600 mb-1">{t('adaptiveGoals_fat')}</p>
              <p className="text-lg font-semibold text-rose-700">
                {recommendation.new_fat}g
              </p>
              {fatDiff !== 0 && (
                <p className={`text-xs ${fatDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fatDiff > 0 ? '+' : ''}{fatDiff}g
                </p>
              )}
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">{t('adaptiveGoals_whyThisChange')}</p>
          </div>
          <p className="text-sm text-muted-foreground pl-6">{recommendation.reason}</p>
        </div>

        {/* Suggested Action */}
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>{t('adaptiveGoals_tip')}:</strong> {recommendation.suggested_action}
          </p>
        </div>

        {/* Safety Notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Minus className="h-3 w-3" />
          <span>{t('adaptiveGoals_safetyRange')}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={() => adjustmentId && onApply(adjustmentId)} 
            disabled={loading || !adjustmentId}
            className="flex-1"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                {t('adaptiveGoals_applying')}
              </span>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('adaptiveGoals_applyChanges')}
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={onDismiss} 
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            {t('adaptiveGoals_dismiss')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
