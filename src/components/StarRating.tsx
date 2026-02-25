import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRate?: (rating: number) => void;
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

const containerClasses = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

export function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onRate,
  className,
}: StarRatingProps) {
  return (
    <div className={cn("flex items-center", containerClasses[size], className)}>
      {Array.from({ length: maxRating }).map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= rating;
        const isHalf = !isFilled && starValue - 0.5 <= rating;

        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onRate?.(starValue)}
            className={cn(
              "relative transition-colors",
              interactive && "cursor-pointer hover:scale-110",
              !interactive && "cursor-default"
            )}
            aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
          >
            {/* Background star (empty) */}
            <Star
              className={cn(
                sizeClasses[size],
                "text-muted stroke-[1.5]"
              )}
            />
            
            {/* Filled star overlay */}
            <div
              className={cn(
                "absolute inset-0 overflow-hidden",
                isFilled ? "w-full" : isHalf ? "w-1/2" : "w-0"
              )}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "fill-amber-400 text-amber-400 stroke-[1.5]"
                )}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

interface RatingDisplayProps {
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

export function RatingDisplay({
  rating,
  reviewCount,
  size = "md",
  showCount = true,
  className,
}: RatingDisplayProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StarRating rating={rating} size={size} />
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "font-semibold",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-lg"
        )}>
          {rating.toFixed(1)}
        </span>
        {showCount && reviewCount !== undefined && (
          <span className="text-muted-foreground text-sm">
            ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
          </span>
        )}
      </div>
    </div>
  );
}

interface RatingBreakdownProps {
  fiveStar: number;
  fourStar: number;
  threeStar: number;
  twoStar: number;
  oneStar: number;
  total: number;
  className?: string;
}

export function RatingBreakdown({
  fiveStar,
  fourStar,
  threeStar,
  twoStar,
  oneStar,
  total,
  className,
}: RatingBreakdownProps) {
  const breakdown = [
    { stars: 5, count: fiveStar },
    { stars: 4, count: fourStar },
    { stars: 3, count: threeStar },
    { stars: 2, count: twoStar },
    { stars: 1, count: oneStar },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      {breakdown.map(({ stars, count }) => {
        const percentage = total > 0 ? (count / total) * 100 : 0;
        
        return (
          <div key={stars} className="flex items-center gap-3">
            <span className="text-sm font-medium w-8">{stars} ★</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-10 text-right">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
