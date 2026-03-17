import { useState, useEffect } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  loadAutoDispatchRules,
  saveAutoDispatchRules,
  type AutoDispatchRule,
} from "@/fleet/services/orderDispatch";

function newRule(): AutoDispatchRule {
  return {
    id: crypto.randomUUID(),
    label: "New rule",
    enabled: false,
    triggerStatus: "ready_for_pickup",
    minWaitMinutes: 10,
    maxDriverDistanceKm: 5,
  };
}

export default function AutoDispatchSettings() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutoDispatchRule[]>([]);

  useEffect(() => {
    setRules(loadAutoDispatchRules());
  }, []);

  const save = (updated: AutoDispatchRule[]) => {
    setRules(updated);
    saveAutoDispatchRules(updated);
  };

  const handleToggle = (id: string) => {
    save(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const handleDelete = (id: string) => {
    save(rules.filter((r) => r.id !== id));
    toast({ title: "Rule deleted" });
  };

  const handleAdd = () => {
    save([...rules, newRule()]);
  };

  const handleChange = <K extends keyof AutoDispatchRule>(
    id: string,
    key: K,
    value: AutoDispatchRule[K]
  ) => {
    save(rules.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auto-Dispatch Rules</h1>
          <p className="text-muted-foreground">
            Define conditions under which orders are assigned automatically without operator action.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Zap className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No rules configured</p>
          <p className="text-sm mt-1">Add a rule to let the system dispatch orders automatically.</p>
        </div>
      )}

      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.id} className={rule.enabled ? "border-primary/40" : undefined}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(rule.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                      rule.enabled ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        rule.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <Input
                    value={rule.label}
                    onChange={(e) => handleChange(rule.id, "label", e.target.value)}
                    className="h-8 text-sm font-medium max-w-xs"
                  />
                  {rule.enabled && (
                    <Badge className="bg-primary/10 text-primary border border-primary/20">
                      <Zap className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Trigger status */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Trigger when order is</label>
                <select
                  value={rule.triggerStatus}
                  onChange={(e) =>
                    handleChange(rule.id, "triggerStatus", e.target.value as AutoDispatchRule["triggerStatus"])
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="ready_for_pickup">Ready for Pickup</option>
                  <option value="preparing">Preparing</option>
                </select>
              </div>

              {/* Min wait */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Minimum wait time</label>
                  <span className="text-sm font-semibold text-primary">{rule.minWaitMinutes} min</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={rule.minWaitMinutes}
                  onChange={(e) => handleChange(rule.id, "minWaitMinutes", Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 min</span><span>30 min</span>
                </div>
              </div>

              {/* Max driver distance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Max driver distance</label>
                  <span className="text-sm font-semibold text-primary">{rule.maxDriverDistanceKm} km</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={rule.maxDriverDistanceKm}
                  onChange={(e) => handleChange(rule.id, "maxDriverDistanceKm", Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 km</span><span>15 km</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-t pt-3">
                When enabled: if an order is <strong>{rule.triggerStatus === "ready_for_pickup" ? "ready for pickup" : "preparing"}</strong> and
                has been waiting ≥ <strong>{rule.minWaitMinutes} min</strong>, and the nearest eligible driver is within{" "}
                <strong>{rule.maxDriverDistanceKm} km</strong>, the system will auto-assign automatically.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
