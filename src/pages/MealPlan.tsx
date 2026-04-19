import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MealPlanGenerator } from "@/components/MealPlanGenerator";


export default function MealPlan() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 pt-safe">
        <div className="flex items-center px-4 h-14 rtl:flex-row-reverse">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/progress?tab=week")}
            className="mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Weekly Meal Plan</h1>
        </div>
      </header>

      {/* Content */}
      <main className="p-4 max-w-4xl mx-auto">
        <MealPlanGenerator />
      </main>

    </div>
  );
}
