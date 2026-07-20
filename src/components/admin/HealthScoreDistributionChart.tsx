import { Activity } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { AdminEmptyState, AdminPanel } from "@/components/admin/AdminPrimitives";
import type { HealthScoreDistributionBucket } from "@/types/retention";

const COLORS = ["#22C7A1", "#38BDF8", "#7C83F6", "#FB6B7A"];

interface HealthScoreDistributionChartProps {
  data: HealthScoreDistributionBucket[];
}

export function HealthScoreDistributionChart({ data }: HealthScoreDistributionChartProps) {
  const hasData = data.some((bucket) => bucket.value > 0);

  return (
    <AdminPanel>
      <h3 className="mb-4 text-sm font-black uppercase tracking-[0.14em] text-slate-500">
        Health Score Distribution
      </h3>
      {hasData ? (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={92} label>
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <AdminEmptyState
          icon={Activity}
          title="No health scores yet"
          description="Scores will appear after customers log meals and metrics."
        />
      )}
    </AdminPanel>
  );
}
