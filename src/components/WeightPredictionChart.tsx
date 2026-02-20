import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine
} from "recharts";
import { TrendingUp, Info } from "lucide-react";

interface WeightPredictionChartProps {
  predictions: Array<{
    date: string;
    predicted_weight: number;
    confidence_lower: number;
    confidence_upper: number;
  }>;
  currentWeight: number;
  targetWeight: number;
  startWeight?: number;
}

export const WeightPredictionChart = ({
  predictions,
  currentWeight,
  targetWeight,
  startWeight
}: WeightPredictionChartProps) => {
  if (!predictions || predictions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weight Forecast
          </CardTitle>
          <CardDescription>4-week prediction based on your current pace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Log your weight for 7+ days to see predictions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for chart
  const chartData = [
    { 
      date: "Now", 
      weight: currentWeight, 
      type: "current",
      lower: currentWeight,
      upper: currentWeight
    },
    ...predictions.map(p => ({
      date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      weight: p.predicted_weight,
      type: "predicted",
      lower: p.confidence_lower,
      upper: p.confidence_upper
    }))
  ];

  // Calculate progress percentage
  const totalChange = Math.abs(targetWeight - (startWeight || currentWeight));
  const currentChange = Math.abs(currentWeight - (startWeight || currentWeight));
  const progressPercent = totalChange > 0 ? (currentChange / totalChange) * 100 : 0;

  // Estimate weeks to goal
  const lastPrediction = predictions[predictions.length - 1];
  const weeksToGoal = lastPrediction 
    ? Math.ceil(Math.abs(targetWeight - lastPrediction.predicted_weight) / Math.abs((lastPrediction.predicted_weight - currentWeight) / 4))
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Weight Forecast
            </CardTitle>
            <CardDescription>4-week prediction based on your current pace</CardDescription>
          </div>
          {weeksToGoal && weeksToGoal > 0 && weeksToGoal < 52 && (
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">~{weeksToGoal} weeks</p>
              <p className="text-xs text-muted-foreground">to goal</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Current</p>
            <p className="text-lg font-bold">{currentWeight.toFixed(1)} kg</p>
          </div>
          <div className="bg-primary/10 p-3 rounded-lg">
            <p className="text-xs text-primary mb-1">Target</p>
            <p className="text-lg font-bold text-primary">{targetWeight.toFixed(1)} kg</p>
          </div>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Progress</p>
            <p className="text-lg font-bold">{progressPercent.toFixed(0)}%</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis 
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => `${value}kg`}
              />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Weight']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              
              {/* Confidence interval area */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="transparent"
                fill="url(#confidenceGradient)"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="transparent"
                fill="white"
              />
              
              {/* Target weight line */}
              <ReferenceLine 
                y={targetWeight} 
                stroke="hsl(var(--primary))" 
                strokeDasharray="5 5"
                label={{ value: "Goal", fill: "hsl(var(--primary))", fontSize: 12, position: 'right' }}
              />
              
              {/* Weight line */}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Predicted weight</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary/20" />
            <span>Confidence range</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 border-t-2 border-dashed border-primary" />
            <span>Goal</span>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center">
          Predictions based on your current pace. Actual results may vary based on adherence and other factors.
        </p>
      </CardContent>
    </Card>
  );
};
