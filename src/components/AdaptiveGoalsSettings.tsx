import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Calendar, Info, Play, History } from "lucide-react";
import { useAdaptiveGoals } from "@/hooks/useAdaptiveGoals";

export const AdaptiveGoalsSettings = () => {
  const {
    settings,
    adjustmentHistory,
    settingsLoading,
    historyLoading,
    updateSettings,
    analyzeNow
  } = useAdaptiveGoals();

  if (settingsLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">Loading settings...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Smart Goal Adjustment</CardTitle>
            <CardDescription>
              Let AI automatically adjust your nutrition targets based on your progress
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-adjust" className="text-base">Enable Auto-Adjustment</Label>
            <p className="text-sm text-muted-foreground">
              AI will analyze your progress and suggest changes
            </p>
          </div>
          <Switch
            id="auto-adjust"
            checked={settings?.auto_adjust_enabled ?? true}
            onCheckedChange={(checked) => updateSettings({ auto_adjust_enabled: checked })}
          />
        </div>

        {settings?.auto_adjust_enabled && (
          <>
            <Separator />

            {/* Adjustment Frequency */}
            <div className="space-y-3">
              <Label htmlFor="frequency" className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Adjustment Frequency
              </Label>
              <Select
                value={settings?.adjustment_frequency || 'weekly'}
                onValueChange={(value: 'weekly' | 'biweekly' | 'monthly') => 
                  updateSettings({ adjustment_frequency: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">
                    Weekly (Recommended) - Analyzes every 7 days
                  </SelectItem>
                  <SelectItem value="biweekly">
                    Every 2 weeks - Less frequent changes
                  </SelectItem>
                  <SelectItem value="monthly">
                    Monthly - Minimal adjustments
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How often the AI will review your progress and suggest changes
              </p>
            </div>

            <Separator />

            {/* How it Works */}
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">How Smart Adjustment Works:</p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">1.</span>
                  <span>Analyzes your weight trends and adherence weekly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">2.</span>
                  <span>Detects plateaus (3+ weeks no progress)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">3.</span>
                  <span>Suggests calorie adjustments (±100-150 calories)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">4.</span>
                  <span>Stays within safe range (1200-4000 calories)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">5.</span>
                  <span>You review and approve before changes apply</span>
                </li>
              </ul>
            </div>

            <Separator />

            {/* Manual Analysis Button */}
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <Play className="h-4 w-4" />
                Run Analysis Now
              </Label>
              <Button 
                onClick={analyzeNow} 
                variant="outline" 
                className="w-full"
              >
                Analyze My Progress
              </Button>
              <p className="text-xs text-muted-foreground">
                Trigger an immediate analysis instead of waiting for the next scheduled check
              </p>
            </div>
          </>
        )}

        {/* Adjustment History */}
        {!historyLoading && adjustmentHistory.length > 0 && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Adjustments
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {adjustmentHistory.slice(0, 5).map((adjustment) => (
                  <div 
                    key={adjustment.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {new Date(adjustment.adjustment_date).toLocaleDateString()}
                      </p>
                      <p className="text-muted-foreground text-xs line-clamp-1">
                        {adjustment.reason}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={adjustment.applied ? "default" : "secondary"}>
                        {adjustment.applied ? "Applied" : "Pending"}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {adjustment.previous_calories} → {adjustment.new_calories}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
