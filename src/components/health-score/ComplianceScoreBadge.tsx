import { Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HealthScoreCategory } from "@/types/retention";

interface ComplianceScoreBadgeProps {
  score?: number | null;
  category?: HealthScoreCategory | null;
  compact?: boolean;
}

function inferCategory(score?: number | null): HealthScoreCategory {
  if ((score ?? 0) >= 80) return "green";
  if ((score ?? 0) >= 60) return "orange";
  return "red";
}

export function ComplianceScoreBadge({
  score,
  category,
  compact = false,
}: ComplianceScoreBadgeProps) {
  if (typeof score !== "number") return null;

  const resolvedCategory = category ?? inferCategory(score);

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        resolvedCategory === "green" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        resolvedCategory === "orange" && "border-amber-200 bg-amber-50 text-amber-700",
        resolvedCategory === "red" && "border-rose-200 bg-rose-50 text-rose-700",
      )}
      title={`Health compliance score: ${score}/100`}
    >
      <Activity className="h-3 w-3" />
      {compact ? score : `${score}/100`}
    </Badge>
  );
}
