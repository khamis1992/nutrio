import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export function AdjustmentListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
            <Skeleton className="h-5 w-48 mb-3" />
            <Skeleton className="h-3 w-full mb-3" />
            <Skeleton className="h-3 w-3/4 mb-4" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function EmptyAdjustmentsSkeleton() {
  return (
    <Card>
      <div className="p-12 text-center">
        <Skeleton className="h-6 w-40 mx-auto mb-3" />
        <Skeleton className="h-4 w-64 mx-auto mb-4" />
        <Skeleton className="h-4 w-56 mx-auto mb-6" />
        <Skeleton className="h-9 w-40 mx-auto" />
      </div>
    </Card>
  );
}
