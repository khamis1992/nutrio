import { useState, useEffect } from "react";
import { Plus, Trash2, Zap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <div className="space-y-5 text-[#020617]">
      <div className="flex items-center justify-between rounded-[26px] bg-white p-4 ring-1 ring-[#E5EAF1]">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#FB6B7A]">Automation</p>
          <h1 className="mt-1 text-[22px] font-black text-[#020617]">Auto-Dispatch Rules</h1>
          <p className="text-sm font-semibold text-[#64748B]">
            Define conditions under which orders are assigned automatically without operator action.
          </p>
        </div>
        <Button onClick={handleAdd} className="min-h-11 rounded-full bg-[#020617] font-black text-white shadow-none hover:bg-[#020617]/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 && (
        <div className="rounded-[26px] border border-dashed border-[#CBD5E1] bg-white p-12 text-center text-[#94A3B8]">
          <Zap className="mx-auto mb-3 h-8 w-8 text-[#FB6B7A]" />
          <p className="font-black text-[#020617]">No rules configured</p>
          <p className="mt-1 text-sm font-semibold">Add a rule to let the system dispatch orders automatically.</p>
        </div>
      )}

      <div className="space-y-4">
        {rules.map((rule) => (
          <Card key={rule.id} className={`rounded-[26px] border-0 bg-white shadow-none ring-1 ${rule.enabled ? "ring-[#22C7A1]/50" : "ring-[#E5EAF1]"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    type="button"
                    onClick={() => handleToggle(rule.id)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      rule.enabled ? "bg-[#22C7A1]" : "bg-[#E2E8F0]"
                    }`}
                  >
                    <span
                      className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        rule.enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <Input
                    value={rule.label}
                    onChange={(e) => handleChange(rule.id, "label", e.target.value)}
                    className="h-10 max-w-xs rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-sm font-black text-[#020617]"
                  />
                  {rule.enabled && (
                    <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">
                      <Zap className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)} className="rounded-full bg-[#FB6B7A]/10 text-[#FB6B7A] hover:bg-[#FB6B7A]/15">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Trigger status */}
              <div className="space-y-1">
                <label className="text-sm font-black text-[#020617]">Trigger when order is</label>
                <select
                  value={rule.triggerStatus}
                  onChange={(e) =>
                    handleChange(rule.id, "triggerStatus", e.target.value as AutoDispatchRule["triggerStatus"])
                  }
                  className="h-11 w-full rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617]"
                >
                  <option value="ready_for_pickup">Ready for Pickup</option>
                  <option value="preparing">Preparing</option>
                </select>
              </div>

              {/* Min wait */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-[#020617]">Minimum wait time</label>
                  <span className="text-sm font-black text-[#FB6B7A]">{rule.minWaitMinutes} min</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={rule.minWaitMinutes}
                  onChange={(e) => handleChange(rule.id, "minWaitMinutes", Number(e.target.value))}
                  className="w-full accent-[#FB6B7A]"
                />
                <div className="flex justify-between text-xs font-semibold text-[#94A3B8]">
                  <span>1 min</span><span>30 min</span>
                </div>
              </div>

              {/* Max driver distance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-black text-[#020617]">Max driver distance</label>
                  <span className="text-sm font-black text-[#38BDF8]">{rule.maxDriverDistanceKm} km</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={rule.maxDriverDistanceKm}
                  onChange={(e) => handleChange(rule.id, "maxDriverDistanceKm", Number(e.target.value))}
                  className="w-full accent-[#38BDF8]"
                />
                <div className="flex justify-between text-xs font-semibold text-[#94A3B8]">
                  <span>1 km</span><span>15 km</span>
                </div>
              </div>

              <p className="border-t border-[#E5EAF1] pt-3 text-xs font-semibold text-[#64748B]">
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
