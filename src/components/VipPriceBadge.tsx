import { Badge } from "@/components/ui/badge";
import { Crown, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface VipPriceBadgeProps {
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  hasDiscount: boolean;
  showOriginal?: boolean;
  size?: "sm" | "md" | "lg";
}

export function VipPriceBadge({
  originalPrice,
  discountedPrice,
  discountPercent,
  hasDiscount,
  showOriginal = true,
  size = "md",
}: VipPriceBadgeProps) {
  if (!hasDiscount) {
    return null;
  }

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="flex items-center gap-2">
      {showOriginal && (
        <span className={`line-through text-muted-foreground ${sizeClasses[size]}`}>
          {formatCurrency(originalPrice)}
        </span>
      )}
      <Badge 
        variant="outline" 
        className="bg-gradient-to-r from-violet-500 to-purple-500 border-0 text-white gap-1"
      >
        <Crown className="w-3 h-3" />
        {formatCurrency(discountedPrice)}
        <span className="opacity-75">(-{discountPercent}%)</span>
      </Badge>
    </div>
  );
}

interface VipDiscountIndicatorProps {
  discountPercent: number;
  className?: string;
}

export function VipDiscountIndicator({ discountPercent, className = "" }: VipDiscountIndicatorProps) {
  if (discountPercent <= 0) return null;

  return (
    <Badge 
      variant="outline" 
      className={`bg-gradient-to-r from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-700 dark:text-violet-300 ${className}`}
    >
      <Percent className="w-3 h-3 mr-1" />
      {discountPercent}% VIP Discount
    </Badge>
  );
}
