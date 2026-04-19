import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Dumbbell, Calendar } from "lucide-react";

export function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
            <Target className="w-5 h-5" />
            Update Goals
          </h3>
          <p className="text-sm text-emerald-700 mb-4">
            Changed your fitness goals? Update your targets.
          </p>
          <button className="w-full border border-emerald-300 text-emerald-700 hover:bg-emerald-100 px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Edit Profile
          </button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            View Meal Plan
          </h3>
          <p className="text-sm text-violet-700 mb-4">
            Check your AI-generated weekly meal plan.
          </p>
          <button className="w-full border border-violet-300 text-violet-700 hover:bg-violet-100 px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Open Planner
          </button>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
            <Dumbbell className="w-5 h-5" />
            Log Weight
          </h3>
          <p className="text-sm text-amber-700 mb-4">
            Track your progress with regular weigh-ins.
          </p>
          <button className="w-full border border-amber-300 text-amber-700 hover:bg-amber-100 px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Add Entry
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
