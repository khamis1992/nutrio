import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Dumbbell, Calendar } from "lucide-react";

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Update Goals
          </h3>
          <p className="text-sm text-primary/70 mb-4">
            Changed your fitness goals? Update your targets.
          </p>
          <button className="w-full border border-primary/30 text-primary hover:bg-primary/10 px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Edit Profile
          </button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-primary mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            View Meal Plan
          </h3>
          <p className="text-sm text-primary/70 mb-4">
            Check your AI-generated weekly meal plan.
          </p>
          <button className="w-full border border-primary/30 text-primary hover:bg-primary/10 px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Open Planner
          </button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-warning mb-2 flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Log Weight
          </h3>
          <p className="text-sm text-warning/70 mb-4">
            Track your progress with regular weigh-ins.
          </p>
          <button className="w-full border border-warning/30 text-warning hover:bg-warning/10 px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Add Entry
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
