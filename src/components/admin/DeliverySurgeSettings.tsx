import { useCallback, useEffect, useState } from "react";
import { Clock3, Loader2, Plus, Save, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export interface DeliveryFeeAdminSettings {
  standard: number;
  express: number;
  free_threshold: number;
  enabled: boolean;
  surge_enabled: boolean;
  max_surcharge: number;
}

interface SurgeRule {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  cities: string[];
  demand_threshold: number;
  multiplier: number;
  flat_surcharge: number;
  max_surcharge: number;
  customer_message: string;
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const inputClass = "min-h-[44px] rounded-[14px] border-[#E5EAF1] bg-white font-bold text-[#020617] focus-visible:ring-[#22C7A1]/30";

const defaultRule = (): SurgeRule => ({
  name: "New pricing rule",
  description: "",
  enabled: false,
  priority: 100,
  days_of_week: [],
  start_time: "17:00",
  end_time: "20:00",
  cities: [],
  demand_threshold: 0,
  multiplier: 1.15,
  flat_surcharge: 0,
  max_surcharge: 15,
  customer_message: "Higher demand applies for this delivery window.",
});

const normalizeRule = (value: unknown): SurgeRule => {
  const rule = (value || {}) as Record<string, unknown>;
  return {
    id: typeof rule.id === "string" ? rule.id : undefined,
    name: typeof rule.name === "string" ? rule.name : "Pricing rule",
    description: typeof rule.description === "string" ? rule.description : "",
    enabled: rule.enabled === true,
    priority: Number(rule.priority) || 100,
    days_of_week: Array.isArray(rule.days_of_week) ? rule.days_of_week.map(Number) : [],
    start_time: typeof rule.start_time === "string" ? rule.start_time.slice(0, 5) : "",
    end_time: typeof rule.end_time === "string" ? rule.end_time.slice(0, 5) : "",
    cities: Array.isArray(rule.cities) ? rule.cities.map(String) : [],
    demand_threshold: Number(rule.demand_threshold) || 0,
    multiplier: Number(rule.multiplier) || 1,
    flat_surcharge: Number(rule.flat_surcharge) || 0,
    max_surcharge: Number(rule.max_surcharge) || 0,
    customer_message: typeof rule.customer_message === "string"
      ? rule.customer_message
      : "Higher demand applies for this delivery window.",
  };
};

interface DeliverySurgeSettingsProps {
  settings: DeliveryFeeAdminSettings;
  onSettingsChange: (settings: DeliveryFeeAdminSettings) => void;
}

export function DeliverySurgeSettings({ settings, onSettingsChange }: DeliverySurgeSettingsProps) {
  const [rules, setRules] = useState<SurgeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_delivery_surge_rules" as never);
    if (error) {
      console.error("Error loading surge rules:", error);
      toast.error("Failed to load delivery pricing rules");
    } else {
      const rawData = data as unknown;
      setRules(Array.isArray(rawData) ? rawData.map(normalizeRule) : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const updateRule = (index: number, patch: Partial<SurgeRule>) => {
    setRules((current) => current.map((rule, ruleIndex) => (
      ruleIndex === index ? { ...rule, ...patch } : rule
    )));
  };

  const saveRule = async (index: number) => {
    const rule = rules[index];
    const requestId = rule.id || `new-${index}`;
    setSavingId(requestId);
    const { data, error } = await supabase.rpc(
      "admin_upsert_delivery_surge_rule" as never,
      { p_rule: rule } as never,
    );
    setSavingId(null);

    if (error) {
      console.error("Error saving surge rule:", error);
      toast.error("Failed to save pricing rule");
      return;
    }

    updateRule(index, normalizeRule(data));
    toast.success("Delivery pricing rule saved");
  };

  const deleteRule = async (index: number) => {
    const rule = rules[index];
    if (!rule.id) {
      setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index));
      return;
    }
    if (!window.confirm(`Delete “${rule.name}”?`)) return;

    setSavingId(rule.id);
    const { error } = await supabase.rpc(
      "admin_delete_delivery_surge_rule" as never,
      { p_rule_id: rule.id } as never,
    );
    setSavingId(null);
    if (error) {
      console.error("Error deleting surge rule:", error);
      toast.error("Failed to delete pricing rule");
      return;
    }
    setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index));
    toast.success("Delivery pricing rule deleted");
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex min-h-[72px] items-center justify-between gap-3 rounded-[18px] border border-[#E5EAF1] bg-white px-4">
          <div>
            <p className="text-sm font-black text-[#020617]">Delivery fees</p>
            <p className="mt-1 text-xs font-semibold text-[#94A3B8]">Charge a base fee</p>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => onSettingsChange({ ...settings, enabled })}
            className="data-[state=checked]:bg-[#22C7A1]"
          />
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-standard">Standard (QAR)</Label>
          <Input id="delivery-standard" type="number" min="0" step="0.5" value={settings.standard} onChange={(event) => onSettingsChange({ ...settings, standard: Number(event.target.value) })} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-express">Express (QAR)</Label>
          <Input id="delivery-express" type="number" min="0" step="0.5" value={settings.express} onChange={(event) => onSettingsChange({ ...settings, express: Number(event.target.value) })} className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="delivery-free-threshold">Free over (QAR)</Label>
          <Input id="delivery-free-threshold" type="number" min="0" step="5" value={settings.free_threshold} onChange={(event) => onSettingsChange({ ...settings, free_threshold: Number(event.target.value) })} className={inputClass} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[20px] border border-[#38BDF8]/25 bg-[#EAF8FF] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-[#38BDF8]">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-[#020617]">Dynamic delivery pricing</p>
            <p className="mt-1 text-sm font-semibold text-[#64748B]">Apply the highest-priority matching rule and disclose the reason before confirmation.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 space-y-1">
            <Label htmlFor="surge-global-cap" className="text-xs">Global cap</Label>
            <Input id="surge-global-cap" type="number" min="0" step="1" value={settings.max_surcharge} onChange={(event) => onSettingsChange({ ...settings, max_surcharge: Number(event.target.value) })} className={inputClass} />
          </div>
          <Switch
            checked={settings.surge_enabled}
            onCheckedChange={(surge_enabled) => onSettingsChange({ ...settings, surge_enabled })}
            className="data-[state=checked]:bg-[#22C7A1]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black text-[#020617]">Pricing rules</p>
          <p className="mt-1 text-xs font-semibold text-[#94A3B8]">Empty days or cities means the rule applies everywhere.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => setRules((current) => [...current, defaultRule()])} className="min-h-11 rounded-[14px] font-black">
          <Plus className="mr-2 h-4 w-4" /> Add rule
        </Button>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-[20px] bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-[#22C7A1]" />
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#CBD5E1] bg-white p-8 text-center text-sm font-bold text-[#64748B]">
          No pricing rules yet. Base delivery fees still apply.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => {
            const requestId = rule.id || `new-${index}`;
            return (
              <div key={requestId} className="rounded-[20px] border border-[#E5EAF1] bg-white p-4">
                <div className="flex items-center gap-3">
                  <Switch checked={rule.enabled} onCheckedChange={(enabled) => updateRule(index, { enabled })} className="data-[state=checked]:bg-[#22C7A1]" />
                  <Input value={rule.name} onChange={(event) => updateRule(index, { name: event.target.value })} aria-label="Rule name" className={`${inputClass} flex-1 text-base font-black`} />
                  <Button type="button" size="icon" variant="outline" onClick={() => void deleteRule(index)} disabled={savingId === requestId} className="h-11 w-11 shrink-0 rounded-[14px] text-[#FB6B7A]">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label>Time window</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="time" value={rule.start_time} onChange={(event) => updateRule(index, { start_time: event.target.value })} className={inputClass} />
                      <Input type="time" value={rule.end_time} onChange={(event) => updateRule(index, { end_time: event.target.value })} className={inputClass} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Orders threshold</Label>
                    <Input type="number" min="0" value={rule.demand_threshold} onChange={(event) => updateRule(index, { demand_threshold: Number(event.target.value) })} className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Multiplier</Label>
                    <Input type="number" min="1" max="5" step="0.05" value={rule.multiplier} onChange={(event) => updateRule(index, { multiplier: Number(event.target.value) })} className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Flat fee</Label>
                    <Input type="number" min="0" step="0.5" value={rule.flat_surcharge} onChange={(event) => updateRule(index, { flat_surcharge: Number(event.target.value) })} className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rule cap</Label>
                    <Input type="number" min="0" step="1" value={rule.max_surcharge} onChange={(event) => updateRule(index, { max_surcharge: Number(event.target.value) })} className={inputClass} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {DAYS.map((day) => {
                    const active = rule.days_of_week.includes(day.value);
                    return (
                      <button key={day.value} type="button" onClick={() => updateRule(index, { days_of_week: active ? rule.days_of_week.filter((value) => value !== day.value) : [...rule.days_of_week, day.value] })} className={`min-h-9 rounded-full px-3 text-xs font-black ${active ? "bg-[#020617] text-white" : "bg-[#F6F8FB] text-[#64748B]"}`}>
                        {day.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Cities</Label>
                    <Input value={rule.cities.join(", ")} onChange={(event) => updateRule(index, { cities: event.target.value.split(",").map((city) => city.trim()).filter(Boolean) })} placeholder="Doha, Al Wakrah" className={inputClass} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Customer explanation</Label>
                    <Input value={rule.customer_message} onChange={(event) => updateRule(index, { customer_message: event.target.value })} className={inputClass} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E5EAF1] pt-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#94A3B8]">
                    <Clock3 className="h-4 w-4" /> Priority {rule.priority}
                  </div>
                  <Button type="button" onClick={() => void saveRule(index)} disabled={savingId === requestId} className="min-h-11 rounded-[14px] bg-[#020617] px-5 font-black text-white hover:bg-[#020617]/90">
                    {savingId === requestId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save rule
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
