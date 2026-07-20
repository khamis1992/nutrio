import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BodyProgressChartPoint {
  date: string;
  weight: number;
  waist: number | null;
  bodyFat: number | null;
}

interface WeightTrendChartProps {
  data: BodyProgressChartPoint[];
}

export function WeightTrendChart({ data }: WeightTrendChartProps) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} domain={["dataMin - 2", "dataMax + 2"]} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#weightGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
