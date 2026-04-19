import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from "recharts";
import { TrendingDown } from "lucide-react";
import { format } from "date-fns";

interface WeightProgressProps {
  weightLogs: Array<{ id: string; weight_kg: number; logged_at: string }>;
}

export function WeightProgress({ weightLogs }: WeightProgressProps) {
  if (weightLogs.length < 2) {
    return (
      <div className="text-center py-16">
        <TrendingDown className="w-16 h-16 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-600 mb-2">Start tracking your weight</p>
        <p className="text-sm text-slate-400">
          Log your weight regularly to see progress
        </p>
      </div>
    );
  }

  const weightChartData = weightLogs.map(log => ({
    date: format(new Date(log.logged_at), "MMM d"),
    weight: log.weight_kg,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-emerald-500" />
          Weight Progress (Last 30 Days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis 
                stroke="#64748b"
                fontSize={12}
                domain={["dataMin - 1", "dataMax + 1"]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "white", 
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px"
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
