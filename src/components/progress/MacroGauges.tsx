import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MacroGaugeProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color: "emerald" | "amber" | "blue" | "red" | "purple";
}

export function MacroGauge({ label, consumed, target, unit, color }: MacroGaugeProps) {
  const percentage = Math.min(100, Math.round((consumed / target) * 100));
  const strokeDashoffset = 283 - (283 * percentage) / 100;

  const colorClasses = {
    emerald: {
      stroke: "stroke-emerald-500",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      light: "text-emerald-500",
    },
    amber: {
      stroke: "stroke-amber-500",
      bg: "bg-amber-50",
      text: "text-amber-600",
      light: "text-amber-500",
    },
    blue: {
      stroke: "stroke-blue-500",
      bg: "bg-blue-50",
      text: "text-blue-600",
      light: "text-blue-500",
    },
    red: {
      stroke: "stroke-red-500",
      bg: "bg-red-50",
      text: "text-red-600",
      light: "text-red-500",
    },
    purple: {
      stroke: "stroke-purple-500",
      bg: "bg-purple-50",
      text: "text-purple-600",
      light: "text-purple-500",
    },
  };

  const colors = colorClasses[color];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            className={cn("transition-all duration-500", colors.stroke)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="283"
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-xl font-bold", colors.text)}>{percentage}%</span>
          <span className="text-xs text-slate-400">{consumed}{unit}</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-slate-500">Target: {target}{unit}</p>
      </div>
    </div>
  );
}

interface MacroGaugesProps {
  protein: { consumed: number; target: number };
  carbs: { consumed: number; target: number };
  fat: { consumed: number; target: number };
}

export function MacroGauges({ protein, carbs, fat }: MacroGaugesProps) {
  return (
    <Card className="border-0 shadow-lg shadow-emerald-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          Daily Macro Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <MacroGauge
            label="Protein"
            consumed={protein.consumed}
            target={protein.target}
            unit="g"
            color="red"
          />
          <MacroGauge
            label="Carbs"
            consumed={carbs.consumed}
            target={carbs.target}
            unit="g"
            color="amber"
          />
          <MacroGauge
            label="Fat"
            consumed={fat.consumed}
            target={fat.target}
            unit="g"
            color="blue"
          />
        </div>
      </CardContent>
    </Card>
  );
}
