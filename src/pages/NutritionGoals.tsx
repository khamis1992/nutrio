import { useNavigate } from "react-router-dom";
import { ArrowLeft, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalsManagement } from "@/components/GoalsManagement";

const NutritionGoals = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/40 pb-4 pt-safe">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-muted/60 backdrop-blur-md">
        <div className="flex items-center gap-3 px-4 py-4 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-base font-semibold">Nutrition Goals</h1>
            <p className="text-xs text-muted-foreground">Set your body metrics and nutrition targets</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Nutrition Goals</h2>
            <p className="mt-1 text-sm text-muted-foreground">Set your body metrics and nutrition targets</p>
          </div>
          <div className="relative shrink-0">
            <div className="relative h-20 w-20 rounded-full border border-emerald-200 bg-emerald-50">
              <div className="absolute inset-0 grid place-items-center">
                <Target className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        <GoalsManagement />
      </div>
    </div>
  );
};

export default NutritionGoals;
