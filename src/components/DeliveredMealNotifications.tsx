import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDeliveredMealNotifications } from "@/hooks/useDeliveredMealNotifications";
import { useLanguage } from "@/contexts/LanguageContext";
import { MealConsumptionSheet } from "@/components/MealConsumptionSheet";
import { Loader2, CheckCircle2, X, Utensils, Flame } from "lucide-react";

export function DeliveredMealNotifications() {
  const { pendingMeals, loading, dismissNotification } = useDeliveredMealNotifications();
  const { t } = useLanguage();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<(typeof pendingMeals)[number] | null>(null);

  if (pendingMeals.length === 0) {
    return null;
  }

  const handleDismiss = async (id: string) => {
    setProcessingId(id);
    await dismissNotification(id);
    setProcessingId(null);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
        <Utensils className="w-4 h-4" />
        {t('delivered_meals_title')}
      </h3>
      
      {pendingMeals.map((meal) => (
        <Card key={meal.id} className="rounded-lg border-[#C7F1E6] bg-[#E8FBF6]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-sm">{meal.meal_name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('delivered_meal_prompt')}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-orange-600">
                    <Flame className="w-3 h-3" />
                    {meal.calories} {t('calories_label')}
                  </span>
                  <span className="text-emerald-600">{t('protein_abbr')}: {meal.protein_g}{t('g')}</span>
                  <span className="text-amber-600">{t('carbs_abbr')}: {meal.carbs_g}{t('g')}</span>
                  <span className="text-blue-600">{t('fat_abbr')}: {meal.fat_g}{t('g')}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDismiss(meal.id)}
                  disabled={processingId === meal.id || loading}
                >
                  {processingId === meal.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 rounded-lg bg-[#020617] hover:bg-[#020617]/90"
                  onClick={() => setSelectedMeal(meal)}
                  disabled={processingId === meal.id || loading}
                >
                  {processingId === meal.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                  <>
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      {t('confirm') === 'confirm' ? 'Confirm' : t('confirm')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {selectedMeal && (
        <MealConsumptionSheet
          open
          onOpenChange={(open) => { if (!open) setSelectedMeal(null); }}
          sourceType={selectedMeal.source_type}
          sourceId={selectedMeal.source_id}
          sourceMealId={selectedMeal.meal_id}
          meal={{
            meal_id: selectedMeal.meal_id,
            meal_name: selectedMeal.meal_name,
            calories: selectedMeal.calories,
            protein_g: selectedMeal.protein_g,
            carbs_g: selectedMeal.carbs_g,
            fat_g: selectedMeal.fat_g,
          }}
          onSaved={() => {
            void dismissNotification(selectedMeal.id);
            setSelectedMeal(null);
          }}
        />
      )}
    </div>
  );
}
