import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";

interface WeeklyAdherenceProps {
  weeklyStats: Array<{
    week_start: string;
    adherence_rate: number;
    meals_planned: number;
    meals_ordered: number;
  }>;
}

export function WeeklyAdherence({ weeklyStats }: WeeklyAdherenceProps) {
  return (
    <div className="space-y-6">
      {[...weeklyStats].reverse().map((week) => (
        <div key={week.week_start} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Week of {format(parseISO(week.week_start), "MMM d")}
            </span>
            <span className="text-sm font-semibold text-primary">
              {week.meals_ordered}/{week.meals_planned} meals
            </span>
          </div>
          <Progress value={week.adherence_rate} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {Math.round(week.adherence_rate)}% adherence rate
          </p>
        </div>
      ))}
    </div>
  );
}

export function WeeklyAdherenceSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}
