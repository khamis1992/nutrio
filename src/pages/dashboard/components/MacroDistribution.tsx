import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import { Target } from "lucide-react";
import { format } from "date-fns";

interface MacroDistributionProps {
  nutritionData: {
    target_calories: number;
    target_protein: number;
    target_carbs: number;
    target_fats: number;
    bmr: number;
    tdee: number;
  } | null;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export function MacroDistribution({ nutritionData }: MacroDistributionProps) {
  if (!nutritionData) {
    return null;
  }

  const macroData = [
    { name: "Protein", value: nutritionData.target_protein, color: COLORS[0] },
    { name: "Carbs", value: nutritionData.target_carbs, color: COLORS[1] },
    { name: "Fats", value: nutritionData.target_fats, color: COLORS[2] },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="w-5 h-5 text-emerald-500" />
          Macro Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={macroData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {macroData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-4">
          {macroData.map((macro) => (
            <div key={macro.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: macro.color }}
              />
              <span className="text-sm text-slate-600">
                {macro.name}: {macro.value}g
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
