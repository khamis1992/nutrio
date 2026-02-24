import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  RotateCcw, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Info
} from "lucide-react";
import { useRolloverCredits, useRolloverExpiryCountdown } from "@/hooks/useRolloverCredits";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";

interface RolloverCreditsDisplayProps {
  subscriptionId: string;
  className?: string;
}

export function RolloverCreditsDisplay({ 
  subscriptionId, 
  className 
}: RolloverCreditsDisplayProps) {
  const { data: rolloverInfo, isLoading } = useRolloverCredits(subscriptionId);

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="p-6">
          <div className="h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!rolloverInfo || rolloverInfo.rollover_credits === 0) {
    return null; // Don't show if no rollover credits
  }

  const { rollover_credits, expiry_date, total_credits, new_credits } = rolloverInfo;
  const expiryCountdown = useRolloverExpiryCountdown(expiry_date);
  
  // Calculate percentage
  const rolloverPercentage = total_credits > 0 
    ? (rollover_credits / total_credits) * 100 
    : 0;

  return (
    <Card className={cn("border-l-4 border-l-amber-500", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-amber-500" />
            Rollover Credits
          </span>
          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
            {Math.round(rolloverPercentage)}% of total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credits Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Rollover Credits</span>
            <span className="text-lg font-bold text-amber-600">{rollover_credits}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">New Credits</span>
            <span className="text-sm font-medium">{new_credits}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t">
            <span className="text-sm font-medium">Total Credits</span>
            <span className="text-lg font-bold">{total_credits}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress 
            value={rolloverPercentage} 
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            Rollover credits will be consumed first
          </p>
        </div>

        {/* Expiry Information */}
        {expiry_date && expiryCountdown && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg text-sm",
            expiryCountdown.isExpired 
              ? "bg-red-50 text-red-700"
              : expiryCountdown.isExpiringSoon
              ? "bg-amber-50 text-amber-700"
              : "bg-green-50 text-green-700"
          )}>
            {expiryCountdown.isExpired ? (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Clock className="h-4 w-4 flex-shrink-0" />
            )}
            <div>
              {expiryCountdown.isExpired ? (
                <span className="font-medium">Rollover credits expired</span>
              ) : (
                <>
                  <span className="font-medium">
                    {expiryCountdown.days} days remaining
                  </span>
                  <p className="text-xs opacity-80">
                    Expires on {format(new Date(expiry_date), "MMM dd, yyyy")}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Consumption Priority Note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-2 rounded">
          <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
          <p>
            Your rollover credits are consumed before new credits. 
            Make sure to use them before they expire!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for credit meter
export function RolloverCreditsBadge({ 
  rolloverCredits,
  className 
}: { 
  rolloverCredits: number;
  className?: string;
}) {
  if (rolloverCredits === 0) return null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <RotateCcw className="h-3 w-3 text-amber-500" />
      <span className="text-xs font-medium text-amber-600">
        {rolloverCredits} rollover
      </span>
    </div>
  );
}

// Detailed breakdown for checkout/order flow
export function RolloverCreditBreakdown({
  rolloverCredits,
  newCredits,
  orderTotal,
  className,
}: {
  rolloverCredits: number;
  newCredits: number;
  orderTotal: number;
  className?: string;
}) {
  const fromRollover = Math.min(rolloverCredits, orderTotal);
  const fromNew = Math.max(0, orderTotal - rolloverCredits);
  const remainingRollover = rolloverCredits - fromRollover;
  const remainingNew = newCredits - fromNew;

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      <div className="flex justify-between items-center">
        <span className="flex items-center gap-1 text-amber-600">
          <RotateCcw className="h-3 w-3" />
          From Rollover
        </span>
        <span className="font-medium">{fromRollover}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">From New Credits</span>
        <span className="font-medium">{fromNew}</span>
      </div>
      <div className="border-t pt-2 mt-2">
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Remaining Rollover</span>
          <span>{remainingRollover}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Remaining New Credits</span>
          <span>{remainingNew}</span>
        </div>
      </div>
    </div>
  );
}
