import { Skeleton } from "@/components/ui/skeleton";

export const MealDetailSkeleton = () => (
  <div className="min-h-screen bg-background">
    <Skeleton className="w-full h-[50vh]" />
    <div className="px-4 -mt-20 relative z-10 space-y-4">
      <Skeleton className="w-full h-48 rounded-3xl" />
      <Skeleton className="w-full h-32 rounded-3xl" />
      <Skeleton className="w-full h-64 rounded-3xl" />
    </div>
  </div>
);
