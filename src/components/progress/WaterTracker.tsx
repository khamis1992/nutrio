import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Droplets, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WaterTrackerProps {
  dailySummary: {
    total: number;
    target: number;
    percentage: number;
    logs: Array<{ id: string; glasses: number; log_date: string }>;
  } | null;
  loading: boolean;
  onAddWater: (glasses: number) => Promise<void>;
  onRemoveWater: (id: string) => Promise<void>;
}

const QUICK_ADD_AMOUNTS = [1, 2, 3, 4];

export function WaterTracker({ dailySummary, loading, onAddWater, onRemoveWater }: WaterTrackerProps) {
  const { toast } = useToast();
  const [adding, setAdding] = useState<number | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleAdd = async (glasses: number) => {
    setAdding(glasses);
    try {
      await onAddWater(glasses);
      toast({
        title: "Water added",
        description: `${glasses} glass${glasses > 1 ? 'es' : ''} logged`,
      });
    } catch (error) {
      toast({
        title: "Failed to add water",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setAdding(null);
    }
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      await onRemoveWater(id);
      toast({
        title: "Entry removed",
        description: "Water intake entry deleted",
      });
    } catch (error) {
      toast({
        title: "Failed to remove entry",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setRemoving(null);
    }
  };

  const getHydrationStatus = (percentage: number) => {
    if (percentage >= 100) return { text: "Goal reached!", color: "text-emerald-600", bgColor: "bg-emerald-100" };
    if (percentage >= 75) return { text: "Almost there", color: "text-blue-600", bgColor: "bg-blue-100" };
    if (percentage >= 50) return { text: "Good progress", color: "text-cyan-600", bgColor: "bg-cyan-100" };
    if (percentage >= 25) return { text: "Keep drinking", color: "text-amber-600", bgColor: "bg-amber-100" };
    return { text: "Start hydrating", color: "text-orange-600", bgColor: "bg-orange-100" };
  };

  const status = getHydrationStatus(dailySummary?.percentage || 0);

  return (
    <Card className="border-0 shadow-lg shadow-cyan-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Droplets className="w-4 h-4 text-cyan-500" />
          Water Intake
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Progress Display */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="hsl(199 89% 48%)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(dailySummary?.percentage || 0) * 2.26} 226`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-slate-900">
                {dailySummary?.percentage || 0}%
              </span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {dailySummary?.total || 0}
              </span>
              <span className="text-slate-500">/ {dailySummary?.target || 8} glasses</span>
            </div>
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bgColor} ${status.color} mt-1`}>
              {status.text}
            </div>
          </div>
        </div>

        {/* Quick Add Buttons */}
        <div className="grid grid-cols-4 gap-2">
          {QUICK_ADD_AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              size="sm"
              onClick={() => handleAdd(amount)}
              disabled={loading || adding !== null}
              className="flex flex-col items-center gap-1 h-auto py-2 hover:bg-cyan-50 hover:border-cyan-200"
            >
              <Plus className="w-4 h-4 text-cyan-500" />
              <span className="text-xs">+{amount}</span>
            </Button>
          ))}
        </div>

        {/* Recent Logs */}
        {dailySummary && dailySummary.logs.length > 0 && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Today&apos;s entries</p>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {dailySummary.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-slate-50 text-sm"
                >
                  <span className="text-slate-600">{log.glasses} glass{log.glasses > 1 ? 'es' : ''}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemove(log.id)}
                      disabled={removing === log.id}
                      className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
