import { useState } from "react";
import { motion } from "framer-motion";
import { X, Save, Loader2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditClientTargetsModalProps {
  clientId: string;
  clientName: string;
  currentCalories: number | null;
  currentProtein: number | null;
  currentCarbs: number | null;
  currentFat: number | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditClientTargetsModal({
  clientId,
  clientName,
  currentCalories,
  currentProtein,
  currentCarbs,
  currentFat,
  open,
  onClose,
  onSaved,
}: EditClientTargetsModalProps) {
  const { toast } = useToast();
  const [calories, setCalories] = useState(currentCalories ?? 2000);
  const [protein, setProtein] = useState(currentProtein ?? 150);
  const [carbs, setCarbs] = useState(currentCarbs ?? 250);
  const [fat, setFat] = useState(currentFat ?? 65);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update both profiles and nutrition_goals so client dashboard picks it up
      const updates = {
        daily_calorie_target: calories,
        protein_target_g: protein,
        carbs_target_g: carbs,
        fat_target_g: fat,
      };

      await Promise.all([
        supabase.from("profiles").update(updates).eq("user_id", clientId),
        supabase.from("nutrition_goals").update(updates).eq("user_id", clientId).eq("is_active", true),
      ]);

      toast({ title: "Targets updated", description: `${clientName}'s daily targets have been saved.` });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { label: "Daily Calories", value: calories, setter: setCalories, unit: "kcal", min: 800, max: 5000, step: 50 },
    { label: "Protein", value: protein, setter: setProtein, unit: "g", min: 30, max: 300, step: 5 },
    { label: "Carbs", value: carbs, setter: setCarbs, unit: "g", min: 50, max: 500, step: 5 },
    { label: "Fat", value: fat, setter: setFat, unit: "g", min: 20, max: 200, step: 5 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative z-10 w-full max-w-[400px] mx-4 mb-4 sm:mb-0 bg-white rounded-3xl shadow-xl border border-gray-100"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            <h2 className="text-lg font-extrabold text-gray-900">Edit Daily Targets</h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <p className="px-6 pb-4 text-[12px] text-slate-500">
          Setting new targets for <span className="font-semibold text-slate-700">{clientName}</span>. These will appear on their dashboard.
        </p>

        <div className="px-6 pb-6 space-y-3">
          {fields.map((field) => (
            <div key={field.label} className="space-y-1.5">
              <label className="text-[12px] font-semibold text-slate-600">{field.label}</label>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-4 h-[46px] focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                <input
                  type="number"
                  value={field.value}
                  onChange={(e) => field.setter(Math.min(field.max, Math.max(field.min, Number(e.target.value) || field.min)))}
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  className="flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[11px] font-semibold text-slate-400 shrink-0">{field.unit}</span>
              </div>
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-[46px] rounded-[16px] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-3"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Targets
          </button>
        </div>
      </motion.div>
    </div>
  );
}
