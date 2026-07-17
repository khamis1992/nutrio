import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeNutrition } from "@/lib/nutrition-types";
import type { FoodSearchItem } from "@/lib/food-providers";

interface QuickAddFoodFormProps {
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (item: FoodSearchItem) => Promise<void> | void;
}

type FieldKey = "calories" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g" | "sodium_mg";

const fields: Array<{ key: FieldKey; label: string; unit: string; color: string }> = [
  { key: "calories", label: "Calories", unit: "kcal", color: "text-[#22C7A1]" },
  { key: "protein_g", label: "Protein", unit: "g", color: "text-[#7C83F6]" },
  { key: "carbs_g", label: "Carbs", unit: "g", color: "text-[#38BDF8]" },
  { key: "fat_g", label: "Fat", unit: "g", color: "text-[#FB6B7A]" },
];

const detailFields: Array<{ key: FieldKey; label: string; unit: string }> = [
  { key: "fiber_g", label: "Fiber", unit: "g" },
  { key: "sugar_g", label: "Sugar", unit: "g" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
];

export function QuickAddFoodForm({ busy = false, onCancel, onSubmit }: QuickAddFoodFormProps) {
  const [name, setName] = useState("");
  const [values, setValues] = useState<Record<FieldKey, string>>({
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
    fiber_g: "",
    sugar_g: "",
    sodium_mg: "",
  });
  const [showDetails, setShowDetails] = useState(false);

  const calories = Number(values.calories);
  const canSubmit = useMemo(
    () => name.trim().length > 0 && Number.isFinite(calories) && calories > 0 && !busy,
    [busy, calories, name],
  );

  const updateValue = (key: FieldKey, value: string) => {
    if (value !== "" && !/^\d*\.?\d*$/.test(value)) return;
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (!canSubmit) return;
    const nutrition = normalizeNutrition(values);
    await onSubmit({
      id: `manual:${globalThis.crypto.randomUUID()}`,
      name: name.trim(),
      source: "manual",
      ...nutrition,
    });
  };

  return (
    <div className="flex h-full flex-col" data-testid="quick-add-food-form">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-5 rounded-2xl bg-[#F6F8FB] p-4 ring-1 ring-slate-200/80">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#22C7A1] shadow-sm ring-1 ring-slate-100">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-extrabold text-[#020617]">Quick add</p>
              <p className="text-xs font-medium text-[#94A3B8]">Log nutrition without searching the catalog.</p>
            </div>
          </div>
          <label className="text-[11px] font-extrabold uppercase text-[#94A3B8]" htmlFor="quick-food-name">Food name</label>
          <Input
            id="quick-food-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Homemade chicken wrap"
            className="mt-2 h-12 rounded-xl border-slate-200 bg-white text-[15px] font-semibold text-[#020617]"
          />
        </div>

        <p className="mb-3 text-[11px] font-extrabold uppercase text-[#94A3B8]">Nutrition per serving</p>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((field) => (
            <label key={field.key} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              <span className={`text-xs font-extrabold ${field.color}`}>{field.label}</span>
              <span className="mt-2 flex items-baseline gap-1">
                <input
                  aria-label={field.label}
                  inputMode="decimal"
                  value={values[field.key]}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  placeholder="0"
                  className="min-w-0 flex-1 bg-transparent text-2xl font-black text-[#020617] outline-none"
                />
                <span className="text-[10px] font-bold uppercase text-[#94A3B8]">{field.unit}</span>
              </span>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="mt-4 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-left text-sm font-extrabold text-[#020617]"
        >
          More nutrients
          {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showDetails && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F6F8FB] p-3 ring-1 ring-slate-200/80">
            {detailFields.map((field) => (
              <label key={field.key} className="min-w-0 rounded-xl bg-white p-3 ring-1 ring-slate-100">
                <span className="block truncate text-[10px] font-extrabold text-[#94A3B8]">{field.label}</span>
                <span className="mt-2 flex items-baseline gap-1">
                  <input
                    aria-label={field.label}
                    inputMode="decimal"
                    value={values[field.key]}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    placeholder="0"
                    className="min-w-0 flex-1 bg-transparent text-lg font-black text-[#020617] outline-none"
                  />
                  <span className="text-[9px] font-bold text-[#94A3B8]">{field.unit}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[0.7fr_1.3fr] gap-3 border-t border-slate-100 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <Button type="button" variant="outline" onClick={onCancel} className="h-12 rounded-full border-slate-200 font-extrabold">
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="h-12 rounded-full bg-[#020617] font-extrabold text-white hover:bg-slate-800"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {busy ? "Logging..." : "Log food"}
        </Button>
      </div>
    </div>
  );
}
