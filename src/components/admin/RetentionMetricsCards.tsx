import { Activity, Award, Calendar, RotateCcw, Snowflake, Users } from "lucide-react";

import { AdminMetricTile } from "@/components/admin/AdminPrimitives";
import type { RetentionAnalyticsSummary } from "@/types/retention";

interface RetentionMetricsCardsProps {
  metrics: RetentionAnalyticsSummary;
}

export function RetentionMetricsCards({ metrics }: RetentionMetricsCardsProps) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <AdminMetricTile label="Total Rollovers" value={metrics.totalRollovers} icon={RotateCcw} />
      <AdminMetricTile label="Rollover Credits" value={metrics.totalRolloverCredits} icon={Award} />
      <AdminMetricTile label="Active Freezes" value={metrics.activeFreezes} icon={Snowflake} />
      <AdminMetricTile label="Completed Freezes" value={metrics.completedFreezes} icon={Calendar} />
      <AdminMetricTile label="Average Health Score" value={`${metrics.averageHealthScore}%`} icon={Activity} />
      <AdminMetricTile label="Users With Metrics" value={metrics.usersWithMetrics} icon={Users} />
    </section>
  );
}
