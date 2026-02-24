import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { cn } from "@/lib/utils";

interface RolloverCreditsDisplayProps {
  rolloverCredits: number;
  rollovers: {
    id: string;
    rollover_credits: number;
    expires_at: string;
    consumed: boolean;
  }[];
  billingCycleEnd: string;
}

export function RolloverCreditsDisplay({ 
  rolloverCredits, 
  rollovers,
  billingCycleEnd 
}: RolloverCreditsDisplayProps) {
  const totalRollover = rollovers.reduce((sum, r) => sum + r.rollover_credits, 0);
  const activeRollovers = rollovers.filter(r => !r.consumed);
  const hasRollover = totalRollover > 0;

  return (
    <Card className={cn(
      "border-2",
      hasRollover ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50" : "border-slate-200"
    )}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className={cn("w-5 h-5", hasRollover ? "text-emerald-600" : "text-slate-400")} />
            Rollover Credits
          </div>
          <Badge 
            variant={hasRollover ? "default" : "secondary"}
            className={cn(
              hasRollover && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            {totalRollover} credits
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <p className="text-sm text-slate-500 mb-1">Active Rollovers</p>
            <p className={cn(
              "text-2xl font-bold",
              hasRollover ? "text-emerald-600" : "text-slate-400"
            )}>
              {activeRollovers.length}
            </p>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <p className="text-sm text-slate-500 mb-1">Total Credits</p>
            <p className={cn(
              "text-2xl font-bold",
              hasRollover ? "text-emerald-600" : "text-slate-400"
            )}>
              {totalRollover}
            </p>
          </div>
        </div>

        {/* Rollover List */}
        {activeRollovers.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900">Active Rollovers</h4>
            {activeRollovers.map((rollover) => {
              const expiresAt = parseISO(rollover.expires_at);
              const isExpiringSoon = isAfter(new Date(), new Date(expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000));
              
              return (
                <div 
                  key={rollover.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    isExpiringSoon 
                      ? "bg-amber-50 border-amber-200" 
                      : "bg-white border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {isExpiringSoon ? (
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900">
                        {rollover.rollover_credits} credits
                      </p>
                      <p className={cn(
                        "text-sm",
                        isExpiringSoon ? "text-amber-600" : "text-slate-500"
                      )}>
                        {isExpiringSoon ? (
                          <>
                            <Clock className="w-3 h-3 inline mr-1" />
                            Expires {format(expiresAt, "MMM d, yyyy")}
                          </>
                        ) : (
                          <>Expires {format(expiresAt, "MMM d, yyyy")}</>
                        )}
                      </p>
                    </div>
                  </div>
                  {isExpiringSoon && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      Expiring Soon
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No rollover credits</p>
            <p className="text-sm mt-1">
              Unused credits rollover up to 20% at the end of each billing cycle
            </p>
          </div>
        )}

        {/* Info Footer */}
        <div className="p-4 bg-white rounded-lg border border-slate-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                <strong>How rollover works:</strong>
              </p>
              <ul className="text-sm text-slate-500 space-y-1 list-disc list-inside">
                <li>Up to 20% of unused credits rollover each cycle</li>
                <li>Rollover credits are consumed before new credits</li>
                <li>Rollover expires at the end of the next billing cycle</li>
                <li>Current cycle ends: {billingCycleEnd ? format(parseISO(billingCycleEnd), "MMMM d, yyyy") : "--"}</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
