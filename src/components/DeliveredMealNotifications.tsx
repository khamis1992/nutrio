import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDeliveredMealNotifications } from "@/hooks/useDeliveredMealNotifications";
import { Loader2, Plus, X, Utensils, Flame } from "lucide-react";

export function DeliveredMealNotifications() {
  const { pendingMeals, loading, addToProgress, dismissNotification } = useDeliveredMealNotifications();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (pendingMeals.length === 0) {
    return null;
  }

  const handleAddToProgress = async (meal: typeof pendingMeals[0]) => {
    setProcessingId(meal.id);
    await addToProgress(meal);
    setProcessingId(null);
  };

  const handleDismiss = async (id: string) => {
    setProcessingId(id);
    await dismissNotification(id);
    setProcessingId(null);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
        <Utensils className="w-4 h-4" />
        Delivered Meals - Add to Progress
      </h3>
      
      {pendingMeals.map((meal) => (
        <Card key={meal.id} className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium text-sm">{meal.meal_name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your order has been delivered! Add it to your progress?
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-orange-600">
                    <Flame className="w-3 h-3" />
                    {meal.calories} cal
                  </span>
                  <span className="text-emerald-600">P: {meal.protein_g}g</span>
                  <span className="text-amber-600">C: {meal.carbs_g}g</span>
                  <span className="text-blue-600">F: {meal.fat_g}g</span>
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
                  className="h-8 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleAddToProgress(meal)}
                  disabled={processingId === meal.id || loading}
                >
                  {processingId === meal.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
