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
  ComposedChart,
  ReferenceLine,
  Legend,
} from "recharts";
import { TrendingUp, Info } from "lucide-react";

interface ChartPoint {
  date: string;
  label: string;
  actual: number | null;
  predicted: number | null;
  lower: number | null;
  upper: number | null;
}

interface WeightPredictionChartProps {
  predictions: Array<{
    date: string;
    predicted_weight: number;
    confidence_lower: number;
    confidence_upper: number;
  }>;
  weightChartData?: ChartPoint[];
  currentWeight: number;
  targetWeight: number;
  startWeight?: number;
}

export const WeightPredictionChart = ({
  predictions,
  weightChartData,
  currentWeight,
  targetWeight,
  startWeight
}: WeightPredictionChartProps) => {
  // Use rich chart data if provided, otherwise fall back to old predictions-only path
  const hasRichData = weightChartData && weightChartData.length > 0;

  // No data or weight not configured
  const hasNoData = !hasRichData && (!predictions || predictions.length === 0);
  const weightNotSet = !hasRichData && (!currentWeight || currentWeight === 0);
  const targetNotSet = !targetWeight || targetWeight === 0;

  if (hasNoData || weightNotSet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Weight Forecast
          </CardTitle>
          <CardDescription>4-week AI prediction based on your progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex flex-col items-center justify-center gap-4">
            {/* Mini placeholder chart lines */}
            <div className="w-full h-24 relative opacity-20 pointer-events-none">
              <svg viewBox="0 0 300 80" className="w-full h-full">
                <polyline
                  points="0,60 60,50 120,35 180,25 240,20 300,15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  className="text-primary"
                />
                <polyline
                  points="0,60 60,55 120,48 180,42 240,38 300,32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-muted-foreground"
                />
              </svg>
            </div>

            <div className="text-center space-y-1">
              <Info className="h-6 w-6 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">
                {weightNotSet ? "Set your current weight" : "Log weight for 7+ days"}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {weightNotSet
                  ? "Go to Profile → update your current & target weight to unlock AI predictions."
                  : "Keep logging daily and your personalised forecast will appear here."}
              </p>
            </div>

            {weightNotSet && (
              <a
                href="/profile"
                className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 px-4 py-2 rounded-full transition-colors"
              >
                Set Up Weight Goal →
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Use rich data if available, otherwise build from old predictions
  const chartData: ChartPoint[] = hasRichData
    ? weightChartData!
    : [
        { date: "now", label: "Now", actual: currentWeight || null, predicted: null, lower: null, upper: null },
        ...predictions.map(p => ({
          date: p.date,
          label: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          actual: null,
          predicted: p.predicted_weight,
          lower: p.confidence_lower,
          upper: p.confidence_upper,
        })),
      ];

  // Stats from chart data
  const actualPoints = chartData.filter(d => d.actual !== null);
  const latestActual = actualPoints[actualPoints.length - 1]?.actual ?? currentWeight;
  const firstActual = actualPoints[0]?.actual ?? currentWeight;
  const lastPredicted = chartData.filter(d => d.predicted !== null).slice(-1)[0]?.predicted;
  const progressPercent = targetWeight && firstActual
    ? Math.min(100, Math.round(Math.abs(latestActual - firstActual) / Math.abs(targetWeight - firstActual) * 100))
    : 0;
  const allWeights = chartData.flatMap(d => [d.actual, d.predicted, d.lower, d.upper].filter(Boolean) as number[]);
  const yMin = Math.floor(Math.min(...allWeights) - 1);
  const yMax = Math.ceil(Math.max(...allWeights) + 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Weight Forecast
            </CardTitle>
            <CardDescription>
              {actualPoints.length} data point{actualPoints.length !== 1 ? "s" : ""} · 4-week projection
            </CardDescription>
          </div>
          {targetWeight > 0 && lastPredicted && (
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {lastPredicted > 0 ? `${lastPredicted.toFixed(1)} kg` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">in 4 weeks</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-muted p-3 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Current</p>
            <p className="text-lg font-bold">{latestActual > 0 ? `${latestActual.toFixed(1)}` : "—"} kg</p>
          </div>
          <div className="bg-primary/10 p-3 rounded-xl">
            <p className="text-xs text-primary mb-1">Target</p>
            <p className="text-lg font-bold text-primary">{targetWeight > 0 ? `${targetWeight.toFixed(1)}` : "—"} kg</p>
          </div>
          <div className="bg-muted p-3 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Progress</p>
            <p className="text-lg font-bold">{progressPercent}%</p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}kg`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  fontSize: 12,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                formatter={(value: number, name: string) => [
                  `${Number(value).toFixed(1)} kg`,
                  name === "actual" ? "Logged weight" : name === "predicted" ? "Forecast" : name,
                ]}
              />

              {/* Confidence band (upper – lower shaded area) */}
              <Area type="monotone" dataKey="upper" stroke="none" fill="url(#predGrad)" legendType="none" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="white" legendType="none" />

              {/* Actual logged weight */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={{ fill: "#22c55e", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
                connectNulls={false}
                name="actual"
              />

              {/* Predicted weight (dashed) */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#14b8a6"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ fill: "#14b8a6", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                name="predicted"
              />

              {/* Goal reference line */}
              {targetWeight > 0 && targetWeight >= yMin && targetWeight <= yMax && (
                <ReferenceLine
                  y={targetWeight}
                  stroke="#22c55e"
                  strokeDasharray="6 3"
                  strokeOpacity={0.5}
                  label={{ value: "Goal", fill: "#22c55e", fontSize: 11, position: "insideTopRight" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-green-500 rounded-full inline-block" />
            Logged weight
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t-2 border-dashed border-teal-500 inline-block" />
            4-week forecast
          </span>
          {targetWeight > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-green-400 opacity-60 inline-block" />
              Goal
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Forecast based on your actual logged weight trend.
        </p>
      </CardContent>
    </Card>
  );
};
