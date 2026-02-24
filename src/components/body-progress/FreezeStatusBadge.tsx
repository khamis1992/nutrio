import { Badge } from "@/components/ui/badge";
import { Snowflake, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FreezeStatusBadgeProps {
  isFrozen: boolean;
  freezeEndDate?: string;
  className?: string;
}

export function FreezeStatusBadge({ isFrozen, freezeEndDate, className }: FreezeStatusBadgeProps) {
  if (!isFrozen) return null;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-cyan-50 border-cyan-200 text-cyan-700 gap-1",
        className
      )}
    >
      <Snowflake className="w-3 h-3" />
      <span>Frozen</span>
      {freezeEndDate && (
        <span className="text-cyan-600">
          until {new Date(freezeEndDate).toLocaleDateString()}
        </span>
      )}
    </Badge>
  );
}

interface FreezeAlertProps {
  isFrozen: boolean;
  freezeStartDate?: string;
  freezeEndDate?: string;
  className?: string;
}

export function FreezeAlert({ isFrozen, freezeStartDate, freezeEndDate, className }: FreezeAlertProps) {
  if (!isFrozen) return null;

  return (
    <div className={cn(
      "flex items-start gap-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg",
      className
    )}>
      <AlertCircle className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-cyan-900">
          Subscription Currently Frozen
        </p>
        <p className="text-cyan-700">
          This customer's subscription is frozen from{" "}
          {freezeStartDate && new Date(freezeStartDate).toLocaleDateString()} to{" "}
          {freezeEndDate && new Date(freezeEndDate).toLocaleDateString()}. 
          No new orders can be placed during this period.
        </p>
      </div>
    </div>
  );
}
