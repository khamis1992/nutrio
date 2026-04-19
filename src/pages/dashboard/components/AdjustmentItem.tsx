import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, TrendingUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface AdjustmentItemProps {
  adjustment: {
    id: string;
    adjustment_type: string;
    ai_reason: string;
    confidence_score: number;
    was_accepted: boolean;
    created_at: string;
    previous_values: any;
    new_values: any;
  };
}

export function AdjustmentItem({ adjustment }: AdjustmentItemProps) {
  return (
    <Card 
      key={adjustment.id}
      className={cn(
        "transition-all hover:shadow-lg",
        adjustment.was_accepted ? "border-emerald-200 bg-emerald-50/30" : ""
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge 
                variant={adjustment.was_accepted ? "default" : "secondary"}
                className={cn(
                  adjustment.was_accepted 
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" 
                    : ""
                )}
              >
                {adjustment.was_accepted ? (
                  <>
                    <Award className="w-3 h-3 mr-1" />
                    Applied
                  </>
                ) : (
                  "Pending"
                )}
              </Badge>
              <span className="text-sm text-slate-400">
                {format(new Date(adjustment.created_at), "MMM d, yyyy")}
              </span>
            </div>
            
            <h3 className="font-semibold text-slate-900 mb-2 capitalize">
              {adjustment.adjustment_type} Adjustment
            </h3>
            
            <p className="text-slate-600 text-sm mb-3">
              {adjustment.ai_reason}
            </p>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-slate-500">
                Confidence: {Math.round((adjustment.confidence_score || 0) * 100)}%
              </div>
              {adjustment.previous_values && adjustment.new_values && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">
                    {adjustment.previous_values.calories} → {adjustment.new_values.calories} cal
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              )}
            </div>
          </div>

          {!adjustment.was_accepted && (
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
              Review
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
