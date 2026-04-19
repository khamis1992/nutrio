import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Chart } from "recharts";

export function WeightChartSkeleton() {
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-5 w-5 rounded-sm" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="h-80 w-full">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-4 w-40 mx-auto mb-2 rounded bg-slate-200 animate-pulse" />
              <div className="h-3 w-64 mx-auto rounded bg-slate-200 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MacroChartSkeleton() {
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-5 w-5 rounded-sm" />
          <Skeleton className="h-6 w-36" />
        </div>
        <div className="h-64 mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </div>
        <div className="flex justify-center gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function EmptyMacroState() {
  return (
    <Card>
      <div className="p-6">
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100" />
            <Skeleton className="h-4 w-40 mx-auto mb-2" />
            <Skeleton className="h-3 w-48 mx-auto" />
          </div>
        </div>
      </div>
    </Card>
  );
}
